import { describe, it, expect } from "vitest";
import { driveIdFromUrl } from "./google";

describe("driveIdFromUrl", () => {
  it("extracts the id from a Drive file URL", () => {
    expect(driveIdFromUrl("https://drive.google.com/file/d/1XgAfi-JSghtcpEwLh6k_B6LiDmw0nWob/view?usp=sharing"))
      .toBe("1XgAfi-JSghtcpEwLh6k_B6LiDmw0nWob");
  });
  it("extracts the id from a Docs URL", () => {
    expect(driveIdFromUrl("https://docs.google.com/document/d/1rVfiAO2OZpsQX5dk9CCHLnALcn5geLZUJVsgWR-He3k/edit"))
      .toBe("1rVfiAO2OZpsQX5dk9CCHLnALcn5geLZUJVsgWR-He3k");
  });
  it("passes a bare id through", () => {
    expect(driveIdFromUrl("1RQ9MIKxJFEm5sVsCt9ZoHi9YS0-6vFmI")).toBe("1RQ9MIKxJFEm5sVsCt9ZoHi9YS0-6vFmI");
  });
});
