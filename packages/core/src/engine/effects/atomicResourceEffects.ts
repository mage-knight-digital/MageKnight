/**
 * Atomic resource effect handlers
 *
 * Handles effects that modify player resources:
 * - GainMove (movement points)
 * - GainInfluence (influence points)
 * - GainMana (mana tokens)
 * - GainCrystal (permanent mana crystals)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ManaColor, BasicManaColor } from "@mage-knight/shared";
import type { EffectResolutionResult } from "./types.js";
import { MANA_TOKEN_SOURCE_CARD } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { gainCrystalWithOverflow } from "../helpers/crystalHelpers.js";

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Apply a GainMove effect - adds movement points to the player.
 */
export function applyGainMove(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    movePoints: player.movePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Move`,
  };
}

/**
 * Apply a GainInfluence effect - adds influence points to the player.
 */
export function applyGainInfluence(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    influencePoints: player.influencePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Influence`,
  };
}

/**
 * Apply a GainMana effect - adds a mana token to the player's pool.
 *
 * Mana tokens are temporary and return to the source at end of turn.
 * They are distinct from crystals, which are permanent storage.
 */
export function applyGainMana(
  state: GameState,
  playerIndex: number,
  player: Player,
  color: ManaColor
): EffectResolutionResult {
  const newToken = {
    color,
    source: MANA_TOKEN_SOURCE_CARD,
  };

  const updatedPlayer: Player = {
    ...player,
    pureMana: [...player.pureMana, newToken],
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${color} mana token`,
  };
}

/**
 * Apply a GainCrystal effect - adds a permanent mana crystal to the player.
 *
 * Crystals are permanent storage (max 3 per color) that persist between turns.
 * They can be converted to/from tokens.
 */
export function applyGainCrystal(
  state: GameState,
  playerIndex: number,
  player: Player,
  color: BasicManaColor
): EffectResolutionResult {
  const { player: updatedPlayer, crystalsGained, tokensGained } =
    gainCrystalWithOverflow(player, color, 1, MANA_TOKEN_SOURCE_CARD);

  if (crystalsGained === 0 && tokensGained === 0) {
    return {
      state,
      description: `Already at max ${color} crystals`,
    };
  }

  const description = tokensGained > 0
    ? `${color} crystal full — gained ${color} mana token instead`
    : `Gained ${color} crystal`;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description,
  };
}
