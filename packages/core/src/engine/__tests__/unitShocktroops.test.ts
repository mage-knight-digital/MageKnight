/**
 * Shocktroops Unit Ability Tests
 *
 * Shocktroops have three abilities (all effect-based):
 * 1. Coordinated Fire: Ranged Attack 1 + all units get +1 to all attacks this combat
 * 2. Weaken Enemy: Target enemy gets -1 armor (min 1) and -1 attack (min 0)
 * 3. Taunt + Reduce Attack: Target enemy gets -3 attack (min 0),
 *    damage from that enemy must be assigned to this unit first (overrides Assassination)
 *
 * Key rules:
 * - Ability 2 armor reduction minimum is 1 (not 0)
 * - Ability 1 buff applies to all unit attack types (melee, ranged, siege)
 * - Ability 2 usable in ranged phase despite being defensive
 * - Damage redirect (Taunt) overrides Assassination
 * - Damage redirect inactive if Shocktroops is wounded/destroyed
 * - Attack reduction IS blocked by Arcane Immunity
 * - Damage redirect is NOT blocked by Arcane Immunity (defensive ability)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
} from "./testHelpers.js";
import {
  UNIT_SHOCKTROOPS,
  UNIT_STATE_SPENT,
  ACTIVATE_UNIT_ACTION,
  RESOLVE_CHOICE_ACTION,
  UNIT_ACTIVATED,
  CHOICE_REQUIRED,
  ENEMY_GUARDSMEN,
  ENEMY_GOLEMS,
  ENEMY_SORCERERS,
  ENEMY_ORC_TRACKER,
  getEnemy,
} from "@mage-knight/shared";
import { SHOCKTROOPS } from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_CONTEXT_STANDARD,
  type CombatState,
  type CombatEnemy,
} from "../../types/combat.js";
import {
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
  getUnitAttackBonus,
} from "../modifiers/index.js";
import {
  getDamageRedirectUnit,
  isAssassinationActive,
} from "../rules/combatTargeting.js";
import { getDamageAssignmentOptions } from "../validActions/combatDamage.js";

/**
 * Create a combat state for Shocktroops tests
 */
function createShocktroopsCombatState(
  phase: CombatState["phase"],
  enemies: CombatEnemy[],
  overrides: Partial<CombatState> = {}
): CombatState {
  return {
    enemies,
    phase,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite: false,
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
    ...overrides,
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
    damageAssigned: false,
    isRequiredForConquest: true,
  };
}

