import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { activity, clients, opportunities } from "@/lib/db/schema";
import type { Activity } from "@/lib/types";

type UndoRef = { entity: "client" | "opportunity"; entityId: string | null; beforeImage: unknown | null };
export type UndoOp =
  | { op: "delete"; entity: "client" | "opportunity"; id: string }
  | { op: "restore"; entity: "client" | "opportunity"; row: any };

/** Pure: decide how to reverse an activity from its before-image. */
export function undoPlan(a: UndoRef): UndoOp {
  if (a.beforeImage == null) return { op: "delete", entity: a.entity, id: a.entityId! };
  return { op: "restore", entity: a.entity, row: a.beforeImage };
}

export async function snapshotClient(id: string) {
  const [row] = await db.select().from(clients).where(eq(clients.id, id));
  return row ?? null;
}
export async function snapshotOpportunity(id: string) {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  return row ?? null;
}

export async function recordActivity(input: Omit<Activity, "id" | "createdAt" | "undone">) {
  await db.insert(activity).values({
    turnId: input.turnId, actor: input.actor, tool: input.tool, summary: input.summary,
    entity: input.entity, entityId: input.entityId, beforeImage: input.beforeImage as any,
  });
}

async function applyUndo(op: UndoOp) {
  const table = op.entity === "client" ? clients : opportunities;
  if (op.op === "delete") { await db.delete(table).where(eq(table.id, op.id)); return; }
  // restore: delete-then-insert the exact prior row (idempotent regardless of exists)
  await db.delete(table).where(eq(table.id, op.row.id));
  await db.insert(table).values(op.row);
}

export async function undoActivity(id: string) {
  const [a] = await db.select().from(activity).where(eq(activity.id, id));
  if (!a || a.undone) return;
  await applyUndo(undoPlan({ entity: a.entity as any, entityId: a.entityId, beforeImage: a.beforeImage }));
  await db.update(activity).set({ undone: true }).where(eq(activity.id, id));
  await recordActivity({
    turnId: a.turnId, actor: "user", tool: "undo", summary: `Undid: ${a.summary}`,
    entity: a.entity as any, entityId: a.entityId, beforeImage: null,
  });
}

export async function undoTurn(turnId: string) {
  const rows = await db.select().from(activity).where(eq(activity.turnId, turnId)).orderBy(desc(activity.createdAt));
  for (const a of rows) if (!a.undone && a.tool !== "undo") await undoActivity(a.id);
}

export async function listActivity(limit = 50): Promise<Activity[]> {
  const rows = await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(limit);
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt ? r.createdAt.getTime() : 0, turnId: r.turnId,
    actor: r.actor as any, tool: r.tool, summary: r.summary, entity: r.entity as any,
    entityId: r.entityId, beforeImage: r.beforeImage, undone: r.undone,
  }));
}
