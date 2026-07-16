"use client";
import { PROCESS, STATUS_META, BRAND, phaseRollup } from "@/lib/process";
import { StepIcon } from "./ui";
import type { Client } from "@/lib/types";

export function ProcessSection({ client, onStep }: { client: Client; onStep: (stepId: string) => void }) {
  return (
    <div>
      {PROCESS.map((phase) => {
        const r = phaseRollup(client, phase.key);
        return (
          <div key={phase.key} className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: BRAND.navy }}>{phase.label}</span>
              <span className="text-[11px]" style={{ color: r.complete ? "#2F855A" : "#8A93A3" }}>
                {r.done}/{r.applicable}{r.skipped ? ` · ${r.skipped} skipped` : ""}{r.na ? ` · ${r.na} n/a` : ""}
              </span>
            </div>
            <div className="space-y-0.5">
              {phase.steps.map((s) => {
                const inst = client.process?.[s.id] || { status: "todo" as const, note: "", decisions: [] };
                const m = STATUS_META[inst.status] || STATUS_META.todo;
                const dim = inst.status === "skipped" || inst.status === "na";
                return (
                  <button key={s.id} onClick={() => onStep(s.id)}
                    className="w-full flex items-start gap-2 text-left px-2 py-1 rounded-md hover:bg-black/[0.03]" style={{ opacity: dim ? 0.6 : 1 }}>
                    <StepIcon status={inst.status} />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: BRAND.ink, textDecoration: inst.status === "skipped" ? "line-through" : "none" }}>
                        {s.label}{"megamine" in s && s.megamine ? " ✦" : ""}
                      </span>
                      {inst.note && <span className="block text-[11px]" style={{ color: "#8A93A3" }}>{m.label}: {inst.note}</span>}
                      {inst.decisions?.length > 0 && <span className="block text-[11px]" style={{ color: BRAND.blue }}>{inst.decisions.length} decision{inst.decisions.length > 1 ? "s" : ""} logged</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
