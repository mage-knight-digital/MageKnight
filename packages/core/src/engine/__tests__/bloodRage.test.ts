/**
 * Tests for Blood Rage advanced action card
 *
 * Blood Rage:
 * - Basic: Attack 2. You can take a Wound to increase this to Attack 5.
 * - Powered (Red): Attack 4. You can take a Wound to increase this to Attack 9.
 *
 * FAQ Rulings:
 * - S21: If wound causes knockout, attack still resolves
 * - S1: Wound goes to hand (not unit)
 * - S2: Wound can be used immediately with Power of Pain/Invocation
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_PLAYED,
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
  CARD_BLOOD_RAGE,
  CARD_WOUND,
  CARD_MARCH,
  MANA_RED,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Blood Rage Advanced Action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a state ready for combat card play with Blood Rage in hand
   */
  function createCombatStateWithBloodRage(
    playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {}
  ) {
    const player = createTestPlayer({
      hand: [CARD_BLOOD_RAGE],
      combatAccumulator: {
        attack: {
          normal: 0,
          ranged: 0,
          siege: 0,
          normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        },
        assignedAttack: {
          normal: 0,
          ranged: 0,
          siege: 0,
          normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        },
        block: 0,
        blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        blockSources: [],
      },
      ...playerOverrides,
    });

    return createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });
  }

  describe("Basic effect", () => {
    it("should present choice between Attack 2 and Take wound + Attack 5", () => {
      const state = createCombatStateWithBloodRage();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      // Should emit CHOICE_REQUIRED event
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        expect(choiceEvent.options).toHaveLength(2);
        // First option: Attack 2 (no wound)
        expect(choiceEvent.options[0]).toContain("Attack 2");
        // Second option: Take wound + Attack 5
        expect(choiceEvent.options[1]).toContain("wound");
        expect(choiceEvent.options[1]).toContain("Attack 5");
      }

      // Player should have pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should grant Attack 2 when declining the wound", () => {
      const state = createCombatStateWithBloodRage();

      // Play the card
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      // Choose option 0: Attack 2 (no wound)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have Attack 2
      expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(2);

      // Should NOT have wound in hand
      expect(choiceResult.state.players[0].hand).not.toContain(CARD_WOUND);

      // Choice should be resolved
      const resolvedEvent = choiceResult.events.find((e) => e.type === CHOICE_RESOLVED);
      expect(resolvedEvent).toBeDefined();
    });

    it("should grant Attack 5 and add wound to hand when accepting the wound cost", () => {
      const state = createCombatStateWithBloodRage();

      // Play the card
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      // Choose option 1: Take wound + Attack 5
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have Attack 5
      expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(5);

      // Should have wound in hand
      expect(choiceResult.state.players[0].hand).toContain(CARD_WOUND);

      // No pending choice
      expect(choiceResult.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("Powered effect", () => {
    it("should present choice between Attack 4 and Take wound + Attack 9", () => {
      const state = createCombatStateWithBloodRage({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should emit CHOICE_REQUIRED event
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        expect(choiceEvent.options).toHaveLength(2);
        // First option: Attack 4 (no wound)
        expect(choiceEvent.options[0]).toContain("Attack 4");
        // Second option: Take wound + Attack 9
        expect(choiceEvent.options[1]).toContain("wound");
        expect(choiceEvent.options[1]).toContain("Attack 9");
      }
    });

    it("should grant Attack 4 when declining the wound (powered)", () => {
      const state = createCombatStateWithBloodRage({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Play the card powered
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose option 0: Attack 4 (no wound)
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have Attack 4
      expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(4);

      // Should NOT have wound in hand
      expect(choiceResult.state.players[0].hand).not.toContain(CARD_WOUND);
    });

    it("should grant Attack 9 and add wound to hand when accepting the wound cost (powered)", () => {
      const state = createCombatStateWithBloodRage({
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Play the card powered
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: true,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Choose option 1: Take wound + Attack 9
      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have Attack 9
      expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(9);

      // Should have wound in hand
      expect(choiceResult.state.players[0].hand).toContain(CARD_WOUND);
    });
  });

  describe("FAQ rulings", () => {
    it("S1: Wound should go to player's hand, not a unit", () => {
      const state = createCombatStateWithBloodRage();

      // Play and choose wound option
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Wound should be in player's hand
      expect(choiceResult.state.players[0].hand).toContain(CARD_WOUND);

      // Units should not have wounds (they have a different wound tracking mechanism)
      // Just verify the wound is actually in hand
      const woundCount = choiceResult.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundCount).toBe(1);
    });

    it("S21: Attack should resolve even if wound causes knockout (5+ wounds in hand)", () => {
      // Start with 4 wounds already in hand - one more will cause knockout
      const state = createCombatStateWithBloodRage({
        hand: [CARD_BLOOD_RAGE, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      // Play and choose wound option
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Take wound + Attack 5
      });

      // Attack should still resolve - this is the key ruling
      // The compound effect executes wound first, then attack
      expect(choiceResult.state.players[0].combatAccumulator.attack.normal).toBe(5);

      // Player now has 5 wounds in hand
      const woundCount = choiceResult.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundCount).toBe(5);
    });

    it("S2: Wound should be available for other effects like Power of Pain (wound is in hand)", () => {
      const state = createCombatStateWithBloodRage();

      // Play and choose wound option
      const playResult = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Take wound
      });

      // The wound is in hand and available for other card effects
      // This verifies the wound is accessible (not in some temporary state)
      expect(choiceResult.state.players[0].hand).toContain(CARD_WOUND);

      // Verify the hand contains the wound alongside other cards
      // (Blood Rage moved to play area, so just wound should be in hand)
      expect(choiceResult.state.players[0].hand).toEqual([CARD_WOUND]);
    });
  });

  describe("Card effect description", () => {
    it("should generate correct description for choice options", () => {
      const state = createCombatStateWithBloodRage();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      if (choiceEvent && choiceEvent.type === CHOICE_REQUIRED) {
        // Option 0 should describe base attack
        expect(choiceEvent.options[0].toLowerCase()).toContain("attack");

        // Option 1 should describe wound + attack
        expect(choiceEvent.options[1].toLowerCase()).toContain("wound");
        expect(choiceEvent.options[1].toLowerCase()).toContain("attack");
      }
    });

    it("CARD_PLAYED event should indicate choice is required", () => {
      const state = createCombatStateWithBloodRage();

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const cardPlayedEvent = result.events.find((e) => e.type === CARD_PLAYED);
      expect(cardPlayedEvent).toBeDefined();

      if (cardPlayedEvent && cardPlayedEvent.type === CARD_PLAYED) {
        expect(cardPlayedEvent.cardId).toBe(CARD_BLOOD_RAGE);
        // Effect description should indicate choice
        expect(cardPlayedEvent.effect.toLowerCase()).toContain("choice");
      }
    });
  });

  describe("Wound pile interaction", () => {
    it("should decrement wound pile count when taking wound", () => {
      const state = createCombatStateWithBloodRage();
      // Set a specific wound pile count
      const stateWithWoundPile = {
        ...state,
        woundPileCount: 10,
      };

      // Play and choose wound option
      const playResult = engine.processAction(stateWithWoundPile, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Take wound
      });

      // Wound pile should be decremented
      expect(choiceResult.state.woundPileCount).toBe(9);
    });

    it("should not decrement wound pile count when not taking wound", () => {
      const state = createCombatStateWithBloodRage();
      const stateWithWoundPile = {
        ...state,
        woundPileCount: 10,
      };

      // Play and choose no wound option
      const playResult = engine.processAction(stateWithWoundPile, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choiceResult = engine.processAction(playResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Attack 2, no wound
      });

      // Wound pile should be unchanged
      expect(choiceResult.state.woundPileCount).toBe(10);
    });
  });

  describe("Multiple card plays", () => {
    it("should stack attack values when playing Blood Rage with other attack cards", () => {
      const state = createCombatStateWithBloodRage({
        hand: [CARD_BLOOD_RAGE, CARD_MARCH], // March can be played for movement sideways, but let's use another attack
      });

      // For this test, we'll play Blood Rage twice to verify stacking
      // First, add another Blood Rage to hand
      const stateWithTwoBloodRage = {
        ...state,
        players: [
          {
            ...state.players[0],
            hand: [CARD_BLOOD_RAGE, CARD_BLOOD_RAGE],
          },
        ],
      };

      // Play first Blood Rage and take wound for Attack 5
      const play1Result = engine.processAction(stateWithTwoBloodRage, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choice1Result = engine.processAction(play1Result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Attack 5
      });

      // Play second Blood Rage and decline wound for Attack 2
      const play2Result = engine.processAction(choice1Result.state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_BLOOD_RAGE,
        powered: false,
      });

      const choice2Result = engine.processAction(play2Result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Attack 2
      });

      // Total attack should be 5 + 2 = 7
      expect(choice2Result.state.players[0].combatAccumulator.attack.normal).toBe(7);

      // Only one wound in hand (from first play)
      const woundCount = choice2Result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundCount).toBe(1);
    });
  });
});
