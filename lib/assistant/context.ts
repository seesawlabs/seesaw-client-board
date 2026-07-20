import type { Board } from "@/lib/types";
import { PROCESS } from "@/lib/process";
export function buildAssistantContext(board: Board): string {
  const roster = board.clients
    .map((c) => {
      const bits = [
        c.summary && c.summary.trim(),
        c.assignments?.length && `team: ${c.assignments.map((a) => a.name).filter(Boolean).join(", ")}`,
        c.opportunity?.note && `opportunity: ${c.opportunity.note}`,
      ].filter(Boolean);
      return `- ${c.name} (id=${c.id}) — ${c.phase} phase, health "${c.status}"${bits.length ? ` — ${bits.join("; ")}` : ""}`;
    })
    .join("\n");
  const opps = board.opportunities
    .map((o) => `- ${o.name} (id=${o.id}) — stage ${o.stage}${o.industry ? `, ${o.industry}` : ""}${o.contact ? `, contact ${o.contact}` : ""}`)
    .join("\n");
  const steps = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => `${s.id} (${s.label})`).join("; ")}`).join("\n");
  return [
    "You maintain a SeeSaw Labs client engagement board. When the user tells you what happened, or pastes a transcript/link, infer which client and CALL TOOLS to update the board. Auto-apply — do not ask for permission for normal edits; every change is logged and undoable. For deletes, ask first (pass confirmed:true only after the user confirms). If you cannot tell which client, ask one short question or create a new one.",
    "Status vocab: todo, doing, done, validated, skipped(requires a why note), na.",
    `Clients:\n${roster || "(none)"}`,
    `Opportunities:\n${opps || "(none)"}`,
    `Canonical process step ids by phase:\n${steps}`,
  ].join("\n\n");
}
