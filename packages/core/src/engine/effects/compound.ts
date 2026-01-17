/**
 * Compound Effect Resolution
 *
 * Handles effects that contain or depend on other effects:
 * - CompoundEffect: Execute multiple effects in sequence
 * - ConditionalEffect: Branch based on game state conditions
 * - ScalingEffect: Multiply base effect by a dynamic factor
 *
 * @module effects/compound
 *
 * @remarks Compound Effects Overview
 * - Compound effects execute sub-effects sequentially until done or choice required
 * - Conditional effects evaluate a condition to pick then/else branch
 * - Scaling effects multiply a base effect's amount by a dynamic count
 * - All three can recursively contain other effects, including themselves
 *
 * @example Resolution Flow
 * ```
 * CompoundEffect:
 *   effect1 → effect2 → effect3
 *   (stops if any returns requiresChoice=true)
 *
 * ConditionalEffect:
 *   evaluateCondition()
 *     ├─ true  → resolve thenEffect
 *     └─ false → resolve elseEffect (if present)
 *
 * ScalingEffect:
 *   evaluateScalingFactor() → scaledAmount = base + (count × perUnit)
 *   → resolve baseEffect with scaled amount
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type {
  CardEffect,
  CompoundEffect as CompoundEffectType,
  ConditionalEffect as ConditionalEffectType,
  ScalingEffect as ScalingEffectType,
  ScalableBaseEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { evaluateCondition } from "./conditionEvaluator.js";
import { evaluateScalingFactor } from "./scalingEvaluator.js";

// ============================================================================
// RESOLVER TYPE
// ============================================================================

/**
 * Type for the recursive resolver function passed from the main dispatcher.
 * Allows compound effects to resolve sub-effects without circular imports.
 */
export type EffectResolver = (
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string
) => EffectResolutionResult;

// ============================================================================
// COMPOUND EFFECT
// ============================================================================

/**
 * Resolves a CompoundEffect by executing sub-effects in sequence.
 *
 * Stops and returns immediately if any sub-effect requires a choice.
 * Accumulates descriptions from all resolved effects.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The compound effect containing sub-effects
 * @param sourceCardId - Optional ID of the card that triggered this effect
 * @param resolveEffect - Callback to resolve sub-effects
 * @returns Updated state with accumulated descriptions
 *
 * @example
 * ```typescript
 * // Compound: [GainMove(2), GainInfluence(1)]
 * // Result: "Gained 2 Move, Gained 1 Influence"
 * ```
 */
export function resolveCompoundEffect(
  state: GameState,
  playerId: string,
  effect: CompoundEffectType,
  sourceCardId: string | undefined,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  return resolveCompoundEffectList(state, playerId, effect.effects, sourceCardId, resolveEffect);
}

/**
 * Internal helper to resolve a list of effects in sequence.
 * Exported for use by the main resolver when handling EFFECT_COMPOUND.
 */
export function resolveCompoundEffectList(
  state: GameState,
  playerId: string,
  effects: readonly CardEffect[],
  sourceCardId: string | undefined,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  let currentState = state;
  const descriptions: string[] = [];

  for (const subEffect of effects) {
    const result = resolveEffect(currentState, playerId, subEffect, sourceCardId);
    if (result.requiresChoice) {
      return result; // Stop at first choice
    }
    currentState = result.state;
    descriptions.push(result.description);
  }

  return {
    state: currentState,
    description: descriptions.join(", "),
  };
}

// ============================================================================
// CONDITIONAL EFFECT
// ============================================================================

