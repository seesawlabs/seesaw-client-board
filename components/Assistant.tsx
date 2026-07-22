"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/process";
import { ActivityFeed } from "@/components/ActivityFeed";
import type { Activity } from "@/lib/types";

// Global assistant chat panel. Wired to POST /api/assistant (Task 5), which
// expects { messages, turnId } and returns a UI-message stream. `turnId` is a
// stable per-mount id, threaded to the server so tool calls in this session
// can be scoped/logged together.
export function Assistant({
  open,
  onClose,
  activity = [],
}: {
  open: boolean;
  onClose: () => void;
  activity?: Activity[];
}) {
  const router = useRouter();
  const [turnId] = useState(() => Math.random().toString(36).slice(2));
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant", body: { turnId } }),
    onFinish: () => router.refresh(), // board picks up any applied changes
  });
  const [input, setInput] = useState("");
  const [showActivity, setShowActivity] = useState(true);
  if (!open) return null;

  const busy = status === "submitted" || status === "streaming";

  return (
    <div
      className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-xl flex flex-col"
      style={{ borderLeft: `4px solid ${BRAND.navy}` }}
    >
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#E2E6ED" }}>
        <span className="font-semibold" style={{ color: BRAND.navy, fontFamily: "'Bricolage Grotesque', 'Archivo', sans-serif" }}>
          Assistant
        </span>
        <button onClick={onClose} style={{ color: "#66707F" }}>
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-sm" style={{ color: "#8A93A3" }}>
            Paste a transcript or a link, or just tell me what happened on an engagement.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "#8A93A3" }}>
              {m.role}
            </div>
            <div style={{ color: BRAND.ink }}>{renderParts(m.parts)}</div>
          </div>
        ))}
        {busy && (
          <div className="text-xs" style={{ color: "#8A93A3" }}>
            …
          </div>
        )}
        {status === "error" && (
          <div className="text-xs" style={{ color: BRAND.red }}>
            Something went wrong. Try again.
          </div>
        )}
      </div>
      <div className="border-t" style={{ borderColor: "#E2E6ED" }}>
        <button
          onClick={() => setShowActivity((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-[11px] uppercase tracking-wide font-semibold"
          style={{ color: BRAND.navy }}
        >
          <span>Recent activity{activity.filter((a) => a.tool !== "undo").length > 0 ? ` (${activity.filter((a) => a.tool !== "undo").length})` : ""}</span>
          <span>{showActivity ? "▾" : "▸"}</span>
        </button>
        {showActivity && (
          <div className="px-4 pb-3 max-h-56 overflow-y-auto">
            <ActivityFeed activity={activity} />
          </div>
        )}
      </div>
      <form
        className="p-3 border-t flex gap-2"
        style={{ borderColor: "#E2E6ED" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput("");
        }}
      >
        <textarea
          rows={2}
          className="flex-1 border rounded-md px-3 py-2 text-sm"
          style={{ borderColor: "#D3D9E2" }}
          placeholder="What happened? Paste a transcript or a link…"
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).form?.requestSubmit();
            }
          }}
        />
        <button
          className="px-3 rounded-md text-white text-sm font-semibold disabled:opacity-50"
          style={{ background: BRAND.navy }}
          disabled={busy || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

// Renders text parts inline and shows tool-call activity as a compact,
// one-line-per-call trace (v6 typed tool parts: type `tool-<name>`, with
// `.state` in {input-streaming, input-available, output-available,
// output-error} instead of the old generic `tool-invocation`/args/result shape).
function renderParts(parts: UIMessage["parts"]) {
  return parts.map((p, i) => {
    if (p.type === "text") {
      return (
        <span key={i} className="whitespace-pre-wrap">
          {p.text}
        </span>
      );
    }
    if (p.type.startsWith("tool-")) {
      const toolName = p.type.replace("tool-", "");
      const state = "state" in p ? p.state : undefined;
      const label = state === "output-available" ? "done" : state === "output-error" ? "error" : "running";
      return (
        <span key={i} className="block text-[11px]" style={{ color: BRAND.blue }}>
          ▸ {toolName} — {label}
        </span>
      );
    }
    return null;
  });
}
