// Minimal read-only GitHub REST client. Auth is a single fine-grained PAT
// (GITHUB_TOKEN) with read access to Pull requests, Issues, Contents, Metadata.
// We only ever READ.

const token = () => process.env.GITHUB_TOKEN || "";
export const githubConfigured = () => !!token();

const API = "https://api.github.com";

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: {
      authorization: `Bearer ${token()}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
  if (!res.ok) throw new Error(`github ${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

// ---- pure helpers (unit-tested) -----------------------------------------

/** Validate/normalize an "owner/repo" string; returns null if malformed. */
export function parseRepo(input: string): { owner: string; repo: string } | null {
  const m = (input || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "").match(/^([^/\s]+)\/([^/\s]+)$/);
  return m ? { owner: m[1], repo: m[2] } : null;
}

export type PullSummary = {
  number: number; title: string; state: "open" | "closed"; draft: boolean; merged: boolean;
  author: string; labels: string[]; updated: string; created: string; url: string; reviewState?: string;
};
export type IssueSummary = {
  number: number; title: string; state: "open" | "closed"; author: string; assignees: string[];
  labels: string[]; updated: string; created: string; closed: string | null; url: string;
};

type RawPull = {
  number: number; title: string; state: string; draft?: boolean; merged_at: string | null;
  user?: { login?: string }; labels?: { name?: string }[]; updated_at: string; created_at: string; html_url: string;
  pull_request?: unknown;
};
type RawIssue = {
  number: number; title: string; state: string; user?: { login?: string };
  assignees?: { login?: string }[]; labels?: ({ name?: string } | string)[]; updated_at: string;
  created_at: string; closed_at: string | null; html_url: string; pull_request?: unknown;
};

const labelNames = (labels?: ({ name?: string } | string)[]): string[] =>
  (labels || []).map((l) => (typeof l === "string" ? l : l.name || "")).filter(Boolean);

/** Recently-updated PRs (any state), newest first. `since` filters client-side. */
export async function listPulls(repo: { owner: string; repo: string }, since = ""): Promise<PullSummary[]> {
  const raw = await gh<RawPull[]>(`/repos/${repo.owner}/${repo.repo}/pulls?state=all&sort=updated&direction=desc&per_page=50`);
  return raw
    .filter((p) => !since || p.updated_at > since)
    .map((p) => ({
      number: p.number, title: p.title, state: p.state === "closed" ? "closed" : "open",
      draft: !!p.draft, merged: !!p.merged_at, author: p.user?.login || "unknown",
      labels: labelNames(p.labels), updated: p.updated_at, created: p.created_at, url: p.html_url,
    }));
}

/** Issues updated since `since` (excludes PRs, which the issues API also returns). */
export async function listIssues(repo: { owner: string; repo: string }, since = ""): Promise<IssueSummary[]> {
  const q = since ? `&since=${encodeURIComponent(since)}` : "";
  const raw = await gh<RawIssue[]>(`/repos/${repo.owner}/${repo.repo}/issues?state=all&sort=updated&direction=desc&per_page=50${q}`);
  return raw
    .filter((i) => !i.pull_request) // the issues endpoint includes PRs — drop them
    .map((i) => ({
      number: i.number, title: i.title, state: i.state === "closed" ? "closed" : "open",
      author: i.user?.login || "unknown", assignees: (i.assignees || []).map((a) => a.login || "").filter(Boolean),
      labels: labelNames(i.labels), updated: i.updated_at, created: i.created_at, closed: i.closed_at, url: i.html_url,
    }));
}

/** Render PRs + issues as a compact digest for the agent (or the chat). */
export function renderGithubDigest(pulls: PullSummary[], issues: IssueSummary[]): string {
  const pr = pulls.length
    ? "PULL REQUESTS:\n" + pulls.map((p) =>
        `  #${p.number} [${p.merged ? "MERGED" : p.draft ? "draft" : p.state}] ${p.title} — @${p.author}${p.labels.length ? ` (${p.labels.join(", ")})` : ""} · updated ${p.updated.slice(0, 10)}`).join("\n")
    : "PULL REQUESTS: (none in range)";
  const is = issues.length
    ? "ISSUES:\n" + issues.map((i) =>
        `  #${i.number} [${i.state}] ${i.title} — @${i.author}${i.assignees.length ? ` → ${i.assignees.join(", ")}` : ""}${i.labels.length ? ` (${i.labels.join(", ")})` : ""} · updated ${i.updated.slice(0, 10)}`).join("\n")
    : "ISSUES: (none in range)";
  return `${pr}\n\n${is}`;
}
