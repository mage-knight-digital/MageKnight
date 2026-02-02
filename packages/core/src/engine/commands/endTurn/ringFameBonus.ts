/**
 * Ring Artifacts Fame Bonus Calculation
 *
 * Ring artifacts (Ruby, Sapphire, Diamond, Emerald) grant fame based on
 * spells of a specific color cast during the turn when their powered
 * effect was used.
 *
 * @module commands/endTurn/ringFameBonus
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { ManaColor } from "@mage-knight/shared";
import { MANA_BLACK } from "@mage-knight/shared";
import type { EndlessManaModifier } from "../../../types/modifiers.js";
import {
  EFFECT_ENDLESS_MANA,
  DURATION_TURN,
  SCOPE_SELF,
} from "../../../types/modifierConstants.js";

/**
 * Result of Ring fame bonus calculation
 */
export interface RingFameBonusResult {
  readonly player: Player;
  readonly fameGained: number;
}

/**
 * Calculate and grant fame bonus for Ring artifacts at end of turn.
 *
 * Checks for active EndlessManaModifier with DURATION_TURN created by this player,
 * then grants fame based on spells cast of the ring's color.
 *
 * Ring colors (first non-black color in the modifier):
 * - Ruby Ring: red
 * - Sapphire Ring: blue
 * - Diamond Ring: white
 * - Emerald Ring: green
 *
 * Fame = count of spells cast of that color this turn
 */
export function calculateRingFameBonus(
  state: GameState,
  player: Player
): RingFameBonusResult {
  // Find all EndlessMana modifiers created by this player this turn
  const ringModifiers = state.activeModifiers.filter(
    (m) =>
      m.effect.type === EFFECT_ENDLESS_MANA &&
      m.duration === DURATION_TURN &&
      m.createdByPlayerId === player.id &&
      m.scope.type === SCOPE_SELF
  );

  if (ringModifiers.length === 0) {
    return { player, fameGained: 0 };
  }

  let totalFame = 0;

  for (const modifier of ringModifiers) {
    const effect = modifier.effect as EndlessManaModifier;

    // Find the ring's color (first non-black color)
    const ringColor = effect.colors.find((c): c is ManaColor => c !== MANA_BLACK);
    if (!ringColor) {
      continue;
    }

    // Get count of spells cast of this color
    const spellCount = player.spellsCastByColorThisTurn[ringColor] ?? 0;
    totalFame += spellCount;
  }

  if (totalFame === 0) {
    return { player, fameGained: 0 };
  }

  // Grant the fame
  const updatedPlayer: Player = {
    ...player,
    fame: player.fame + totalFame,
  };

  return {
    player: updatedPlayer,
    fameGained: totalFame,
  };
}
