import { generateText, stepCountIs } from "ai";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, githubCursors } from "@/lib/db/schema";
import { githubConfigured, parseRepo, listPulls, listIssues, renderGithubDigest } from "@/lib/github";
import { normalizeClient, PROCESS } from "@/lib/process";
import { buildTools } from "./tools";
import type { Client } from "@/lib/types";

const STEP_REF = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join(", ")}`).join("\n");
const MODEL = "anthropic/claude-sonnet-5";

async function getCursor(repo: string): Promise<string> {
  const [row] = await db.select({ lastSync: githubCursors.lastSync }).from(githubCursors).where(eq(githubCursors.repo, repo));
  return row?.lastSync || "";
}

async function setCursor(repo: string, lastSync: string): Promise<void> {
  await db.insert(githubCursors).values({ repo, lastSync, updatedAt: new Date() })
    .onConflictDoUpdate({ target: githubCursors.repo, set: { lastSync, updatedAt: new Date() } });
}

async function runAgentOnGithub(project: Client, repo: string, digest: string): Promise<string> {
  const turnId = "gh-" + project.id.slice(0, 12);
  const system = [
    `You maintain the SeeSaw Labs client board. Below are recent GitHub PULL REQUESTS and ISSUES for the repo "${repo}", which is the "${project.name}" project (id=${project.id}, phase ${project.phase}, status ${project.status}).`,
    `Code is ground truth — trust it over what standups claim. Every project uses this fixed 5D process. Use these EXACT step ids with setStep (do not invent ids):`,
    STEP_REF,
    `Route EVERYTHING to this one project (id=${project.id}). From the PRs/issues, CALL TOOLS:`,
    `- a MERGED PR that implements real work → advance the step it belongs to (dev_build / dev_integrations / dev_qa / dev_security, or dep_* for release/monitoring) to "doing" or "done", and log a one-line finding (addListItem kind "findings");`,
    `- an OPEN PR awaiting review, or an open PR that's clearly the current focus → add a need (addListItem kind "needs", e.g. "Review PR #42: <title>"); if it maps to a step in progress, set that step "doing";`,
    `- a DRAFT or clearly STALE PR (no update in many days), or anything signalling trouble → add a risk (addListItem kind "risks");`,
    `- open issues that are real work items → needs; closed issues → progress/findings on the relevant step.`,
    `Rules: only well-supported updates from what the PRs/issues actually say — do NOT invent. Prefer setStep + addListItem; do not rewrite contract metadata. Auto-apply. End with a one-to-two sentence summary of exactly what you changed.`,
  ].join("\n");

  // restricted toolset — GitHub status must not rewrite contract metadata
  const t = buildTools(turnId);
  const tools = { queryBoard: t.queryBoard, setStep: t.setStep, addListItem: t.addListItem };

  const res = await generateText({ model: MODEL, system, messages: [{ role: "user", content: digest }], tools, stopWhen: stepCountIs(40) });
  return res.text?.trim() || `Read GitHub for ${project.name}`;
}

export type GithubIngestResult = { project: string; items: number; summary: string | null };

export async function ingestGithubForProject(project: Client): Promise<GithubIngestResult> {
  const parsed = parseRepo(project.githubRepo);
  if (!parsed) return { project: project.name, items: 0, summary: null };
  const repo = `${parsed.owner}/${parsed.repo}`;
  const since = await getCursor(repo);

  const [pulls, issues] = await Promise.all([listPulls(parsed, since), listIssues(parsed, since)]);
  const items = pulls.length + issues.length;
  if (items === 0) return { project: project.name, items: 0, summary: null };

  const digest = renderGithubDigest(pulls, issues);
  const summary = await runAgentOnGithub(project, repo, digest);

  // advance cursor to the newest activity we just read
  const newest = [...pulls.map((p) => p.updated), ...issues.map((i) => i.updated)].sort().pop() || since;
  await setCursor(repo, newest);
  return { project: project.name, items, summary };
}

/** Ingest new GitHub activity for every project with a repo configured. */
export async function ingestAllGithub(): Promise<GithubIngestResult[]> {
  if (!githubConfigured()) throw new Error("GitHub not configured (GITHUB_TOKEN unset)");
  const cRows = await db.select().from(clients);
  const results: GithubIngestResult[] = [];
  for (const r of cRows) {
    if (!r.githubRepo) continue;
    const project = normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>);
    results.push(await ingestGithubForProject(project));
  }
  return results;
}
