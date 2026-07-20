import type { Client } from "@/lib/types";
export function resolveClient(query: string, clients: Client[]) {
  const q = query.toLowerCase();
  const exact = clients.find((c) => c.name && q.includes(c.name.toLowerCase()) && c.name.toLowerCase() === q.trim());
  if (exact) return { id: exact.id, confidence: "exact" as const };
  const nameHits = clients.filter((c) => c.name && q.includes(c.name.toLowerCase()));
  if (nameHits.length === 1) return { id: nameHits[0].id, confidence: "exact" as const };
  const wordHits = clients.filter((c) => c.name && c.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && q.includes(w)));
  if (wordHits.length === 1) return { id: wordHits[0].id, confidence: "partial" as const };
  return null;
}
