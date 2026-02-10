import { describe, expect, it } from "vitest";
import {
  CONTRACT_SCHEMA_DIR,
  CONTRACT_SOURCE_FILE,
  evaluateProtocolVersionPolicy,
  extractNetworkProtocolVersion,
} from "../scripts/protocolVersionGuard.js";

describe("evaluateProtocolVersionPolicy", () => {
  it("fails when contract changed and protocol version is unchanged", () => {
    const result = evaluateProtocolVersionPolicy({
      changedFiles: [CONTRACT_SOURCE_FILE],
      baseVersion: "1.0.0",
      headVersion: "1.0.0",
    });

    expect(result.shouldFail).toBe(true);
    expect(result.reason).toBe(
      "Protocol contract changed but NETWORK_PROTOCOL_VERSION was not bumped."
    );
  });

  it("passes when contract changed and protocol version changed", () => {
    const result = evaluateProtocolVersionPolicy({
      changedFiles: [`${CONTRACT_SCHEMA_DIR}v1/server-to-client.schema.json`],
      baseVersion: "1.0.0",
      headVersion: "1.1.0",
    });

    expect(result.shouldFail).toBe(false);
  });

  it("passes when no protocol contract files changed", () => {
    const result = evaluateProtocolVersionPolicy({
      changedFiles: ["packages/shared/src/hex.ts"],
      baseVersion: "1.0.0",
      headVersion: "1.0.0",
    });

    expect(result.shouldFail).toBe(false);
  });
});

describe("extractNetworkProtocolVersion", () => {
  it("resolves aliased NETWORK_PROTOCOL_VERSION constants", () => {
    const source = `
      export const NETWORK_PROTOCOL_VERSION_2 = "2.0.0" as const;
      export const NETWORK_PROTOCOL_VERSION = NETWORK_PROTOCOL_VERSION_2;
    `;

    expect(extractNetworkProtocolVersion(source)).toBe("2.0.0");
  });
});

