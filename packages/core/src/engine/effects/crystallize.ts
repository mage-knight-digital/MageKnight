/**
 * Crystallize Effect Resolution
 *
 * Handles effects that convert mana tokens to crystals.
 *
 * @module effects/crystallize
 *
 * @remarks Crystallize Overview
 * - EFFECT_CONVERT_MANA_TO_CRYSTAL: Entry point, generates color choices
 * - EFFECT_CRYSTALLIZE_COLOR: Final resolution, consumes token and gains crystal
 * - Only basic colors (red, blue, green, white) can become crystals
 * - Black mana cannot be crystallized (no black crystals exist)
 *
 * @example Resolution Flow
 * ```
 * CONVERT_MANA_TO_CRYSTAL
 *   ├─ 1 color available → auto-resolve to CRYSTALLIZE_COLOR
 *   └─ Multiple colors → generate choice options
 *         └─► Player selects color
 *             └─► CRYSTALLIZE_COLOR with selected color
 *                   └─► Remove token, add crystal
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ConvertManaToCrystalEffect,
  CrystallizeColorEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import { EFFECT_CRYSTALLIZE_COLOR } from "../../types/effectTypes.js";
import { updatePlayer } from "./atomicEffects.js";

// ============================================================================
// CONVERT MANA TO CRYSTAL (Entry Point)
// ============================================================================

/**
 * Entry point for crystallize - determines available colors and generates choice.
 *
 * Scans player's mana tokens for basic colors (red, blue, green, white).
 * If only one color is available, auto-resolves. Otherwise, generates
 * choice options for the player to select which token to convert.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param player - The player object
 * @param _effect - The convert mana to crystal effect (unused, no parameters)
 * @param sourceCardId - Optional ID of the source card
 * @param resolveEffect - Callback for recursive resolution (used for auto-resolve)
 * @returns Choice options or auto-resolved crystal gain
 *
 * @example
 * ```typescript
 * // Player has red and blue mana tokens
 * // Returns choice between crystallize_red and crystallize_blue
 *
 * // Player has only red mana token
 * // Auto-resolves to gain red crystal
 * ```
 */
export function resolveConvertManaToCrystal(
  state: GameState,
  playerId: string,
  player: Player,
  _effect: ConvertManaToCrystalEffect,
  sourceCardId: string | undefined,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  // Player must choose which mana token to convert to crystal
  // Only basic colors (red, blue, green, white) can become crystals
  const basicColors = ["red", "blue", "green", "white"] as const;
  const availableColors = new Set(
    player.pureMana
      .filter((token) => basicColors.includes(token.color as (typeof basicColors)[number]))
      .map((token) => token.color)
  );

  if (availableColors.size === 0) {
    // No valid tokens to convert - shouldn't happen if isEffectResolvable was checked
    return {
      state,
      description: "No mana tokens available to convert",
    };
  }

  if (availableColors.size === 1) {
    // Auto-resolve: only one color available, no meaningful choice
    const color = [...availableColors][0] as "red" | "blue" | "green" | "white";
    const crystallizeEffect: CrystallizeColorEffect = {
      type: EFFECT_CRYSTALLIZE_COLOR,
      color,
    };
    const result = resolveEffect(state, playerId, crystallizeEffect, sourceCardId);
    // CRITICAL: Return resolvedEffect so command layer knows what to undo
    return {
      ...result,
      resolvedEffect: crystallizeEffect,
    };
  }

  // Multiple colors available - generate choice options
  const choiceOptions: CrystallizeColorEffect[] = [...availableColors].map((color) => ({
    type: EFFECT_CRYSTALLIZE_COLOR as typeof EFFECT_CRYSTALLIZE_COLOR,
    color: color as "red" | "blue" | "green" | "white",
  }));

  return {
    state,
    description: "Choose mana token to convert to crystal",
    requiresChoice: true,
    dynamicChoiceOptions: choiceOptions,
  };
}

// ============================================================================
// CRYSTALLIZE COLOR (Final Resolution)
// ============================================================================

/**
 * Final crystallize resolution - consumes a mana token and gains a crystal.
 *
 * Finds a mana token of the specified color, removes it from pureMana,
 * and increments the corresponding crystal count.
 *
 * @param state - Current game state
 * @param playerIndex - Index of the player in state.players array
 * @param player - The player object
 * @param effect - The crystallize effect with the selected color
 * @returns Updated state with token removed and crystal gained
 *
 * @example
 * ```typescript
 * // Player has 2 red mana tokens and 0 red crystals
 * // After crystallize_red: 1 red token, 1 red crystal
 * ```
 */
export function resolveCrystallizeColor(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: CrystallizeColorEffect
): EffectResolutionResult {
  // Consume one mana token of the specified color and gain a crystal of that color
  const tokenIndex = player.pureMana.findIndex((t) => t.color === effect.color);
  if (tokenIndex === -1) {
    return {
      state,
      description: `No ${effect.color} mana token to convert`,
    };
  }

  // Remove the mana token
  const newPureMana = [...player.pureMana];
  newPureMana.splice(tokenIndex, 1);

  // Gain the crystal
  const updatedPlayer: Player = {
    ...player,
    pureMana: newPureMana,
    crystals: {
      ...player.crystals,
      [effect.color]: player.crystals[effect.color] + 1,
    },
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Converted ${effect.color} mana to ${effect.color} crystal`,
  };
}
