/**
 * Unit Damage Absorption tests
 *
 * Tests for unit state helpers and damage absorption mechanics
 * including wounding, resistance, and rejection rules.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  UNIT_WOUNDED,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNIT_PEASANTS,
  UNIT_GUARDIAN_GOLEMS,
  INVALID_ACTION,
} from "@mage-knight/shared";
import { createPlayerUnit, readyAllUnits } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";

describe("Unit State Helpers", () => {
  beforeEach(() => {
    resetUnitInstanceCounter();
  });

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

describe("Unit Damage Absorption", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  /**
   * Create a combat state with an enemy for damage tests
   */
  function createDamageCombatState(attackValue: number = 3) {
    return {
      enemies: [
        {
          instanceId: "enemy_1",
          definition: {
            id: ENEMY_DIGGERS,
            name: "Diggers",
            color: "green" as const,
            attack: attackValue,
            attackElement: ELEMENT_PHYSICAL,
            armor: 3,
            fame: 2,
            resistances: [],
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
  }

  it("should wound non-resistant unit and absorb armor", () => {
    // Peasants have armor 3, no resistances
    const unit = createPlayerUnit(UNIT_PEASANTS, "peasant_1");
    const player = createTestPlayer({
      units: [unit],
      commandTokens: 1,
    });

    const state = createTestGameState({
      players: [player],
      combat: createDamageCombatState(3),
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

    const state = createTestGameState({
      players: [player],
      combat: createDamageCombatState(3), // Equal to armor
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

    const state = createTestGameState({
      players: [player],
      combat: createDamageCombatState(5), // More than armor (3)
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

    const state = createTestGameState({
      players: [player],
      combat: createDamageCombatState(3),
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

    const state = createTestGameState({
      players: [player],
      combat: createDamageCombatState(3),
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
