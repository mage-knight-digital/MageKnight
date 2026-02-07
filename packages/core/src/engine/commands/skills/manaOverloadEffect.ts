/**
 * Mana Overload skill effect handler
 *
 * Tovak's interactive skill: Choose a non-gold color, gain a mana token of that color.
 * Place skill in center with color marker. First player to power Move/Influence/Attack/Block
 * with that color gets +4 and returns skill to owner face-down.
 *
 * Activation creates a pending choice for color selection.
 * The chosen color determines both the mana token gained and the center marker.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player, PendingChoice } from "../../../types/player.js";
import type { CardEffect } from "../../../types/cards.js";
import { SKILL_TOVAK_MANA_OVERLOAD } from "../../../data/skills/index.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
} from "@mage-knight/shared";
import type { ManaColor } from "@mage-knight/shared";
import { EFFECT_GAIN_MANA } from "../../../types/effectTypes.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";

/** Non-gold mana colors available for Mana Overload choice */
const MANA_OVERLOAD_COLORS: readonly ManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
];

/**
 * Apply the Mana Overload skill activation.
 *
 * Creates a pending choice for the player to pick a non-gold mana color.
 * The color selection is resolved via the standard choice resolution system.
 *
 * Each option grants a mana token of that color; the center marker
 * is set after the choice resolves.
 */
export function applyManaOverloadEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];

  // Build choice options - one per non-gold color
  const options: CardEffect[] = MANA_OVERLOAD_COLORS.map((color) => ({
    type: EFFECT_GAIN_MANA as const,
    color,
  }));

  const pendingChoice: PendingChoice = {
    cardId: null,
    skillId: SKILL_TOVAK_MANA_OVERLOAD,
    unitInstanceId: null,
    options,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove the Mana Overload effect for undo.
 * Clears the center state and any pending choice.
 */
export function removeManaOverloadEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];

  const updatedPlayer: Player = {
    ...player,
    pendingChoice: null,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return {
    ...state,
    players,
    manaOverloadCenter: null,
  };
}

/**
 * Place the Mana Overload skill in the center after color is chosen.
 * Called when the color choice for Mana Overload is resolved.
 */
export function placeManaOverloadInCenter(
  state: GameState,
  ownerId: string,
  color: ManaColor
): GameState {
  return {
    ...state,
    manaOverloadCenter: {
      markedColor: color,
      ownerId,
      skillId: SKILL_TOVAK_MANA_OVERLOAD,
    },
  };
}

/**
 * Return Mana Overload to owner and flip it face-down.
 * Called when the +4 trigger fires.
 */
export function returnManaOverloadToOwner(state: GameState): GameState {
  if (!state.manaOverloadCenter) return state;

  const { ownerId, skillId } = state.manaOverloadCenter;
  const ownerIndex = state.players.findIndex((p) => p.id === ownerId);
  if (ownerIndex === -1) {
    return { ...state, manaOverloadCenter: null };
  }

  const owner = state.players[ownerIndex];
  const flippedSkills = owner.skillFlipState.flippedSkills.includes(skillId)
    ? owner.skillFlipState.flippedSkills
    : [...owner.skillFlipState.flippedSkills, skillId];

  const updatedOwner: Player = {
    ...owner,
    skillFlipState: {
      ...owner.skillFlipState,
      flippedSkills,
    },
  };

  const players = [...state.players];
  players[ownerIndex] = updatedOwner;

  return {
    ...state,
    players,
    manaOverloadCenter: null,
  };
}
