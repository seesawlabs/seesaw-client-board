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
    "EXACTLY 2-3 sentences, ~55 words max, for a morning read-in. Lead with what shipped or changed RECENTLY, then where it stands, then the single watch-item. Trajectory, not a status dump. Tight and concrete — no bullet lists, no preamble, do not restate the project's name or what it is.",
  ),
  attention: z.string().describe(
    "ONE sentence (~30 words) naming the single thing that needs a human DECISION or NUDGE today — a real blocker, a client dependency, a call to make. Empty string if nothing genuinely needs attention today. Do NOT put routine 'review PR' tasks here.",
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

export async function synthesizeProjectBrief(project: Client, recent: { summary: string; when: string }[]): Promise<{ prose: string; attention: string }> {
  const system = [
    "You write the morning brief for a SeeSaw Labs client project — read by a busy founder who wants to get oriented in seconds and only act where it matters.",
    "From the project's state and recent changes, produce a 'prose' trajectory (2-3 sentences) and an 'attention' line (the one thing needing a human today, or empty).",
    "Be specific and concrete — name the actual work, the actual blocker. Prefer the substance from risks/findings/recent changes over generic phase language. Keep prose to 2-3 sentences; brevity matters, this is scanned across many projects. Never invent. If the project is quietly on track, prose says so plainly and attention is empty.",
  ].join(" ");
  const { object } = await generateObject({
    model: MODEL,
    schema: BriefSchema,
    system,
    prompt: projectContext(project, recent),
  });
  return { prose: object.prose.trim(), attention: object.attention.trim() };
}

/** Regenerate the stored brief for every project. Returns count synthesized. */
export async function synthesizeAllBriefs(): Promise<{ project: string; attention: boolean }[]> {
  const cRows = await db.select().from(clients);
  const results: { project: string; attention: boolean }[] = [];
  for (const r of cRows) {
    const project = normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>);
    const acts = await db.select({ summary: activity.summary, createdAt: activity.createdAt })
      .from(activity).where(eq(activity.entityId, r.id)).orderBy(desc(activity.createdAt)).limit(20);
    const recent = acts.map((a) => ({ summary: a.summary, when: a.createdAt ? a.createdAt.toISOString().slice(0, 10) : "" }));
    const { prose, attention } = await synthesizeProjectBrief(project, recent);
    await db.update(clients).set({ briefProse: prose, briefAttention: attention, briefAt: new Date() }).where(eq(clients.id, r.id));
    results.push({ project: project.name, attention: !!attention });
  }
  return results;
}
