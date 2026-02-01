/**
 * Tactic Cards Module
 *
 * This module provides all tactic card definitions for the Mage Knight
 * game engine. Each round, players select a tactic card. The number determines
 * turn order (lower = first). Some tactics have special effects.
 *
 * ## Architecture
 *
 * Cards are organized by time of day:
 *
 * | Module | Description |
 * |--------|-------------|
 * | `day/` | Day tactics (1-6) |
 * | `night/` | Night tactics (1-6) |
 *
 * ## Effect types
 *
 * - `none`: No special effect, just determines turn order
 * - `on_pick`: Effect triggers immediately when selecting the tactic
 * - `ongoing`: Effect lasts for the entire round
 * - `activated`: One-time effect that can be used during the round (flip card to use)
 *
 * ## Usage
 *
 * ```typescript
 * import { TACTIC_CARDS, getTacticCard } from "./tactics/index.js";
 *
 * // Get all cards
 * const allCards = Object.values(TACTIC_CARDS);
 *
 * // Get a specific card
 * const earlyBird = getTacticCard(TACTIC_EARLY_BIRD);
 * ```
 *
 * @module data/tactics
 */

// Import all tactic category records
import { DAY_TACTICS } from "./day/index.js";
import { NIGHT_TACTICS } from "./night/index.js";

// Re-export individual card records for direct access
export { DAY_TACTICS } from "./day/index.js";
export { NIGHT_TACTICS } from "./night/index.js";

// Import types
import type { TacticCard, TacticId } from "@mage-knight/shared";

/**
 * Complete record of all tactic cards.
 *
 * This is the aggregate of all time-of-day-based card records, providing
 * a single source of truth for all tactic cards in the game.
 */
export const TACTIC_CARDS = {
  ...DAY_TACTICS,
  ...NIGHT_TACTICS,
} satisfies Record<TacticId, TacticCard>;

/**
 * Retrieves a tactic card by its ID.
 *
 * @param id - The tactic ID to look up
 * @returns The TacticCard definition
 *
 * @example
 * ```typescript
 * const earlyBird = getTacticCard(TACTIC_EARLY_BIRD);
 * console.log(earlyBird.name); // "Early Bird"
 * ```
 */
export function getTacticCard(id: TacticId): TacticCard {
  return TACTIC_CARDS[id];
}

/**
 * Get all tactic cards for a given time of day
 *
 * @param timeOfDay - The time of day to filter by ("day" or "night")
 * @returns Array of tactic cards for that time of day
 */
export function getTacticCardsForTimeOfDay(
  timeOfDay: "day" | "night"
): readonly TacticCard[] {
  return Object.values(TACTIC_CARDS).filter(
    (card) => card.timeOfDay === timeOfDay
  );
}
