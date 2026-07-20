"use client";
import { BRAND, clientProgress } from "@/lib/process";
import { useMounted } from "./ui";
import type { Client, Activity } from "@/lib/types";

const GOOD = "#2F7A55";
const WARN = "#B7791F";
const FAINT = "#A7A399";
const MUTED = "#7C7A73";
const LINE = "#E6E1D7";
const CRIT = "#C0392B";

type Sev = "crit" | "warn" | "info";
const SEV_ORDER: Record<Sev, number> = { crit: 0, warn: 1, info: 2 };
const SEV_LABEL: Record<Sev, string> = { crit: "Blocked", warn: "At risk", info: "Heads up" };
const SEV_COLOR: Record<Sev, string> = { crit: BRAND.red, warn: WARN, info: BRAND.blue };
const SEV_STRIPE: Record<Sev, string> = { crit: BRAND.red, warn: WARN, info: BRAND.lightBlue };

// the note of the first in-progress step that reads as blocked, if any
function firstBlockedNote(c: Client): string | null {
  for (const inst of Object.values(c.process || {})) {
    if (inst.status === "doing" && /block/i.test(inst.note || "")) return inst.note;
  }
  return null;
}

function buildNeeds(clients: Client[]) {
  const items: { sev: Sev; who: string; what: string }[] = [];
  for (const c of clients) {
    const blocked = firstBlockedNote(c);
    if (c.status === "Blocked" || blocked) {
      items.push({ sev: "crit", who: c.name, what: blocked || c.needs?.[0] || c.risks?.[0] || "Blocked — needs a look" });
    } else if (c.status === "At Risk") {
      items.push({ sev: "warn", who: c.name, what: c.needs?.[0] || c.risks?.[0] || "At risk — needs a look" });
    } else if (c.needs?.length) {
      items.push({ sev: "info", who: c.name, what: c.needs[0] });
    }
  }
  return items.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]).slice(0, 5);
}

export function Brief({ clients, activity }: { clients: Client[]; activity: Activity[] }) {
  const mounted = useMounted();
  const needs = buildNeeds(clients);
  const recent = activity.filter((a) => a.tool !== "undo" && !a.undone).slice(0, 4);
  const attention = needs.filter((n) => n.sev === "crit" || n.sev === "warn").length;
  const onTrack = clients.length - attention;
  const dateStr = mounted ? new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : "";

  return (
    <section className="mb-8">
      <div className="text-[11px] uppercase tracking-[0.24em] font-bold" style={{ color: BRAND.red }} suppressHydrationWarning>
        {dateStr ? `${dateStr} · Morning brief` : "Morning brief"}
      </div>
      <h1 className="mt-2" style={{ fontFamily: "'Fraunces', serif", fontWeight: 400, fontSize: 30, lineHeight: 1.12, color: BRAND.navy, letterSpacing: "-0.015em" }}>
        Good morning.
      </h1>
      <p className="mt-3 text-[15px]" style={{ color: MUTED, maxWidth: "60ch" }}>
        {clients.length === 0
          ? "No active engagements yet — add a client to start the board."
          : attention > 0
            ? <>
                <b style={{ color: BRAND.navy, fontWeight: 700 }}>{attention} {attention === 1 ? "client needs" : "clients need"} your attention</b> today
                {onTrack > 0 ? <>; the other {onTrack} {onTrack === 1 ? "is" : "are"} moving.</> : "."}
              </>
            : <>All {clients.length} {clients.length === 1 ? "engagement is" : "engagements are"} on track — nothing on fire.</>}
        <span style={{ color: FAINT }}> Once your Slack + standups are wired in, this becomes a real chief-of-staff briefing.</span>
      </p>

      {needs.length > 0 && (
        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 15, color: BRAND.navy }}>Needs you today</h2>
            <span className="text-[12px]" style={{ color: FAINT }}>{needs.length} {needs.length === 1 ? "item" : "items"} · ranked by urgency</span>
          </div>
          <div className="space-y-2.5">
            {needs.map((n, i) => (
              <div key={i} className="grid items-start gap-3.5 rounded-xl p-3.5 border bg-white" style={{ gridTemplateColumns: "auto 1fr", borderColor: LINE, borderLeft: `3px solid ${SEV_STRIPE[n.sev]}`, boxShadow: "0 1px 2px rgba(21,34,56,.05)" }}>
                <span className="text-[11px] font-bold uppercase tracking-wider pt-0.5" style={{ color: SEV_COLOR[n.sev] }}>{SEV_LABEL[n.sev]}</span>
                <span className="text-[14px]" style={{ color: BRAND.ink }}>
                  <b style={{ color: BRAND.navy, fontWeight: 700 }}>{n.who}</b> — {n.what}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: FAINT }}>Recently · applied for you</div>
          <div className="space-y-1.5">
            {recent.map((a) => (
              <div key={a.id} className="flex gap-2.5 items-baseline text-[13.5px]" style={{ color: MUTED }}>
                <span style={{ color: GOOD, fontWeight: 700 }}>✓</span>
                <span><b style={{ color: BRAND.ink, fontWeight: 600 }}>{a.summary}</b></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
