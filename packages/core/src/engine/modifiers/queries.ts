/**
 * Modifier query helpers
 *
 * Foundation layer for querying active modifiers by type, player, or enemy.
 * Other modifier modules depend on these functions.
 */

import type { GameState } from "../../state/GameState.js";
import type { ActiveModifier, EndlessManaModifier } from "../../types/modifiers.js";
import type { ManaColor } from "@mage-knight/shared";
import { ABILITY_ARCANE_IMMUNITY } from "@mage-knight/shared";
import { SKILLS } from "../../data/skills/index.js";
import {
  DURATION_PERMANENT,
  EFFECT_ENDLESS_MANA,
  SCOPE_ALL_ENEMIES,
  SCOPE_ALL_PLAYERS,
  SCOPE_ONE_ENEMY,
  SCOPE_OTHER_PLAYERS,
  SCOPE_SELF,
  SOURCE_SKILL,
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
  const active = state.activeModifiers.filter((m) => {
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

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return active;
  }

  const passive = player.skills.flatMap((skillId) => {
    const skill = SKILLS[skillId];
    if (!skill?.passiveModifiers || skill.passiveModifiers.length === 0) {
      return [];
    }

    return skill.passiveModifiers.map((effect, index) => ({
      id: `skill_${skillId}_${index}_${playerId}`,
      source: { type: SOURCE_SKILL, skillId, playerId },
      duration: DURATION_PERMANENT,
      scope: { type: SCOPE_SELF },
      effect,
      createdAtRound: state.round,
      createdByPlayerId: playerId,
    }));
  });

  return [...active, ...passive];
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

/**
 * Get all mana colors with endless supply for a player.
 * Returns a Set of colors that the player has access to without consuming resources.
 * Multiple endless mana modifiers stack (union of all colors).
 *
 * Note: Even with endless supply, black mana restrictions (day/night rules) still apply.
 */
export function getEndlessManaColors(
  state: GameState,
  playerId: string
): ReadonlySet<ManaColor> {
  const colors = new Set<ManaColor>();

  const modifiers = getModifiersForPlayer(state, playerId).filter(
    (m) => m.effect.type === EFFECT_ENDLESS_MANA
  );

  for (const modifier of modifiers) {
    const effect = modifier.effect as EndlessManaModifier;
    for (const color of effect.colors) {
      colors.add(color);
    }
  }

  return colors;
}

/**
 * Check if a player has endless supply of a specific mana color.
 */
export function hasEndlessMana(
  state: GameState,
  playerId: string,
  color: ManaColor
): boolean {
  return getEndlessManaColors(state, playerId).has(color);
}
