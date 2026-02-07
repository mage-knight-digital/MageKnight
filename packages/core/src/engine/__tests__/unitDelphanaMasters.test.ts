/**
 * Delphana Masters Unit Ability Tests
 *
 * Delphana Masters have four abilities (each costs a different mana color):
 * 1. (Blue Mana) Cancel Attack - target enemy does not attack this combat
 * 2. (Red Mana) Destroy if Blocked - target enemy destroyed if fully blocked
 * 3. (Green Mana) Armor -5 - target enemy armor reduced by 5 (min 1)
 * 4. (White Mana) Strip Defenses - remove target's fortification + resistances
 *
 * Key rules:
 * - Multi-ability: can use multiple different abilities per turn, each once
 * - Cancel Attack blocked by Ice Resistance and Arcane Immunity
 * - Destroy if Blocked blocked by Fire Resistance and Arcane Immunity
 * - Armor -5 blocked by Arcane Immunity
 * - Strip Defenses blocked by Arcane Immunity
 * - Interaction-only: cannot be free-recruited (Banner of Command, Call to Glory)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
} from "./testHelpers.js";
import {
  INVALID_ACTION,
  UNIT_DELPHANA_MASTERS,
  UNIT_STATE_READY,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  MANA_SOURCE_TOKEN,
  MANA_BLUE,
  MANA_RED,
  MANA_GREEN,
  MANA_WHITE,
  ENEMY_GUARDSMEN,
  ENEMY_GOLEMS,
  ENEMY_ORC_SKIRMISHERS,
  ENEMY_SORCERERS,
  ENEMY_FREEZERS,
  ENEMY_GUNNERS,
  ABILITY_FORTIFIED,
  getEnemy,
} from "@mage-knight/shared";
import { DELPHANA_MASTERS } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import {
  doesEnemyAttackThisCombat,
  getEffectiveEnemyArmor,
  isAbilityNullified,
  areResistancesRemoved,
  hasDefeatIfBlocked,
} from "../modifiers/index.js";
import { handleBlockToAssignDamage } from "../commands/combat/phaseTransitions.js";

/**
 * Create a combat state for Delphana Masters tests
 */
