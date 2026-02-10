/**
 * Schema Entry Point
 *
 * Re-exports the types used for JSON Schema generation.
 * This file exists to provide a clean entry point for ts-json-schema-generator
 * that avoids runtime code patterns (array spreads, re-exports of const arrays)
 * which the generator cannot handle.
 *
 * DO NOT import this file from application code. It is only used by
 * scripts/generateDeepSchemas.ts.
 */

export type { PlayerAction } from "./actions.js";
export type { GameEvent } from "./events/index.js";
export type { ClientGameState } from "./types/clientState.js";
