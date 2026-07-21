import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, ingestedDocs } from "@/lib/db/schema";
import { driveSearch, readDocText, getConnection, type DriveFile } from "@/lib/google";
import { normalizeClient, PROCESS } from "@/lib/process";
import { buildTools } from "./tools";

const STEP_REF = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join(", ")}`).join("\n");
import type { Account, Client } from "@/lib/types";

const MODEL = "anthropic/claude-sonnet-5";
const PER_RUN = 3; // cap docs ingested per account per run

async function findMeetingsFolder(driveFolderId: string): Promise<string> {
  const kids = await driveSearch(`'${driveFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const meetings = kids.find((f) => /meeting/i.test(f.name));
  return meetings ? meetings.id : driveFolderId; // fall back to the client folder itself
}

async function runAgentOnStandup(account: Account, projects: Client[], doc: DriveFile, text: string): Promise<string> {
  const turnId = "ingest-" + doc.id.slice(0, 12);
  const projList = projects
    .map((p) => `- ${p.name} (id=${p.id}) — phase ${p.phase}, status ${p.status}${p.needs?.length ? `; open needs: ${p.needs.length}` : ""}`)
    .join("\n");
  const system = [
    `You maintain the SeeSaw Labs client board. Below is a DAILY STANDUP transcript for the client "${account.name}", which has these projects:`,
    projList || "(no projects on record)",
    `Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    `The standup covers ALL of the client's projects at once — read it and CALL TOOLS to update the RIGHT project(s) by their id:`,
    `- advance a step to "doing"/"done"/"validated" when the transcript shows real progress;`,
    `- if something is blocked/waiting, set the relevant step to "doing" with a note starting "Blocked" explaining why;`,
    `- add each owner-tagged "Next steps" / action item as that project's need — call addListItem with kind "needs" (one call per item);`,
    `- record concrete decisions on the step they belong to;`,
    `- update project status only if clearly warranted.`,
    `Rules: only well-supported updates — do NOT invent. Do NOT create or delete projects. Route each update to the project it actually concerns (metadata/ETL/BigQuery → the ETL project; portal/schools/survey → the survey project). Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
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

export type IngestResult = { account: string; docs: number; summaries: { title: string; summary: string }[] };

export async function ingestForAccount(account: Account, projects: Client[]): Promise<IngestResult> {
  if (!account.driveFolderId) return { account: account.name, docs: 0, summaries: [] };
  const folderId = await findMeetingsFolder(account.driveFolderId);
  // driveSearch returns newest-first (orderBy modifiedTime desc)
  const found = await driveSearch(
    `'${folderId}' in parents and mimeType='application/vnd.google-apps.document' and name contains 'Daily Standup' and trashed=false`,
  );
  const ingestedRows = await db.select({ id: ingestedDocs.docId }).from(ingestedDocs).where(eq(ingestedDocs.accountId, account.id));
  const seen = new Set(ingestedRows.map((r) => r.id));
  // collect the new standups newer than everything we've already ingested
  const newer: DriveFile[] = [];
  for (const d of found) { if (seen.has(d.id)) break; newer.push(d); }
  // first run: seed from just the latest standup (current state); after that, apply
  // the new ones oldest-first so the board advances chronologically.
  const fresh = (ingestedRows.length === 0 ? newer.slice(0, 1) : newer.slice(0, PER_RUN)).reverse();

  const summaries: { title: string; summary: string }[] = [];
  for (const doc of fresh) {
    const text = await readDocText(doc.id, 14000);
    const summary = await runAgentOnStandup(account, projects, doc, text);
    await db.insert(ingestedDocs).values({ docId: doc.id, accountId: account.id, title: doc.name }).onConflictDoNothing();
    summaries.push({ title: doc.name, summary });
  }
  return { account: account.name, docs: fresh.length, summaries };
}

/** Ingest new standups for every account that has a Drive folder. */
export async function ingestAll(): Promise<IngestResult[]> {
  const conn = await getConnection();
  if (!conn) throw new Error("Google not connected");
  const [aRows, cRows] = await Promise.all([db.select().from(accounts), db.select().from(clients)]);
  const results: IngestResult[] = [];
  for (const a of aRows) {
    if (!a.driveFolderId) continue;
    const acct: Account = { id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal };
    const projects = cRows
      .filter((r) => r.accountId === a.id)
      .map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>));
    results.push(await ingestForAccount(acct, projects));
  }
  return results;
}
