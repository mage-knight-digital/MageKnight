/**
 * Sorcerers Unit Ability Tests
 *
 * Sorcerers have three abilities:
 * 1. Basic Ranged Attack 3 (no mana cost)
 * 2. (White Mana) Strip fortifications from one enemy + Ranged Attack 3
 * 3. (Green Mana) Strip resistances from one enemy + Ranged Attack 3
 *
 * FAQ Notes:
 * - Arcane Immunity blocks fortification/resistance removal, but ranged attack still works
 * - Bundled ranged attack must be used in same phase or forfeited
 * - Can target different enemies for debuff vs attack (compound effect)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
} from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_SORCERERS,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_WHITE,
  MANA_GREEN,
  ENEMY_GUARDSMEN,
  ENEMY_GOLEMS,
  ENEMY_SORCERERS,
  ABILITY_FORTIFIED,
  getEnemy,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import {
  isAbilityNullified,
  areResistancesRemoved,
} from "../modifiers/index.js";
import { SORCERERS } from "@mage-knight/shared";

/**
 * Create a combat state with customizable enemies for Sorcerers tests
 */
function createSorcerersCombatState(
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
    pendingSwiftBlock: {},
    combatContext: COMBAT_CONTEXT_STANDARD,
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
    paidHeroesAssaultInfluence: false,
    vampiricArmorBonus: {},
    damageRedirects: {},
  };
}

/**
 * Create a combat enemy from an enemy ID
 */
function createCombatEnemy(
  instanceId: string,
  enemyId: string
): CombatEnemy {
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

describe("Sorcerers Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(SORCERERS.name).toBe("Sorcerers");
      expect(SORCERERS.level).toBe(3);
      expect(SORCERERS.influence).toBe(9);
      expect(SORCERERS.armor).toBe(4);
    });

    it("should have three abilities", () => {
      expect(SORCERERS.abilities.length).toBe(3);
    });

    it("should have basic Ranged Attack 3 as first ability (no mana cost)", () => {
      const ability = SORCERERS.abilities[0];
      expect(ability?.type).toBe("ranged_attack");
      expect(ability?.value).toBe(3);
      expect(ability?.manaCost).toBeUndefined();
    });

    it("should have Strip Fortification + Ranged Attack 3 as second ability (white mana)", () => {
      const ability = SORCERERS.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_WHITE);
      expect(ability?.displayName).toContain("Fortification");
    });

    it("should have Strip Resistances + Ranged Attack 3 as third ability (green mana)", () => {
      const ability = SORCERERS.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_GREEN);
      expect(ability?.displayName).toContain("Resistances");
    });
  });

  describe("Basic Ranged Attack (Ability 0)", () => {
    it("should activate basic ranged attack and add to accumulator", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 0, // Basic Ranged Attack 3
      });

      // Verify ranged attack added to accumulator
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Verify unit is now spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Check event was emitted
      const activateEvent = result.events.find(
        (e) => e.type === UNIT_ACTIVATED
      );
      expect(activateEvent).toBeDefined();
    });

    it("should allow basic ranged attack in attack phase", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 0, // Basic Ranged Attack 3
      });

      // Verify success
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should not require mana for basic ability", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana available
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 0, // Basic Ranged Attack 3
      });

      // Should succeed without mana
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);
    });
  });

  describe("Strip Fortification Effect (Ability 1 - White Mana)", () => {
    it("should require white mana", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 1, // Strip Fortification + Ranged Attack 3
      });

      // Should fail - no mana source provided
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should activate with white mana token and add ranged attack", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Create a fortified enemy (Guardsmen have ABILITY_FORTIFIED)
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 1, // Strip Fortification + Ranged Attack 3
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify mana token was consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Verify ranged attack added (3 from the effect)
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Verify fortification is nullified on enemy
      expect(isAbilityNullified(result.state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(true);
    });

    it("should strip fortification modifier from targeted enemy", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Create two enemies, both fortified
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN),
        createCombatEnemy("enemy_1", ENEMY_GUARDSMEN),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Step 1: Activate ability - this creates a pending choice for enemy selection
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // With multiple enemies, a choice should be required
      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = activateResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Step 2: Resolve choice by selecting enemy_0
      const choiceResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Select first enemy
      });

      // First enemy should have fortification nullified
      expect(isAbilityNullified(choiceResult.state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(true);

      // Second enemy should still be fortified (only one enemy targeted)
      expect(isAbilityNullified(choiceResult.state, "player1", "enemy_1", ABILITY_FORTIFIED)).toBe(false);

      // Ranged attack should have been added
      expect(choiceResult.state.players[0].combatAccumulator.attack.ranged).toBe(3);
    });
  });

  describe("Strip Resistances Effect (Ability 2 - Green Mana)", () => {
    it("should require green mana", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 2, // Strip Resistances + Ranged Attack 3
      });

      // Should fail - no mana source provided
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should activate with green mana token and add ranged attack", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Create an enemy with resistances (Golems have physical/ice resistance)
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 2, // Strip Resistances + Ranged Attack 3
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Verify unit is spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Verify mana token was consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Verify ranged attack added
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Verify resistances are removed on enemy
      expect(areResistancesRemoved(result.state, "enemy_0")).toBe(true);
    });

    it("should strip resistances only from targeted enemy", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Create two enemies with resistances
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_GOLEMS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Step 1: Activate ability - this creates a pending choice for enemy selection
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // With multiple enemies, a choice should be required
      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = activateResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Step 2: Resolve choice by selecting enemy_0
      const choiceResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Select first enemy
      });

      // First enemy should have resistances removed
      expect(areResistancesRemoved(choiceResult.state, "enemy_0")).toBe(true);

      // Second enemy should still have resistances
      expect(areResistancesRemoved(choiceResult.state, "enemy_1")).toBe(false);

      // Ranged attack should have been added
      expect(choiceResult.state.players[0].combatAccumulator.attack.ranged).toBe(3);
    });
  });

  describe("Arcane Immunity Interaction", () => {
    it("should not strip fortification from Arcane Immune enemy but still add ranged attack", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Enemy Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 1, // Strip Fortification + Ranged Attack 3
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Unit should be spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Ranged attack should still be added (per FAQ)
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Fortification should NOT be nullified (Arcane Immunity blocks it)
      expect(isAbilityNullified(result.state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(false);
    });

    it("should not strip resistances from Arcane Immune enemy but still add ranged attack", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Enemy Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createSorcerersCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 2, // Strip Resistances + Ranged Attack 3
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Unit should be spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Ranged attack should still be added (per FAQ)
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(3);

      // Resistances should NOT be removed (Arcane Immunity blocks it)
      expect(areResistancesRemoved(result.state, "enemy_0")).toBe(false);
    });
  });

  describe("Combat Requirement", () => {
    it("should reject effect abilities when not in combat", () => {
      const unit = createPlayerUnit(UNIT_SORCERERS, "sorcerers_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // No combat state
      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "sorcerers_1",
        abilityIndex: 1, // Strip Fortification + Ranged Attack 3
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Unit should still be ready (action rejected)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);

      // Check for invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });
});
