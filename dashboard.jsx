import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────
// SeeSaw Labs — Team Standup Dashboard
// Shared storage: everyone using this artifact sees & edits the
// same data. Swap the hex values below for exact brand codes.
// ─────────────────────────────────────────────────────────────

const BRAND = {
  navy: "#152238",
  red: "#E4413F",
  blue: "#2B6CB0",
  lightBlue: "#A9CCE8",
  pink: "#F2B6C6",
  paper: "#F7F5F1",
  ink: "#1D2733",
};

const PHASES = ["Discover", "Define", "Design", "Develop", "Deploy"];

const STATUS = {
  "On Track": { color: BRAND.blue, bg: "#E3EEF8" },
  "At Risk": { color: "#B7791F", bg: "#FBF0DC" },
  Blocked: { color: BRAND.red, bg: "#FBE3E3" },
  Wrapping: { color: "#2F855A", bg: "#E2F2E9" },
};

const OPP_STAGES = ["Lead", "Scoping", "Proposal", "Verbal", "On Hold"];

const STORAGE_KEY = "ssl-standup-dashboard-v1";

const uid = () => Math.random().toString(36).slice(2, 10);

const seedData = {
  clients: [
    {
      id: uid(),
      name: "Topminnow",
      summary: "ETL pipeline platform — fixed-bid SOW engagement.",
      start: "2026-06-15",
      end: "2026-10-30",
      phase: "Define",
      status: "On Track",
      team: ["Calvin"],
      risks: ["Spec docs and SOW language not fully reconciled yet"],
      needs: ["Second set of eyes on SOW scope language before it goes back to Kit"],
      findings: ["Client contact (Kit) responsive; expects tight scope discipline on fixed-bid"],
      links: [],
      updatedAt: Date.now(),
    },
  ],
  opportunities: [
    {
      id: uid(),
      name: "Healthcare charge capture tool",
      industry: "Healthcare / RCM",
      stage: "Scoping",
      contact: "Joshua Briggs",
      notes:
        "Replacing AlertMD for independent physician groups. Two-phase 5D framing: Discovery & Define, then potential build. Open question: internal tool vs. sellable SaaS.",
      expertiseAsk:
        "Anyone with healthcare, RCM, CPT/ICD-10 coding, or HIPAA/BAA compliance experience?",
      updatedAt: Date.now(),
    },
  ],
};

// ── storage helpers ──────────────────────────────────────────
async function loadData() {
  try {
    const result = await window.storage.get(STORAGE_KEY, true);
    if (result && result.value) return JSON.parse(result.value);
  } catch (e) {
    // key doesn't exist yet — fall through to seed
  }
  return null;
}

async function saveData(data) {
  try {
    await window.storage.set(STORAGE_KEY, JSON.stringify(data), true);
    return true;
  } catch (e) {
    console.error("Save failed", e);
    return false;
  }
}

