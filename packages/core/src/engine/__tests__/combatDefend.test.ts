/**
 * Combat Defend Ability Tests
 *
 * Tests for the Defend enemy ability which allows enemies to boost
 * the armor of other enemies (or themselves) when attacked.
 *
 * Rules:
 * - Enemies with Defend add their Defend value to attacked enemy's Armor
 * - Only ONE Defend bonus can be applied to each enemy
 * - Each Defend enemy can only use its ability ONCE per combat
 * - Defend triggers when Attack points are assigned (not Tremor/other effects)
 * - Defend bonus persists for entire combat after being applied
 * - Defend bonus persists even after the defending enemy dies
 * - Defend can apply to self when Defend enemy is attacked
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  CARD_MARCH,
  ELEMENT_PHYSICAL,
  COMBAT_TYPE_MELEE,
  ABILITY_DEFEND,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ABILITY_NULLIFIER,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import type { EnemyDefinition, EnemyId } from "@mage-knight/shared";
import { ENEMIES } from "@mage-knight/shared";
import { getValidActions } from "../validActions/index.js";
import type { GameState } from "../../state/GameState.js";

// Create a test enemy with Defend ability (attack: 0 to allow easy phase skip)
function createTestEnemyWithDefend(
  id: string,
  armor: number,
  defendValue: number
): void {
  (ENEMIES as Record<string, EnemyDefinition>)[id] = {
    id: id as EnemyId,
    name: `Test Defend Enemy (${id})`,
    color: "brown",
    attack: 0, // No attack - allows skipping damage assignment
    attackElement: ELEMENT_PHYSICAL,
    armor,
    fame: 2,
    resistances: [],
    abilities: [ABILITY_DEFEND],
    defend: defendValue,
  };
}

// Create a test enemy without Defend ability (attack: 0 to allow easy phase skip)
function createTestEnemy(id: string, armor: number): void {
  (ENEMIES as Record<string, EnemyDefinition>)[id] = {
    id: id as EnemyId,
    name: `Test Enemy (${id})`,
    color: "brown",
    attack: 0, // No attack - allows skipping damage assignment
    attackElement: ELEMENT_PHYSICAL,
    armor,
    fame: 2,
    resistances: [],
    abilities: [],
  };
}

/**
 * Helper to skip all phases to reach ATTACK phase
 * Combat phases: RANGED_SIEGE -> BLOCK -> ASSIGN_DAMAGE -> ATTACK
 */
function skipToAttackPhase(
  engine: MageKnightEngine,
  state: GameState,
  playerId: string
): GameState {
  // RANGED_SIEGE -> BLOCK
  state = engine.processAction(state, playerId, {
    type: END_COMBAT_PHASE_ACTION,
  }).state;
  // BLOCK -> ASSIGN_DAMAGE
  state = engine.processAction(state, playerId, {
    type: END_COMBAT_PHASE_ACTION,
  }).state;
  // ASSIGN_DAMAGE -> ATTACK
  state = engine.processAction(state, playerId, {
    type: END_COMBAT_PHASE_ACTION,
  }).state;
  return state;
}

