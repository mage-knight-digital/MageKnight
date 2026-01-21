/**
 * Combat Integration Tests
 *
 * End-to-end tests for complete combat flows.
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
  COMBAT_ENDED,
  ENEMY_ORC,
  ENEMY_WOLF_RIDERS,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";

describe("Combat Integration", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Full combat flow", () => {
    it("should complete a full combat: enter, block, attack, end", () => {
      let state = createTestGameState();

      // Enter combat with Orc (Diggers: attack 3, armor 3, fame 2) and Wolf Riders (attack 3, armor 4, fame 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC, ENEMY_WOLF_RIDERS],
      }).state;

      // Ranged/Siege phase - defeat Wolf Riders with ranged attack
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }], // Wolf Riders has armor 4
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      expect(state.combat?.enemies[1].isDefeated).toBe(true);
      expect(state.players[0].fame).toBe(3); // Wolf Riders gives 3 fame

      // Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block the Orc
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      expect(state.combat?.enemies[0].isBlocked).toBe(true);

      // Assign Damage phase - skip (Orc is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - defeat Orc
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      }).state;

      expect(state.combat?.enemies[0].isDefeated).toBe(true);
      expect(state.players[0].fame).toBe(5); // 3 from Wolf (Guardsmen) + 2 from Orc (Diggers)

      // End combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 2,
          enemiesSurvived: 0,
          totalFameGained: 5,
        })
      );
    });
  });
});
