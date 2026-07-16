import type { Client, Status, StepInstance } from "@/lib/types";

export const BRAND = {
  navy: "#152238", red: "#E4413F", blue: "#2B6CB0", lightBlue: "#A9CCE8",
  pink: "#F2B6C6", paper: "#F7F5F1", ink: "#1D2733",
};

export const PHASES = ["Discover", "Define", "Design", "Develop", "Deploy"];

export const STATUS: Record<string, { color: string; bg: string }> = {
  "On Track": { color: BRAND.blue, bg: "#E3EEF8" },
  "At Risk": { color: "#B7791F", bg: "#FBF0DC" },
  Blocked: { color: BRAND.red, bg: "#FBE3E3" },
  Wrapping: { color: "#2F855A", bg: "#E2F2E9" },
};

export const PROCESS = [
  { key: "discover", label: "Discover", blurb: "Understand the problem, domain, and whether to build", steps: [
    { id: "dsc_rampup", label: "Industry & business ramp-up", megamine: true },
    { id: "dsc_stakeholders", label: "Stakeholder & goal alignment" },
    { id: "dsc_research", label: "User & problem research" },
    { id: "dsc_competitive", label: "Competitive & landscape teardown" },
    { id: "dsc_feasibility", label: "Opportunity & feasibility read" },
  ]},
  { key: "define", label: "Define", blurb: "Lock scope, success criteria, and the plan", steps: [
    { id: "def_metrics", label: "Success metrics & goals" },
    { id: "def_scope", label: "Scope & SOW" },
    { id: "def_requirements", label: "Solution concept & requirements" },
    { id: "def_architecture", label: "Technical approach & architecture" },
    { id: "def_roadmap", label: "Roadmap & milestones" },
  ]},
  { key: "design", label: "Design", blurb: "Make it concrete and validate before heavy build", steps: [
    { id: "dsn_ia", label: "Information architecture & flows" },
    { id: "dsn_wireframes", label: "Wireframes & prototype" },
    { id: "dsn_ui", label: "UI & visual design" },
    { id: "dsn_validation", label: "Design validation" },
    { id: "dsn_handoff", label: "Design-to-dev handoff" },
  ]},
  { key: "develop", label: "Develop", blurb: "Build it", steps: [
    { id: "dev_scaffold", label: "Environment & scaffolding" },
    { id: "dev_build", label: "Core build (iterative)" },
    { id: "dev_integrations", label: "Integrations & data" },
    { id: "dev_qa", label: "QA & testing" },
    { id: "dev_security", label: "Security, data & compliance review" },
  ]},
  { key: "deploy", label: "Deploy", blurb: "Ship, hand off, set up for success", steps: [
    { id: "dep_readiness", label: "Launch readiness" },
    { id: "dep_release", label: "Production deploy" },
    { id: "dep_observability", label: "Monitoring & observability" },
    { id: "dep_handoff", label: "Handoff & enablement" },
    { id: "dep_review", label: "Post-launch review" },
  ]},
] as const;

export const ALL_STEPS = PROCESS.flatMap((p) =>
  p.steps.map((s) => ({ id: s.id, phaseKey: p.key, phaseLabel: p.label, label: s.label, megamine: "megamine" in s && !!s.megamine })));

export const STATUS_META: Record<Status, { icon: string; label: string; complete: boolean; applicable: boolean; badge?: boolean; color: string; bg: string }> = {
  todo:      { icon: "○", label: "Not started", complete: false, applicable: true,  color: "#8A93A3", bg: "#EEF1F6" },
  doing:     { icon: "◐", label: "In progress", complete: false, applicable: true,  color: BRAND.blue, bg: "#E3EEF8" },
  done:      { icon: "✓", label: "Done",        complete: true,  applicable: true,  color: "#2F855A", bg: "#E2F2E9" },
  validated: { icon: "✓", label: "Validated",   complete: true,  applicable: true,  badge: true, color: "#2B6CB0", bg: "#E3EEF8" },
  skipped:   { icon: "⊘", label: "Skipped",     complete: false, applicable: false, color: BRAND.red, bg: "#FBE3E3" },
  na:        { icon: "—", label: "N/A",         complete: false, applicable: false, color: "#8A93A3", bg: "#F0F2F6" },
};

export const OPP_TYPES = [
  { id: "expansion", label: "Expansion / more work" },
  { id: "referrals", label: "Referrals" },
  { id: "cosell", label: "Co-sell / partnership" },
  { id: "ssl_ip", label: "Build IP for SSL" },
];
export const BILLING = [
  { id: "billable", label: "Billable" },
  { id: "internal", label: "Internal (SSL side project)" },
];
export const LOAD = [
  { id: "lead", label: "Lead", weight: 3, dots: "●●●" },
  { id: "core", label: "Core", weight: 2, dots: "●●" },
  { id: "light", label: "Light", weight: 1, dots: "●" },
];

