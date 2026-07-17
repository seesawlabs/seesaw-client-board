import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from "ai";
import { getBoard } from "@/lib/actions";
import { buildTools } from "@/lib/assistant/tools";
import { buildAssistantContext } from "@/lib/assistant/context";
import { appendMessage } from "@/lib/assistant/messages";

// Streaming tool-calling agent. Reads the board, exposes the whitelisted
// mutation tools (see lib/assistant/tools.ts) scoped to this turn, and lets
// the model loop over tool calls (capped by stopWhen) before replying.
export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, turnId }: { messages: UIMessage[]; turnId: string } = await req.json();
  const board = await getBoard();
  const system = buildAssistantContext(board);

  const last = messages[messages.length - 1];
  const lastText = last?.role === "user" ? extractText(last) : "";
  if (lastText.trim()) await appendMessage({ turnId, role: "user", content: lastText });

  const result = streamText({
    model: "anthropic/claude-sonnet-5", // Vercel AI Gateway; confirmed via `curl https://ai-gateway.vercel.sh/v1/models`
    system,
    messages: await convertToModelMessages(messages),
    tools: buildTools(turnId),
    stopWhen: stepCountIs(12),
    onFinish: async ({ text }) => {
      if (text?.trim()) await appendMessage({ turnId, role: "assistant", content: text });
    },
  });

  return result.toUIMessageStreamResponse();
}

function extractText(m: UIMessage): string {
  return (m.parts ?? [])
    .filter((p): p is Extract<UIMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text)
    .join("\n");
}
