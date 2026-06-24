import { describe, expect, it } from "vitest";
import { describeExtension } from "./index.js";

describe("extension", () => {
  it("describes the shorten-current-tab action", () => {
    expect(describeExtension()).toContain("shorten current tab");
  });
});