export const uid = () => Math.random().toString(36).slice(2, 10);
export const loadWeight = (id: string) => LOAD.find((l) => l.id === id)?.weight ?? 0;
export const formatMoney = (n: number | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
export const contractLabel = (c: Pick<Client, "billing" | "contractValue">) => {
  if (c.billing === "internal") return "Internal / non-billable";
  if (c.contractValue == null) return "—";
  return formatMoney(c.contractValue);
};

export function defaultProcessForEntry(entryPoint: Client["entryPoint"]): Record<string, StepInstance> {
  const idx = entryPoint?.mode === "mid-build" && entryPoint.atStep
    ? ALL_STEPS.findIndex((s) => s.id === entryPoint.atStep) : 0;
  const cut = idx < 0 ? 0 : idx;
  const out: Record<string, StepInstance> = {};
  ALL_STEPS.forEach((s, i) => { out[s.id] = { status: i < cut ? "validated" : "todo", note: "", decisions: [] }; });
  return out;
}

export function normalizeClient(c: Partial<Client> & { name?: string }): Client {
  const entryPoint = c.entryPoint?.mode
    ? { mode: c.entryPoint.mode, atStep: c.entryPoint.atStep ?? null }
    : { mode: "greenfield" as const, atStep: null };
  const base = c.process ? {} : defaultProcessForEntry(entryPoint);
  const process: Record<string, StepInstance> = { ...base };
  ALL_STEPS.forEach((s) => {
    const prev = c.process?.[s.id] || process[s.id];
    process[s.id] = {
      status: (prev?.status as Status) || "todo",
      note: prev?.note || "",
      decisions: Array.isArray(prev?.decisions) ? prev!.decisions : [],
    };
  });
  return {
    id: c.id || uid(),
    name: c.name || "",
    summary: c.summary || "",
    start: c.start || "",
    end: c.end || "",
    phase: c.phase || "Discover",
    status: c.status || "On Track",
    billing: c.billing || "billable",
    opportunity: { types: c.opportunity?.types ?? [], note: c.opportunity?.note || "" },
    contractValue: c.contractValue ?? null,
    buildUrl: c.buildUrl || "",
    assignments: (c.assignments ?? []).map((a) => ({ name: a.name || "", role: a.role || "", load: a.load || "core" })),
    risks: c.risks ?? [],
    needs: c.needs ?? [],
    findings: c.findings ?? [],
    links: c.links ?? [],
    entryPoint,
    process,
    updatedAt: c.updatedAt || Date.now(),
  };
}

export function phaseRollup(client: Client, phaseKey: string) {
  const phase = PROCESS.find((p) => p.key === phaseKey);
  const steps = phase ? phase.steps : [];
  let done = 0, skipped = 0, na = 0;
  steps.forEach((s) => {
    const st = client.process?.[s.id]?.status || "todo";
    if (st === "skipped") skipped++;
    else if (st === "na") na++;
    else if (STATUS_META[st]?.complete) done++;
  });
  const applicable = steps.length - skipped - na;
  return { done, skipped, na, applicable, total: steps.length, complete: done === applicable };
}

export function clientProgress(client: Client) {
  let done = 0, applicable = 0;
  ALL_STEPS.forEach((s) => {
    const st = client.process?.[s.id]?.status || "todo";
    if (st === "skipped" || st === "na") return;
    applicable++;
    if (STATUS_META[st]?.complete) done++;
  });
  return { done, applicable, pct: applicable === 0 ? 0 : Math.round((done / applicable) * 100) };
}

export function skippedItems(client: Client) {
  return ALL_STEPS.filter((s) => { const st = client.process?.[s.id]?.status; return st === "skipped" || st === "na"; })
    .map((s) => ({ id: s.id, phaseLabel: s.phaseLabel, stepLabel: s.label, status: client.process[s.id].status, note: client.process[s.id].note || "" }));
}

export const CAPACITY = 5;
export function resourceRows(clients: Client[]) {
  const byName = new Map<string, { name: string; weight: number; assignments: { client: string; role: string; load: string; phase: string; status: string }[] }>();
  clients.forEach((c) => {
    (c.assignments || []).forEach((a) => {
      if (!a.name) return;
      if (!byName.has(a.name)) byName.set(a.name, { name: a.name, weight: 0, assignments: [] });
      const row = byName.get(a.name)!;
      row.weight += loadWeight(a.load);
      row.assignments.push({ client: c.name, role: a.role || "", load: a.load || "core", phase: c.phase, status: c.status });
    });
  });
  return [...byName.values()].map((r) => ({ ...r, over: r.weight > CAPACITY })).sort((a, b) => b.weight - a.weight);
}
