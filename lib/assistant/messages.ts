import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";

/**
 * Message persistence for the assistant thread. `appendMessage` writes one
 * turn (user or assistant); `loadThread` returns the most recent messages in
 * chronological order for rendering/replay.
 */
export async function appendMessage(m: {
  turnId: string;
  role: "user" | "assistant";
  content: string;
}) {
  await db.insert(messages).values(m);
}

export async function loadThread(limit = 100): Promise<ChatMessage[]> {
  const rows = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role as ChatMessage["role"],
    content: r.content,
    turnId: r.turnId,
    createdAt: r.createdAt ? r.createdAt.getTime() : 0,
  }));
}
