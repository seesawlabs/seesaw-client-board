"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";
import { listActivity, undoActivity, undoTurn } from "@/lib/assistant/activity";
import type { Account, Activity, Board, Client, Opportunity, StepInstance } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  const [aRows, cRows, oRows] = await Promise.all([
    db.select().from(accounts),
    db.select().from(clients),
    db.select().from(opportunities),
  ]);
  const as = aRows.map((a) => ({
    id: a.id, name: a.name, driveFolderId: a.driveFolderId, slackInternal: a.slackInternal, slackExternal: a.slackExternal,
  })) as Account[];
  const cs = cRows
    .map((r) => normalizeClient({ ...r, updatedAt: r.updatedAt ? r.updatedAt.getTime() : undefined } as unknown as Partial<Client>))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const os = oRows.map((o) => ({
    id: o.id, name: o.name, industry: o.industry, stage: o.stage,
    contact: o.contact, notes: o.notes, expertiseAsk: o.expertiseAsk,
    updatedAt: o.updatedAt ? o.updatedAt.getTime() : undefined,
  })) as Opportunity[];
  return { accounts: as, clients: cs, opportunities: os };
}

export async function upsertAccount(input: Partial<Account>): Promise<string> {
  const row = {
    name: input.name || "", driveFolderId: input.driveFolderId || "",
    slackInternal: input.slackInternal || "", slackExternal: input.slackExternal || "", updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, input.id)) : [];
  let id: string;
  if (existing.length) { await db.update(accounts).set(row).where(eq(accounts.id, input.id!)); id = input.id!; }
  else { const [ins] = await db.insert(accounts).values(row).returning({ id: accounts.id }); id = ins.id; }
  revalidatePath("/");
  return id;
}

export async function deleteAccount(id: string): Promise<void> {
  await db.update(clients).set({ accountId: null }).where(eq(clients.accountId, id));
  await db.delete(accounts).where(eq(accounts.id, id));
  revalidatePath("/");
}

export async function upsertClient(input: Partial<Client>): Promise<string> {
  const c = normalizeClient(input);
  const row = {
    accountId: c.accountId, name: c.name, summary: c.summary, start: c.start, end: c.end, phase: c.phase, status: c.status,
    billing: c.billing, contractValue: c.contractValue, buildUrl: c.buildUrl,
    opportunity: c.opportunity, assignments: c.assignments,
    risks: c.risks, needs: c.needs, findings: c.findings, links: c.links,
    entryPoint: c.entryPoint, updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.id)) : [];
  let id: string;
  if (existing.length) {
    await db.update(clients).set(row).where(eq(clients.id, input.id!));
    id = input.id!;
  } else {
    const [ins] = await db.insert(clients).values({ ...row, process: c.process }).returning({ id: clients.id });
    id = ins.id;
  }
  revalidatePath("/");
  return id;
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

export async function upsertOpportunity(input: Partial<Opportunity>): Promise<string> {
  const row = {
    name: input.name || "", industry: input.industry || "", stage: input.stage || "Lead",
    contact: input.contact || "", notes: input.notes || "", expertiseAsk: input.expertiseAsk || "", updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.id)) : [];
  let id: string;
  if (existing.length) {
    await db.update(opportunities).set(row).where(eq(opportunities.id, input.id!));
    id = input.id!;
  } else {
    const [ins] = await db.insert(opportunities).values(row).returning({ id: opportunities.id });
    id = ins.id;
  }
  revalidatePath("/");
  return id;
}

export async function deleteOpportunity(id: string): Promise<void> {
  await db.delete(opportunities).where(eq(opportunities.id, id));
  revalidatePath("/");
}

export async function listActivityAction(): Promise<Activity[]> {
  return listActivity();
}

export async function undoActivityAction(id: string): Promise<void> {
  await undoActivity(id);
  revalidatePath("/");
}

export async function undoTurnAction(turnId: string): Promise<void> {
  await undoTurn(turnId);
  revalidatePath("/");
}
