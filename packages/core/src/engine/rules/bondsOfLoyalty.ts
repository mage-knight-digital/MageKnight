/**
 * Bonds of Loyalty rule helpers.
 *
 * Shared logic for the only passive skill in the game.
 * Used by validators, validActions and commands.
 *
 * @module rules/bondsOfLoyalty
 */

import type { Player } from "../../types/player.js";
import { SKILL_NOROWAS_BONDS_OF_LOYALTY } from "../../data/skills/norowas/bondsOfLoyalty.js";

/** Influence discount for recruiting under the Bonds command token. */
export const BONDS_INFLUENCE_DISCOUNT = 5;

/**
 * Whether the player has the Bonds of Loyalty skill.
 */
export function hasBondsOfLoyalty(player: Player): boolean {
  return player.skills.includes(SKILL_NOROWAS_BONDS_OF_LOYALTY);
}

/**
 * Whether the Bonds slot is empty (no unit recruited under it).
 */
export function isBondsSlotEmpty(player: Player): boolean {
  return hasBondsOfLoyalty(player) && player.bondsOfLoyaltyUnitInstanceId === null;
}

/**
 * Whether a specific unit instance is the Bonds unit.
 */
export function isBondsUnit(player: Player, unitInstanceId: string): boolean {
  return player.bondsOfLoyaltyUnitInstanceId === unitInstanceId;
}

/**
 * Get the effective command token count, including the Bonds slot.
 *
 * Bonds of Loyalty adds 1 extra command slot. The normal `commandTokens`
 * field tracks level-based slots only; this helper adds the Bonds bonus.
 */
export function getEffectiveCommandTokens(player: Player): number {
  return player.commandTokens + (hasBondsOfLoyalty(player) ? 1 : 0);
}
