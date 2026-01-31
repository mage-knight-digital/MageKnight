/**
 * Tests for Resistance Break skill (Tovak)
 *
 * Skill effect: Target enemy gets Armor -1 for each resistance it has.
 * Minimum armor is 1. Cannot target enemies with Arcane Immunity.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  COMBAT_TYPE_MELEE,
  ELEMENT_FIRE,
  // Enemies with different resistance counts
  ENEMY_DIGGERS, // 0 resistances, armor 3
  ENEMY_IRONCLADS, // 1 resistance (physical), armor 3
  ENEMY_ICE_GOLEMS, // 2 resistances (ice, physical), armor 4
  ENEMY_ALTEM_GUARDSMEN, // 3 resistances (physical, fire, ice), armor 7
  ENEMY_SORCERERS, // 0 resistances, armor 6, has ARCANE IMMUNITY
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_RESISTANCE_BREAK } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { getEffectiveEnemyArmor, addModifier } from "../modifiers.js";
import {
  SOURCE_SKILL,
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
  EFFECT_ENEMY_SKIP_ATTACK,
} from "../modifierConstants.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Helper to get effective armor for an enemy in combat state.
 * Looks up the base armor and resistance count from combat state.
 */
function getEnemyEffectiveArmor(state: GameState, enemyInstanceId: string): number {
  const enemy = state.combat?.enemies.find((e) => e.instanceId === enemyInstanceId);
  if (!enemy) throw new Error(`Enemy not found: ${enemyInstanceId}`);
  return getEffectiveEnemyArmor(
    state,
    enemyInstanceId,
    enemy.definition.armor,
    enemy.definition.resistances.length
  );
}

/**
 * Helper to get first enemy instance ID after entering combat.
 * Throws if combat state is not initialized.
 */
function getFirstEnemyInstanceId(state: GameState): string {
  const combat = state.combat;
  if (!combat) throw new Error("Combat state not initialized");
  const firstEnemy = combat.enemies[0];
  if (!firstEnemy) throw new Error("No enemies in combat");
  return firstEnemy.instanceId;
}

/**
 * Helper to get enemy instance ID by enemy ID.
 * Throws if enemy is not found.
 */
function getEnemyInstanceIdByEnemyId(state: GameState, enemyId: string): string {
  const combat = state.combat;
  if (!combat) throw new Error("Combat state not initialized");
  const enemy = combat.enemies.find((e) => e.enemyId === enemyId);
  if (!enemy) throw new Error(`Enemy not found: ${enemyId}`);
  return enemy.instanceId;
}

