/**
 * Shield Mastery skill effect handler
 *
 * Tovak's skill: Block 3, or Fire Block 2, or Ice Block 2.
 *
 * This is a combat-only skill that gives the player a choice between
 * three different blocking options. Elemental blocks are efficient
 * against matching attack elements (double effective).
 *
 * Implementation:
 * - Creates a pending choice with three block options
 * - Player selects one option
 * - Selected block is added to combat accumulator
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import { SKILL_TOVAK_SHIELD_MASTERY } from "../../../data/skills/index.js";
import {
  block,
  fireBlock,
  iceBlock,
} from "../../../data/effectHelpers.js";
import { getPlayerIndexByIdOrThrow } from "../../helpers/playerHelpers.js";

/**
 * Apply the Shield Mastery skill effect.
 *
 * Creates a pending choice with three options:
 * 1. Block 3 (physical)
 * 2. Fire Block 2 (efficient vs ice attacks)
 * 3. Ice Block 2 (efficient vs fire attacks)
 *
 * The player must resolve this choice before continuing.
 */
export function applyShieldMasteryEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Create pending choice with three block options
  const updatedPlayer: Player = {
    ...player,
    pendingChoice: {
      cardId: null,
      skillId: SKILL_TOVAK_SHIELD_MASTERY,
      unitInstanceId: null,
      options: [
        block(3),      // Physical Block 3
        fireBlock(2),  // Fire Block 2 (efficient vs ice attacks)
        iceBlock(2),   // Ice Block 2 (efficient vs fire attacks)
      ],
    },
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove Shield Mastery effect for undo.
 *
 * Clears the pending choice if it's from Shield Mastery.
 * Note: If the choice has already been resolved, the block effect
 * will be undone by the effect system through resolveChoiceCommand.
 */
export function removeShieldMasteryEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = getPlayerIndexByIdOrThrow(state, playerId);
  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Clear pending choice if it's from Shield Mastery
  const updatedPlayer: Player = {
    ...player,
    pendingChoice:
      player.pendingChoice?.skillId === SKILL_TOVAK_SHIELD_MASTERY
        ? null
        : player.pendingChoice,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}
