"use client";
import { useRouter } from "next/navigation";
import { undoActivityAction, undoTurnAction } from "@/lib/actions";
import { BRAND } from "@/lib/process";
import type { Activity } from "@/lib/types";

// Trust UI for auto-applied assistant changes: a chronological, per-turn feed
// with per-entry and per-turn undo. Compensating "undo" rows are filtered out
// of display (they're an implementation detail, not a user-facing action).
export function ActivityFeed({ activity }: { activity: Activity[] }) {
  const router = useRouter();
  const turns = groupByTurn(activity.filter((a) => a.tool !== "undo"));

  if (turns.length === 0) {
    return (
      <div className="text-sm" style={{ color: "#8A93A3" }}>
        No activity yet. Changes the assistant makes will show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {turns.map((t) => (
        <div key={t.turnId} className="rounded-md border p-3" style={{ borderColor: "#E2E6ED" }}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px]" style={{ color: "#8A93A3" }}>
              {new Date(t.at).toLocaleString()}
            </span>
            {t.items.some((i) => !i.undone) && (
              <button
                className="text-xs font-semibold"
                style={{ color: BRAND.red }}
                onClick={async () => {
                  await undoTurnAction(t.turnId);
                  router.refresh();
                }}
              >
                Undo all
              </button>
            )}
          </div>
          {t.items.map((a) => (
            <div key={a.id} className="flex justify-between items-start gap-2 text-sm">
              <span
                style={{
                  color: a.undone ? "#A0AAB8" : BRAND.ink,
                  textDecoration: a.undone ? "line-through" : "none",
                }}
              >
                ✓ {a.summary}
              </span>
              {!a.undone && (
                <button
                  className="text-xs"
                  style={{ color: "#66707F" }}
                  onClick={async () => {
                    await undoActivityAction(a.id);
                    router.refresh();
                  }}
                >
                  undo
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function groupByTurn(a: Activity[]) {
  const m = new Map<string, { turnId: string; at: number; items: Activity[] }>();
  for (const x of a) {
    if (!m.has(x.turnId)) m.set(x.turnId, { turnId: x.turnId, at: x.createdAt, items: [] });
    m.get(x.turnId)!.items.push(x);
  }
  return [...m.values()].sort((p, q) => q.at - p.at);
}
