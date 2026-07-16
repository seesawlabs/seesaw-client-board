import { describe, it, expect } from "vitest";
import {
  PROCESS, ALL_STEPS, STATUS_META, loadWeight, formatMoney, contractLabel,
  defaultProcessForEntry, normalizeClient,
} from "./process";

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
