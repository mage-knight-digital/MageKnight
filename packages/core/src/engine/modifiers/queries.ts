/**
 * Modifier query helpers
 *
 * Foundation layer for querying active modifiers by type, player, or enemy.
 * Other modifier modules depend on these functions.
 */

import type { GameState } from "../../state/GameState.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import { ABILITY_ARCANE_IMMUNITY } from "@mage-knight/shared";
import {
  SCOPE_ALL_ENEMIES,
  SCOPE_ALL_PLAYERS,
  SCOPE_ONE_ENEMY,
  SCOPE_OTHER_PLAYERS,
  SCOPE_SELF,
} from "../modifierConstants.js";

/**
 * Get all active modifiers of a specific effect type.
 */
export function getModifiersOfType<T extends ActiveModifier["effect"]["type"]>(
  state: GameState,
  effectType: T
): ActiveModifier[] {
  return state.activeModifiers.filter((m) => m.effect.type === effectType);
}

/**
 * Get modifiers that apply to a specific player.
 */
export function getModifiersForPlayer(
  state: GameState,
  playerId: string
): ActiveModifier[] {
  return state.activeModifiers.filter((m) => {
    const scope = m.scope;
    if (scope.type === SCOPE_SELF) {
      return m.createdByPlayerId === playerId;
    }
    if (scope.type === SCOPE_ALL_PLAYERS) {
      return true;
    }
    if (scope.type === SCOPE_OTHER_PLAYERS) {
      return m.createdByPlayerId !== playerId;
    }
    // For enemy/unit scopes, check if this player owns the context
    return m.createdByPlayerId === playerId;
  });
}

/**
 * Get all modifiers targeting a specific enemy.
 *
 * For cooperative assaults with enemy assignments, SCOPE_ALL_ENEMIES modifiers
 * only apply to enemies assigned to the player who created the modifier.
 * This ensures "affect all enemies" effects are scoped to each player's portion.
 *
 * Note: This function returns ALL modifiers targeting the enemy, including those
 * that should be blocked by Arcane Immunity. Use `getEffectiveModifiersForEnemy`
 * if you need Arcane Immunity filtering.
 */
export function getModifiersForEnemy(
  state: GameState,
  enemyId: string
): ActiveModifier[] {
  const combat = state.combat;
  const enemyAssignments = combat?.enemyAssignments;

  return state.activeModifiers.filter((m) => {
    // SCOPE_ONE_ENEMY: always applies if enemyId matches
    if (m.scope.type === SCOPE_ONE_ENEMY && m.scope.enemyId === enemyId) {
      return true;
    }

    // SCOPE_ALL_ENEMIES: needs special handling for cooperative assaults
    if (m.scope.type === SCOPE_ALL_ENEMIES) {
      // Standard combat (no assignments): applies to all enemies
      if (!enemyAssignments) {
        return true;
      }

      // Cooperative assault: only applies to enemies assigned to the modifier's creator
      const creatorId = m.createdByPlayerId;
      if (!creatorId) {
        return true; // Fallback: if no creator tracked, apply to all
      }

      const assignedEnemies = enemyAssignments[creatorId];
      return assignedEnemies?.includes(enemyId) ?? false;
    }

    return false;
  });
}

/**
 * Check if an enemy has Arcane Immunity.
 * Returns false if not in combat or enemy not found.
 */
export function hasArcaneImmunity(state: GameState, enemyId: string): boolean {
  const enemy = state.combat?.enemies.find((e) => e.instanceId === enemyId);
  if (!enemy) return false;
  return enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY);
}
