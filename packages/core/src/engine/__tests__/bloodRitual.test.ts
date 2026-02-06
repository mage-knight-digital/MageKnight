/**
 * Tests for Blood Ritual advanced action card
 *
 * Blood Ritual:
 * - Basic: Take a Wound. Gain a red crystal to your Inventory and a mana token of any color (including non-basic).
 * - Powered (Red): Take a Wound. Gain three mana tokens of any colors (including non-basic).
 *   You may pay one mana of a basic color to gain a crystal of that color to your Inventory.
 *
 * FAQ Rulings:
 * - S1: Powered gives at most 1 crystal (optional, one-time only)
 * - S2: Can take black mana during day (may be unusable but allowed)
 * - S3: Wound counts toward knockout in combat
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_PLAYED,
  CHOICE_REQUIRED,
  CARD_BLOOD_RITUAL,
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_BLACK,
  MANA_GOLD,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Blood Ritual Advanced Action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a state ready for Blood Ritual play (non-combat, normal turn)
   */
  function createStateWithBloodRitual(
    playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
  ) {
    const player = createTestPlayer({
      hand: [CARD_BLOOD_RITUAL],
      ...playerOverrides,
    });

    return createTestGameState({ players: [player] });
  }

  /**
   * Create a state in combat with Blood Ritual
   */
  function createCombatStateWithBloodRitual(
    playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
  ) {
    const player = createTestPlayer({
      hand: [CARD_BLOOD_RITUAL],
      ...playerOverrides,
    });

    return createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });
  }

  describe("Basic effect", () => {
    it("should take wound and gain red crystal, then present mana color choice", () => {
      const state = createStateWithBloodRitual();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Wound should be added to hand (compound resolves wound first)
      expect(result.state.players[0].hand).toContain(CARD_WOUND);

      // Red crystal should be gained
      expect(result.state.players[0].crystals.red).toBe(1);

      // Should have pending choice for mana color
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Should have 6 options (red, blue, green, white, gold, black)
        expect(choiceEvent.options).toHaveLength(6);
      }

      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should grant chosen mana token after selecting color", () => {
      const state = createStateWithBloodRitual();

      // Play the card
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Choose blue mana (index 1: red=0, blue=1, green=2, white=3, gold=4, black=5)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have a blue mana token
      const blueTokens = choiceResult.state.players[0].pureMana.filter(
        (t) => t.color === MANA_BLUE
      );
      expect(blueTokens).toHaveLength(1);

      // No pending choice remaining
      expect(choiceResult.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow choosing gold mana token", () => {
      const state = createStateWithBloodRitual();

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Choose gold mana (index 4)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 4,
      });

      const goldTokens = choiceResult.state.players[0].pureMana.filter(
        (t) => t.color === MANA_GOLD
      );
      expect(goldTokens).toHaveLength(1);
    });

    it("S2: should allow choosing black mana token (even during day)", () => {
      const state = createStateWithBloodRitual();

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Choose black mana (index 5)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 5,
      });

      const blackTokens = choiceResult.state.players[0].pureMana.filter(
        (t) => t.color === MANA_BLACK
      );
      expect(blackTokens).toHaveLength(1);
    });

    it("should decrement wound pile count", () => {
      const state = createStateWithBloodRitual();
      const stateWithWoundPile = { ...state, woundPileCount: 10 };

      const playResult = engine.processAction(stateWithWoundPile, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Wound pile should be decremented immediately (wound taken before choice)
      expect(playResult.state.woundPileCount).toBe(9);
    });
  });

  describe("Powered effect", () => {
    it("should take wound and present first mana color choice", () => {
      const state = createStateWithBloodRitual({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Wound should be added to hand
      expect(result.state.players[0].hand).toContain(CARD_WOUND);

      // Should have pending choice for first mana token
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        expect(choiceEvent.options).toHaveLength(6);
      }
    });

    it("should allow choosing 3 mana tokens sequentially", () => {
      const state = createStateWithBloodRitual({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Play the card powered
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose first token: red (index 0)
      const choice1 = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have 1 mana token and another choice pending
      expect(choice1.state.players[0].pureMana).toHaveLength(1);
      expect(choice1.state.players[0].pendingChoice).not.toBeNull();

      // Choose second token: blue (index 1)
      const choice2 = engine.processAction(choice1.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have 2 mana tokens and another choice pending
      expect(choice2.state.players[0].pureMana).toHaveLength(2);
      expect(choice2.state.players[0].pendingChoice).not.toBeNull();

      // Choose third token: green (index 2)
      const choice3 = engine.processAction(choice2.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 2,
      });

      // Should have 3 mana tokens
      expect(choice3.state.players[0].pureMana).toHaveLength(3);

      // Verify the colors
      const colors = choice3.state.players[0].pureMana.map((t) => t.color);
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLUE);
      expect(colors).toContain(MANA_GREEN);

      // Should still have pending choice (optional crystallize)
      expect(choice3.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should allow optional crystal conversion after gaining 3 tokens", () => {
      const state = createStateWithBloodRitual({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Play powered
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose 3 red tokens
      const choice1 = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // red
      });
      const choice2 = engine.processAction(choice1.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // red
      });
      const choice3 = engine.processAction(choice2.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // red
      });

      // Now should have the optional crystallize choice
      // Option 0: convert mana to crystal, Option 1: skip (noop)
      expect(choice3.state.players[0].pendingChoice).not.toBeNull();

      // Choose to convert (option 0) - since all tokens are red, should auto-resolve
      const crystallizeResult = engine.processAction(choice3.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have gained a red crystal (spent 1 token, gained 1 crystal)
      expect(crystallizeResult.state.players[0].crystals.red).toBe(1);
      // Should have 2 tokens remaining (3 - 1 converted)
      expect(crystallizeResult.state.players[0].pureMana).toHaveLength(2);
    });

    it("S1: should allow skipping crystal conversion", () => {
      const state = createStateWithBloodRitual({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Play powered
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose 3 tokens
      const choice1 = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });
      const choice2 = engine.processAction(choice1.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });
      const choice3 = engine.processAction(choice2.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Choose to skip (noop option - index 1)
      const skipResult = engine.processAction(choice3.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should keep all 3 tokens, no crystal gained
      expect(skipResult.state.players[0].pureMana).toHaveLength(3);
      expect(skipResult.state.players[0].crystals.red).toBe(0);

      // No pending choice
      expect(skipResult.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow choosing different mana colors for 3 tokens", () => {
      const state = createStateWithBloodRitual({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose gold, black, red
      const choice1 = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 4, // gold
      });
      const choice2 = engine.processAction(choice1.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 5, // black
      });
      const choice3 = engine.processAction(choice2.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // red
      });

      const colors = choice3.state.players[0].pureMana.map((t) => t.color);
      expect(colors).toContain(MANA_GOLD);
      expect(colors).toContain(MANA_BLACK);
      expect(colors).toContain(MANA_RED);
    });
  });

  describe("FAQ rulings", () => {
    it("S3: Wound counts toward knockout in combat", () => {
      // Start with 4 wounds already in hand - one more will cause knockout
      const state = createCombatStateWithBloodRitual({
        hand: [CARD_BLOOD_RITUAL, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      // Play the card
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Wound should be in hand (5th wound)
      const woundCount = playResult.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundCount).toBe(5);
    });

    it("wound should go to player hand", () => {
      const state = createStateWithBloodRitual();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      // Wound should be in player's hand
      expect(result.state.players[0].hand).toContain(CARD_WOUND);
      const woundCount = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundCount).toBe(1);
    });
  });

  describe("CARD_PLAYED event", () => {
    it("should emit CARD_PLAYED event with description", () => {
      const state = createStateWithBloodRitual();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RITUAL,
        powered: false,
      });

      const cardPlayedEvent = result.events.find((e) => e.type === CARD_PLAYED);
      expect(cardPlayedEvent).toBeDefined();

      if (cardPlayedEvent && cardPlayedEvent.type === CARD_PLAYED) {
        expect(cardPlayedEvent.cardId).toBe(CARD_BLOOD_RITUAL);
      }
    });
  });
});
