/**
 * Card Boost Effect Resolution
 *
 * Handles effects that boost other cards when played:
 * - EFFECT_CARD_BOOST: Entry point, generates card selection choices
 * - EFFECT_RESOLVE_BOOST_TARGET: Plays selected card with boosted powered effect
 *
 * @module effects/cardBoostResolvers
 *
 * @remarks Card Boost Overview
 * - Used by Concentration (+2 bonus) and Will Focus (+3 bonus)
 * - Player selects an Action card from hand
 * - Selected card moves to play area
 * - Card's powered effect resolves with bonus added to amounts
 * - Only Basic Action and Advanced Action cards are eligible
 *
 * @example Resolution Flow
 * ```
 * EFFECT_CARD_BOOST (bonus: 2)
 *   └─► Find eligible Action cards in hand
 *       └─► Generate RESOLVE_BOOST_TARGET options
 *           └─► Player selects a card
 *               └─► RESOLVE_BOOST_TARGET
 *                   ├─► Move card from hand to play area
 *                   └─► Resolve powered effect with +2 to amounts
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  CardBoostEffect,
  ResolveBoostTargetEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import { getCard } from "../helpers/cardLookup.js";
import { updatePlayer } from "./atomicEffects.js";
import {
  getEligibleBoostTargets,
  generateBoostChoiceOptions,
  addBonusToEffect,
} from "./cardBoostEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_CARD_BOOST, EFFECT_RESOLVE_BOOST_TARGET } from "../../types/effectTypes.js";

// ============================================================================
// CARD BOOST (Entry Point)
// ============================================================================

/**
 * Entry point for card boost - finds eligible cards and generates selection.
 *
 * Scans player's hand for eligible Action cards (Basic or Advanced Action,
 * not wounds/spells/artifacts). Generates RESOLVE_BOOST_TARGET choice options
 * for each eligible card.
 *
 * @param state - Current game state
 * @param player - The player resolving the effect
 * @param effect - The card boost effect with bonus amount
 * @returns Choice options for card selection, or error if no eligible cards
 *
 * @example
 * ```typescript
 * // Player has March, Rage, and a Wound in hand
 * // Returns choices for March and Rage (Wound not eligible)
 * ```
 */
export function resolveCardBoostEffect(
  state: GameState,
  player: Player,
  effect: CardBoostEffect
): EffectResolutionResult {
  // Card boost: player must choose an Action card from hand to play with boosted powered effect
  const eligibleCards = getEligibleBoostTargets(player);

  if (eligibleCards.length === 0) {
    return {
      state,
      description: "No eligible Action cards in hand to boost",
    };
  }

  return {
    state,
    description: "Choose an Action card to boost",
    requiresChoice: true,
    dynamicChoiceOptions: generateBoostChoiceOptions(eligibleCards, effect.bonus),
  };
}

// ============================================================================
// RESOLVE BOOST TARGET
// ============================================================================

/**
 * Resolves the selected boost target - plays card with boosted powered effect.
 *
 * Moves the selected card from hand to play area, then resolves its
 * powered effect with the bonus added to all scalable amounts (Move,
 * Influence, Attack, Block).
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param playerIndex - Index of the player in state.players array
 * @param player - The player object
 * @param effect - The resolve boost target effect with card ID and bonus
 * @param resolveEffect - Callback for resolving the boosted powered effect
 * @returns Result of resolving the boosted powered effect
 *
 * @example
 * ```typescript
 * // Target card: Rage (powered: Gain 4 Attack)
 * // Bonus: +2
 * // Result: Rage moves to play area, player gains 6 Attack
 * ```
 */
export function resolveBoostTargetEffect(
  state: GameState,
  playerId: string,
  playerIndex: number,
  player: Player,
  effect: ResolveBoostTargetEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  // Resolve the boosted card's powered effect with the bonus applied
  const targetCard = getCard(effect.targetCardId);
  if (!targetCard) {
    return {
      state,
      description: `Card not found: ${effect.targetCardId}`,
    };
  }

  // Move the target card from hand to play area
  const cardIndex = player.hand.indexOf(effect.targetCardId);
  if (cardIndex === -1) {
    return {
      state,
      description: `Card not in hand: ${effect.targetCardId}`,
    };
  }

  const newHand = [...player.hand];
  newHand.splice(cardIndex, 1);
  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
    playArea: [...player.playArea, effect.targetCardId],
  };
  const stateWithCardPlayed = updatePlayer(state, playerIndex, updatedPlayer);

  // Apply bonus to the powered effect and resolve it
  const boostedEffect = addBonusToEffect(targetCard.poweredEffect, effect.bonus);
  const result = resolveEffect(stateWithCardPlayed, playerId, boostedEffect, effect.targetCardId);

  const nestedResolvedEffect =
    result.resolvedEffect ?? (result.requiresChoice ? boostedEffect : undefined);

  return {
    ...result,
    ...(nestedResolvedEffect && { resolvedEffect: nestedResolvedEffect }),
    description: `Boosted ${targetCard.name}: ${result.description}`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register all card boost effect handlers with the effect registry.
 * Called during effect system initialization.
 *
 * @param resolver - The main resolveEffect function for recursive resolution
 */
export function registerCardBoostEffects(resolver: EffectResolver): void {
  registerEffect(EFFECT_CARD_BOOST, (state, playerId, effect) => {
    const { player } = getPlayerContext(state, playerId);
    return resolveCardBoostEffect(state, player, effect as CardBoostEffect);
  });

  registerEffect(EFFECT_RESOLVE_BOOST_TARGET, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveBoostTargetEffect(
      state,
      playerId,
      playerIndex,
      player,
      effect as ResolveBoostTargetEffect,
      resolver
    );
  });
}
