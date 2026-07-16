import { describe, it, expect } from "vitest";
import { PING } from "./process";
describe("harness", () => { it("runs", () => expect(PING).toBe("ok")); });
