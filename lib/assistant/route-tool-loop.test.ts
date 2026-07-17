import { describe, it, expect } from "vitest";
import { streamText, stepCountIs, tool, simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { z } from "zod";

/**
 * Confirms the AI SDK v6 API surface the route (app/api/assistant/route.ts)
 * depends on: `streamText` + `tools` + `stopWhen: stepCountIs(n)` actually
 * drives a canned tool call through `execute` and resolves `toolCalls`.
 *
 * Uses a standalone `tool()` rather than `buildTools()` — buildTools'
 * execute functions call `getBoard`/`upsertClient`/etc, which need a live
 * Postgres connection (see lib/assistant/tools.test.ts: existing tests only
 * exercise the guard clauses that short-circuit before DB access for the
 * same reason). This test is scoped to the streaming tool-loop plumbing,
 * not the DB-touching tool bodies — that's covered by Task 9's live smoke.
 */
describe("AI SDK v6 streaming tool-call plumbing", () => {
  it("a canned tool-call chunk drives execute() and resolves toolCalls", async () => {
    let ran: unknown = null;

    const tools = {
      ping: tool({
        description: "test tool",
        inputSchema: z.object({ q: z.string() }),
        execute: async ({ q }) => {
          ran = q;
          return `pong:${q}`;
        },
      }),
    };

    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream({
          chunks: [
            { type: "stream-start", warnings: [] },
            { type: "tool-input-start", id: "call-1", toolName: "ping" },
            { type: "tool-input-delta", id: "call-1", delta: '{"q":"hi"}' },
            { type: "tool-input-end", id: "call-1" },
            { type: "tool-call", toolCallId: "call-1", toolName: "ping", input: '{"q":"hi"}' },
            {
              type: "finish",
              finishReason: { unified: "tool-calls", raw: undefined },
              usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
                outputTokens: { total: 5, text: 5, reasoning: undefined },
              },
            },
          ],
        }),
      }),
    });

    const result = streamText({
      model,
      tools,
      stopWhen: stepCountIs(1),
      prompt: "call ping with q=hi",
    });

    await result.consumeStream();
    const toolCalls = await result.toolCalls;

    expect(ran).toBe("hi");
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]).toMatchObject({ toolName: "ping", input: { q: "hi" } });
  });
});
