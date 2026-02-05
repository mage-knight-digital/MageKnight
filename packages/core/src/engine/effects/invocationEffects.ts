/**
 * Invocation Effect Resolution
 *
 * Handles the EFFECT_INVOCATION_RESOLVE effect for Arythea's Invocation skill.
 * Atomically discards a card from hand and gains a mana token.
 *
 * @module effects/invocationEffects
 *
 * @remarks
 * - Wound cards are returned to the wound pile (not discard pile)
 * - Non-wound cards go to the discard pile
 * - Mana token is added with MANA_TOKEN_SOURCE_SKILL source
 *
 * @example Resolution Flow
 * ```
 * Player activates Invocation skill
 *   └─► applyInvocationEffect creates pendingChoice with INVOCATION_RESOLVE options
 *       └─► Player selects option (card + mana color)
 *           └─► resolveInvocation discards card, adds mana token
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, ManaToken } from "../../types/player.js";
import type { InvocationResolveEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { MANA_TOKEN_SOURCE_SKILL } from "@mage-knight/shared";
import { EFFECT_INVOCATION_RESOLVE } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";

/**
 * Resolve an Invocation effect - discard a card and gain a mana token.
 *
 * Wound cards are returned to the wound pile (unlimited supply).
 * Non-wound cards go to the player's discard pile.
 */
export function resolveInvocation(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: InvocationResolveEffect
): EffectResolutionResult {
  const { cardId, isWound, manaColor } = effect;

  // Step 1: Remove the card from hand
  const handIndex = player.hand.indexOf(cardId);
  if (handIndex === -1) {
    return {
      state,
      description: `Card ${cardId} not found in hand`,
    };
  }

  const updatedHand = [...player.hand];
  updatedHand.splice(handIndex, 1);

  // Step 2: Handle discard destination
  let updatedDiscard = player.discard;
  let updatedState = state;

  if (isWound) {
    // Wounds go back to the wound pile
    const newWoundPileCount =
      state.woundPileCount === null ? null : state.woundPileCount + 1;
    updatedState = { ...state, woundPileCount: newWoundPileCount };
  } else {
    // Non-wound cards go to discard pile
    updatedDiscard = [...player.discard, cardId];
  }

  // Step 3: Add mana token
  const newToken: ManaToken = {
    color: manaColor,
    source: MANA_TOKEN_SOURCE_SKILL,
  };

  const updatedPlayer: Player = {
    ...player,
    hand: updatedHand,
    discard: updatedDiscard,
    pureMana: [...player.pureMana, newToken],
  };

  // Step 4: Apply player update to state
  const players = [...updatedState.players];
  players[playerIndex] = updatedPlayer;
  updatedState = { ...updatedState, players };

  return {
    state: updatedState,
    description: effect.description,
  };
}

/**
 * Register the Invocation effect handler with the effect registry.
 * Called during effect system initialization.
 */
export function registerInvocationEffects(): void {
  registerEffect(EFFECT_INVOCATION_RESOLVE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolveInvocation(
      state,
      playerIndex,
      player,
      effect as InvocationResolveEffect
    );
  });
}
