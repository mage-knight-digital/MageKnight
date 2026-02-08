/**
 * Bow of Starsdawn phase fame tracking
 *
 * When the Bow of Starsdawn basic effect is played, a BowPhaseFameTracking
 * modifier is created that awards fame per enemy defeated in the current
 * combat phase. The modifier is consumed after the phase resolves.
 *
 * Unlike Sword of Justice's "this turn" scope, the Bow only counts enemies
 * defeated in the specific phase where damage is resolved (typically
 * Ranged/Siege phase for the basic effect's ranged attack).
 */

import type { GameState } from "../../state/GameState.js";
import { EFFECT_BOW_PHASE_FAME_TRACKING } from "../../types/modifierConstants.js";
import type { BowPhaseFameTrackingModifier } from "../../types/modifiers.js";

export interface BowPhaseFameBonusResult {
  readonly state: GameState;
  readonly fameToGain: number;
}

/**
 * Check active modifiers for BowPhaseFameTracking and resolve fame for
 * enemies defeated in the current phase transition.
 *
 * The modifier is always consumed after checking (it only applies to the
 * current phase, not future phases).
 */
export function resolveBowPhaseFameBonus(
  state: GameState,
  playerId: string,
  enemiesDefeatedInPhase: number
): BowPhaseFameBonusResult {
  let fameToGain = 0;
  let didChange = false;

  const updatedModifiers = state.activeModifiers.filter((mod) => {
    if (
      mod.effect.type !== EFFECT_BOW_PHASE_FAME_TRACKING ||
      mod.createdByPlayerId !== playerId
    ) {
      return true; // Keep non-bow modifiers
    }

    const bowEffect = mod.effect as BowPhaseFameTrackingModifier;

    if (enemiesDefeatedInPhase > 0) {
      fameToGain += enemiesDefeatedInPhase * bowEffect.famePerEnemy;
    }

    // Always consume the modifier — it only applies to the current phase
    didChange = true;
    return false;
  });

  if (!didChange) {
    return { state, fameToGain: 0 };
  }

  return {
    state: { ...state, activeModifiers: updatedModifiers },
    fameToGain,
  };
}
