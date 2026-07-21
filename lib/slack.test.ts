import { describe, it, expect } from "vitest";
import { cleanSlackText, isConversational, renderTranscript } from "./slack";

describe("cleanSlackText", () => {
  it("resolves user mentions from the name map", () => {
    expect(cleanSlackText("hey <@U123> ping", { U123: "Kit" })).toBe("hey @Kit ping");
  });
  it("falls back to the id when the name is unknown", () => {
    expect(cleanSlackText("<@U999> here?")).toBe("@U999 here?");
  });
  it("unwraps links to their label, or the bare url", () => {
    expect(cleanSlackText("see <https://x.com/a|the doc>")).toBe("see the doc");
    expect(cleanSlackText("raw <https://x.com/a>")).toBe("raw https://x.com/a");
  });
  it("decodes slack html entities and channel refs", () => {
    expect(cleanSlackText("a &gt; b &amp; c in <#C1|eng>")).toBe("a > b & c in #eng");
  });
  it("keeps @here/@channel readable", () => {
    expect(cleanSlackText("<!channel> standup")).toBe("@channel standup");
  });
});

describe("isConversational", () => {
  it("keeps real messages", () => {
    expect(isConversational({ ts: "1", user: "U1", text: "shipped it" })).toBe(true);
  });
  it("drops join/leave and empty system messages", () => {
    expect(isConversational({ ts: "1", subtype: "channel_join", text: "joined" })).toBe(false);
    expect(isConversational({ ts: "2", text: "   " })).toBe(false);
  });
});

describe("renderTranscript", () => {
  it("formats author: text lines", () => {
    const t = renderTranscript({
      channelId: "C1", channelName: "eng", latestTs: "2",
      messages: [
        { author: "Kit", text: "blocked on schema", ts: "1" },
        { author: "Calvin", text: "on it", ts: "2" },
      ],
    });
    expect(t).toBe("Kit: blocked on schema\nCalvin: on it");
  });
});
