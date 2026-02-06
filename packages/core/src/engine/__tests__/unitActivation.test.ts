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
  UNIT_SAVAGE_MONKS,
  UNIT_AMOTEP_FREEZERS,
  UNIT_HERBALIST,
  UNIT_UTEM_CROSSBOWMEN,
  UNIT_FIRE_GOLEMS,
  UNIT_ICE_GOLEMS,
  UNIT_NORTHERN_MONKS,
  UNIT_RED_CAPE_MONKS,
  UNIT_GUARDIAN_GOLEMS,
  CARD_WOUND,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_MOVE,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_SWAMP,
  TERRAIN_PLAINS,
  MANA_SOURCE_TOKEN,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_DIE,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import { sourceDieId } from "../../types/mana.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import { getEffectiveTerrainCost } from "../modifiers/index.js";

describe("Unit Combat Abilities", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Activation", () => {
    it("should activate unit and add attack to accumulator", () => {
      // Peasants have Attack 2 (ability index 0)
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
        abilityIndex: 0, // Attack 2
      });

      // Verify accumulator.attack.normal increased by 2
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(2);

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event was emitted
      const activateEvent = result.events.find(
        (e) => e.type === UNIT_ACTIVATED
      );
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(2);
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
      // Utem Crossbowmen have Ranged Attack 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
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
        unitInstanceId: "crossbow_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Verify success - ranged attack added
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should allow ranged attack in attack phase", () => {
      // Utem Crossbowmen have Ranged Attack 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
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
        unitInstanceId: "crossbow_1",
        abilityIndex: 1, // Ranged Attack 2
      });

      // Verify success - ranged works in attack phase too
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should activate heal ability and remove wounds from hand", () => {
      // Herbalist has Heal 2 (ability index 0, requires green mana)
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND], // 3 wounds
        pureMana: [{ color: MANA_GREEN, source: "card" }],
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
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
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
      // Peasants have Attack 2 (ability index 0)
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
        abilityIndex: 0, // Attack 2
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
      // Utem Crossbowmen have Ranged Attack 3 (ability index 1)
      const unit = createPlayerUnit(UNIT_UTEM_CROSSBOWMEN, "crossbow_1");
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
        unitInstanceId: "crossbow_1",
        abilityIndex: 1, // Ranged Attack 3
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
      // Catapults have Siege Attack 3 (ability index 0)
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
        abilityIndex: 0, // Siege Attack 3
      });

      // Verify success
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Catapults abilities", () => {
    it("should apply Siege Attack 3 (free)", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapult_1");
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
        unitInstanceId: "catapult_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(3);
      expect(
        result.state.players[0].combatAccumulator.attack.siegeElements.physical
      ).toBe(3);
    });

    it("should apply Siege Fire Attack 5 with red mana", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapult_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapult_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(5);
      expect(result.state.players[0].combatAccumulator.attack.siegeElements.fire).toBe(5);
      expect(result.state.players[0].pureMana.length).toBe(0);
    });

    it("should apply Siege Ice Attack 5 with blue mana", () => {
      const unit = createPlayerUnit(UNIT_CATAPULTS, "catapult_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "catapult_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(5);
      expect(result.state.players[0].combatAccumulator.attack.siegeElements.ice).toBe(5);
      expect(result.state.players[0].pureMana.length).toBe(0);
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
      // Two Peasants units with Attack 2 (ability index 0)
      const peasants1 = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const peasants2 = createPlayerUnit(UNIT_PEASANTS, "peasants_2");
      const player = createTestPlayer({
        units: [peasants1, peasants2],
        commandTokens: 2,
      });

      let state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      // Activate first unit (Peasants Attack 2)
      let result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 0, // Attack 2
      });
      state = result.state;
      expect(state.players[0].combatAccumulator.attack.normal).toBe(2);

      // Activate second unit (Peasants Attack 2)
      result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_2",
        abilityIndex: 0, // Attack 2
      });

      // Verify both contribute to accumulator
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);
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
    it("should return clear error for passive abilities like paralyze (Amotep Freezers)", () => {
      // Amotep Freezers have Paralyze at index 2 (passive)
      const unit = createPlayerUnit(UNIT_AMOTEP_FREEZERS, "freezers_1");
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
        unitInstanceId: "freezers_1",
        abilityIndex: 2, // Paralyze (passive)
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

    it("should return clear error for passive abilities like paralyze", () => {
      // Ice Golems have Paralyze at index 4 (passive)
      const unit = createPlayerUnit(UNIT_ICE_GOLEMS, "ice_golems_1");
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
        unitInstanceId: "ice_golems_1",
        abilityIndex: 4, // Paralyze (passive)
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

  describe("Terrain modifiers from unit abilities", () => {
    it("should activate Foresters Move ability and add move points", () => {
      // Foresters have Move 2 (ability index 1) with terrain modifiers
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Move 2
      });

      // Verify move points were added
      expect(result.state.players[0].movePoints).toBe(2);

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event was emitted
      const activateEvent = result.events.find(
        (e) => e.type === UNIT_ACTIVATED
      );
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_MOVE);
        expect(activateEvent.abilityValue).toBe(2);
      }
    });

    it("should apply terrain cost modifiers when Foresters Move ability is activated", () => {
      // Foresters have Move 2 with terrain modifiers for forest/hills/swamp
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Verify no modifiers before activation
      expect(state.activeModifiers.length).toBe(0);

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Move 2 with terrain modifiers
      });

      // Verify terrain cost modifiers were added (forest, hills, swamp)
      expect(result.state.activeModifiers.length).toBe(3);

      // Check each modifier
      const modifiers = result.state.activeModifiers;

      const forestMod = modifiers.find(
        (m) => m.effect.type === "terrain_cost" && m.effect.terrain === TERRAIN_FOREST
      );
      expect(forestMod).toBeDefined();
      if (forestMod && forestMod.effect.type === "terrain_cost") {
        expect(forestMod.effect.amount).toBe(-1);
        expect(forestMod.effect.minimum).toBe(0);
      }

      const hillsMod = modifiers.find(
        (m) => m.effect.type === "terrain_cost" && m.effect.terrain === TERRAIN_HILLS
      );
      expect(hillsMod).toBeDefined();
      if (hillsMod && hillsMod.effect.type === "terrain_cost") {
        expect(hillsMod.effect.amount).toBe(-1);
        expect(hillsMod.effect.minimum).toBe(0);
      }

      const swampMod = modifiers.find(
        (m) => m.effect.type === "terrain_cost" && m.effect.terrain === TERRAIN_SWAMP
      );
      expect(swampMod).toBeDefined();
      if (swampMod && swampMod.effect.type === "terrain_cost") {
        expect(swampMod.effect.amount).toBe(-1);
        expect(swampMod.effect.minimum).toBe(0);
      }
    });

    it("should reduce effective terrain cost when Foresters modifiers are active", () => {
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Check costs before activation
      const forestCostBefore = getEffectiveTerrainCost(state, TERRAIN_FOREST, "player1");
      const hillsCostBefore = getEffectiveTerrainCost(state, TERRAIN_HILLS, "player1");
      const swampCostBefore = getEffectiveTerrainCost(state, TERRAIN_SWAMP, "player1");
      const plainsCostBefore = getEffectiveTerrainCost(state, TERRAIN_PLAINS, "player1");

      // Activate Foresters Move
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1,
      });

      // Check costs after activation
      const forestCostAfter = getEffectiveTerrainCost(result.state, TERRAIN_FOREST, "player1");
      const hillsCostAfter = getEffectiveTerrainCost(result.state, TERRAIN_HILLS, "player1");
      const swampCostAfter = getEffectiveTerrainCost(result.state, TERRAIN_SWAMP, "player1");
      const plainsCostAfter = getEffectiveTerrainCost(result.state, TERRAIN_PLAINS, "player1");

      // Forest, hills, swamp should be reduced by 1
      expect(forestCostAfter).toBe(forestCostBefore - 1);
      expect(hillsCostAfter).toBe(hillsCostBefore - 1);
      expect(swampCostAfter).toBe(swampCostBefore - 1);

      // Plains should be unchanged
      expect(plainsCostAfter).toBe(plainsCostBefore);
    });

    it("should not apply terrain modifiers from Block ability (only from Move)", () => {
      // Foresters have Block 3 (ability index 0) - should NOT add terrain modifiers
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
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
        unitInstanceId: "foresters_1",
        abilityIndex: 0, // Block 3 (no terrain modifiers)
      });

      // No terrain modifiers should be added
      expect(result.state.activeModifiers.length).toBe(0);

      // Block should still work
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
    });
  });

  describe("Mana-powered abilities", () => {
    it("should allow free ability without mana source", () => {
      // Fire Golems have Attack 3 physical (free) at index 0 - Attack OR Block choice
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
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
        unitInstanceId: "fire_golem_1",
        abilityIndex: 0, // Attack 3 physical (free)
      });

      // Should succeed
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should reject powered ability without mana source", () => {
      // Fire Golems have Ranged Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }], // Has mana available
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        // No manaSource provided
      });

      // Should fail - mana source required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("red mana");
      }
    });

    it("should allow powered ability with mana token", () => {
      // Fire Golems have Ranged Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should succeed - ranged fire attack adds to ranged pool
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(4);
      expect(result.state.players[0].combatAccumulator.attack.rangedElements.fire).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Mana token should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);
    });

    it("should allow powered ability with mana crystal", () => {
      // Ice Golems have Attack 5 Ice (requires blue mana) at index 2
      const unit = createPlayerUnit(UNIT_ICE_GOLEMS, "ice_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        crystals: { red: 0, blue: 1, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_golem_1",
        abilityIndex: 2, // Attack 5 Ice (requires blue mana)
        manaSource: { type: MANA_SOURCE_CRYSTAL, color: MANA_BLUE },
      });

      // Should succeed
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(5);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Crystal should be consumed
      expect(result.state.players[0].crystals.blue).toBe(0);
    });

    it("should allow powered ability with mana die", () => {
      // Fire Golems have Ranged Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const dieId = sourceDieId("die_0");
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        source: {
          dice: [{ id: dieId, color: MANA_RED, isDepleted: false, takenByPlayerId: null }],
        },
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_DIE, color: MANA_RED, dieId: "die_0" },
      });

      // Should succeed - ranged fire attack
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(4);
      expect(result.state.players[0].combatAccumulator.attack.rangedElements.fire).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Die should be in used list
      expect(result.state.players[0].usedDieIds).toContain("die_0");
    });

    it("should reject powered ability with wrong mana color", () => {
      // Fire Golems Ranged Fire Attack 4 needs red mana, but we provide blue
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should fail - wrong color
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should reject powered ability when no mana available", () => {
      // Fire Golems have Ranged Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana tokens
        crystals: { red: 0, blue: 0, green: 0, white: 0 }, // No crystals
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
        source: { dice: [] }, // No dice
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should fail - no mana available
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should track mana used this turn for powered abilities", () => {
      // Fire Golems have Ranged Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_FIRE_GOLEMS, "fire_golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "fire_golem_1",
        abilityIndex: 2, // Ranged Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should track mana used
      expect(result.state.players[0].manaUsedThisTurn).toContain(MANA_RED);
    });
  });

  describe("Northern Monks abilities", () => {
    it("should activate free physical Attack 3 (ability index 0)", () => {
      // Northern Monks have Attack 3 (physical, free) at index 0
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
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
        unitInstanceId: "northern_monks_1",
        abilityIndex: 0, // Attack 3 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate free physical Block 3 (ability index 1)", () => {
      // Northern Monks have Block 3 (physical, free) at index 1
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
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
        unitInstanceId: "northern_monks_1",
        abilityIndex: 1, // Block 3 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate Ice Attack 4 with blue mana (ability index 2)", () => {
      // Northern Monks have Ice Attack 4 (requires blue mana) at index 2
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "northern_monks_1",
        abilityIndex: 2, // Ice Attack 4 (requires blue mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should succeed with blue mana
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Blue mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should activate Ice Block 4 with blue mana (ability index 3)", () => {
      // Northern Monks have Ice Block 4 (requires blue mana) at index 3
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "northern_monks_1",
        abilityIndex: 3, // Ice Block 4 (requires blue mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should succeed with blue mana
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Blue mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should reject Ice Attack 4 without blue mana", () => {
      // Northern Monks have Ice Attack 4 (requires blue mana) at index 2
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "northern_monks_1",
        abilityIndex: 2, // Ice Attack 4 (requires blue mana)
        // No manaSource provided
      });

      // Should fail - mana required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("blue mana");
      }
    });

    it("should reject Ice Block 4 with wrong mana color (red)", () => {
      // Northern Monks need blue mana, but we provide red
      const unit = createPlayerUnit(UNIT_NORTHERN_MONKS, "northern_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "northern_monks_1",
        abilityIndex: 3, // Ice Block 4 (requires blue mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should fail - wrong mana color
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  describe("Red Cape Monks abilities", () => {
    it("should activate free physical Attack 3 (ability index 0)", () => {
      // Red Cape Monks have Attack 3 (physical, free) at index 0
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
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
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 0, // Attack 3 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate free physical Block 3 (ability index 1)", () => {
      // Red Cape Monks have Block 3 (physical, free) at index 1
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
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
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 1, // Block 3 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate Fire Attack 4 with red mana (ability index 2)", () => {
      // Red Cape Monks have Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 2, // Fire Attack 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should succeed with red mana
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Red mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should activate Fire Block 4 with red mana (ability index 3)", () => {
      // Red Cape Monks have Fire Block 4 (requires red mana) at index 3
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 3, // Fire Block 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should succeed with red mana
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Red mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should reject Fire Attack 4 without red mana", () => {
      // Red Cape Monks have Fire Attack 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 2, // Fire Attack 4 (requires red mana)
        // No manaSource provided
      });

      // Should fail - mana required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("red mana");
      }
    });

    it("should reject Fire Block 4 with wrong mana color (blue)", () => {
      // Red Cape Monks need red mana, but we provide blue
      const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "red_cape_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "red_cape_monks_1",
        abilityIndex: 3, // Fire Block 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should fail - wrong mana color
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  describe("Guardian Golems abilities", () => {
    it("should activate free physical Attack 2 (ability index 0)", () => {
      // Guardian Golems have Attack 2 (physical, free) at index 0
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
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
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 0, // Attack 2 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(2);
      }
    });

    it("should activate free physical Block 2 (ability index 1)", () => {
      // Guardian Golems have Block 2 (physical, free) at index 1
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
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
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 1, // Block 2 (physical, free)
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.block).toBe(2);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(2);
      }
    });

    it("should activate Fire Block 4 with red mana (ability index 2)", () => {
      // Guardian Golems have Fire Block 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 2, // Fire Block 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Should succeed with red mana
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Red mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should activate Ice Block 4 with blue mana (ability index 3)", () => {
      // Guardian Golems have Ice Block 4 (requires blue mana) at index 3
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 3, // Ice Block 4 (requires blue mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should succeed with blue mana
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Blue mana should be consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Check event
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should reject Fire Block 4 without red mana", () => {
      // Guardian Golems have Fire Block 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 2, // Fire Block 4 (requires red mana)
        // No manaSource provided
      });

      // Should fail - mana required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("red mana");
      }
    });

    it("should reject Ice Block 4 without blue mana", () => {
      // Guardian Golems have Ice Block 4 (requires blue mana) at index 3
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 3, // Ice Block 4 (requires blue mana)
        // No manaSource provided
      });

      // Should fail - mana required
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("blue mana");
      }
    });

    it("should reject Fire Block 4 with wrong mana color (blue)", () => {
      // Guardian Golems need red mana for Fire Block, but we provide blue
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 2, // Fire Block 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should fail - wrong mana color
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should allow Fire Block 4 with red mana from crystal", () => {
      // Guardian Golems have Fire Block 4 (requires red mana) at index 2
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 2, // Fire Block 4 (requires red mana)
        manaSource: { type: MANA_SOURCE_CRYSTAL, color: MANA_RED },
      });

      // Should succeed
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Crystal should be consumed
      expect(result.state.players[0].crystals.red).toBe(0);
    });

    it("should allow Ice Block 4 with blue mana from die", () => {
      // Guardian Golems have Ice Block 4 (requires blue mana) at index 3
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "guardian_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const dieId = sourceDieId("die_0");
      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
        source: {
          dice: [{ id: dieId, color: MANA_BLUE, isDepleted: false, takenByPlayerId: null }],
        },
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "guardian_golems_1",
        abilityIndex: 3, // Ice Block 4 (requires blue mana)
        manaSource: { type: MANA_SOURCE_DIE, color: MANA_BLUE, dieId: "die_0" },
      });

      // Should succeed
      expect(result.state.players[0].combatAccumulator.block).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      // Die should be in used list
      expect(result.state.players[0].usedDieIds).toContain("die_0");
    });
  });

  describe("Undo", () => {
    it("should undo move ability and restore move points", () => {
      // Foresters have Move 2 (ability index 1)
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        movePoints: 0,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Activate Foresters Move ability
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Move 2
      });

      // Verify move points were added
      expect(afterActivate.state.players[0].movePoints).toBe(2);
      expect(afterActivate.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Undo the activation
      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO",
      });

      // Move points should be restored to 0
      expect(afterUndo.state.players[0].movePoints).toBe(0);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should undo influence ability and restore influence points", () => {
      // Peasants have Influence 2 (ability index 2)
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasants_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        influencePoints: 5,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Activate Peasants Influence ability
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "peasants_1",
        abilityIndex: 2, // Influence 2
      });

      // Verify influence points were added
      expect(afterActivate.state.players[0].influencePoints).toBe(7);
      expect(afterActivate.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Undo the activation
      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO",
      });

      // Influence points should be restored to 5
      expect(afterUndo.state.players[0].influencePoints).toBe(5);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should undo heal ability and restore wounds to hand", () => {
      // Herbalist has Heal 2 (ability index 0, requires green mana)
      const unit = createPlayerUnit(UNIT_HERBALIST, "herbalist_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND], // 3 wounds
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
        woundPileCount: 10,
      });

      // Activate Herbalist Heal ability
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "herbalist_1",
        abilityIndex: 0, // Heal 2
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Verify wounds were removed (Heal 2 = remove 2 wounds)
      const woundsAfterHeal = afterActivate.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsAfterHeal).toBe(1);
      expect(afterActivate.state.woundPileCount).toBe(12); // 10 + 2 returned
      expect(afterActivate.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Undo the activation
      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO",
      });

      // Wounds should be restored to hand
      const woundsAfterUndo = afterUndo.state.players[0].hand.filter(
        (c) => c === CARD_WOUND
      ).length;
      expect(woundsAfterUndo).toBe(3);
      // Wound pile should be restored
      expect(afterUndo.state.woundPileCount).toBe(10);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should undo terrain modifiers when Foresters Move is undone", () => {
      // Foresters have Move 2 with terrain modifiers
      const unit = createPlayerUnit(UNIT_FORESTERS, "foresters_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        phase: GAME_PHASE_ROUND,
        combat: null,
      });

      // Verify no modifiers before activation
      expect(state.activeModifiers.length).toBe(0);

      // Activate Foresters Move ability
      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "foresters_1",
        abilityIndex: 1, // Move 2 with terrain modifiers
      });

      // Verify terrain cost modifiers were added
      expect(afterActivate.state.activeModifiers.length).toBe(3);

      // Undo the activation
      const afterUndo = engine.processAction(afterActivate.state, "player1", {
        type: "UNDO",
      });

      // Terrain modifiers should be removed
      expect(afterUndo.state.activeModifiers.length).toBe(0);
      // Unit should be ready again
      expect(afterUndo.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });
  });

  describe("Savage Monks abilities", () => {
    it("should activate free physical Attack 3 (ability index 0)", () => {
      const unit = createPlayerUnit(UNIT_SAVAGE_MONKS, "savage_monks_1");
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
        unitInstanceId: "savage_monks_1",
        abilityIndex: 0, // Attack 3 (physical, free)
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate free physical Block 3 (ability index 1)", () => {
      const unit = createPlayerUnit(UNIT_SAVAGE_MONKS, "savage_monks_1");
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
        unitInstanceId: "savage_monks_1",
        abilityIndex: 1, // Block 3 (physical, free)
      });

      expect(result.state.players[0].combatAccumulator.block).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
        expect(activateEvent.abilityValue).toBe(3);
      }
    });

    it("should activate Siege Attack 4 with green mana (ability index 2)", () => {
      const unit = createPlayerUnit(UNIT_SAVAGE_MONKS, "savage_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "savage_monks_1",
        abilityIndex: 2, // Siege Attack 4 (requires green mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.siege).toBe(4);
      expect(
        result.state.players[0].combatAccumulator.attack.siegeElements.physical
      ).toBe(4);
      expect(result.state.players[0].pureMana.length).toBe(0);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
      if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
        expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_SIEGE_ATTACK);
        expect(activateEvent.abilityValue).toBe(4);
      }
    });

    it("should reject Siege Attack 4 without green mana", () => {
      const unit = createPlayerUnit(UNIT_SAVAGE_MONKS, "savage_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "savage_monks_1",
        abilityIndex: 2, // Siege Attack 4 (requires green mana)
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("green mana");
      }
    });

    it("should reject Siege Attack 4 with wrong mana color (red)", () => {
      const unit = createPlayerUnit(UNIT_SAVAGE_MONKS, "savage_monks_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "savage_monks_1",
        abilityIndex: 2, // Siege Attack 4 (requires green mana)
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });
});
