"use client";
import { useState } from "react";
import { upsertClient, deleteClient } from "@/lib/actions";
import { BILLING, OPP_TYPES, LOAD, ALL_STEPS, PHASES, STATUS, BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Client, Load } from "@/lib/types";

type AssignmentDraft = { name: string; role: string; load: Load };

export function ClientEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Client;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    name: initial?.name || "",
    summary: initial?.summary || "",
    start: initial?.start || "",
    end: initial?.end || "",
    phase: initial?.phase || "Discover",
    status: initial?.status || "On Track",
    billing: initial?.billing || "billable",
    oppTypes: initial?.opportunity?.types || ([] as string[]),
    oppNote: initial?.opportunity?.note || "",
    contractValue: initial?.contractValue == null ? "" : String(initial.contractValue),
    buildUrl: initial?.buildUrl || "",
    assignments: (initial?.assignments?.length
      ? initial.assignments.map((a) => ({ ...a }))
      : [{ name: "", role: "", load: "core" }]) as AssignmentDraft[],
    entryMode: initial?.entryPoint?.mode || "greenfield",
    entryStep: initial?.entryPoint?.atStep || "",
    risks: (initial?.risks || []).join("\n"),
    needs: (initial?.needs || []).join("\n"),
    findings: (initial?.findings || []).join("\n"),
    links: (initial?.links || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
  });
  const [busy, setBusy] = useState(false);

  const set =
    <K extends keyof typeof f>(k: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF({ ...f, [k]: e.target.value as (typeof f)[K] });
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const toggleOpp = (id: string) =>
    setF((s) => ({
      ...s,
      oppTypes: s.oppTypes.includes(id) ? s.oppTypes.filter((x) => x !== id) : [...s.oppTypes, id],
    }));
  const setAssignment = <K extends keyof AssignmentDraft>(i: number, k: K, v: string) =>
    setF((s) => ({
      ...s,
      assignments: s.assignments.map((a, j) => (j === i ? { ...a, [k]: v as AssignmentDraft[K] } : a)),
    }));
  const addAssignment = () =>
    setF((s) => ({ ...s, assignments: [...s.assignments, { name: "", role: "", load: "core" as Load }] }));
  const removeAssignment = (i: number) =>
    setF((s) => ({ ...s, assignments: s.assignments.filter((_, j) => j !== i) }));

  const submit = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    try {
      await upsertClient({
        id: initial?.id,
        name: f.name.trim(),
        summary: f.summary.trim(),
        start: f.start,
        end: f.end,
        phase: f.phase,
        status: f.status,
        billing: f.billing as Client["billing"],
        opportunity: { types: f.oppTypes, note: f.oppNote.trim() },
        contractValue: f.contractValue === "" ? null : Math.round(Number(f.contractValue)),
        buildUrl: f.buildUrl.trim(),
        assignments: f.assignments
          .map((a) => ({ name: a.name.trim(), role: a.role.trim(), load: a.load }))
          .filter((a) => a.name),
        entryPoint: {
          mode: f.entryMode as Client["entryPoint"]["mode"],
          atStep: f.entryMode === "mid-build" ? f.entryStep || null : null,
        },
        risks: lines(f.risks),
        needs: lines(f.needs),
        findings: lines(f.findings),
        links: lines(f.links).map((l) => {
          const [label, url] = l.split("|").map((x) => x.trim());
          return { label: label || url, url: url || label };
        }),
        process: initial?.process,
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
        await deleteClient(initial.id);
        onSaved();
      } catch {
        setBusy(false);
      }
    }
  };

  return (
    <div className="p-5 rounded-lg border" style={{ background: "#fff", borderColor: BRAND.navy }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Client name">
          <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} placeholder="Acme Co" />
        </Field>
        <Field label="One-line summary">
          <input className={inputCls} style={inputStyle} value={f.summary} onChange={set("summary")} placeholder="What we're building, in one line" />
        </Field>
        <Field label="Start date">
          <input type="date" className={inputCls} style={inputStyle} value={f.start} onChange={set("start")} />
        </Field>
        <Field label="End date">
          <input type="date" className={inputCls} style={inputStyle} value={f.end} onChange={set("end")} />
        </Field>
        <Field label="5D phase">
          <select className={inputCls} style={inputStyle} value={f.phase} onChange={set("phase")}>
            {PHASES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={f.status} onChange={set("status")}>
            {Object.keys(STATUS).map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Billing">
          <select className={inputCls} style={inputStyle} value={f.billing} onChange={set("billing")}>
            {BILLING.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </Field>
        <Field label="Contract value ($)">
          <input type="number" min="0" className={inputCls} style={inputStyle} value={f.contractValue}
            onChange={set("contractValue")} placeholder={f.billing === "internal" ? "n/a — internal" : "85000"}
            disabled={f.billing === "internal"} />
        </Field>
      </div>

      <Field label="The real opportunity (select all that apply)">
        <div className="flex flex-wrap gap-2">
          {OPP_TYPES.map((o) => {
            const on = f.oppTypes.includes(o.id);
            return (
              <button key={o.id} type="button" onClick={() => toggleOpp(o.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{ borderColor: on ? BRAND.navy : "#D3D9E2", background: on ? BRAND.navy : "#fff", color: on ? "#fff" : "#66707F" }}>
                {o.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="Opportunity note">
        <input className={inputCls} style={inputStyle} value={f.oppNote} onChange={set("oppNote")}
          placeholder="What we're really driving toward with this client" />
      </Field>
      <Field label="Build link (what we/they built)">
        <input className={inputCls} style={inputStyle} value={f.buildUrl} onChange={set("buildUrl")}
          placeholder="https://staging.example.com" />
      </Field>

      <Field label="Team & allocation">
        <div className="space-y-2">
          {f.assignments.map((a, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input className={inputCls} style={inputStyle} value={a.name}
                onChange={(e) => setAssignment(i, "name", e.target.value)} placeholder="Name" />
              <input className={inputCls} style={inputStyle} value={a.role}
                onChange={(e) => setAssignment(i, "role", e.target.value)} placeholder="Role" />
              <select className={inputCls} style={{ ...inputStyle, width: 110 }} value={a.load}
                onChange={(e) => setAssignment(i, "load", e.target.value)}>
                {LOAD.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={() => removeAssignment(i)} className="px-2 text-sm" style={{ color: BRAND.red }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addAssignment} className="text-sm font-semibold" style={{ color: BRAND.blue }}>
            + Add person
          </button>
        </div>
      </Field>

      <Field label="Entry point — where did we pick this client up?">
        <div className="flex flex-wrap gap-3 items-center">
          <select className={inputCls} style={{ ...inputStyle, width: 200 }} value={f.entryMode} onChange={set("entryMode")}>
            <option value="greenfield">Greenfield (start at step 1)</option>
            <option value="mid-build">Mid-build (came in partway)</option>
          </select>
          {f.entryMode === "mid-build" && (
            <select className={inputCls} style={{ ...inputStyle, flex: 1 }} value={f.entryStep} onChange={set("entryStep")}>
              <option value="">Which step did we come in at?</option>
              {ALL_STEPS.map((s) => <option key={s.id} value={s.id}>{s.phaseLabel} — {s.label}</option>)}
            </select>
          )}
        </div>
        <p className="text-[11px] mt-1" style={{ color: "#8A93A3" }}>
          Mid-build pre-marks earlier steps as “validated” (review the client’s prior work) for new clients.
        </p>
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
        <Field label="Risks (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.risks} onChange={set("risks")} />
        </Field>
        <Field label="Needs / asks (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.needs} onChange={set("needs")} />
        </Field>
        <Field label="Key findings (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.findings} onChange={set("findings")} />
        </Field>
      </div>
      <Field label="Links — one per line, as: Label | https://url">
        <textarea rows={2} className={inputCls} style={inputStyle} value={f.links} onChange={set("links")} placeholder="Staging demo | https://…" />
      </Field>

      <div className="flex items-center gap-3 mt-2">
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy, opacity: busy ? 0.6 : 1 }}>
          Save engagement
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
