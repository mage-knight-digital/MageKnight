/**
 * Resolve Book of Wisdom Command
 *
 * Handles player resolution of a pending Book of Wisdom effect.
 * Two-phase resolution:
 *
 * Phase 1 (select_card): Player selects an action card to throw away.
 *   - Card is permanently removed from the game (added to removedCards)
 *   - Determines card color and filters matching offer cards
 *   - Transitions to phase 2 (select_from_offer)
 *
 * Phase 2 (select_from_offer): Player selects a card from the offer.
 *   - Basic: Select from AA offer → card goes to hand
 *   - Powered: Select from Spell offer → card goes to hand + gain crystal
 *   - Selected card removed from offer, offer replenished from deck
 *   - Pending state cleared
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, BasicManaColor } from "@mage-knight/shared";
import { CARD_DESTROYED, CARD_GAINED, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import type { Player, PendingBookOfWisdom, Crystals } from "../../types/player.js";
import type { BasicCardColor } from "../../types/effectTypes.js";
import { RESOLVE_BOOK_OF_WISDOM_COMMAND } from "./commandTypes.js";
import { getCardsEligibleForBookOfWisdom } from "../effects/bookOfWisdomEffects.js";
import { getActionCardColor, getSpellColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";

export { RESOLVE_BOOK_OF_WISDOM_COMMAND };

export interface ResolveBookOfWisdomCommandParams {
  readonly playerId: string;
  /** Card ID: action card to throw away (phase 1) or card from offer to gain (phase 2) */
  readonly cardId: CardId;
}