// ── small building blocks ────────────────────────────────────
const Chip = ({ children, tone = "navy" }) => {
  const tones = {
    navy: { bg: "#E8EDF5", fg: BRAND.navy },
    pink: { bg: "#FBEBF0", fg: "#9B3A5A" },
    blue: { bg: "#E3EEF8", fg: BRAND.blue },
  };
  const t = tones[tone] || tones.navy;
  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium mr-1.5 mb-1.5"
      style={{ background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
};

const PhaseTracker = ({ phase }) => {
  const idx = PHASES.indexOf(phase);
  return (
    <div className="flex items-end gap-0" aria-label={`Phase: ${phase}`}>
      {PHASES.map((p, i) => {
        const active = i === idx;
        const done = i < idx;
        return (
          <div key={p} className="flex flex-col items-center" style={{ width: 64 }}>
            <div
              className="w-full flex items-center"
              style={{ height: 18 }}
            >
              <div
                className="flex-1"
                style={{
                  height: 3,
                  background: i === 0 ? "transparent" : done || active ? BRAND.navy : "#D8DDE5",
                }}
              />
              <div
                className="rounded-full flex-shrink-0"
                style={{
                  width: active ? 14 : 9,
                  height: active ? 14 : 9,
                  background: active ? BRAND.red : done ? BRAND.navy : "#D8DDE5",
                  border: active ? `2px solid ${BRAND.navy}` : "none",
                  transition: "all 150ms",
                }}
              />
              <div
                className="flex-1"
                style={{
                  height: 3,
                  background: i === PHASES.length - 1 ? "transparent" : done ? BRAND.navy : "#D8DDE5",
                }}
              />
            </div>
            <div
              className="text-[10px] mt-1 tracking-wide"
              style={{
                color: active ? BRAND.navy : "#8A93A3",
                fontWeight: active ? 700 : 500,
              }}
            >
              {p}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TimeBar = ({ start, end }) => {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  if (isNaN(s) || isNaN(e) || e <= s) return null;
  const pct = Math.min(100, Math.max(0, ((now - s) / (e - s)) * 100));
  const weeksTotal = Math.round((e - s) / (7 * 864e5));
  const weeksLeft = Math.max(0, Math.round((e - now) / (7 * 864e5)));
  const fmt = (d) =>
    new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return (
    <div className="mt-1">
      <div className="flex justify-between text-[11px]" style={{ color: "#66707F" }}>
        <span>{fmt(start)}</span>
        <span>
          {weeksLeft} of {weeksTotal} wks left
        </span>
        <span>{fmt(end)}</span>
      </div>
      <div className="h-1.5 rounded-full mt-0.5" style={{ background: "#E4E8EE" }}>
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${pct}%`, background: BRAND.lightBlue }}
        />
      </div>
    </div>
  );
};

// ── portfolio timeline (all engagements on one calendar) ─────
const TimelineOverview = ({ clients, onSelect }) => {
  const rows = clients.filter((c) => {
    const s = new Date(c.start).getTime();
    const e = new Date(c.end).getTime();
    return c.start && c.end && !isNaN(s) && !isNaN(e) && e > s;
  });
  if (rows.length === 0) {
    return (
      <div className="p-6 rounded-lg border border-dashed text-center text-sm mb-10" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
        Add start and end dates to engagements to see them on the calendar.
      </div>
    );
  }

  // Range: pad to full months around earliest start / latest end
  const minStart = Math.min(...rows.map((c) => new Date(c.start).getTime()));
  const maxEnd = Math.max(...rows.map((c) => new Date(c.end).getTime()));
  const rangeStart = new Date(minStart);
  rangeStart.setDate(1);
  const rangeEnd = new Date(maxEnd);
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 1);
  const t0 = rangeStart.getTime();
  const t1 = rangeEnd.getTime();
  const span = t1 - t0;
  const pct = (t) => Math.min(100, Math.max(0, ((t - t0) / span) * 100));

  // Month ticks
  const months = [];
  const cur = new Date(rangeStart);
  while (cur.getTime() < t1) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const now = Date.now();
  const showToday = now >= t0 && now <= t1;
  const LABEL_W = 130;

  return (
    <div className="rounded-lg border bg-white p-5 mb-10 overflow-x-auto" style={{ borderColor: "#E2E6ED" }}>
      <div style={{ minWidth: 560 }}>
        {/* month header */}
        <div className="flex">
          <div style={{ width: LABEL_W }} className="flex-shrink-0" />
          <div className="relative flex-1" style={{ height: 22 }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 text-[10px] uppercase tracking-wider font-semibold pl-1.5"
                style={{ left: `${pct(m.getTime())}%`, color: "#8A93A3", borderLeft: "1px solid #E4E8EE", height: "100%" }}
              >
                {m.toLocaleDateString(undefined, { month: "short" })}
                {m.getMonth() === 0 || i === 0 ? ` ’${String(m.getFullYear()).slice(2)}` : ""}
              </div>
            ))}
          </div>
        </div>

        {/* rows */}
        <div className="relative">
          {/* month gridlines behind rows */}
          <div className="absolute inset-0 flex pointer-events-none">
            <div style={{ width: LABEL_W }} className="flex-shrink-0" />
            <div className="relative flex-1">
              {months.map((m, i) => (
                <div key={i} className="absolute top-0 bottom-0" style={{ left: `${pct(m.getTime())}%`, borderLeft: "1px solid #F0F2F6" }} />
              ))}
              {showToday && (
                <div className="absolute top-0 bottom-0" style={{ left: `${pct(now)}%`, borderLeft: `2px solid ${BRAND.red}` }}>
                  <div
                    className="absolute -top-0.5 text-[9px] font-bold uppercase tracking-wider px-1 rounded-sm"
                    style={{ background: BRAND.red, color: "#fff", transform: "translateX(-50%)" }}
                  >
                    Today
                  </div>
                </div>
              )}
            </div>
          </div>

          {rows.map((c) => {
            const s = new Date(c.start).getTime();
            const e = new Date(c.end).getTime();
            const st = STATUS[c.status] || STATUS["On Track"];
            const left = pct(s);
            const width = Math.max(1.5, pct(e) - left);
            const done = now > e;
            return (
              <div key={c.id} className="flex items-center relative" style={{ height: 34 }}>
                <div
                  className="flex-shrink-0 pr-3 text-sm font-semibold truncate text-right"
                  style={{ width: LABEL_W, color: BRAND.navy }}
                  title={c.name}
                >
                  {c.name}
                </div>
                <div className="relative flex-1 h-full">
                  <button
                    onClick={() => onSelect && onSelect(c.id)}
                    className="absolute rounded-md text-left focus:outline-none focus:ring-2"
                    title={`${c.name}: ${c.start} → ${c.end} (${c.status})`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      top: 7,
                      height: 20,
                      background: done ? "#D8DDE5" : st.color,
                      opacity: done ? 0.9 : 1,
                    }}
                  >
                    <span className="text-[10px] font-semibold text-white pl-1.5 whitespace-nowrap overflow-hidden block" style={{ lineHeight: "20px" }}>
                      {c.phase}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* legend */}
        <div className="flex flex-wrap gap-4 mt-3 pt-3 border-t" style={{ borderColor: "#EDF0F4" }}>
          {Object.entries(STATUS).map(([name, s]) => (
            <div key={name} className="flex items-center gap-1.5 text-[11px]" style={{ color: "#66707F" }}>
              <span className="inline-block w-3 h-3 rounded-sm" style={{ background: s.color }} />
              {name}
            </div>
          ))}
          <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "#66707F" }}>
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#D8DDE5" }} />
            Completed
          </div>
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block mb-3">
    <div
      className="text-[11px] uppercase tracking-widest mb-1 font-semibold"
      style={{ color: "#66707F" }}
    >
      {label}
    </div>
    {children}
  </label>
);

const inputCls =
  "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2";
const inputStyle = { borderColor: "#D3D9E2", background: "#fff", color: BRAND.ink };

const ListBlock = ({ title, items, accent }) =>
  items && items.length > 0 ? (
    <div className="mb-3">
      <div
        className="text-[11px] uppercase tracking-widest font-semibold mb-1"
        style={{ color: accent }}
      >
        {title}
      </div>
      <ul className="text-sm space-y-1" style={{ color: BRAND.ink }}>
        {items.map((t, i) => (
          <li key={i} className="flex gap-2">
            <span style={{ color: accent }}>—</span>
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

// ── client editor ────────────────────────────────────────────
function ClientEditor({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    summary: initial?.summary || "",
    start: initial?.start || "",
    end: initial?.end || "",
    phase: initial?.phase || "Discover",
    status: initial?.status || "On Track",
    team: (initial?.team || []).join(", "),
    risks: (initial?.risks || []).join("\n"),
    needs: (initial?.needs || []).join("\n"),
    findings: (initial?.findings || []).join("\n"),
    links: (initial?.links || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  const submit = () => {
    if (!f.name.trim()) return;
    onSave({
      id: initial?.id || uid(),
      name: f.name.trim(),
      summary: f.summary.trim(),
      start: f.start,
      end: f.end,
      phase: f.phase,
      status: f.status,
      team: f.team.split(",").map((x) => x.trim()).filter(Boolean),
      risks: lines(f.risks),
      needs: lines(f.needs),
      findings: lines(f.findings),
      links: lines(f.links).map((l) => {
        const [label, url] = l.split("|").map((x) => x.trim());
        return { label: label || url, url: url || label };
      }),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="p-5 rounded-lg border" style={{ background: "#fff", borderColor: BRAND.navy }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Client name">
          <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} placeholder="Acme Co" />
        </Field>
        <Field label="One-line summary">
          <input className={inputCls} style={inputStyle} value={f.summary} onChange={set("summary")} placeholder="What we're building, in one line" />
        </Field>
        <Field label="Start date">
          <input type="date" className={inputCls} style={inputStyle} value={f.start} onChange={set("start")} />
        </Field>
        <Field label="End date">
          <input type="date" className={inputCls} style={inputStyle} value={f.end} onChange={set("end")} />
        </Field>
        <Field label="5D phase">
          <select className={inputCls} style={inputStyle} value={f.phase} onChange={set("phase")}>
            {PHASES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={inputCls} style={inputStyle} value={f.status} onChange={set("status")}>
            {Object.keys(STATUS).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Team (comma-separated)">
        <input className={inputCls} style={inputStyle} value={f.team} onChange={set("team")} placeholder="Calvin, Tyler, …" />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-5">
        <Field label="Risks (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.risks} onChange={set("risks")} />
        </Field>
        <Field label="Needs / asks (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.needs} onChange={set("needs")} />
        </Field>
        <Field label="Key findings (one per line)">
          <textarea rows={3} className={inputCls} style={inputStyle} value={f.findings} onChange={set("findings")} />
        </Field>
      </div>
      <Field label="Links — one per line, as: Label | https://url">
        <textarea rows={2} className={inputCls} style={inputStyle} value={f.links} onChange={set("links")} placeholder="Staging demo | https://…" />
      </Field>
      <div className="flex items-center gap-3 mt-2">
        <button
          onClick={submit}
          className="px-4 py-2 rounded-md text-sm font-semibold text-white"
          style={{ background: BRAND.navy }}
        >
          Save engagement
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
          Cancel
        </button>
        {initial && onDelete && (
          <button
            onClick={() => onDelete(initial.id)}
            className="ml-auto px-3 py-2 rounded-md text-sm font-medium"
            style={{ color: BRAND.red }}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── opportunity editor ───────────────────────────────────────
function OppEditor({ initial, onSave, onCancel, onDelete }) {
  const [f, setF] = useState({
    name: initial?.name || "",
    industry: initial?.industry || "",
    stage: initial?.stage || "Lead",
    contact: initial?.contact || "",
    notes: initial?.notes || "",
    expertiseAsk: initial?.expertiseAsk || "",
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = () => {
    if (!f.name.trim()) return;
    onSave({
      id: initial?.id || uid(),
      ...f,
      name: f.name.trim(),
      updatedAt: Date.now(),
    });
  };
  return (
    <div className="p-5 rounded-lg border" style={{ background: "#fff", borderColor: BRAND.navy }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        <Field label="Opportunity">
          <input className={inputCls} style={inputStyle} value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Industry">
          <input className={inputCls} style={inputStyle} value={f.industry} onChange={set("industry")} placeholder="Healthcare, fintech, logistics…" />
        </Field>
        <Field label="Stage">
          <select className={inputCls} style={inputStyle} value={f.stage} onChange={set("stage")}>
            {OPP_STAGES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Contact / owner">
          <input className={inputCls} style={inputStyle} value={f.contact} onChange={set("contact")} />
        </Field>
      </div>
      <Field label="Notes">
        <textarea rows={3} className={inputCls} style={inputStyle} value={f.notes} onChange={set("notes")} />
      </Field>
      <Field label="Experience we're looking for (the ask to the team)">
        <textarea rows={2} className={inputCls} style={inputStyle} value={f.expertiseAsk} onChange={set("expertiseAsk")} placeholder="Anyone worked in this industry before?" />
      </Field>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={submit} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.navy }}>
          Save opportunity
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "#66707F" }}>
          Cancel
        </button>
        {initial && onDelete && (
          <button onClick={() => onDelete(initial.id)} className="ml-auto px-3 py-2 rounded-md text-sm font-medium" style={{ color: BRAND.red }}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── main ─────────────────────────────────────────────────────
export default function SSLStandupDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [editingClient, setEditingClient] = useState(null); // id | "new" | null
  const [editingOpp, setEditingOpp] = useState(null);
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    (async () => {
      const stored = await loadData();
      setData(stored || seedData);
      setLoading(false);
      if (!stored) saveData(seedData);
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setData(next);
    setSaveState("saving");
    const ok = await saveData(next);
    setSaveState(ok ? "saved" : "error");
    setTimeout(() => setSaveState("idle"), 2000);
  }, []);

  const refresh = async () => {
    setLoading(true);
    const stored = await loadData();
    if (stored) setData(stored);
    setLoading(false);
  };

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: BRAND.paper }}>
        <div className="text-sm tracking-widest uppercase" style={{ color: BRAND.navy, fontFamily: "'Archivo', sans-serif" }}>
          Loading the board…
        </div>
      </div>
    );
  }

  const saveClient = (c) => {
    const exists = data.clients.some((x) => x.id === c.id);
    const clients = exists
      ? data.clients.map((x) => (x.id === c.id ? c : x))
      : [c, ...data.clients];
    persist({ ...data, clients });
    setEditingClient(null);
  };
  const deleteClient = (id) => {
    persist({ ...data, clients: data.clients.filter((x) => x.id !== id) });
    setEditingClient(null);
  };
  const saveOpp = (o) => {
    const exists = data.opportunities.some((x) => x.id === o.id);
    const opportunities = exists
      ? data.opportunities.map((x) => (x.id === o.id ? o : x))
      : [o, ...data.opportunities];
    persist({ ...data, opportunities });
    setEditingOpp(null);
  };
  const deleteOpp = (id) => {
    persist({ ...data, opportunities: data.opportunities.filter((x) => x.id !== id) });
    setEditingOpp(null);
  };

  const atRisk = data.clients.filter((c) => c.status === "At Risk" || c.status === "Blocked").length;
  const openAsks = data.clients.reduce((n, c) => n + (c.needs?.length || 0), 0);

  return (
    <div className="min-h-screen" style={{ background: BRAND.paper, fontFamily: "'Archivo', system-ui, sans-serif", color: BRAND.ink }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Archivo:wght@400;500;600;700&display=swap');
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
      `}</style>

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
              <span className="text-white font-semibold">{data.clients.length}</span> active
            </div>
            <div>
              <span className="font-semibold" style={{ color: atRisk ? BRAND.pink : "#fff" }}>{atRisk}</span> at risk
            </div>
            <div>
              <span className="text-white font-semibold">{openAsks}</span> open asks
            </div>
            <button
              onClick={refresh}
              className="px-3 py-1.5 rounded-md text-xs font-semibold border"
              style={{ borderColor: BRAND.lightBlue, color: "#fff" }}
              title="Pull latest edits from teammates"
            >
              Refresh
            </button>
            <span className="text-xs w-14 text-right" style={{ color: BRAND.lightBlue }}>
              {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : saveState === "error" ? "Save failed" : ""}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        {/* ── portfolio timeline ── */}
        <h2 className="text-2xl mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
          Engagement calendar
        </h2>
        <TimelineOverview
          clients={data.clients}
          onSelect={(id) => {
            setExpanded((x) => ({ ...x, [id]: true }));
            const el = document.getElementById(`client-${id}`);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />

        {/* ── active engagements ── */}
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-2xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
            Active engagements
          </h2>
          <button
            onClick={() => setEditingClient("new")}
            className="px-4 py-2 rounded-md text-sm font-semibold text-white"
            style={{ background: BRAND.red }}
          >
            + Add client
          </button>
        </div>

        {editingClient === "new" && (
          <div className="mb-5">
            <ClientEditor onSave={saveClient} onCancel={() => setEditingClient(null)} />
          </div>
        )}

        <div className="space-y-4 mb-12">
          {data.clients.length === 0 && editingClient !== "new" && (
            <div className="p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
              No active engagements yet. Add your first client to get the board going.
            </div>
          )}
          {data.clients.map((c) => {
            if (editingClient === c.id) {
              return (
                <ClientEditor
                  key={c.id}
                  initial={c}
                  onSave={saveClient}
                  onCancel={() => setEditingClient(null)}
                  onDelete={deleteClient}
                />
              );
            }
            const st = STATUS[c.status] || STATUS["On Track"];
            const open = !!expanded[c.id];
            return (
              <div key={c.id} id={`client-${c.id}`} className="rounded-lg overflow-hidden border bg-white" style={{ borderColor: "#E2E6ED", borderLeft: `5px solid ${st.color}` }}>
                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="text-xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>
                          {c.name}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: st.bg, color: st.color }}>
                          {c.status}
                        </span>
                      </div>
                      {c.summary && <p className="text-sm mt-1" style={{ color: "#4A5568" }}>{c.summary}</p>}
                      <div className="mt-2">
                        {c.team.map((t) => (
                          <Chip key={t}>{t}</Chip>
                        ))}
                      </div>
                    </div>
                    <div className="hidden md:block">
                      <PhaseTracker phase={c.phase} />
                    </div>
                  </div>
                  <div className="md:hidden mt-3 overflow-x-auto">
                    <PhaseTracker phase={c.phase} />
                  </div>
                  <TimeBar start={c.start} end={c.end} />
                  <div className="flex items-center gap-4 mt-3">
                    <button onClick={() => setExpanded({ ...expanded, [c.id]: !open })} className="text-sm font-semibold" style={{ color: BRAND.blue }}>
                      {open ? "Hide details" : `Details${(c.risks?.length || 0) + (c.needs?.length || 0) + (c.findings?.length || 0) > 0 ? ` (${(c.risks?.length || 0) + (c.needs?.length || 0)} flags)` : ""}`}
                    </button>
                    <button onClick={() => setEditingClient(c.id)} className="text-sm font-medium" style={{ color: "#66707F" }}>
                      Edit
                    </button>
                    <span className="ml-auto text-[11px]" style={{ color: "#8A93A3" }}>
                      Updated {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  {open && (
                    <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-x-6" style={{ borderColor: "#EDF0F4" }}>
                      <ListBlock title="Risks" items={c.risks} accent={BRAND.red} />
                      <ListBlock title="Needs / asks" items={c.needs} accent="#B7791F" />
                      <ListBlock title="Key findings" items={c.findings} accent={BRAND.blue} />
                      {c.links && c.links.length > 0 && (
                        <div className="md:col-span-3 mt-1">
                          {c.links.map((l, i) => (
                            <a key={i} href={l.url} target="_blank" rel="noreferrer" className="inline-block mr-3 text-sm font-semibold underline" style={{ color: BRAND.blue }}>
                              {l.label} ↗
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── opportunities ── */}
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
            <OppEditor onSave={saveOpp} onCancel={() => setEditingOpp(null)} />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-16">
          {data.opportunities.length === 0 && editingOpp !== "new" && (
            <div className="md:col-span-2 p-8 rounded-lg border border-dashed text-center text-sm" style={{ borderColor: "#C8CFDA", color: "#66707F" }}>
              Nothing in the pipeline view yet.
            </div>
          )}
          {data.opportunities.map((o) =>
            editingOpp === o.id ? (
              <div key={o.id} className="md:col-span-2">
                <OppEditor initial={o} onSave={saveOpp} onCancel={() => setEditingOpp(null)} onDelete={deleteOpp} />
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
                  <span className="ml-auto text-[11px]" style={{ color: "#8A93A3" }}>
                    Updated {new Date(o.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  );
}
