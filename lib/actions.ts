"use server";
import { revalidatePath as _revalidatePath } from "next/cache";
// Safe wrapper: revalidatePath throws if called outside a request (e.g. from an
// ingestion script/agent run). Swallow that so mutations still succeed.
function revalidatePath(path: string) {
  try { _revalidatePath(path); } catch { /* not in a request context */ }
}
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, clients, opportunities, settings } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";
import { listActivity, undoActivity, undoTurn } from "@/lib/assistant/activity";
import { getConnection, disconnectGoogle, googleConfigured } from "@/lib/google";
import { ingestAll } from "@/lib/assistant/ingest";
import { ingestAllContext } from "@/lib/assistant/context-ingest";
import { slackConfigured } from "@/lib/slack";
import { ingestAllSlack } from "@/lib/assistant/slack-ingest";

export async function ingestStandupsAction(): Promise<{ ok: boolean; docs: number; message: string }> {
  try {
    const results = await ingestAll();
    const docs = results.reduce((n, r) => n + r.docs, 0);
    revalidatePath("/");
    return { ok: true, docs, message: docs ? `Ingested ${docs} new standup${docs > 1 ? "s" : ""}.` : "No new standups to ingest." };
  } catch (e) {
    return { ok: false, docs: 0, message: (e as Error).message };
  }
}
export async function getSlackStatus(): Promise<{ configured: boolean; accountsWired: number }> {
  const configured = slackConfigured();
  const [aRows, cRows] = await Promise.all([
    db.select({ i: accounts.slackInternal, e: accounts.slackExternal }).from(accounts),
    db.select({ i: clients.slackInternal, e: clients.slackExternal }).from(clients),
  ]);
  // count every source-set (account-level + project-level) that has a channel
  const accountsWired = aRows.filter((a) => a.i || a.e).length + cRows.filter((c) => c.i || c.e).length;
  return { configured, accountsWired };
}

export async function ingestSlackAction(): Promise<{ ok: boolean; messages: number; message: string }> {
  try {
    const results = await ingestAllSlack();
    const messages = results.reduce((n, r) => n + r.messages, 0);
    revalidatePath("/");
    return { ok: true, messages, message: messages ? `Read ${messages} new Slack message${messages > 1 ? "s" : ""}.` : "No new Slack messages." };
  } catch (e) {
    return { ok: false, messages: 0, message: (e as Error).message };
  }
}

import type { Account, Activity, Board, Client, Opportunity, StepInstance } from "@/lib/types";

export async function ingestDocsAction(): Promise<{ ok: boolean; docs: number; message: string }> {
  try {
    const results = await ingestAllContext();
    const docs = results.reduce((n, r) => n + r.docs, 0);
    revalidatePath("/");
    return { ok: true, docs, message: docs ? `Read ${docs} project doc${docs > 1 ? "s" : ""}.` : "No new project docs to read." };
  } catch (e) {
    return { ok: false, docs: 0, message: (e as Error).message };
  }
}

export async function getGoogleStatus(): Promise<{ configured: boolean; connected: boolean; email: string }> {
  const conn = await getConnection();
  return { configured: googleConfigured(), connected: !!conn, email: conn?.email || "" };
}

export async function disconnectGoogleAction(): Promise<void> {
  await disconnectGoogle();
  revalidatePath("/");
}

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
    entryPoint: c.entryPoint,
    driveFolderId: c.driveFolderId, slackInternal: c.slackInternal, slackExternal: c.slackExternal,
    updatedAt: new Date(),
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

// Set a single list column (risks/needs/findings) without touching other fields.
export async function setListField(clientId: string, kind: "risks" | "needs" | "findings", items: string[]): Promise<void> {
  await db.update(clients).set({ [kind]: items, updatedAt: new Date() }).where(eq(clients.id, clientId));
  revalidatePath("/");
}

// Set a project's own source fields (Drive folder + Slack channels) without
// touching anything else — safe targeted update, unlike upsertClient.
export async function setProjectSources(
  clientId: string,
  src: { driveFolderId: string; slackInternal: string; slackExternal: string },
): Promise<void> {
  await db.update(clients).set({
    driveFolderId: src.driveFolderId.trim(),
    slackInternal: src.slackInternal.trim(),
    slackExternal: src.slackExternal.trim(),
    updatedAt: new Date(),
  }).where(eq(clients.id, clientId));
  revalidatePath("/");
}

export async function getSetting(key: string): Promise<string> {
  const [row] = await db.select({ v: settings.value }).from(settings).where(eq(settings.key, key));
  return row?.v || "";
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.insert(settings).values({ key, value: value.trim(), updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value: value.trim(), updatedAt: new Date() } });
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
