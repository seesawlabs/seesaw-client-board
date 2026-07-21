import { tool } from "ai";
import { z } from "zod";
import { getBoard, upsertClient, saveStep, deleteClient, upsertOpportunity, setListField } from "@/lib/actions";
import { snapshotClient, snapshotOpportunity, recordActivity } from "./activity";
import { resolveClient } from "./resolve";
import { driveSearch, readById } from "@/lib/google";
import type { Client, Opportunity } from "@/lib/types";

/**
 * The whitelisted tool layer the AI assistant uses to read/mutate the board.
 * Every mutating tool: snapshots the before-image, runs the existing validated
 * server action (never touches the DB directly), records an undoable activity
 * entry, and returns a short result string for the model to relay/act on.
 */
export function buildTools(turnId: string) {
  return {
    queryBoard: tool({
      description: "Read the board. Use to find a client/opportunity id or answer questions.",
      inputSchema: z.object({ q: z.string().describe("what you're looking for") }),
      execute: async ({ q }) => {
        const board = await getBoard();
        const match = resolveClient(q, board.clients);
        return JSON.stringify({
          clients: board.clients.map((c) => ({ id: c.id, name: c.name, phase: c.phase, status: c.status })),
          match,
        });
      },
    }),
    upsertClient: tool({
      description: "Create or update a client's deal fields. Omit id to create. Only pass fields you want to change.",
      inputSchema: z.object({
        id: z.string().optional(),
        patch: z
          .record(z.string(), z.any())
          .describe(
            "partial Client: name, summary, start, end, phase, status, billing, contractValue, buildUrl, opportunity, assignments, risks, needs, findings, entryPoint"
          ),
      }),
      execute: async ({ id, patch }) => {
        const before = id ? await snapshotClient(id) : null;
        const merged: Partial<Client> = id
          ? { ...(before as unknown as Partial<Client>), ...patch, id }
          : (patch as Partial<Client>);
        if (id && before) {
          const b = before as unknown as Record<string, unknown>;
          // the agent may not reassign a project's client, nor blank its name
          (merged as Record<string, unknown>).accountId = b.accountId ?? null;
          const m = merged as Record<string, unknown>;
          if (!m.name || !String(m.name).trim()) m.name = b.name;
        }
        const savedId = await upsertClient(merged as any);
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "upsertClient",
          entity: "client",
          entityId: savedId,
          beforeImage: before,
          summary: id ? `Updated ${(patch as any).name ?? "client"}` : `Created ${(patch as any).name}`,
        });
        return `ok: ${id ? "updated" : "created"} ${(patch as { name?: string }).name}`;
      },
    }),
    addListItem: tool({
      description:
        "Append ONE item to a client's risks, needs, or findings list without overwriting the list. Use this for standup action items / next steps (kind: needs), a new risk, or a new finding. Prefer this over upsertClient for adding list items.",
      inputSchema: z.object({
        clientId: z.string(),
        kind: z.enum(["risks", "needs", "findings"]),
        text: z.string(),
      }),
      execute: async ({ clientId, kind, text }) => {
        const before = await snapshotClient(clientId);
        if (!before) return "error: client not found";
        const cur = (before as unknown as Record<string, unknown>)[kind];
        const list: string[] = Array.isArray(cur) ? (cur as string[]) : [];
        if (list.some((x) => x.trim().toLowerCase() === text.trim().toLowerCase())) return "ok: already present";
        await setListField(clientId, kind, [...list, text]);
        await recordActivity({
          turnId, actor: "agent", tool: "addListItem", entity: "client", entityId: clientId, beforeImage: before,
          summary: `Added ${kind.slice(0, -1)} to ${(before as { name?: string }).name ?? "client"}: ${text.slice(0, 60)}`,
        });
        return `ok: appended to ${kind}`;
      },
    }),
    setStep: tool({
      description:
        "Set a process step's status/note/decisions for a client. status ∈ todo|doing|done|validated|skipped|na. skipped requires a note.",
      inputSchema: z.object({
        clientId: z.string(),
        stepId: z.string(),
        status: z.enum(["todo", "doing", "done", "validated", "skipped", "na"]),
        note: z.string().optional(),
        decisions: z.array(z.object({ what: z.string(), why: z.string() })).optional(),
      }),
      execute: async ({ clientId, stepId, status, note, decisions }) => {
        if (status === "skipped" && !note?.trim()) return "error: skipped requires a note (the why)";
        const before = await snapshotClient(clientId);
        await saveStep(clientId, stepId, { status, ...(note !== undefined ? { note } : {}), ...(decisions ? { decisions } : {}) } as any);
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "setStep",
          entity: "client",
          entityId: clientId,
          beforeImage: before,
          summary: `${stepId} → ${status}${note ? ` (${note})` : ""}`,
        });
        return `ok: ${stepId} set to ${status}`;
      },
    }),
    upsertOpportunity: tool({
      description: "Create or update a pipeline opportunity. Omit id to create.",
      inputSchema: z.object({ id: z.string().optional(), patch: z.record(z.string(), z.any()) }),
      execute: async ({ id, patch }) => {
        const before = id ? await snapshotOpportunity(id) : null;
        const savedId = await upsertOpportunity({ ...(id ? { id } : {}), ...patch } as any);
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "upsertOpportunity",
          entity: "opportunity",
          entityId: savedId,
          beforeImage: before,
          summary: id ? `Updated opportunity` : `Created opportunity ${(patch as { name?: string }).name}`,
        });
        return "ok";
      },
    }),
    readLink: tool({
      description: "Fetch a URL the user pasted and return its readable text so you can act on it.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => (await import("./link")).fetchLinkText(url),
    }),
    findDocs: tool({
      description:
        "Search the connected Google Drive for documents by name (standup notes, a spec, a SOW, etc.). Use this to answer questions about source documents — when the first/last standup was, which docs exist, dates. Returns matches sorted oldest-first with created & modified dates.",
      inputSchema: z.object({ nameContains: z.string().describe("text the file name contains, e.g. 'Daily Standup' or 'Vision Spec'") }),
      execute: async ({ nameContains }) => {
        try {
          const safe = nameContains.replace(/['\\]/g, " ");
          const files = await driveSearch(`name contains '${safe}' and trashed=false`, 50);
          if (!files.length) return "No matching documents found in Drive.";
          const rows = files
            .map((f) => ({ name: f.name, id: f.id, created: (f.createdTime || "").slice(0, 10), modified: (f.modifiedTime || "").slice(0, 10) }))
            .sort((a, b) => a.created.localeCompare(b.created));
          return JSON.stringify(rows);
        } catch (e) {
          return `error: ${(e as Error).message}`;
        }
      },
    }),
    readSource: tool({
      description:
        "Read the text of a Google Drive document (Google Doc, Sheet, or PDF) by its id or share URL — e.g. an id from findDocs — so you can answer questions about, or act on, its contents.",
      inputSchema: z.object({ idOrUrl: z.string().describe("a Drive file id or share URL") }),
      execute: async ({ idOrUrl }) => {
        try {
          return (await readById(idOrUrl, 16000)) || "(empty document)";
        } catch (e) {
          return `error: ${(e as Error).message}`;
        }
      },
    }),
    deleteClient: tool({
      description: "Delete a client. DESTRUCTIVE — only call with confirmed:true after the user explicitly confirms.",
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return "not confirmed: ask the user to confirm deletion first";
        const before = await snapshotClient(id);
        await deleteClient(id);
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "deleteClient",
          entity: "client",
          entityId: id,
          beforeImage: before,
          summary: `Deleted ${(before as { name?: string } | null)?.name ?? "client"}`,
        });
        return "ok: deleted (undoable)";
      },
    }),
  };
}
