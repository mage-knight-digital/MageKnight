/**
 * Site Events
 *
 * Events related to site interactions: conquest, exploration, rewards,
 * and special site types (glades, mines, villages, etc.).
 *
 * @module events/sites
 *
 * @remarks Site System Overview
 * - **Adventure Sites**: Require combat (keeps, dungeons, tombs, etc.)
 * - **Safe Sites**: No combat (villages, monasteries, etc.)
 * - **Special Sites**: Unique mechanics (magical glades, mines)
 *
 * @example Site Conquest Flow
 * ```
 * SITE_ENTERED (player enters site hex)
 *   |-> If fortified:
 *         |-> ENEMIES_REVEALED (garrison visible)
 *         |-> ENEMIES_DRAWN_FOR_SITE (if dungeon/tomb)
 *   |-> Combat occurs...
 *   |-> SITE_CONQUERED (after victory)
 *         |-> SHIELD_TOKEN_PLACED (marks conquered)
 *         |-> REWARD_QUEUED (pending reward selection)
 *               |-> REWARD_SELECTED (player picks reward)
 * ```
 *
 * @example Village Interaction Flow
 * ```
 * INTERACTION_STARTED (enter village)
 *   |-> HEALING_PURCHASED (if wounds healed)
 *   |-> UNIT_RECRUITED (if unit taken)
 *   |-> INTERACTION_COMPLETED (exit village)
 * ```
 */

// Re-export all site event modules
export * from "./adventure.js";
export * from "./rewards.js";
export * from "./interaction.js";
export * from "./special.js";

// Import constants for the isSiteEvent guard
import {
  SITE_ENTERED,
  ENEMIES_REVEALED,
  ENEMIES_DRAWN_FOR_SITE,
  SITE_CONQUERED,
  SHIELD_TOKEN_PLACED,
} from "./adventure.js";
import { REWARD_QUEUED, REWARD_SELECTED } from "./rewards.js";
import {
  INTERACTION_STARTED,
  HEALING_PURCHASED,
  INTERACTION_COMPLETED,
} from "./interaction.js";
import {
  GLADE_WOUND_DISCARDED,
  GLADE_WOUND_SKIPPED,
  GLADE_MANA_GAINED,
  DEEP_MINE_CRYSTAL_GAINED,
} from "./special.js";

/**
 * Check if an event is any site-related event.
 */
export function isSiteEvent(event: { type: string }): boolean {
  return [
    SITE_CONQUERED,
    SITE_ENTERED,
    ENEMIES_DRAWN_FOR_SITE,
    ENEMIES_REVEALED,
    SHIELD_TOKEN_PLACED,
    REWARD_QUEUED,
    REWARD_SELECTED,
    INTERACTION_STARTED,
    HEALING_PURCHASED,
    INTERACTION_COMPLETED,
    GLADE_WOUND_DISCARDED,
    GLADE_WOUND_SKIPPED,
    GLADE_MANA_GAINED,
    DEEP_MINE_CRYSTAL_GAINED,
  ].includes(event.type as typeof SITE_CONQUERED);
}
