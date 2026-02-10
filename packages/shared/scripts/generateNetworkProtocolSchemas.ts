import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { networkProtocolSchemasV1 } from "../src/networkProtocol.js";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(THIS_DIR, "..", "schemas", "network-protocol", "v1");

function stableJson(value: unknown): string {
  return `${JSON.stringify(value, sortKeys, 2)}\n`;
}

function sortKeys(_key: string, value: unknown): unknown {
  if (Array.isArray(value)) {
    return value;
  }

  if (value !== null && typeof value === "object") {
    const sortedEntries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return Object.fromEntries(sortedEntries);
  }

  return value;
}

mkdirSync(OUTPUT_DIR, { recursive: true });

writeFileSync(
  join(OUTPUT_DIR, "protocol.json"),
  stableJson({
    protocolVersion: networkProtocolSchemasV1.protocolVersion,
    generatedAt: "static",
    files: ["client-to-server.schema.json", "server-to-client.schema.json"],
  })
);

writeFileSync(
  join(OUTPUT_DIR, "client-to-server.schema.json"),
  stableJson(networkProtocolSchemasV1.clientToServerSchema)
);
writeFileSync(
  join(OUTPUT_DIR, "server-to-client.schema.json"),
  stableJson(networkProtocolSchemasV1.serverToClientSchema)
);

