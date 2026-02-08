/**
 * Hand Limit Bonus Effect
 *
 * Handles the EFFECT_HAND_LIMIT_BONUS effect, which increases the player's
 * hand limit for the next draw-up. The bonus accumulates with existing
 * meditation hand limit bonuses (same underlying field).
 *
 * Used by Temporal Portal basic (+1) and powered choice (+1 or +2).
 *
 * @module effects/handLimitBonusEffects
 */

import type { HandLimitBonusEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { EFFECT_HAND_LIMIT_BONUS } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Apply the hand limit bonus effect.
 * Adds the bonus to the player's meditationHandLimitBonus field,
 * which is consumed during end-of-turn card draw.
 */
export function applyHandLimitBonus(
  state: GameState,
  playerId: string,
  bonus: number
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  const updatedPlayer = {
    ...player,
    meditationHandLimitBonus: player.meditationHandLimitBonus + bonus,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    state: { ...state, players },
    description: `Hand limit +${bonus} on next draw`,
  };
}

/**
 * Register the hand limit bonus effect handler.
 */
export function registerHandLimitBonusEffects(): void {
  registerEffect(
    EFFECT_HAND_LIMIT_BONUS,
    (state, playerId, effect) => {
      const hlEffect = effect as HandLimitBonusEffect;
      return applyHandLimitBonus(state, playerId, hlEffect.bonus);
    }
  );
}
