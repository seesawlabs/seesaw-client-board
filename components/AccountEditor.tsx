"use client";
import { useState } from "react";
import { upsertAccount } from "@/lib/actions";
import { BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Account } from "@/lib/types";

// Edit an account (the CLIENT / company that groups projects): its Drive folder
// and the two Slack channels the morning brief reads from.
export function AccountEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial: Account;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: initial.name || "",
    driveFolderId: initial.driveFolderId || "",
    slackInternal: initial.slackInternal || "",
    slackExternal: initial.slackExternal || "",
  });
  const [busy, setBusy] = useState(false);

  const set =
    <K extends keyof typeof f>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setF({ ...f, [k]: e.target.value });

  const submit = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      await upsertAccount({
        id: initial.id,
        name: f.name.trim(),
        driveFolderId: f.driveFolderId.trim(),
        slackInternal: f.slackInternal.trim(),
        slackExternal: f.slackExternal.trim(),
      });
      onSaved();
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="p-5 rounded-lg border mb-3" style={{ background: "#fff", borderColor: BRAND.navy }}>
      <div className="text-[11px] uppercase tracking-[0.16em] font-bold mb-2" style={{ color: "#A7A399" }}>
        Client sources — {initial.name}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Client name">
          <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Drive folder ID (standups)">
          <input className={inputCls} style={inputStyle} value={f.driveFolderId} onChange={set("driveFolderId")} placeholder="1AbC…" />
        </Field>
        <Field label="Slack — internal channel ID">
          <input className={inputCls} style={inputStyle} value={f.slackInternal} onChange={set("slackInternal")} placeholder="C0123ABCD" />
        </Field>
        <Field label="Slack — external / client channel ID">
          <input className={inputCls} style={inputStyle} value={f.slackExternal} onChange={set("slackExternal")} placeholder="C0456WXYZ" />
        </Field>
      </div>
      <p className="text-[11.5px] mt-1 mb-3" style={{ color: "#8A93A3" }}>
        Channel ID (not the name): in Slack, open the channel → View channel details → the <code>C…</code> ID at the bottom. Invite the bot to each channel first.
      </p>
      <div className="flex items-center gap-3">
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
