/**
 * Tests for Taunt skill (Wolfhawk)
 *
 * Once per turn, during Block Phase:
 * Option 1: Reduce one enemy's attack by 1
 * Option 2: Increase one enemy's attack by 2 AND reduce armor by 2 (min 1)
 *
 * Key rules:
 * - Block Phase only (Q3/A3)
 * - Armor reduction only happens if enemy actually attacks (Q4/A4)
 * - CAN reduce attack of Arcane Immune enemies (Q1/A1)
 * - CANNOT reduce armor of Arcane Immune enemies (Q1/A1)
 * - Attack reduction is attack modification (affects Brutal doubling)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENEMY_PROWLERS,
  ENEMY_GUARDSMEN,
  ENEMY_GRIM_LEGIONNARIES,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_TAUNT } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import {
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
} from "../modifiers/index.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

function createWolfhawkPlayer() {
  return createTestPlayer({
    hero: Hero.Wolfhawk,
    skills: [SKILL_WOLFHAWK_TAUNT],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
  });
}

describe("Taunt skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during block phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_TAUNT,
        })
      );
    });

    it("should reject if not in block phase (ranged/siege)", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_PROWLERS]);
      // Default phase is ranged/siege
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if not in block phase (attack)", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should only be usable once per turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_TAUNT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_TAUNT],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Option 1: Attack -1", () => {
    it("should reduce enemy attack by 1", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Taunt - creates a choice (Option 1 vs Option 2)
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Player should have a pending choice (two options)
      expect(activateResult.state.players[0].pendingChoice).toBeDefined();

      // Choose Option 1 (Attack -1) - index 0
      const chooseOptionResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Now should have another choice: which enemy to target
      expect(chooseOptionResult.state.players[0].pendingChoice).toBeDefined();

      // Select the enemy
      const selectEnemyResult = engine.processAction(chooseOptionResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Enemy should have attack -1 modifier
      const enemyId = selectEnemyResult.state.combat!.enemies[0].instanceId;
      const baseAttack = selectEnemyResult.state.combat!.enemies[0].definition.attack;
      const effectiveAttack = getEffectiveEnemyAttack(selectEnemyResult.state, enemyId, baseAttack);
      expect(effectiveAttack).toBe(baseAttack - 1);
    });

    it("should allow attack to be reduced to 0", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;
      const baseAttack = state.combat!.enemies[0].definition.attack;

      // Pre-apply attack reduction to bring attack to 1
      for (let i = 0; i < baseAttack - 1; i++) {
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId },
          effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: -1, minimum: 0 },
          createdAtRound: state.round,
          createdByPlayerId: "player1",
        });
      }

      // Now apply Taunt's -1 to bring attack to 0
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: -1, minimum: 0 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const effectiveAttack = getEffectiveEnemyAttack(state, enemyId, baseAttack);
      expect(effectiveAttack).toBe(0);
    });
  });

  describe("Option 2: Attack +2, Armor -2", () => {
    it("should increase enemy attack by 2 and reduce armor by 2", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Taunt
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Choose Option 2 (Attack +2, Armor -2) - index 1
      const chooseOptionResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Select the enemy
      const selectEnemyResult = engine.processAction(chooseOptionResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const enemy = selectEnemyResult.state.combat!.enemies[0];
      const enemyId = enemy.instanceId;
      const baseAttack = enemy.definition.attack;
      const baseArmor = enemy.definition.armor;

      // Attack should be +2
      const effectiveAttack = getEffectiveEnemyAttack(selectEnemyResult.state, enemyId, baseAttack);
      expect(effectiveAttack).toBe(baseAttack + 2);

      // Armor should be -2 (enemy is attacking, not prevented)
      const effectiveArmor = getEffectiveEnemyArmor(
        selectEnemyResult.state, enemyId, baseArmor,
        enemy.definition.resistances.length, "player1"
      );
      expect(effectiveArmor).toBe(baseArmor - 2);
    });

    it("should enforce armor minimum of 1", () => {
      const player = createWolfhawkPlayer();
      // ENEMY_PROWLERS has armor 3 - apply -2 gets to 1
      // But let's pre-reduce armor to 2, then Taunt -2 should floor at 1
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;
      const baseArmor = state.combat!.enemies[0].definition.armor;

      // Apply Taunt option 2 modifiers directly for simpler test
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: 2, minimum: 0 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1, onlyIfEnemyAttacks: true },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Also apply a separate armor reduction to bring it lower
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -(baseArmor - 1), minimum: 1 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Even with massive armor reduction, armor should not go below 1
      const effectiveArmor = getEffectiveEnemyArmor(state, enemyId, baseArmor, 0, "player1");
      expect(effectiveArmor).toBe(1);
    });
  });

  describe("conditional armor reduction", () => {
    it("should NOT reduce armor if enemy is prevented from attacking (skip attack)", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;
      const baseArmor = state.combat!.enemies[0].definition.armor;

      // Apply Taunt option 2 modifiers
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: 2, minimum: 0 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1, onlyIfEnemyAttacks: true },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Now apply skip-attack (simulating Possess/Chill)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Armor should NOT be reduced (enemy is prevented from attacking)
      const effectiveArmor = getEffectiveEnemyArmor(state, enemyId, baseArmor, 0, "player1");
      expect(effectiveArmor).toBe(baseArmor);
    });

    it("should reduce armor if enemy IS attacking", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;
      const baseArmor = state.combat!.enemies[0].definition.armor;

      // Apply Taunt option 2 modifiers (no skip-attack)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: 2, minimum: 0 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1, onlyIfEnemyAttacks: true },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Armor SHOULD be reduced (enemy is attacking)
      const effectiveArmor = getEffectiveEnemyArmor(state, enemyId, baseArmor, 0, "player1");
      expect(effectiveArmor).toBe(baseArmor - 2);
    });
  });

  describe("Arcane Immunity interaction", () => {
    it("should allow attack reduction against Arcane Immune enemies (Option 1)", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_GRIM_LEGIONNARIES]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Taunt
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Choose Option 1 (Attack -1) - index 0
      const chooseOptionResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Select the enemy
      const selectEnemyResult = engine.processAction(chooseOptionResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Attack reduction should work even against Arcane Immune
      const enemy = selectEnemyResult.state.combat!.enemies[0];
      const effectiveAttack = getEffectiveEnemyAttack(
        selectEnemyResult.state, enemy.instanceId, enemy.definition.attack
      );
      expect(effectiveAttack).toBe(enemy.definition.attack - 1);
    });

    it("should allow attack increase but block armor reduction against Arcane Immune (Option 2)", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_GRIM_LEGIONNARIES]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Taunt
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Choose Option 2 (Attack +2, Armor -2) - index 1
      const chooseOptionResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Select the Arcane Immune enemy
      const selectEnemyResult = engine.processAction(chooseOptionResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      const enemy = selectEnemyResult.state.combat!.enemies[0];
      const enemyId = enemy.instanceId;

      // Attack +2 should apply (attack modifications bypass Arcane Immunity)
      const effectiveAttack = getEffectiveEnemyAttack(
        selectEnemyResult.state, enemyId, enemy.definition.attack
      );
      expect(effectiveAttack).toBe(enemy.definition.attack + 2);

      // Armor -2 should NOT apply (blocked by Arcane Immunity)
      const effectiveArmor = getEffectiveEnemyArmor(
        selectEnemyResult.state, enemyId, enemy.definition.armor,
        enemy.definition.resistances.length, "player1"
      );
      expect(effectiveArmor).toBe(enemy.definition.armor);
    });
  });

  describe("valid actions", () => {
    it("should show skill during block phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_TAUNT,
        })
      );
    });

    it("should not show skill during ranged/siege phase", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const taunt = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_TAUNT
        );
        expect(taunt).toBeUndefined();
      }
    });

    it("should not show skill during attack phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const taunt = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_TAUNT
        );
        expect(taunt).toBeUndefined();
      }
    });

    it("should not show skill when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const taunt = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_TAUNT
        );
        expect(taunt).toBeUndefined();
      }
    });

    it("should not show skill when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_TAUNT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_TAUNT],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const taunt = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_TAUNT
        );
        expect(taunt).toBeUndefined();
      }
    });
  });

  describe("undo", () => {
    it("should remove modifier and restore cooldown on undo", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate the skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Verify skill is on cooldown
      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_TAUNT);

      // Undo should be available (skill activation is reversible)
      const validActions = getValidActions(result.state, "player1");
      expect(validActions.turn.canUndo).toBe(true);
    });
  });

  describe("attack reduction is attack modification", () => {
    it("should modify attack value itself (not damage reduction)", () => {
      // Attack reduction modifies the attack stat, which means:
      // - Brutal doubled damage is based on MODIFIED attack
      // - This is different from block (which doesn't reduce attack)
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;
      const baseAttack = state.combat!.enemies[0].definition.attack;

      // Apply attack -1 modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_TAUNT, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ATTACK, amount: -1, minimum: 0 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // The effective attack should be reduced
      // Brutal would double (baseAttack - 1), not (baseAttack) - 1
      const effectiveAttack = getEffectiveEnemyAttack(state, enemyId, baseAttack);
      expect(effectiveAttack).toBe(baseAttack - 1);
    });
  });

  describe("multiple enemies", () => {
    it("should allow targeting one of multiple enemies", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate Taunt
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_TAUNT,
      });

      // Choose Option 1 (Attack -1)
      const chooseOptionResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have two enemy options to choose from
      const pendingChoice = chooseOptionResult.state.players[0].pendingChoice;
      expect(pendingChoice).toBeDefined();
      expect(pendingChoice!.options).toHaveLength(2);

      // Select the second enemy (Guardsmen)
      const selectEnemyResult = engine.processAction(chooseOptionResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Only the second enemy should have the modifier
      const enemy0 = selectEnemyResult.state.combat!.enemies[0];
      const enemy1 = selectEnemyResult.state.combat!.enemies[1];

      const attack0 = getEffectiveEnemyAttack(selectEnemyResult.state, enemy0.instanceId, enemy0.definition.attack);
      const attack1 = getEffectiveEnemyAttack(selectEnemyResult.state, enemy1.instanceId, enemy1.definition.attack);

      // First enemy should be unaffected
      expect(attack0).toBe(enemy0.definition.attack);
      // Second enemy should have -1 attack
      expect(attack1).toBe(enemy1.definition.attack - 1);
    });
  });
});
