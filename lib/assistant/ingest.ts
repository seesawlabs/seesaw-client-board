import { generateText, stepCountIs } from "ai";
import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, ingestedDocs, settings } from "@/lib/db/schema";
import { driveSearch, readDocText, getConnection, type DriveFile } from "@/lib/google";
import { normalizeClient, PROCESS } from "@/lib/process";
import { buildStandupUnits, type DriveUnit } from "./sources";
import { buildTools } from "./tools";
import type { Account, Client } from "@/lib/types";

const STEP_REF = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join(", ")}`).join("\n");
const MODEL = "anthropic/claude-sonnet-5";
const PER_RUN = 3; // cap docs ingested per unit per run
export const GLOBAL_STANDUP_KEY = "global_standup_folder";

async function findMeetingsFolder(driveFolderId: string): Promise<string> {
  const kids = await driveSearch(`'${driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const meetings = kids.find((f) => /meeting/i.test(f.name));
  return meetings ? meetings.id : driveFolderId; // fall back to the folder itself
}

/** Find standup docs for a unit (newest first). Account/project units look in a
 *  "Meetings" subfolder; the global unit reads its folder directly. */
async function findStandupDocs(unit: DriveUnit): Promise<DriveFile[]> {
  const folder = unit.scope === "global" ? unit.folderId : await findMeetingsFolder(unit.folderId);
  const safe = unit.nameContains.replace(/['\\]/g, " ");
  return driveSearch(
    `'${folder}' in parents and mimeType='application/vnd.google-apps.document' and name contains '${safe}' and trashed=false`,
  );
}

async function runAgentOnStandup(unit: DriveUnit, doc: DriveFile, text: string): Promise<string> {
  const turnId = "ingest-" + doc.id.slice(0, 12);
  const projList = unit.projects
    .map((p) => `- ${p.name} (id=${p.id}) — phase ${p.phase}, status ${p.status}${p.needs?.length ? `; open needs: ${p.needs.length}` : ""}`)
    .join("\n");
  const scopeLine = unit.scope === "global"
    ? `This is an INTERNAL SeeSaw all-hands standup covering many clients. Only update projects that clearly match by content; ignore anything about clients not listed above.`
    : unit.scope === "project"
      ? `This standup belongs to the project above — route updates to it (id=${unit.projects[0].id}).`
      : `This standup covers the client's projects — route each update to the project it concerns (metadata/ETL/BigQuery → the ETL project; portal/schools/survey → the survey project).`;
  const system = [
    `You maintain the SeeSaw Labs client board. Below is a STANDUP transcript. Relevant project(s):`,
    projList || "(no projects on record)",
    `Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    scopeLine,
    `Read it and CALL TOOLS to update the RIGHT project(s) by id:`,
    `- advance a step to "doing"/"done"/"validated" when the transcript shows real progress;`,
    `- if something is blocked/waiting, set the relevant step to "doing" with a note starting "Blocked" explaining why;`,
    `- add each owner-tagged "Next steps" / action item as that project's need — call addListItem with kind "needs" (one call per item);`,
    `- record concrete decisions on the step they belong to; update project status only if clearly warranted.`,
    `Rules: only well-supported updates — do NOT invent. Do NOT create or delete projects. Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
  ].join("\n");

  const res = await generateText({
    model: MODEL,
    system,
    messages: [{ role: "user", content: `Standup: ${doc.name}\n\n${text}` }],
    tools: buildTools(turnId),
    stopWhen: stepCountIs(40),
  });
  return res.text?.trim() || `Ingested ${doc.name}`;
}

export type IngestResult = { unit: string; docs: number; summaries: { title: string; summary: string }[] };

async function ingestUnit(unit: DriveUnit): Promise<IngestResult> {
  if (!unit.projects.length) return { unit: unit.label, docs: 0, summaries: [] };
  const found = await findStandupDocs(unit); // newest-first
  if (!found.length) return { unit: unit.label, docs: 0, summaries: [] };

  const seenRows = await db.select({ id: ingestedDocs.docId }).from(ingestedDocs)
    .where(inArray(ingestedDocs.docId, found.map((f) => f.id)));
  const seen = new Set(seenRows.map((r) => r.id));

  // collect the new standups newer than everything already ingested for this unit
  const newer: DriveFile[] = [];
  for (const d of found) { if (seen.has(d.id)) break; newer.push(d); }
  // first run for this unit (nothing seen): seed only the latest to set baseline;
  // afterwards apply new ones oldest-first so the board advances chronologically.
  const fresh = (seen.size === 0 ? newer.slice(0, 1) : newer.slice(0, PER_RUN)).reverse();

  const summaries: { title: string; summary: string }[] = [];
  for (const doc of fresh) {
    const text = await readDocText(doc.id, 14000);
    const summary = await runAgentOnStandup(unit, doc, text);
    await db.insert(ingestedDocs)
      .values({ docId: doc.id, accountId: unit.projects[0]?.accountId ?? null, title: doc.name, kind: "standup" })
      .onConflictDoNothing();
    summaries.push({ title: doc.name, summary });
  }
  return { unit: unit.label, docs: fresh.length, summaries };
}

/** Ingest new standups across all source tiers: global SeeSaw standups, then
 *  each account's shared folder and each project's own folder. */
export async function ingestAll(): Promise<IngestResult[]> {
  const conn = await getConnection();
  if (!conn) throw new Error("Google not connected");
  const [aRows, cRows] = await Promise.all([db.select().from(accounts), db.select().from(clients)]);
  const allProjects = cRows.map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>));

  const units: DriveUnit[] = [];
  // global internal standups (all projects), if a folder is configured
  const [gRow] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, GLOBAL_STANDUP_KEY));
  const globalFolder = gRow?.v || "";
  if (globalFolder && allProjects.length) {
    units.push({ label: "SeeSaw (internal)", scope: "global", folderId: globalFolder, nameContains: "SeeSaw Stand", projects: allProjects });
  }
  // per-account + per-project folders
  for (const a of aRows) {
    const acct: Account = { id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal };
    const projects = allProjects.filter((p) => p.accountId === a.id);
    units.push(...buildStandupUnits(acct, projects));
  }

  const results: IngestResult[] = [];
  for (const unit of units) results.push(await ingestUnit(unit));
  return results;
}