/**
 * Resolves a ConditionalEffect by evaluating the condition and branching.
 *
 * Evaluates the condition against current game state, then resolves either
 * the thenEffect (if true) or elseEffect (if false and present).
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The conditional effect with condition and branches
 * @param sourceCardId - Optional ID of the card that triggered this effect
 * @param resolveEffect - Callback to resolve the chosen branch
 * @returns Result with containsConditional=true for undo tracking
 *
 * @remarks Undo Implications
 * Conditionals make commands non-reversible because the condition
 * may evaluate differently if state changes (e.g., time of day).
 *
 * @example
 * ```typescript
 * // "If day, gain 2 Move; else gain 1 Move"
 * const effect: ConditionalEffect = {
 *   type: EFFECT_CONDITIONAL,
 *   condition: { type: "is_day" },
 *   thenEffect: { type: EFFECT_GAIN_MOVE, amount: 2 },
 *   elseEffect: { type: EFFECT_GAIN_MOVE, amount: 1 },
 * };
 * ```
 */
export function resolveConditionalEffect(
  state: GameState,
  playerId: string,
  effect: ConditionalEffectType,
  sourceCardId: string | undefined,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const conditionMet = evaluateCondition(state, playerId, effect.condition);

  const effectToApply = conditionMet ? effect.thenEffect : effect.elseEffect;

  if (!effectToApply) {
    // Condition not met and no else — no-op
    return {
      state,
      description: "Condition not met (no else branch)",
      containsConditional: true,
    };
  }

  const result = resolveEffect(state, playerId, effectToApply, sourceCardId);

  // Mark that a conditional was resolved — affects undo
  return {
    ...result,
    containsConditional: true,
  };
}

// ============================================================================
// SCALING EFFECT
// ============================================================================

/**
 * Resolves a ScalingEffect by calculating the dynamic multiplier.
 *
 * Evaluates the scaling factor (e.g., "per enemy", "per wound in hand"),
 * calculates the bonus, applies min/max bounds, and resolves the base
 * effect with the scaled amount.
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The scaling effect with base effect and scaling parameters
 * @param sourceCardId - Optional ID of the card that triggered this effect
 * @param resolveEffect - Callback to resolve the scaled base effect
 * @returns Result with containsScaling=true for undo tracking
 *
 * @remarks Scaling Calculation
 * ```
 * scalingCount = evaluateScalingFactor(state, playerId, effect.scalingFactor)
 * bonus = scalingCount × effect.amountPerUnit
 * totalBonus = clamp(bonus, effect.minimum, effect.maximum)
 * finalAmount = baseEffect.amount + totalBonus
 * ```
 *
 * @remarks Undo Implications
 * Scaling makes commands non-reversible because the scaling count
 * may change if state changes (e.g., enemies defeated, wounds healed).
 *
 * @example
 * ```typescript
 * // "Gain 1 Attack per enemy in combat (min 2, max 5)"
 * const effect: ScalingEffect = {
 *   type: EFFECT_SCALING,
 *   baseEffect: { type: EFFECT_GAIN_ATTACK, amount: 0, combatType: "melee" },
 *   scalingFactor: { type: "enemy_count" },
 *   amountPerUnit: 1,
 *   minimum: 2,
 *   maximum: 5,
 * };
 * ```
 */
export function resolveScalingEffect(
  state: GameState,
  playerId: string,
  effect: ScalingEffectType,
  sourceCardId: string | undefined,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const scalingCount = evaluateScalingFactor(state, playerId, effect.scalingFactor);
  const scalingBonus = scalingCount * effect.amountPerUnit;

  // Apply minimum/maximum
  let totalBonus = scalingBonus;
  if (effect.minimum !== undefined) {
    totalBonus = Math.max(effect.minimum, totalBonus);
  }
  if (effect.maximum !== undefined) {
    totalBonus = Math.min(effect.maximum, totalBonus);
  }

  // Create modified base effect with increased amount
  const scaledEffect: ScalableBaseEffect = {
    ...effect.baseEffect,
    amount: effect.baseEffect.amount + totalBonus,
  };

  // Resolve the scaled effect
  const result = resolveEffect(state, playerId, scaledEffect, sourceCardId);

  // Mark that a scaling effect was resolved — affects undo
  return {
    ...result,
    description: `${result.description} (scaled by ${scalingCount})`,
    containsScaling: true,
  };
}
