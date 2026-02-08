/**
 * Tests for Book of Wisdom (artifact card)
 *
 * Book of Wisdom allows throwing away (permanently removing) an action card from hand
 * to gain a card from the offer:
 * - Basic: Throw away action card -> gain Advanced Action of same color from offer to hand
 * - Powered (Destroy): Throw away action card -> gain Spell of same color to hand + crystal of that color
 *
 * Key rules:
 * - Only action cards (basic/advanced) can be thrown away (not wounds, artifacts, spells)
 * - The Book of Wisdom card itself cannot be thrown away
 * - Thrown away cards go to removedCards (permanent, not recycled)
 * - Gained card goes to HAND (not deck)
 * - Two-phase resolution: select card to throw, then select from offer
 * - Dual-color AAs match if EITHER color matches (FAQ S1)
 * - Offer is replenished from deck after taking a card
 * - Crystal cap at 3 per color (powered mode)
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { isEffectResolvable } from "../effects/index.js";
import { handleBookOfWisdomEffect, getCardsEligibleForBookOfWisdom } from "../effects/bookOfWisdomEffects.js";
import { createResolveBookOfWisdomCommand } from "../commands/resolveBookOfWisdomCommand.js";
import { createResolveBookOfWisdomCommandFromAction } from "../commands/factories/cards.js";
import { describeEffect } from "../effects/describeEffect.js";
import {
  validateHasPendingBookOfWisdom,
  validateBookOfWisdomSelection,
} from "../validators/bookOfWisdomValidators.js";
import { getBookOfWisdomOptions } from "../validActions/pending.js";
import { getValidActions } from "../validActions/index.js";
import { EFFECT_BOOK_OF_WISDOM } from "../../types/effectTypes.js";
import type { BookOfWisdomEffect } from "../../types/cards.js";
import type { PendingBookOfWisdom } from "../../types/player.js";
import {
  CARD_BOOK_OF_WISDOM,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  CARD_BANNER_OF_GLORY,
  CARD_FIREBALL,
  CARD_DESTROYED,
  CARD_GAINED,
  CARD_RESTORATION,
  CARD_SNOWSTORM,
  CARD_EXPOSE,
  CARD_STAMINA,
  RESOLVE_BOOK_OF_WISDOM_ACTION,
  PLAY_CARD_ACTION,
} from "@mage-knight/shared";
import { CARD_PATH_FINDING } from "@mage-knight/shared";
import { CARD_DECOMPOSE } from "@mage-knight/shared";
import { CARD_REFRESHING_WALK } from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

function makePending(overrides: Partial<PendingBookOfWisdom> = {}): PendingBookOfWisdom {
  return {
    sourceCardId: CARD_BOOK_OF_WISDOM,
    mode: "basic",
    phase: "select_card",
    thrownCardColor: null,
    availableOfferCards: [],
    ...overrides,
  };
}

function makePhase2Pending(
  mode: "basic" | "powered",
  thrownCardColor: "red" | "blue" | "green" | "white",
  availableOfferCards: readonly CardId[]
): PendingBookOfWisdom {
  return {
    sourceCardId: CARD_BOOK_OF_WISDOM,
    mode,
    phase: "select_from_offer",
    thrownCardColor,
    availableOfferCards,
  };
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

describe("Book of Wisdom", () => {
  describe("getCardsEligibleForBookOfWisdom", () => {
    it("should return action cards excluding wounds and the source card", () => {
      const hand = [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_BOOK_OF_WISDOM];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should exclude wounds", () => {
      const hand = [CARD_WOUND, CARD_MARCH];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude the source card (Book of Wisdom itself)", () => {
      const hand = [CARD_BOOK_OF_WISDOM, CARD_MARCH];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude artifacts (not action cards)", () => {
      const hand = [CARD_BANNER_OF_GLORY, CARD_MARCH];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude spells (not action cards)", () => {
      const hand = [CARD_FIREBALL, CARD_MARCH];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should return empty when only wounds and Book of Wisdom in hand", () => {
      const hand = [CARD_WOUND, CARD_BOOK_OF_WISDOM];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([]);
    });

    it("should include both basic and advanced action cards", () => {
      const hand = [CARD_MARCH, CARD_DECOMPOSE];
      const eligible = getCardsEligibleForBookOfWisdom(hand, CARD_BOOK_OF_WISDOM);
      expect(eligible).toEqual([CARD_MARCH, CARD_DECOMPOSE]);
    });
  });

  // ============================================================================
  // RESOLVABILITY
  // ============================================================================

  describe("isEffectResolvable", () => {
    const basicEffect: BookOfWisdomEffect = {
      type: EFFECT_BOOK_OF_WISDOM,
      mode: "basic",
    };

    it("should be resolvable when player has action cards", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should NOT be resolvable when player only has wounds", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when hand is empty", () => {
      const player = createTestPlayer({ hand: [] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when only artifacts in hand", () => {
      const player = createTestPlayer({ hand: [CARD_BANNER_OF_GLORY] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });
  });

  // ============================================================================
  // EFFECT HANDLER
  // ============================================================================

  describe("handleBookOfWisdomEffect", () => {
    it("should create pending state (basic mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH, CARD_RAGE] });
      const state = createTestGameState({ players: [player] });
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "basic",
      };

      const result = handleBookOfWisdomEffect(
        state, 0, player, effect, CARD_BOOK_OF_WISDOM
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingBookOfWisdom).not.toBeNull();
      expect(result.state.players[0].pendingBookOfWisdom?.mode).toBe("basic");
      expect(result.state.players[0].pendingBookOfWisdom?.phase).toBe("select_card");
      expect(result.state.players[0].pendingBookOfWisdom?.sourceCardId).toBe(CARD_BOOK_OF_WISDOM);
    });

    it("should create pending state (powered mode)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "powered",
      };

      const result = handleBookOfWisdomEffect(
        state, 0, player, effect, CARD_BOOK_OF_WISDOM
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingBookOfWisdom?.mode).toBe("powered");
    });

    it("should throw when no eligible action cards", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND, CARD_BOOK_OF_WISDOM] });
      const state = createTestGameState({ players: [player] });
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "basic",
      };

      expect(() =>
        handleBookOfWisdomEffect(state, 0, player, effect, CARD_BOOK_OF_WISDOM)
      ).toThrow("No action cards available to throw away for Book of Wisdom");
    });

    it("should throw when sourceCardId is null", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "basic",
      };

      expect(() =>
        handleBookOfWisdomEffect(state, 0, player, effect, null)
      ).toThrow("BookOfWisdomEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // PHASE 1: SELECT CARD TO THROW AWAY
  // ============================================================================

  describe("resolveBookOfWisdomCommand - Phase 1 (select card)", () => {
    it("should throw away card and transition to phase 2 when matching cards exist in offer", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_BOOK_OF_WISDOM],
        removedCards: [],
        pendingBookOfWisdom: makePending({ mode: "basic" }),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING] }, // Green AA matches green March
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green basic action
      });
      const result = command.execute(state);

      // Card removed from hand
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
      // Card added to removedCards
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Transitioned to phase 2
      expect(result.state.players[0].pendingBookOfWisdom?.phase).toBe("select_from_offer");
      expect(result.state.players[0].pendingBookOfWisdom?.thrownCardColor).toBe("green");
      // Available offer cards populated
      expect(result.state.players[0].pendingBookOfWisdom?.availableOfferCards).toContain(CARD_PATH_FINDING);
      // CARD_DESTROYED event emitted
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_DESTROYED,
          cardId: CARD_MARCH,
        })
      );
    });

    it("should clear pending when no matching cards in offer", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_BOOK_OF_WISDOM],
        removedCards: [],
        pendingBookOfWisdom: makePending({ mode: "basic" }),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_DECOMPOSE] }, // Red AA, no green
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green - no green AAs in offer
      });
      const result = command.execute(state);

      // Card still removed
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Pending cleared (no matching cards to select from)
      expect(result.state.players[0].pendingBookOfWisdom).toBeNull();
    });

    it("should throw when card is not eligible (wound)", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        pendingBookOfWisdom: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_WOUND,
      });

      expect(() => command.execute(state)).toThrow("not eligible for Book of Wisdom");
    });

    it("should throw when no pending state exists", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingBookOfWisdom: null,
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      expect(() => command.execute(state)).toThrow("No pending Book of Wisdom to resolve");
    });
  });

  // ============================================================================
  // PHASE 2 BASIC: SELECT AA FROM OFFER
  // ============================================================================

  describe("resolveBookOfWisdomCommand - Phase 2 Basic (select AA from offer)", () => {
    it("should gain AA to hand and replenish offer from deck", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_BOOK_OF_WISDOM],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING, CARD_DECOMPOSE] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [CARD_REFRESHING_WALK], // Will replenish from here
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_PATH_FINDING,
      });
      const result = command.execute(state);

      // Card gained to HAND (not deck)
      expect(result.state.players[0].hand).toContain(CARD_PATH_FINDING);
      // Card removed from offer
      const offerCards = result.state.offers.advancedActions.cards;
      expect(offerCards.filter(c => c === CARD_PATH_FINDING)).toHaveLength(0);
      // Offer replenished from deck
      expect(result.state.offers.advancedActions.cards).toContain(CARD_REFRESHING_WALK);
      // Pending cleared
      expect(result.state.players[0].pendingBookOfWisdom).toBeNull();
      // CARD_GAINED event emitted
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_GAINED,
          cardId: CARD_PATH_FINDING,
        })
      );
    });

    it("should work when deck is empty (no replenishment)", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING, CARD_DECOMPOSE] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [], // Empty deck
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_PATH_FINDING,
      });
      const result = command.execute(state);

      // Card gained
      expect(result.state.players[0].hand).toContain(CARD_PATH_FINDING);
      // Offer has one fewer card (no replenishment)
      expect(result.state.offers.advancedActions.cards).toEqual([CARD_DECOMPOSE]);
    });

    it("should throw when card is not in available offer cards", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING, CARD_DECOMPOSE] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_DECOMPOSE, // Red AA, not in available offer cards
      });

      expect(() => command.execute(state)).toThrow("not available in the offer");
    });
  });

  // ============================================================================
  // PHASE 2 POWERED: SELECT SPELL FROM OFFER + CRYSTAL
  // ============================================================================

  describe("resolveBookOfWisdomCommand - Phase 2 Powered (select Spell + crystal)", () => {
    it("should gain Spell to hand and gain crystal of thrown card color", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "green", [CARD_RESTORATION]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_RESTORATION, CARD_FIREBALL] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_RESTORATION, // Green spell
      });
      const result = command.execute(state);

      // Spell gained to hand
      expect(result.state.players[0].hand).toContain(CARD_RESTORATION);
      // Green crystal gained (color of thrown card)
      expect(result.state.players[0].crystals.green).toBe(1);
      // Other crystals unchanged
      expect(result.state.players[0].crystals.red).toBe(0);
      // Pending cleared
      expect(result.state.players[0].pendingBookOfWisdom).toBeNull();
      // CARD_GAINED event emitted
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_GAINED,
          cardId: CARD_RESTORATION,
        })
      );
    });

    it("should cap crystal at 3", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "red", [CARD_FIREBALL]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_FIREBALL] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_FIREBALL,
      });
      const result = command.execute(state);

      // Crystal stays at 3 (capped)
      expect(result.state.players[0].crystals.red).toBe(3);
      // Spell still gained
      expect(result.state.players[0].hand).toContain(CARD_FIREBALL);
    });

    it("should replenish spell offer from deck", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "blue", [CARD_SNOWSTORM]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_SNOWSTORM, CARD_FIREBALL] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [CARD_EXPOSE], // Will replenish
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_SNOWSTORM,
      });
      const result = command.execute(state);

      // Spell removed from offer and replenished
      expect(result.state.offers.spells.cards).not.toContain(CARD_SNOWSTORM);
      expect(result.state.offers.spells.cards).toContain(CARD_EXPOSE);
      // Blue crystal gained
      expect(result.state.players[0].crystals.blue).toBe(1);
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("resolveBookOfWisdomCommand undo", () => {
    it("should restore state after phase 1", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_BOOK_OF_WISDOM],
        removedCards: [],
        pendingBookOfWisdom: makePending({ mode: "basic" }),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      const executed = command.execute(state);
      expect(executed.state.players[0].hand).not.toContain(CARD_MARCH);
      expect(executed.state.players[0].removedCards).toContain(CARD_MARCH);

      const undone = command.undo(executed.state);

      // Hand restored
      expect(undone.state.players[0].hand).toContain(CARD_MARCH);
      // removedCards restored
      expect(undone.state.players[0].removedCards).toEqual([]);
      // Pending state restored to phase 1
      expect(undone.state.players[0].pendingBookOfWisdom?.phase).toBe("select_card");
    });

    it("should restore state after phase 2 basic", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING, CARD_DECOMPOSE] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_PATH_FINDING,
      });

      const executed = command.execute(state);
      expect(executed.state.players[0].hand).toContain(CARD_PATH_FINDING);

      const undone = command.undo(executed.state);

      // Hand restored (no PATH_FINDING)
      expect(undone.state.players[0].hand).not.toContain(CARD_PATH_FINDING);
      expect(undone.state.players[0].hand).toContain(CARD_RAGE);
      // Offer restored
      expect(undone.state.offers.advancedActions.cards).toContain(CARD_PATH_FINDING);
      // Pending state restored to phase 2
      expect(undone.state.players[0].pendingBookOfWisdom?.phase).toBe("select_from_offer");
    });

    it("should restore crystals after phase 2 powered", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "green", [CARD_RESTORATION]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_RESTORATION] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_RESTORATION,
      });

      const executed = command.execute(state);
      expect(executed.state.players[0].crystals.green).toBe(1);

      const undone = command.undo(executed.state);

      // Crystals restored
      expect(undone.state.players[0].crystals.green).toBe(0);
      // Spell offer restored
      expect(undone.state.offers.spells.cards).toContain(CARD_RESTORATION);
    });
  });

  // ============================================================================
  // DESCRIBE EFFECT
  // ============================================================================

  describe("describeEffect", () => {
    it("should describe basic Book of Wisdom", () => {
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "basic",
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card, gain Advanced Action of same color from offer"
      );
    });

    it("should describe powered Book of Wisdom", () => {
      const effect: BookOfWisdomEffect = {
        type: EFFECT_BOOK_OF_WISDOM,
        mode: "powered",
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card, gain Spell of same color from offer + crystal"
      );
    });
  });

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  describe("validators", () => {
    describe("validateHasPendingBookOfWisdom", () => {
      it("should pass when pending state exists", () => {
        const player = createTestPlayer({
          pendingBookOfWisdom: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingBookOfWisdom(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail when no pending state", () => {
        const player = createTestPlayer({
          pendingBookOfWisdom: null,
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingBookOfWisdom(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });

    describe("validateBookOfWisdomSelection", () => {
      it("should pass for eligible action card in phase 1", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingBookOfWisdom: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateBookOfWisdomSelection(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail for wound card in phase 1", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND],
          pendingBookOfWisdom: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_WOUND,
        } as const;

        const result = validateBookOfWisdomSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });

      it("should fail for Book of Wisdom card itself in phase 1", () => {
        const player = createTestPlayer({
          hand: [CARD_BOOK_OF_WISDOM, CARD_MARCH],
          pendingBookOfWisdom: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_BOOK_OF_WISDOM,
        } as const;

        const result = validateBookOfWisdomSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });

      it("should pass for available offer card in phase 2", () => {
        const player = createTestPlayer({
          hand: [CARD_RAGE],
          pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_PATH_FINDING,
        } as const;

        const result = validateBookOfWisdomSelection(state, "player1", action);
        expect(result.valid).toBe(true);
      });

      it("should fail for card not in available offer in phase 2", () => {
        const player = createTestPlayer({
          hand: [CARD_RAGE],
          pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_BOOK_OF_WISDOM_ACTION,
          cardId: CARD_DECOMPOSE, // Not in available offer
        } as const;

        const result = validateBookOfWisdomSelection(state, "player1", action);
        expect(result.valid).toBe(false);
      });
    });
  });

  // ============================================================================
  // PERMANENT REMOVAL
  // ============================================================================

  describe("permanent removal (throw away)", () => {
    it("should add card to removedCards, not discard pile", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_BOOK_OF_WISDOM],
        discard: [],
        removedCards: [],
        pendingBookOfWisdom: makePending(),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_PATH_FINDING] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      expect(result.state.players[0].discard).not.toContain(CARD_MARCH);
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
    });
  });

  // ============================================================================
  // VALID ACTIONS - getBookOfWisdomOptions
  // ============================================================================

  describe("getBookOfWisdomOptions", () => {
    it("should return undefined when no pending state", () => {
      const player = createTestPlayer({ pendingBookOfWisdom: null });
      const state = createTestGameState({ players: [player] });
      expect(getBookOfWisdomOptions(state, player)).toBeUndefined();
    });

    it("should return phase 1 options with eligible cards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_BOOK_OF_WISDOM],
        pendingBookOfWisdom: makePending({ mode: "basic" }),
      });
      const state = createTestGameState({ players: [player] });

      const options = getBookOfWisdomOptions(state, player);
      expect(options).toBeDefined();
      expect(options!.phase).toBe("select_card");
      expect(options!.mode).toBe("basic");
      expect(options!.availableCardIds).toEqual([CARD_MARCH, CARD_RAGE]);
      expect(options!.availableOfferCards).toEqual([]);
    });

    it("should return phase 2 options with available offer cards", () => {
      const offerCards = [CARD_PATH_FINDING] as readonly CardId[];
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", offerCards),
      });
      const state = createTestGameState({ players: [player] });

      const options = getBookOfWisdomOptions(state, player);
      expect(options).toBeDefined();
      expect(options!.phase).toBe("select_from_offer");
      expect(options!.availableCardIds).toEqual([]);
      expect(options!.availableOfferCards).toEqual([CARD_PATH_FINDING]);
    });

    it("should return phase 2 options for powered mode", () => {
      const offerCards = [CARD_RESTORATION] as readonly CardId[];
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("powered", "green", offerCards),
      });
      const state = createTestGameState({ players: [player] });

      const options = getBookOfWisdomOptions(state, player);
      expect(options).toBeDefined();
      expect(options!.mode).toBe("powered");
      expect(options!.phase).toBe("select_from_offer");
    });
  });

  // ============================================================================
  // VALID ACTIONS - getValidActions routing
  // ============================================================================

  describe("getValidActions routing", () => {
    it("should return pending_book_of_wisdom mode when player has pending state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingBookOfWisdom: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const actions = getValidActions(state, "player1");
      expect(actions.mode).toBe("pending_book_of_wisdom");
      expect(actions.bookOfWisdom).toBeDefined();
      expect(actions.bookOfWisdom!.availableCardIds).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should return pending_book_of_wisdom mode during phase 2", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        pendingBookOfWisdom: makePhase2Pending("basic", "green", [CARD_PATH_FINDING]),
      });
      const state = createTestGameState({ players: [player] });

      const actions = getValidActions(state, "player1");
      expect(actions.mode).toBe("pending_book_of_wisdom");
      expect(actions.bookOfWisdom).toBeDefined();
      expect(actions.bookOfWisdom!.availableOfferCards).toEqual([CARD_PATH_FINDING]);
    });
  });

  // ============================================================================
  // COMMAND FACTORY
  // ============================================================================

  describe("createResolveBookOfWisdomCommandFromAction", () => {
    it("should create command for RESOLVE_BOOK_OF_WISDOM_ACTION", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingBookOfWisdom: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_BOOK_OF_WISDOM_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const command = createResolveBookOfWisdomCommandFromAction(state, "player1", action);
      expect(command).not.toBeNull();
    });

    it("should return null for non-matching action type", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        manaSources: [],
      } as const;

      const command = createResolveBookOfWisdomCommandFromAction(state, "player1", action);
      expect(command).toBeNull();
    });

    it("should return null when player has no pending state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingBookOfWisdom: null,
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_BOOK_OF_WISDOM_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const command = createResolveBookOfWisdomCommandFromAction(state, "player1", action);
      expect(command).toBeNull();
    });
  });

  // ============================================================================
  // POWERED MODE COLOR VARIATIONS
  // ============================================================================

  describe("powered mode crystal colors", () => {
    it("should gain red crystal when throwing away red card", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "red", [CARD_FIREBALL]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_FIREBALL] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_FIREBALL,
      });
      const result = command.execute(state);
      expect(result.state.players[0].crystals.red).toBe(1);
    });

    it("should gain white crystal when throwing away white card", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pendingBookOfWisdom: makePhase2Pending("powered", "white", [CARD_EXPOSE]),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_EXPOSE] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
        decks: {
          spells: [],
          advancedActions: [],
          artifacts: [],
          regularUnits: [],
          eliteUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_EXPOSE,
      });
      const result = command.execute(state);
      expect(result.state.players[0].crystals.white).toBe(1);
    });
  });

  // ============================================================================
  // VALIDATOR EDGE CASES
  // ============================================================================

  describe("validator edge cases", () => {
    it("validateHasPendingBookOfWisdom should fail for unknown player", () => {
      const state = createTestGameState({ players: [] });
      const action = {
        type: RESOLVE_BOOK_OF_WISDOM_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateHasPendingBookOfWisdom(state, "nonexistent", action);
      expect(result.valid).toBe(false);
    });

    it("validateBookOfWisdomSelection should fail for unknown player", () => {
      const state = createTestGameState({ players: [] });
      const action = {
        type: RESOLVE_BOOK_OF_WISDOM_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateBookOfWisdomSelection(state, "nonexistent", action);
      expect(result.valid).toBe(false);
    });

    it("validateBookOfWisdomSelection should pass for non-matching action type", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        manaSources: [],
      } as const;

      const result = validateBookOfWisdomSelection(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("validateBookOfWisdomSelection should pass when no pending state (defers to other validator)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingBookOfWisdom: null,
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_BOOK_OF_WISDOM_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateBookOfWisdomSelection(state, "player1", action);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // PHASE 1 WITH BLUE AND WHITE CARDS
  // ============================================================================

  describe("phase 1 color matching", () => {
    it("should match blue card color in phase 1", () => {
      const player = createTestPlayer({
        hand: [CARD_STAMINA, CARD_BOOK_OF_WISDOM],
        removedCards: [],
        pendingBookOfWisdom: makePending({ mode: "powered" }),
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [] },
          spells: { cards: [CARD_SNOWSTORM] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      const command = createResolveBookOfWisdomCommand({
        playerId: "player1",
        cardId: CARD_STAMINA, // blue card
      });
      const result = command.execute(state);

      expect(result.state.players[0].pendingBookOfWisdom?.thrownCardColor).toBe("blue");
      expect(result.state.players[0].pendingBookOfWisdom?.availableOfferCards).toContain(CARD_SNOWSTORM);
    });
  });
});
