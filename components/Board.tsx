"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Board as BoardT } from "@/lib/types";
import { BRAND } from "@/lib/process";
import { TimelineOverview } from "@/components/TimelineOverview";
import { ClientCard } from "@/components/ClientCard";

export function Board({ initial }: { initial: BoardT }) {
  const router = useRouter();
  const [view, setView] = useState<"client" | "resource">("client");
  const [editingClient, setEditingClient] = useState<string | null>(null); // id | "new" | null
  const [stepEdit, setStepEdit] = useState<{ clientId: string; stepId: string } | null>(null);
  const { clients } = initial;

  const atRisk = clients.filter((c) => c.status === "At Risk" || c.status === "Blocked").length;
  const openAsks = clients.reduce((n, c) => n + (c.needs?.length || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: BRAND.paper, fontFamily: "'Archivo', system-ui, sans-serif", color: BRAND.ink }}>
      {/* header */}
      <header style={{ background: BRAND.navy }} className="px-6 md:px-10 py-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ color: BRAND.lightBlue }}>
              SeeSaw Labs
            </div>
            <h1 className="text-3xl md:text-4xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}>
              Standup board
            </h1>
          </div>
          <div className="flex items-center gap-5 text-sm" style={{ color: BRAND.lightBlue }}>
            <div>
              <span className="text-white font-semibold">{clients.length}</span> active
            </div>
            <div>
              <span className="font-semibold" style={{ color: atRisk ? BRAND.pink : "#fff" }}>
                {atRisk}
              </span>{" "}
              at risk
            </div>
            <div>
              <span className="text-white font-semibold">{openAsks}</span> open asks
            </div>
            <button
              onClick={() => router.refresh()}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border"
              style={{ borderColor: BRAND.lightBlue, color: "#fff" }}
              title="Pull the latest board from the database"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <h2 className="text-2xl mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
          Engagement calendar
        </h2>
        <TimelineOverview clients={clients} />

        <div className="flex items-baseline justify-between mb-4 mt-8">
          <h2 className="text-2xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
            Active engagements
          </h2>
          <button
            onClick={() => setEditingClient("new")}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white"
            style={{ background: BRAND.red }}
          >
            + Add client
          </button>
        </div>

        <div className="space-y-4 mb-12">
          {clients.length === 0 && (
            <div className="p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
              No active engagements yet. Add your first client to get the board going.
            </div>
          )}
          {clients.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={() => setEditingClient(c.id)} />
          ))}
        </div>
        {/* Opportunities section added in Task 11; ClientEditor wired in Task 9; ResourceView + toggle in Task 12 */}
      </main>
    </div>
  );
}
