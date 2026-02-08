/**
 * Blood of Ancients Effect Handlers
 *
 * Handles the Blood of Ancients advanced action card:
 *
 * Basic: Gain a Wound. Pay one mana of any color. Gain a card of that color
 * from the Advanced Actions Offer and put it into your hand.
 *
 * Powered: Gain a Wound to your hand or discard pile. Use the stronger effect
 * of any card from the Advanced Actions Offer without paying its mana cost.
 * The card remains in the offer.
 *
 * Flow (Basic):
 * 1. EFFECT_BLOOD_OF_ANCIENTS_BASIC → take wound, present mana color choices
 * 2. EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA → pay mana, present matching AAs
 * 3. EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA → gain selected AA to hand
 *
 * Flow (Powered):
 * 1. EFFECT_BLOOD_OF_ANCIENTS_POWERED → present wound destination choice
 * 2. EFFECT_RESOLVE_BLOOD_POWERED_WOUND → take wound, present AA selection
 * 3. EFFECT_RESOLVE_BLOOD_POWERED_USE_AA → resolve AA's powered effect (free)
 *
 * @module effects/bloodOfAncientsEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ResolveBloodBasicSelectAAEffect,
  ResolveBloodBasicGainAAEffect,
  ResolveBloodPoweredWoundEffect,
  ResolveBloodPoweredUseAAEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import type { CardId, BasicManaColor } from "@mage-knight/shared";
import {
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import {
  EFFECT_BLOOD_OF_ANCIENTS_BASIC,
  EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA,
  EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
  EFFECT_BLOOD_OF_ANCIENTS_POWERED,
  EFFECT_RESOLVE_BLOOD_POWERED_WOUND,
  EFFECT_RESOLVE_BLOOD_POWERED_USE_AA,
} from "../../types/effectTypes.js";
import { getActionCardColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";
import { canPayForMana, getAvailableManaSourcesForColor } from "../validActions/mana.js";
import { consumeMana } from "../commands/helpers/manaConsumptionHelpers.js";

const ALL_BASIC_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert card color to mana color.
 */
function cardColorToManaColor(color: string): BasicManaColor {
  switch (color) {
    case "red": return MANA_RED;
    case "blue": return MANA_BLUE;
    case "green": return MANA_GREEN;
    case "white": return MANA_WHITE;
    default: throw new Error(`Unknown card color: ${color}`);
  }
}

/**
 * Get AAs from the offer matching a given mana color.
 * Dual-color AAs match if any of their poweredBy colors match.
 */
function getMatchingAAsInOffer(
  state: GameState,
  color: BasicManaColor
): { cardId: CardId; name: string }[] {
  const results: { cardId: CardId; name: string }[] = [];
  for (const cardId of state.offers.advancedActions.cards) {
    const aaColor = getActionCardColor(cardId);
    if (aaColor !== null && cardColorToManaColor(aaColor) === color) {
      const card = getCard(cardId);
      results.push({ cardId, name: card?.name ?? cardId });
      continue;
    }
    // Check dual-color match via poweredBy
    const card = getCard(cardId);
    if (card && card.poweredBy.includes(color)) {
      results.push({ cardId, name: card.name ?? cardId });
    }
  }
  return results;
}

/**
 * Remove an AA from the offer and replenish from deck.
 */
function removeFromOfferAndReplenish(
  state: GameState,
  cardId: CardId
): GameState {
  const aaOffer = state.offers.advancedActions.cards;
  const offerIndex = aaOffer.indexOf(cardId);
  if (offerIndex === -1) {
    throw new Error(`Card ${cardId} not found in AA offer`);
  }

  const newOffer = [
    ...aaOffer.slice(0, offerIndex),
    ...aaOffer.slice(offerIndex + 1),
  ];

  let newDeck = state.decks.advancedActions;
  let finalOffer = newOffer;
  if (newDeck.length > 0) {
    const newCard = newDeck[0];
    if (newCard) {
      finalOffer = [...newOffer, newCard];
      newDeck = newDeck.slice(1);
    }
  }

  return {
    ...state,
    offers: {
      ...state.offers,
      advancedActions: { cards: finalOffer },
    },
    decks: {
      ...state.decks,
      advancedActions: newDeck,
    },
  };
}

/**
 * Take wound to the specified destination (hand or discard).
 */
