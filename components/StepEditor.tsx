"use client";
import { useState } from "react";
import { STATUS_META, BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { StepInstance, Status, Decision } from "@/lib/types";

export function StepEditor({
  step,
  instance,
  onSaved,
  onClose,
}: {
  step: { label: string; phaseLabel: string };
  instance: StepInstance;
  onSaved: (patch: Partial<StepInstance>) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>(instance.status);
  const [note, setNote] = useState(instance.note || "");
  const [decisions, setDecisions] = useState<Decision[]>(
    instance.decisions?.length ? instance.decisions.map((d) => ({ ...d })) : [],
  );
  const requiresNote = status === "skipped";
  const addDecision = () => setDecisions((d) => [...d, { what: "", why: "" }]);
  const setD = (i: number, k: keyof Decision, v: string) =>
    setDecisions((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const removeD = (i: number) => setDecisions((d) => d.filter((_, j) => j !== i));
  const save = () => {
    if (requiresNote && !note.trim()) return;
    onSaved({
      status,
      note: note.trim(),
      decisions: decisions.filter((d) => d.what.trim() || d.why.trim()),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(21,34,56,0.45)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg p-5 w-full max-w-lg"
        style={{ maxHeight: "85vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] uppercase tracking-widest font-semibold" style={{ color: "#8A93A3" }}>
          {step.phaseLabel}
        </div>
        <h3 className="text-lg mb-3" style={{ fontFamily: "'Bricolage Grotesque', 'Archivo', sans-serif", fontWeight: 700, color: BRAND.navy }}>
          {step.label}
        </h3>

        <Field label="Status">
          <div className="flex flex-wrap gap-2">
            {(Object.entries(STATUS_META) as [Status, (typeof STATUS_META)[Status]][]).map(([id, m]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatus(id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold border"
                style={{
                  borderColor: status === id ? m.color : "#D3D9E2",
                  background: status === id ? m.bg : "#fff",
                  color: status === id ? m.color : "#66707F",
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label={requiresNote ? "Why skipped? (required)" : "Note"}>
          <textarea
            rows={2}
            className={inputCls}
            style={inputStyle}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              status === "validated"
                ? "What did we review / value added?"
                : requiresNote
                ? "Reason we're deliberately skipping this"
                : "Optional context"
            }
          />
        </Field>

        <div className="mb-2">
          <div className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: "#66707F" }}>
            Key decisions
          </div>
          {decisions.map((d, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input className={inputCls} style={inputStyle} value={d.what} onChange={(e) => setD(i, "what", e.target.value)} placeholder="What we decided" />
              <input className={inputCls} style={inputStyle} value={d.why} onChange={(e) => setD(i, "why", e.target.value)} placeholder="Why" />
              <button type="button" onClick={() => removeD(i)} className="px-2" style={{ color: BRAND.red }}>✕</button>
            </div>
          ))}
          <button type="button" onClick={addDecision} className="text-sm font-semibold" style={{ color: BRAND.blue }}>
            + Add decision
          </button>
        </div>

        <div className="flex gap-3 mt-3">
          <button onClick={save} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy }}>
            Save step
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
