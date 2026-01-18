/**
 * Mana Events
 *
 * Events related to mana resources: dice from the shared source, crystals,
 * and temporary mana tokens.
 *
 * @module events/mana
 *
 * @remarks Mana System Overview
 * - **Die Pool**: Shared dice (players + 2). Day: gold available, black depleted. Night: reversed.
 * - **Tokens**: Temporary mana from card effects. Returned at end of turn.
 * - **Crystals**: Permanent storage (max 3 per color). Can convert to/from tokens.
 *
 * @example Mana Flow
 * ```
 * From Source (Die Pool):
 *   MANA_DIE_TAKEN (player claims a die)
 *     |-> Die becomes token for player
 *   MANA_DIE_RETURNED (at round end)
 *     |-> Die goes back to source, gets new color
 *
 * Using Mana:
 *   MANA_DIE_USED (token from die spent)
 *   MANA_TOKEN_USED (temporary token spent)
 *   CRYSTAL_USED (crystal consumed for mana)
 *
 * Crystals:
 *   CRYSTAL_GAINED (from effects or sites)
 *   CRYSTAL_CONVERTED (token -> crystal for storage)
 * ```
 */

// Re-export all mana event modules
export * from "./dice.js";
export * from "./tokens.js";
export * from "./crystals.js";

// Import constants for the isManaEvent guard
import { MANA_DIE_TAKEN, MANA_DIE_RETURNED, MANA_DIE_USED } from "./dice.js";
import { MANA_TOKEN_USED } from "./tokens.js";
import { CRYSTAL_GAINED, CRYSTAL_USED, CRYSTAL_CONVERTED } from "./crystals.js";

/**
 * Check if an event is any mana-related event.
 */
export function isManaEvent(event: { type: string }): boolean {
  return [
    MANA_DIE_TAKEN,
    MANA_DIE_RETURNED,
    CRYSTAL_CONVERTED,
    MANA_DIE_USED,
    CRYSTAL_USED,
    CRYSTAL_GAINED,
    MANA_TOKEN_USED,
  ].includes(event.type as typeof MANA_DIE_TAKEN);
}