function takeWoundTo(
  state: GameState,
  playerIndex: number,
  player: Player,
  destination: "hand" | "discard"
): GameState {
  const woundsToAdd: CardId[] = [CARD_WOUND];

  const updatedPlayer: Player = {
    ...player,
    hand: destination === "hand" ? [...player.hand, ...woundsToAdd] : player.hand,
    discard: destination === "discard" ? [...player.discard, ...woundsToAdd] : player.discard,
    woundsReceivedThisTurn: {
      hand: player.woundsReceivedThisTurn.hand + (destination === "hand" ? 1 : 0),
      discard: player.woundsReceivedThisTurn.discard + (destination === "discard" ? 1 : 0),
    },
  };

  const newWoundPileCount =
    state.woundPileCount === null ? null : Math.max(0, state.woundPileCount - 1);

  return {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };
}

// ============================================================================
// BASIC EFFECT: Wound → Pay mana → Gain AA from offer to hand
// ============================================================================

/**
 * Handle EFFECT_BLOOD_OF_ANCIENTS_BASIC entry point.
 *
 * 1. Take wound to hand (mandatory)
 * 2. Present basic mana color choices (filtered by: can pay + has matching AA in offer)
 */
function handleBloodBasic(
  state: GameState,
  playerIndex: number,
  player: Player
): EffectResolutionResult {
  // Take wound to hand immediately
  const stateAfterWound = takeWoundTo(state, playerIndex, player, "hand");
  const updatedPlayer = stateAfterWound.players[playerIndex]!;

  // Build options: each payable mana color that has matching AAs in offer
  const options: ResolveBloodBasicSelectAAEffect[] = [];

  for (const color of ALL_BASIC_COLORS) {
    if (!canPayForMana(stateAfterWound, updatedPlayer, color)) continue;

    const matchingAAs = getMatchingAAsInOffer(stateAfterWound, color);
    if (matchingAAs.length === 0) continue;

    // Get available mana sources for this color
    const manaSources = getAvailableManaSourcesForColor(stateAfterWound, updatedPlayer, color);
    for (const manaSource of manaSources) {
      options.push({
        type: EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA,
        paidColor: color,
        manaSource,
      });
    }
  }

  if (options.length === 0) {
    return {
      state: stateAfterWound,
      description: "Blood of Ancients: took wound but no mana/AA combination available",
    };
  }

  return {
    state: stateAfterWound,
    description: "Blood of Ancients: choose mana to pay for AA acquisition",
    requiresChoice: true,
    dynamicChoiceOptions: options,
  };
}

/**
 * Handle EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA.
 * Pay the selected mana source, then present matching AAs.
 */
function resolveBloodBasicSelectAA(
  state: GameState,
  playerId: string,
  effect: ResolveBloodBasicSelectAAEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Consume mana
  const { player: updatedPlayer, source: updatedSource } = consumeMana(
    player,
    state.source,
    effect.manaSource,
    playerId
  );

  let updatedState = updatePlayer(state, playerIndex, updatedPlayer);
  updatedState = { ...updatedState, source: updatedSource };

  // Find matching AAs in offer
  const matchingAAs = getMatchingAAsInOffer(updatedState, effect.paidColor);

  if (matchingAAs.length === 0) {
    return {
      state: updatedState,
      description: `Blood of Ancients: paid ${effect.paidColor} mana but no matching AAs in offer`,
    };
  }

  if (matchingAAs.length === 1) {
    // Auto-select the only matching AA
    const aa = matchingAAs[0]!;
    return resolveBloodBasicGainAA(updatedState, playerId, {
      type: EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
      cardId: aa.cardId,
      cardName: aa.name,
    });
  }

  // Multiple matches: present choice
  const aaOptions: ResolveBloodBasicGainAAEffect[] = matchingAAs.map((aa) => ({
    type: EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
    cardId: aa.cardId,
    cardName: aa.name,
  }));

  return {
    state: updatedState,
    description: `Blood of Ancients: choose a ${effect.paidColor} AA from the offer`,
    requiresChoice: true,
    dynamicChoiceOptions: aaOptions,
  };
}

/**
 * Handle EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA.
 * Gain the selected AA from the offer to hand.
 */
