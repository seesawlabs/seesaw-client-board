export type Status = "todo" | "doing" | "done" | "validated" | "skipped" | "na";
export type Load = "lead" | "core" | "light";
export interface Decision { what: string; why: string }
export interface StepInstance { status: Status; note: string; decisions: Decision[] }
export interface Assignment { name: string; role: string; load: Load }
export interface Opportunity {
  id: string; name: string; industry: string; stage: string;
  contact: string; notes: string; expertiseAsk: string; updatedAt?: number;
}
export interface Client {
  id: string; name: string; summary: string; start: string; end: string;
  phase: string; status: string;
  billing: "billable" | "internal";
  opportunity: { types: string[]; note: string };
  contractValue: number | null; buildUrl: string;
  assignments: Assignment[];
  risks: string[]; needs: string[]; findings: string[];
  links: { label: string; url: string }[];
  entryPoint: { mode: "greenfield" | "mid-build"; atStep: string | null };
  process: Record<string, StepInstance>;
  updatedAt?: number;
}
export interface Board { clients: Client[]; opportunities: Opportunity[] }
