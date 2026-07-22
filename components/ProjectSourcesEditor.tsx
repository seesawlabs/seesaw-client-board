"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProjectSources } from "@/lib/actions";
import { BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Account, Client } from "@/lib/types";

// Per-PROJECT source overrides. A blank field is NOT missing — it inherits the
// client (account) shared source, shown inline so blank never reads as broken.
export function ProjectSourcesEditor({
  client,
  account,
  onSaved,
  onCancel,
}: {
  client: Client;
  account?: Account | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    driveFolderId: client.driveFolderId || "",
    slackInternal: client.slackInternal || "",
    slackExternal: client.slackExternal || "",
    githubRepo: client.githubRepo || "",
  });
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const set =
    <K extends keyof typeof f>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await setProjectSources(client.id, f);
      router.refresh();
      onSaved();
    } catch {
      setBusy(false);
    }
  };

  // what a blank field falls back to (the account's shared value)
  const inherited = (v: string) => (v ? `↳ inherits ${v}` : "↳ none set on client — nothing to inherit");
  const acc = account || null;

  return (
    <div className="mt-4 p-4 rounded-lg border" style={{ background: "#F8FAFC", borderColor: "#D6DEE8" }}>
      <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-1" style={{ color: "#8A93A3" }}>
        Project sources — {client.name}
      </div>
      <p className="text-[11.5px] mb-3" style={{ color: "#8A93A3" }}>
        A blank field <b>inherits {acc?.name || "the client"}&apos;s shared source</b> (shown under each box) — that&apos;s expected, not missing. Only fill a box if this project uses a <i>different</i> Drive folder or Slack channel.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4 gap-y-1">
        <div>
          <Field label="Drive folder ID (standups/docs)">
            <input className={inputCls} style={inputStyle} value={f.driveFolderId} onChange={set("driveFolderId")} placeholder="(inherit)" />
          </Field>
          {!f.driveFolderId && <div className="text-[11px] mt-0.5 mb-1" style={{ color: "#8A93A3" }}>{inherited(acc?.driveFolderId || "")}</div>}
        </div>
        <div>
          <Field label="Slack — internal channel ID">
            <input className={inputCls} style={inputStyle} value={f.slackInternal} onChange={set("slackInternal")} placeholder="(inherit)" />
          </Field>
          {!f.slackInternal && <div className="text-[11px] mt-0.5 mb-1" style={{ color: "#8A93A3" }}>{inherited(acc?.slackInternal || "")}</div>}
        </div>
        <div>
          <Field label="Slack — external channel ID">
            <input className={inputCls} style={inputStyle} value={f.slackExternal} onChange={set("slackExternal")} placeholder="(inherit)" />
          </Field>
          {!f.slackExternal && <div className="text-[11px] mt-0.5 mb-1" style={{ color: "#8A93A3" }}>{inherited(acc?.slackExternal || "")}</div>}
        </div>
      </div>
      <div className="mt-1">
        <Field label="GitHub repo (owner/repo)">
          <input className={inputCls} style={inputStyle} value={f.githubRepo} onChange={set("githubRepo")} placeholder="seesawlabs/topminnow-etl" />
        </Field>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy, opacity: busy ? 0.6 : 1 }}>
          Save this project&apos;s sources
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