function resolveBloodBasicGainAA(
  state: GameState,
  playerId: string,
  effect: ResolveBloodBasicGainAAEffect
): EffectResolutionResult {
  const { playerIndex } = getPlayerContext(state, playerId);

  // Verify card is still in offer
  if (!state.offers.advancedActions.cards.includes(effect.cardId)) {
    return {
      state,
      description: `Blood of Ancients: ${effect.cardName} is no longer in the offer`,
    };
  }

  // Remove from offer and replenish
  let updatedState = removeFromOfferAndReplenish(state, effect.cardId);

  // Add card to player's hand
  const currentPlayer = updatedState.players[playerIndex]!;
  const updatedPlayer: Player = {
    ...currentPlayer,
    hand: [...currentPlayer.hand, effect.cardId],
  };
  updatedState = updatePlayer(updatedState, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Blood of Ancients: gained ${effect.cardName} to hand`,
  };
}

// ============================================================================
// POWERED EFFECT: Wound choice → Select any AA → Use powered effect for free
// ============================================================================

/**
 * Handle EFFECT_BLOOD_OF_ANCIENTS_POWERED entry point.
 *
 * Present wound destination choice (hand or discard).
 */
function handleBloodPowered(
  state: GameState
): EffectResolutionResult {
  // Check if there are any AAs in the offer at all
  if (state.offers.advancedActions.cards.length === 0) {
    return {
      state,
      description: "Blood of Ancients: no AAs in the offer",
    };
  }

  const woundOptions: ResolveBloodPoweredWoundEffect[] = [
    { type: EFFECT_RESOLVE_BLOOD_POWERED_WOUND, destination: "hand" },
    { type: EFFECT_RESOLVE_BLOOD_POWERED_WOUND, destination: "discard" },
  ];

  return {
    state,
    description: "Blood of Ancients: choose where to place the wound",
    requiresChoice: true,
    dynamicChoiceOptions: woundOptions,
  };
}

/**
 * Handle EFFECT_RESOLVE_BLOOD_POWERED_WOUND.
 * Take wound to chosen destination, then present all AAs in offer.
 */
function resolveBloodPoweredWound(
  state: GameState,
  playerId: string,
  effect: ResolveBloodPoweredWoundEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Take wound to chosen destination
  const stateAfterWound = takeWoundTo(state, playerIndex, player, effect.destination);

  // Present all AAs in the offer
  const aaOptions: ResolveBloodPoweredUseAAEffect[] = [];
  for (const cardId of stateAfterWound.offers.advancedActions.cards) {
    const card = getCard(cardId);
    aaOptions.push({
      type: EFFECT_RESOLVE_BLOOD_POWERED_USE_AA,
      cardId,
      cardName: card?.name ?? cardId,
    });
  }

  if (aaOptions.length === 0) {
    return {
      state: stateAfterWound,
      description: `Blood of Ancients: took wound to ${effect.destination} but no AAs in offer`,
    };
  }

  return {
    state: stateAfterWound,
    description: `Blood of Ancients: took wound to ${effect.destination}, choose an AA to use`,
    requiresChoice: true,
    dynamicChoiceOptions: aaOptions,
  };
}

/**
 * Handle EFFECT_RESOLVE_BLOOD_POWERED_USE_AA.
 * Resolve the selected AA's powered effect for free. Card stays in offer.
 */
function resolveBloodPoweredUseAA(
  state: GameState,
  playerId: string,
  effect: ResolveBloodPoweredUseAAEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  // Verify card is still in offer
  if (!state.offers.advancedActions.cards.includes(effect.cardId)) {
    return {
      state,
      description: `Blood of Ancients: ${effect.cardName} is no longer in the offer`,
    };
  }

  // Get the card definition
  const card = getCard(effect.cardId);
  if (!card) {
    return {
      state,
      description: `Blood of Ancients: ${effect.cardName} not found`,
    };
  }

  // Resolve the AA's powered effect for free (card stays in offer)
  const result = resolveEffect(
    state,
    playerId,
    card.poweredEffect,
    effect.cardId
  );

  return {
    ...result,
    description: `Blood of Ancients: used ${effect.cardName}'s powered effect (card stays in offer)`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Blood of Ancients effect handlers with the effect registry.
 */
export function registerBloodOfAncientsEffects(resolver: EffectResolver): void {
  registerEffect(
    EFFECT_BLOOD_OF_ANCIENTS_BASIC,
    (state, playerId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleBloodBasic(state, playerIndex, player);
    }
  );

  registerEffect(
    EFFECT_RESOLVE_BLOOD_BASIC_SELECT_AA,
    (state, playerId, effect) => {
      return resolveBloodBasicSelectAA(
        state,
        playerId,
        effect as ResolveBloodBasicSelectAAEffect
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_BLOOD_BASIC_GAIN_AA,
    (state, playerId, effect) => {
      return resolveBloodBasicGainAA(
        state,
        playerId,
        effect as ResolveBloodBasicGainAAEffect
      );
    }
  );

  registerEffect(
    EFFECT_BLOOD_OF_ANCIENTS_POWERED,
    (state) => {
      return handleBloodPowered(state);
    }
  );

  registerEffect(
    EFFECT_RESOLVE_BLOOD_POWERED_WOUND,
    (state, playerId, effect) => {
      return resolveBloodPoweredWound(
        state,
        playerId,
        effect as ResolveBloodPoweredWoundEffect
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_BLOOD_POWERED_USE_AA,
    (state, playerId, effect) => {
      return resolveBloodPoweredUseAA(
        state,
        playerId,
        effect as ResolveBloodPoweredUseAAEffect,
        resolver
      );
    }
  );
}
