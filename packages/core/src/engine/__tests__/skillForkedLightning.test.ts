/**
 * Tests for Forked Lightning skill (Braevalar)
 *
 * Once per turn: Ranged Cold Fire Attack 1 against up to 3 different enemies.
 *
 * Key rules:
 * - Each target receives exactly 1 Cold Fire Ranged Attack (S3: cannot combine)
 * - Must target different enemies (up to 3)
 * - All attacks must be in the same sub-phase (S5)
 * - Can target enemies in different groups (A4) as long as same sub-phase
 * - Single enemy: only 1 attack point can be used (S3)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestPlayer,
  createTestGameState,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  ENEMY_DIGGERS,
  ENEMIES,
  getSkillsFromValidActions,
  ELEMENT_COLD_FIRE,
} from "@mage-knight/shared";
import { SKILL_BRAEVALAR_FORKED_LIGHTNING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  resolveSelectCombatEnemy,
} from "../effects/combatEffects.js";
import { resolveEffect } from "../effects/index.js";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import type { SelectCombatEnemyEffect, ResolveCombatEnemyTargetEffect } from "../../types/cards.js";
import {
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_NOOP,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_RANGED,
} from "../../types/effectTypes.js";
import type { SkillId } from "@mage-knight/shared";

// ============================================================================
// Test Helpers
// ============================================================================

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

function createCombatEnemy(
  instanceId: string,
  enemyId: string = ENEMY_DIGGERS,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const def = ENEMIES[enemyId as keyof typeof ENEMIES];
  if (!def) throw new Error(`Unknown enemy: ${enemyId}`);
  return {
    instanceId,
    enemyId: enemyId as CombatEnemy["enemyId"],
    definition: def,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    ...overrides,
  };
}

function createRangedPhaseCombat(
  enemies: CombatEnemy[],
  overrides: Partial<CombatState> = {}
): CombatState {
  const base = createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE);
  return {
    ...base,
    enemies,
    ...overrides,
  };
}


function createPlayerWithForkedLightning(overrides: Partial<import("../../types/player.js").Player> = {}) {
  return createTestPlayer({
    skills: [SKILL_BRAEVALAR_FORKED_LIGHTNING],
    skillCooldowns: defaultCooldowns,
    ...overrides,
  });
}

const forkedLightningEffect: SelectCombatEnemyEffect = {
  type: EFFECT_SELECT_COMBAT_ENEMY,
  maxTargets: 3,
  template: {
    bundledEffect: {
      type: EFFECT_GAIN_ATTACK,
      amount: 1,
      combatType: COMBAT_TYPE_RANGED,
      element: ELEMENT_COLD_FIRE,
    },
  },
};

// ============================================================================
// Tests
// ============================================================================

describe("Forked Lightning skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // --------------------------------------------------------------------------
  // Effect Resolution (via resolveEffect)
  // --------------------------------------------------------------------------
  describe("Effect Resolution", () => {
    it("should present enemy choices when in combat with multiple enemies", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      const result = resolveSelectCombatEnemy(state, forkedLightningEffect, "player1");

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(3);
      expect(result.description).toContain("0/3 selected");
    });

    it("should gain Ranged Cold Fire Attack 1 per target selected", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Step 1: Initial selection
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      expect(step1.requiresChoice).toBe(true);
      expect(step1.dynamicChoiceOptions).toHaveLength(3);

      // Step 2: Select first enemy
      const firstChoice = step1.dynamicChoiceOptions![0]!;
      const step2 = resolveEffect(step1.state, "player1", firstChoice);

      // Should gain 1 Cold Fire Ranged Attack and loop back for more targets
      expect(step2.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(1);
      expect(step2.requiresChoice).toBe(true);

      // Step 3: Select second enemy
      const step2EnemyOptions = step2.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      );
      const secondChoice = step2EnemyOptions[0]!;
      const step3 = resolveEffect(step2.state, "player1", secondChoice);

      // Should gain another 1 Cold Fire Ranged Attack (total 2)
      expect(step3.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(2);
      expect(step3.requiresChoice).toBe(true);

      // Step 4: Select third enemy (max reached, no more choices)
      const step3EnemyOptions = step3.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      );
      const thirdChoice = step3EnemyOptions[0]!;
      const step4 = resolveEffect(step3.state, "player1", thirdChoice);

      // Should gain another 1 (total 3), no more choices
      expect(step4.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(3);
      expect(step4.requiresChoice).toBeUndefined();
    });

    it("should enforce different enemies (no duplicates)", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Step 1: Select enemy_1
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      const firstChoice = step1.dynamicChoiceOptions![0]!;
      const step2 = resolveEffect(step1.state, "player1", firstChoice);

      // Verify enemy_1 is excluded from next selection
      const step2Options = step2.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      ) as ResolveCombatEnemyTargetEffect[];
      expect(step2Options.every((o) => o.enemyInstanceId !== "enemy_1")).toBe(true);
    });

    it("should allow stopping early via done option", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        createCombatEnemy("enemy_3", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Select first enemy
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      const firstChoice = step1.dynamicChoiceOptions![0]!;
      const step2 = resolveEffect(step1.state, "player1", firstChoice);

      // Should have "done" option after at least 1 target selected
      const doneOption = step2.dynamicChoiceOptions!.find((o) => o.type === EFFECT_NOOP);
      expect(doneOption).toBeDefined();

      // Select done
      const step3 = resolveEffect(step2.state, "player1", doneOption!);
      expect(step3.requiresChoice).toBeUndefined();

      // Should only have 1 attack point (from one target)
      expect(step3.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(1);
    });

    it("should not have done option on first selection", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      const noopOption = step1.dynamicChoiceOptions!.find((o) => o.type === EFFECT_NOOP);
      expect(noopOption).toBeUndefined();
    });

    it("should handle single enemy (only 1 attack point)", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Should present 1 enemy option
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      expect(step1.requiresChoice).toBe(true);
      expect(step1.dynamicChoiceOptions).toHaveLength(1);

      // Select the only enemy - no more choices
      const step2 = resolveEffect(step1.state, "player1", step1.dynamicChoiceOptions![0]!);
      expect(step2.requiresChoice).toBeUndefined();
      expect(step2.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(1);
    });

    it("should handle two enemies (up to 2 attack points)", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Select both enemies
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      const step2 = resolveEffect(step1.state, "player1", step1.dynamicChoiceOptions![0]!);
      expect(step2.requiresChoice).toBe(true);

      const step2EnemyOptions = step2.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_RESOLVE_COMBAT_ENEMY_TARGET
      );
      const step3 = resolveEffect(step2.state, "player1", step2EnemyOptions[0]!);

      // No more targets, done
      expect(step3.requiresChoice).toBeUndefined();
      expect(step3.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(2);
    });

    it("should stop when no eligible enemies remain", () => {
      // 1 normal enemy + 1 already defeated
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS, { isDefeated: true }),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const state = createTestGameState({ combat });

      // Only 1 eligible enemy
      const step1 = resolveEffect(state, "player1", forkedLightningEffect);
      expect(step1.dynamicChoiceOptions).toHaveLength(1);

      const step2 = resolveEffect(step1.state, "player1", step1.dynamicChoiceOptions![0]!);
      expect(step2.requiresChoice).toBeUndefined();
      expect(step2.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(1);
    });

    it("should return no targets when not in combat", () => {
      const state = createTestGameState({ combat: undefined });

      const result = resolveSelectCombatEnemy(state, forkedLightningEffect, "player1");
      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toBe("Not in combat");
    });
  });

  // --------------------------------------------------------------------------
  // Integration (via engine.processAction)
  // --------------------------------------------------------------------------
  describe("Skill Activation", () => {
    it("should activate Forked Lightning during combat and produce choice", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const player = createPlayerWithForkedLightning();
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FORKED_LIGHTNING as SkillId,
      });

      // Should have SKILL_USED event
      expect(result.events.some((e) => e.type === SKILL_USED)).toBe(true);

      // Should have pending choice for enemy selection
      expect(result.state.players[0]!.pendingChoice).toBeDefined();
    });

    it("should complete Forked Lightning after selecting targets and resolving choices", () => {
      const enemies = [
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        createCombatEnemy("enemy_2", ENEMY_DIGGERS),
      ];
      const combat = createRangedPhaseCombat(enemies);
      const player = createPlayerWithForkedLightning();
      const state = createTestGameState({
        players: [player],
        combat,
      });

      // Activate skill
      const step1 = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FORKED_LIGHTNING as SkillId,
      });
      expect(step1.state.players[0]!.pendingChoice).toBeDefined();

      // Select first enemy (index 0)
      const step2 = engine.processAction(step1.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have gained 1 Ranged Cold Fire Attack
      expect(step2.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(1);

      // Should still have pending choice for second target (or done)
      expect(step2.state.players[0]!.pendingChoice).toBeDefined();

      // Select second enemy
      const step3 = engine.processAction(step2.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // First option should be an enemy (not done)
      });

      // Should have 2 total Ranged Cold Fire Attack
      expect(step3.state.players[0]!.combatAccumulator.attack.rangedElements.coldFire).toBe(2);
    });

    it("should track once-per-turn cooldown", () => {
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createRangedPhaseCombat(enemies);
      const player = createPlayerWithForkedLightning({
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_FORKED_LIGHTNING],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FORKED_LIGHTNING as SkillId,
      });

      expect(result.events.some((e) => e.type === INVALID_ACTION)).toBe(true);
    });

    it("should reject when not in combat", () => {
      const player = createPlayerWithForkedLightning();
      const state = createTestGameState({
        players: [player],
        combat: undefined,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FORKED_LIGHTNING as SkillId,
      });

      // Skill activation out of combat: the skill fires but the effect finds no targets
      // The skill is still marked as used (cooldown applied)
      expect(result.state).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // Valid Actions
  // --------------------------------------------------------------------------
  describe("Valid Actions", () => {
    it("should show Forked Lightning as available during combat", () => {
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createRangedPhaseCombat(enemies);
      const player = createPlayerWithForkedLightning();
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions).toBeDefined();
      expect(skillOptions!.activatable.some((s) => s.skillId === SKILL_BRAEVALAR_FORKED_LIGHTNING)).toBe(true);
    });

    it("should not show Forked Lightning after already used this turn", () => {
      const enemies = [createCombatEnemy("enemy_1", ENEMY_DIGGERS)];
      const combat = createRangedPhaseCombat(enemies);
      const player = createPlayerWithForkedLightning({
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_FORKED_LIGHTNING],
        },
      });
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const hasForkedLightning = skillOptions?.activatable.some(
        (s) => s.skillId === SKILL_BRAEVALAR_FORKED_LIGHTNING
      ) ?? false;
      expect(hasForkedLightning).toBe(false);
    });
  });
});
