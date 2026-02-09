/**
 * Tests for Dueling skill (Wolfhawk)
 *
 * Once per turn, during Block Phase:
 * Block 1. Attack 1 versus the same enemy in the Attack phase.
 * If you do not use any unit ability to block, attack or affect this enemy
 * nor assign damage from it to any unit, you gain 1 more Fame for defeating it.
 *
 * Key rules:
 * - Block Phase only - enemy must be alive and attacking (S1, S4)
 * - Block 1 doesn't need to successfully block to qualify for Attack 1 or Fame (S1)
 * - Unit resistance absorption still counts as unit involvement (S3)
 * - Can't use if enemy prevented from attacking (Whirlwind/Chill) (S4)
 * - CAN use if attack reduced to 0 by Swift Reflexes (S4)
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
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_DUELING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  EFFECT_DUELING_TARGET,
  EFFECT_ENEMY_SKIP_ATTACK,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import { applyDuelingAttackBonus, resolveDuelingFameBonus, markDuelingUnitInvolvement, markDuelingUnitInvolvementFromAbility } from "../combat/duelingHelpers.js";
import { removeDuelingEffect } from "../commands/skills/duelingEffect.js";
import type { DuelingTargetModifier } from "../../types/modifiers.js";

function createWolfhawkPlayer() {
  return createTestPlayer({
    hero: Hero.Wolfhawk,
    skills: [SKILL_WOLFHAWK_DUELING],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
  });
}

describe("Dueling skill", () => {
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
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_DUELING,
        })
      );
    });

    it("should reject if not in block phase (ranged/siege)", () => {
      const player = createWolfhawkPlayer();
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
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
        skillId: SKILL_WOLFHAWK_DUELING,
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
        skillId: SKILL_WOLFHAWK_DUELING,
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
        skills: [SKILL_WOLFHAWK_DUELING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_DUELING],
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
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when enemy is prevented from attacking (skip attack)", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;

      // Apply skip-attack to the only enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Block 1 effect", () => {
    it("should add Block 1 to combatAccumulator on activation", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });
      const blockBefore = state.players[0].combatAccumulator.block;

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      const blockAfter = result.state.players[0].combatAccumulator.block;
      expect(blockAfter).toBe(blockBefore + 1);
    });

    it("should add physical block element", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });
      const physicalBefore = state.players[0].combatAccumulator.blockElements.physical;

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      const physicalAfter = result.state.players[0].combatAccumulator.blockElements.physical;
      expect(physicalAfter).toBe(physicalBefore + 1);
    });
  });

  describe("enemy selection", () => {
    it("should present a pending choice to select an enemy", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(result.state.players[0].pendingChoice).toBeDefined();
      expect(result.state.players[0].pendingChoice!.skillId).toBe(SKILL_WOLFHAWK_DUELING);
    });

    it("should present options for each eligible enemy", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(result.state.players[0].pendingChoice!.options).toHaveLength(2);
    });

    it("should create DuelingTarget modifier when enemy is selected", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Activate Dueling
      const activateResult = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      // Select the enemy
      const selectResult = engine.processAction(activateResult.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have a DuelingTarget modifier
      const duelingMod = selectResult.state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      );
      expect(duelingMod).toBeDefined();
      const effect = duelingMod!.effect as DuelingTargetModifier;
      expect(effect.enemyInstanceId).toBe(enemyInstanceId);
      expect(effect.attackApplied).toBe(false);
      expect(effect.unitInvolved).toBe(false);
    });

    it("should exclude enemies prevented from attacking", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const firstEnemyId = state.combat!.enemies[0].instanceId;

      // Apply skip-attack to first enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: firstEnemyId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      // Should only have one option (second enemy)
      expect(result.state.players[0].pendingChoice!.options).toHaveLength(1);
    });
  });

  describe("deferred Attack 1", () => {
    it("should apply Attack 1 to combatAccumulator when entering Attack phase", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Add a DuelingTarget modifier (simulating post-activation)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const attackBefore = state.players[0].combatAccumulator.attack.normal;

      // Apply deferred attack bonus
      const updatedState = applyDuelingAttackBonus(state, "player1");

      const attackAfter = updatedState.players[0].combatAccumulator.attack.normal;
      expect(attackAfter).toBe(attackBefore + 1);
    });

    it("should add physical element to the attack", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const physicalBefore = state.players[0].combatAccumulator.attack.normalElements.physical;
      const updatedState = applyDuelingAttackBonus(state, "player1");
      const physicalAfter = updatedState.players[0].combatAccumulator.attack.normalElements.physical;

      expect(physicalAfter).toBe(physicalBefore + 1);
    });

    it("should mark attackApplied on the modifier", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const updatedState = applyDuelingAttackBonus(state, "player1");
      const duelingMod = updatedState.activeModifiers.find(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      );
      expect((duelingMod!.effect as DuelingTargetModifier).attackApplied).toBe(true);
    });

    it("should not apply attack bonus if enemy is already defeated", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Mark enemy as defeated
      state = {
        ...state,
        combat: {
          ...state.combat!,
          enemies: state.combat!.enemies.map((e) => ({
            ...e,
            isDefeated: true,
          })),
        },
      };

      const attackBefore = state.players[0].combatAccumulator.attack.normal;
      const updatedState = applyDuelingAttackBonus(state, "player1");
      expect(updatedState.players[0].combatAccumulator.attack.normal).toBe(attackBefore);
    });

    it("should not apply attack bonus twice", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Apply once
      const firstApply = applyDuelingAttackBonus(state, "player1");
      const attackAfterFirst = firstApply.players[0].combatAccumulator.attack.normal;

      // Apply again — should not change
      const secondApply = applyDuelingAttackBonus(firstApply, "player1");
      expect(secondApply.players[0].combatAccumulator.attack.normal).toBe(attackAfterFirst);
    });
  });

  describe("fame bonus", () => {
    it("should grant Fame +1 when target enemy is defeated without unit involvement", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Add DuelingTarget modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: true,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Mark enemy as defeated
      state = {
        ...state,
        combat: {
          ...state.combat!,
          enemies: state.combat!.enemies.map((e) => ({
            ...e,
            isDefeated: true,
          })),
        },
      };

      const fameBefore = state.players[0].fame;
      const result = resolveDuelingFameBonus(state, "player1");

      expect(result.fameGained).toBe(1);
      expect(result.state.players[0].fame).toBe(fameBefore + 1);
    });

    it("should NOT grant fame if unit was involved", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Add DuelingTarget modifier with unitInvolved = true
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: true,
          unitInvolved: true,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Mark enemy as defeated
      state = {
        ...state,
        combat: {
          ...state.combat!,
          enemies: state.combat!.enemies.map((e) => ({
            ...e,
            isDefeated: true,
          })),
        },
      };

      const result = resolveDuelingFameBonus(state, "player1");
      expect(result.fameGained).toBe(0);
    });

    it("should NOT grant fame if target enemy was not defeated", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK as typeof COMBAT_PHASE_ATTACK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Add DuelingTarget modifier (enemy NOT defeated)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: true,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const result = resolveDuelingFameBonus(state, "player1");
      expect(result.fameGained).toBe(0);
    });
  });

  describe("unit involvement tracking", () => {
    it("should mark unitInvolved when damage is assigned to unit from target enemy", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const updatedState = markDuelingUnitInvolvement(state, "player1", enemyInstanceId);
      const mod = updatedState.activeModifiers.find(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      );
      expect((mod!.effect as DuelingTargetModifier).unitInvolved).toBe(true);
    });

    it("should NOT mark unitInvolved if damage is from a different enemy", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS, ENEMY_GUARDSMEN]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const targetEnemyId = state.combat!.enemies[0].instanceId;
      const otherEnemyId = state.combat!.enemies[1].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: targetEnemyId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId: targetEnemyId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Mark involvement from a DIFFERENT enemy
      const updatedState = markDuelingUnitInvolvement(state, "player1", otherEnemyId);
      const mod = updatedState.activeModifiers.find(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      );
      expect((mod!.effect as DuelingTargetModifier).unitInvolved).toBe(false);
    });

    it("should mark unitInvolved when any unit combat ability is activated", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: {
          type: EFFECT_DUELING_TARGET,
          enemyInstanceId,
          attackApplied: false,
          unitInvolved: false,
        },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const updatedState = markDuelingUnitInvolvementFromAbility(state, "player1");
      const mod = updatedState.activeModifiers.find(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      );
      expect((mod!.effect as DuelingTargetModifier).unitInvolved).toBe(true);
    });
  });

  describe("valid actions", () => {
    it("should show skill during block phase with attacking enemies", () => {
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
          skillId: SKILL_WOLFHAWK_DUELING,
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
        const dueling = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DUELING
        );
        expect(dueling).toBeUndefined();
      }
    });

    it("should not show skill when not in combat", () => {
      const player = createWolfhawkPlayer();
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const dueling = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DUELING
        );
        expect(dueling).toBeUndefined();
      }
    });

    it("should not show skill when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DUELING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_WOLFHAWK_DUELING],
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
        const dueling = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DUELING
        );
        expect(dueling).toBeUndefined();
      }
    });

    it("should not show skill when all enemies are prevented from attacking", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyId = state.combat!.enemies[0].instanceId;

      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: SKILL_WOLFHAWK_DUELING, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        const dueling = skills.activatable.find(
          (s) => s.skillId === SKILL_WOLFHAWK_DUELING
        );
        expect(dueling).toBeUndefined();
      }
    });
  });

  describe("undo", () => {
    it("should remove Block 1 and restore cooldown on undo", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate the skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      // Verify skill is on cooldown
      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_DUELING);

      // Verify Block 1 was added
      expect(result.state.players[0].combatAccumulator.block).toBe(
        state.players[0].combatAccumulator.block + 1
      );

      // Undo should be available (skill activation is reversible)
      const validActions = getValidActions(result.state, "player1");
      expect(validActions.turn.canUndo).toBe(true);
    });
  });

  describe("removeDuelingEffect", () => {
    it("should remove Block 1 from combatAccumulator", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate to add Block 1
      const activated = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      expect(activated.state.players[0].combatAccumulator.block).toBe(
        state.players[0].combatAccumulator.block + 1
      );

      // Remove effect
      const removed = removeDuelingEffect(activated.state, "player1");
      expect(removed.players[0].combatAccumulator.block).toBe(
        state.players[0].combatAccumulator.block
      );
    });

    it("should remove physical block element", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });
      const physicalBefore = state.players[0].combatAccumulator.blockElements.physical;

      const activated = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });

      const removed = removeDuelingEffect(activated.state, "player1");
      expect(removed.players[0].combatAccumulator.blockElements.physical).toBe(physicalBefore);
    });

    it("should not reduce block below 0", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      // Start with block already at 0
      const state = createTestGameState({ players: [player], combat });
      expect(state.players[0].combatAccumulator.block).toBe(0);

      // Call remove directly without activating (simulating edge case)
      const removed = removeDuelingEffect(state, "player1");
      expect(removed.players[0].combatAccumulator.block).toBe(0);
      expect(removed.players[0].combatAccumulator.blockElements.physical).toBe(0);
    });

    it("should clear pending choice from Dueling", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      // Activate to create pending choice
      const activated = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });
      expect(activated.state.players[0].pendingChoice).toBeDefined();
      expect(activated.state.players[0].pendingChoice!.skillId).toBe(SKILL_WOLFHAWK_DUELING);

      const removed = removeDuelingEffect(activated.state, "player1");
      expect(removed.players[0].pendingChoice).toBeNull();
    });

    it("should not clear pending choice from a different skill", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_DUELING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        pendingChoice: {
          cardId: null,
          skillId: "other_skill" as import("@mage-knight/shared").SkillId,
          unitInstanceId: null,
          options: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const removed = removeDuelingEffect(state, "player1");
      expect(removed.players[0].pendingChoice).toBeDefined();
      expect(removed.players[0].pendingChoice!.skillId).toBe("other_skill");
    });

    it("should remove DuelingTarget modifier", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });

      // Activate and select enemy to create modifier
      const activated = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_DUELING,
      });
      const selected = engine.processAction(activated.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify modifier exists
      expect(selected.state.activeModifiers.some(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      )).toBe(true);

      // Remove effect
      const removed = removeDuelingEffect(selected.state, "player1");
      expect(removed.activeModifiers.some(
        (m) => m.effect.type === EFFECT_DUELING_TARGET
      )).toBe(false);
    });

    it("should not remove modifiers from other skills or players", () => {
      const player = createWolfhawkPlayer();
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK as typeof COMBAT_PHASE_BLOCK,
      };
      let state = createTestGameState({ players: [player], combat });
      const enemyInstanceId = state.combat!.enemies[0].instanceId;

      // Add a non-Dueling modifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "other_skill" as import("@mage-knight/shared").SkillId, playerId: "player1" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      const modCountBefore = state.activeModifiers.length;
      const removed = removeDuelingEffect(state, "player1");

      // The non-Dueling modifier should still be there
      expect(removed.activeModifiers.length).toBe(modCountBefore);
      expect(removed.activeModifiers.some(
        (m) => m.effect.type === EFFECT_ENEMY_SKIP_ATTACK
      )).toBe(true);
    });
  });
});
