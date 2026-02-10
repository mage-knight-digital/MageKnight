/**
 * Deep Schema Generation Script
 *
 * Uses typescript-json-schema to extract JSON Schemas from TypeScript types.
 * Generates deep payload schemas for PlayerAction, GameEvent, and ClientGameState.
 *
 * These schemas are consumed by external clients (Python SDK, RL harnesses)
 * and referenced by the envelope schemas via $ref.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as TJS from "typescript-json-schema";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const SHARED_ROOT = join(THIS_DIR, "..");
const OUTPUT_DIR = join(SHARED_ROOT, "schemas", "network-protocol", "v1");
const TSCONFIG_PATH = join(SHARED_ROOT, "tsconfig.json");
const SCHEMA_ENTRY = join(SHARED_ROOT, "src", "schemaTypes.ts");

interface SchemaTarget {
  type: string;
  outputFile: string;
  schemaId: string;
}

const SCHEMA_BASE_ID = "https://mageknight.digital/schemas/network-protocol/v1";

const TARGETS: readonly SchemaTarget[] = [
  {
    type: "PlayerAction",
    outputFile: "player-action.schema.json",
    schemaId: `${SCHEMA_BASE_ID}/player-action.schema.json`,
  },
  {
    type: "GameEvent",
    outputFile: "game-event.schema.json",
    schemaId: `${SCHEMA_BASE_ID}/game-event.schema.json`,
  },
  {
    type: "ClientGameState",
    outputFile: "client-game-state.schema.json",
    schemaId: `${SCHEMA_BASE_ID}/client-game-state.schema.json`,
  },
];

const TJS_SETTINGS: TJS.PartialArgs = {
  required: true,
  noExtraProps: true,
  strictNullChecks: true,
  skipLibCheck: true,
  ignoreErrors: true,
};

/**
 * Recursively strips branded type artifacts from the generated schema.
 *
 * TypeScript branded types like `string & { __brand: "CardId" }` generate
 * intersection or allOf schemas. We simplify them to `{ type: "string" }`.
 */
function stripBrandedTypes(schema: unknown): unknown {
  if (schema === null || typeof schema !== "object") {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map(stripBrandedTypes);
  }

  const obj = schema as Record<string, unknown>;

  // Pattern 1: allOf with string + brand object
  if (Array.isArray(obj.allOf)) {
    const parts = obj.allOf as unknown[];
    const stringPart = parts.find(
      (p) => typeof p === "object" && p !== null && (p as Record<string, unknown>).type === "string"
    );
    const brandPart = parts.find((p) => {
      if (typeof p !== "object" || p === null) return false;
      const rec = p as Record<string, unknown>;
      if (typeof rec.properties !== "object" || rec.properties === null) return false;
      return "__brand" in (rec.properties as Record<string, unknown>);
    });
    // Also match $ref to branded definitions
    const refPart = parts.find(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as Record<string, unknown>).$ref === "string"
    );
    if (stringPart && (brandPart || refPart)) {
      const result: Record<string, unknown> = { type: "string" };
      for (const [key, value] of Object.entries(obj)) {
        if (key !== "allOf") {
          result[key] = stripBrandedTypes(value);
        }
      }
      return result;
    }
  }

  // Recurse into all properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = stripBrandedTypes(value);
  }

  return result;
}

/**
 * Clean up definitions: strip branded types from definitions and remove
 * unused brand-only definitions.
 */
function cleanDefinitions(schema: Record<string, unknown>): Record<string, unknown> {
  const definitions = schema.definitions as Record<string, unknown> | undefined;
  if (!definitions) {
    return schema;
  }

  // Strip brands from all definitions
  const cleanedDefs: Record<string, unknown> = {};
  for (const [name, def] of Object.entries(definitions)) {
    cleanedDefs[name] = stripBrandedTypes(def);
  }

  // Identify brand-only definitions (string type with __brand property)
  const brandOnlyDefs = new Set<string>();
  for (const [name, def] of Object.entries(cleanedDefs)) {
    if (typeof def === "object" && def !== null) {
      const d = def as Record<string, unknown>;
      // After stripping, brand defs become just { type: "string" } or have __brand in properties
      if (
        typeof d.properties === "object" &&
        d.properties !== null &&
        "__brand" in (d.properties as Record<string, unknown>)
      ) {
        brandOnlyDefs.add(name);
      }
    }
  }

  // Remove brand-only defs and replace their $refs with { type: "string" }
  for (const brandDef of brandOnlyDefs) {
    delete cleanedDefs[brandDef];
  }

  // Now inline references to removed brand defs
  const result = JSON.parse(JSON.stringify({ ...schema, definitions: cleanedDefs })) as Record<
    string,
    unknown
  >;
  return inlineBrandRefs(result, brandOnlyDefs);
}

/**
 * Replace $refs pointing to removed branded type definitions with { type: "string" }.
 * Handles $ref objects that may contain additional properties (e.g., description).
 */
function inlineBrandRefs(
  schema: unknown,
  brandDefs: Set<string>
): Record<string, unknown> {
  return walkAndInline(schema, brandDefs) as Record<string, unknown>;
}

function walkAndInline(node: unknown, brandDefs: Set<string>): unknown {
  if (node === null || typeof node !== "object") {
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => walkAndInline(item, brandDefs));
  }

  const obj = node as Record<string, unknown>;

  // Check if this object has a $ref to a brand def
  if (typeof obj.$ref === "string") {
    const match = /^#\/definitions\/(.+)$/.exec(obj.$ref);
    if (match && brandDefs.has(match[1])) {
      // Replace with { type: "string" }, preserving non-$ref keys (like description)
      const result: Record<string, unknown> = { type: "string" };
      for (const [key, value] of Object.entries(obj)) {
        if (key !== "$ref") {
          result[key] = walkAndInline(value, brandDefs);
        }
      }
      return result;
    }
  }

  // Recurse into all properties
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = walkAndInline(value, brandDefs);
  }
  return result;
}

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

// Build the program from the schema entry point
console.log("Building TypeScript program...");
const program = TJS.getProgramFromFiles([SCHEMA_ENTRY], {
  target: 9, // ES2022
  module: 99, // ESNext
  moduleResolution: 100, // Bundler
  lib: ["es2022"],
  strict: true,
  esModuleInterop: true,
  skipLibCheck: true,
  exactOptionalPropertyTypes: false, // Relaxed for schema generation
}, SHARED_ROOT);

mkdirSync(OUTPUT_DIR, { recursive: true });

for (const target of TARGETS) {
  console.log(`Generating schema for ${target.type}...`);

  const rawSchema = TJS.generateSchema(program, target.type, TJS_SETTINGS);
  if (!rawSchema) {
    throw new Error(`Failed to generate schema for ${target.type}`);
  }

  // Post-process: strip branded type artifacts and clean definitions
  let schema = stripBrandedTypes(rawSchema) as Record<string, unknown>;
  schema = cleanDefinitions(schema);

  // Set schema metadata
  schema.$id = target.schemaId;
  schema.$schema = "https://json-schema.org/draft-07/schema#";

  writeFileSync(join(OUTPUT_DIR, target.outputFile), stableJson(schema));
  console.log(`  -> ${target.outputFile}`);
}

console.log("Deep schema generation complete.");
