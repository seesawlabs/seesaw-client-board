import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, slackCursors } from "@/lib/db/schema";
import { slackConfigured, readChannel, renderTranscript, type ChannelRead } from "@/lib/slack";
import { normalizeClient, PROCESS } from "@/lib/process";
import { buildSlackUnits, type SlackUnit } from "./sources";
import { buildTools } from "./tools";
import type { Account, Client } from "@/lib/types";

const STEP_REF = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join(", ")}`).join("\n");
const MODEL = "anthropic/claude-sonnet-5";

async function getCursor(channelId: string): Promise<string> {
  const [row] = await db.select({ lastTs: slackCursors.lastTs }).from(slackCursors).where(eq(slackCursors.channelId, channelId));
  return row?.lastTs || "0";
}

async function setCursor(channelId: string, lastTs: string): Promise<void> {
  await db.insert(slackCursors).values({ channelId, lastTs, updatedAt: new Date() })
    .onConflictDoUpdate({ target: slackCursors.channelId, set: { lastTs, updatedAt: new Date() } });
}

async function runAgentOnSlack(account: Account, unit: SlackUnit, blocks: { label: string; read: ChannelRead }[]): Promise<string> {
  const turnId = "slack-" + unit.projects.map((p) => p.id.slice(0, 4)).join("") + "-" + blocks[0].read.latestTs.replace(".", "");
  const projList = unit.projects
    .map((p) => `- ${p.name} (id=${p.id}) — phase ${p.phase}, status ${p.status}${p.needs?.length ? `; open needs: ${p.needs.length}` : ""}`)
    .join("\n");
  // A project-scoped unit's channels are unambiguously about that one project;
  // an account-scoped unit's channels can concern any of the client's projects.
  const routing = unit.scope === "project"
    ? `These channels belong specifically to the project above — route every update to it (id=${unit.projects[0].id}).`
    : `These are the client's SHARED channels — route each update to whichever project it concerns by id (metadata/ETL/BigQuery → the ETL project; portal/schools/survey/questionnaire → the survey project).`;
  const system = [
    `You maintain the SeeSaw Labs client board. Below are recent SLACK messages for the client "${account.name}". Relevant project(s):`,
    projList || "(no projects on record)",
    `The messages come from TWO channels:`,
    `- INTERNAL: the SeeSaw team's private channel — candid. Real blockers, risks, and doubts surface here. Trust it for status truth.`,
    `- EXTERNAL: the shared client channel — client-facing. Commitments, client asks, agreed decisions, and deadlines.`,
    `Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    routing,
    `Read the messages and CALL TOOLS:`,
    `- advance a step to "doing"/"done"/"validated" when messages show real progress;`,
    `- if something is blocked/waiting, set the relevant step to "doing" with a note starting "Blocked" explaining why (lean on INTERNAL);`,
    `- add each concrete action item / commitment as that project's need — call addListItem with kind "needs" (one call per item);`,
    `- add a new risk (kind "risks") when the internal channel surfaces one;`,
    `- record concrete decisions on the step they belong to; update project status only if clearly warranted.`,
    `Rules: only well-supported updates — do NOT invent. Ignore chit-chat. Do NOT create or delete projects. Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
  ].join("\n");

  const transcript = blocks
    .filter((b) => b.read.messages.length)
    .map((b) => `=== ${b.label} channel (#${b.read.channelName}) ===\n${renderTranscript(b.read)}`)
    .join("\n\n");

  const res = await generateText({ model: MODEL, system, messages: [{ role: "user", content: transcript }], tools: buildTools(turnId), stopWhen: stepCountIs(40) });
  return res.text?.trim() || `Ingested Slack for ${unit.label}`;
}

export type SlackIngestResult = { account: string; messages: number; summaries: string[] };

export async function ingestSlackForAccount(account: Account, projects: Client[]): Promise<SlackIngestResult> {
  const units = buildSlackUnits(account, projects);
  if (!units.length) return { account: account.name, messages: 0, summaries: [] };

  let total = 0;
  const summaries: string[] = [];
  for (const unit of units) {
    const blocks: { label: string; read: ChannelRead }[] = [];
    for (const ch of unit.channels) {
      const cursor = await getCursor(ch.id);
      blocks.push({ label: ch.label, read: await readChannel(ch.id, cursor) });
    }
    const count = blocks.reduce((n, b) => n + b.read.messages.length, 0);
    if (count === 0) continue;
    total += count;
    summaries.push(await runAgentOnSlack(account, unit, blocks));
    for (const b of blocks) await setCursor(b.read.channelId, b.read.latestTs); // advance only after a successful run
  }
  return { account: account.name, messages: total, summaries };
}

/** Ingest new Slack messages for every account (and its projects) that has channels configured. */
export async function ingestAllSlack(): Promise<SlackIngestResult[]> {
  if (!slackConfigured()) throw new Error("Slack not configured (SLACK_BOT_TOKEN unset)");
  const [aRows, cRows] = await Promise.all([db.select().from(accounts), db.select().from(clients)]);
  const results: SlackIngestResult[] = [];
  for (const a of aRows) {
    const acct: Account = { id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal };
    const projects = cRows
      .filter((r) => r.accountId === a.id)
      .map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>));
    // skip accounts with no channels anywhere (account or project level)
    if (!buildSlackUnits(acct, projects).length) continue;
    results.push(await ingestSlackForAccount(acct, projects));
  }
  return results;
}
