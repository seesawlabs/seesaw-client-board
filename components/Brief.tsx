"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/process";
import { synthesizeBriefsAction } from "@/lib/actions";
import { useMounted } from "./ui";
import type { Account, Client, Activity } from "@/lib/types";

const FAINT = "#A7A399";
const MUTED = "#7C7A73";
const LINE = "#E6E1D7";
const AMBER = "#B7791F";

// Relative label + urgency for a YYYY-MM-DD deadline, computed against today.
function relDeadline(iso: string, now: Date): { label: string; urgency: "over" | "soon" | "later" } {
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `${-days}d overdue`, urgency: "over" };
  if (days === 0) return { label: "today", urgency: "over" };
  if (days === 1) return { label: "tomorrow", urgency: "soon" };
  if (days <= 6) return { label: due.toLocaleDateString(undefined, { weekday: "long" }), urgency: "soon" };
  return { label: due.toLocaleDateString(undefined, { month: "short", day: "numeric" }), urgency: "later" };
}
const urgencyColor = (u: "over" | "soon" | "later") => (u === "over" ? BRAND.red : u === "soon" ? AMBER : MUTED);

export function Brief({ accounts, clients }: { accounts: Account[]; clients: Client[]; activity?: Activity[] }) {
  const mounted = useMounted();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const acctName = new Map(accounts.map((a) => [a.id, a.name]));
  const nameOf = (c: Client) => (c.accountId && acctName.has(c.accountId) ? `${acctName.get(c.accountId)} · ${c.name}` : c.name);

  const dated = clients.filter((c) => c.briefDeadline).sort((a, b) => a.briefDeadline.localeCompare(b.briefDeadline));
  const dateStr = mounted ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "";
  const anySynth = clients.some((c) => c.briefAt);
  const now = mounted ? new Date() : null;

  const regenerate = async () => {
    setBusy(true); setMsg("");
    const r = await synthesizeBriefsAction();
    setMsg(r.message); setBusy(false); router.refresh();
  };

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] uppercase tracking-[0.24em] font-bold" style={{ color: BRAND.red }} suppressHydrationWarning>
          {dateStr ? `${dateStr} · Morning brief` : "Morning brief"}
        </div>
        <button
          onClick={regenerate}
          disabled={busy}
          className="text-[11px] uppercase tracking-[0.14em] font-bold rounded-full px-2.5 py-1"
          style={{ color: busy ? "#B3AFA6" : BRAND.blue, background: "#EAF1F8" }}
          title="Re-synthesize each project's brief from the current board"
        >
          {busy ? "Synthesizing…" : "↻ Regenerate"}
        </button>
      </div>

      <h1 className="mt-2" style={{ fontFamily: "'Bricolage Grotesque', 'Archivo', sans-serif", fontWeight: 400, fontSize: 30, lineHeight: 1.12, color: BRAND.navy, letterSpacing: "-0.015em" }}>
        Good morning.
      </h1>
      <p className="mt-2 text-[15px]" style={{ color: MUTED, maxWidth: "62ch" }}>
        {clients.length === 0
          ? "No active engagements yet — add a project to start the board."
          : dated.length > 0
            ? <>
                <b style={{ color: BRAND.navy, fontWeight: 700 }}>{dated.length} {dated.length === 1 ? "deadline" : "deadlines"} on the clock</b> — the rest is trajectory; scan the projects below.
              </>
            : <>All {clients.length} {clients.length === 1 ? "project is" : "projects are"} moving — nothing on the calendar this week. Scan the projects below.</>}
        {!anySynth && <span style={{ color: FAINT }}> Hit ↻ Regenerate (or wait for the nightly run) to synthesize each project&apos;s brief.</span>}
      </p>
      {msg && <p className="mt-1 text-[12px]" style={{ color: FAINT }}>{msg}</p>}

      {/* ── due soon: objective, dated commitments only ── */}
      {dated.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-2.5" style={{ color: BRAND.red }}>⏱ Due soon</div>
          <div className="space-y-2">
            {dated.map((c) => {
              const rel = now ? relDeadline(c.briefDeadline, now) : null;
              return (
                <a key={c.id} href={`#client-${c.id}`} className="flex items-center gap-3 rounded-xl p-3 border bg-white hover:brightness-[0.99]"
                  style={{ borderColor: LINE, boxShadow: "0 1px 2px rgba(21,34,56,.05)" }}>
                  <span
                    className="flex-shrink-0 rounded-md px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-center"
                    style={{ minWidth: 92, background: rel ? (rel.urgency === "over" ? "#FBE3E3" : rel.urgency === "soon" ? "#FBF0DC" : "#EEF1F6") : "#EEF1F6", color: rel ? urgencyColor(rel.urgency) : MUTED }}
                    suppressHydrationWarning
                  >
                    {rel ? rel.label : c.briefDeadline}
                  </span>
                  <span className="min-w-0">
                    <span className="text-[13.5px] font-semibold" style={{ color: BRAND.navy }}>{nameOf(c)}</span>
                    {c.briefDeadlineLabel && <span className="text-[13px]" style={{ color: MUTED }}> — {c.briefDeadlineLabel}</span>}
                  </span>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
