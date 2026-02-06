/**
 * Ice Golems Unit Ability Tests
 *
 * Ice Golems have two abilities (rulebook):
 * 1. Attack 3 OR Block 3 (Ice) - choice ability (free)
 * 2. (Blue Mana) Ice Attack 6 - mana-powered attack
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  UNIT_ICE_GOLEMS,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  ICE_GOLEMS,
  MANA_BLUE,
  MANA_SOURCE_CRYSTAL,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Ice Golems Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(ICE_GOLEMS.name).toBe("Ice Golems");
      expect(ICE_GOLEMS.level).toBe(3);
      expect(ICE_GOLEMS.influence).toBe(8);
      expect(ICE_GOLEMS.armor).toBe(4);
    });

    it("should have two abilities", () => {
      expect(ICE_GOLEMS.abilities.length).toBe(2);
    });

    it("should have Attack 3 OR Block 3 as first ability (effect-based choice, no mana)", () => {
      const ability = ICE_GOLEMS.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Attack");
      expect(ability?.displayName).toContain("Block");
    });

    it("should have Ice Attack 6 as second ability (blue mana)", () => {
      const ability = ICE_GOLEMS.abilities[1];
      expect(ability?.type).toBe("attack");
      expect(ability?.value).toBe(6);
      expect(ability?.manaCost).toBe(MANA_BLUE);
    });
  });

  describe("Attack 3 OR Block 3 (Ability 0)", () => {
    it("should present choice between Ice Attack 3 and Ice Block 3", () => {
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
        abilityIndex: 0,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should grant Ice Attack 3 when attack option chosen", () => {
      const unit = createPlayerUnit(UNIT_ICE_GOLEMS, "ice_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_golems_1",
        abilityIndex: 0,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 0 },
      );

      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normalElements.ice,
      ).toBe(3);
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
    });

    it("should grant Ice Block 3 when block option chosen", () => {
      const unit = createPlayerUnit(UNIT_ICE_GOLEMS, "ice_golems_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_golems_1",
        abilityIndex: 0,
      });

      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        { type: RESOLVE_CHOICE_ACTION, choiceIndex: 1 },
      );

      expect(choiceResult.state.players[0].combatAccumulator.block).toBe(3);
      expect(choiceResult.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT,
      );
    });
  });

  describe("(Blue Mana) Ice Attack 6 (Ability 1)", () => {
    it("should grant Ice Attack 6 when blue mana crystal used", () => {
      const unit = createPlayerUnit(UNIT_ICE_GOLEMS, "ice_golems_1");
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
        unitInstanceId: "ice_golems_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_CRYSTAL, color: MANA_BLUE },
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(6);
      expect(
        result.state.players[0].combatAccumulator.attack.normalElements.ice,
      ).toBe(6);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].crystals.blue).toBe(0);
    });
  });
});
