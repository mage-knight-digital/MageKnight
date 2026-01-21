/**
 * Combat Conquest Integration Tests
 *
 * Tests for:
 * - Conquest triggering on combat victory
 * - Enemies cleared from hex on victory
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createHexEnemy } from "./testHelpers.js";
import {
  withBlockSources,
  withSiegeAttack,
  createTestStateWithKeep,
} from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  DECLARE_BLOCK_ACTION,
  COMBAT_ENDED,
  SITE_CONQUERED,
  COMBAT_TYPE_SIEGE,
  hexKey,
  ENEMY_GUARDSMEN,
} from "@mage-knight/shared";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemyHelpers.js";

describe("Combat Conquest Integration", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("Conquest on combat victory", () => {
    it("should conquest site on combat victory", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: keepCoord, // Already at keep
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat manually (simulating we're already there)
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
        isAtFortifiedSite: true,
      });
      state = result.state;

      // Ranged/Siege phase - skip (no ranged attacks)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the Guardsmen (attack 3, Swift requires 6 block)
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]); // Swift doubles block requirement
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // End Block phase -> goes to Assign Damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip Assign Damage phase (enemy is blocked) -> goes to Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Now in Attack phase - defeat the enemy with siege attack (Guardsmen armor 3)
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);

      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }], // More than enough
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // Enemy should be defeated
      expect(state.combat?.enemies[0].isDefeated).toBe(true);

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat with victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
        })
      );

      // Should have conquered the site
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_CONQUERED,
          playerId: "player1",
        })
      );

      // Site should now be conquered
      const hex = result.state.map.hexes[hexKey(keepCoord)];
      expect(hex?.site?.isConquered).toBe(true);
      expect(hex?.site?.owner).toBe("player1");
    });

    it("should clear enemies from hex on victory", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: keepCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
        isAtFortifiedSite: true,
      });
      state = result.state;

      // Ranged/Siege phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]); // Swift doubles block requirement
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // End Block phase -> Assign Damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip Assign Damage phase (enemy is blocked) -> Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase - defeat enemy
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Hex should have no enemies
      const hex = result.state.map.hexes[hexKey(keepCoord)];
      expect(hex?.enemies).toHaveLength(0);
    });
  });
});
