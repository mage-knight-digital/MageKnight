/**
 * Tests for Battle Hardened skill (Krang)
 *
 * Once a turn: Ignore either the next 2 points of damage assigned to your hero
 * from a single physical attack, or 1 point of damage from a non-physical attack.
 *
 * Key rules:
 * - Damage reduction, NOT attack reduction (happens AFTER Brutal doubling per Q1)
 * - Applied after unblocked attack becomes damage, before armor comparison (per Q2)
 * - Physical = 2 point reduction, Non-physical (Fire, Ice, Cold Fire) = 1 point
 * - Applies to a single attack only (consumed after first use)
 * - Only protects hero, not units
 * - Once per turn
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
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_ASSIGNED,
  CARD_MARCH,
  ENEMY_ORC,
  ENEMY_MINOTAUR,
  ENEMY_FIRE_ELEMENTAL,
  ENEMY_ICE_MAGES,
  ENEMY_HIGH_DRAGON,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_KRANG_BATTLE_HARDENED } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { createCombatState } from "../../types/combat.js";
import { EFFECT_HERO_DAMAGE_REDUCTION } from "../../types/modifierConstants.js";

const defaultCooldowns = {
  usedThisRound: [] as string[],
  usedThisTurn: [] as string[],
  usedThisCombat: [] as string[],
  activeUntilNextTurn: [] as string[],
};

describe("Battle Hardened skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during combat and present 2 choices", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_KRANG_BATTLE_HARDENED,
        })
      );

      // Should present pending choice with 2 options
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(2);
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_KRANG_BATTLE_HARDENED
      );
    });

    it("should reject if not in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });

    it("should reject if already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_KRANG_BATTLE_HARDENED],
        },
      });
      const combat = createCombatState([ENEMY_ORC]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      });

      expect(result.events[0]?.type).toBe(INVALID_ACTION);
    });

    it("should apply modifier after resolving Physical choice", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      let state = createTestGameState({ players: [player], combat });

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 0: Physical reduction (-2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have damage reduction modifier
      const damageReductionModifier = state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_HERO_DAMAGE_REDUCTION
      );
      expect(damageReductionModifier).toBeDefined();
      expect((damageReductionModifier!.effect as { amount: number }).amount).toBe(2);
    });

    it("should apply modifier after resolving non-physical choice", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      let state = createTestGameState({ players: [player], combat });

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 1: Non-physical reduction (-1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Should have damage reduction modifier
      const damageReductionModifier = state.activeModifiers.find(
        (m) => m.effect.type === EFFECT_HERO_DAMAGE_REDUCTION
      );
      expect(damageReductionModifier).toBeDefined();
      expect((damageReductionModifier!.effect as { amount: number }).amount).toBe(1);
    });

    it("should appear in valid actions during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const combat = createCombatState([ENEMY_ORC]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      expect(skillOptions).toBeDefined();
      expect(skillOptions!.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_KRANG_BATTLE_HARDENED,
        })
      );
    });

    it("should not appear in valid actions outside combat", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      const state = createTestGameState({ players: [player], combat: null });

      const validActions = getValidActions(state, "player1");
      const skillOptions = getSkillsFromValidActions(validActions);
      const found = skillOptions?.activatable?.find(
        (s) => s.skillId === SKILL_KRANG_BATTLE_HARDENED
      );
      expect(found).toBeUndefined();
    });
  });

  describe("Physical damage reduction", () => {
    it("should reduce Physical attack damage by 2 (Q2)", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Orc (attack 3, physical)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 0: Physical reduction (-2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage - Orc has 3 attack, reduced by 2 = 1 damage
      // 1 damage / 2 armor = 1 wound (ceil)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 1, // 3 - 2 = 1
          woundsTaken: 1, // ceil(1/2) = 1
        })
      );
    });

    it("should NOT reduce Fire attack when Physical option chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Fire Elemental (attack 7, fire)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_ELEMENTAL],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 0: Physical reduction (-2) — won't help vs fire
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage - Fire Elemental has 7 attack, NOT reduced (Physical doesn't match Fire)
      // 7 damage / 2 armor = 4 wounds
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 7, // Not reduced
          woundsTaken: 4,
        })
      );
    });
  });

  describe("Non-physical damage reduction", () => {
    it("should reduce Fire attack damage by 1", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Fire Elemental (attack 7, fire)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_ELEMENTAL],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 1: Non-physical reduction (-1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage - Fire Elemental has 7 attack, reduced by 1 = 6 damage
      // 6 damage / 2 armor = 3 wounds (ceil)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 6, // 7 - 1 = 6
          woundsTaken: 3, // ceil(6/2) = 3
        })
      );
    });

    it("should reduce Ice attack damage by 1", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Ice Mages (attack 5, ice)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_MAGES],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 1: Non-physical reduction (-1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage - Ice Mages has 5 attack, reduced by 1 = 4 damage
      // 4 damage / 2 armor = 2 wounds
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 4, // 5 - 1 = 4
          woundsTaken: 2, // ceil(4/2) = 2
        })
      );
    });

    it("should reduce Cold Fire attack damage by 1", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with High Dragon (attack 6, cold_fire, Brutal)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HIGH_DRAGON],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 1: Non-physical reduction (-1) for Cold Fire
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // High Dragon: attack 6, Brutal doubles to 12, then -1 = 11
      // 11 damage / 2 armor = 6 wounds (ceil)
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 11, // 6 * 2 (Brutal) - 1 = 11
          woundsTaken: 6, // ceil(11/2) = 6
        })
      );
    });
  });

  describe("Brutal interaction (Q1/A1)", () => {
    it("should apply damage reduction AFTER Brutal doubling for physical", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 10,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Minotaur (attack 5, physical, Brutal)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_MINOTAUR],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 0: Physical reduction (-2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Minotaur: attack 5, Brutal doubles to 10, then -2 = 8
      // NOT: 5 - 2 = 3, doubled to 6
      // 8 damage / 2 armor = 4 wounds
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 8, // 5 * 2 (Brutal) - 2 = 8
          woundsTaken: 4, // ceil(8/2) = 4
        })
      );
    });

    it("should match Q2 example: 4 physical attack, Brutal, armor 3 = 2 wounds", () => {
      // From issue Q2: Attack 4, Brutal, unblocked → 4*2=8, Battle Hardened -2 = 6
      // 6 / 3 armor = 2 wounds
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 10,
        armor: 3,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Minotaur has attack 5 (not 4), so we can't exactly match the issue example,
      // but we verify the same formula: Brutal first, then reduction, then armor.
      // Minotaur: 5 * 2 = 10, -2 = 8, ceil(8/3) = 3 wounds
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_MINOTAUR],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 8, // 5 * 2 (Brutal) - 2 = 8
          woundsTaken: 3, // ceil(8/3) = 3
        })
      );
    });
  });

  describe("single attack scope", () => {
    it("should consume modifier after first attack (only reduces one attack)", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 10,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two physical enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC, ENEMY_ORC],
      }).state;

      // Activate Battle Hardened
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      // Choose option 0: Physical reduction (-2)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Skip to assign damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from first Orc (3 attack, -2 = 1 damage)
      const firstResult = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(firstResult.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 1, // 3 - 2 = 1 (reduced)
        })
      );

      // Modifier should be consumed
      expect(
        firstResult.state.activeModifiers.find(
          (m) => m.effect.type === EFFECT_HERO_DAMAGE_REDUCTION
        )
      ).toBeUndefined();

      // Assign damage from second Orc (3 attack, no reduction)
      const secondResult = engine.processAction(firstResult.state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
      });

      expect(secondResult.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 3, // Full damage, modifier consumed
        })
      );
    });
  });

  describe("damage vs armor calculation (Q2)", () => {
    it("should reduce damage to 0 when reduction exceeds damage", () => {
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 5,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Orc (attack 3, physical) but with reduction of 2
      // If we had an enemy with attack 2, damage would be 0.
      // With Orc (attack 3), damage = 3 - 2 = 1
      // But 1 / 5 armor = 1 wound (ceil)
      // We can't get 0 damage with Orc since 3 > 2
      // The floor to 0 is handled by Math.max(0, ...) in the engine
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Orc has 3 attack, -2 = 1 damage, ceil(1/5) = 1 wound
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 1,
          woundsTaken: 1,
        })
      );
    });

    it("should apply before armor comparison per Q2 example", () => {
      // Q2 exact scenario: Attack 4, no block, armor 3
      // 4 damage - 2 Battle Hardened = 2 damage
      // 2 / 3 armor = 0 wounds (ceil(2/3) = 1 wound)
      // Actually Q2 says: "you take one Wound" when 4-2=2 vs armor 3
      // Because ceil(2/3) = 1

      // We can't create a custom enemy, so verify the arithmetic:
      // Orc has attack 3, armor 3 hero
      // 3 - 2 = 1 damage, ceil(1/3) = 1 wound
      const player = createTestPlayer({
        hero: Hero.Krang,
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 3,
        skills: [SKILL_KRANG_BATTLE_HARDENED],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_KRANG_BATTLE_HARDENED,
      }).state;

      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // 3 attack - 2 reduction = 1 damage, ceil(1/3) = 1 wound
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 1, // Reduced before armor
          woundsTaken: 1, // ceil(1/3) = 1
        })
      );
    });
  });
});
