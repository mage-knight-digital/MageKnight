import { describe, expect, it } from "bun:test";
import { assetUrl } from "../src/assets/assetPaths";

describe("assetUrl", () => {
  it("joins a relative path under the default asset root", () => {
    expect(assetUrl("icons/attack.png")).toBe("/assets/icons/attack.png");
  });

  it("ignores a leading slash on the path segment", () => {
    expect(assetUrl("/icons/attack.png")).toBe("/assets/icons/attack.png");
  });

  it("returns the asset root for an empty path", () => {
    expect(assetUrl("")).toBe("/assets");
  });
});
