/**
 * Combat Attacking Tests
 *
 * Tests for attack mechanics including basic attacks, attack resistances,
 * and elemental enemy interactions.
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
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  ENEMY_ORC,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGE,
  ENEMY_ICE_GOLEM,
  ENEMY_FIRE_DRAGON,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
} from "@mage-knight/shared";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";

describe("Combat Attacking", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Basic attacking", () => {
    it("should defeat enemy with sufficient attack", () => {
      let state = createTestGameState();

      // Enter combat with Orc (armor 3)
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

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 3
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.players[0].fame).toBe(2); // Orc gives 2 fame
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
          fameGained: 2,
        })
      );
    });

    it("should fail attack with insufficient value", () => {
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

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 2 (Orc has armor 3)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 2 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 2,
          requiredAttack: 3,
        })
      );
    });

    it("should allow ranged attacks in Attack phase", () => {
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

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Ranged attack should work in Attack phase (per rulebook)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should allow ranged attacks in Ranged/Siege phase", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified) since ENEMY_ORC is aliased to Diggers (fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Still in Ranged/Siege phase
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should reject normal attacks in Ranged/Siege phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Still in Ranged/Siege phase, try normal attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Only Ranged or Siege attacks allowed in Ranged/Siege phase",
        })
      );
    });
  });

  describe("Attack resistances", () => {
    it("should halve Fire attack against Fire resistance", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 6 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Fire 8 vs armor 5 with Fire resistance
      // Effective attack: 8 / 2 = 4, which is < 5, so attack fails
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_FIRE, value: 8 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 4, // 8 / 2 = 4
          requiredAttack: 5,
        })
      );
    });

    it("should deal full damage with unresisted element", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 6 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Ice 5 vs armor 5 - Ice is not resisted
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_ICE, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should halve Physical attack against Physical resistance", () => {
      let state = createTestGameState();

      // Enter combat with Ice Golem (Physical resistance, Ice attack 2, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEM],
      }).state;

      // Block phase - block with Fire (efficient vs Ice)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_FIRE, value: 2 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 6 vs armor 4 with Physical resistance
      // Effective attack: 6 / 2 = 3, which is < 4, so attack fails
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 6 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
    });

    it("should combine resisted and unresisted attacks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 6 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Fire 4 (resisted, halved to 2) + Physical 3 (unresisted) = 5
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [
          { element: ELEMENT_FIRE, value: 4 },
          { element: ELEMENT_PHYSICAL, value: 3 },
        ],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("Elemental enemies in combat", () => {
    it("should fight Fire Dragon with Ice attacks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Dragon (Fire attack 9, Fire resistance, armor 7)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_DRAGON],
      }).state;

      // Block phase - block with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 9 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with Ice 7 - not resisted
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_ICE, value: 7 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.players[0].fame).toBe(8); // Fire Dragon gives 8 fame
    });
  });
});
