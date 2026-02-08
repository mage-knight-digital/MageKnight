/**
 * Crystal Helper Functions
 *
 * Shared logic for gaining crystals with overflow handling.
 * When a player gains a crystal but is already at the max (3 per color),
 * the excess becomes a temporary mana token instead.
 *
 * @module helpers/crystalHelpers
 */

import type { Player, ManaToken } from "../../types/player.js";
import type { BasicManaColor, ManaTokenSource } from "@mage-knight/shared";

export const MAX_CRYSTALS_PER_COLOR = 3;

export interface GainCrystalResult {
  readonly player: Player;
  readonly crystalsGained: number;
  readonly tokensGained: number;
}

/**
 * Gain crystals with overflow handling.
 *
 * If the player has room, increment the crystal count.
 * If at max (3), the excess becomes a temporary mana token instead.
 * Handles partial overflow (e.g., count=2 with 1 slot = 1 crystal + 1 token).
 *
 * @param player - The player gaining the crystal(s)
 * @param color - The basic mana color of crystal to gain
 * @param count - Number of crystals to gain (default: 1)
 * @param tokenSource - Source tag for overflow tokens
 * @returns Updated player and counts of crystals/tokens gained
 */
export function gainCrystalWithOverflow(
  player: Player,
  color: BasicManaColor,
  count: number = 1,
  tokenSource: ManaTokenSource
): GainCrystalResult {
  const current = player.crystals[color];
  const slotsAvailable = MAX_CRYSTALS_PER_COLOR - current;

  const crystalsToGain = Math.min(count, Math.max(0, slotsAvailable));
  const tokensToGain = count - crystalsToGain;

  let updatedPlayer = player;

  if (crystalsToGain > 0) {
    updatedPlayer = {
      ...updatedPlayer,
      crystals: {
        ...updatedPlayer.crystals,
        [color]: current + crystalsToGain,
      },
    };
  }

  if (tokensToGain > 0) {
    const overflowTokens: ManaToken[] = Array.from(
      { length: tokensToGain },
      () => ({ color, source: tokenSource })
    );
    updatedPlayer = {
      ...updatedPlayer,
      pureMana: [...updatedPlayer.pureMana, ...overflowTokens],
    };
  }

  return {
    player: updatedPlayer,
    crystalsGained: crystalsToGain,
    tokensGained: tokensToGain,
  };
}
