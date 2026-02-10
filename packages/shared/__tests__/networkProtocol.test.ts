import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CLIENT_MESSAGE_ACTION,
  NETWORK_PROTOCOL_VERSION,
  PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD,
  PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION,
  SERVER_MESSAGE_STATE_UPDATE,
  networkProtocolSchemasV1,
  parseClientMessage,
  parseServerMessage,
} from "../src/networkProtocol.js";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));

describe("network protocol parser", () => {
  it("parses valid action messages", () => {
    const parsed = parseClientMessage({
      protocolVersion: NETWORK_PROTOCOL_VERSION,
      type: CLIENT_MESSAGE_ACTION,
      action: {
        type: "end_turn",
      },
    });

    expect(parsed.ok).toBe(true);
  });

  it("rejects action messages with missing action type", () => {
    const parsed = parseClientMessage({
      protocolVersion: NETWORK_PROTOCOL_VERSION,
      type: CLIENT_MESSAGE_ACTION,
      action: {},
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe(PROTOCOL_PARSE_ERROR_INVALID_PAYLOAD);
    }
  });

  it("rejects unsupported protocol versions", () => {
    const parsed = parseClientMessage({
      protocolVersion: "9.9.9",
      type: CLIENT_MESSAGE_ACTION,
      action: { type: "end_turn" },
    });

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.error.code).toBe(PROTOCOL_PARSE_ERROR_UNSUPPORTED_VERSION);
    }
  });

  it("parses valid server state updates", () => {
    const parsed = parseServerMessage({
      protocolVersion: NETWORK_PROTOCOL_VERSION,
      type: SERVER_MESSAGE_STATE_UPDATE,
      events: [],
      state: {},
    });

    expect(parsed.ok).toBe(true);
  });
});

describe("network protocol schemas", () => {
  it("matches committed generated schema artifacts", () => {
    const schemaDir = join(TEST_DIR, "..", "schemas", "network-protocol", "v1");
    const clientSchema = JSON.parse(
      readFileSync(join(schemaDir, "client-to-server.schema.json"), "utf8")
    ) as unknown;
    const serverSchema = JSON.parse(
      readFileSync(join(schemaDir, "server-to-client.schema.json"), "utf8")
    ) as unknown;

    expect(clientSchema).toEqual(networkProtocolSchemasV1.clientToServerSchema);
    expect(serverSchema).toEqual(networkProtocolSchemasV1.serverToClientSchema);
  });
});

