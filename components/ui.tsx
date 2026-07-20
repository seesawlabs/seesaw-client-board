"use client";
import { useState, useEffect } from "react";
import { BRAND, PHASES, STATUS_META } from "@/lib/process";
import type { Status } from "@/lib/types";

// True only after the client has mounted. Use to gate any render that depends
// on the current time or the viewer's timezone/locale (Date.now(),
// toLocaleDateString, etc.) so the server and first client render match and
// hydration doesn't mismatch. See the hydration bug fixed in this file's history.
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

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
  const mounted = useMounted();
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
  // Date/locale + current-time values render only after mount to avoid a
  // server(UTC)/client(local) hydration mismatch.
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[11px]" style={{ color: "#66707F" }} suppressHydrationWarning>
        <span>{mounted ? fmt(start) : ""}</span>
        <span>{mounted ? `${weeksLeft} of ${weeksTotal} wks left` : ""}</span>
        <span>{mounted ? fmt(end) : ""}</span>
      </div>
      <div className="h-1.5 rounded-full mt-0.5" style={{ background: "#E4E8EE" }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: mounted ? `${pct}%` : "0%", background: BRAND.lightBlue }}
          suppressHydrationWarning
        />
      </div>
    </div>
  );
};

export const ListBlock = ({
  title,
  items,
  accent,
}: {
  title: string;
  items: string[] | undefined;
  accent: string;
}) =>
  items && items.length > 0 ? (
    <div className="mb-3">
      <div className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: accent }}>
        {title}
      </div>
      <ul className="text-sm space-y-1" style={{ color: BRAND.ink }}>
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: accent }}>—</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

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
