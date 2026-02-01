/**
 * Combat Elusive Ability Tests
 *
 * Tests for the Elusive enemy ability which provides dual armor values:
 * - High armor (armorElusive) used in Ranged/Siege phase
 * - High armor used in Attack phase if NOT fully blocked
 * - Low armor (armor) used in Attack phase ONLY if ALL attacks were blocked
 *
 * Test enemy: Shadow (armor: 4, armorElusive: 8, single attack)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  ENEMY_SHADOW,
  CARD_MARCH,
  ELEMENT_PHYSICAL,
  ELEMENT_COLD_FIRE,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  ABILITY_ELUSIVE,
  ATTACK_SOURCE_ACCUMULATOR,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { getBaseArmorForPhase } from "../modifiers/combat.js";
import { getValidActions } from "../validActions/index.js";

describe("Combat Elusive Ability", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Ranged/Siege phase - always uses high armor (8)", () => {
    it("should require 8 ranged attack to defeat Shadow in ranged/siege phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 8,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 8, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow (armor 4, elusive armor 8)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Attack with 8 ranged damage
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 8, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (8 damage >= 8 elusive armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });

    it("should fail with 7 ranged attack against Shadow (elusive armor is 8)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 7,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 7, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Attack with 7 ranged damage
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 7, element: ELEMENT_PHYSICAL }],
      });

      // Should fail (7 damage < 8 elusive armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 7,
          requiredAttack: 8,
        })
      );
    });
  });

  describe("Attack phase - blocked enemy uses low armor (4)", () => {
    it("should require only 4 melee attack to defeat Shadow if fully blocked", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 4,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 4, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow (attack 4, cold fire)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Block the Shadow's attack (attack 4 with cold fire)
      // Cold fire attacks need cold fire block for efficiency, but 8 physical will work
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Verify enemy is blocked
      expect(state.combat?.enemies[0].isBlocked).toBe(true);

      // Assign Damage phase - skip (enemy is blocked, no damage to assign)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 4 melee damage - should be enough since enemy is blocked
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_MELEE,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 4, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (4 damage >= 4 base armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Attack phase - unblocked enemy uses high armor (8)", () => {
    it("should require 8 melee attack to defeat Shadow if not blocked", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 10, // High armor to survive Shadow's attack (4 cold fire damage / 10 armor = no wounds)
        combatAccumulator: {
          attack: {
            normal: 8,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 8, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip block phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage to hero (required before attack phase)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // End assign damage phase to move to attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Verify enemy is NOT blocked
      expect(state.combat?.enemies[0].isBlocked).toBe(false);

      // Attack with 8 melee damage - should be required since enemy not blocked
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_MELEE,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 8, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (8 damage >= 8 elusive armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });

    it("should fail with 4 melee attack against unblocked Shadow (needs 8)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 10, // High armor to survive Shadow's attack
        combatAccumulator: {
          attack: {
            normal: 4,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 4, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip block phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage to hero (required before attack phase)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // End assign damage phase to move to attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Verify enemy is NOT blocked
      expect(state.combat?.enemies[0].isBlocked).toBe(false);

      // Attack with only 4 melee damage
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_MELEE,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 4, element: ELEMENT_PHYSICAL }],
      });

      // Should fail (4 damage < 8 elusive armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 4,
          requiredAttack: 8,
        })
      );
    });
  });

  describe("Armor modifiers apply to active armor value", () => {
    it("should apply armor reduction modifier to elusive armor in ranged phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 6,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 6, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow (elusive armor 8)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Add armor reduction modifier (-2 armor, like Tremor spell)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Attack with 6 ranged damage (8 elusive - 2 modifier = 6 effective)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 6, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (6 damage >= 6 modified elusive armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });

    it("should apply armor reduction modifier to base armor in attack phase when blocked", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 2,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 2, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow (base armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Add armor reduction modifier (-2 armor)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block the Shadow
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked, no damage to assign)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 2 melee damage (4 base - 2 modifier = 2 effective)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_MELEE,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 2, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (2 damage >= 2 modified base armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Elusive ability nullification", () => {
    it("should use base armor only if Elusive is nullified", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 4,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 4, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Shadow (elusive armor 8)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Add ability nullifier for Elusive
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_ELUSIVE },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Attack with only 4 ranged damage
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ source: ATTACK_SOURCE_ACCUMULATOR, value: 4, element: ELEMENT_PHYSICAL }],
      });

      // Should defeat the enemy (4 damage >= 4 base armor, Elusive nullified)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("getBaseArmorForPhase helper", () => {
    it("should return elusive armor for ranged/siege phase", () => {
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      const enemy = combat.enemies[0];
      if (!enemy) throw new Error("Expected enemy");
      const armor = getBaseArmorForPhase(enemy, COMBAT_PHASE_RANGED_SIEGE, state, "player1");

      expect(armor).toBe(8); // armorElusive
    });

    it("should return base armor for attack phase when blocked", () => {
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Manually mark enemy as blocked for unit test
      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      const updatedEnemies = combat.enemies.map(e => ({ ...e, isBlocked: true }));
      state = {
        ...state,
        combat: { ...combat, enemies: updatedEnemies, phase: COMBAT_PHASE_ATTACK },
      };

      const updatedCombat = state.combat;
      if (!updatedCombat) throw new Error("Expected combat state");
      const enemy = updatedCombat.enemies[0];
      if (!enemy) throw new Error("Expected enemy");
      const armor = getBaseArmorForPhase(enemy, COMBAT_PHASE_ATTACK, state, "player1");

      expect(armor).toBe(4); // base armor
    });

    it("should return elusive armor for attack phase when not blocked", () => {
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Set phase to attack without blocking
      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      state = {
        ...state,
        combat: { ...combat, phase: COMBAT_PHASE_ATTACK },
      };

      const updatedCombat = state.combat;
      if (!updatedCombat) throw new Error("Expected combat state");
      const enemy = updatedCombat.enemies[0];
      if (!enemy) throw new Error("Expected enemy");
      const armor = getBaseArmorForPhase(enemy, COMBAT_PHASE_ATTACK, state, "player1");

      expect(armor).toBe(8); // armorElusive (not blocked)
    });

    it("should return elusive armor for block phase (defensive display)", () => {
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Skip to block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      const enemy = combat.enemies[0];
      if (!enemy) throw new Error("Expected enemy");
      const armor = getBaseArmorForPhase(enemy, COMBAT_PHASE_BLOCK, state, "player1");

      expect(armor).toBe(8); // armorElusive shown during block phase
    });

    it("should return base armor if Elusive is nullified", () => {
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Add Elusive nullifier
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_ELUSIVE },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      const combat = state.combat;
      if (!combat) throw new Error("Expected combat state");
      const enemy = combat.enemies[0];
      if (!enemy) throw new Error("Expected enemy");
      const armor = getBaseArmorForPhase(enemy, COMBAT_PHASE_RANGED_SIEGE, state, "player1");

      expect(armor).toBe(4); // base armor (Elusive nullified)
    });
  });

  describe("ValidActions armor display", () => {
    it("should show elusive armor in ranged/siege phase valid actions", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Get valid actions - should show elusive armor
      const validActions = getValidActions(state, "player1");
      const enemyState = validActions.combat?.enemies?.[0];

      expect(enemyState?.armor).toBe(8); // Shows elusive armor
    });

    it("should show base armor in attack phase when blocked", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHADOW],
      }).state;

      // Skip ranged/siege
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 4 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked, no damage to assign)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Get valid actions - should show base armor since blocked
      const validActions = getValidActions(state, "player1");
      const enemyState = validActions.combat?.enemies?.[0];

      expect(enemyState?.armor).toBe(4); // Shows base armor (blocked)
    });
  });
});
