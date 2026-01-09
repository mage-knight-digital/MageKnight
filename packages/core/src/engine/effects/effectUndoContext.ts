/**
 * Effect Undo Context - type-safe undo data for complex effects
 *
 * Some effects modify state beyond just the player (e.g., Mana Draw modifies source dice).
 * The standard reverseEffect(player, effect) approach can't handle these because it only
 * has access to player state.
 *
 * This module provides:
 * 1. A discriminated union of undo contexts for each effect type that needs special handling
 * 2. captureUndoContext() - called during execute to capture state before the effect runs
 * 3. applyUndoContext() - called during undo to restore state using the captured context
 *
 * The closure in resolveChoiceCommand stores the captured context and uses it during undo.
 */

import type { GameState } from "../../state/GameState.js";
import type { ManaColor, BasicManaColor } from "@mage-knight/shared";
import type { CardEffect, ManaDrawSetColorEffect } from "../../types/cards.js";
import { EFFECT_MANA_DRAW_SET_COLOR } from "../../types/effectTypes.js";

// === Undo Context Types (Discriminated Union) ===

/**
 * Undo context for EFFECT_MANA_DRAW_SET_COLOR
 * Captures the die's original state before it was modified
 */
export interface ManaDrawSetColorUndoContext {
  readonly type: typeof EFFECT_MANA_DRAW_SET_COLOR;
  readonly dieId: string;
  readonly originalColor: ManaColor;
  readonly originalTakenByPlayerId: string | null;
  readonly tokenColor: BasicManaColor;
  readonly tokensGained: number;
}

/**
 * Union of all effect undo contexts
 * Add new context types here as needed
 */
export type EffectUndoContext = ManaDrawSetColorUndoContext;
// Future: | ReadyUnitUndoContext | CardBoostUndoContext | ...

// === Capture Functions ===

/**
 * Capture undo context before an effect is applied.
 * Returns null if the effect doesn't need special undo handling.
 *
 * Call this BEFORE resolveEffect() to capture the "before" state.
 */
export function captureUndoContext(
  state: GameState,
  effect: CardEffect
): EffectUndoContext | null {
  switch (effect.type) {
    case EFFECT_MANA_DRAW_SET_COLOR: {
      const manaDrawEffect = effect as ManaDrawSetColorEffect;
      const die = state.source.dice.find((d) => d.id === manaDrawEffect.dieId);

      if (!die) {
        // Die not found - can't capture context, but shouldn't happen
        return null;
      }

      return {
        type: EFFECT_MANA_DRAW_SET_COLOR,
        dieId: manaDrawEffect.dieId,
        originalColor: die.color,
        originalTakenByPlayerId: die.takenByPlayerId,
        tokenColor: manaDrawEffect.color,
        tokensGained: manaDrawEffect.tokensPerDie,
      };
    }

    default:
      // Effect doesn't need special undo context
      return null;
  }
}

// === Apply Functions ===

/**
 * Apply undo context to restore state.
 * This handles the non-player state changes (e.g., source dice).
 *
 * Player state changes are still handled by reverseEffect().
 * This function handles everything else.
 */
export function applyUndoContext(
  state: GameState,
  playerId: string,
  context: EffectUndoContext
): GameState {
  switch (context.type) {
    case EFFECT_MANA_DRAW_SET_COLOR: {
      // Restore the die to its original state
      const updatedDice = state.source.dice.map((die) =>
        die.id === context.dieId
          ? {
              ...die,
              color: context.originalColor,
              takenByPlayerId: context.originalTakenByPlayerId,
            }
          : die
      );

      // Remove the mana tokens that were gained
      const playerIndex = state.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) {
        return { ...state, source: { ...state.source, dice: updatedDice } };
      }

      const player = state.players[playerIndex];
      if (!player) {
        return { ...state, source: { ...state.source, dice: updatedDice } };
      }

      // Remove tokensGained tokens of tokenColor from pureMana
      let tokensToRemove = context.tokensGained;
      const newPureMana = player.pureMana.filter((token) => {
        if (tokensToRemove > 0 && token.color === context.tokenColor) {
          tokensToRemove--;
          return false; // Remove this token
        }
        return true; // Keep this token
      });

      // Remove dieId from manaDrawDieIds
      const newManaDrawDieIds = player.manaDrawDieIds.filter(
        (id) => id !== context.dieId
      );

      const updatedPlayer = {
        ...player,
        pureMana: newPureMana,
        manaDrawDieIds: newManaDrawDieIds,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return {
        ...state,
        source: { ...state.source, dice: updatedDice },
        players: updatedPlayers,
      };
    }

    // When more context types are added, uncomment this for exhaustiveness checking:
    // default: {
    //   const _exhaustive: never = context;
    //   return _exhaustive;
    // }
  }
}
