/**
 * Advanced Action Cards Module
 *
 * This module provides all advanced action card definitions for the Mage Knight
 * game engine. Advanced actions are powerful cards acquired during the game
 * from the Advanced Actions offer. Each has a basic effect (top) and powered
 * effect (bottom).
 *
 * ## Architecture
 *
 * Cards are organized into category-based modules by color/type:
 *
 * | Module | Description |
 * |--------|-------------|
 * | `helpers.ts` | Effect factory functions |
 * | `red/` | Aggressive combat, wound-for-power mechanics (includes Fire Bolt) |
 * | `blue/` | Defensive, mana manipulation, terrain (includes Ice Bolt) |
 * | `white/` | Versatile, speed, reputation-positive (includes Swift Bolt) |
 * | `green/` | Healing, movement efficiency, nature (includes Crushing Bolt) |
 * | `dual/` | Multi-color powering flexibility |
 *
 * ## Usage
 *
 * ```typescript
 * import { ADVANCED_ACTION_CARDS, getAdvancedActionCard } from "./advancedActions/index.js";
 *
 * // Get all cards
 * const allCards = Object.values(ADVANCED_ACTION_CARDS);
 *
 * // Get a specific card
 * const bloodRage = getAdvancedActionCard(CARD_BLOOD_RAGE);
 * ```
 *
 * @module data/advancedActions
 */

// Re-export helpers for use in other card definition files
export * from "./helpers.js";

// Import all card category records
import { RED_ADVANCED_ACTIONS } from "./red/index.js";
import { BLUE_ADVANCED_ACTIONS } from "./blue/index.js";
import { WHITE_ADVANCED_ACTIONS } from "./white/index.js";
import { GREEN_ADVANCED_ACTIONS } from "./green/index.js";
import { DUAL_ADVANCED_ACTIONS } from "./dual/index.js";

// Re-export individual card records for direct access
export { RED_ADVANCED_ACTIONS } from "./red/index.js";
export { BLUE_ADVANCED_ACTIONS } from "./blue/index.js";
export { WHITE_ADVANCED_ACTIONS } from "./white/index.js";
export { GREEN_ADVANCED_ACTIONS } from "./green/index.js";
export { DUAL_ADVANCED_ACTIONS } from "./dual/index.js";

// Import types
import type { DeedCard } from "../../types/cards.js";
import type { AdvancedActionCardId } from "@mage-knight/shared";

/**
 * Complete record of all advanced action cards.
 *
 * This is the aggregate of all color-based card records, providing
 * a single source of truth for all advanced action cards in the game.
 */
export const ADVANCED_ACTION_CARDS = {
  ...RED_ADVANCED_ACTIONS,
  ...BLUE_ADVANCED_ACTIONS,
  ...WHITE_ADVANCED_ACTIONS,
  ...GREEN_ADVANCED_ACTIONS,
  ...DUAL_ADVANCED_ACTIONS,
} satisfies Record<AdvancedActionCardId, DeedCard>;

/**
 * Retrieves an advanced action card by its ID.
 *
 * @param id - The card ID to look up
 * @returns The DeedCard definition
 * @throws Error if the card ID is not found
 *
 * @example
 * ```typescript
 * const bloodRage = getAdvancedActionCard(CARD_BLOOD_RAGE);
 * console.log(bloodRage.name); // "Blood Rage"
 * ```
 */
export function getAdvancedActionCard(id: AdvancedActionCardId): DeedCard {
  const card = ADVANCED_ACTION_CARDS[id];
  if (!card) {
    throw new Error(`Unknown advanced action card: ${String(id)}`);
  }
  return card;
}

/**
 * Get all advanced action card IDs.
 *
 * @returns Array of all advanced action card IDs
 */
export function getAllAdvancedActionCardIds(): AdvancedActionCardId[] {
  return Object.keys(ADVANCED_ACTION_CARDS) as AdvancedActionCardId[];
}
