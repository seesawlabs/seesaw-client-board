"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { setProjectSources } from "@/lib/actions";
import { BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Client } from "@/lib/types";

// Per-PROJECT source overrides. Blank fields inherit the client's shared sources.
export function ProjectSourcesEditor({
  client,
  onSaved,
  onCancel,
}: {
  client: Client;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    driveFolderId: client.driveFolderId || "",
    slackInternal: client.slackInternal || "",
    slackExternal: client.slackExternal || "",
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

  return (
    <div className="mt-4 p-4 rounded-lg border" style={{ background: "#F8FAFC", borderColor: "#D6DEE8" }}>
      <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-1" style={{ color: "#8A93A3" }}>
        Project sources — {client.name}
      </div>
      <p className="text-[11.5px] mb-3" style={{ color: "#8A93A3" }}>
        Only set these if this project has its <i>own</i> Drive folder or Slack channels. Leave blank to inherit the client&apos;s shared sources.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        <Field label="Drive folder ID (standups/docs)">
          <input className={inputCls} style={inputStyle} value={f.driveFolderId} onChange={set("driveFolderId")} placeholder="inherit" />
        </Field>
        <Field label="Slack — internal channel ID">
          <input className={inputCls} style={inputStyle} value={f.slackInternal} onChange={set("slackInternal")} placeholder="C0123ABCD" />
        </Field>
        <Field label="Slack — external channel ID">
          <input className={inputCls} style={inputStyle} value={f.slackExternal} onChange={set("slackExternal")} placeholder="C0456WXYZ" />
        </Field>
      </div>
      <div className="flex items-center gap-3 mt-1">
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy, opacity: busy ? 0.6 : 1 }}>
          Save sources
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
