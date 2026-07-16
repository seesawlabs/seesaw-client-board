"use client";
import { BRAND, STATUS } from "@/lib/process";
import type { Client } from "@/lib/types";

export function TimelineOverview({
  clients,
  onSelect,
}: {
  clients: Client[];
  onSelect?: (id: string) => void;
}) {
  const rows = clients.filter((c) => {
    const s = new Date(c.start).getTime();
    const e = new Date(c.end).getTime();
    return c.start && c.end && !isNaN(s) && !isNaN(e) && e > s;
  });
  if (rows.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-dashed text-center text-sm mb-10" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
        Add start and end dates to engagements to see them on the calendar.
      </div>
    );
  }

  // Range: pad to full months around earliest start / latest end
  const minStart = Math.min(...rows.map((c) => new Date(c.start).getTime()));
  const maxEnd = Math.max(...rows.map((c) => new Date(c.end).getTime()));
  const rangeStart = new Date(minStart);
  rangeStart.setDate(1);
  const rangeEnd = new Date(maxEnd);
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 1);
  const t0 = rangeStart.getTime();
  const t1 = rangeEnd.getTime();
  const span = t1 - t0;
  const pct = (t: number) => Math.min(100, Math.max(0, ((t - t0) / span) * 100));

  // Month ticks
  const months: Date[] = [];
  const cur = new Date(rangeStart);
  while (cur.getTime() < t1) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const now = Date.now();
  const showToday = now >= t0 && now <= t1;
  const LABEL_W = 130;

  return (
    <div className="rounded-lg border bg-white p-5 mb-10 overflow-x-auto" style={{ borderColor: "#E2E6ED" }}>
      <div style={{ minWidth: 560 }}>
        {/* month header */}
        <div className="flex">
          <div style={{ width: LABEL_W }} className="flex-shrink-0" />
          <div className="relative flex-1" style={{ height: 22 }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 text-[10px] uppercase tracking-wider font-semibold pl-1.5"
                style={{ left: `${pct(m.getTime())}%`, color: "#8A93A3", borderLeft: "1px solid #E4E8EE", height: "100%" }}
              >
                {m.toLocaleDateString(undefined, { month: "short" })}
                {m.getMonth() === 0 || i === 0 ? ` ’${String(m.getFullYear()).slice(2)}` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* rows */}
        <div className="relative">
          {/* month gridlines behind rows */}
          <div className="absolute inset-0 flex pointer-events-none">
            <div style={{ width: LABEL_W }} className="flex-shrink-0" />
            <div className="relative flex-1">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 bottom-0" style={{ left: `${pct(m.getTime())}%`, borderLeft: "1px solid #F0F2F6" }} />
              ))}
              {showToday && (
                <div className="absolute top-0 bottom-0" style={{ left: `${pct(now)}%`, borderLeft: `2px solid ${BRAND.red}` }}>
                  <div
                    className="absolute -top-0.5 text-[9px] font-bold uppercase tracking-wider px-1 rounded-sm"
                    style={{ background: BRAND.red, color: "#fff", transform: "translateX(-50%)" }}
                  >
                    Today
                  </div>
                </div>
              )}
            </div>
          </div>

          {rows.map((c) => {
            const s = new Date(c.start).getTime();
            const e = new Date(c.end).getTime();
            const st = STATUS[c.status] || STATUS["On Track"];
            const left = pct(s);
            const width = Math.max(1.5, pct(e) - left);
            const done = now > e;
            return (
              <div key={c.id} className="flex items-center relative" style={{ height: 34 }}>
                <div
                  className="flex-shrink-0 pr-3 text-sm font-semibold truncate text-right"
                  style={{ width: LABEL_W, color: BRAND.navy }}
                  title={c.name}
                >
                  {c.name}
                </div>
                <div className="relative flex-1 h-full">
                  <button
                    onClick={() => onSelect && onSelect(c.id)}
                    className="absolute rounded-md text-left focus:outline-none focus:ring-2"
                    title={`${c.name}: ${c.start} → ${c.end} (${c.status})`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 7,
                      height: 20,
                      background: done ? "#D8DDE5" : st.color,
                      opacity: done ? 0.9 : 1,
                    }}
                  >
                    <span className="text-[10px] font-semibold text-white pl-1.5 whitespace-nowrap overflow-hidden block" style={{ lineHeight: "20px" }}>
                      {c.phase}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t" style={{ borderColor: "#EDF0F4" }}>
          {Object.entries(STATUS).map(([name, s]) => (
            <div key={name} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#66707F" }}>
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#66707F" }}>
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#D8DDE5" }} />
            Completed
          </div>
        </div>
      </div>
    </div>
  );
}
