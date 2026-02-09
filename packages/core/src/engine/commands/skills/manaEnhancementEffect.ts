/**
 * Mana Enhancement skill helpers.
 *
 * Krang's skill triggers when the owner spends basic mana:
 * - Gain one crystal of the spent basic color
 * - Place the skill token in the center marked with that color
 * - Mark the skill as used this round
 *
 * While in center, other players may return it to gain one mana token
 * of the marked color. The token expires at the start of Krang's next turn.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { BasicManaColor, ManaColor } from "@mage-knight/shared";
import { BASIC_MANA_COLORS, MANA_TOKEN_SOURCE_CARD } from "@mage-knight/shared";
import { SKILL_KRANG_MANA_ENHANCEMENT } from "../../../data/skills/index.js";
import { MAX_CRYSTALS_PER_COLOR } from "../../helpers/crystalHelpers.js";
import { addModifier } from "../../modifiers/index.js";
import {
  DURATION_ROUND,
  EFFECT_TERRAIN_COST,
  SCOPE_OTHER_PLAYERS,
  SOURCE_SKILL,
  TERRAIN_ALL,
} from "../../../types/modifierConstants.js";

function isBasicManaColor(color: ManaColor): color is BasicManaColor {
  return BASIC_MANA_COLORS.includes(color as BasicManaColor);
}

function isManaEnhancementAvailable(player: Player): boolean {
  return (
    player.skills.includes(SKILL_KRANG_MANA_ENHANCEMENT) &&
    !player.skillCooldowns.usedThisRound.includes(SKILL_KRANG_MANA_ENHANCEMENT) &&
    !player.skillFlipState.flippedSkills.includes(SKILL_KRANG_MANA_ENHANCEMENT)
  );
}

function clearManaEnhancementCenterModifiers(
  state: GameState,
  ownerId: string
): GameState {
  return {
    ...state,
    activeModifiers: state.activeModifiers.filter(
      (modifier) =>
        !(
          modifier.source.type === SOURCE_SKILL &&
          modifier.source.skillId === SKILL_KRANG_MANA_ENHANCEMENT &&
          modifier.source.playerId === ownerId
        )
    ),
  };
}

function placeManaEnhancementInCenter(
  state: GameState,
  ownerId: string,
  color: BasicManaColor
): GameState {
  let updatedState = clearManaEnhancementCenterModifiers(state, ownerId);
  updatedState = {
    ...updatedState,
    manaEnhancementCenter: {
      markedColor: color,
      ownerId,
      skillId: SKILL_KRANG_MANA_ENHANCEMENT,
    },
  };

  return addModifier(updatedState, {
    source: { type: SOURCE_SKILL, skillId: SKILL_KRANG_MANA_ENHANCEMENT, playerId: ownerId },
    duration: DURATION_ROUND,
    scope: { type: SCOPE_OTHER_PLAYERS },
    effect: { type: EFFECT_TERRAIN_COST, terrain: TERRAIN_ALL, amount: 0, minimum: 0 },
    createdAtRound: updatedState.round,
    createdByPlayerId: ownerId,
  });
}

/**
 * Trigger Mana Enhancement after mana spend.
 * Returns unchanged state when trigger conditions are not met.
 */
export function applyManaEnhancementTrigger(
  state: GameState,
  playerId: string,
  manaColor: ManaColor
): GameState {
  if (!isBasicManaColor(manaColor)) {
    return state;
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return state;
  }

  const player = state.players[playerIndex];
  if (!player || !isManaEnhancementAvailable(player)) {
    return state;
  }

  const currentCrystals = player.crystals[manaColor];
  const nextCrystals =
    currentCrystals < MAX_CRYSTALS_PER_COLOR ? currentCrystals + 1 : currentCrystals;
  const updatedPlayer: Player = {
    ...player,
    crystals: {
      ...player.crystals,
      [manaColor]: nextCrystals,
    },
    skillCooldowns: {
      ...player.skillCooldowns,
      usedThisRound: [
        ...player.skillCooldowns.usedThisRound,
        SKILL_KRANG_MANA_ENHANCEMENT,
      ],
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return placeManaEnhancementInCenter({ ...state, players }, playerId, manaColor);
}

/**
 * Apply claim benefit for Mana Enhancement center token.
 */
export function applyManaEnhancementClaimBenefit(
  state: GameState,
  playerId: string
): GameState {
  const center = state.manaEnhancementCenter;
  if (!center) {
    return state;
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { ...state, manaEnhancementCenter: null };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { ...state, manaEnhancementCenter: null };
  }

  const updatedPlayer: Player = {
    ...player,
    pureMana: [
      ...player.pureMana,
      { color: center.markedColor, source: MANA_TOKEN_SOURCE_CARD },
    ],
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    manaEnhancementCenter: null,
  };
}

/**
 * Expire Mana Enhancement center token at start of owner's next turn.
 */
export function expireManaEnhancementAtTurnStart(
  state: GameState,
  currentPlayerId: string
): GameState {
  const center = state.manaEnhancementCenter;
  if (!center || center.ownerId !== currentPlayerId) {
    return state;
  }

  return {
    ...clearManaEnhancementCenterModifiers(state, center.ownerId),
    manaEnhancementCenter: null,
  };
}
