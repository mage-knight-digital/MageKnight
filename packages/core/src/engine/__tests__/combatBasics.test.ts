/**
 * Combat Basics Tests
 *
 * Tests for entering combat, phase progression, and combat end conditions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  COMBAT_STARTED,
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  ENEMY_ORC,
  ENEMY_WOLF,
  ENEMY_PROWLERS,
  COMBAT_TYPE_RANGED,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

describe("Combat Basics", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("ENTER_COMBAT", () => {
    it("should start combat with enemies", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      });

      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: COMBAT_STARTED })
      );
    });

    it("should start combat with multiple enemies", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC, ENEMY_WOLF],
      });

      expect(result.state.combat?.enemies).toHaveLength(2);
      expect(result.state.combat?.enemies[0].enemyId).toBe(ENEMY_ORC);
      expect(result.state.combat?.enemies[1].enemyId).toBe(ENEMY_WOLF);
    });

    it("should fail to enter combat when already in combat", () => {
      let state = createTestGameState();

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Try to enter combat again
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF],
      });

      // Should fail with invalid action event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Already in combat",
        })
      );
    });
  });

  describe("Phase progression", () => {
    it("should advance through all phases", () => {
      let state = createTestGameState();

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Skip to Block
      const result1 = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result1.state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);
      expect(result1.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_PHASE_CHANGED,
          previousPhase: COMBAT_PHASE_RANGED_SIEGE,
          newPhase: COMBAT_PHASE_BLOCK,
        })
      );

      // Skip to Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage from the enemy (mandatory before advancing)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // Now advance to Attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });

  describe("Combat end", () => {
    it("should end combat with victory when all enemies defeated", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified, fame 2) to test ranged attacks
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Defeat enemy in Ranged/Siege phase with ranged attack
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      // Block phase - skip (enemy defeated)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign Damage phase - skip (enemy defeated)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - skip
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 1,
          enemiesSurvived: 0,
          totalFameGained: 2, // Prowlers give 2 fame
        })
      );
    });

    it("should end combat without victory when enemies survive (blocked)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - skip without attacking
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End combat without defeating enemy
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
          enemiesDefeated: 0,
          enemiesSurvived: 1,
        })
      );
    });
  });
});
