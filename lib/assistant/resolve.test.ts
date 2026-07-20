import { describe, it, expect } from "vitest";
import { resolveClient } from "./resolve";
const clients = [{ id: "a", name: "Rivet Health" }, { id: "b", name: "Topminnow" }] as any;
describe("resolveClient", () => {
  it("exact (case-insensitive)", () => expect(resolveClient("rivet health", clients)).toEqual({ id: "a", confidence: "exact" }));
  it("partial word", () => expect(resolveClient("the rivet call", clients)).toEqual({ id: "a", confidence: "partial" }));
  it("no match → null", () => expect(resolveClient("acme", clients)).toBeNull());
  it("ambiguous multiple partials → null", () => {
    const two = [{ id: "a", name: "Rivet Health" }, { id: "c", name: "Rivet Labs" }] as any;
    expect(resolveClient("rivet", two)).toBeNull();
  });
});
