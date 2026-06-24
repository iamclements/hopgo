import { describe, expect, it } from "vitest";
import { DEFAULT_TENANT_ID, PRODUCT_NAME } from "./index.js";

describe("shared", () => {
  it("defaults to the local tenant for the homelab build", () => {
    expect(DEFAULT_TENANT_ID).toBe("local");
  });

  it("exposes the product name", () => {
    expect(PRODUCT_NAME).toBe("Hopgo");
  });
});
