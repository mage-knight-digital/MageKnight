import { describe, expect, it } from "bun:test";
import { getRuntimeRustServerUrl } from "../src/runtime/rustServerUrl";

function locationFor(url: string): Location {
  return new URL(url) as unknown as Location;
}

describe("getRuntimeRustServerUrl", () => {
  it("uses localhost for local development", () => {
    expect(
      getRuntimeRustServerUrl(new URLSearchParams(), locationFor("http://localhost:5173"))
    ).toBe("ws://localhost:3030/ws");
  });

  it("uses the api subdomain for deployed play hosts", () => {
    expect(
      getRuntimeRustServerUrl(
        new URLSearchParams(),
        locationFor("https://play.mageknightdigital.app")
      )
    ).toBe("wss://api.mageknightdigital.app/ws");
  });

  it("keeps query param overrides for explicit testing", () => {
    expect(
      getRuntimeRustServerUrl(
        new URLSearchParams("serverUrl=ws%3A%2F%2Fexample.test%2Fws"),
        locationFor("https://play.mageknightdigital.app")
      )
    ).toBe("ws://example.test/ws");
  });
});
