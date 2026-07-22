"use client";
import { resourceRows, CAPACITY, LOAD, STATUS, BRAND } from "@/lib/process";
import type { Client } from "@/lib/types";

export function ResourceView({ clients }: { clients: Client[] }) {
  const rows = resourceRows(clients);
  if (rows.length === 0) {
    return (
      <div className="p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
        No one is assigned to an engagement yet.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {rows.map((r) => (
        <div key={r.name} className="rounded-lg border bg-white p-5" style={{ borderColor: r.over ? BRAND.red : "#E2E6ED" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-lg" style={{ fontFamily: "'Bricolage Grotesque', 'Archivo', sans-serif", fontWeight: 700, color: BRAND.navy }}>{r.name}</h3>
            <span className="text-xs font-semibold" style={{ color: r.over ? BRAND.red : "#66707F" }}>
              {r.over ? `⚠ Stacked · load ${r.weight}` : `Load ${r.weight}/${CAPACITY}`}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {r.assignments.map((a, i) => {
              const st = STATUS[a.status] || STATUS["On Track"];
              const dots = LOAD.find((l) => l.id === a.load)?.dots || "";
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: st.color }} />
                  <span className="font-semibold" style={{ color: BRAND.ink }}>{a.client}</span>
                  <span style={{ color: "#8A93A3" }}>{a.role ? `· ${a.role}` : ""} · {a.phase}</span>
                  <span className="ml-auto" style={{ color: BRAND.navy, letterSpacing: 1 }}>{dots}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
