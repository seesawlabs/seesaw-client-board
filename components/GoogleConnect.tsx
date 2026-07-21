"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogleAction, ingestStandupsAction, ingestSlackAction, ingestDocsAction } from "@/lib/actions";
import { BRAND } from "@/lib/process";

const GOOD = "#2F7A55";
const FAINT = "#A7A399";
const LINE = "#E6E1D7";

type Slack = { configured: boolean; accountsWired: number };

// One compact "source" pill: status dot + label + a subtle inline Sync action.
function Pill({
  live, label, sub, actionLabel, busy, disabled, onSync, title, children,
}: {
  live: boolean; label: string; sub?: string; actionLabel: string;
  busy: boolean; disabled?: boolean; onSync: () => void; title?: string; children?: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border pl-2.5 pr-1 py-1"
      style={{ borderColor: LINE, background: "#fff" }}
      title={title}
    >
      <span style={{ color: live ? GOOD : "#C6C2B8", fontSize: 9 }}>●</span>
      <span className="font-semibold" style={{ color: live ? BRAND.navy : FAINT }}>{label}</span>
      {sub && <span style={{ color: FAINT }}>{sub}</span>}
      {live && (
        <button
          disabled={busy || disabled}
          onClick={onSync}
          className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
          style={{ background: busy || disabled ? "#EDEAE3" : "#EAF1F8", color: busy || disabled ? "#B3AFA6" : BRAND.blue }}
        >
          {busy ? "Syncing…" : actionLabel}
        </button>
      )}
      {children}
    </span>
  );
}

export function GoogleConnect({
  configured, connected, email, slack = { configured: false, accountsWired: 0 },
}: { configured: boolean; connected: boolean; email: string; slack?: Slack }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [dbusy, setDbusy] = useState(false);
  const [sbusy, setSbusy] = useState(false);
  const [msg, setMsg] = useState("");

  const syncGoogle = async () => {
    setBusy(true); setMsg("");
    const r = await ingestStandupsAction();
    setMsg(r.message); setBusy(false); router.refresh();
  };
  const syncDocs = async () => {
    setDbusy(true); setMsg("");
    const r = await ingestDocsAction();
    setMsg(r.message); setDbusy(false); router.refresh();
  };
  const syncSlack = async () => {
    setSbusy(true); setMsg("");
    const r = await ingestSlackAction();
    setMsg(r.message); setSbusy(false); router.refresh();
  };

  return (
    <div className="flex items-center gap-2.5 mb-6 text-[12.5px] flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold mr-0.5" style={{ color: FAINT }}>Sources</span>

      {!configured ? (
        <span className="rounded-full border px-3 py-1" style={{ borderColor: LINE, color: FAINT }}>Google · setup pending</span>
      ) : connected ? (
        <Pill live label="Google" actionLabel="Sync standups" busy={busy} onSync={syncGoogle} title={email ? `Connected as ${email}` : undefined}>
          <button
            disabled={dbusy}
            onClick={syncDocs}
            className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold"
            style={{ background: dbusy ? "#EDEAE3" : "#EAF1F8", color: dbusy ? "#B3AFA6" : BRAND.blue }}
            title="Read the project spec/scope docs from the client Drive folder"
          >
            {dbusy ? "Reading…" : "Sync docs"}
          </button>
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); await disconnectGoogleAction(); router.refresh(); }}
            className="px-1.5 text-[13px]"
            style={{ color: "#C6C2B8" }}
            title="Disconnect Google"
          >
            ✕
          </button>
        </Pill>
      ) : (
        <a href="/api/google/connect" className="inline-flex items-center rounded-full px-3 py-1.5 text-white font-semibold" style={{ background: BRAND.navy }}>
          Connect Google
        </a>
      )}

      {!slack.configured ? (
        <span className="rounded-full border px-3 py-1" style={{ borderColor: LINE, color: FAINT }}>Slack · setup pending</span>
      ) : (
        <Pill
          live
          label="Slack"
          sub={`${slack.accountsWired} client${slack.accountsWired === 1 ? "" : "s"}`}
          actionLabel="Sync Slack"
          busy={sbusy}
          disabled={slack.accountsWired === 0}
          onSync={syncSlack}
          title={slack.accountsWired === 0 ? "Set a client's channel IDs first (Sources on a client header)" : undefined}
        />
      )}

      {msg && <span className="ml-0.5" style={{ color: FAINT }}>{msg}</span>}
    </div>
  );
}
