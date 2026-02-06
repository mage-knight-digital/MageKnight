/**
 * Tests for Resistance Break skill (Tovak)
 *
 * Skill effect: Target enemy gets Armor -1 per resistance (min 1).
 * Cannot target Arcane Immune enemies.
 * Only counts Physical, Ice, Fire resistances.
 *
 * Enemy choices for testing (all allow physical attacks without resistance halving):
 * - ENEMY_DIGGERS: Armor 3, 0 resistances
 * - ENEMY_FREEZERS: Armor 7, 1 resistance (Fire)
 * - ENEMY_ORC_WAR_BEASTS: Armor 5, 2 resistances (Fire + Ice)
 * - ENEMY_ALTEM_GUARDSMEN: Armor 7, 3 resistances (Physical + Fire + Ice) - physical is halved
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  COMBAT_TYPE_MELEE,
  ELEMENT_PHYSICAL,
  ENEMY_DIGGERS,
  ENEMY_FREEZERS,
  ENEMY_ORC_WAR_BEASTS,
  ENEMY_ALTEM_GUARDSMEN,
  ENEMY_GRIM_LEGIONNARIES,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_RESISTANCE_BREAK } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

function createTovakPlayer() {
  return createTestPlayer({
    hero: Hero.Tovak,
    skills: [SKILL_TOVAK_RESISTANCE_BREAK],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
  });
}

/**
 * Helper: enter combat, apply Resistance Break modifier + skip attack, advance to attack phase.
 * Uses ENTER_COMBAT_ACTION for realistic combat setup.
 */
function setupCombatWithResistanceBreak(
  engine: MageKnightEngine,
  enemyId: string,
) {
  const player = createTovakPlayer();
  let state = createTestGameState({ players: [player] });

  state = engine.processAction(state, "player1", {
    type: ENTER_COMBAT_ACTION,
    enemyIds: [enemyId],
  }).state;

  const enemyInstanceId = state.combat!.enemies[0].instanceId;

  // Apply Resistance Break modifier (perResistance: true, amount: -1)
  state = addModifier(state, {
    source: { type: SOURCE_SKILL, skillId: SKILL_TOVAK_RESISTANCE_BREAK, playerId: "player1" },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
    effect: {
      type: EFFECT_ENEMY_STAT,
      stat: ENEMY_STAT_ARMOR,
      amount: -1,
      minimum: 1,
      perResistance: true,
    },
    createdAtRound: state.round,
    createdByPlayerId: "player1",
  });

  // Skip enemy attack
  state = addModifier(state, {
    source: { type: SOURCE_SKILL, skillId: "test_skip" as any, playerId: "player1" },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
    effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
    createdAtRound: state.round,
    createdByPlayerId: "player1",
  });

  // Advance to attack phase
  state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
  state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
  state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
  expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

  return { state, enemyInstanceId };
}

