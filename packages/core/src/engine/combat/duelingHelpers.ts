/**
 * Dueling skill combat helpers.
 *
 * Handles the deferred Attack 1 when transitioning to Attack phase,
 * and the Fame +1 bonus at combat end if no units were involved.
 *
 * Follows the same pattern as dodgeAndWeaveHelpers.ts for phase-transition
 * automatic effects.
 */

import type { GameState } from "../../state/GameState.js";
import type { DuelingTargetModifier } from "../../types/modifiers.js";
import { EFFECT_DUELING_TARGET, SOURCE_SKILL } from "../../types/modifierConstants.js";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";
import { SKILL_WOLFHAWK_DUELING } from "../../data/skills/wolfhawk/dueling.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";

/**
 * Update a DuelingTargetModifier's effect in the activeModifiers array.
 */
function updateDuelingModifier(
  state: GameState,
  modifierId: string,
  updatedEffect: DuelingTargetModifier
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.map((m) =>
      m.id === modifierId
        ? { ...m, effect: updatedEffect }
        : m
    ),
  };
}

/**
 * Apply Dueling's deferred Attack 1 when entering Attack phase.
 *
 * Finds any active DuelingTargetModifier and grants physical melee Attack 1.
 * The attack is added to the combatAccumulator.
 * The modifier is updated to mark attackApplied = true but NOT removed
 * (still needed for fame bonus tracking at combat end).
 *
 * @param state - Current game state (during phase transition to Attack)
 * @param playerId - Player who used Dueling
 * @returns Updated state with attack bonus applied
 */
export function applyDuelingAttackBonus(
  state: GameState,
  playerId: string
): GameState {
  if (!state.combat) return state;

  const modifiers = getModifiersForPlayer(state, playerId);
  const duelingMod = modifiers.find(
    (m) =>
      m.effect.type === EFFECT_DUELING_TARGET &&
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === SKILL_WOLFHAWK_DUELING
  );

  if (!duelingMod) return state;

  const effect = duelingMod.effect as DuelingTargetModifier;
  if (effect.attackApplied) return state;

  // Check if the target enemy is still alive (can't attack a dead enemy)
  const targetEnemy = state.combat.enemies.find(
    (e) => e.instanceId === effect.enemyInstanceId
  );
  if (!targetEnemy || targetEnemy.isDefeated) {
    // Enemy was defeated before Attack phase — no deferred attack
    return state;
  }

  // Mark attack as applied
  let currentState = updateDuelingModifier(state, duelingMod.id, {
    ...effect,
    attackApplied: true,
  });

  // Add Attack 1 (physical melee) to combatAccumulator
  const playerIndex = currentState.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return currentState;

  const player = currentState.players[playerIndex]!;
  const updatedPlayers = [...currentState.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        normal: player.combatAccumulator.attack.normal + 1,
        normalElements: {
          ...player.combatAccumulator.attack.normalElements,
          [ELEMENT_PHYSICAL]:
            player.combatAccumulator.attack.normalElements.physical + 1,
        },
      },
    },
  };

  return { ...currentState, players: updatedPlayers };
}

/**
 * Resolve Dueling fame bonus at combat end.
 *
 * Checks if the Dueling target enemy was defeated and no units were involved.
 * If so, grants Fame +1 to the player.
 * The modifier is cleaned up by normal combat-end modifier expiration.
 *
 * @param state - Current game state (at combat end, before combat = null)
 * @param playerId - Player who used Dueling
 * @returns Object with updated state and fame gained
 */
export function resolveDuelingFameBonus(
  state: GameState,
  playerId: string
): { state: GameState; fameGained: number } {
  if (!state.combat) return { state, fameGained: 0 };

  const modifiers = getModifiersForPlayer(state, playerId);
  const duelingMod = modifiers.find(
    (m) =>
      m.effect.type === EFFECT_DUELING_TARGET &&
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === SKILL_WOLFHAWK_DUELING
  );

  if (!duelingMod) return { state, fameGained: 0 };

  const effect = duelingMod.effect as DuelingTargetModifier;

  // Check if the target enemy was defeated
  const targetEnemy = state.combat.enemies.find(
    (e) => e.instanceId === effect.enemyInstanceId
  );
  if (!targetEnemy || !targetEnemy.isDefeated) {
    return { state, fameGained: 0 };
  }

  // Check if any unit was involved
  if (effect.unitInvolved) {
    return { state, fameGained: 0 };
  }

  // Grant Fame +1
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) return { state, fameGained: 0 };

  const player = state.players[playerIndex]!;
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    fame: player.fame + 1,
  };

  return {
    state: { ...state, players: updatedPlayers },
    fameGained: 1,
  };
}

/**
 * Mark unit involvement for the Dueling target enemy when a unit combat
 * ability (block/attack/ranged/siege) is activated.
 *
 * Since unit abilities go to a generic accumulator (not targeting a specific enemy),
 * any unit combat ability usage marks the Dueling target as unit-involved.
 *
 * @param state - Current game state
 * @param playerId - Player who used Dueling
 * @returns Updated state with unitInvolved flag set
 */
export function markDuelingUnitInvolvementFromAbility(
  state: GameState,
  playerId: string
): GameState {
  const modifiers = getModifiersForPlayer(state, playerId);
  const duelingMod = modifiers.find(
    (m) =>
      m.effect.type === EFFECT_DUELING_TARGET &&
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === SKILL_WOLFHAWK_DUELING
  );

  if (!duelingMod) return state;

  const effect = duelingMod.effect as DuelingTargetModifier;
  if (effect.unitInvolved) return state;

  return updateDuelingModifier(state, duelingMod.id, {
    ...effect,
    unitInvolved: true,
  });
}

/**
 * Mark that a unit was involved with the Dueling target enemy.
 *
 * Called when:
 * - Damage from this enemy is assigned to any unit (including resistant units - S3)
 *
 * @param state - Current game state
 * @param playerId - Player who used Dueling
 * @param enemyInstanceId - The enemy that had unit involvement
 * @returns Updated state with unitInvolved flag set
 */
export function markDuelingUnitInvolvement(
  state: GameState,
  playerId: string,
  enemyInstanceId: string
): GameState {
  const modifiers = getModifiersForPlayer(state, playerId);
  const duelingMod = modifiers.find(
    (m) =>
      m.effect.type === EFFECT_DUELING_TARGET &&
      m.source.type === SOURCE_SKILL &&
      m.source.skillId === SKILL_WOLFHAWK_DUELING
  );

  if (!duelingMod) return state;

  const effect = duelingMod.effect as DuelingTargetModifier;

  // Only mark if this is the Dueling target enemy
  if (effect.enemyInstanceId !== enemyInstanceId) return state;

  // Already marked
  if (effect.unitInvolved) return state;

  return updateDuelingModifier(state, duelingMod.id, {
    ...effect,
    unitInvolved: true,
  });
}
