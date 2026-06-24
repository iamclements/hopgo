import { describe, expect, it } from "vitest";
import { describeDataPlane } from "./index.js";

describe("worker", () => {
  it("describes the data plane and links to shared", () => {
    expect(describeDataPlane()).toContain("Hopgo");
  });
});
