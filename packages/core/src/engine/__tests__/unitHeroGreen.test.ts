/**
 * Hero (Green/Physical) Unit Ability Tests
 *
 * Hero Green has three abilities:
 * 1. Attack OR Block 5 - choice ability (free, shared with all Heroes)
 * 2. Influence 5 (+1 Reputation when used in interaction) - free, non-combat
 * 3. (Green Mana) Heal 4 - mana-powered ability
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_HERO_GREEN,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  MANA_SOURCE_TOKEN,
  MANA_GREEN,
  HERO_GREEN,
  RESIST_PHYSICAL,
  CARD_WOUND,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Hero (Green/Physical) Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(HERO_GREEN.name).toBe("Hero (Green/Physical)");
      expect(HERO_GREEN.level).toBe(3);
      expect(HERO_GREEN.influence).toBe(9);
      expect(HERO_GREEN.armor).toBe(3);
    });

    it("should have Physical resistance", () => {
      expect(HERO_GREEN.resistances).toContain(RESIST_PHYSICAL);
    });

    it("should have three abilities", () => {
      expect(HERO_GREEN.abilities.length).toBe(3);
    });

    it("should have Attack OR Block 5 as first ability (no mana cost)", () => {
      const ability = HERO_GREEN.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Attack");
      expect(ability?.displayName).toContain("Block");
    });

    it("should have Influence 5 (+1 Rep) as second ability (no combat required)", () => {
      const ability = HERO_GREEN.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.requiresCombat).toBe(false);
      expect(ability?.displayName).toContain("Influence");
      expect(ability?.displayName).toContain("Reputation");
    });

    it("should have Heal 4 as third ability (green mana)", () => {
      const ability = HERO_GREEN.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_GREEN);
      expect(ability?.displayName).toContain("Heal");
    });
  });

  describe("Attack OR Block 5 (Ability 0)", () => {
    it("should present choice between Attack 5 and Block 5", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
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
        unitInstanceId: "hero_green_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choice = result.state.players[0].pendingChoice!;
      expect(choice.options.length).toBe(2);
    });

    it("should grant Attack 5 when attack chosen", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
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
        unitInstanceId: "hero_green_1",
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
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
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
        unitInstanceId: "hero_green_1",
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
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
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
        unitInstanceId: "hero_green_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].influencePoints).toBe(5);
      expect(result.state.players[0].reputation).toBe(1);
    });

    it("should work outside combat", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
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
        unitInstanceId: "hero_green_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].influencePoints).toBe(5);
      expect(result.state.players[0].reputation).toBe(3);
    });
  });

  describe("Heal 4 (Ability 2 - Green Mana)", () => {
    it("should require green mana", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_green_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should activate with green mana and heal wounds from hand", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_green_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(0);
      // Heal 4 removes up to 4 wounds from hand; we had 3, so all 3 healed
      expect(result.state.players[0].hand.filter((c) => c === CARD_WOUND).length).toBe(0);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should heal up to 4 wounds when more are available", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_green_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Had 5 wounds, healed 4, should have 1 remaining
      expect(result.state.players[0].hand.filter((c) => c === CARD_WOUND).length).toBe(1);
    });

    it("should work outside combat (non-combat ability)", () => {
      const unit = createPlayerUnit(UNIT_HERO_GREEN, "hero_green_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
        hand: [CARD_WOUND, CARD_WOUND],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "hero_green_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].hand.filter((c) => c === CARD_WOUND).length).toBe(0);
    });
  });
});
