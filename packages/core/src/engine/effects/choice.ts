/**
 * Choice Effect Resolution
 *
 * Handles effects that require player selection from multiple options.
 *
 * @module effects/choice
 *
 * @remarks Choice Effect Overview
 * - ChoiceEffect presents multiple options to the player
 * - Resolution pauses until player selects an option via RESOLVE_CHOICE action
 * - The selected option is then resolved as a separate effect
 * - Options can be any CardEffect type (including nested choices)
 *
 * @example Resolution Flow
 * ```
 * ChoiceEffect with options [A, B, C]
 *   └─► Returns { requiresChoice: true }
 *       └─► Player sends RESOLVE_CHOICE with choiceIndex
 *           └─► Selected option resolved as normal effect
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { ChoiceEffect as ChoiceEffectType } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { registerEffect } from "./effectRegistry.js";
import { EFFECT_CHOICE } from "../../types/effectTypes.js";

// ============================================================================
// CHOICE EFFECT
// ============================================================================

/**
 * Handles a ChoiceEffect by signaling that player input is required.
 *
 * This function does NOT resolve the choice - it returns immediately
 * with `requiresChoice: true`. The actual choice resolution happens
 * when the player sends a RESOLVE_CHOICE action, which the command
 * layer handles by calling resolveEffect with the selected option.
 *
 * @param state - Current game state (returned unchanged)
 * @param _playerId - ID of the player (unused, choice handling is stateless)
 * @param _effect - The choice effect (unused, options are in pendingChoice)
 * @returns Result with requiresChoice=true
 *
 * @remarks Two-Phase Choice Resolution
 * Phase 1 (this function):
 *   - Effect system encounters ChoiceEffect
 *   - Returns requiresChoice=true
 *   - Command layer stores effect in player.pendingChoice
 *
 * Phase 2 (RESOLVE_CHOICE action):
 *   - Player selects an option (sends choiceIndex)
 *   - Command layer retrieves option from pendingChoice
 *   - Calls resolveEffect with the selected option
 *   - Clears pendingChoice
 *
 * @example
 * ```typescript
 * // Card with choice between Move or Influence
 * const choiceEffect: ChoiceEffect = {
 *   type: EFFECT_CHOICE,
 *   options: [
 *     { type: EFFECT_GAIN_MOVE, amount: 2 },
 *     { type: EFFECT_GAIN_INFLUENCE, amount: 2 },
 *   ],
 * };
 *
 * const result = resolveChoiceEffect(state, playerId, choiceEffect);
 * // result.requiresChoice === true
 * // UI shows choice dialog
 * // Player picks option 0
 * // Command layer resolves: resolveEffect(state, playerId, options[0])
 * ```
 */
export function resolveChoiceEffect(
  state: GameState,
  _playerId: string,
  _effect: ChoiceEffectType
): EffectResolutionResult {
  // Choice effects pause resolution until player selects an option.
  // The command layer will:
  // 1. Store the effect options in player.pendingChoice
  // 2. Wait for RESOLVE_CHOICE action with the player's selection
  // 3. Call resolveEffect with the selected option

  return {
    state,
    description: "Choice required",
    requiresChoice: true,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all choice effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerChoiceEffects(): void {
  registerEffect(EFFECT_CHOICE, (state, playerId, effect) => {
    return resolveChoiceEffect(state, playerId, effect as ChoiceEffectType);
  });
}
