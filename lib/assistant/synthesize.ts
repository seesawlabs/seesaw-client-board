import { generateObject } from "ai";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, activity } from "@/lib/db/schema";
import { normalizeClient, PROCESS, STATUS_META } from "@/lib/process";
import type { Client } from "@/lib/types";

const MODEL = "anthropic/claude-sonnet-5";

const BriefSchema = z.object({
  prose: z.string().describe(
    "EXACTLY 2-3 sentences, ~55 words max, for a morning read-in. Lead with what shipped or changed RECENTLY, then where it stands, then the single watch-item — fold any urgency (a looming risk, a client dependency, a decision to make) into this. Trajectory, not a status dump. Tight and concrete — no bullet lists, no preamble, do not restate the project's name or what it is.",
  ),
  deadlineDate: z.string().describe(
    "The single NEAREST hard, DATED commitment for this project as an absolute date YYYY-MM-DD — a SOW milestone, a scheduled client demo/call, or the engagement end. Resolve relative references ('Thursday', 'end of week') against today's date, given below. Empty string if there is no meaningful dated deadline in the next ~2 weeks.",
  ),
  deadlineLabel: z.string().describe(
    "A short name for that deadline (e.g. 'Milestone 2 — tenant isolation + monitoring' or 'Client demo'). Empty string if deadlineDate is empty.",
  ),
});

// Render a project's current state + recent changes as the synthesis input.
function projectContext(project: Client, recent: { summary: string; when: string }[]): string {
  const steps = PROCESS.flatMap((p) =>
    p.steps
      .map((s) => ({ s, inst: project.process?.[s.id] }))
      .filter(({ inst }) => inst && inst.status !== "todo")
      .map(({ s, inst }) => `  [${STATUS_META[inst!.status]?.label || inst!.status}] ${p.label} · ${s.label}${inst!.note ? ` — ${inst!.note}` : ""}`),
  ).join("\n");
  const list = (label: string, items: string[]) => (items.length ? `${label}:\n${items.map((i) => `  - ${i}`).join("\n")}` : "");
  return [
    `Project: ${project.name} — phase ${project.phase}, status ${project.status}${project.contractValue ? `, $${project.contractValue.toLocaleString()}` : ""}${project.end ? `, ends ${project.end}` : ""}`,
    project.summary && `Summary: ${project.summary}`,
    `Process steps in play:\n${steps || "  (none started)"}`,
    list("Open risks", project.risks),
    list("Open needs", project.needs),
    list("Recent findings", project.findings),
    recent.length ? `Recent changes (newest first):\n${recent.map((r) => `  - ${r.when}: ${r.summary}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

export async function synthesizeProjectBrief(
  project: Client,
  recent: { summary: string; when: string }[],
  today: string,
): Promise<{ prose: string; deadlineDate: string; deadlineLabel: string }> {
  const system = [
    "You write the morning brief for a SeeSaw Labs client project on a SHARED company board (not personal — never address 'you').",
    "Produce a 'prose' trajectory (2-3 sentences, urgency folded in) and, separately, the single nearest hard DATED deadline (deadlineDate + deadlineLabel), if one exists.",
    "Be specific and concrete — name the actual work, the actual blocker. Prefer the substance from risks/findings/recent changes over generic phase language. Keep prose to 2-3 sentences; brevity matters, this is scanned across many projects. Never invent a date — only surface a deadline the sources actually support.",
    `Today is ${today}.`,
  ].join(" ");
  const { object } = await generateObject({
    model: MODEL,
    schema: BriefSchema,
    system,
    prompt: projectContext(project, recent),
  });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(object.deadlineDate.trim()) ? object.deadlineDate.trim() : "";
  return { prose: object.prose.trim(), deadlineDate: date, deadlineLabel: date ? object.deadlineLabel.trim() : "" };
}

/** Regenerate the stored brief for every project. Returns count synthesized. */
export async function synthesizeAllBriefs(): Promise<{ project: string; deadline: boolean }[]> {
  const today = new Date().toISOString().slice(0, 10);
  const cRows = await db.select().from(clients);
  const results: { project: string; deadline: boolean }[] = [];
  for (const r of cRows) {
    const project = normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>);
    const acts = await db.select({ summary: activity.summary, createdAt: activity.createdAt })
      .from(activity).where(eq(activity.entityId, r.id)).orderBy(desc(activity.createdAt)).limit(20);
    const recent = acts.map((a) => ({ summary: a.summary, when: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "" }));
    const { prose, deadlineDate, deadlineLabel } = await synthesizeProjectBrief(project, recent, today);
    await db.update(clients).set({ briefProse: prose, briefDeadline: deadlineDate, briefDeadlineLabel: deadlineLabel, briefAt: new Date() }).where(eq(clients.id, r.id));
    results.push({ project: project.name, deadline: !!deadlineDate });
  }
  return results;
}
