import { ingestAll } from "@/lib/assistant/ingest";
import { ingestAllContext } from "@/lib/assistant/context-ingest";
import { ingestAllSlack } from "@/lib/assistant/slack-ingest";
import { ingestAllGithub } from "@/lib/assistant/github-ingest";
import { synthesizeAllBriefs } from "@/lib/assistant/synthesize";
import { getConnection, googleConfigured } from "@/lib/google";
import { slackConfigured } from "@/lib/slack";
import { githubConfigured } from "@/lib/github";

// Nightly morning-brief job: pull every source that's configured, then
// synthesize the per-project prose + attention line. Scheduled in vercel.json.
export const maxDuration = 300;

export async function GET(req: Request) {
  // Vercel Cron sends this header; require it (or a matching secret) so the
  // endpoint can't be triggered by anyone.
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = req.headers.get("x-vercel-cron") === "1";
  if (secret && auth !== `Bearer ${secret}` && !isVercelCron) {
    return new Response("unauthorized", { status: 401 });
  }

  const steps: { source: string; ok: boolean; detail: string }[] = [];
  const run = async (source: string, fn: () => Promise<unknown>) => {
    try { const r = await fn(); steps.push({ source, ok: true, detail: JSON.stringify(r).slice(0, 300) }); }
    catch (e) { steps.push({ source, ok: false, detail: (e as Error).message }); }
  };

  // ingest (best-effort — one source failing must not block the rest or the synthesis)
  const googleReady = googleConfigured() && !!(await getConnection());
  if (googleReady) { await run("standups", ingestAll); await run("docs", ingestAllContext); }
  if (slackConfigured()) await run("slack", ingestAllSlack);
  if (githubConfigured()) await run("github", ingestAllGithub);

  // synthesize the brief from whatever the board now holds
  await run("synthesize", synthesizeAllBriefs);

  return Response.json({ ranAt: new Date().toISOString(), steps });
}
