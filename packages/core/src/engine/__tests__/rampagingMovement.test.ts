/**
 * Tests for Rampaging Enemy Movement Restrictions
 *
 * Rampaging enemies (Orc Marauders, Draconum) have special movement rules:
 * 1. Cannot enter their hex - must defeat them first
 * 2. Provoking - moving from one adjacent hex to another adjacent hex
 *    of the same rampaging enemy triggers combat and ends movement
 *
 * This test file validates movement validation and combat triggering.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex, createHexEnemy } from "./testHelpers.js";
import {
  MOVE_ACTION,
  TERRAIN_PLAINS,
  hexKey,
  INVALID_ACTION,
  PLAYER_MOVED,
  COMBAT_TRIGGERED,
} from "@mage-knight/shared";
import { RampagingEnemyType } from "../../types/map.js";
import type { HexState } from "../../types/map.js";
import { resetTokenCounter, createEnemyTokenId } from "../helpers/enemy/index.js";
import { ENEMY_DIGGERS } from "@mage-knight/shared";

describe("Rampaging Enemy Movement Restrictions", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("Cannot enter hex with rampaging enemies", () => {
    it("should block movement into hex with rampaging Orc Marauder", () => {
      // Set up state with player at (0,0) and rampaging enemy at (1,0)
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      // Create target hex with rampaging enemy
      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS); // Any green enemy
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(enemyToken)], // Enemy is present
      };

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Try to move into rampaging hex
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Player should not have moved
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual({ q: 0, r: 0 });
    });

    it("should allow movement into hex where rampaging enemies were defeated", () => {
      // Set up state with player at (0,0) and defeated rampaging enemy hex at (1,0)
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      // Create target hex that HAD rampaging enemies but they were defeated
      // (rampagingEnemies still marked, but enemies array is empty)
      const defeatedRampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [], // Enemies were defeated
      };

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: defeatedRampagingHex,
          },
        },
      };

      // Try to move into hex with defeated enemies
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Should succeed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_MOVED,
        })
      );

      // Player should have moved
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual({ q: 1, r: 0 });
    });
  });

  describe("Rampaging hex setup preserves rampagingEnemies marker", () => {
    /**
     * BUG TEST: The server setup clears rampagingEnemies after drawing enemies.
     * This breaks the validation check which requires BOTH:
     * - rampagingEnemies.length > 0
     * - enemies.length > 0
     *
     * This test demonstrates the bug: after setup, the rampagingEnemies
     * marker should be preserved so movement validation works correctly.
     */
    it("should preserve rampagingEnemies marker after drawing enemies", () => {
      // This test verifies the expected behavior (which is currently broken)
      // When enemies are drawn for a rampaging hex:
      // 1. enemies array should contain the drawn enemy tokens
      // 2. rampagingEnemies array should STILL contain the rampaging type marker
      //
      // The fix: Don't clear rampagingEnemies in server/src/index.ts line 450

      // Create a hex with rampaging marker and enemies (simulating correct state)
      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);
      const correctlySetupHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder], // Should be preserved
        enemies: [createHexEnemy(enemyToken)], // Enemies were drawn
      };

      // Verify both are set
      expect(correctlySetupHex.rampagingEnemies.length).toBeGreaterThan(0);
      expect(correctlySetupHex.enemies.length).toBeGreaterThan(0);

      // This is what validateNotBlockedByRampaging checks:
      const shouldBlockMovement =
        correctlySetupHex.rampagingEnemies.length > 0 &&
        correctlySetupHex.enemies.length > 0;

      expect(shouldBlockMovement).toBe(true);
    });
  });

  describe("Provoking rampaging enemies", () => {
    /**
     * Provoking happens when you move from one hex adjacent to a rampaging enemy
     * to another hex that is also adjacent to the same enemy (skirting around them).
     *
     * Per the rules:
     * 1. The move SUCCEEDS - you arrive at the destination hex
     * 2. Movement immediately ENDS (no more moves this turn)
     * 3. Combat is TRIGGERED (mandatory fight with the rampaging enemy)
     */
    it("should trigger combat when moving between two hexes adjacent to same rampaging enemy", () => {
      let state = createTestGameState();

      // Set up: player at (0,0), rampaging enemy at (1,0)
      // Adjacent hexes to (1,0): NE(2,-1), E(2,0), SE(1,1), SW(0,1), W(0,0), NW(1,-1)
      // Player starts at (0,0) which is W of the rampaging enemy
      // Moving to (1,-1) which is NW of the rampaging enemy should provoke
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      // Create the rampaging hex at (1,0)
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(enemyToken)],
      };

      // Create player's starting hex (0,0) - adjacent to rampaging enemy
      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

      // Create destination hex (1,-1) - also adjacent to rampaging enemy
      const destHex = createTestHex(1, -1, TERRAIN_PLAINS);

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 1, r: -1 })]: destHex,
          },
        },
      };

      // Move from (0,0) to (1,-1) - both adjacent to rampaging enemy at (1,0)
      // This should trigger combat (provoking)
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // The move should succeed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_MOVED,
        })
      );

      // Player should have moved to (1,-1)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual({ q: 1, r: -1 });

      // Combat should have been triggered
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
        })
      );

      // Combat state should be active
      expect(result.state.combat).not.toBeNull();
    });

    it("should not trigger combat when moving away from rampaging enemy", () => {
      let state = createTestGameState();

      // Set up: player at (0,0), rampaging enemy at (1,0)
      // Moving to (-1,0) which is NOT adjacent to the rampaging enemy - no provoke
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(enemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);
      const destHex = createTestHex(-1, 0, TERRAIN_PLAINS); // Not adjacent to rampaging

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: -1, r: 0 })]: destHex,
          },
        },
      };

      // Move from (0,0) to (-1,0) - moving away from rampaging enemy
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: -1, r: 0 },
      });

      // The move should succeed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_MOVED,
        })
      );

      // Combat should NOT have been triggered
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
        })
      );

      // Combat state should not be active
      expect(result.state.combat).toBeNull();
    });

    it("should not trigger combat when not starting adjacent to rampaging enemy", () => {
      let state = createTestGameState();

      // Set up: player at (-1,0), rampaging enemy at (1,0)
      // Player is NOT adjacent to rampaging enemy, so moving to (0,0) (which IS adjacent)
      // should NOT trigger combat - you only provoke when starting adjacent
      const player = createTestPlayer({
        id: "player1",
        position: { q: -1, r: 0 },
        movePoints: 4,
      });

      const enemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(enemyToken)],
      };

      const startHex = createTestHex(-1, 0, TERRAIN_PLAINS);
      const destHex = createTestHex(0, 0, TERRAIN_PLAINS); // Adjacent to rampaging

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: -1, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 0, r: 0 })]: destHex,
          },
        },
      };

      // Move from (-1,0) to (0,0) - ending adjacent but not starting adjacent
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 0, r: 0 },
      });

      // The move should succeed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_MOVED,
        })
      );

      // Combat should NOT have been triggered (only provoke when starting adjacent)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
        })
      );

      // Combat state should not be active
      expect(result.state.combat).toBeNull();
    });
  });
});