describe("Resistance Break skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during combat", () => {
      const player = createTovakPlayer();
      const combat = createCombatState([ENEMY_DIGGERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_RESISTANCE_BREAK,
        })
      );
    });

    it("should show skill in valid actions during combat", () => {
      const player = createTovakPlayer();
      const combat = {
        ...createCombatState([ENEMY_DIGGERS, ENEMY_FREEZERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      if (skills) {
        expect(skills.activatable).toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_RESISTANCE_BREAK,
          })
        );
      }
    });

    it("should reject activation outside of combat", () => {
      const player = createTovakPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  describe("enemy targeting", () => {
    it("should create pending choice when multiple enemies available", () => {
      const player = createTovakPlayer();
      const combat = createCombatState([ENEMY_DIGGERS, ENEMY_FREEZERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(2);
    });

    it("should auto-resolve when only one non-Arcane-Immune enemy", () => {
      const player = createTovakPlayer();
      // Grim Legionnaries have Arcane Immunity → excluded, only Diggers left → auto-resolve
      const combat = createCombatState([ENEMY_DIGGERS, ENEMY_GRIM_LEGIONNARIES]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Auto-resolved: modifier applied, no pending choice
      expect(result.state.players[0].pendingChoice).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );
    });

    it("should handle all enemies being Arcane Immune gracefully", () => {
      const player = createTovakPlayer();
      const combat = createCombatState([ENEMY_GRIM_LEGIONNARIES]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Skill used but no effect
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );
      expect(result.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("armor reduction by resistance count", () => {
    it("should not reduce armor for enemy with 0 resistances (Diggers: Armor 3)", () => {
      // Diggers: Armor 3, 0 resistances → effective armor stays 3
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_DIGGERS);

      // Attack with 3 should defeat (armor unchanged at 3)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should not defeat enemy with 0 resistances using less than original armor", () => {
      // Diggers: Armor 3, 0 resistances → need 3 to defeat
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_DIGGERS);

      // Attack with 2 should NOT defeat
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 2 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
    });

    it("should reduce armor by 1 for enemy with 1 resistance (Freezers: Armor 7, Fire)", () => {
      // Freezers: Armor 7, Fire resistance (1) → effective armor = 7 - 1 = 6
      // Physical attack not halved (enemy only has Fire resistance)
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_FREEZERS);

      // Attack with 6 should defeat (effective armor = 6)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should reduce armor by 2 for enemy with 2 resistances (Orc War Beasts: Armor 5, Fire+Ice)", () => {
      // Orc War Beasts: Armor 5, Fire + Ice resistances (2) → effective armor = 5 - 2 = 3
      // Physical attack not halved (enemy only has Fire + Ice resistance)
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_ORC_WAR_BEASTS);

      // Attack with 3 should defeat (effective armor = 3)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should reduce armor by 3 for enemy with 3 resistances (Altem Guardsmen: Armor 7, all)", () => {
      // Altem Guardsmen: Armor 7, Physical + Fire + Ice resistances (3) → effective armor = 7 - 3 = 4
      // Physical attack IS halved (Physical resistance), so need 8 physical → 4 effective
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_ALTEM_GUARDSMEN);

      // Attack with 8 physical → halved to 4 → meets armor of 4
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 8 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("armor floor", () => {
    it("should not reduce armor below minimum of 1", () => {
      // Diggers: Armor 3, 0 resistances
      // Resistance Break adds 0 reduction (0 resistances)
      // But add extra -4 armor modifier via Tremor simulation → 3 - 4 = -1, clamped to 1
      const player = createTovakPlayer();
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Apply Resistance Break modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_TOVAK_RESISTANCE_BREAK, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
          perResistance: true,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Additional -4 modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_tremor" as any, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -4,
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skip" as any, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Advance to attack phase
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      state = engine.processAction(state, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Armor = 3 - 0 (0 resistances) - 4 = -1, clamped to 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("integration with full skill flow", () => {
    it("should apply armor reduction via USE_SKILL auto-resolve (single target)", () => {
      // With only 1 eligible enemy, the choice is auto-resolved
      // Freezers: Armor 7, 1 resistance (Fire) → effective armor = 6
      const player = createTovakPlayer();
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FREEZERS],
      }).state;

      // Activate Resistance Break - auto-resolves with single target
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(afterSkill.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );
      expect(afterSkill.state.players[0].pendingChoice).toBeNull();

      // Skip enemy attack and advance to attack phase
      const enemyInstanceId = afterSkill.state.combat!.enemies[0].instanceId;
      let advanceState = addModifier(afterSkill.state, {
        source: { type: SOURCE_SKILL, skillId: "test_skip" as any, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: afterSkill.state.round,
        createdByPlayerId: "player1",
      });

      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(advanceState.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Effective armor = 7 - 1 = 6
      const result = engine.processAction(advanceState, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should apply armor reduction via USE_SKILL → RESOLVE_CHOICE (multiple targets)", () => {
      // 2 enemies → player must choose
      const player = createTovakPlayer();
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_ORC_WAR_BEASTS],
      }).state;

      // Activate Resistance Break
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(afterSkill.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();
      expect(afterSkill.state.players[0].pendingChoice?.options).toHaveLength(2);

      // Select the second enemy (Orc War Beasts, index 1)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      expect(afterChoice.state.players[0].pendingChoice).toBeNull();

      // Skip enemy attacks and advance to attack phase
      const enemy0Id = afterChoice.state.combat!.enemies[0].instanceId;
      const enemy1Id = afterChoice.state.combat!.enemies[1].instanceId;
      let advanceState = afterChoice.state;
      for (const id of [enemy0Id, enemy1Id]) {
        advanceState = addModifier(advanceState, {
          source: { type: SOURCE_SKILL, skillId: "test_skip" as any, playerId: "player1" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: id },
          effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
          createdAtRound: advanceState.round,
          createdByPlayerId: "player1",
        });
      }

      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      advanceState = engine.processAction(advanceState, "player1", { type: END_COMBAT_PHASE_ACTION }).state;
      expect(advanceState.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Orc War Beasts: Armor 5 - 2 (Fire + Ice resistances) = 3
      const result = engine.processAction(advanceState, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemy1Id],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[1].isDefeated).toBe(true);
    });
  });

  describe("stacking with Expose", () => {
    it("should stack with Expose when Resistance Break is used first", () => {
      // Orc War Beasts: Armor 5, Fire + Ice resistances (2)
      // Resistance Break: armor -1 per resistance (2) → effective armor = 3
      // Physical attack not halved (no physical resistance)
      const { state, enemyInstanceId } = setupCombatWithResistanceBreak(engine, ENEMY_ORC_WAR_BEASTS);

      // Attack with 3 should defeat (effective armor = 3)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });
});
