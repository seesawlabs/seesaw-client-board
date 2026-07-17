import { tool } from "ai";
import { z } from "zod";
import { getBoard, upsertClient, saveStep, deleteClient, upsertOpportunity } from "@/lib/actions";
import { snapshotClient, snapshotOpportunity, recordActivity } from "./activity";
import { resolveClient } from "./resolve";
import type { Client, Opportunity, StepInstance } from "@/lib/types";

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
        await upsertClient(merged);
        const board = await getBoard();
        const saved = board.clients.find((c) => (id ? c.id === id : c.name === (patch as { name?: string }).name));
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "upsertClient",
          entity: "client",
          entityId: saved?.id ?? id ?? null,
          beforeImage: before,
          summary: id ? `Updated ${saved?.name ?? "client"}` : `Created ${(patch as { name?: string }).name}`,
        });
        return `ok: ${id ? "updated" : "created"} ${saved?.name ?? (patch as { name?: string }).name}`;
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
        const patch: Partial<StepInstance> = { status, note: note ?? "", ...(decisions ? { decisions } : {}) };
        await saveStep(clientId, stepId, patch);
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
        const merged: Partial<Opportunity> = { ...(id ? { id } : {}), ...(patch as Partial<Opportunity>) };
        await upsertOpportunity(merged);
        await recordActivity({
          turnId,
          actor: "agent",
          tool: "upsertOpportunity",
          entity: "opportunity",
          entityId: id ?? null,
          beforeImage: before,
          summary: id ? `Updated opportunity` : `Created opportunity ${(patch as { name?: string }).name}`,
        });
        return "ok";
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
