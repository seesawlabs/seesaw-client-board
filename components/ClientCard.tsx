"use client";
import { useState } from "react";
import { BRAND, STATUS, BILLING, OPP_TYPES, contractLabel, clientProgress, skippedItems } from "@/lib/process";
import type { Client } from "@/lib/types";
import { Chip, PhaseTracker, TimeBar, ListBlock, useMounted } from "@/components/ui";
import { ProcessSection } from "@/components/ProcessSection";

export function ClientCard({
  client: c,
  onEdit,
  onStep,
}: {
  client: Client;
  onEdit: () => void;
  onStep: (stepId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const st = STATUS[c.status] || STATUS["On Track"];
  const progress = clientProgress(c);
  const flagCount = (c.risks?.length || 0) + (c.needs?.length || 0) + (c.findings?.length || 0);

  return (
    <div
      id={`client-${c.id}`}
      className="rounded-lg overflow-hidden border bg-white"
      style={{ borderColor: "#E2E6ED", borderLeft: `5px solid ${st.color}` }}
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
                {c.name}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
                {c.status}
              </span>
            </div>
            {c.summary && (
              <p className="text-sm mt-1" style={{ color: "#4A5568" }}>
                {c.summary}
              </p>
            )}
            <div className="mt-2">
              {c.assignments.map((a, i) => (
                <Chip key={`${a.name}-${i}`}>
                  {a.name}
                  {a.role ? ` · ${a.role}` : ""}
                </Chip>
              ))}
            </div>
          </div>
          <div className="hidden md:block">
            <PhaseTracker phase={c.phase} />
          </div>
        </div>
        <div className="md:hidden mt-3 overflow-x-auto">
          <PhaseTracker phase={c.phase} />
        </div>
        <TimeBar start={c.start} end={c.end} />

        {/* deal-signal row */}
        <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
          <span
            className="px-2.5 py-0.5 rounded-full font-semibold"
            style={
              c.billing === "internal"
                ? { background: "#EDE9FE", color: "#6B46C1" }
                : { background: "#E2F2E9", color: "#2F855A" }
            }
          >
            {BILLING.find((b) => b.id === c.billing)?.label || c.billing}
          </span>
          <span className="font-semibold" style={{ color: BRAND.navy }}>
            {contractLabel(c)}
          </span>
          <span style={{ color: "#66707F" }}>
            {progress.pct}% ({progress.done}/{progress.applicable} steps)
          </span>
          {c.opportunity.types.map((t) => (
            <Chip key={t} tone="pink">
              {OPP_TYPES.find((o) => o.id === t)?.label || t}
            </Chip>
          ))}
          {c.buildUrl && (
            <a
              href={c.buildUrl}
              target="_blank"
              rel="noreferrer"
              className="font-semibold underline"
              style={{ color: BRAND.blue }}
            >
              See the build ↗
            </a>
          )}
        </div>

        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => setOpen(!open)} className="text-sm font-semibold" style={{ color: BRAND.blue }}>
            {open ? "Hide details" : `Details${flagCount > 0 ? ` (${(c.risks?.length || 0) + (c.needs?.length || 0)} flags)` : ""}`}
          </button>
          <button onClick={onEdit} className="text-sm font-medium" style={{ color: "#66707F" }}>
            Edit
          </button>
          <span className="ml-auto text-[11px]" style={{ color: "#8A93A3" }} suppressHydrationWarning>
            {mounted && c.updatedAt ? `Updated ${new Date(c.updatedAt).toLocaleDateString()}` : ""}
          </span>
        </div>

        {open && (
          <div className="mt-4 pt-4 border-t" style={{ borderColor: "#EDF0F4" }}>
            <div className="text-[11px] uppercase tracking-widest font-semibold mb-2" style={{ color: "#66707F" }}>
              5D Process
            </div>
            <ProcessSection client={c} onStep={onStep} />
            {(() => {
              const items = skippedItems(c);
              if (!items.length) return null;
              return (
                <div className="mt-3 p-3 rounded-md" style={{ background: "#FBF7F0", border: "1px solid #F0E6D6" }}>
                  <div className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: "#B7791F" }}>Deliberately skipped / not applicable</div>
                  <ul className="text-sm space-y-1" style={{ color: BRAND.ink }}>
                    {items.map((it) => (
                      <li key={it.id} className="flex gap-2">
                        <span style={{ color: "#B7791F" }}>{it.status === "skipped" ? "⊘" : "—"}</span>
                        <span><span className="font-semibold">{it.stepLabel}</span> <span style={{ color: "#8A93A3" }}>({it.phaseLabel})</span>{it.note ? ` — ${it.note}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-x-6">
              <ListBlock title="Risks" items={c.risks} accent={BRAND.red} />
              <ListBlock title="Needs / asks" items={c.needs} accent="#B7791F" />
              <ListBlock title="Key findings" items={c.findings} accent={BRAND.blue} />
              {c.links && c.links.length > 0 && (
                <div className="md:col-span-3 mt-1">
                  {c.links.map((l, i) => (
                    <a
                      key={i}
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mr-3 text-sm font-semibold underline"
                      style={{ color: BRAND.blue }}
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
