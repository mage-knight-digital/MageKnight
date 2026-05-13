import { afterEach, describe, expect, it } from "bun:test";
import {
  assetUrl,
  getAssetsBaseUrl,
  setAssetsBaseUrlForSession,
} from "../src/assets/assetPaths";

const originalWindow = globalThis.window;

function restoreWindow(): void {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: Window }).window;
    return;
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: originalWindow,
  });
}

function installBrowserGlobals(search: string = ""): Storage {
  const storedValues = new Map<string, string>();
  const localStorage = {
    get length() {
      return storedValues.size;
    },
    clear() {
      storedValues.clear();
    },
    getItem(key: string) {
      return storedValues.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(storedValues.keys())[index] ?? null;
    },
    removeItem(key: string) {
      storedValues.delete(key);
    },
    setItem(key: string, value: string) {
      storedValues.set(key, value);
    },
  } satisfies Storage;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search },
      localStorage,
    },
  });

  return localStorage;
}

afterEach(() => {
  setAssetsBaseUrlForSession(null);
  restoreWindow();
});

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

  it("joins paths under a configured CDN base", () => {
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v2/assets/icons/attack.png"
    );
    expect(getAssetsBaseUrl()).toBe("https://cdn.example.com/mageknight/v2/assets");
  });

  it("uses a persisted browser override before the configured base", () => {
    const localStorage = installBrowserGlobals();
    localStorage.setItem("mk.assetsBaseUrl", "https://cdn.example.com/mageknight/v3/assets/");
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v3/assets/icons/attack.png"
    );
  });

  it("persists a query param override to localStorage", () => {
    const localStorage = installBrowserGlobals(
      "?assetsBase=https%3A%2F%2Fcdn.example.com%2Fmageknight%2Fv4%2Fassets%2F"
    );

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v4/assets/icons/attack.png"
    );
    expect(localStorage.getItem("mk.assetsBaseUrl")).toBe(
      "https://cdn.example.com/mageknight/v4/assets"
    );
  });

  it("rejects unsafe protocols in query param and falls back to configured base", () => {
    const localStorage = installBrowserGlobals(
      "?assetsBase=javascript%3Aalert(1)"
    );
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v2/assets/icons/attack.png"
    );
    expect(localStorage.getItem("mk.assetsBaseUrl")).toBeNull();
  });

  it("rejects unsafe protocols stored in localStorage", () => {
    const localStorage = installBrowserGlobals();
    localStorage.setItem("mk.assetsBaseUrl", "javascript:alert(1)");
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v2/assets/icons/attack.png"
    );
  });

  it("clears a persisted override when the query param is default", () => {
    const localStorage = installBrowserGlobals("?assetsBase=default");
    localStorage.setItem("mk.assetsBaseUrl", "https://cdn.example.com/mageknight/v4/assets");
    setAssetsBaseUrlForSession("https://cdn.example.com/mageknight/v2/assets/");

    expect(assetUrl("icons/attack.png")).toBe(
      "https://cdn.example.com/mageknight/v2/assets/icons/attack.png"
    );
    expect(localStorage.getItem("mk.assetsBaseUrl")).toBeNull();
  });
});
