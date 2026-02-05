/**
 * Scout fame bonus tracking
 *
 * When the Scouts unit uses its Scout peek ability, a ScoutFameBonus modifier
 * is created that tracks which enemy tokens were revealed. If any of those
 * enemies are defeated this turn, the player gains bonus fame.
 */

import type { GameState } from "../../state/GameState.js";
import { EFFECT_SCOUT_FAME_BONUS } from "../../types/modifierConstants.js";
import type { ScoutFameBonusModifier } from "../../types/modifiers.js";

export interface ScoutFameBonusResult {
  readonly state: GameState;
  readonly fameToGain: number;
}

/**
 * Check active modifiers for ScoutFameBonus and resolve fame for defeated enemies.
 * Removes consumed modifiers (where at least one tracked enemy was defeated).
 */
export function resolveScoutFameBonus(
  state: GameState,
  playerId: string,
  defeatedEnemyIds: readonly string[]
): ScoutFameBonusResult {
  if (defeatedEnemyIds.length === 0) {
    return { state, fameToGain: 0 };
  }

  const defeatedSet = new Set(defeatedEnemyIds);
  let fameToGain = 0;
  let didChange = false;

  const updatedModifiers = state.activeModifiers.filter((mod) => {
    if (
      mod.effect.type !== EFFECT_SCOUT_FAME_BONUS ||
      mod.createdByPlayerId !== playerId
    ) {
      return true; // Keep non-scout modifiers
    }

    const scoutEffect = mod.effect as ScoutFameBonusModifier;
    const matchingEnemies = scoutEffect.revealedEnemyIds.filter((id) =>
      defeatedSet.has(id)
    );

    if (matchingEnemies.length > 0) {
      fameToGain += matchingEnemies.length * scoutEffect.fame;
      didChange = true;
      return false; // Remove consumed modifier
    }

    return true; // Keep modifier if no tracked enemies were defeated
  });

  if (!didChange) {
    return { state, fameToGain: 0 };
  }

  return {
    state: { ...state, activeModifiers: updatedModifiers },
    fameToGain,
  };
}