export function createResolveBookOfWisdomCommand(
  params: ResolveBookOfWisdomCommandParams
): Command {
  // Store previous state for undo
  let previousPendingBookOfWisdom: PendingBookOfWisdom | null = null;
  let previousHand: readonly CardId[] = [];
  let previousRemovedCards: readonly CardId[] = [];
  let previousCrystals: Crystals | null = null;
  let previousOfferCards: readonly CardId[] = [];
  let previousDeck: readonly CardId[] = [];
  let previousPhase: "select_card" | "select_from_offer" = "select_card";

  return {
    type: RESOLVE_BOOK_OF_WISDOM_COMMAND,
    playerId: params.playerId,
    isReversible: true,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingBookOfWisdom) {
        throw new Error("No pending Book of Wisdom to resolve");
      }

      const pending = player.pendingBookOfWisdom;
      previousPhase = pending.phase;

      if (pending.phase === "select_card") {
        return executePhase1(state, player, playerIndex, pending);
      } else {
        return executePhase2(state, player, playerIndex, pending);
      }
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (previousPhase === "select_card") {
        // Undo phase 1: restore hand, removedCards, and pending state
        const restoredPlayer: Player = {
          ...player,
          hand: previousHand,
          removedCards: previousRemovedCards,
          pendingBookOfWisdom: previousPendingBookOfWisdom,
        };

        return {
          state: {
            ...state,
            players: state.players.map((p, i) =>
              i === playerIndex ? restoredPlayer : p
            ),
          },
          events: [],
        };
      } else {
        // Undo phase 2: restore hand, crystals, offer, deck, and pending state
        const restoredPlayer: Player = {
          ...player,
          hand: previousHand,
          crystals: previousCrystals ?? player.crystals,
          pendingBookOfWisdom: previousPendingBookOfWisdom,
        };

        const offerKey = previousPendingBookOfWisdom?.mode === "powered" ? "spells" : "advancedActions";
        const deckKey = previousPendingBookOfWisdom?.mode === "powered" ? "spells" : "advancedActions";

        return {
          state: {
            ...state,
            players: state.players.map((p, i) =>
              i === playerIndex ? restoredPlayer : p
            ),
            offers: {
              ...state.offers,
              [offerKey]: { cards: previousOfferCards },
            },
            decks: {
              ...state.decks,
              [deckKey]: previousDeck,
            },
          },
          events: [],
        };
      }
    },
  };

  // ============================================================================
  // PHASE 1: Select action card to throw away
  // ============================================================================

  function executePhase1(
    state: GameState,
    player: Player,
    playerIndex: number,
    pending: PendingBookOfWisdom
  ): CommandResult {
    // Store for undo
    previousPendingBookOfWisdom = pending;
    previousHand = player.hand;
    previousRemovedCards = player.removedCards;

    const events: GameEvent[] = [];

    // Validate card is eligible
    const eligibleCards = getCardsEligibleForBookOfWisdom(player.hand, pending.sourceCardId);
    if (!eligibleCards.includes(params.cardId)) {
      throw new Error(
        `Card ${params.cardId} is not eligible for Book of Wisdom (must be an action card in hand, not the Book of Wisdom card itself)`
      );
    }

    // Remove card from hand
    const updatedHand = [...player.hand];
    const cardIndex = updatedHand.indexOf(params.cardId);
    if (cardIndex === -1) {
      throw new Error(`Card ${params.cardId} not found in hand`);
    }
    updatedHand.splice(cardIndex, 1);

    // Add to removedCards (permanent removal - throw away)
    const updatedRemovedCards = [...player.removedCards, params.cardId];

    // Emit card destroyed event
    events.push({
      type: CARD_DESTROYED,
      playerId: params.playerId,
      cardId: params.cardId,
    });

    // Get the action card color
    const cardColor = getActionCardColor(params.cardId);
    if (!cardColor) {
      throw new Error(`Card ${params.cardId} has no color (not an action card)`);
    }

    // Find matching cards in the appropriate offer
    const availableOfferCards = getMatchingOfferCards(state, pending.mode, cardColor);

    // If no matching cards in offer, clear pending (nothing to gain)
    if (availableOfferCards.length === 0) {
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        removedCards: updatedRemovedCards,
        pendingBookOfWisdom: null,
      };

      return {
        state: {
          ...state,
          players: state.players.map((p, i) =>
            i === playerIndex ? updatedPlayer : p
          ),
        },
        events,
      };
    }

    // Transition to phase 2
    const updatedPending: PendingBookOfWisdom = {
      ...pending,
      phase: "select_from_offer",
      thrownCardColor: cardColor,
      availableOfferCards,
    };

    const updatedPlayer: Player = {
      ...player,
      hand: updatedHand,
      removedCards: updatedRemovedCards,
      pendingBookOfWisdom: updatedPending,
    };

    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      },
      events,
    };
  }

  // ============================================================================
  // PHASE 2: Select card from offer
  // ============================================================================

  function executePhase2(
    state: GameState,
    player: Player,
    playerIndex: number,
    pending: PendingBookOfWisdom
  ): CommandResult {
    // Store for undo
    previousPendingBookOfWisdom = pending;
    previousHand = player.hand;
    previousCrystals = player.crystals;

    const events: GameEvent[] = [];
    const selectedCardId = params.cardId;

    // Validate card is in the available offer cards
    if (!pending.availableOfferCards.includes(selectedCardId)) {
      throw new Error(
        `Card ${selectedCardId} is not available in the offer for Book of Wisdom`
      );
    }

    if (pending.mode === "basic") {
      // Basic: gain AA from offer to hand
      return executePhase2Basic(state, player, playerIndex, pending, selectedCardId, events);
    } else {
      // Powered: gain Spell from offer to hand + crystal
      return executePhase2Powered(state, player, playerIndex, pending, selectedCardId, events);
    }
  }

  function executePhase2Basic(
    state: GameState,
    player: Player,
    playerIndex: number,
    _pending: PendingBookOfWisdom,
    selectedCardId: CardId,
    events: GameEvent[]
  ): CommandResult {
    const aaOffer = state.offers.advancedActions.cards;
    const offerIndex = aaOffer.indexOf(selectedCardId);
    if (offerIndex === -1) {
      throw new Error("Selected card not in advanced action offer");
    }

    // Store for undo
    previousOfferCards = aaOffer;
    previousDeck = state.decks.advancedActions;

    // Remove from offer
    const newOffer = [
      ...aaOffer.slice(0, offerIndex),
      ...aaOffer.slice(offerIndex + 1),
    ];

    // Replenish from deck if available
    let newDeck = state.decks.advancedActions;
    let finalOffer = newOffer;
    if (newDeck.length > 0) {
      const newCard = newDeck[0];
      if (newCard) {
        finalOffer = [...newOffer, newCard];
        newDeck = newDeck.slice(1);
      }
    }

    // Add card to HAND (not deck - Book of Wisdom specifies "to your hand")
    const updatedPlayer: Player = {
      ...player,
      hand: [...player.hand, selectedCardId],
      pendingBookOfWisdom: null,
    };

    events.push({
      type: CARD_GAINED,
      playerId: params.playerId,
      cardId: selectedCardId,
    });

    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
        offers: {
          ...state.offers,
          advancedActions: { cards: finalOffer },
        },
        decks: {
          ...state.decks,
          advancedActions: newDeck,
        },
      },
      events,
    };
  }

  function executePhase2Powered(
    state: GameState,
    player: Player,
    playerIndex: number,
    pending: PendingBookOfWisdom,
    selectedCardId: CardId,
    events: GameEvent[]
  ): CommandResult {
    const spellOffer = state.offers.spells.cards;
    const offerIndex = spellOffer.indexOf(selectedCardId);
    if (offerIndex === -1) {
      throw new Error("Selected card not in spell offer");
    }

    // Store for undo
    previousOfferCards = spellOffer;
    previousDeck = state.decks.spells;

    // Remove from offer
    const newOffer = [
      ...spellOffer.slice(0, offerIndex),
      ...spellOffer.slice(offerIndex + 1),
    ];

    // Replenish from deck if available
    let newDeck = state.decks.spells;
    let finalOffer = newOffer;
    if (newDeck.length > 0) {
      const newCard = newDeck[0];
      if (newCard) {
        finalOffer = [...newOffer, newCard];
        newDeck = newDeck.slice(1);
      }
    }

    // Gain crystal of the thrown card's color
    const manaColor = cardColorToManaColor(pending.thrownCardColor!);
    const updatedCrystals = addCrystal(player.crystals, manaColor);

    // Add spell to HAND (not deck - Book of Wisdom specifies "to your hand")
    const updatedPlayer: Player = {
      ...player,
      hand: [...player.hand, selectedCardId],
      crystals: updatedCrystals,
      pendingBookOfWisdom: null,
    };

    events.push({
      type: CARD_GAINED,
      playerId: params.playerId,
      cardId: selectedCardId,
    });

    return {
      state: {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
        offers: {
          ...state.offers,
          spells: { cards: finalOffer },
        },
        decks: {
          ...state.decks,
          spells: newDeck,
        },
      },
      events,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get matching cards from the appropriate offer based on mode and color.
 * Basic mode: AA offer, matching by action card color.
 * Powered mode: Spell offer, matching by spell color.
 *
 * For AAs, dual-color cards match if EITHER color matches (FAQ S1).
 */
function getMatchingOfferCards(
  state: GameState,
  mode: "basic" | "powered",
  cardColor: BasicCardColor
): CardId[] {
  if (mode === "basic") {
    // Filter AA offer by color
    return state.offers.advancedActions.cards.filter((cardId) => {
      const aaColor = getActionCardColor(cardId);
      if (aaColor === cardColor) return true;
      // Check if it's a dual-color card powered by this color
      // Dual-color AAs have multiple poweredBy entries - check via card lookup
      return isDualColorMatch(cardId, cardColor);
    });
  } else {
    // Filter Spell offer by color
    return state.offers.spells.cards.filter((cardId) => {
      const spellColor = getSpellColor(cardId);
      return spellColor === cardColor;
    });
  }
}

/**
 * Check if a card is a dual-color AA that matches via its secondary color.
 * Dual-color AAs are registered in multiple color sets, so getActionCardColor
 * returns only their primary color. We need to check the poweredBy field.
 */
function isDualColorMatch(cardId: CardId, targetColor: BasicCardColor): boolean {
  const card = getCard(cardId);
  if (!card) return false;

  const manaColor = cardColorToManaColor(targetColor);
  return card.poweredBy.includes(manaColor);
}

/**
 * Convert card color to mana color.
 */
function cardColorToManaColor(
  cardColor: BasicCardColor
): BasicManaColor {
  switch (cardColor) {
    case "red":
      return MANA_RED;
    case "blue":
      return MANA_BLUE;
    case "green":
      return MANA_GREEN;
    case "white":
      return MANA_WHITE;
    default:
      throw new Error(`Unknown card color: ${cardColor}`);
  }
}

/**
 * Add a crystal of the specified color (capped at 3 per color).
 */
function addCrystal(crystals: Crystals, color: BasicManaColor): Crystals {
  const current = crystals[color];
  const newValue = Math.min(current + 1, 3);
  if (newValue === current) {
    return crystals;
  }
  return {
    ...crystals,
    [color]: newValue,
  };
}
