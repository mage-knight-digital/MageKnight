import { afterEach, describe, expect, it } from "bun:test";
import {
  assetUrl,
  getAssetsBaseUrl,
  setAssetsBaseUrlForSession,
} from "../src/assets/assetPaths";

afterEach(() => {
  setAssetsBaseUrlForSession(null);
});

describe("assetUrl", () => {
  it("joins a relative path under the default asset root", () => {
    expect(assetUrl("icons/attack.png")).toBe("/assets/icons/attack.png");
  });

  it("strips a leading slash on the path argument", () => {
    expect(assetUrl("/icons/attack.png")).toBe("/assets/icons/attack.png");
  });

  it("returns the asset root for an empty path", () => {
    expect(assetUrl("")).toBe("/assets");
  });

  it("joins paths under a configured CDN base", () => {
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v2/assets/icons/attack.png"
    );
    expect(getAssetsBaseUrl()).toBe("https://cdn.example.com/mageknight/v2/assets");
  });

  it("resets to default when session override is cleared", () => {
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");
    setAssetsBaseUrlForSession(null);

    expect(assetUrl("icons/attack.png")).toBe("/assets/icons/attack.png");
  });
});