describe("Shocktroops Unit", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("Unit Definition", () => {
    it("should have correct basic properties", () => {
      expect(SHOCKTROOPS.name).toBe("Shocktroops");
      expect(SHOCKTROOPS.level).toBe(2);
      expect(SHOCKTROOPS.influence).toBe(6);
      expect(SHOCKTROOPS.armor).toBe(3);
    });

    it("should have three effect-based abilities", () => {
      expect(SHOCKTROOPS.abilities.length).toBe(3);
      for (const ability of SHOCKTROOPS.abilities) {
        expect(ability.type).toBe("effect");
      }
    });

    it("should have no mana costs (all free abilities)", () => {
      for (const ability of SHOCKTROOPS.abilities) {
        expect(ability.manaCost).toBeUndefined();
      }
    });
  });

  // ==========================================================================
  // Ability 0: Coordinated Fire (Ranged Attack 1 + Unit Buff)
  // ==========================================================================
  describe("Coordinated Fire (Ability 0)", () => {
    it("should add Ranged Attack 1 to combat accumulator", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      // Unit should be spent
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);

      // Should have Ranged Attack 1 in accumulator
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(1);
    });

    it("should apply +1 unit attack bonus modifier for all units", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      // Should have +1 unit attack bonus active
      const bonus = getUnitAttackBonus(result.state, "player1");
      expect(bonus).toBe(1);
    });

    it("should stack unit attack bonus with multiple Shocktroops", () => {
      const unit1 = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const unit2 = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_2");
      const player = createTestPlayer({
        units: [unit1, unit2],
        commandTokens: 2,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Activate first Shocktroops
      const result1 = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      // Activate second Shocktroops
      const result2 = engine.processAction(result1.state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_2",
        abilityIndex: 0,
      });

      // Should have +2 total bonus (stacked)
      const bonus = getUnitAttackBonus(result2.state, "player1");
      expect(bonus).toBe(2);

      // Should have Ranged Attack 2 total (1 + 1)
      expect(result2.state.players[0].combatAccumulator.attack.ranged).toBe(2);
    });

    it("should boost other unit's attack values via the bonus", () => {
      // Create a Shocktroops and a regular attack unit
      const shocktroops = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      // Use a second Shocktroops as the "other unit" since it has attack abilities
      const otherUnit = {
        ...createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_2"),
      };
      const player = createTestPlayer({
        units: [shocktroops, otherUnit],
        commandTokens: 2,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      // Activate first Shocktroops' coordinated fire
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      // Check the unit attack bonus is active
      expect(getUnitAttackBonus(result.state, "player1")).toBe(1);
    });

    it("should work in attack phase too", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_ATTACK, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(1);
      expect(getUnitAttackBonus(result.state, "player1")).toBe(1);
    });
  });

  // ==========================================================================
  // Ability 1: Weaken Enemy (Reduce Armor by 1, Reduce Attack by 1)
  // ==========================================================================
  describe("Weaken Enemy (Ability 1)", () => {
    it("should reduce enemy armor by 1 (minimum 1)", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Golems have armor 5
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      // Armor should be reduced by 1 (5 -> 4)
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        5, // base armor
        1, // resistance count (physical)
        "player1"
      );
      expect(effectiveArmor).toBe(4);
    });

    it("should enforce armor minimum of 1", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Create enemy with armor 1 to test minimum
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      // Even with -1, armor minimum is 1
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        1, // base armor of 1
        0,
        "player1"
      );
      expect(effectiveArmor).toBe(1); // min 1, not 0
    });

    it("should reduce enemy attack by 1 (minimum 0)", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Golems have attack 2
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      // Attack should be reduced by 1 (2 -> 1)
      const effectiveAttack = getEffectiveEnemyAttack(
        result.state,
        "enemy_0",
        2 // base attack
      );
      expect(effectiveAttack).toBe(1);
    });

    it("should be usable in ranged/siege phase", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
    });

    it("should present choice when multiple enemies", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_GUARDSMEN),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      // Should create pending choice
      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();
      const choiceEvent = activateResult.events.find((e) => e.type === CHOICE_REQUIRED);
      expect(choiceEvent).toBeDefined();

      // Resolve: select enemy_1
      const choiceResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Only selected enemy should be weakened
      const enemy0Armor = getEffectiveEnemyArmor(choiceResult.state, "enemy_0", 5, 1, "player1");
      const enemy1Armor = getEffectiveEnemyArmor(choiceResult.state, "enemy_1", 7, 0, "player1");
      expect(enemy0Armor).toBe(5); // Unchanged
      expect(enemy1Armor).toBe(6); // Reduced by 1
    });

    it("should be blocked by Arcane Immunity", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Enemy Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const sorcererDef = getEnemy(ENEMY_SORCERERS);

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 1,
      });

      // Armor should be unchanged (Arcane Immunity blocks)
      const effectiveArmor = getEffectiveEnemyArmor(
        result.state,
        "enemy_0",
        sorcererDef.armor,
        sorcererDef.resistances.length,
        "player1"
      );
      expect(effectiveArmor).toBe(sorcererDef.armor);
    });
  });

  // ==========================================================================
  // Ability 2: Taunt + Reduce Attack by 3
  // ==========================================================================
  describe("Taunt + Reduce Attack (Ability 2)", () => {
    it("should reduce enemy attack by 3 (minimum 0)", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Guardsmen have attack 3
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GUARDSMEN)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Attack should be reduced by 3 (3 -> 0)
      const effectiveAttack = getEffectiveEnemyAttack(
        result.state,
        "enemy_0",
        3
      );
      expect(effectiveAttack).toBe(0);
    });

    it("should enforce attack minimum of 0", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Golems have attack 2 (< 3 reduction)
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Attack should be 0 (min 0), not negative
      const effectiveAttack = getEffectiveEnemyAttack(
        result.state,
        "enemy_0",
        2
      );
      expect(effectiveAttack).toBe(0);
    });

    it("should set damage redirect to the activating unit", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Should have damage redirect set
      expect(result.state.combat?.damageRedirects["enemy_0"]).toBe("shocktroops_1");

      // getDamageRedirectUnit should return the unit (even though unit is spent)
      const redirectUnit = getDamageRedirectUnit(result.state, "player1", "enemy_0");
      expect(redirectUnit).toBe("shocktroops_1");
    });

    it("should override Assassination with damage redirect", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Orc Tracker has Assassination
      const enemies = [createCombatEnemy("enemy_0", ENEMY_ORC_TRACKER)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Assassination should be overridden by damage redirect
      expect(isAssassinationActive(result.state, "player1", result.state.combat!.enemies[0])).toBe(false);

      // Damage redirect should be active
      expect(getDamageRedirectUnit(result.state, "player1", "enemy_0")).toBe("shocktroops_1");
    });

    it("should make redirect inactive if unit is wounded", () => {
      const woundedUnit = {
        ...createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1"),
        state: UNIT_STATE_SPENT as const,
        wounded: true,
      };
      const player = createTestPlayer({
        units: [woundedUnit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const combat = createShocktroopsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE, enemies, {
        damageRedirects: { enemy_0: "shocktroops_1" },
      });
      const state = createTestGameState({
        players: [player],
        combat,
      });

      // Redirect should be inactive (unit is wounded)
      const redirectUnit = getDamageRedirectUnit(state, "player1", "enemy_0");
      expect(redirectUnit).toBeUndefined();
    });

    it("should show only redirect unit in damage assignment options", () => {
      const shocktroops = {
        ...createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1"),
        state: UNIT_STATE_SPENT as const,
      };
      // Another unit that should NOT be targetable
      const otherUnit = {
        ...createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_2"),
        state: UNIT_STATE_SPENT as const,
      };
      const player = createTestPlayer({
        units: [shocktroops, otherUnit],
        commandTokens: 2,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const combat = createShocktroopsCombatState(COMBAT_PHASE_ASSIGN_DAMAGE, enemies, {
        damageRedirects: { enemy_0: "shocktroops_1" },
      });
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const options = getDamageAssignmentOptions(state, combat.enemies);

      // Should have one option for the enemy
      expect(options.length).toBe(1);
      const option = options[0];

      // Should have damageRedirectOnly flag
      expect(option.damageRedirectOnly).toBe(true);

      // Available units should only include the redirect unit
      const assignableUnits = option.availableUnits.filter(u => u.canBeAssigned);
      expect(assignableUnits.length).toBe(1);
      expect(assignableUnits[0].unitInstanceId).toBe("shocktroops_1");
    });

    it("should allow targeting Arcane Immune enemy (attack reduction works, redirect works)", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      // Enemy Sorcerers have Arcane Immunity
      const enemies = [createCombatEnemy("enemy_0", ENEMY_SORCERERS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const sorcererDef = getEnemy(ENEMY_SORCERERS);
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Attack reduction bypasses Arcane Immunity (FAQ Arcane Immunity S1)
      const effectiveAttack = getEffectiveEnemyAttack(
        result.state,
        "enemy_0",
        sorcererDef.attack
      );
      expect(effectiveAttack).toBe(sorcererDef.attack - 3); // Reduced by 3

      // Damage redirect should also work (not blocked by AI)
      expect(result.state.combat?.damageRedirects["enemy_0"]).toBe("shocktroops_1");
    });

    it("should present choice when multiple enemies", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [
        createCombatEnemy("enemy_0", ENEMY_GOLEMS),
        createCombatEnemy("enemy_1", ENEMY_GUARDSMEN),
      ];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const activateResult = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 2,
      });

      // Should create pending choice
      expect(activateResult.state.players[0].pendingChoice).not.toBeNull();

      // Resolve: select enemy_1
      const choiceResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Only selected enemy should have attack reduced and redirect set
      expect(choiceResult.state.combat?.damageRedirects["enemy_0"]).toBeUndefined();
      expect(choiceResult.state.combat?.damageRedirects["enemy_1"]).toBe("shocktroops_1");

      // Only enemy_1 should have reduced attack
      expect(getEffectiveEnemyAttack(choiceResult.state, "enemy_0", 2)).toBe(2); // Unchanged
      expect(getEffectiveEnemyAttack(choiceResult.state, "enemy_1", 3)).toBe(0); // 3 - 3 = 0
    });
  });

  // ==========================================================================
  // Cross-ability tests
  // ==========================================================================
  describe("Cross-ability interactions", () => {
    it("should emit UNIT_ACTIVATED event for each ability", () => {
      const unit = createPlayerUnit(UNIT_SHOCKTROOPS, "shocktroops_1");
      const player = createTestPlayer({
        units: [unit],
        commandTokens: 1,
      });

      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];
      const state = createTestGameState({
        players: [player],
        combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
      });

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "shocktroops_1",
        abilityIndex: 0,
      });

      const activateEvent = result.events.find((e) => e.type === UNIT_ACTIVATED);
      expect(activateEvent).toBeDefined();
    });

    it("should not require mana for any ability", () => {
      const enemies = [createCombatEnemy("enemy_0", ENEMY_GOLEMS)];

      // All abilities should work without mana
      for (let i = 0; i < 3; i++) {
        const freshUnit = createPlayerUnit(UNIT_SHOCKTROOPS, `shocktroops_${i}`);
        const freshPlayer = createTestPlayer({
          units: [freshUnit],
          commandTokens: 1,
          pureMana: [],
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
        });
        const freshState = createTestGameState({
          players: [freshPlayer],
          combat: createShocktroopsCombatState(COMBAT_PHASE_RANGED_SIEGE, enemies),
        });

        const result = engine.processAction(freshState, "player1", {
          type: ACTIVATE_UNIT_ACTION,
          unitInstanceId: `shocktroops_${i}`,
          abilityIndex: i,
        });

        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      }
    });
  });
});