describe("Combat Defend Ability", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    // Create test enemies for each test
    createTestEnemyWithDefend("test_defender_1", 3, 1); // Defend 1, Armor 3
    createTestEnemyWithDefend("test_defender_2", 4, 2); // Defend 2, Armor 4
    createTestEnemy("test_basic_enemy", 4); // No Defend, Armor 4
  });

  describe("Self-defense scenario", () => {
    it("should add Defend bonus to self when lone Defend enemy is attacked", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Defend enemy (armor 4, defend 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_defender_2" as EnemyId],
      }).state;

      // Skip to attack phase
      state = skipToAttackPhase(engine, state, "player1");
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 5 damage (armor 4 + defend 2 = 6 needed)
      // Should fail since 5 < 6
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should fail - armor 4 + defend 2 = 6, attack is only 5
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 6,
        })
      );
    });

    it("should defeat self-defending enemy with sufficient attack", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // Attack with 6 damage (armor 4 + defend 2 = 6 needed)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Defending another enemy", () => {
    it("should add Defend bonus when attacking a non-Defend enemy with Defend enemy present", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with basic enemy (armor 4) and Defend enemy (defend 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_basic_enemy" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // Attack the basic enemy with 5 damage (armor 4 + defend 2 = 6 needed)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should fail - Defend enemy adds 2 to armor
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 6,
        })
      );
    });
  });

  describe("Defend usage tracking", () => {
    it("should only use each Defend ability once per combat", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two basic enemies and one Defend enemy
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [
          "test_basic_enemy" as EnemyId,
          "test_basic_enemy" as EnemyId,
          "test_defender_1" as EnemyId,
        ],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // First attack: enemy_0 (armor 4 + defend 1 = 5)
      let result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // First attack should succeed (5 >= 5)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
      state = result.state;

      // Second attack: enemy_1 (armor 4, no more Defend available)
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Second attack should succeed with just armor 4 (Defend already used)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_1",
        })
      );
    });
  });

  describe("Multiple Defend enemies", () => {
    it("should use each Defend enemy once when attacking sequentially", () => {
      // Two Defend enemies: when attacking enemy_0, it defends itself with defend 1.
      // Then when attacking enemy_1, it must defend itself with defend 2.
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two Defend enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_defender_1" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // Attack enemy_0: armor 3, self-defends with defend 1 = 4 needed
      let result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should fail - self-defense: armor 3 + defend 1 = 4
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 4,
        })
      );
      state = result.state;

      // Now attack enemy_1: armor 4, enemy_0 already used its Defend,
      // so enemy_1 defends itself with defend 2 = 6 needed
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should fail - self-defense: armor 4 + defend 2 = 6
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 6,
        })
      );
    });
  });

  describe("Defend bonus persistence", () => {
    it("should persist Defend bonus even after defender is killed", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with basic enemy (armor 4) and Defend enemy (defend 2, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_basic_enemy" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // First attack: kill the Defend enemy (enemy_1)
      // Defend enemy defends itself: armor 4 + defend 2 = 6
      let result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_1",
        })
      );
      state = result.state;

      // Second attack: basic enemy should NOT have Defend bonus
      // (Defend enemy used its ability on itself, so basic enemy gets no bonus)
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Should succeed with just armor 4 (no Defend bonus - defender used on self)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });

    it("should persist Defend bonus on target after defender dies", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with basic enemy (armor 4) and Defend enemy (defend 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_basic_enemy" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // First attack: fail attack on basic enemy (armor 4 + defend 2 = 6)
      // This assigns the Defend bonus to basic enemy
      let result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 6,
        })
      );
      state = result.state;

      // Verify Defend bonus was assigned
      expect(state.combat?.defendBonuses["enemy_0"]).toBe(2);

      // Second attack: kill the Defend enemy
      // Defender already used its ability on enemy_0, so it can't defend itself
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_1",
        })
      );
      state = result.state;

      // Third attack: basic enemy still has Defend bonus (persists after defender death)
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Should FAIL because Defend bonus persists (5 < 6)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          requiredAttack: 6,
        })
      );
    });
  });

  describe("Defend ability nullification", () => {
    it("should not apply Defend bonus if Defend ability is nullified", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Defend enemy (armor 4, defend 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_defender_2" as EnemyId],
      }).state;

      // Nullify Defend ability on this enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_DEFEND },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      state = skipToAttackPhase(engine, state, "player1");

      // Attack with 4 damage (just armor, no Defend bonus)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should succeed - Defend is nullified, so only armor 4 needed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Defend enemy killed before using ability", () => {
    it("should not apply Defend if Defend enemy is defeated before target is attacked", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with basic enemy (armor 4) and Defend enemy (defend 2, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_basic_enemy" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // First: kill the Defend enemy directly
      // Defend enemy defends itself: armor 4 + defend 2 = 6
      let result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_1",
        })
      );
      state = result.state;

      // Now attack basic enemy - no Defend available (defender died using ability on self)
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Attack should succeed with just armor 4
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("ValidActions armor display", () => {
    it("should show base armor in valid actions (Defend applies on attack)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        deck: [CARD_MARCH],
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with basic enemy (armor 4) and Defend enemy (defend 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: ["test_basic_enemy" as EnemyId, "test_defender_2" as EnemyId],
      }).state;

      state = skipToAttackPhase(engine, state, "player1");

      // Get valid actions
      const validActions = getValidActions(state, "player1");

      // In attack phase, enemies should show their armor values
      // The Defend bonus won't be pre-applied in validActions because it only
      // triggers on attack declaration. ValidActions shows base effective armor.
      expect(validActions.mode).toBe("combat");
      expect(validActions.combat.enemies).toBeDefined();

      // Basic enemy should show armor 4 (base)
      const basicEnemy = validActions.combat.enemies?.find(
        (e) => e.enemyInstanceId === "enemy_0"
      );
      expect(basicEnemy?.armor).toBe(4);

      // Defend enemy should show armor 4 (base)
      const defendEnemy = validActions.combat.enemies?.find(
        (e) => e.enemyInstanceId === "enemy_1"
      );
      expect(defendEnemy?.armor).toBe(4);
    });
  });
});
