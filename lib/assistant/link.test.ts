import { describe, it, expect } from "vitest";
import { extractReadableText } from "./link";
describe("extractReadableText", () => {
  it("strips scripts/tags and collapses whitespace", () => {
    const html = "<html><head><script>x=1</script><style>a{}</style></head><body><h1>Hi</h1><p>Call notes:\n\n  HIPAA   ok</p></body></html>";
    const t = extractReadableText(html);
    expect(t).toContain("Hi");
    expect(t).toContain("Call notes: HIPAA ok");
    expect(t).not.toContain("x=1");
    expect(t).not.toContain("<");
  });
});
