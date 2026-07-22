"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND, STATUS } from "@/lib/process";
import { synthesizeBriefsAction } from "@/lib/actions";
import { useMounted } from "./ui";
import type { Account, Client, Activity } from "@/lib/types";

const FAINT = "#A7A399";
const MUTED = "#7C7A73";
const LINE = "#E6E1D7";

// severity of a project for ordering the exceptions, worst first
function sev(c: Client): number {
  if (c.status === "Blocked") return 0;
  if (c.status === "At Risk") return 1;
  return 2;
}

export function Brief({ accounts, clients, activity }: { accounts: Account[]; clients: Client[]; activity: Activity[] }) {
  const mounted = useMounted();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const acctName = new Map(accounts.map((a) => [a.id, a.name]));
  const nameOf = (c: Client) => (c.accountId && acctName.has(c.accountId) ? `${acctName.get(c.accountId)} · ${c.name}` : c.name);

  const attention = clients.filter((c) => c.briefAttention?.trim()).sort((a, b) => sev(a) - sev(b));
  const moving = clients.length - attention.length;
  const dateStr = mounted ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "";
  const anySynth = clients.some((c) => c.briefAt);

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
          : attention.length > 0
            ? <>
                <b style={{ color: BRAND.navy, fontWeight: 700 }}>{attention.length} {attention.length === 1 ? "project needs" : "projects need"} a call today</b>
                {moving > 0 ? <>; the other {moving} {moving === 1 ? "is" : "are"} moving.</> : "."}
              </>
            : <>All {clients.length} {clients.length === 1 ? "project is" : "projects are"} moving — nothing needs you this morning.</>}
        {!anySynth && <span style={{ color: FAINT }}> Hit ↻ Regenerate (or wait for the nightly run) to synthesize each project&apos;s brief.</span>}
      </p>
      {msg && <p className="mt-1 text-[12px]" style={{ color: FAINT }}>{msg}</p>}

      {/* ── needs you today: only the synthesized attention lines ── */}
      {attention.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-2.5" style={{ color: BRAND.red }}>⚠ Needs you today</div>
          <div className="space-y-2.5">
            {attention.map((c) => {
              const st = STATUS[c.status] || STATUS["On Track"];
              return (
                <a key={c.id} href={`#client-${c.id}`} className="block rounded-xl p-3.5 border bg-white hover:brightness-[0.99]"
                  style={{ borderColor: LINE, borderLeft: `3px solid ${st.color}`, boxShadow: "0 1px 2px rgba(21,34,56,.05)" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: st.color }}>{nameOf(c)}</span>
                  <p className="text-[14px] mt-0.5" style={{ color: BRAND.ink }}>{c.briefAttention}</p>
                </a>
              );
            })}
          </div>
        </div>
      )}

    </section>
  );
}
