/**
 * Unit Activation tests
 *
 * Tests for unit combat ability activation, phase restrictions,
 * siege requirements, spent unit behavior, and validation rules.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  GAME_PHASE_ROUND,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_THUGS,
  UNIT_FORESTERS,
  UNIT_CATAPULTS,
  UNIT_SHOCKTROOPS,
  UNIT_HERBALIST,
  CARD_WOUND,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_HEAL,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";

describe("Unit Combat Abilities", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Activation", () => {
    it("should activate unit and add attack to accumulator", () => {
      // Thugs have Attack 3 (ability index 0)
      const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 0, // Attack 3
      });

      // Verify accumulator.attack.normal increased by 3
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event was emitted
      const activateEvent = result.events.find(
        (e) => e.type === UNIT_ACTIVATED
      );
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate unit and add block to accumulator", () => {
      // Peasants have Block 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 1, // Block 2
      });

      // Verify accumulator.block increased by 2
      expect(result.state.players[0].combatAccumulator.block).toBe(2);

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should allow ranged attack in ranged & siege phase", () => {
      // Foresters have Ranged Attack 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Verify success - ranged attack added
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should allow ranged attack in attack phase", () => {
      // Foresters have Ranged Attack 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Verify success - ranged works in attack phase too
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should activate heal ability and remove wounds from hand", () => {
      // Herbalist has Heal 2 (ability index 0)
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND], // 3 wounds
      });

      // Heal ability should work outside of combat
      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0, // Heal 2
      });

      // Verify wounds were removed from hand (Heal 2 = remove 2 wounds)
      const woundsRemaining = result.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsRemaining).toBe(1); // 3 - 2 = 1 wound remaining

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify wound pile is unlimited (null) and stays unlimited
      expect(result.state.woundPileCount).toBeNull();

      // Check event was emitted
      const activateEvent = result.events.find(
        (e) => e.type === UNIT_ACTIVATED
      );
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_HEAL);
        expect(activateEvent.abilityValue).toBe(2);
      }
    });
  });

  describe("Phase restrictions", () => {
    it("should reject block ability in attack phase", () => {
      // Peasants have Block 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 1, // Block 2
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Block phase");
      }
    });

    it("should reject attack ability in block phase", () => {
      // Thugs have Attack 3 (ability index 0)
      const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 0, // Attack 3
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Attack phase");
      }
    });
  });

  describe("Siege requirements", () => {
    it("should reject ranged attack at fortified site in ranged phase", () => {
      // Foresters have Ranged Attack 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE, true), // Fortified!
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Siege");
      }
    });

    it("should allow siege attack at fortified site in ranged phase", () => {
      // Catapults have Siege Attack 4 (ability index 0)
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapult_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE, true), // Fortified!
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapult_1",
        abilityIndex: 0, // Siege Attack 4
      });

      // Verify success
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Spent units", () => {
    it("should allow spent unit to absorb damage", () => {
      // Peasants - first activate for Block, then assign damage to same unit
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Start in block phase
      let state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      // Activate unit for Block (becomes spent)
      let result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 1, // Block 2
      });
      state = result.state;

      expect(state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Now move to assign damage phase
      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      state = {
        ...state,
        combat: {
          ...combat,
          phase: COMBAT_PHASE_ASSIGN_DAMAGE,
        },
      };

      // Assign damage to same unit
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          {
            target: DAMAGE_TARGET_UNIT,
            unitInstanceId: "peasants_1",
            amount: 3,
          },
        ],
      });

      // Spent unit should still be able to absorb damage
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });

    it("should not allow spent unit to activate again", () => {
      // Unit already spent
      const unit = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 0, // Attack 2
      });

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not ready");
      }
    });
  });

  describe("Multiple units", () => {
    it("should allow multiple units to contribute in same phase", () => {
      // Two units with Attack abilities
      const thugs = createPlayerUnit(UNIT_THUGS, "thugs_1");
      const peasants = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [thugs, peasants],
        commandTokens: 2,
      });

      let state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      // Activate first unit (Thugs Attack 3)
      let result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 0, // Attack 3
      });
      state = result.state;
      expect(state.players[0].combatAccumulator.attack.normal).toBe(3);

      // Activate second unit (Peasants Attack 2)
      result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 0, // Attack 2
      });

      // Verify both contribute to accumulator
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(5);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Combat requirement", () => {
    it("should reject combat abilities when not in combat", () => {
      // Thugs have Attack 3
      const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // No combat state
      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 0, // Attack 3
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("combat");
      }
    });
  });

  describe("Invalid ability index", () => {
    it("should reject invalid ability index", () => {
      // Thugs only have 1 ability (index 0)
      const unit = createPlayerUnit(UNIT_THUGS, "thugs_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "thugs_1",
        abilityIndex: 5, // Invalid index
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  describe("Wounded units", () => {
    it("should not allow wounded unit to activate", () => {
      const unit = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasants_1"),
        wounded: true,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 0, // Attack 2
      });

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Wounded");
      }
    });
  });

  describe("Passive abilities", () => {
    it("should return clear error for passive abilities like swift", () => {
      // Shocktroops have Swift at index 1 (passive)
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1, // Swift (passive)
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event with helpful message
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("passive");
        expect(invalidEvent.reason).toContain("automatically");
      }
    });

    it("should return clear error for passive abilities like brutal", () => {
      // Shocktroops have Brutal at index 2 (passive)
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2, // Brutal (passive)
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event with helpful message
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("passive");
        expect(invalidEvent.reason).toContain("automatically");
      }
    });
  });
});
