/**
 * Illusionists Unit Ability Tests
 *
 * Illusionists have three abilities:
 * 1. Influence 4 (free)
 * 2. (White Mana) Cancel unfortified enemy's attack this combat
 * 3. Gain white crystal (free, no combat required)
 *
 * Key rules:
 * - Cancel Attack only targets unfortified enemies
 * - Arcane Immunity blocks the cancel attack effect
 * - Works against all attack types including Summon
 * - Cancels ALL attacks from Multi-Attack enemies
 * - Can combo with Demolish (remove fortification first, then cancel)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
} from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_ILLUSIONISTS,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_WHITE,
  ENEMY_GUARDSMEN,
  ENEMY_GOLEMS,
  ENEMY_ORC_SKIRMISHERS,
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
import { doesEnemyAttackThisCombat, addModifier } from "../modifiers/index.js";
import {
  EFFECT_ABILITY_NULLIFIER,
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { ILLUSIONISTS } from "@mage-knight/shared";

/**
 * Create a combat state for Illusionists tests
 */
function createIllusionistsCombatState(
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

describe("Illusionists Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(ILLUSIONISTS.name).toBe("Illusionists");
      expect(ILLUSIONISTS.level).toBe(2);
      expect(ILLUSIONISTS.influence).toBe(7);
      expect(ILLUSIONISTS.armor).toBe(2);
    });

    it("should have three abilities", () => {
      expect(ILLUSIONISTS.abilities.length).toBe(3);
    });

    it("should have Influence 4 as first ability (free)", () => {
      const ability = ILLUSIONISTS.abilities[0];
      expect(ability?.type).toBe("influence");
      expect(ability?.value).toBe(4);
      expect(ability?.manaCost).toBeUndefined();
    });

    it("should have Cancel Enemy Attack as second ability (white mana)", () => {
      const ability = ILLUSIONISTS.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_WHITE);
      expect(ability?.displayName).toContain("Cancel");
    });

    it("should have Gain White Crystal as third ability (free, no combat required)", () => {
      const ability = ILLUSIONISTS.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBeUndefined();
      expect(ability?.requiresCombat).toBe(false);
      expect(ability?.displayName).toContain("Crystal");
    });
  });

  describe("Influence 4 Ability (Ability 0)", () => {
    it("should add influence points when activated outside combat", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 0, // Influence 4
      });

      expect(result.state.players[0].influencePoints).toBe(4);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should not require mana for influence ability", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].influencePoints).toBe(4);
    });
  });

  describe("Cancel Enemy Attack (Ability 1 - White Mana)", () => {
    it("should require white mana", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [], // No mana
      });

      // Golems are unfortified, no arcane immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
      });

      // Should fail - no mana source provided
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should cancel unfortified enemy attack with white mana", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Golems are unfortified, no arcane immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Unit should be spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Mana token consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Enemy should not attack this combat
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
    });

    it("should not allow targeting fortified enemies", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Guardsmen have ABILITY_FORTIFIED - should be excluded from targeting
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Enemy should still attack (not targetable)
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(true);
    });

    it("should not allow targeting Arcane Immune enemies", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Enemy Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Enemy should still attack (not targetable)
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(true);
    });

    it("should cancel ALL attacks from Multi-Attack enemies", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Orc Skirmishers have 2 attacks (multi-attack, unfortified, no arcane immunity)
      const enemies = [createCombatEnemy("enemy_0", ENEMY_ORC_SKIRMISHERS)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Verify enemy has multiple attacks
      const enemyDef = getEnemy(ENEMY_ORC_SKIRMISHERS);
      expect(enemyDef.attacks!.length).toBeGreaterThan(1);

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Enemy should not attack at all (all attacks cancelled)
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
    });

    it("should allow targeting with enemy selection when multiple valid targets", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Two unfortified enemies (Golems have no fortification or arcane immunity)
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_ORC_SKIRMISHERS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Activate - should create a pending choice
      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = activateResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Resolve choice - select enemy_1
      const choiceResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Only selected enemy should have attack cancelled
      expect(doesEnemyAttackThisCombat(choiceResult.state, "enemy_0")).toBe(true);
      expect(doesEnemyAttackThisCombat(choiceResult.state, "enemy_1")).toBe(false);
    });

    it("should only show unfortified enemies in choice when mixed fortified/unfortified", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Mix: one fortified (Guardsmen), one unfortified (Golems)
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GUARDSMEN), // Fortified
        createCombatEnemy("enemy_1", ENEMY_GOLEMS),     // Unfortified
      ];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Should auto-resolve targeting the only valid target (Golems)
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Fortified enemy still attacks
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(true);

      // Unfortified enemy attack cancelled
      expect(doesEnemyAttackThisCombat(result.state, "enemy_1")).toBe(false);
    });

    it("should reject when not in combat", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should work with Demolish combo (fortification removed first)", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Create a fortified enemy (Guardsmen have ABILITY_FORTIFIED)
      const guardsmen = createCombatEnemy("enemy_0", ENEMY_GUARDSMEN);
      expect(guardsmen.definition.abilities.includes(ABILITY_FORTIFIED)).toBe(true);

      const enemies = [guardsmen];
      const combat = createIllusionistsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies);

      const state = createTestGameState({
        players: [player],
        combat,
      });

      // Apply a fortification nullifier modifier (simulating Demolish/Sorcerers was used)
      const stateWithNullifier = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: "demolish" as never, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_FORTIFIED },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      });

      // Now activate Illusionists cancel attack on the de-fortified enemy
      const result = engine.processAction(stateWithNullifier, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Enemy should not attack (fortification was removed, so Illusionists can target them)
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should work in attack phase", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createIllusionistsCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("Gain White Crystal (Ability 2)", () => {
    it("should gain a white crystal when activated", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 2, // Gain White Crystal
      });

      expect(result.state.players[0].crystals.white).toBe(1);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should not require mana", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 2,
      });

      expect(result.state.players[0].crystals.white).toBe(1);
    });

    it("should work outside combat (requiresCombat: false)", () => {
      const unit = createPlayerUnit(UNIT_ILLUSIONISTS, "illusionists_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "illusionists_1",
        abilityIndex: 2,
      });

      // Should succeed outside combat
      expect(result.state.players[0].crystals.white).toBe(1);
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });
  });
});
