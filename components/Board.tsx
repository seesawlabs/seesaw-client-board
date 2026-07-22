"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Board as BoardT, Activity } from "@/lib/types";
import { BRAND, ALL_STEPS } from "@/lib/process";
import { saveStep } from "@/lib/actions";
import { TimelineOverview } from "@/components/TimelineOverview";
import { ResourceView } from "@/components/ResourceView";
import { ClientCard } from "@/components/ClientCard";
import { ClientEditor } from "@/components/ClientEditor";
import { AccountEditor } from "@/components/AccountEditor";
import { StepEditor } from "@/components/StepEditor";
import { OppEditor } from "@/components/OppEditor";
import { Chip, useMounted } from "@/components/ui";
import { Assistant } from "@/components/Assistant";
import { Brief } from "@/components/Brief";
import { GoogleConnect } from "@/components/GoogleConnect";

export function Board({
  initial,
  activity = [],
  google = { configured: false, connected: false, email: "" },
  slack = { configured: false, accountsWired: 0 },
  github = { configured: false, reposWired: 0 },
}: {
  initial: BoardT;
  activity?: Activity[];
  google?: { configured: boolean; connected: boolean; email: string };
  slack?: { configured: boolean; accountsWired: number };
  github?: { configured: boolean; reposWired: number };
}) {
  const router = useRouter();
  const [view, setView] = useState<"client" | "resource">("client");
  const [editingClient, setEditingClient] = useState<string | null>(null); // id | "new" | null
  const [editingAccount, setEditingAccount] = useState<string | null>(null); // account id | null
  const [stepEdit, setStepEdit] = useState<{ clientId: string; stepId: string } | null>(null);
  const [editingOpp, setEditingOpp] = useState<string | null>(null); // id | "new" | null
  const [assistantOpen, setAssistantOpen] = useState(false);
  const mounted = useMounted();
  const { accounts, clients, opportunities } = initial;

  const atRisk = clients.filter((c) => c.status === "At Risk" || c.status === "Blocked").length;
  const openAsks = clients.reduce((n, c) => n + (c.needs?.length || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: BRAND.paper, fontFamily: "'Archivo', system-ui, sans-serif", color: BRAND.ink }}>
      {/* header */}
      <header style={{ background: BRAND.navy }} className="px-6 md:px-10 py-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ color: BRAND.lightBlue }}>
              SeeSaw Labs
            </div>
            <h1 className="text-3xl md:text-4xl text-white" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700 }}>
              Standup board
            </h1>
          </div>
          <div className="flex items-center gap-5 text-sm" style={{ color: BRAND.lightBlue }}>
            <div>
              <span className="text-white font-semibold">{clients.length}</span> active
            </div>
            <div>
              <span className="font-semibold" style={{ color: atRisk ? BRAND.pink : "#fff" }}>
                {atRisk}
              </span>{" "}
              at risk
            </div>
            <div>
              <span className="text-white font-semibold">{openAsks}</span> open asks
            </div>
            <div className="flex rounded-md overflow-hidden border" style={{ borderColor: BRAND.lightBlue }}>
              {([["client", "By client"], ["resource", "By resource"]] as const).map(([id, label]) => (
                <button key={id} onClick={() => setView(id)} className="px-3 py-1.5 text-xs font-semibold"
                  style={{ background: view === id ? "#fff" : "transparent", color: view === id ? BRAND.navy : "#fff" }}>
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => router.refresh()}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border"
              style={{ borderColor: BRAND.lightBlue, color: "#fff" }}
              title="Pull the latest board from the database"
            >
              Refresh
            </button>
            <button
              onClick={() => setAssistantOpen(true)}
              className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: BRAND.red, color: "#fff" }}
              title="Open the assistant"
            >
              Assistant
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        {view === "resource" ? (
          <>
            <h2 className="text-2xl mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
              Team allocation
            </h2>
            <ResourceView clients={clients} />
          </>
        ) : (
          <>
        <GoogleConnect {...google} slack={slack} github={github} />
        <Brief accounts={accounts} clients={clients} activity={activity} />
        <h2 className="text-[13px] uppercase tracking-widest font-bold mb-3" style={{ color: "#A7A399" }}>
          Engagement calendar
        </h2>
        <TimelineOverview clients={clients} />

        <div className="flex items-baseline justify-between mb-4 mt-8">
          <h2 className="text-2xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
            Clients &amp; projects
          </h2>
          <button
            onClick={() => setEditingClient("new")}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white"
            style={{ background: BRAND.red }}
          >
            + Add project
          </button>
        </div>

        <div className="mb-12">
          {editingClient === "new" && (
            <div className="mb-4">
              <ClientEditor
                onSaved={() => { setEditingClient(null); router.refresh(); }}
                onCancel={() => setEditingClient(null)}
              />
            </div>
          )}
          {clients.length === 0 && editingClient !== "new" && (
            <div className="p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
              No projects yet. Add your first one to get the board going.
            </div>
          )}
          {(() => {
            const renderRow = (c: (typeof clients)[number], account: (typeof accounts)[number] | null = null) =>
              editingClient === c.id ? (
                <ClientEditor key={c.id} initial={c} onSaved={() => { setEditingClient(null); router.refresh(); }} onCancel={() => setEditingClient(null)} />
              ) : (
                <ClientCard key={c.id} client={c} account={account} onEdit={() => setEditingClient(c.id)} onStep={(stepId) => setStepEdit({ clientId: c.id, stepId })} />
              );
            const byAccount = new Map<string, typeof clients>();
            const ungrouped: typeof clients = [];
            for (const c of clients) {
              if (c.accountId) { if (!byAccount.has(c.accountId)) byAccount.set(c.accountId, [] as unknown as typeof clients); (byAccount.get(c.accountId) as (typeof clients[number])[]).push(c); }
              else ungrouped.push(c);
            }
            const grouped = accounts.filter((a) => byAccount.has(a.id));
            return (
              <>
                {grouped.map((a) => {
                  const projects = byAccount.get(a.id)!;
                  return (
                    <div key={a.id} className="mb-9">
                      <div className="flex items-baseline gap-3 mb-3 pb-2" style={{ borderBottom: "1px solid #E6E1D7" }}>
                        <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, color: BRAND.navy }}>{a.name}</h3>
                        <span className="text-[11px] uppercase tracking-[0.16em] font-bold" style={{ color: "#A7A399" }}>
                          {projects.length} project{projects.length === 1 ? "" : "s"}
                        </span>
                        {a.driveFolderId && <span className="text-[11px] font-semibold" style={{ color: "#2F7A55" }}>● Drive linked</span>}
                        {(a.slackInternal || a.slackExternal) && <span className="text-[11px] font-semibold" style={{ color: BRAND.blue }}>● Slack</span>}
                        <button
                          onClick={() => setEditingAccount(editingAccount === a.id ? null : a.id)}
                          className="ml-auto text-[11px] font-semibold"
                          style={{ color: "#8A93A3" }}
                          title="Edit this client's Drive folder and Slack channels"
                        >
                          Sources
                        </button>
                      </div>
                      {editingAccount === a.id && (
                        <AccountEditor
                          initial={a}
                          onSaved={() => { setEditingAccount(null); router.refresh(); }}
                          onCancel={() => setEditingAccount(null)}
                        />
                      )}
                      <div className="space-y-4">{projects.map((c) => renderRow(c, a))}</div>
                    </div>
                  );
                })}
                {ungrouped.length > 0 && (
                  <div className="mb-9">
                    {grouped.length > 0 && (
                      <div className="flex items-baseline gap-3 mb-3 pb-2" style={{ borderBottom: "1px solid #E6E1D7" }}>
                        <h3 style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 19, color: "#A7A399" }}>Unassigned</h3>
                      </div>
                    )}
                    <div className="space-y-4">{ungrouped.map((c) => renderRow(c))}</div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
        <div className="flex items-baseline justify-between mb-1">
          <h2 className="text-2xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
            Potential new opportunities
          </h2>
          <button
            onClick={() => setEditingOpp("new")}
            className="px-4 py-2 rounded-md text-sm font-semibold"
            style={{ background: BRAND.pink, color: "#7A2440" }}
          >
            + Add opportunity
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: "#66707F" }}>
          Got experience in one of these industries? Flag it before the pitch — reply in standup or ping the contact.
        </p>

        {editingOpp === "new" && (
          <div className="mb-5">
            <OppEditor
              onSaved={() => { setEditingOpp(null); router.refresh(); }}
              onCancel={() => setEditingOpp(null)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
          {opportunities.length === 0 && editingOpp !== "new" && (
            <div className="md:col-span-2 p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
              Nothing in the pipeline view yet.
            </div>
          )}
          {opportunities.map((o) =>
            editingOpp === o.id ? (
              <div key={o.id} className="md:col-span-2">
                <OppEditor
                  initial={o}
                  onSaved={() => { setEditingOpp(null); router.refresh(); }}
                  onCancel={() => setEditingOpp(null)}
                />
              </div>
            ) : (
              <div key={o.id} className="rounded-lg border bg-white p-5" style={{ borderColor: "#E2E6ED" }}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
                    {o.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: "#EEF1F6", color: BRAND.navy }}>
                    {o.stage}
                  </span>
                </div>
                <div className="mt-1.5">
                  {o.industry && <Chip tone="blue">{o.industry}</Chip>}
                  {o.contact && <Chip tone="navy">{o.contact}</Chip>}
                </div>
                {o.notes && <p className="text-sm mt-2" style={{ color: "#4A5568" }}>{o.notes}</p>}
                {o.expertiseAsk && (
                  <div className="mt-3 p-3 rounded-md text-sm" style={{ background: "#FBEBF0", color: "#7A2440" }}>
                    <span className="font-semibold">Team ask: </span>
                    {o.expertiseAsk}
                  </div>
                )}
                <div className="flex items-center mt-3">
                  <button onClick={() => setEditingOpp(o.id)} className="text-sm font-medium" style={{ color: "#66707F" }}>
                    Edit
                  </button>
                  <span className="ml-auto text-[11px]" style={{ color: "#8A93A3" }} suppressHydrationWarning>
                    {mounted && o.updatedAt ? `Updated ${new Date(o.updatedAt).toLocaleDateString()}` : ""}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
          </>
        )}
      </main>

      {stepEdit && (() => {
        const client = clients.find((c) => c.id === stepEdit.clientId);
        const step = ALL_STEPS.find((s) => s.id === stepEdit.stepId);
        if (!client || !step) return null;
        return (
          <StepEditor
            step={step}
            instance={client.process[step.id]}
            onSaved={async (patch) => { await saveStep(client.id, step.id, patch); setStepEdit(null); router.refresh(); }}
            onClose={() => setStepEdit(null)}
          />
        );
      })()}

      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} activity={activity} />
    </div>
  );
}
