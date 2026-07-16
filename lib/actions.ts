"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";
import type { Board, Client, Opportunity, StepInstance } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  const [cRows, oRows] = await Promise.all([db.select().from(clients), db.select().from(opportunities)]);
  const cs = cRows
    .map((r) => normalizeClient(r as unknown as Partial<Client>))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const os = oRows.map((o) => ({
    id: o.id, name: o.name, industry: o.industry, stage: o.stage,
    contact: o.contact, notes: o.notes, expertiseAsk: o.expertiseAsk,
  })) as Opportunity[];
  return { clients: cs, opportunities: os };
}

export async function upsertClient(input: Partial<Client>): Promise<void> {
  const c = normalizeClient(input);
  const row = {
    name: c.name, summary: c.summary, start: c.start, end: c.end, phase: c.phase, status: c.status,
    billing: c.billing, contractValue: c.contractValue, buildUrl: c.buildUrl,
    opportunity: c.opportunity, assignments: c.assignments,
    risks: c.risks, needs: c.needs, findings: c.findings, links: c.links,
    entryPoint: c.entryPoint, process: c.process, updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.id)) : [];
  if (existing.length) await db.update(clients).set(row).where(eq(clients.id, input.id!));
  else await db.insert(clients).values(row);
  revalidatePath("/");
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/");
}

export async function saveStep(clientId: string, stepId: string, patch: Partial<StepInstance>): Promise<void> {
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!row) return;
  const process = { ...(row.process as Record<string, StepInstance>) };
  process[stepId] = { ...process[stepId], ...patch } as StepInstance;
  await db.update(clients).set({ process, updatedAt: new Date() }).where(eq(clients.id, clientId));
  revalidatePath("/");
}

export async function upsertOpportunity(input: Partial<Opportunity>): Promise<void> {
  const row = {
    name: input.name || "", industry: input.industry || "", stage: input.stage || "Lead",
    contact: input.contact || "", notes: input.notes || "", expertiseAsk: input.expertiseAsk || "", updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.id)) : [];
  if (existing.length) await db.update(opportunities).set(row).where(eq(opportunities.id, input.id!));
  else await db.insert(opportunities).values(row);
  revalidatePath("/");
}

export async function deleteOpportunity(id: string): Promise<void> {
  await db.delete(opportunities).where(eq(opportunities.id, id));
  revalidatePath("/");
}
