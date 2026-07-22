export type Status = "todo" | "doing" | "done" | "validated" | "skipped" | "na";
export type Load = "lead" | "core" | "light";
export interface Decision { what: string; why: string }
export interface StepInstance { status: Status; note: string; decisions: Decision[] }
export interface Assignment { name: string; role: string; load: Load }
export interface Opportunity {
  id: string; name: string; industry: string; stage: string;
  contact: string; notes: string; expertiseAsk: string; updatedAt?: number;
}
// The client/company that groups projects (UI label: "Client").
export interface Account {
  id: string; name: string;
  driveFolderId: string; slackInternal: string; slackExternal: string;
}

// NOTE: `Client` is historically the ENGAGEMENT / PROJECT (one 5D process).
// It belongs to an Account (the actual client company) via accountId.
// UI label for this row: "Project".
export interface Client {
  id: string; accountId: string | null;
  name: string; summary: string; start: string; end: string;
  phase: string; status: string;
  billing: "billable" | "internal";
  opportunity: { types: string[]; note: string };
  contractValue: number | null; buildUrl: string;
  assignments: Assignment[];
  risks: string[]; needs: string[]; findings: string[];
  links: { label: string; url: string }[];
  entryPoint: { mode: "greenfield" | "mid-build"; atStep: string | null };
  process: Record<string, StepInstance>;
  // Optional per-PROJECT sources; when blank the project inherits its account's.
  driveFolderId: string; slackInternal: string; slackExternal: string;
  githubRepo: string; // "owner/repo"
  // Nightly-synthesized morning brief.
  briefProse: string; briefDeadline: string; briefDeadlineLabel: string; briefAt?: number;
  updatedAt?: number;
}
export interface Board { accounts: Account[]; clients: Client[]; opportunities: Opportunity[] }
export interface Activity {
  id: string; createdAt: number; turnId: string;
  actor: "agent" | "user"; tool: string; summary: string;
  entity: "client" | "opportunity"; entityId: string | null;
  beforeImage: unknown | null; undone: boolean;
}
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; turnId: string; createdAt: number; }
