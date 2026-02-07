/**
 * Hero (White) Unit Ability Tests
 *
 * Hero White has three abilities:
 * 1. Attack OR Block 5 - choice ability (free, shared with all Heroes)
 * 2. Influence 5 (+1 Reputation when used in interaction) - free, non-combat
 * 3. (White Mana) Ranged Attack 7 - mana-powered ability
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_HERO_WHITE,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  MANA_SOURCE_TOKEN,
  MANA_WHITE,
  HERO_WHITE,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Hero (White) Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(HERO_WHITE.name).toBe("Hero (White)");
      expect(HERO_WHITE.level).toBe(3);
      expect(HERO_WHITE.influence).toBe(9);
      expect(HERO_WHITE.armor).toBe(6);
    });

    it("should have no resistances", () => {
      expect(HERO_WHITE.resistances).toEqual([]);
    });

    it("should have three abilities", () => {
      expect(HERO_WHITE.abilities.length).toBe(3);
    });

    it("should have Attack OR Block 5 as first ability (no mana cost)", () => {
      const ability = HERO_WHITE.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Attack");
      expect(ability?.displayName).toContain("Block");
    });

    it("should have Influence 5 (+1 Rep) as second ability (no combat required)", () => {
      const ability = HERO_WHITE.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.requiresCombat).toBe(false);
      expect(ability?.displayName).toContain("Influence");
      expect(ability?.displayName).toContain("Reputation");
    });

    it("should have Ranged Attack 7 as third ability (white mana)", () => {
      const ability = HERO_WHITE.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_WHITE);
      expect(ability?.displayName).toContain("Ranged Attack");
    });
  });

  describe("Attack OR Block 5 (Ability 0)", () => {
    it("should present choice between Attack 5 and Block 5", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
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
        unitInstanceId: "hero_white_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choice = result.state.players[0].pendingChoice!;
      expect(choice.options.length).toBe(2);
    });

    it("should grant Attack 5 when attack chosen", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 0,
      });
      expect(afterActivate.state.players[0].pendingChoice).not.toBeNull();

      const afterChoice = engine.processAction(afterActivate.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Attack 5
      });

      expect(afterChoice.state.players[0].combatAccumulator.attack.normal).toBe(5);
      expect(afterChoice.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should grant Block 5 when block chosen", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const afterActivate = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 0,
      });
      expect(afterActivate.state.players[0].pendingChoice).not.toBeNull();

      const afterChoice = engine.processAction(afterActivate.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Block 5
      });

      expect(afterChoice.state.players[0].combatAccumulator.block).toBe(5);
      expect(afterChoice.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Influence 5 (+1 Reputation) (Ability 1)", () => {
    it("should grant Influence 5 and +1 Reputation", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        influencePoints: 0,
        reputation: 0,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].influencePoints).toBe(5);
      expect(result.state.players[0].reputation).toBe(1);
    });

    it("should work outside combat", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        influencePoints: 0,
        reputation: 2,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].influencePoints).toBe(5);
      expect(result.state.players[0].reputation).toBe(3);
    });
  });

  describe("Ranged Attack 7 (Ability 2 - White Mana)", () => {
    it("should require white mana", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
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
        unitInstanceId: "hero_white_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should grant Ranged Attack 7 with white mana", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(0);
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(7);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should work in attack phase as well", () => {
      const unit = createPlayerUnit(UNIT_HERO_WHITE, "hero_white_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: createUnitCombatState(COMBAT_PHASE_ATTACK),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_white_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(7);
    });
  });
});