describe("Resistance Break skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation and targeting", () => {
    it("should show as activatable when in combat and skill is learned", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const validActions = getValidActions(state, "player1");
      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_RESISTANCE_BREAK,
        })
      );
    });

    it("should not show as activatable when not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      // Either no skills, or skill not in list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_RESISTANCE_BREAK,
          })
        );
      }
    });

    it("should reject activation when not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should present enemy choice when activated in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with multiple enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_IRONCLADS],
      }).state;

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Should have pending choice for enemy selection
      const afterPlayer = result.state.players[0];
      expect(afterPlayer.pendingChoice).not.toBeNull();
      expect(afterPlayer.pendingChoice?.options.length).toBe(2);
    });

    it("should exclude Arcane Immune enemies from targeting", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (Arcane Immune), Diggers, and Ironclads
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS, ENEMY_DIGGERS, ENEMY_IRONCLADS],
      }).state;

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Should have 2 choices (Diggers and Ironclads), not Sorcerers
      const afterPlayer = result.state.players[0];
      expect(afterPlayer.pendingChoice).not.toBeNull();
      expect(afterPlayer.pendingChoice?.options.length).toBe(2);
      // pendingChoice.options is an array of CardEffect (ResolveCombatEnemyTargetEffect)
      // Each has enemyName property
      const enemyNames = afterPlayer.pendingChoice?.options.map((opt) => {
        if ("enemyName" in opt) return opt.enemyName;
        return "";
      }) ?? [];
      // Verify Sorcerers is NOT in the options
      expect(enemyNames).not.toContain("Sorcerers");
    });

    it("should auto-resolve when only one valid target exists", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with only one enemy
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_IRONCLADS],
      }).state;

      // Activate skill - should auto-resolve
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Should emit SKILL_USED and apply modifier directly
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_RESISTANCE_BREAK,
        })
      );

      // No pending choice needed
      const afterPlayer = result.state.players[0];
      expect(afterPlayer.pendingChoice).toBeNull();

      // Skill should be on cooldown
      expect(afterPlayer.skillCooldowns.usedThisTurn).toContain(
        SKILL_TOVAK_RESISTANCE_BREAK
      );
    });
  });

  describe("armor reduction calculations", () => {
    it("should reduce armor by 0 for enemy with 0 resistances", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Diggers: armor 3, 0 resistances
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill (auto-resolves)
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should still be 3)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(3);
    });

    it("should reduce armor by 1 for enemy with 1 resistance", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Ironclads: armor 3, 1 resistance (physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_IRONCLADS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill (auto-resolves)
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should be 3 - 1 = 2)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(2);
    });

    it("should reduce armor by 2 for enemy with 2 resistances", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Ice Golems: armor 4, 2 resistances (ice, physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEMS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill (auto-resolves)
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should be 4 - 2 = 2)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(2);
    });

    it("should reduce armor by 3 for enemy with 3 resistances", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Altem Guardsmen: armor 7, 3 resistances (physical, fire, ice)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ALTEM_GUARDSMEN],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill (auto-resolves)
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should be 7 - 3 = 4)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(4);
    });

    it("should enforce minimum armor of 1", () => {
      // We need an enemy where armor - resistances < 1
      // Ironclads has armor 3, 1 resistance - let's use a test case with manual state
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Ice Golems: armor 4, 2 resistances - let's first add another -3 armor modifier
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEMS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Pre-add a -3 armor modifier (simulating Expose or Tremor)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_expose" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -3,
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Now armor is 4 - 3 = 1. Resistance Break would try to reduce by 2 more.
      // Activate skill (auto-resolves)
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should be minimum 1, not -1)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(1);
    });
  });

  describe("attack resolution with reduced armor", () => {
    it("should defeat enemy using reduced armor value", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Ironclads: armor 3, 1 resistance (physical)
      // With Resistance Break: armor 3 - 1 = 2
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_IRONCLADS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      }).state;

      // Skip enemy attack to disable it for test simplicity
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skip" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Skip block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Skip assign damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 4 damage - need to use fire attack to bypass physical resistance
      // Physical resistance halves physical attacks, so use fire attack instead
      // With Resistance Break: armor = 3 - 1 = 2, need ≥ 2 fire attack to defeat
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_FIRE, value: 2 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Should defeat the enemy (effective armor = 3 - 1 = 2, fire attack 2)
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("stacking with other modifiers", () => {
    it("should stack with Expose (armor reduction applied additively)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Ice Golems: armor 4, 2 resistances
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEMS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Apply Expose first (simulating playing the spell)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_expose" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_ENEMY_STAT,
          stat: ENEMY_STAT_ARMOR,
          amount: -1,
          minimum: 1,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Then activate Resistance Break
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Get effective armor (should be 4 - 1 (Expose) - 2 (Resistance Break) = 1)
      const effectiveArmor = getEnemyEffectiveArmor(result.state, enemyInstanceId);
      expect(effectiveArmor).toBe(1);
    });
  });

  describe("cooldown and undo", () => {
    it("should add skill to usedThisTurn cooldown after use", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_RESISTANCE_BREAK);
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_RESISTANCE_BREAK], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should be undoable", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_IRONCLADS],
      }).state;

      const enemyInstanceId = getFirstEnemyInstanceId(state);

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // Verify armor is reduced
      expect(
        getEnemyEffectiveArmor(afterSkill.state, enemyInstanceId)
      ).toBe(2);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_TOVAK_RESISTANCE_BREAK);

      // Modifier should be removed
      expect(
        afterUndo.state.activeModifiers.some(
          (m) =>
            m.source.type === SOURCE_SKILL &&
            m.source.skillId === SKILL_TOVAK_RESISTANCE_BREAK
        )
      ).toBe(false);

      // Armor should be back to normal
      expect(
        getEnemyEffectiveArmor(afterUndo.state, enemyInstanceId)
      ).toBe(3);
    });
  });

  describe("enemy selection with RESOLVE_CHOICE", () => {
    it("should apply modifier to selected enemy when choice is resolved", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_RESISTANCE_BREAK],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with multiple enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_IRONCLADS],
      }).state;

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_RESISTANCE_BREAK,
      });

      // SKILL_USED event is emitted when skill is first activated
      expect(afterSkill.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_RESISTANCE_BREAK,
        })
      );

      // Should have pending choice
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Resolve choice - select Ironclads (index 1)
      const result = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Pending choice should be cleared
      expect(result.state.players[0].pendingChoice).toBeNull();

      // Only Ironclads should have reduced armor
      const ironcladId = getEnemyInstanceIdByEnemyId(result.state, ENEMY_IRONCLADS);
      const diggerId = getEnemyInstanceIdByEnemyId(result.state, ENEMY_DIGGERS);

      expect(getEnemyEffectiveArmor(result.state, ironcladId)).toBe(2); // 3 - 1
      expect(getEnemyEffectiveArmor(result.state, diggerId)).toBe(3); // unchanged
    });
  });
});
