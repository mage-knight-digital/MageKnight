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
import type { ManaColor, BasicManaColor, CardId } from "@mage-knight/shared";
import type { CardEffect, ManaDrawSetColorEffect, ResolveBoostTargetEffect } from "../../types/cards.js";
import {
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
  EFFECT_RESOLVE_CIRCLET_POWERED_SKILL,
  EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
} from "../../types/effectTypes.js";
import { getCard } from "../helpers/cardLookup.js";
import { addBonusToEffect } from "./cardBoostEffects.js";
import { reverseEffect } from "./reverse.js";
import { getPlayerIndexById } from "../helpers/playerHelpers.js";

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
 * Undo context for EFFECT_RESOLVE_BOOST_TARGET
 * Captures the boosted card and effect for reversal
 */
export interface CardBoostUndoContext {
  readonly type: typeof EFFECT_RESOLVE_BOOST_TARGET;
  readonly targetCardId: CardId;
  readonly handIndex: number; // Position in hand before it was moved to play area
  readonly boostedEffect: CardEffect; // The effect with bonus applied that needs reversing
}

/**
 * Undo context for EFFECT_RESOLVE_MYSTERIOUS_BOX_USE
 * Captures full pre-resolution state to safely restore nested copied effects.
 */
export interface MysteriousBoxUseUndoContext {
  readonly type: typeof EFFECT_RESOLVE_MYSTERIOUS_BOX_USE;
  readonly stateSnapshot: GameState;
}

/**
 * Undo context for EFFECT_RESOLVE_CIRCLET_BASIC_SKILL
 * Captures full pre-resolution state because skill execution can modify
 * many subsystems (cooldowns, modifiers, choices, source, etc.).
 */
export interface CircletBasicSkillUndoContext {
  readonly type: typeof EFFECT_RESOLVE_CIRCLET_BASIC_SKILL;
  readonly stateSnapshot: GameState;
}

/**
 * Undo context for EFFECT_RESOLVE_CIRCLET_POWERED_SKILL
 * Captures full pre-resolution state because acquisition may affect offers,
 * decks, RNG, and player skill state.
 */
export interface CircletPoweredSkillUndoContext {
  readonly type: typeof EFFECT_RESOLVE_CIRCLET_POWERED_SKILL;
  readonly stateSnapshot: GameState;
}

/**
 * Union of all effect undo contexts
 * Add new context types here as needed
 */
export type EffectUndoContext =
  | ManaDrawSetColorUndoContext
  | CardBoostUndoContext
  | MysteriousBoxUseUndoContext
  | CircletBasicSkillUndoContext
  | CircletPoweredSkillUndoContext;

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

    case EFFECT_RESOLVE_BOOST_TARGET: {
      const boostEffect = effect as ResolveBoostTargetEffect;
      const targetCard = getCard(boostEffect.targetCardId);

      if (!targetCard) {
        return null;
      }

      // Find the card's current position in hand
      const player = state.players.find((p) => p.hand.includes(boostEffect.targetCardId));
      if (!player) {
        return null;
      }

      const handIndex = player.hand.indexOf(boostEffect.targetCardId);

      // Compute the boosted effect that will be applied (needed for reversal)
      const boostedEffect = addBonusToEffect(targetCard.poweredEffect, boostEffect.bonus);

      return {
        type: EFFECT_RESOLVE_BOOST_TARGET,
        targetCardId: boostEffect.targetCardId,
        handIndex,
        boostedEffect,
      };
    }

    case EFFECT_RESOLVE_MYSTERIOUS_BOX_USE: {
      return {
        type: EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
        stateSnapshot: state,
      };
    }

    case EFFECT_RESOLVE_CIRCLET_BASIC_SKILL: {
      return {
        type: EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
        stateSnapshot: state,
      };
    }

    case EFFECT_RESOLVE_CIRCLET_POWERED_SKILL: {
      return {
        type: EFFECT_RESOLVE_CIRCLET_POWERED_SKILL,
        stateSnapshot: state,
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
      const playerIndex = getPlayerIndexById(state, playerId);
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

    case EFFECT_RESOLVE_BOOST_TARGET: {
      // 1. Reverse the boosted effect (removes move points, attack, etc.)
      const playerIndex = getPlayerIndexById(state, playerId);
      if (playerIndex === -1) {
        return state;
      }

      const player = state.players[playerIndex];
      if (!player) {
        return state;
      }

      // Reverse the boosted effect to remove the gained values
      const playerAfterReverse = reverseEffect(player, context.boostedEffect);

      // 2. Move the card from play area back to hand at its original position
      const cardIndex = playerAfterReverse.playArea.indexOf(context.targetCardId);
      if (cardIndex === -1) {
        // Card not in play area, just update with reversed effect
        const updatedPlayers = [...state.players];
        updatedPlayers[playerIndex] = playerAfterReverse;
        return { ...state, players: updatedPlayers };
      }

      // Remove from play area
      const newPlayArea = [...playerAfterReverse.playArea];
      newPlayArea.splice(cardIndex, 1);

      // Insert back into hand at original position
      const newHand = [...playerAfterReverse.hand];
      newHand.splice(context.handIndex, 0, context.targetCardId);

      const updatedPlayer = {
        ...playerAfterReverse,
        hand: newHand,
        playArea: newPlayArea,
      };

      const updatedPlayers = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      return { ...state, players: updatedPlayers };
    }

    case EFFECT_RESOLVE_MYSTERIOUS_BOX_USE: {
      return context.stateSnapshot;
    }

    case EFFECT_RESOLVE_CIRCLET_BASIC_SKILL: {
      return context.stateSnapshot;
    }

    case EFFECT_RESOLVE_CIRCLET_POWERED_SKILL: {
      return context.stateSnapshot;
    }
  }
}
