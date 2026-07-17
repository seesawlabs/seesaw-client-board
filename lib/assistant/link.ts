/**
 * Server-side link ingestion: fetch a pasted URL and pull out readable text
 * so the assistant can reason over it. No client import — used only by the
 * readLink tool.
 */
export function extractReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchLinkText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 SeeSawBoard" } });
  if (!res.ok) return `error: could not fetch ${url} (${res.status})`;
  const html = await res.text();
  return extractReadableText(html).slice(0, 8000);
}
