import "dotenv/config";
import { db } from "@/lib/db";
import { clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";

async function main() {
  await db.delete(clients);
  await db.delete(opportunities);

  const topminnow = normalizeClient({
    name: "Topminnow", summary: "ETL pipeline platform — fixed-bid SOW engagement.",
    start: "2026-06-15", end: "2026-10-30", phase: "Define", status: "On Track",
    billing: "billable", opportunity: { types: ["expansion"], note: "Likely phase-2 build after SOW lands." },
    contractValue: 85000, buildUrl: "",
    assignments: [{ name: "Calvin", role: "Eng / Lead", load: "lead" }],
    risks: ["Spec docs and SOW language not fully reconciled yet"],
    needs: ["Second set of eyes on SOW scope language before it goes back to Kit"],
    findings: ["Client contact (Kit) responsive; expects tight scope discipline on fixed-bid"],
    entryPoint: { mode: "greenfield", atStep: null },
  });
  Object.assign(topminnow.process.dsc_rampup, { status: "done" });
  Object.assign(topminnow.process.dsc_stakeholders, { status: "done" });
  Object.assign(topminnow.process.dsc_research, { status: "done" });
  Object.assign(topminnow.process.dsc_competitive, { status: "skipped", note: "Client provided their own market analysis." });
  Object.assign(topminnow.process.dsc_feasibility, { status: "done" });
  Object.assign(topminnow.process.def_metrics, { status: "doing" });
  Object.assign(topminnow.process.def_scope, { status: "doing", decisions: [{ what: "Fixed-bid, not T&M", why: "Client wanted budget certainty; scope well understood." }] });

  const rivet = normalizeClient({
    name: "Rivet Health", summary: "Patient intake tool — picked up mid-build to stabilize and ship.",
    start: "2026-05-01", end: "2026-09-15", phase: "Develop", status: "At Risk",
    billing: "billable", opportunity: { types: ["expansion", "ssl_ip"], note: "Reusable intake engine could become SSL IP." },
    contractValue: 140000, buildUrl: "https://staging.rivethealth.example.com",
    assignments: [{ name: "Tyler", role: "Eng / Lead", load: "lead" }, { name: "Calvin", role: "Architecture", load: "core" }],
    risks: ["Inherited codebase has no tests", "HIPAA posture unverified"],
    needs: ["Security reviewer for the compliance step"],
    findings: ["Prior team shipped UI without a data model review — rework likely"],
    entryPoint: { mode: "mid-build", atStep: "dev_build" },
  });
  Object.assign(rivet.process.dsc_research, { note: "Reviewed prior discovery deck — thin on real user interviews." });
  Object.assign(rivet.process.dev_build, { status: "doing" });
  Object.assign(rivet.process.dev_security, { status: "na", note: "Deferred to a separate compliance SOW — out of scope here." });

  const mk = (c: ReturnType<typeof normalizeClient>) => ({
    name: c.name, summary: c.summary, start: c.start, end: c.end, phase: c.phase, status: c.status,
    billing: c.billing, contractValue: c.contractValue, buildUrl: c.buildUrl,
    opportunity: c.opportunity, assignments: c.assignments, risks: c.risks, needs: c.needs,
    findings: c.findings, links: c.links, entryPoint: c.entryPoint, process: c.process,
  });
  await db.insert(clients).values([mk(topminnow), mk(rivet)]);
  await db.insert(opportunities).values([{
    name: "Healthcare charge capture tool", industry: "Healthcare / RCM", stage: "Scoping",
    contact: "Joshua Briggs",
    notes: "Replacing AlertMD for independent physician groups. Two-phase 5D framing. Open question: internal tool vs. sellable SaaS.",
    expertiseAsk: "Anyone with healthcare, RCM, CPT/ICD-10 coding, or HIPAA/BAA experience?",
  }]);
  console.log("Seeded 2 clients + 1 opportunity.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
