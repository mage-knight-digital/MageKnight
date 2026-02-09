/**
 * Dueling skill effect handler
 *
 * Wolfhawk's skill: Once per turn, during Block Phase, select an enemy:
 * - Block 1 against selected enemy (added to combatAccumulator)
 * - Attack 1 against same enemy in Attack phase (deferred via modifier)
 * - Fame +1 if enemy defeated without any unit involvement
 *
 * Key rules:
 * - Can only be used during Block Phase (S4)
 * - Don't need to successfully block to qualify for Attack 1 or Fame (S1)
 * - Can't use on already-dead enemies (S1)
 * - Can't use if enemy prevented from attacking (no Block Phase for that enemy) (S4)
 * - CAN use if attack reduced to 0 by Swift Reflexes (S4)
 * - Unit resistance absorption still counts as unit involvement (S3)
 *
 * @module commands/skills/duelingEffect
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import { SKILL_WOLFHAWK_DUELING } from "../../../data/skills/wolfhawk/dueling.js";
import {
  DURATION_COMBAT,
  EFFECT_DUELING_TARGET,
  SOURCE_SKILL,
} from "../../../types/modifierConstants.js";
import { EFFECT_RESOLVE_COMBAT_ENEMY_TARGET } from "../../../types/effectTypes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { doesEnemyAttackThisCombat } from "../../modifiers/combat.js";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";
import type { ResolveCombatEnemyTargetEffect } from "../../../types/cards.js";

/**
 * Check if Dueling can be activated.
 * Requires combat in Block phase with at least one eligible enemy
 * that is alive and still attacks this combat.
 */
export function canActivateDueling(state: GameState): boolean {
  if (!state.combat) return false;

  return state.combat.enemies.some(
    (e) => !e.isDefeated && doesEnemyAttackThisCombat(state, e.instanceId)
  );
}

/**
 * Apply the Dueling skill effect.
 *
 * Creates a pending choice with one option per eligible enemy.
 * When the player selects an enemy, resolveChoiceCommand resolves the
 * EFFECT_RESOLVE_COMBAT_ENEMY_TARGET which applies the block bonus
 * and creates the DuelingTargetModifier.
 *
 * For Dueling, we use a bundledEffect that adds Block 1 to the accumulator,
 * and the template adds the DuelingTargetModifier. But the template system
 * only supports modifiers, not combatAccumulator updates. So we use a custom
 * approach: present enemy choices, and when selected, we handle it via
 * the dueling-specific resolution effect.
 */
export function applyDuelingEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  if (!state.combat) return state;

  // Get eligible enemies: alive and still attacking this combat
  const eligibleEnemies = state.combat.enemies.filter(
    (e) => !e.isDefeated && doesEnemyAttackThisCombat(state, e.instanceId)
  );

  if (eligibleEnemies.length === 0) return state;

  // Build choice options - one per eligible enemy
  // Use EFFECT_RESOLVE_COMBAT_ENEMY_TARGET with a template that creates the modifier
  const enemyOptions: CardEffect[] = eligibleEnemies.map(
    (enemy) =>
      ({
        type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
        enemyInstanceId: enemy.instanceId,
        enemyName: enemy.definition.name,
        template: {
          // The modifier tracks the target for deferred attack and fame bonus
          modifiers: [
            {
              modifier: {
                type: EFFECT_DUELING_TARGET,
                enemyInstanceId: enemy.instanceId,
                attackApplied: false,
                unitInvolved: false,
              },
              duration: DURATION_COMBAT,
              description: "Dueling target",
            },
          ],
        },
      }) as ResolveCombatEnemyTargetEffect
  );

  // If only one enemy, still present choice (consistent with other skills)
  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_WOLFHAWK_DUELING,
      unitInstanceId: null,
      options: enemyOptions,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  // Also add Block 1 to combatAccumulator immediately
  // This is granted regardless of which enemy is selected
  players[playerIndex] = {
    ...updatedPlayer,
    combatAccumulator: {
      ...updatedPlayer.combatAccumulator,
      block: updatedPlayer.combatAccumulator.block + 1,
      blockElements: {
        ...updatedPlayer.combatAccumulator.blockElements,
        [ELEMENT_PHYSICAL]:
          updatedPlayer.combatAccumulator.blockElements.physical + 1,
      },
    },
  };

  return { ...state, players };
}

/**
 * Remove Dueling effects for undo.
 * Clears pending choice and removes DuelingTarget modifier.
 * Also removes Block 1 from combatAccumulator.
 */
export function removeDuelingEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if from Dueling
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_WOLFHAWK_DUELING
        ? null
        : player.pendingChoice,
    // Remove Block 1 from combatAccumulator
    combatAccumulator: {
      ...player.combatAccumulator,
      block: Math.max(0, player.combatAccumulator.block - 1),
      blockElements: {
        ...player.combatAccumulator.blockElements,
        [ELEMENT_PHYSICAL]: Math.max(
          0,
          player.combatAccumulator.blockElements.physical - 1
        ),
      },
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    // Remove modifiers from Dueling:
    // - SOURCE_SKILL modifiers created by useSkillCommand
    // - DuelingTarget modifiers created by the template system (which uses SOURCE_CARD)
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_DUELING &&
          m.source.playerId === playerId
        ) &&
        !(
          m.effect.type === EFFECT_DUELING_TARGET &&
          m.createdByPlayerId === playerId
        )
    ),
  };
}
