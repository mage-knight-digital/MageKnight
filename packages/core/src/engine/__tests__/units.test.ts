/**
 * Unit System tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex, createVillageSite } from "./testHelpers.js";
import { hexKey } from "@mage-knight/shared";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_RECRUITED,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  GAME_PHASE_ROUND,
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  UNIT_WOUNDED,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
} from "@mage-knight/shared";
import { createPlayerUnit, readyAllUnits } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";

describe("Unit System", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  /**
   * Create a game state where the player is at a village (for recruitment tests)
   */
  function createStateWithVillage(playerOverrides: Parameters<typeof createTestPlayer>[0] = {}) {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      ...playerOverrides,
    });

    const hexWithVillage = createTestHex(0, 0, undefined, createVillageSite());

    return createTestGameState({
      players: [player],
      phase: GAME_PHASE_ROUND,
      map: {
        hexes: {
          [hexKey({ q: 0, r: 0 })]: hexWithVillage,
        },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
    });
  }

  describe("Recruiting", () => {
    it("should recruit unit when command slots available", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4, // Peasants cost 4
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(false);

      // Check event was emitted
      const recruitEvent = result.events.find(
        (e) => e.type === UNIT_RECRUITED
      );
      expect(recruitEvent).toBeDefined();
      if (recruitEvent && recruitEvent.type === UNIT_RECRUITED) {
        expect(recruitEvent.unitId).toBe(UNIT_PEASANTS);
        expect(recruitEvent.influenceSpent).toBe(4);
      }
    });

    it("should reject recruit when no command slots available", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_unit");
      const state = createStateWithVillage({
        units: [existingUnit],
        commandTokens: 1, // Only 1 slot, already full
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // Should still have only 1 unit
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("command slot");
      }
    });

    it("should reject recruit with insufficient influence", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 2, // Less than cost of 4
      });

      // Should not have any units
      expect(result.state.players[0].units).toHaveLength(0);

      // Check for invalid action event
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("influence");
      }
    });

    it("should recruit with exactly the right influence", () => {
      const state = createStateWithVillage({
        units: [],
        commandTokens: 2,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4, // Exactly the cost
      });

      expect(result.state.players[0].units).toHaveLength(1);
    });

    it("should allow recruiting multiple units up to command limit", () => {
      let state = createStateWithVillage({
        units: [],
        commandTokens: 3,
      });

      // Recruit first unit
      let result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(1);

      // Recruit second unit
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(2);

      // Recruit third unit
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      state = result.state;
      expect(state.players[0].units).toHaveLength(3);

      // Fourth should fail
      result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });
      expect(result.state.players[0].units).toHaveLength(3);
      expect(result.events.some((e) => e.type === INVALID_ACTION)).toBe(true);
    });
  });

  describe("Unit state helpers", () => {
    it("createPlayerUnit should create unit with ready state", () => {
      const unit = createPlayerUnit(UNIT_PEASANTS, "test_unit_1");

      expect(unit.unitId).toBe(UNIT_PEASANTS);
      expect(unit.instanceId).toBe("test_unit_1");
      expect(unit.state).toBe(UNIT_STATE_READY);
      expect(unit.wounded).toBe(false);
      expect(unit.usedResistanceThisCombat).toBe(false);
    });

    it("readyAllUnits should reset unit states", () => {
      const units = [
        {
          instanceId: "unit_1",
          unitId: UNIT_PEASANTS,
          state: UNIT_STATE_SPENT as const,
          wounded: true,
          usedResistanceThisCombat: true,
        },
        {
          instanceId: "unit_2",
          unitId: UNIT_GUARDIAN_GOLEMS,
          state: UNIT_STATE_SPENT as const,
          wounded: false,
          usedResistanceThisCombat: true,
        },
      ];

      const readied = readyAllUnits(units);

      expect(readied[0].state).toBe(UNIT_STATE_READY);
      expect(readied[0].wounded).toBe(true); // Wounds persist
      expect(readied[0].usedResistanceThisCombat).toBe(false);

      expect(readied[1].state).toBe(UNIT_STATE_READY);
      expect(readied[1].wounded).toBe(false);
      expect(readied[1].usedResistanceThisCombat).toBe(false);
    });
  });

  describe("Damage absorption", () => {
    it("should wound non-resistant unit and absorb armor", () => {
      // Peasants have armor 3, no resistances
      const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Create combat state with a physical attacking enemy
      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      // Assign all damage to the unit
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "peasant_1", amount: 3 },
        ],
      });

      // Unit should be wounded (3 damage <= 3 armor, but not resistant)
      expect(result.state.players[0].units[0].wounded).toBe(true);

      // Check wound event
      const woundEvent = result.events.find((e) => e.type === UNIT_WOUNDED);
      expect(woundEvent).toBeDefined();
    });

    it("should not wound resistant unit if damage <= armor", () => {
      // Guardian Golems have armor 3 and physical resistance
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3, // Equal to armor
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 3 },
        ],
      });

      // Unit should NOT be wounded (resistant, damage <= armor)
      expect(result.state.players[0].units[0].wounded).toBe(false);
      // But should have used resistance
      expect(result.state.players[0].units[0].usedResistanceThisCombat).toBe(
        true
      );
    });

    it("should wound resistant unit if damage > armor", () => {
      // Guardian Golems have armor 3 and physical resistance
      const unit = createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 5, // More than armor (3)
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 5 },
        ],
      });

      // Unit should be wounded (resistant, but damage > armor)
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });

    it("should reject assigning damage to wounded unit", () => {
      // Already wounded peasant - cannot be targeted
      const unit = {
        ...createPlayerUnit(UNIT_PEASANTS, "peasant_1"),
        wounded: true,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "peasant_1", amount: 3 },
        ],
      });

      // Unit should still be there (action rejected)
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("wounded");
      }
    });

    it("should reject assigning damage to unit that used resistance", () => {
      // Unit that absorbed damage via resistance this combat
      const unit = {
        ...createPlayerUnit(UNIT_GUARDIAN_GOLEMS, "golem_1"),
        usedResistanceThisCombat: true,
      };
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const combatState = {
        enemies: [
          {
            instanceId: "enemy_1",
            definition: {
              id: ENEMY_DIGGERS,
              name: "Diggers",
              color: "green" as const,
              attack: 3,
              attackElement: ELEMENT_PHYSICAL,
              armor: 3,
              fame: 2,
              resistances: { physical: false, fire: false, ice: false },
              abilities: [],
            },
            isBlocked: false,
            isDefeated: false,
            damageAssigned: false,
          },
        ],
        phase: "assign_damage" as const,
        woundsThisCombat: 0,
        isAtFortifiedSite: false,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          { target: DAMAGE_TARGET_UNIT, unitInstanceId: "golem_1", amount: 3 },
        ],
      });

      // Unit should still be there (action rejected)
      expect(result.state.players[0].units).toHaveLength(1);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("absorbed damage");
      }
    });
  });
});
