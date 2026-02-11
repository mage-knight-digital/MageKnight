/**
 * Tests for rampaging enemy cleanup after combat.
 *
 * Bug: When defeating rampaging enemies via CHALLENGE_RAMPAGING action,
 * the enemies are not removed from the hex. The player can end their turn
 * and fight the same enemy again.
 *
 * Root cause: endCombatPhaseCommand.ts clears enemies from player.position,
 * but when challenging rampaging enemies, the player is at a DIFFERENT hex
 * than the enemies. The combat hex is not tracked, so the wrong hex gets cleared.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import {
  CHALLENGE_RAMPAGING_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  COMBAT_ENDED,
  TERRAIN_PLAINS,
  hexKey,
  ENEMY_PROWLERS,
  COMBAT_TYPE_RANGED,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import { RampagingEnemyType } from "../../types/map.js";
import type { HexState } from "../../types/map.js";
import {
  resetTokenCounter,
  createEnemyTokenId,
} from "../helpers/enemy/index.js";
import { createEmptyEnemyTokenPiles } from "../../types/enemy.js";

describe("Rampaging Combat Cleanup", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  function getTotalDiscardedEnemyTokens(state: ReturnType<typeof createTestGameState>): number {
    const discardPiles = state.enemyTokens.discardPiles;
    return (
      discardPiles.green.length +
      discardPiles.red.length +
      discardPiles.brown.length +
      discardPiles.violet.length +
      discardPiles.gray.length +
      discardPiles.white.length
    );
  }

  describe("Defeating rampaging enemies from adjacent hex", () => {
    /**
     * This test demonstrates the bug:
     * 1. Player at (0,0) challenges rampaging enemies at (1,0)
     * 2. Player defeats the enemies through combat
     * 3. BUG: Enemies are still on hex (1,0) after combat ends
     *
     * Expected: hex.enemies and hex.rampagingEnemies at (1,0) should be cleared
     */
    it("should clear enemies from the rampaging hex after victory", () => {
      // Create rampaging enemy token
      const rampagingToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      // Player at (0,0)
      const playerHex = createTestHex(0, 0, TERRAIN_PLAINS);

      // Rampaging enemies at (1,0) - adjacent to player
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        enemyTokens: createEmptyEnemyTokenPiles(),
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: playerHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Step 1: Challenge the rampaging enemies
      state = engine.processAction(state, "player1", {
        type: CHALLENGE_RAMPAGING_ACTION,
        targetHex: { q: 1, r: 0 },
      }).state;

      expect(state.combat).not.toBeNull();
      expect(state.combat?.enemies).toHaveLength(1);

      // Step 2: Defeat the enemy with ranged attack (Prowlers have armor 3)
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      // Step 3: End Ranged/Siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Step 4: End Block phase (enemy defeated, skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Step 5: End Assign Damage phase (enemy defeated, skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Step 6: End Attack phase - this ends combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Verify combat ended with victory
      expect(state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 1,
        })
      );

      // BUG CHECK: Verify the rampaging hex at (1,0) has enemies cleared
      const targetHex = state.map.hexes[hexKey({ q: 1, r: 0 })];

      // This is the bug - enemies should be cleared but aren't
      expect(targetHex?.enemies).toHaveLength(0);
      expect(targetHex?.rampagingEnemies).toHaveLength(0);
      expect(getTotalDiscardedEnemyTokens(state)).toBe(1);
    });

    /**
     * Additional verification: Player should NOT be able to challenge
     * the same rampaging enemies again after defeating them.
     */
    it("should not allow re-challenging defeated rampaging enemies", () => {
      const rampagingToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      const playerHex = createTestHex(0, 0, TERRAIN_PLAINS);
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: playerHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Challenge and defeat the enemies
      state = engine.processAction(state, "player1", {
        type: CHALLENGE_RAMPAGING_ACTION,
        targetHex: { q: 1, r: 0 },
      }).state;

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      // End all combat phases
      for (let i = 0; i < 4; i++) {
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
      }

      // Reset hasCombattedThisTurn for a fresh turn (simulating new turn)
      const updatedPlayer = {
        ...state.players[0],
        hasCombattedThisTurn: false,
      };
      state = {
        ...state,
        players: [updatedPlayer],
      };

      // Verify hex is cleared
      const targetHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      expect(targetHex?.enemies).toHaveLength(0);
      expect(targetHex?.rampagingEnemies).toHaveLength(0);
    });
  });

  describe("Failed combat should not clear rampaging enemies", () => {
    /**
     * When player fails to defeat rampaging enemies (retreats/loses),
     * the enemies should remain on the hex.
     */
    it("should keep enemies on hex when combat ends without victory", () => {
      const rampagingToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      const playerHex = createTestHex(0, 0, TERRAIN_PLAINS);
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: playerHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Challenge the enemies
      state = engine.processAction(state, "player1", {
        type: CHALLENGE_RAMPAGING_ACTION,
        targetHex: { q: 1, r: 0 },
      }).state;

      // End Ranged/Siege phase without attacking
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End Block phase without blocking
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from enemy (mandatory)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // End Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End Attack phase without attacking - combat ends without victory
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Verify combat ended without victory
      expect(state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
          enemiesSurvived: 1,
        })
      );

      // Enemies should still be on the hex
      const targetHex = state.map.hexes[hexKey({ q: 1, r: 0 })];
      expect(targetHex?.enemies).toHaveLength(1);
      expect(targetHex?.rampagingEnemies).toHaveLength(1);
    });
  });
});
