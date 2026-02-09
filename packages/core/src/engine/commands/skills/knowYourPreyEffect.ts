/**
 * Know Your Prey skill effect handler
 *
 * Wolfhawk's skill: Once per round, during combat, flip to ignore one
 * offensive or defensive ability of an enemy token, or to remove one
 * element of one enemy attack (Fire/Ice → Physical, Cold Fire → Fire or Ice).
 * Cannot target enemies with Arcane Immunity.
 *
 * This handler directly creates a pending choice for enemy selection.
 * The choice options are KnowYourPreySelectOptionEffect effects that,
 * when resolved by resolveChoiceCommand, generate the second-level
 * ability/resistance/element removal options.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import type { KnowYourPreySelectOptionEffect } from "../../../types/cards.js";
import {
  ABILITY_ARCANE_IMMUNITY,
} from "@mage-knight/shared";
import { SKILL_WOLFHAWK_KNOW_YOUR_PREY } from "../../../data/skills/index.js";
import { SOURCE_SKILL } from "../../../types/modifierConstants.js";
import { EFFECT_KNOW_YOUR_PREY_SELECT_OPTION } from "../../../types/effectTypes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";
import { canActivateKnowYourPrey, buildApplyOptionsForEnemy } from "../../effects/knowYourPreyEffects.js";

/**
 * Apply the Know Your Prey skill effect.
 *
 * Directly resolves enemy selection by creating a pending choice with
 * KnowYourPreySelectOptionEffect options. When the player selects an enemy,
 * resolveChoiceCommand resolves the chosen effect, which generates the
 * second-level ability/resistance/element removal options.
 */
export function applyKnowYourPreyEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  if (!state.combat) return state;

  // Get eligible enemies (non-defeated, non-Arcane Immune, with removable options)
  const eligibleEnemies = state.combat.enemies.filter((e) => {
    if (e.isDefeated) return false;
    if (e.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
    const options = buildApplyOptionsForEnemy(e, e.instanceId);
    return options.length > 0;
  });

  if (eligibleEnemies.length === 0) return state;

  // If only one enemy, skip to option selection by directly building
  // the apply options as the pending choice
  if (eligibleEnemies.length === 1) {
    const enemy = eligibleEnemies[0]!;
    const applyOptions = buildApplyOptionsForEnemy(enemy, enemy.instanceId);

    if (applyOptions.length === 1) {
      // Single enemy with single option — auto-resolve not possible in pending choice,
      // so still set up the choice for the player
    }

    const updatedPlayer: Player = {
      ...player,
      pendingChoice: {
        cardId: null,
        skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
        unitInstanceId: null,
        options: [...applyOptions],
      },
    };

    const players = [...state.players];
    players[playerIndex] = updatedPlayer;
    return { ...state, players };
  }

  // Multiple enemies — present enemy selection
  const enemyOptions: CardEffect[] = eligibleEnemies.map((enemy) => ({
    type: EFFECT_KNOW_YOUR_PREY_SELECT_OPTION,
    enemyInstanceId: enemy.instanceId,
    enemyName: enemy.definition.name,
  } as KnowYourPreySelectOptionEffect));

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_WOLFHAWK_KNOW_YOUR_PREY,
      unitInstanceId: null,
      options: enemyOptions,
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove Know Your Prey modifiers for undo.
 */
export function removeKnowYourPreyEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if it's from Know Your Prey
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    activeModifiers: state.activeModifiers.filter(
      (m) =>
        !(
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_WOLFHAWK_KNOW_YOUR_PREY &&
          m.source.playerId === playerId
        )
    ),
  };
}

export { canActivateKnowYourPrey };
