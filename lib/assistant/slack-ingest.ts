import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, slackCursors } from "@/lib/db/schema";
import { slackConfigured, readChannel, renderTranscript, type ChannelRead } from "@/lib/slack";
import { normalizeClient, PROCESS } from "@/lib/process";
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

async function runAgentOnSlack(account: Account, projects: Client[], blocks: { label: string; read: ChannelRead }[]): Promise<string> {
  const turnId = "slack-" + account.id.slice(0, 12) + "-" + blocks[0].read.latestTs.replace(".", "");
  const projList = projects
    .map((p) => `- ${p.name} (id=${p.id}) — phase ${p.phase}, status ${p.status}${p.needs?.length ? `; open needs: ${p.needs.length}` : ""}`)
    .join("\n");
  const system = [
    `You maintain the SeeSaw Labs client board. Below are recent SLACK messages for the client "${account.name}", which has these projects:`,
    projList || "(no projects on record)",
    `The messages come from TWO channels:`,
    `- INTERNAL: the SeeSaw team's private channel — candid. This is where real blockers, risks, and doubts surface. Trust it for status truth.`,
    `- EXTERNAL: the shared client channel — client-facing. Use it for commitments, client asks, decisions agreed with the client, and deadlines.`,
    `Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    `Read the messages and CALL TOOLS to update the RIGHT project(s) by their id:`,
    `- advance a step to "doing"/"done"/"validated" when messages show real progress;`,
    `- if something is blocked/waiting, set the relevant step to "doing" with a note starting "Blocked" explaining why (lean on the INTERNAL channel for this);`,
    `- add each concrete action item / commitment as that project's need — call addListItem with kind "needs" (one call per item);`,
    `- add a new risk (kind "risks") when the internal channel surfaces one;`,
    `- record concrete decisions on the step they belong to;`,
    `- update project status only if clearly warranted (e.g. internal candor shows a project slipping → "At Risk").`,
    `Rules: only well-supported updates — do NOT invent. Ignore chit-chat. Do NOT create or delete projects. Route each update to the project it actually concerns (metadata/ETL/BigQuery → the ETL project; portal/schools/survey → the survey project). Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
  ].join("\n");

  const transcript = blocks
    .filter((b) => b.read.messages.length)
    .map((b) => `=== ${b.label} channel (#${b.read.channelName}) ===\n${renderTranscript(b.read)}`)
    .join("\n\n");

  const res = await generateText({
    model: MODEL,
    system,
    messages: [{ role: "user", content: transcript }],
    tools: buildTools(turnId),
    stopWhen: stepCountIs(40),
  });
  return res.text?.trim() || `Ingested Slack for ${account.name}`;
}

export type SlackIngestResult = { account: string; messages: number; summary: string | null };

export async function ingestSlackForAccount(account: Account, projects: Client[]): Promise<SlackIngestResult> {
  const channels: { label: string; id: string }[] = [];
  if (account.slackInternal) channels.push({ label: "INTERNAL", id: account.slackInternal });
  if (account.slackExternal) channels.push({ label: "EXTERNAL", id: account.slackExternal });
  if (!channels.length) return { account: account.name, messages: 0, summary: null };

  const blocks: { label: string; read: ChannelRead }[] = [];
  for (const ch of channels) {
    const cursor = await getCursor(ch.id);
    const read = await readChannel(ch.id, cursor);
    blocks.push({ label: ch.label, read });
  }

  const total = blocks.reduce((n, b) => n + b.read.messages.length, 0);
  if (total === 0) return { account: account.name, messages: 0, summary: null };

  const summary = await runAgentOnSlack(account, projects, blocks);
  // advance each channel cursor only after a successful run
  for (const b of blocks) await setCursor(b.read.channelId, b.read.latestTs);
  return { account: account.name, messages: total, summary };
}

/** Ingest new Slack messages for every account that has a channel configured. */
export async function ingestAllSlack(): Promise<SlackIngestResult[]> {
  if (!slackConfigured()) throw new Error("Slack not configured (SLACK_BOT_TOKEN unset)");
  const [aRows, cRows] = await Promise.all([db.select().from(accounts), db.select().from(clients)]);
  const results: SlackIngestResult[] = [];
  for (const a of aRows) {
    if (!a.slackInternal && !a.slackExternal) continue;
    const acct: Account = { id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal };
    const projects = cRows
      .filter((r) => r.accountId === a.id)
      .map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>));
    results.push(await ingestSlackForAccount(acct, projects));
  }
  return results;
}
