import { describe, expect, it } from "vitest";
import { describeControlPlane } from "./index.js";

describe("control-plane", () => {
  it("is tenant-aware from day one", () => {
    expect(describeControlPlane()).toContain("local");
  });
});
