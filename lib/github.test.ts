import { describe, it, expect } from "vitest";
import { parseRepo, renderGithubDigest, type PullSummary, type IssueSummary } from "./github";

describe("parseRepo", () => {
  it("parses owner/repo", () => {
    expect(parseRepo("seesawlabs/topminnow-etl")).toEqual({ owner: "seesawlabs", repo: "topminnow-etl" });
  });
  it("strips a github URL and .git", () => {
    expect(parseRepo("https://github.com/seesawlabs/topminnow-etl.git")).toEqual({ owner: "seesawlabs", repo: "topminnow-etl" });
  });
  it("rejects malformed input", () => {
    expect(parseRepo("not-a-repo")).toBeNull();
    expect(parseRepo("a/b/c")).toBeNull();
    expect(parseRepo("")).toBeNull();
  });
});

describe("renderGithubDigest", () => {
  const pull = (o: Partial<PullSummary>): PullSummary => ({
    number: 1, title: "T", state: "open", draft: false, merged: false, author: "kit",
    labels: [], updated: "2026-07-20T10:00:00Z", created: "2026-07-19T10:00:00Z", url: "u", ...o,
  });
  const issue = (o: Partial<IssueSummary>): IssueSummary => ({
    number: 9, title: "I", state: "open", author: "gui", assignees: [], labels: [],
    updated: "2026-07-20T10:00:00Z", created: "2026-07-19T10:00:00Z", closed: null, url: "u", ...o,
  });

  it("labels merged/draft/state and lists issues", () => {
    const out = renderGithubDigest(
      [pull({ number: 42, title: "metadata layer", merged: true, author: "joao" })],
      [issue({ number: 7, title: "seed data", state: "closed" })],
    );
    expect(out).toContain("#42 [MERGED] metadata layer — @joao");
    expect(out).toContain("#7 [closed] seed data — @gui");
  });

  it("handles empty sets", () => {
    const out = renderGithubDigest([], []);
    expect(out).toContain("PULL REQUESTS: (none in range)");
    expect(out).toContain("ISSUES: (none in range)");
  });
});
