/**
 * Evaluates scaling factors to determine bonus multipliers for scaling effects
 */

import type { GameState } from "../../state/GameState.js";
import type { ScalingFactor } from "../../types/scaling.js";
import {
  SCALING_PER_ENEMY,
  SCALING_PER_WOUND_IN_HAND,
  SCALING_PER_UNIT,
} from "../../types/scaling.js";
import { CARD_WOUND } from "@mage-knight/shared";

/**
 * Evaluates a scaling factor and returns the count to multiply by.
 *
 * @param state - The current game state
 * @param playerId - The player whose perspective to evaluate from
 * @param factor - The scaling factor to evaluate
 * @returns The count (e.g., number of enemies, wounds, units)
 */
export function evaluateScalingFactor(
  state: GameState,
  playerId: string,
  factor: ScalingFactor
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;

  switch (factor.type) {
    case SCALING_PER_ENEMY: {
      // Count undefeated enemies in current combat
      if (!state.combat) return 0;
      return state.combat.enemies.filter((e) => !e.isDefeated).length;
    }

    case SCALING_PER_WOUND_IN_HAND: {
      // Count wounds in player's hand
      return player.hand.filter((c) => c === CARD_WOUND).length;
    }

    case SCALING_PER_UNIT: {
      // Count player's non-wounded units
      return player.units.filter((u) => !u.wounded).length;
    }

    default: {
      // Exhaustiveness check
      const _exhaustiveCheck: never = factor;
      return _exhaustiveCheck;
    }
  }
}
