"use client";
import { BRAND, PHASES, STATUS_META } from "@/lib/process";
import type { Status } from "@/lib/types";

export const inputCls =
  "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2";
export const inputStyle = { borderColor: "#D3D9E2", background: "#fff", color: BRAND.ink } as const;

export const Chip = ({
  children,
  tone = "navy",
}: {
  children: React.ReactNode;
  tone?: "navy" | "pink" | "blue";
}) => {
  const tones = {
    navy: { bg: "#E8EDF5", fg: BRAND.navy },
    pink: { bg: "#FBEBF0", fg: "#9B3A5A" },
    blue: { bg: "#E3EEF8", fg: BRAND.blue },
  };
  const t = tones[tone] || tones.navy;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mr-1.5 mb-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
};

export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block mb-3">
    <div
      className="text-[11px] uppercase tracking-widest mb-1 font-semibold"
      style={{ color: "#66707F" }}
    >
      {label}
    </div>
    {children}
  </label>
);

export const PhaseTracker = ({ phase }: { phase: string }) => {
  const idx = PHASES.indexOf(phase);
  return (
    <div className="flex items-end gap-0" aria-label={`Phase: ${phase}`}>
      {PHASES.map((p, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={p} className="flex flex-col items-center" style={{ width: 64 }}>
            <div className="w-full flex items-center" style={{ height: 18 }}>
              <div
                className="flex-1"
                style={{
                  height: 3,
                  background: i === 0 ? "transparent" : done || active ? BRAND.navy : "#D8DDE5",
                }}
              />
              <div
                className="rounded-full flex-shrink-0"
                style={{
                  width: active ? 14 : 9,
                  height: active ? 14 : 9,
                  background: active ? BRAND.red : done ? BRAND.navy : "#D8DDE5",
                  border: active ? `2px solid ${BRAND.navy}` : "none",
                  transition: "all 150ms",
                }}
              />
              <div
                className="flex-1"
                style={{
                  height: 3,
                  background: i === PHASES.length - 1 ? "transparent" : done ? BRAND.navy : "#D8DDE5",
                }}
              />
            </div>
            <div
              className="text-[10px] mt-1 tracking-wide"
              style={{
                color: active ? BRAND.navy : "#8A93A3",
                fontWeight: active ? 700 : 500,
              }}
            >
              {p}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const TimeBar = ({ start, end }: { start: string; end: string }) => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const pct = Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
  const weeksTotal = Math.round((e - s) / (7 * 864e5));
  const weeksLeft = Math.max(0, Math.round((e - now) / (7 * 864e5)));
  const fmt = (d: string | number) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[11px]" style={{ color: "#66707F" }}>
        <span>{fmt(start)}</span>
        <span>
          {weeksLeft} of {weeksTotal} wks left
        </span>
        <span>{fmt(end)}</span>
      </div>
      <div className="h-1.5 rounded-full mt-0.5" style={{ background: "#E4E8EE" }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: BRAND.lightBlue }}
        />
      </div>
    </div>
  );
};

export const StepIcon = ({ status }: { status: Status }) => {
  const m = STATUS_META[status] || STATUS_META.todo;
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: 20, height: 20, fontSize: 12, color: m.color, background: m.bg, fontWeight: 700 }}
      title={m.label}
    >
      {m.icon}
    </span>
  );
};
