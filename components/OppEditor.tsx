"use client";
import { useState } from "react";
import { upsertOpportunity, deleteOpportunity } from "@/lib/actions";
import { OPP_STAGES, BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Opportunity } from "@/lib/types";

export function OppEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Opportunity;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name || "",
    industry: initial?.industry || "",
    stage: initial?.stage || "Lead",
    contact: initial?.contact || "",
    notes: initial?.notes || "",
    expertiseAsk: initial?.expertiseAsk || "",
  });
  const [busy, setBusy] = useState(false);

  const set =
    <K extends keyof typeof f>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value as (typeof f)[K] });

  const submit = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      await upsertOpportunity({
        id: initial?.id,
        name: f.name.trim(),
        industry: f.industry,
        stage: f.stage,
        contact: f.contact,
        notes: f.notes,
        expertiseAsk: f.expertiseAsk,
      });
      onSaved();
    } catch {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (initial && !busy) {
      setBusy(true);
      try {
        await deleteOpportunity(initial.id);
        onSaved();
      } catch {
        setBusy(false);
      }
    }
  };

  return (
    <div className="p-5 rounded-lg border" style={{ background: "#fff", borderColor: BRAND.navy }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Opportunity">
          <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Industry">
          <input className={inputCls} style={inputStyle} value={f.industry} onChange={set("industry")} placeholder="Healthcare, fintech, logistics…" />
        </Field>
        <Field label="Stage">
          <select className={inputCls} style={inputStyle} value={f.stage} onChange={set("stage")}>
            {OPP_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Contact / owner">
          <input className={inputCls} style={inputStyle} value={f.contact} onChange={set("contact")} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={3} className={inputCls} style={inputStyle} value={f.notes} onChange={set("notes")} />
      </Field>
      <Field label="Experience we're looking for (the ask to the team)">
        <textarea rows={2} className={inputCls} style={inputStyle} value={f.expertiseAsk} onChange={set("expertiseAsk")} placeholder="Anyone worked in this industry before?" />
      </Field>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy, opacity: busy ? 0.6 : 1 }}>
          Save opportunity
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
          Cancel
        </button>
        {initial && (
          <button onClick={remove} disabled={busy} className="ml-auto px-3 py-2 rounded-md text-sm font-medium" style={{ color: BRAND.red }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
