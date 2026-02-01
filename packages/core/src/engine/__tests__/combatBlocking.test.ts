/**
 * Combat Blocking Tests
 *
 * Tests for blocking mechanics including basic blocking, Swift ability effects,
 * and elemental block efficiency.
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
  INVALID_ACTION,
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  ENEMY_DEFEATED,
  ENEMY_ORC,
  ENEMY_WOLF_RIDERS,
  ENEMY_FIRE_MAGE,
  ENEMY_ALTEM_MAGES,
  COMBAT_TYPE_RANGED,
  ELEMENT_PHYSICAL,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ABILITY_SWIFT,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ABILITY_NULLIFIER,
} from "../../types/modifierConstants.js";

describe("Combat Blocking", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Basic blocking", () => {
    it("should block enemy with sufficient block value", () => {
      let state = createTestGameState();

      // Enter combat with Orc (attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 3
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 3,
        })
      );
    });

    it("should block enemy with more than required block", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 5 (Orc needs 3)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 5 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should fail block with insufficient value", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 2 (Orc needs 3)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 2,
          requiredBlock: 3,
        })
      );
    });

    it("should reject block in wrong phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Still in Ranged/Siege phase, try to block
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Can only block during Block phase",
        })
      );
    });
  });

  describe("Swift ability", () => {
    it("should require double block against swift enemy", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      // Swift doubles block requirement: need 6 block, not 3
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to block with 4 (would be enough without Swift, but not with it)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should fail - need 6 block (3 * 2) due to Swift
      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 4,
          requiredBlock: 6, // 3 * 2 = 6 due to Swift
        })
      );
    });

    it("should block swift enemy with double block value", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with 6 (exactly double the base attack of 3)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 6 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should succeed
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 6,
        })
      );
    });

    it("should use normal block if swift is nullified", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Add ability nullifier for Swift on this enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_SWIFT },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with 3 (normal block, Swift is nullified)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should succeed - Swift is nullified, only need base attack of 3
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 3,
        })
      );
    });

    it("should NOT affect ranged/siege phase attack", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Attack in Ranged phase (Swift should not affect attack requirements)
      // Wolf Riders has armor 4
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
      });

      // Should defeat enemy with 4 attack (meets armor of 4)
      // Swift has no effect on attack phase
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Elemental block efficiency", () => {
    it("should halve Physical block against Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 8 vs Fire Attack 6
      // Effective block: 8 / 2 = 4, which is < 6, so block fails
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 8 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 4, // 8 / 2 = 4
          requiredBlock: 6,
        })
      );
    });

    it("should use Ice block efficiently against Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Ice 6 vs Fire Attack 6 (efficient)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 6 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should only allow Cold Fire block against Cold Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Altem Mages (Cold Fire attack 6, armor 6)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ALTEM_MAGES],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 12 vs Cold Fire Attack 6
      // Physical is inefficient against Cold Fire: 12 / 2 = 6, which is >= 6, so block succeeds
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 12 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should block Cold Fire with Cold Fire efficiently", () => {
      let state = createTestGameState();

      // Enter combat with Altem Mages (Cold Fire attack 6, armor 6)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ALTEM_MAGES],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Cold Fire 6 vs Cold Fire Attack 6 (efficient)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_COLD_FIRE, value: 6 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should combine efficient and inefficient blocks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Ice 4 (efficient) + Physical 4 (inefficient, halved to 2) = 6
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 4 },
        { element: ELEMENT_PHYSICAL, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 6, // 4 + 4/2 = 6
        })
      );
    });
  });
});
