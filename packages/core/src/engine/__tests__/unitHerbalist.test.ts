/**
 * Herbalist Unit Ability Tests
 *
 * Herbalist has three abilities:
 * 1. (Green Mana) Heal 2 - mana-powered healing
 * 2. Ready a Level I/II Unit - free, no combat required
 * 3. Gain Green Mana Token - free, no combat required
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  GAME_PHASE_ROUND,
  INVALID_ACTION,
  UNIT_HERBALIST,
  UNIT_PEASANTS,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_GREEN,
  CARD_WOUND,
  UNIT_ABILITY_HEAL,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import { HERBALIST } from "@mage-knight/shared";

describe("Herbalist Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(HERBALIST.name).toBe("Herbalist");
      expect(HERBALIST.level).toBe(1);
      expect(HERBALIST.influence).toBe(3);
      expect(HERBALIST.armor).toBe(2);
    });

    it("should have three abilities", () => {
      expect(HERBALIST.abilities.length).toBe(3);
    });

    it("should have Heal 2 as first ability with green mana cost", () => {
      const ability = HERBALIST.abilities[0];
      expect(ability?.type).toBe("heal");
      expect(ability?.value).toBe(2);
      expect(ability?.manaCost).toBe(MANA_GREEN);
    });

    it("should have Ready Unit as second ability (free, no combat required)", () => {
      const ability = HERBALIST.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.requiresCombat).toBe(false);
      expect(ability?.displayName).toContain("Ready");
    });

    it("should have Gain Green Mana as third ability (free, no combat required)", () => {
      const ability = HERBALIST.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.requiresCombat).toBe(false);
      expect(ability?.displayName).toContain("Mana");
    });
  });

  describe("Heal 2 (Ability 0 - Green Mana)", () => {
    it("should heal 2 wounds with green mana", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0, // Heal 2
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Verify wounds were removed (Heal 2 = remove 2 wounds)
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsRemaining).toBe(1);

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify green mana was consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_HEAL);
        expect(activateEvent.abilityValue).toBe(2);
      }
    });

    it("should require green mana to heal", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND],
        pureMana: [], // No mana
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0, // Heal 2
        // No mana source provided
      });

      // Should fail - mana required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("green mana");
      }
    });

    it("should heal only available wounds (fewer than heal value)", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND], // Only 1 wound
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0, // Heal 2 (but only 1 wound available)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Should heal the 1 available wound
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsRemaining).toBe(0);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Ready Unit (Ability 1 - Free)", () => {
    // Note: When the Herbalist activates, it becomes spent first, then the
    // Ready Unit effect finds eligible units. The Herbalist itself becomes
    // a target (it's spent and level 1). So with 1 pre-spent unit, there
    // are 2 spent targets (Herbalist + the other unit) → choice needed.

    it("should present choice between Herbalist and other spent unit", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1, // Ready Unit
      });

      // Herbalist becomes spent, now there are 2 spent level 1 units → choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should ready chosen unit when resolving choice", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants1 = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const peasants2 = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_2"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants1, peasants2],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Step 1: Activate ready unit ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1,
      });

      // Should have pending choice (3 spent units: herbalist + peasants1 + peasants2)
      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();

      // Step 2: Choose the first option (herbalist itself, since it's first in unit list)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }
      );

      // The first spent unit in the list (herbalist) should be readied
      expect(choiceResult.state.players[0].units[0].state).toBe(UNIT_STATE_READY); // Herbalist readied
      expect(choiceResult.state.players[0].units[1].state).toBe(UNIT_STATE_SPENT); // peasants_1 still spent
      expect(choiceResult.state.players[0].units[2].state).toBe(UNIT_STATE_SPENT); // peasants_2 still spent
    });

    it("should ready a specific target unit", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Step 1: Activate ready unit ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1,
      });

      // Step 2: Choose second option (Peasants)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1,
        }
      );

      // Herbalist stays spent, Peasants readied
      expect(choiceResult.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT); // Herbalist
      expect(choiceResult.state.players[0].units[1].state).toBe(UNIT_STATE_READY); // Peasants
    });

    it("should not require mana", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants],
        commandTokens: 1,
        pureMana: [], // No mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1, // Ready Unit - no mana cost
      });

      // Should succeed without mana (choice presented)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT); // Herbalist
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });

    it("should work outside combat", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null, // Not in combat
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1, // Ready Unit
      });

      // Should succeed outside combat (Herbalist spent, choice presented)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });
  });

  describe("Gain Green Mana (Ability 2 - Free)", () => {
    it("should grant a green mana token", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 2, // Gain Green Mana
      });

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify green mana token was gained
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].pureMana[0].color).toBe(MANA_GREEN);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should not require mana", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 2, // Gain Green Mana
      });

      // Should succeed without mana
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(1);
    });

    it("should work outside combat", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null, // Not in combat
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 2, // Gain Green Mana
      });

      // Should succeed outside combat
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].pureMana[0].color).toBe(MANA_GREEN);
    });

    it("should add to existing mana tokens", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }], // Already has 1 green
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 2, // Gain Green Mana
      });

      // Should now have 2 green mana tokens
      expect(result.state.players[0].pureMana.length).toBe(2);
      expect(
        result.state.players[0].pureMana.filter((t) => t.color === MANA_GREEN).length
      ).toBe(2);
    });
  });

  describe("Ability Choice", () => {
    it("should allow player to choose which ability to use", () => {
      // Test that heal ability with mana works at index 0
      const herbalist1 = createPlayerUnit(UNIT_HERBALIST, "herbalist_a");
      const player1 = createTestPlayer({
        units: [herbalist1],
        commandTokens: 1,
        hand: [CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state1 = createTestGameState({
        players: [player1],
        combat: null,
      });

      // Choose heal ability (index 0)
      const healResult = engine.processAction(state1, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_a",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(healResult.state.players[0].hand.filter((c) => c === CARD_WOUND).length).toBe(0);
      expect(healResult.state.players[0].pureMana.length).toBe(0); // Mana consumed

      // Test that gain mana ability works at index 2
      const herbalist2 = createPlayerUnit(UNIT_HERBALIST, "herbalist_b");
      const player2 = createTestPlayer({
        units: [herbalist2],
        commandTokens: 1,
        pureMana: [],
      });

      const state2 = createTestGameState({
        players: [player2],
        combat: null,
      });

      // Choose gain mana ability (index 2)
      const manaResult = engine.processAction(state2, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_b",
        abilityIndex: 2,
      });

      expect(manaResult.state.players[0].pureMana.length).toBe(1);
      expect(manaResult.state.players[0].pureMana[0].color).toBe(MANA_GREEN);
    });
  });

  describe("Unit Spent After Activation", () => {
    it("should become spent after using heal ability", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND],
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should become spent after using ready unit ability", () => {
      const herbalist = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const peasants = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [herbalist, peasants],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT); // Herbalist
    });

    it("should become spent after using gain mana ability", () => {
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });
});
