import { describe, it, expect } from "vitest";
import { buildSlackUnits, buildStandupUnits } from "./sources";
import type { Account, Client } from "@/lib/types";

const acct = (o: Partial<Account>): Account => ({ id: "a1", name: "Topminnow", driveFolderId: "", slackInternal: "", slackExternal: "", ...o });
const proj = (o: Partial<Client>): Client => ({
  id: "p1", accountId: "a1", name: "P", summary: "", start: "", end: "", phase: "Discover", status: "On Track",
  billing: "billable", opportunity: { types: [], note: "" }, contractValue: null, buildUrl: "", assignments: [],
  risks: [], needs: [], findings: [], links: [], entryPoint: { mode: "greenfield", atStep: null }, process: {},
  driveFolderId: "", slackInternal: "", slackExternal: "", githubRepo: "", ...o,
});

describe("buildSlackUnits", () => {
  it("makes a project-scoped unit for a project with its own channels", () => {
    const units = buildSlackUnits(acct({}), [proj({ id: "sa", name: "State Agency", slackInternal: "CINT", slackExternal: "CEXT" })]);
    const p = units.find((u) => u.scope === "project");
    expect(p?.channels.map((c) => c.id)).toEqual(["CINT", "CEXT"]);
    expect(p?.projects).toHaveLength(1);
    expect(p?.projects[0].name).toBe("State Agency");
  });

  it("adds a shared account unit covering all projects when the account has channels", () => {
    const units = buildSlackUnits(acct({ slackInternal: "CACC" }), [proj({ id: "a" }), proj({ id: "b" })]);
    const shared = units.find((u) => u.scope === "account");
    expect(shared?.channels[0].id).toBe("CACC");
    expect(shared?.projects.map((p) => p.id)).toEqual(["a", "b"]);
  });

  it("returns nothing when no channels are configured anywhere", () => {
    expect(buildSlackUnits(acct({}), [proj({})])).toHaveLength(0);
  });

  it("a project override and the account share both produce units", () => {
    const units = buildSlackUnits(acct({ slackInternal: "CACC" }), [proj({ id: "sa", slackInternal: "COWN" })]);
    expect(units.map((u) => u.scope).sort()).toEqual(["account", "project"]);
  });
});

describe("buildStandupUnits", () => {
  it("uses a project's own folder over the account's", () => {
    const units = buildStandupUnits(acct({ driveFolderId: "ACCF" }), [proj({ id: "sa", driveFolderId: "OWNF" })]);
    expect(units.find((u) => u.scope === "project")?.folderId).toBe("OWNF");
    expect(units.find((u) => u.scope === "account")?.folderId).toBe("ACCF");
  });
});
