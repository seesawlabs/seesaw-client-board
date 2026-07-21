"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectGoogleAction, ingestStandupsAction } from "@/lib/actions";
import { BRAND } from "@/lib/process";

const GOOD = "#2F7A55";
const FAINT = "#A7A399";

export function GoogleConnect({ configured, connected, email }: { configured: boolean; connected: boolean; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

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
    </div>
  );
}
