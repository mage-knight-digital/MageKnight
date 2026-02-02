/**
 * White Crystal Craft skill effect handler
 *
 * Goldyx's skill: Flip to gain 1 blue crystal and 1 white mana token.
 *
 * Implementation:
 * - Adds 1 blue crystal to inventory (if under 3 blue crystals)
 * - Adds 1 white mana token to player's pool
 *
 * Note: To support proper undo, we store whether a crystal was gained
 * in the mana token's metadata. This allows the undo function to know
 * whether to remove a crystal.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player, ManaToken } from "../../../types/player.js";
import { MANA_BLUE, MANA_WHITE, MANA_TOKEN_SOURCE_SKILL } from "@mage-knight/shared";

const MAX_CRYSTALS_PER_COLOR = 3;

/**
 * Extended mana token with metadata for undo support.
 * The crystalGained flag tracks whether the skill granted a crystal.
 */
interface WhiteCrystalCraftToken extends ManaToken {
  readonly crystalGained?: boolean;
}

/**
 * Apply the White Crystal Craft skill effect.
 *
 * 1. Gain 1 blue crystal (if under the 3 crystal limit)
 * 2. Gain 1 white mana token (with metadata tracking if crystal was gained)
 */
export function applyWhiteCrystalCraftEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Check if crystal can be gained (under 3-max limit)
  const canGainCrystal = player.crystals[MANA_BLUE] < MAX_CRYSTALS_PER_COLOR;

  // Gain blue crystal if under limit
  const updatedCrystals = canGainCrystal
    ? {
        ...player.crystals,
        [MANA_BLUE]: player.crystals[MANA_BLUE] + 1,
      }
    : player.crystals;

  // Gain white mana token with metadata for undo support
  const newToken: WhiteCrystalCraftToken = {
    color: MANA_WHITE,
    source: MANA_TOKEN_SOURCE_SKILL,
    crystalGained: canGainCrystal,
  };

  const updatedPlayer: Player = {
    ...player,
    crystals: updatedCrystals,
    pureMana: [...player.pureMana, newToken],
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}

/**
 * Remove the White Crystal Craft skill effect for undo.
 *
 * Reverses the effect:
 * 1. Remove the white mana token (last token added with SKILL source)
 * 2. Remove blue crystal only if one was actually gained (check token metadata)
 */
export function removeWhiteCrystalCraftEffect(
  state: GameState,
  playerId: string
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  // Find and remove white mana token from skill source
  const newPureMana = [...player.pureMana];
  let tokenRemoved = false;
  let crystalWasGained = false;

  for (let i = newPureMana.length - 1; i >= 0; i--) {
    const token = newPureMana[i] as WhiteCrystalCraftToken | undefined;
    if (token?.color === MANA_WHITE && token.source === MANA_TOKEN_SOURCE_SKILL) {
      // Check if this token indicates a crystal was gained
      crystalWasGained = token.crystalGained === true;
      newPureMana.splice(i, 1);
      tokenRemoved = true;
      break;
    }
  }

  // Only remove crystal if one was actually gained
  const updatedCrystals = crystalWasGained
    ? {
        ...player.crystals,
        [MANA_BLUE]: Math.max(0, player.crystals[MANA_BLUE] - 1),
      }
    : player.crystals;

  const updatedPlayer: Player = {
    ...player,
    crystals: updatedCrystals,
    pureMana: tokenRemoved ? newPureMana : player.pureMana,
  };

  const players = [...state.players];
  players[playerIndex] = updatedPlayer;

  return { ...state, players };
}
