import { describe, it, expect } from "vitest";
import { buildTools } from "./tools";

// These guards short-circuit before any DB access (snapshotClient/deleteClient/saveStep
// are never reached), so they're safe to exercise without a seeded test row.
const opts = { toolCallId: "test-call", messages: [] };

describe("buildTools guards", () => {
  it("setStep: skipped without a note returns an error, does not touch the DB", async () => {
    const tools = buildTools("t");
    const result = await tools.setStep.execute!(
      { clientId: "c1", stepId: "kickoff", status: "skipped" },
      opts
    );
    expect(result).toBe("error: skipped requires a note (the why)");
  });

  it("setStep: skipped with only whitespace note is still rejected", async () => {
    const tools = buildTools("t");
    const result = await tools.setStep.execute!(
      { clientId: "c1", stepId: "kickoff", status: "skipped", note: "   " },
      opts
    );
    expect(result).toBe("error: skipped requires a note (the why)");
  });

  it("deleteClient: unconfirmed delete is refused, does not touch the DB", async () => {
    const tools = buildTools("t");
    const result = await tools.deleteClient.execute!({ id: "c1", confirmed: false }, opts);
    expect(result).toBe("not confirmed: ask the user to confirm deletion first");
  });
});
