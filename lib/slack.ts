// Minimal Slack Web API client for reading client channels. Auth is a single
// bot token (SLACK_BOT_TOKEN) with channels:history/groups:history + channels:read
// + users:read. We only ever READ — no posting.

const botToken = () => process.env.SLACK_BOT_TOKEN || "";
export const slackConfigured = () => !!botToken();

const API = "https://slack.com/api";

type SlackOk<T> = T & { ok: true };
type SlackResp<T> = (SlackOk<T>) | { ok: false; error: string };

async function slackApi<T>(method: string, params: Record<string, string>): Promise<SlackOk<T>> {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { authorization: `Bearer ${botToken()}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as SlackResp<T>;
  if (!json.ok) throw new Error(`slack ${method} failed: ${json.error}`);
  return json;
}

// ---- pure helpers (unit-tested) -----------------------------------------

/**
 * Turn Slack's mrkdwn into plain readable text: resolve user mentions via the
 * provided id→name map, unwrap links to their label (or bare url), decode the
 * three HTML entities Slack escapes, and drop channel/everyone tokens.
 */
export function cleanSlackText(text: string, names: Record<string, string> = {}): string {
  return (text || "")
    .replace(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g, (_m, id) => `@${names[id] || id}`)
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, (_m, name) => `#${name}`)
    .replace(/<!(?:here|channel|everyone)>/g, (m) => `@${m.slice(2, -1)}`)
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, (_m, _url, label) => label)
    .replace(/<(https?:[^>]+)>/g, (_m, url) => url)
    .replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&amp;/g, "&")
    .trim();
}

// Message subtypes that are channel noise, not conversation.
const SKIP_SUBTYPES = new Set([
  "channel_join", "channel_leave", "channel_topic", "channel_purpose",
  "channel_name", "channel_archive", "channel_unarchive", "bot_add", "bot_remove",
]);

export function isConversational(m: RawMessage): boolean {
  if (m.subtype && SKIP_SUBTYPES.has(m.subtype)) return false;
  return !!(m.text && m.text.trim());
}

// ---- API surface ---------------------------------------------------------

type RawMessage = { type?: string; subtype?: string; user?: string; bot_id?: string; text?: string; ts: string };
export type SlackMessage = { author: string; text: string; ts: string };
export type ChannelRead = { channelId: string; channelName: string; messages: SlackMessage[]; latestTs: string };

async function userNameMap(ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const id of [...new Set(ids)]) {
    try {
      const r = await slackApi<{ user: { real_name?: string; name?: string; profile?: { display_name?: string } } }>(
        "users.info",
        { user: id },
      );
      names[id] = r.user.profile?.display_name || r.user.real_name || r.user.name || id;
    } catch { names[id] = id; }
  }
  return names;
}

async function channelName(channelId: string): Promise<string> {
  try {
    const r = await slackApi<{ channel: { name?: string } }>("conversations.info", { channel: channelId });
    return r.channel.name || channelId;
  } catch { return channelId; }
}

/**
 * Read new messages in a channel since `oldestTs` (exclusive), oldest-first.
 * Paginates up to `maxMessages` so a multi-day gap still catches up, then
 * resolves user ids to names. `latestTs` is the newest ts seen (the next cursor).
 */
export async function readChannel(channelId: string, oldestTs = "0", maxMessages = 400): Promise<ChannelRead> {
  const raw: RawMessage[] = [];
  let cursor: string | undefined;
  do {
    const params: Record<string, string> = { channel: channelId, oldest: oldestTs, limit: "200", inclusive: "false" };
    if (cursor) params.cursor = cursor;
    const r = await slackApi<{ messages: RawMessage[]; response_metadata?: { next_cursor?: string } }>(
      "conversations.history",
      params,
    );
    raw.push(...(r.messages || []));
    cursor = r.response_metadata?.next_cursor || undefined;
  } while (cursor && raw.length < maxMessages);

  // conversations.history returns newest-first; flip to chronological.
  const chrono = raw.filter(isConversational).reverse();
  const latestTs = raw.reduce((max, m) => (Number(m.ts) > Number(max) ? m.ts : max), oldestTs);
  const names = await userNameMap(chrono.map((m) => m.user).filter((u): u is string => !!u));

  const messages: SlackMessage[] = chrono.map((m) => ({
    author: m.user ? names[m.user] || m.user : m.bot_id ? "bot" : "unknown",
    text: cleanSlackText(m.text || "", names),
    ts: m.ts,
  }));
  return { channelId, channelName: await channelName(channelId), messages, latestTs };
}

/** Render a channel read as a transcript block for the agent. */
export function renderTranscript(read: ChannelRead): string {
  return read.messages.map((m) => `${m.author}: ${m.text}`).join("\n");
}
