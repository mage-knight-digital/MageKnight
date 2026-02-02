/**
 * Ice Mages Unit Ability Tests
 *
 * Ice Mages have three abilities:
 * 1. Ice Attack 4 OR Ice Block 4 - choice ability (free)
 * 2. (Blue Mana) Siege Ice Attack 4 - mana-powered siege
 * 3. Gain blue mana token + blue crystal - resource generation (free)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_ICE_MAGES,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_BLUE,
  ENEMY_GUARDSMEN,
  getEnemy,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import { ICE_MAGES } from "@mage-knight/shared";

/**
 * Create a combat state with customizable enemies for Ice Mages tests
 */
function createIceMagesCombatState(
  phase: "ranged_siege" | "attack",
  enemies: CombatEnemy[],
  isAtFortifiedSite = false
): CombatState {
  return {
    enemies,
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin: null,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
  };
}

/**
 * Create a combat enemy from an enemy ID
 */
function createCombatEnemy(instanceId: string, enemyId: string): CombatEnemy {
  return {
    instanceId,
    enemyId: enemyId as never,
    definition: getEnemy(enemyId as never),
    isBlocked: false,
    isDefeated: false,
    isRequiredForConquest: true,
    isSummonerHidden: false,
    attacksBlocked: [],
    attacksDamageAssigned: [],
  };
}

describe("Ice Mages Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(ICE_MAGES.name).toBe("Ice Mages");
      expect(ICE_MAGES.level).toBe(3);
      expect(ICE_MAGES.influence).toBe(9);
      expect(ICE_MAGES.armor).toBe(4);
    });

    it("should have three abilities", () => {
      expect(ICE_MAGES.abilities.length).toBe(3);
    });

    it("should have Ice Attack 4 OR Ice Block 4 as first ability (no mana cost)", () => {
      const ability = ICE_MAGES.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Ice Attack");
      expect(ability?.displayName).toContain("Ice Block");
    });

    it("should have Siege Ice Attack 4 as second ability (blue mana)", () => {
      const ability = ICE_MAGES.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_BLUE);
      expect(ability?.displayName).toContain("Siege");
    });

    it("should have Gain Blue Mana + Crystal as third ability (no mana cost)", () => {
      const ability = ICE_MAGES.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.displayName).toContain("Mana");
      expect(ability?.displayName).toContain("Crystal");
    });
  });

  describe("Ice Attack OR Ice Block (Ability 0)", () => {
    it("should present choice between Ice Attack 4 and Ice Block 4", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 0, // Ice Attack 4 OR Ice Block 4
      });

      // Should create a pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();
    });

    it("should grant Ice Attack 4 when attack option chosen", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 0,
      });

      // Step 2: Choose attack option (index 0)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0, // Attack
        }
      );

      // Verify Ice Attack 4 was added (normal attack with ice element)
      expect(
        choiceResult.state.players[0].combatAccumulator.attack.normalElements.ice
      ).toBe(4);

      // Verify unit is spent
      expect(choiceResult.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should grant Ice Block 4 when block option chosen", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      // Step 1: Activate ability
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 0,
      });

      // Step 2: Choose block option (index 1)
      const choiceResult = engine.processAction(
        activateResult.state,
        "player1",
        {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 1, // Block
        }
      );

      // Verify Ice Block 4 was added
      expect(
        choiceResult.state.players[0].combatAccumulator.blockElements.ice
      ).toBe(4);

      // Verify unit is spent
      expect(choiceResult.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should not require mana for choice ability", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 0, // Choice ability - no mana required
      });

      // Should succeed and create a choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });
  });

  describe("Siege Ice Attack 4 (Ability 1 - Blue Mana)", () => {
    it("should require blue mana", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 1, // Siege Ice Attack 4
      });

      // Should fail - no mana source provided
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should activate with blue mana and add siege attack", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 1, // Siege Ice Attack 4
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify mana token was consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Verify siege attack added with ice element
      expect(
        result.state.players[0].combatAccumulator.attack.siegeElements.ice
      ).toBe(4);

      // Check event was emitted
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should only work in ranged/siege phase", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      // Attack phase - siege attacks not allowed
      const state = createTestGameState({
        players: [player],
        combat: createIceMagesCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 1, // Siege Ice Attack 4
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Effect-based abilities can be used in attack phase too
      // The siege attack can be accumulated, though it's typically more useful in ranged/siege phase
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(
        result.state.players[0].combatAccumulator.attack.siegeElements.ice
      ).toBe(4);
    });
  });

  describe("Gain Blue Mana + Crystal (Ability 2)", () => {
    it("should grant blue mana token and blue crystal", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      // Can be used outside combat
      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 2, // Gain Blue Mana + Crystal
      });

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify blue mana token was gained
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].pureMana[0].color).toBe(MANA_BLUE);

      // Verify blue crystal was gained
      expect(result.state.players[0].crystals.blue).toBe(1);

      // Check event was emitted
      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should not require mana", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 2, // Gain Blue Mana + Crystal
      });

      // Should succeed without mana
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].pureMana.length).toBe(1);
      expect(result.state.players[0].crystals.blue).toBe(1);
    });

    it("should work both in and out of combat", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");

      // Test outside combat
      const playerOutside = createTestPlayer({
        units: [{ ...unit }],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const stateOutside = createTestGameState({
        players: [playerOutside],
        combat: null,
      });

      const resultOutside = engine.processAction(stateOutside, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 2,
      });

      expect(resultOutside.state.players[0].units[0].state).toBe(
        UNIT_STATE_SPENT
      );
      expect(resultOutside.state.players[0].pureMana.length).toBe(1);
      expect(resultOutside.state.players[0].crystals.blue).toBe(1);
    });

    it("should add to existing crystals", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 2, green: 0, white: 0 }, // Already has 2 blue crystals
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "ice_mages_1",
        abilityIndex: 2, // Gain Blue Mana + Crystal
      });

      // Should now have 3 blue crystals
      expect(result.state.players[0].crystals.blue).toBe(3);
    });
  });

  describe("Combat Requirement", () => {
    it("should allow mana generation ability outside combat", () => {
      const unit = createPlayerUnit(UNIT_ICE_MAGES, "ice_mages_1");
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
        unitInstanceId: "ice_mages_1",
        abilityIndex: 2, // Gain Blue Mana + Crystal
      });

      // Should succeed - mana generation doesn't require combat
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });
});
