/**
 * Crystal overflow helpers
 *
 * When a player gains a crystal but is already at the per-color maximum (3),
 * the overflow is converted to a mana token instead of being silently dropped.
 */

import type { Player, ManaToken, Crystals } from "../../types/player.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { MANA_TOKEN_SOURCE_CARD } from "@mage-knight/shared";

export const MAX_CRYSTALS_PER_COLOR = 3;

export interface GainCrystalResult {
  readonly player: Player;
  readonly crystalsGained: number;
  readonly tokensGained: number;
}

/**
 * Gain crystals with overflow protection.
 *
 * If the player has room, increments the crystal count for the given color.
 * If at max (3), overflows to a mana token of that color in pureMana.
 * Handles partial overflow (e.g., count=2 with 1 slot -> 1 crystal + 1 token).
 *
 * @param player - The player gaining crystals
 * @param color - The basic mana color of the crystal
 * @param count - Number of crystals to gain (default 1)
 * @param tokenSource - ManaToken source for overflow tokens (default "card")
 */
export function gainCrystalWithOverflow(
  player: Player,
  color: BasicManaColor,
  count: number = 1,
  tokenSource: ManaToken["source"] = MANA_TOKEN_SOURCE_CARD
): GainCrystalResult {
  const current = player.crystals[color];
  const available = MAX_CRYSTALS_PER_COLOR - current;
  const crystalsToGain = Math.min(count, Math.max(0, available));
  const tokensToGain = count - crystalsToGain;

  let updatedCrystals: Crystals = player.crystals;
  if (crystalsToGain > 0) {
    updatedCrystals = {
      ...player.crystals,
      [color]: current + crystalsToGain,
    };
  }

  let updatedPureMana: readonly ManaToken[] = player.pureMana;
  if (tokensToGain > 0) {
    const overflowTokens: ManaToken[] = Array.from(
      { length: tokensToGain },
      () => ({ color, source: tokenSource })
    );
    updatedPureMana = [...player.pureMana, ...overflowTokens];
  }

  return {
    player: {
      ...player,
      crystals: updatedCrystals,
      pureMana: updatedPureMana,
    },
    crystalsGained: crystalsToGain,
    tokensGained: tokensToGain,
  };
}
