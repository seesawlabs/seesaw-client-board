import { describe, it, expect } from "vitest";
import {
  PROCESS, ALL_STEPS, STATUS_META, loadWeight, formatMoney, contractLabel,
  defaultProcessForEntry, normalizeClient,
} from "./process";
import { phaseRollup, clientProgress, skippedItems, resourceRows, CAPACITY } from "./process";

describe("template", () => {
  it("5 phases, 25 unique steps, Megamine flagged", () => {
    expect(PROCESS.map((p) => p.label)).toEqual(["Discover","Define","Design","Develop","Deploy"]);
    expect(ALL_STEPS).toHaveLength(25);
    expect(new Set(ALL_STEPS.map((s) => s.id)).size).toBe(25);
    expect(ALL_STEPS.find((s) => s.id === "dsc_rampup")!.megamine).toBe(true);
  });
  it("status meta applicability/completion", () => {
    expect(STATUS_META.done.complete).toBe(true);
    expect(STATUS_META.validated.complete).toBe(true);
    expect(STATUS_META.skipped.applicable).toBe(false);
    expect(STATUS_META.na.applicable).toBe(false);
  });
});

describe("formatters", () => {
  it("loadWeight / money / contract label", () => {
    expect(loadWeight("lead")).toBe(3);
    expect(loadWeight("light")).toBe(1);
    expect(formatMoney(85000)).toBe("$85,000");
    expect(contractLabel({ billing: "internal", contractValue: null } as any)).toBe("Internal / non-billable");
    expect(contractLabel({ billing: "billable", contractValue: null } as any)).toBe("—");
    expect(contractLabel({ billing: "billable", contractValue: 140000 } as any)).toBe("$140,000");
  });
});

describe("defaultProcessForEntry", () => {
  it("greenfield → all todo", () => {
    const p = defaultProcessForEntry({ mode: "greenfield", atStep: null });
    expect(Object.values(p).every((s) => s.status === "todo")).toBe(true);
  });
  it("mid-build → before entry validated, entry+after todo", () => {
    const p = defaultProcessForEntry({ mode: "mid-build", atStep: "dev_build" });
    expect(p.dsc_rampup.status).toBe("validated");
    expect(p.dev_scaffold.status).toBe("validated");
    expect(p.dev_build.status).toBe("todo");
    expect(p.dev_qa.status).toBe("todo");
  });
});

describe("normalizeClient", () => {
  it("fills defaults + full process map", () => {
    const c = normalizeClient({ name: "X" });
    expect(c.billing).toBe("billable");
    expect(c.opportunity).toEqual({ types: [], note: "" });
    expect(c.assignments).toEqual([]);
    expect(c.entryPoint).toEqual({ mode: "greenfield", atStep: null });
    expect(Object.keys(c.process)).toHaveLength(25);
    expect(c.process.dsc_rampup).toEqual({ status: "todo", note: "", decisions: [] });
  });
  it("preserves existing steps, backfills missing", () => {
    const c = normalizeClient({ name: "Y", process: { dsc_rampup: { status: "done", note: "", decisions: [] } } });
    expect(c.process.dsc_rampup.status).toBe("done");
    expect(c.process.def_scope.status).toBe("todo");
  });
  it("builds process from entryPoint when absent", () => {
    const c = normalizeClient({ name: "Z", entryPoint: { mode: "mid-build", atStep: "dev_build" } });
    expect(c.process.dsc_rampup.status).toBe("validated");
  });
});

const sample = () => normalizeClient({
  name: "Sample",
  process: {
    dsc_rampup: { status: "done", note: "", decisions: [] },
    dsc_stakeholders: { status: "done", note: "", decisions: [] },
    dsc_research: { status: "validated", note: "client did it", decisions: [] },
    dsc_competitive: { status: "skipped", note: "client provided", decisions: [] },
    dsc_feasibility: { status: "na", note: "", decisions: [] },
    def_metrics: { status: "doing", note: "", decisions: [] },
  },
});

describe("phaseRollup", () => {
  it("counts complete + excludes skipped/na", () => {
    const r = phaseRollup(sample(), "discover");
    expect(r).toMatchObject({ total: 5, done: 3, skipped: 1, na: 1, applicable: 3, complete: true });
  });
  it("define incomplete (a step only doing)", () => {
    expect(phaseRollup(sample(), "define").complete).toBe(false);
  });
});
describe("clientProgress", () => {
  it("percent of applicable complete", () => {
    const p = clientProgress(sample());
    expect(p.done).toBe(3);
    expect(p.applicable).toBe(23);
    expect(p.pct).toBe(Math.round((3 / 23) * 100));
  });
});
describe("skippedItems", () => {
  it("lists skipped + na with labels", () => {
    const items = skippedItems(sample());
    expect(items.map((i) => i.id).sort()).toEqual(["dsc_competitive", "dsc_feasibility"]);
    expect(items.find((i) => i.id === "dsc_competitive")!.note).toBe("client provided");
  });
});
describe("resourceRows", () => {
  const clients = [
    normalizeClient({ name: "Topminnow", phase: "Define", status: "On Track", assignments: [{ name: "Calvin", role: "Lead", load: "lead" }] }),
    normalizeClient({ name: "Acme", phase: "Develop", status: "At Risk", assignments: [{ name: "Calvin", role: "Core", load: "core" }, { name: "Tyler", role: "Support", load: "light" }] }),
  ];
  it("aggregates and sums weight", () => {
    const calvin = resourceRows(clients).find((r) => r.name === "Calvin")!;
    expect(calvin.assignments).toHaveLength(2);
    expect(calvin.weight).toBe(5);
  });
  it("flags over capacity and sorts desc", () => {
    const heavy = resourceRows([
      normalizeClient({ name: "P1", assignments: [{ name: "Dana", role: "Lead", load: "lead" }] }),
      normalizeClient({ name: "P2", assignments: [{ name: "Dana", role: "Lead", load: "lead" }] }),
    ]);
    expect(heavy[0].name).toBe("Dana");
    expect(heavy[0].over).toBe(true); // 6 > CAPACITY(5)
    expect(CAPACITY).toBe(5);
  });
});
