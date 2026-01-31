/**
 * Mana payment effect handlers
 *
 * Handles effects that require paying mana as a cost.
 * Used by skills that require mana to activate.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { PayManaCostEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { ManaColor } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";

/**
 * Get available mana tokens that match the allowed colors.
 */
export function getPayableManaColors(
  player: Player,
  allowedColors: readonly ManaColor[]
): ManaColor[] {
  const available = new Set<ManaColor>();
  for (const token of player.pureMana) {
    if (allowedColors.includes(token.color)) {
      available.add(token.color);
    }
  }
  return [...available];
}

/**
 * Count how many tokens of a specific color the player has.
 */
export function countManaTokens(player: Player, color: ManaColor): number {
  return player.pureMana.filter((t) => t.color === color).length;
}

/**
 * Handle the EFFECT_PAY_MANA entry point.
 * Checks if payment is possible and either auto-resolves or requests a choice.
 */
export function handlePayMana(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: PayManaCostEffect
): EffectResolutionResult {
  const availableColors = getPayableManaColors(player, effect.colors);

  if (availableColors.length === 0) {
    return {
      state,
      description: "No matching mana tokens to pay",
    };
  }

  // Check if any single color can satisfy the full amount
  const viableColors = availableColors.filter(
    (color) => countManaTokens(player, color) >= effect.amount
  );

  if (viableColors.length === 0) {
    return {
      state,
      description: `Not enough mana tokens to pay (need ${effect.amount})`,
    };
  }

  // If only one viable color, auto-resolve
  if (viableColors.length === 1) {
    const color = viableColors[0];
    if (!color) {
      throw new Error("Expected single viable color");
    }
    return applyPayMana(state, playerIndex, player, color, effect.amount);
  }

  // Multiple viable colors — player must choose
  return {
    state,
    description: `Choose mana color to pay (${effect.amount} tokens)`,
    requiresChoice: true,
  };
}

/**
 * Apply the mana payment - remove tokens of the specified color.
 */
export function applyPayMana(
  state: GameState,
  playerIndex: number,
  player: Player,
  color: ManaColor,
  amount: number
): EffectResolutionResult {
  let tokensRemoved = 0;
  const newPureMana = [...player.pureMana];

  // Remove tokens of the specified color
  for (let i = newPureMana.length - 1; i >= 0 && tokensRemoved < amount; i--) {
    if (newPureMana[i]?.color === color) {
      newPureMana.splice(i, 1);
      tokensRemoved++;
    }
  }

  if (tokensRemoved < amount) {
    return {
      state,
      description: `Not enough ${color} mana tokens (needed ${amount}, had ${tokensRemoved})`,
    };
  }

  const updatedPlayer: Player = {
    ...player,
    pureMana: newPureMana,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Paid ${amount} ${color} mana`,
  };
}
