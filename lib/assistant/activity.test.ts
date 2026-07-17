import { describe, it, expect } from "vitest";
import { undoPlan } from "./activity";

describe("undoPlan", () => {
  it("create (no beforeImage) → delete the entity", () => {
    const p = undoPlan({ entity: "client", entityId: "c1", beforeImage: null });
    expect(p).toEqual({ op: "delete", entity: "client", id: "c1" });
  });
  it("update (has beforeImage) → restore the prior row", () => {
    const before = { id: "c1", name: "Old" };
    const p = undoPlan({ entity: "client", entityId: "c1", beforeImage: before });
    expect(p).toEqual({ op: "restore", entity: "client", row: before });
  });
  it("delete (beforeImage is the removed row, entityId null) → reinsert", () => {
    const before = { id: "c9", name: "Gone" };
    const p = undoPlan({ entity: "client", entityId: null, beforeImage: before });
    expect(p).toEqual({ op: "restore", entity: "client", row: before });
  });
});
