/**
 * Unit Elemental Attack Tracking tests
 *
 * Tests for tracking fire, ice, and physical damage
 * from unit attacks in the combat accumulator.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  UNIT_THUGS,
  UNIT_RED_CAPE_MONKS,
  UNIT_FIRE_MAGES,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  UNIT_ACTIVATED,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  MANA_RED,
  MANA_SOURCE_TOKEN,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Unit Elemental Attack Tracking", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  it("should track fire attack separately from physical", () => {
    // Red Cape Monks have Fire Attack 4 at index 2 (requires red mana)
    const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
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
      unitInstanceId: "monks_1",
      abilityIndex: 2, // Fire Attack 4 (requires red mana)
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
    });

    // Verify fire element tracked separately
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.fire
    ).toBe(4);
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.physical
    ).toBe(0);
    // Total normal attack should still include fire
    expect(result.state.players[0].combatAccumulator.attack.normal).toBe(4);

    // Verify unit is now spent
    expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

    // Check event includes element info
    const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
    expect(activateEvent).toBeDefined();
    if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
      expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_ATTACK);
      expect(activateEvent.abilityValue).toBe(4);
      expect(activateEvent.element).toBe(ELEMENT_FIRE);
    }
  });

  it("should track fire block separately from physical", () => {
    // Red Cape Monks have Fire Block 4 at index 3 (requires red mana)
    const unit = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
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
      unitInstanceId: "monks_1",
      abilityIndex: 3, // Fire Block 4 (requires red mana)
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
    });

    // Verify fire element tracked separately
    expect(result.state.players[0].combatAccumulator.blockElements.fire).toBe(
      4
    );
    expect(
      result.state.players[0].combatAccumulator.blockElements.physical
    ).toBe(0);
    // Total block should include fire
    expect(result.state.players[0].combatAccumulator.block).toBe(4);

    // Verify unit is now spent
    expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

    // Check event includes element info
    const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
    expect(activateEvent).toBeDefined();
    if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
      expect(activateEvent.abilityUsed).toBe(UNIT_ABILITY_BLOCK);
      expect(activateEvent.abilityValue).toBe(4);
      expect(activateEvent.element).toBe(ELEMENT_FIRE);
    }
  });

  it("should track fire ranged attack in ranged phase", () => {
    // Fire Mages have Fire Ranged Attack 4 at index 1
    const unit = createPlayerUnit(UNIT_FIRE_MAGES, "fire_mages_1");
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
      unitInstanceId: "fire_mages_1",
      abilityIndex: 1, // Fire Ranged Attack 4
    });

    // Verify fire ranged tracked separately
    expect(
      result.state.players[0].combatAccumulator.attack.rangedElements.fire
    ).toBe(4);
    expect(
      result.state.players[0].combatAccumulator.attack.rangedElements.physical
    ).toBe(0);
    // Total ranged attack should include fire
    expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(4);
  });

  it("should track physical attack as physical element", () => {
    // Thugs have Physical Attack 3 at index 0
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
      abilityIndex: 0, // Physical Attack 3
    });

    // Verify physical element tracked
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.physical
    ).toBe(3);
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.fire
    ).toBe(0);
    expect(result.state.players[0].combatAccumulator.attack.normal).toBe(3);

    // Check event includes physical element
    const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
    expect(activateEvent).toBeDefined();
    if (activateEvent && activateEvent.type === UNIT_ACTIVATED) {
      expect(activateEvent.element).toBe(ELEMENT_PHYSICAL);
    }
  });

  it("should accumulate multiple elemental attacks", () => {
    // Red Cape Monks: Fire Attack 4 (index 2, red mana), Thugs: Physical Attack 3
    const monks = createPlayerUnit(UNIT_RED_CAPE_MONKS, "monks_1");
    const thugs = createPlayerUnit(UNIT_THUGS, "thugs_1");
    const player = createTestPlayer({
      units: [monks, thugs],
      commandTokens: 2,
      pureMana: [{ color: MANA_RED, source: "card" }],
    });

    let state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
    });

    // Activate monks (Fire Attack 4 with red mana)
    let result = engine.processAction(state, "player1", {
      type: ACTIVATE_UNIT_ACTION,
      unitInstanceId: "monks_1",
      abilityIndex: 2, // Fire Attack 4 (requires red mana)
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
    });
    state = result.state;

    // Activate thugs (Physical Attack 3)
    result = engine.processAction(state, "player1", {
      type: ACTIVATE_UNIT_ACTION,
      unitInstanceId: "thugs_1",
      abilityIndex: 0,
    });

    // Verify both tracked separately
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.fire
    ).toBe(4);
    expect(
      result.state.players[0].combatAccumulator.attack.normalElements.physical
    ).toBe(3);
    // Total should be combined
    expect(result.state.players[0].combatAccumulator.attack.normal).toBe(7);
  });
});
