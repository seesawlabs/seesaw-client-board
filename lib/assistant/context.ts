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
    "You can also READ the connected Google Drive to answer questions the board doesn't already hold: use findDocs (search by file name — e.g. 'Daily Standup', 'Vision Spec', a SOW) to locate documents and their dates, and readSource (by id or Drive URL) to read a document's text. Reach for these for questions like when the first/last standup happened, what a spec or SOW says, or to ground a board update in a source doc. Don't claim a fact is missing before checking Drive with findDocs.",
    "Status vocab: todo, doing, done, validated, skipped(requires a why note), na.",
    `Clients:\n${roster || "(none)"}`,
    `Opportunities:\n${opps || "(none)"}`,
    `Canonical process step ids by phase:\n${steps}`,
  ].join("\n\n");
}
