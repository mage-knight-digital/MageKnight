/**
 * Armor reduction helpers for Explosive Bolt
 *
 * Applies per-defeat armor reduction modifiers to surviving enemies.
 * For each enemy defeated by the tracked attack, another surviving enemy
 * gets Armor -1 (minimum 1). Fire Resistant enemies are immune.
 * Armor reduction lasts the entire combat.
 *
 * Distribution strategy (when no player choice):
 * - Sorts valid targets by armor descending (highest armor first)
 * - Applies one reduction per target, cycling through
 * - Naturally handles stacking when reductions > targets
 */

import type { GameState } from "../../state/GameState.js";
import { RESIST_FIRE, CARD_EXPLOSIVE_BOLT } from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import { hasArcaneImmunity } from "../modifiers/queries.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

/**
 * Apply armor reduction modifiers to surviving enemies after defeat tracking.
 *
 * For each reduction to apply, selects a valid target from surviving enemies:
 * - Not defeated
 * - Not Fire Resistant (immune to armor reduction per Explosive Bolt rules)
 * - Not Arcane Immune (blocks non-Attack/Block effects per general rules)
 *
 * Distributes reductions by cycling through valid targets sorted by armor
 * (highest armor first). This naturally spreads reductions across targets,
 * with stacking when there are more reductions than targets.
 *
 * @param state - Current game state (must have active combat)
 * @param playerId - Player applying the reductions
 * @param reductionCount - Number of -1 armor reductions to apply
 * @returns Updated game state with armor reduction modifiers applied
 */
export function applyArmorReductions(
  state: GameState,
  playerId: string,
  reductionCount: number
): GameState {
  if (reductionCount <= 0 || !state.combat) {
    return state;
  }

  // Find valid targets: surviving, non-fire-resistant, non-arcane-immune enemies
  const validTargets = state.combat.enemies.filter((enemy) => {
    if (enemy.isDefeated) return false;
    if (enemy.definition.resistances.includes(RESIST_FIRE)) return false;
    if (hasArcaneImmunity(state, enemy.instanceId)) return false;
    return true;
  });

  if (validTargets.length === 0) {
    return state;
  }

  // Sort by armor descending (reduce the strongest enemies first)
  const sortedTargets = [...validTargets].sort(
    (a, b) => b.definition.armor - a.definition.armor
  );

  let updatedState = state;

  // Distribute reductions across valid targets (cycling)
  for (let i = 0; i < reductionCount; i++) {
    const target = sortedTargets[i % sortedTargets.length];
    if (!target) continue;

    updatedState = addModifier(updatedState, {
      effect: {
        type: EFFECT_ENEMY_STAT,
        stat: ENEMY_STAT_ARMOR,
        amount: -1,
        minimum: 1,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_ONE_ENEMY, enemyId: target.instanceId },
      source: { type: SOURCE_CARD, cardId: CARD_EXPLOSIVE_BOLT, playerId },
      createdAtRound: updatedState.round,
      createdByPlayerId: playerId,
    });
  }

  return updatedState;
}
