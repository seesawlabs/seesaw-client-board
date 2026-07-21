"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogleAction, ingestStandupsAction, ingestSlackAction } from "@/lib/actions";
import { BRAND } from "@/lib/process";

const GOOD = "#2F7A55";
const FAINT = "#A7A399";

type Slack = { configured: boolean; accountsWired: number };

export function GoogleConnect({
  configured, connected, email, slack = { configured: false, accountsWired: 0 },
}: { configured: boolean; connected: boolean; email: string; slack?: Slack }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sbusy, setSbusy] = useState(false);
  const [smsg, setSmsg] = useState("");

  return (
    <div className="flex items-center gap-3 mb-6 text-[12.5px] flex-wrap">
      <span className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: FAINT }}>Sources</span>
      {!configured ? (
        <span style={{ color: FAINT }}>Google · setup pending</span>
      ) : connected ? (
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span style={{ color: GOOD, fontWeight: 700 }}>● Google connected</span>
          {email && <span style={{ color: FAINT }}>as {email}</span>}
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true); setMsg("Reading standups…");
              const r = await ingestStandupsAction();
              setMsg(r.message); setBusy(false); router.refresh();
            }}
            className="px-2.5 py-1 rounded-md text-white font-semibold"
            style={{ background: busy ? "#8A93A3" : BRAND.blue }}
          >
            {busy ? "Ingesting…" : "Ingest standups"}
          </button>
          {msg && <span style={{ color: FAINT }}>{msg}</span>}
          <button
            disabled={busy}
            onClick={async () => { setBusy(true); await disconnectGoogleAction(); router.refresh(); }}
            className="underline"
            style={{ color: FAINT }}
          >
            Disconnect
          </button>
        </span>
      ) : (
        <a href="/api/google/connect" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white font-semibold" style={{ background: BRAND.navy }}>
          Connect Google
        </a>
      )}

      <span style={{ color: "#E6E1D7" }}>·</span>

      {!slack.configured ? (
        <span style={{ color: FAINT }}>Slack · setup pending</span>
      ) : (
        <span className="inline-flex items-center gap-2 flex-wrap">
          <span style={{ color: GOOD, fontWeight: 700 }}>● Slack connected</span>
          <span style={{ color: FAINT }}>{slack.accountsWired} client{slack.accountsWired === 1 ? "" : "s"} wired</span>
          <button
            disabled={sbusy || slack.accountsWired === 0}
            onClick={async () => {
              setSbusy(true); setSmsg("Reading Slack…");
              const r = await ingestSlackAction();
              setSmsg(r.message); setSbusy(false); router.refresh();
            }}
            className="px-2.5 py-1 rounded-md text-white font-semibold"
            style={{ background: sbusy || slack.accountsWired === 0 ? "#8A93A3" : BRAND.blue }}
            title={slack.accountsWired === 0 ? "Set a client's channel IDs first" : "Read new messages from client channels"}
          >
            {sbusy ? "Reading…" : "Ingest Slack"}
          </button>
          {smsg && <span style={{ color: FAINT }}>{smsg}</span>}
        </span>
      )}
    </div>
  );
}
