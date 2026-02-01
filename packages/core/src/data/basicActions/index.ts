/**
 * Basic action card definitions for Mage Knight
 *
 * Each hero starts with 16 cards: 14 shared basic actions + 2 hero-specific cards.
 * Cards are organized by their frame color (which indicates what mana powers them).
 *
 * Note: Some effects (like Mana Draw's powered effect) cannot be fully represented
 * with the current effect system and use placeholders.
 */

import type { DeedCard } from "../../types/cards.js";
import type { BasicActionCardId } from "@mage-knight/shared";

// Re-export all color modules
export * from "./red/index.js";
export * from "./blue/index.js";
export * from "./green/index.js";
export * from "./white/index.js";
export * from "./special/index.js";

// Re-export helpers for card implementations
export * from "./helpers.js";

// Import color records for aggregation
import { RED_BASIC_ACTIONS } from "./red/index.js";
import { BLUE_BASIC_ACTIONS } from "./blue/index.js";
import { GREEN_BASIC_ACTIONS } from "./green/index.js";
import { WHITE_BASIC_ACTIONS } from "./white/index.js";
import { SPECIAL_BASIC_ACTIONS } from "./special/index.js";

/**
 * All basic action cards aggregated from color modules
 */
export const BASIC_ACTION_CARDS = {
  ...RED_BASIC_ACTIONS,
  ...BLUE_BASIC_ACTIONS,
  ...GREEN_BASIC_ACTIONS,
  ...WHITE_BASIC_ACTIONS,
  ...SPECIAL_BASIC_ACTIONS,
} satisfies Record<BasicActionCardId, DeedCard>;

/**
 * Helper to get a card by ID
 */
export function getBasicActionCard(id: BasicActionCardId): DeedCard {
  const card = BASIC_ACTION_CARDS[id];
  if (!card) {
    throw new Error(`Unknown basic action card: ${String(id)}`);
  }
  return card;
}
