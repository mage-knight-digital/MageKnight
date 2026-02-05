/**
 * Atomic modifier effect handlers
 *
 * Handles effects that apply modifiers to game state:
 * - ApplyModifier (terrain cost reduction, sideways value changes, etc.)
 */

import type { GameState } from "../../state/GameState.js";
import type { CardId } from "@mage-knight/shared";
import type { ApplyModifierEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { addModifier } from "../modifiers/index.js";
import { SOURCE_CARD, SCOPE_SELF } from "../../types/modifierConstants.js";

// ============================================================================
// EFFECT HANDLERS
// ============================================================================

/**
 * Apply an ApplyModifier effect - adds a modifier to the game state.
 *
 * Modifiers have:
 * - Duration: turn, combat, round, permanent
 * - Scope: self, all players, etc.
 * - Effect: the actual modification (terrain cost, sideways value, rules)
 *
 * Used by cards that provide ongoing effects like reduced terrain costs
 * or increased sideways values for certain card types.
 */
export function applyModifierEffect(
  state: GameState,
  playerId: string,
  effect: ApplyModifierEffect,
  sourceCardId?: string
): EffectResolutionResult {
  // Use scope from effect if provided, otherwise default to SCOPE_SELF
  const scope = effect.scope ?? { type: SCOPE_SELF };

  const newState = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "unknown") as CardId,
      playerId,
    },
    duration: effect.duration,
    scope,
    effect: effect.modifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: newState,
    description: effect.description ?? "Applied modifier",
  };
}