function createCombatState(
  phase: "ranged_siege" | "block" | "attack",
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

describe("Delphana Masters Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  // ==========================================================================
  // Unit Definition
  // ==========================================================================

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(DELPHANA_MASTERS.name).toBe("Delphana Masters");
      expect(DELPHANA_MASTERS.level).toBe(4);
      expect(DELPHANA_MASTERS.influence).toBe(13);
      expect(DELPHANA_MASTERS.armor).toBe(3);
    });

    it("should have four abilities", () => {
      expect(DELPHANA_MASTERS.abilities.length).toBe(4);
    });

    it("should have Cancel Attack as first ability (blue mana)", () => {
      const ability = DELPHANA_MASTERS.abilities[0];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_BLUE);
      expect(ability?.displayName).toBe("Cancel Attack");
    });

    it("should have Destroy if Blocked as second ability (red mana)", () => {
      const ability = DELPHANA_MASTERS.abilities[1];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_RED);
      expect(ability?.displayName).toBe("Destroy if Blocked");
    });

    it("should have Armor -5 as third ability (green mana)", () => {
      const ability = DELPHANA_MASTERS.abilities[2];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_GREEN);
      expect(ability?.displayName).toBe("Armor -5");
    });

    it("should have Strip Defenses as fourth ability (white mana)", () => {
      const ability = DELPHANA_MASTERS.abilities[3];
      expect(ability?.type).toBe("effect");
      expect(ability?.manaCost).toBe(MANA_WHITE);
      expect(ability?.displayName).toBe("Strip Defenses");
    });

    it("should be marked as interactionOnly", () => {
      expect(DELPHANA_MASTERS.interactionOnly).toBe(true);
    });

    it("should be marked as multiAbility", () => {
      expect(DELPHANA_MASTERS.multiAbility).toBe(true);
    });
  });

  // ==========================================================================
  // Multi-Ability Activation
  // ==========================================================================

  describe("Multi-Ability Activation", () => {
    it("should allow using multiple different abilities in the same turn", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [
          { color: MANA_BLUE, source: "card" },
          { color: MANA_RED, source: "card" },
        ],
      });

      // Two unfortified, non-immune enemies
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_ORC_SKIRMISHERS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Use ability 0 (Cancel Attack) with blue mana - targets enemy_0
      const result1 = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // If there was a choice (2 valid targets), resolve it
      let stateAfterFirst = result1.state;
      if (stateAfterFirst.players[0].pendingChoice) {
        const choiceResult = engine.processAction(stateAfterFirst, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });
        stateAfterFirst = choiceResult.state;
      }

      // Unit should still be READY (multi-ability stays ready)
      expect(stateAfterFirst.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // But ability 0 should be tracked as used
      expect(stateAfterFirst.players[0].units[0].usedAbilityIndices).toContain(0);

      // Now use ability 1 (Destroy if Blocked) with red mana
      const result2 = engine.processAction(stateAfterFirst, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      let stateAfterSecond = result2.state;
      if (stateAfterSecond.players[0].pendingChoice) {
        const choiceResult = engine.processAction(stateAfterSecond, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });
        stateAfterSecond = choiceResult.state;
      }

      // Both abilities should be tracked as used
      expect(stateAfterSecond.players[0].units[0].usedAbilityIndices).toContain(0);
      expect(stateAfterSecond.players[0].units[0].usedAbilityIndices).toContain(1);
      // Unit should still be READY
      expect(stateAfterSecond.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should not allow using the same ability twice in one turn", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [
          { color: MANA_BLUE, source: "card" },
          { color: MANA_BLUE, source: "card" },
        ],
      });

      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_ORC_SKIRMISHERS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Use ability 0 (Cancel Attack)
      const result1 = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      let stateAfterFirst = result1.state;
      if (stateAfterFirst.players[0].pendingChoice) {
        const choiceResult = engine.processAction(stateAfterFirst, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        });
        stateAfterFirst = choiceResult.state;
      }

      // Try to use ability 0 again — should fail
      const result2 = engine.processAction(stateAfterFirst, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      const invalidEvent = result2.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // Cancel Attack (Ability 0 - Blue Mana)
  // ==========================================================================

  describe("Cancel Attack (Ability 0 - Blue Mana)", () => {
    it("should cancel enemy attack with blue mana", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Mana token consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Enemy should not attack
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
    });

    it("should require blue mana", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should not target Ice Resistant enemies", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      // Gunners have Ice Resistance
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUNNERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Enemy should still attack (ice resistant, so not targetable)
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(true);
    });

    it("should not target Arcane Immune enemies", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      // Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Enemy should still attack
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(true);
    });

    it("should cancel ALL attacks from multi-attack enemies", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      // Orc Skirmishers have 2 attacks
      const enemies = [createCombatEnemy("enemy_0", ENEMY_ORC_SKIRMISHERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const enemyDef = getEnemy(ENEMY_ORC_SKIRMISHERS);
      expect(enemyDef.attacks!.length).toBeGreaterThan(1);

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
    });
  });

  // ==========================================================================
  // Destroy if Blocked (Ability 1 - Red Mana)
  // ==========================================================================

  describe("Destroy if Blocked (Ability 1 - Red Mana)", () => {
    it("should apply defeat-if-blocked modifier to target enemy", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Mana consumed
      expect(result.state.players[0].pureMana.length).toBe(0);

      // Modifier should be applied
      expect(hasDefeatIfBlocked(result.state, "enemy_0")).toBe(true);
    });

    it("should defeat blocked enemy during block-to-assign-damage transition", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Apply the ability
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Simulate the enemy being blocked in block phase
      const combat = result.state.combat!;
      const blockedCombat: CombatState = {
        ...combat,
        phase: COMBAT_PHASE_BLOCK,
        enemies: combat.enemies.map((e) => ({ ...e, isBlocked: true })),
      };

      // Transition from Block to Assign Damage — should defeat the enemy
      const transitionResult = handleBlockToAssignDamage(
        { ...result.state, combat: blockedCombat },
        blockedCombat,
        "player1"
      );

      // Enemy should be defeated
      const enemy = transitionResult.combat.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(true);

      // Fame should be awarded
      const golemsFame = getEnemy(ENEMY_GOLEMS).fame;
      expect(transitionResult.combat.fameGained).toBe(golemsFame);
    });

    it("should NOT defeat unblocked enemy", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Apply the ability
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Enemy is NOT blocked
      const combat = result.state.combat!;
      const unblockedCombat: CombatState = {
        ...combat,
        phase: COMBAT_PHASE_BLOCK,
        enemies: combat.enemies.map((e) => ({ ...e, isBlocked: false })),
      };

      const transitionResult = handleBlockToAssignDamage(
        { ...result.state, combat: unblockedCombat },
        unblockedCombat,
        "player1"
      );

      const enemy = transitionResult.combat.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(false);
    });

    it("should not target Fire Resistant enemies", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Freezers have Fire Resistance
      const enemies = [createCombatEnemy("enemy_0", ENEMY_FREEZERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      // Modifier should NOT be applied (fire resistant)
      expect(hasDefeatIfBlocked(result.state, "enemy_0")).toBe(false);
    });

    it("should not target Arcane Immune enemies", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_RED, source: "card" }],
      });

      // Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_RED },
      });

      expect(hasDefeatIfBlocked(result.state, "enemy_0")).toBe(false);
    });

    it("should require red mana", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 1,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // Armor -5 (Ability 2 - Green Mana)
  // ==========================================================================

  describe("Armor -5 (Ability 2 - Green Mana)", () => {
    it("should reduce target enemy armor by 5 (minimum 1)", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Golems have armor 3, so -5 should bring to minimum 1
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      const golemDef = getEnemy(ENEMY_GOLEMS);
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        golemDef.armor,
        golemDef.resistances?.length ?? 0,
        "player1"
      );

      // Armor 3 - 5 = -2, clamped to minimum 1
      expect(effectiveArmor).toBe(1);
    });

    it("should reduce high-armor enemy by exactly 5", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Guardsmen have armor 7
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      const guardsDef = getEnemy(ENEMY_GUARDSMEN);
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        guardsDef.armor,
        guardsDef.resistances?.length ?? 0,
        "player1"
      );

      // Armor 7 - 5 = 2
      expect(effectiveArmor).toBe(2);
    });

    it("should be blocked by Arcane Immunity", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      // Arcane Immunity blocks the modifier — armor should be unchanged
      const sorcererDef = getEnemy(ENEMY_SORCERERS);
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        sorcererDef.armor,
        sorcererDef.resistances?.length ?? 0,
        "player1"
      );

      expect(effectiveArmor).toBe(sorcererDef.armor);
    });

    it("should require green mana", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // Strip Defenses (Ability 3 - White Mana)
  // ==========================================================================

  describe("Strip Defenses (Ability 3 - White Mana)", () => {
    it("should remove fortification from target enemy", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Guardsmen have ABILITY_FORTIFIED
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 3,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Fortification should be nullified
      expect(isAbilityNullified(result.state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(true);
    });

    it("should remove all resistances from target enemy", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Guardsmen have Physical, Fire, and Ice resistances
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 3,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Resistances should be removed
      expect(areResistancesRemoved(result.state, "enemy_0")).toBe(true);
    });

    it("should be blocked by Arcane Immunity", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_WHITE, source: "card" }],
      });

      // Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 3,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      // Resistances should NOT be removed (Arcane Immunity blocks it)
      expect(areResistancesRemoved(result.state, "enemy_0")).toBe(false);
    });

    it("should require white mana", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 3,
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // Enemy Selection (multiple targets)
  // ==========================================================================

  describe("Enemy Selection", () => {
    it("should auto-resolve when only one valid target", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      // One Golem (targetable) + one Sorcerer (Arcane Immune, not targetable)
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_SORCERERS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should auto-resolve to the only valid target
      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
      expect(doesEnemyAttackThisCombat(result.state, "enemy_1")).toBe(true);
    });

    it("should present choice when multiple valid targets", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      // Two targetable enemies (neither has Arcane Immunity)
      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_ORC_SKIRMISHERS),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = result.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Resolve choice — select enemy_1
      const choiceResult = engine.processAction(result.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      const skirmisherDef = getEnemy(ENEMY_ORC_SKIRMISHERS);
      const effectiveArmor = getEffectiveEnemyArmor(
        choiceResult.state,
        "enemy_1",
        skirmisherDef.armor,
        skirmisherDef.resistances?.length ?? 0,
        "player1"
      );

      // Armor reduced by 5 (min 1)
      expect(effectiveArmor).toBe(Math.max(1, skirmisherDef.armor - 5));
    });
  });

  // ==========================================================================
  // Interaction-Only Recruitment
  // ==========================================================================

  describe("Interaction-Only Recruitment", () => {
    it("should be filtered from free recruitment offers", () => {
      const player = createTestPlayer({
        units: [],
        commandTokens: 2,
      });

      const state = createTestGameState({
        players: [player],
        offers: {
          units: [UNIT_DELPHANA_MASTERS as never],
          advancedActions: [],
          spells: [],
          artifacts: [],
        },
      });

      // Import the handler directly
      const { handleFreeRecruit } = require("../effects/freeRecruitEffects.js");
      const result = handleFreeRecruit(state, 0, state.players[0]);

      // Should report no units available (Delphana Masters filtered out)
      expect(result.description).toBe("No units available in the offer");
    });
  });

  // ==========================================================================
  // Combat Phase Restrictions
  // ==========================================================================

  describe("Combat Phase Restrictions", () => {
    it("should work in ranged/siege phase", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      expect(doesEnemyAttackThisCombat(result.state, "enemy_0")).toBe(false);
    });

    it("should work in attack phase", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_GREEN, source: "card" }],
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      const golemDef = getEnemy(ENEMY_GOLEMS);
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        golemDef.armor,
        golemDef.resistances?.length ?? 0,
        "player1"
      );

      expect(effectiveArmor).toBe(1);
    });

    it("should not work outside combat", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [{ color: MANA_BLUE, source: "card" }],
      });

      const state = createTestGameState({
        players: [player],
        combat: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 0,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });
  });

  // ==========================================================================
  // Combo: Strip Defenses then Cancel Attack
  // ==========================================================================

  describe("Combos", () => {
    it("should allow Strip Defenses + Cancel Attack combo on fortified enemy", () => {
      const unit = createPlayerUnit(UNIT_DELPHANA_MASTERS, "dm_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
        pureMana: [
          { color: MANA_WHITE, source: "card" },
          { color: MANA_GREEN, source: "card" },
        ],
      });

      // Guardsmen: Fortified + Physical/Fire/Ice resistances + armor 7
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // First: Strip Defenses (ability 3, white mana) - removes fortification + resistances
      const result1 = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 3,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
      });

      expect(isAbilityNullified(result1.state, "player1", "enemy_0", ABILITY_FORTIFIED)).toBe(true);
      expect(areResistancesRemoved(result1.state, "enemy_0")).toBe(true);

      // Second: Armor -5 (ability 2, green mana)
      const result2 = engine.processAction(result1.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "dm_1",
        abilityIndex: 2,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_GREEN },
      });

      const guardsDef = getEnemy(ENEMY_GUARDSMEN);
      const effectiveArmor = getEffectiveEnemyArmor(
        result2.state,
        "enemy_0",
        guardsDef.armor,
        guardsDef.resistances?.length ?? 0,
        "player1"
      );

      // Armor 7 - 5 = 2
      expect(effectiveArmor).toBe(2);

      // Both abilities should be tracked
      expect(result2.state.players[0].units[0].usedAbilityIndices).toContain(3);
      expect(result2.state.players[0].units[0].usedAbilityIndices).toContain(2);
    });
  });
});
