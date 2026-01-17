/**
 * Effect Resolution Types
 *
 * Shared types used across all effect resolution modules.
 *
 * @module effects/types
 *
 * @remarks Type Overview
 * - `EffectResolutionResult` is the return type for all effect resolvers
 * - Contains the updated state, description, and optional choice/resolution metadata
 * - Used to chain effects and track whether choices are required
 *
 * @example Usage
 * ```typescript
 * function resolveMyEffect(state: GameState, ...): EffectResolutionResult {
 *   // Apply effect logic
 *   return {
 *     state: updatedState,
 *     description: "Effect description",
 *     requiresChoice: false,
 *   };
 * }
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { CardEffect } from "../../types/cards.js";

// ============================================================================
// EFFECT RESOLUTION RESULT
// ============================================================================

/**
 * Result of resolving a card effect.
 *
 * All effect resolver functions return this type. It encapsulates:
 * - The updated game state after applying the effect
 * - A human-readable description for UI/logging
 * - Flags indicating if further player input is needed
 * - Metadata for undo operations
 *
 * @remarks Resolution Flow
 * 1. Effect is resolved, returns result
 * 2. If `requiresChoice` is true, player must select from options
 * 3. After choice, continue resolution with selected effect
 * 4. Repeat until no choice required
 *
 * @example Simple effect
 * ```typescript
 * return {
 *   state: updatedState,
 *   description: "Gained 2 Move",
 * };
 * ```
 *
 * @example Effect requiring choice
 * ```typescript
 * return {
 *   state,
 *   description: "Choose mana color",
 *   requiresChoice: true,
 *   dynamicChoiceOptions: colorOptions,
 * };
 * ```
 */
export interface EffectResolutionResult {
  /** The game state after effect resolution (or unchanged if choice required) */
  readonly state: GameState;

  /** Human-readable description of what happened */
  readonly description: string;

  /** True if player must make a choice before resolution can continue */
  readonly requiresChoice?: boolean;

  /**
   * True if a conditional effect was resolved.
   * Affects undo - commands containing conditionals should be non-reversible
   * since the condition may evaluate differently if state changes.
   */
  readonly containsConditional?: boolean;

  /**
   * True if a scaling effect was resolved.
   * Affects undo - commands containing scaling should be non-reversible
   * since the scaling factor may change if state changes.
   */
  readonly containsScaling?: boolean;

  /**
   * Dynamically generated choice options.
   *
   * Used when the available choices depend on game state:
   * - CardBoostEffect lists eligible cards in hand
   * - CrystallizeEffect lists available mana token colors
   * - ManaDrawPowered lists available dice in source
   */
  readonly dynamicChoiceOptions?: readonly CardEffect[];

  /**
   * The effect that was actually resolved and modified state.
   *
   * CRITICAL FOR UNDO: When an entry effect (like EFFECT_CONVERT_MANA_TO_CRYSTAL)
   * internally chains to a different effect (like EFFECT_CRYSTALLIZE_COLOR), this
   * field captures what actually ran. The command layer needs this to call the
   * correct reverseEffect().
   *
   * If not set, the command assumes the original effect was what resolved.
   */
  readonly resolvedEffect?: CardEffect;
}
