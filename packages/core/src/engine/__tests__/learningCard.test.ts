/**
 * Tests for Learning advanced action card
 *
 * RULES:
 * - Basic: Influence 2 + once per turn, pay 6 influence for AA → discard pile
 * - Powered: Influence 4 + once per turn, pay 9 influence for AA → hand
 * - The "once per turn" ability is tracked via a modifier (consumed on use)
 * - Uses the regular AA offer (not monastery), with replenishment
 * - Works anywhere (not site-dependent)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  LEARN_ADVANCED_ACTION_ACTION,
  PLAY_CARD_ACTION,
  UNDO_ACTION,
  INVALID_ACTION,
  ADVANCED_ACTION_GAINED,
  OFFER_REFRESHED,
  GAME_PHASE_ROUND,
  CARD_MARCH,
  CARD_FIRE_BOLT,
  CARD_ICE_BOLT,
  CARD_BLOOD_RAGE,
  CARD_LEARNING,
  MANA_WHITE,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
  hexKey,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  EFFECT_LEARNING_DISCOUNT,
  DURATION_TURN,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

describe("Learning Card - Discounted AA Acquisition", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a learning discount modifier for testing.
   */
  function createLearningDiscountModifier(
    playerId: string,
    cost: number,
    destination: "hand" | "discard",
    round = 1,
  ): ActiveModifier {
    return {
      id: `mod_learning_test_${cost}`,
      source: { type: SOURCE_CARD, cardId: CARD_LEARNING, playerId },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_LEARNING_DISCOUNT,
        cost,
        destination,
      },
      createdAtRound: round,
      createdByPlayerId: playerId,
    };
  }

  /**
   * Create a test state with AA offer and an active learning discount modifier.
   */
  function createStateWithLearningDiscount(
    cost: number,
    destination: "hand" | "discard",
    playerOverrides: Parameters<typeof createTestPlayer>[0] = {},
    aaOffer: CardId[] = [CARD_FIRE_BOLT, CARD_ICE_BOLT],
    aaDeck: CardId[] = [CARD_BLOOD_RAGE],
  ) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      hand: [CARD_MARCH],
      ...playerOverrides,
    });

    const hex = {
      ...createTestHex(0, 0),
      site: undefined,
    };

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hex,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
      offers: {
        units: [],
        advancedActions: { cards: aaOffer },
        spells: { cards: [] },
        commonSkills: [],
        monasteryAdvancedActions: [],
      },
      decks: {
        units: [],
        advancedActions: aaDeck,
        spells: [],
        artifacts: [],
      },
      activeModifiers: [
        createLearningDiscountModifier(player.id, cost, destination),
      ],
    });
  }

  describe("Basic effect (cost 6, discard pile)", () => {
    it("should buy AA from regular offer via Learning and add to discard pile", () => {
      const state = createStateWithLearningDiscount(6, "discard", {
        influencePoints: 6,
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // AA should be in discard pile (not deck)
      expect(result.state.players[0]?.discard).toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.deck).not.toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.hand).not.toContain(CARD_FIRE_BOLT);

      // Influence should be consumed
      expect(result.state.players[0]?.influencePoints).toBe(0);

      // Card should be removed from offer
      expect(result.state.offers.advancedActions.cards).not.toContain(CARD_FIRE_BOLT);

      // Check events
      const gainedEvent = result.events.find((e) => e.type === ADVANCED_ACTION_GAINED);
      expect(gainedEvent).toBeDefined();
    });

    it("should consume the learning discount modifier after use", () => {
      const state = createStateWithLearningDiscount(6, "discard", {
        influencePoints: 6,
      });

      // Verify modifier exists before
      expect(state.activeModifiers).toHaveLength(1);
      expect(state.activeModifiers[0]?.effect.type).toBe(EFFECT_LEARNING_DISCOUNT);

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // Modifier should be consumed (removed)
      const learningModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      );
      expect(learningModifiers).toHaveLength(0);
    });

    it("should replenish the regular offer from deck", () => {
      const state = createStateWithLearningDiscount(
        6,
        "discard",
        { influencePoints: 6 },
        [CARD_FIRE_BOLT],
        [CARD_ICE_BOLT],
      );

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // Offer should be replenished
      expect(result.state.offers.advancedActions.cards).toContain(CARD_ICE_BOLT);
      expect(result.state.decks.advancedActions).toHaveLength(0);

      const refreshedEvent = result.events.find((e) => e.type === OFFER_REFRESHED);
      expect(refreshedEvent).toBeDefined();
    });

    it("should work with excess influence", () => {
      const state = createStateWithLearningDiscount(6, "discard", {
        influencePoints: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      expect(result.state.players[0]?.discard).toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.influencePoints).toBe(4); // 10 - 6
    });
  });

  describe("Powered effect (cost 9, hand)", () => {
    it("should buy AA from regular offer via Learning and add to hand", () => {
      const state = createStateWithLearningDiscount(9, "hand", {
        influencePoints: 9,
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // AA should be in hand (not deck or discard)
      expect(result.state.players[0]?.hand).toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.deck).not.toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.discard).not.toContain(CARD_FIRE_BOLT);

      // Influence should be consumed
      expect(result.state.players[0]?.influencePoints).toBe(0);
    });

    it("should consume the learning discount modifier for powered too", () => {
      const state = createStateWithLearningDiscount(9, "hand", {
        influencePoints: 9,
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      const learningModifiers = result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      );
      expect(learningModifiers).toHaveLength(0);
    });
  });

  describe("Validation", () => {
    it("should reject Learning purchase without active modifier", () => {
      // Create state with NO learning modifier
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        hand: [CARD_MARCH],
        influencePoints: 10,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              ...createTestHex(0, 0),
              site: undefined,
            },
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
        offers: {
          units: [],
          advancedActions: { cards: [CARD_FIRE_BOLT] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
        activeModifiers: [], // No modifiers
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should reject Learning purchase with insufficient influence", () => {
      const state = createStateWithLearningDiscount(6, "discard", {
        influencePoints: 5, // Need 6
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("influence");
      }
    });

    it("should reject Learning purchase for AA not in offer", () => {
      const state = createStateWithLearningDiscount(
        6,
        "discard",
        { influencePoints: 6 },
        [CARD_ICE_BOLT], // CARD_FIRE_BOLT not in offer
      );

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not available");
      }
    });

    it("should reject Learning purchase for powered cost with basic cost influence", () => {
      const state = createStateWithLearningDiscount(9, "hand", {
        influencePoints: 8, // Need 9
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  describe("Undo", () => {
    it("should undo Learning purchase and restore all state", () => {
      const state = createStateWithLearningDiscount(6, "discard", {
        influencePoints: 6,
      });

      // Execute the action
      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // Verify action succeeded
      expect(result.state.players[0]?.discard).toContain(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.influencePoints).toBe(0);
      expect(result.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      )).toHaveLength(0);

      // Undo the action
      const undoResult = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION,
      });

      // All state should be restored
      expect(undoResult.state.players[0]?.discard).not.toContain(CARD_FIRE_BOLT);
      expect(undoResult.state.players[0]?.influencePoints).toBe(6);
      expect(undoResult.state.offers.advancedActions.cards).toContain(CARD_FIRE_BOLT);

      // Learning discount modifier should be restored
      const learningModifiers = undoResult.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      );
      expect(learningModifiers).toHaveLength(1);
    });

    it("should undo Learning powered purchase (hand) and restore all state", () => {
      const state = createStateWithLearningDiscount(9, "hand", {
        influencePoints: 9,
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      expect(result.state.players[0]?.hand).toContain(CARD_FIRE_BOLT);

      const undoResult = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(undoResult.state.players[0]?.hand).not.toContain(CARD_FIRE_BOLT);
      expect(undoResult.state.players[0]?.influencePoints).toBe(9);
      expect(undoResult.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      )).toHaveLength(1);
    });
  });

  describe("Does not interfere with other paths", () => {
    it("should still allow level-up AA selection (fromLearning not set)", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        hand: [CARD_MARCH],
        pendingRewards: [{ type: "advanced_action" as const, count: 1 }],
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              ...createTestHex(0, 0),
              site: undefined,
            },
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
        offers: {
          units: [],
          advancedActions: { cards: [CARD_FIRE_BOLT] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
      });

      const result = engine.processAction(state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        // No fromLearning flag
      });

      // Should go to deck (level-up behavior)
      expect(result.state.players[0]?.deck[0]).toBe(CARD_FIRE_BOLT);
      expect(result.state.players[0]?.pendingRewards).toHaveLength(0);
    });
  });

  describe("End-to-end: play Learning card then buy AA", () => {
    it("basic: playing Learning creates modifier and grants influence", () => {
      const player = createTestPlayer({
        hand: [CARD_LEARNING, CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
      });

      // Play Learning card (basic)
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_LEARNING,
        powered: false,
      });

      // Should resolve the compound effect: influence(2) + learning discount modifier
      // The compound effect auto-resolves both sub-effects

      // Check that influence was gained
      expect(playResult.state.players[0]?.influencePoints).toBe(2);

      // Check that Learning discount modifier was created
      const learningModifiers = playResult.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      );
      expect(learningModifiers).toHaveLength(1);
      expect(learningModifiers[0]?.effect).toMatchObject({
        type: EFFECT_LEARNING_DISCOUNT,
        cost: 6,
        destination: "discard",
      });
    });

    it("basic: full flow - play Learning then buy AA to discard", () => {
      const player = createTestPlayer({
        hand: [CARD_LEARNING, CARD_MARCH],
        influencePoints: 4, // + 2 from Learning = 6, enough for AA purchase
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
      });

      // Step 1: Play Learning card (basic)
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_LEARNING,
        powered: false,
      });

      expect(playResult.state.players[0]?.influencePoints).toBe(6); // 4 + 2

      // Step 2: Buy AA via Learning
      const buyResult = engine.processAction(playResult.state, "player1", {
        type: LEARN_ADVANCED_ACTION_ACTION,
        cardId: CARD_FIRE_BOLT,
        fromMonastery: false,
        fromLearning: true,
      });

      // AA in discard pile
      expect(buyResult.state.players[0]?.discard).toContain(CARD_FIRE_BOLT);
      // Influence consumed
      expect(buyResult.state.players[0]?.influencePoints).toBe(0);
      // Modifier consumed
      expect(buyResult.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      )).toHaveLength(0);
    });

    it("powered: playing Learning creates modifier for hand destination", () => {
      const player = createTestPlayer({
        hand: [CARD_LEARNING, CARD_MARCH],
        pureMana: [{ color: MANA_WHITE, source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({
        players: [player],
        offers: {
          units: [],
          advancedActions: { cards: [CARD_FIRE_BOLT, CARD_ICE_BOLT] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
        },
      });

      // Play Learning card (powered with white mana)
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_LEARNING,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Check influence gained (powered: 4)
      expect(playResult.state.players[0]?.influencePoints).toBe(4);

      // Check Learning discount modifier was created for hand
      const learningModifiers = playResult.state.activeModifiers.filter(
        (m) => m.effect.type === EFFECT_LEARNING_DISCOUNT
      );
      expect(learningModifiers).toHaveLength(1);
      expect(learningModifiers[0]?.effect).toMatchObject({
        type: EFFECT_LEARNING_DISCOUNT,
        cost: 9,
        destination: "hand",
      });
    });
  });
});
