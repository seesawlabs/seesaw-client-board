import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, ingestedDocs } from "@/lib/db/schema";
import { driveSearch, readFileText, getConnection, READABLE_MIME, type DriveFile } from "@/lib/google";
import { normalizeClient, PROCESS } from "@/lib/process";
import { buildTools } from "./tools";
import type { Account, Client } from "@/lib/types";

const STEP_REF = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join(", ")}`).join("\n");
const MODEL = "anthropic/claude-sonnet-5";
const MAX_DOCS = 10; // cap docs read per account per run
const PER_DOC = 8000; // chars per doc

const FOLDER_MIME = "application/vnd.google-apps.folder";
// legal / sales boilerplate we don't want to spend tokens on
const DENY = /\bmsa\b|master service|\bnda\b|non.?disclosure|agreement|proposal|_deck|pitch/i;

export type ContextDoc = { file: DriveFile; hint: string | null };

/** Collect readable spec/scope docs from the main folder + its immediate
 *  subfolders (skipping Meetings and legal/sales docs). `hint` is the
 *  subfolder name, used to route a doc to the project it concerns. */
export async function listContextDocs(account: Account): Promise<ContextDoc[]> {
  const root = account.driveFolderId;
  if (!root) return [];
  const rootChildren = await driveSearch(`'${root}' in parents and trashed=false`);
  const out: ContextDoc[] = [];
  const readable = (f: DriveFile) => READABLE_MIME.has(f.mimeType) && !DENY.test(f.name);

  for (const f of rootChildren) if (readable(f)) out.push({ file: f, hint: null });

  const subfolders = rootChildren.filter((f) => f.mimeType === FOLDER_MIME && !/meeting/i.test(f.name));
  for (const sf of subfolders) {
    const kids = await driveSearch(`'${sf.id}' in parents and trashed=false`);
    for (const k of kids) if (readable(k)) out.push({ file: k, hint: sf.name });
  }

  // newest first, capped
  out.sort((a, b) => (b.file.modifiedTime || "").localeCompare(a.file.modifiedTime || ""));
  return out.slice(0, MAX_DOCS);
}

async function runAgentOnContext(account: Account, projects: Client[], docs: { doc: ContextDoc; text: string }[]): Promise<string> {
  const turnId = "ctx-" + account.id.slice(0, 12);
  const projList = projects
    .map((p) => `- ${p.name} (id=${p.id}) — phase ${p.phase}, status ${p.status}`)
    .join("\n");
  const system = [
    `You maintain the SeeSaw Labs client board. Below are the SOURCE / SPEC documents for the client "${account.name}" (e.g. SOW, vision spec, scope, data definitions, onboarding brief). These establish the project's scope, requirements, and acceptance criteria — the BASELINE, not daily updates.`,
    `The client has these projects:`,
    projList || "(no projects on record)",
    `Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    `From the documents, CALL TOOLS to establish an accurate baseline on the RIGHT project(s) by id:`,
    `- a signed/countersigned SOW → def_scope "validated"; log the key scope decisions on def_scope;`,
    `- documented requirements / acceptance criteria (e.g. a vision spec) → def_requirements "done"; success metrics → def_metrics "done";`,
    `- architecture / data-model / table-definition docs → def_architecture "done";`,
    `- documented milestones / roadmap → def_roadmap "done";`,
    `- clear evidence discovery happened (onboarding brief, stakeholder list, gap analysis) → the relevant dsc_* steps "done";`,
    `- record material constraints or risks the docs surface via addListItem (kind "risks").`,
    `Each document is labelled with a routing hint. Route root-level docs to the project they concern by content (metadata/ETL/BigQuery → the ETL project; portal/schools/survey/questionnaire → the survey project).`,
    `Rules: only mark steps the DOCUMENTS actually support. Do NOT mark build/QA/deploy (dev_*/dep_*) steps done from specs alone — those need real progress, not a plan. Do NOT invent. Do NOT create or delete projects. Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
  ].join("\n");

  const body = docs
    .map(({ doc, text }) => `=== ${doc.file.name}${doc.hint ? ` (in "${doc.hint}")` : ""} ===\n${text}`)
    .join("\n\n");

  // Restrict to read + step/list tools — context docs must never rewrite
  // contract metadata (dates/$/status) or create/delete anything.
  const t = buildTools(turnId);
  const tools = { queryBoard: t.queryBoard, setStep: t.setStep, addListItem: t.addListItem };

  const res = await generateText({
    model: MODEL,
    system,
    messages: [{ role: "user", content: body }],
    tools,
    stopWhen: stepCountIs(40),
  });
  return res.text?.trim() || `Read ${docs.length} docs for ${account.name}`;
}

export type ContextIngestResult = { account: string; docs: number; summary: string | null };

export async function ingestContextForAccount(account: Account, projects: Client[]): Promise<ContextIngestResult> {
  const candidates = await listContextDocs(account);
  if (!candidates.length) return { account: account.name, docs: 0, summary: null };

  // only (re)read docs we haven't ingested, or whose modifiedTime changed
  const rows = await db.select({ id: ingestedDocs.docId, mt: ingestedDocs.modifiedTime })
    .from(ingestedDocs).where(eq(ingestedDocs.accountId, account.id));
  const seen = new Map(rows.map((r) => [r.id, r.mt]));
  const fresh = candidates.filter((c) => seen.get(c.file.id) !== (c.file.modifiedTime || ""));
  if (!fresh.length) return { account: account.name, docs: 0, summary: null };

  const withText: { doc: ContextDoc; text: string }[] = [];
  for (const c of fresh) {
    try { withText.push({ doc: c, text: await readFileText(c.file, PER_DOC) }); }
    catch { /* skip a doc we can't read rather than fail the whole run */ }
  }
  if (!withText.length) return { account: account.name, docs: 0, summary: null };

  const summary = await runAgentOnContext(account, projects, withText);

  for (const { doc } of withText) {
    await db.insert(ingestedDocs)
      .values({ docId: doc.file.id, accountId: account.id, title: doc.file.name, kind: "context", modifiedTime: doc.file.modifiedTime || "" })
      .onConflictDoUpdate({ target: ingestedDocs.docId, set: { title: doc.file.name, kind: "context", modifiedTime: doc.file.modifiedTime || "" } });
  }
  return { account: account.name, docs: withText.length, summary };
}

/** Read context docs for every account that has a Drive folder. */
export async function ingestAllContext(): Promise<ContextIngestResult[]> {
  const conn = await getConnection();
  if (!conn) throw new Error("Google not connected");
  const [aRows, cRows] = await Promise.all([db.select().from(accounts), db.select().from(clients)]);
  const results: ContextIngestResult[] = [];
  for (const a of aRows) {
    if (!a.driveFolderId) continue;
    const acct: Account = { id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal };
    const projects = cRows
      .filter((r) => r.accountId === a.id)
      .map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>));
    results.push(await ingestContextForAccount(acct, projects));
  }
  return results;
}
