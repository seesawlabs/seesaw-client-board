"use client";
import { useState } from "react";
import { PROCESS, STATUS_META, BRAND, phaseRollup } from "@/lib/process";
import type { Client } from "@/lib/types";

// semantic + warm-neutral tokens (kept separate from the brand accent)
const GOOD = "#2F7A55";
const CRIT = "#C0392B";
const FAINT = "#A7A399";
const MUTED = "#7C7A73";
const LINE = "#E6E1D7";
const LINE2 = "#EFEBE2";

const isBlocked = (status: string, note: string) => status === "doing" && /block/i.test(note || "");

export function ProcessSection({ client, onStep }: { client: Client; onStep: (stepId: string) => void }) {
  const rollups = PROCESS.map((p) => ({ phase: p, r: phaseRollup(client, p.key) }));
  const firstIncomplete = rollups.findIndex((x) => !x.r.complete);
  const curIdx = firstIncomplete === -1 ? PROCESS.length : firstIncomplete;
  const [open, setOpen] = useState<Record<string, boolean>>(() => ({ [PROCESS[curIdx]?.key ?? ""]: true }));
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // "Now" — every step currently in progress, surfaced to the top
  const now = PROCESS.flatMap((p) =>
    p.steps
      .filter((s) => client.process?.[s.id]?.status === "doing")
      .map((s) => {
        const inst = client.process[s.id];
        return { id: s.id, label: s.label, phaseLabel: p.label, note: inst.note, decisions: inst.decisions, blocked: isBlocked("doing", inst.note) };
      }),
  );

  return (
    <div>
      {/* ── phase spine ── */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {rollups.map(({ phase, r }, i) => {
          const complete = r.complete;
          const cur = i === curIdx;
          const frac = r.applicable > 0 ? r.done / r.applicable : 1;
          return (
            <div key={phase.key}>
              <div className="rounded-full overflow-hidden" style={{ height: 5, background: LINE2 }}>
                <div className="h-full rounded-full" style={{ width: `${frac * 100}%`, background: complete ? GOOD : cur ? BRAND.blue : LINE2 }} />
              </div>
              <div className="flex items-baseline justify-between mt-1.5">
                <span className="text-[10px] uppercase tracking-[0.14em] font-bold" style={{ color: complete ? GOOD : cur ? BRAND.navy : FAINT }}>{phase.label}</span>
                <span className="text-[10px] font-semibold" style={{ color: FAINT }}>{r.done}/{r.applicable}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Now band ── */}
      {now.length > 0 && (
        <div className="mb-5">
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: BRAND.red }}>Now — what&apos;s active</span>
          <div className="mt-2 space-y-2">
            {now.map((n) => (
              <button key={n.id} onClick={() => onStep(n.id)} className="w-full text-left flex items-start gap-3 rounded-lg p-3 border hover:brightness-[0.99]"
                style={{ borderColor: LINE, background: "#fff", borderLeft: `3px solid ${n.blocked ? BRAND.red : BRAND.blue}` }}>
                <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 22, height: 22, fontSize: 12, fontWeight: 800, background: n.blocked ? "#FBE7E4" : "#E7EFF8", color: n.blocked ? BRAND.red : BRAND.blue }}>◐</span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm font-semibold" style={{ color: BRAND.navy }}>{n.label}</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold ml-2" style={{ color: FAINT }}>{n.phaseLabel}</span>
                  {n.note && <span className="block text-[13px] mt-1" style={{ color: n.blocked ? CRIT : MUTED }}>{n.blocked ? "⚑ " : ""}{n.note}</span>}
                  {n.decisions?.length > 0 && <span className="block text-[12px] mt-1" style={{ color: BRAND.blue }}>◆ {n.decisions.length} decision{n.decisions.length > 1 ? "s" : ""} logged</span>}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── phase accordions ── */}
      <div>
        {rollups.map(({ phase, r }, i) => {
          const complete = r.complete;
          const cur = i === curIdx;
          const isOpen = !!open[phase.key];
          const state = complete ? "Complete" : cur ? "Current" : "Not started";
          const stateColor = complete ? GOOD : cur ? BRAND.blue : FAINT;
          return (
            <div key={phase.key} style={{ borderTop: i === 0 ? "none" : `1px solid ${LINE2}` }}>
              <button onClick={() => toggle(phase.key)} className="w-full flex items-center gap-3 py-3 text-left">
                <span className="text-[10px] w-3 flex-shrink-0" style={{ color: FAINT, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }}>▶</span>
                <span className="text-[11px] uppercase tracking-[0.16em] font-bold" style={{ color: complete ? GOOD : cur ? BRAND.navy : FAINT }}>{phase.label}</span>
                <span className="text-[12px] font-semibold" style={{ color: MUTED }}>{r.done}/{r.applicable}{r.skipped ? ` · ${r.skipped} skipped` : ""}{r.na ? ` · ${r.na} n/a` : ""}</span>
                <span className="ml-auto text-[10px] uppercase tracking-wider font-bold" style={{ color: stateColor }}>{state}</span>
              </button>
              {isOpen && (
                <div className="pb-3 pl-7 space-y-0.5">
                  {phase.steps.map((s) => {
                    const inst = client.process?.[s.id] || { status: "todo" as const, note: "", decisions: [] };
                    const m = STATUS_META[inst.status] || STATUS_META.todo;
                    const isDone = inst.status === "done" || inst.status === "validated";
                    const isSkip = inst.status === "skipped" || inst.status === "na";
                    const blocked = isBlocked(inst.status, inst.note);
                    const todo = inst.status === "todo";
                    return (
                      <button key={s.id} onClick={() => onStep(s.id)} className="w-full flex items-start gap-3 text-left px-2 py-1.5 rounded-md hover:bg-black/[0.03]">
                        <span className="inline-flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                          style={{ width: 18, height: 18, fontSize: 10, fontWeight: 800, background: todo ? "#fff" : m.bg, color: todo ? "transparent" : m.color, border: todo || isSkip ? `1.5px solid ${LINE}` : "none" }}>
                          {todo ? "" : m.icon}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="text-sm" style={{ color: isSkip ? FAINT : isDone ? MUTED : BRAND.ink, textDecoration: inst.status === "skipped" ? "line-through" : "none" }}>
                            {s.label}{"megamine" in s && s.megamine ? <span style={{ color: BRAND.pink, fontWeight: 700 }}> ✦</span> : null}
                          </span>
                          {inst.note && <span className="block text-[12.5px] mt-0.5" style={{ color: blocked ? CRIT : MUTED }}>{blocked ? "⚑ " : `${m.label}: `}{inst.note}</span>}
                          {inst.decisions?.length > 0 && <span className="block text-[12px] mt-0.5" style={{ color: BRAND.blue }}>◆ {inst.decisions.length} decision{inst.decisions.length > 1 ? "s" : ""} logged</span>}
                        </span>
                        {(inst.status === "doing" || inst.status === "validated" || isSkip) && (
                          <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded self-center flex-shrink-0" style={{ color: m.color, background: m.bg }}>{m.label}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
