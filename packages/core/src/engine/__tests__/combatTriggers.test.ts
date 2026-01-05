/**
 * Combat Trigger Integration Tests
 *
 * Tests for:
 * - Auto-combat entry when moving to fortified sites
 * - Reputation penalty on assault
 * - Conquest triggering on combat victory
 * - One combat per turn enforcement
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  MOVE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  PLAYER_MOVED,
  COMBAT_TRIGGERED,
  REPUTATION_CHANGED,
  COMBAT_ENDED,
  SITE_CONQUERED,
  INVALID_ACTION,
  COMBAT_TYPE_SIEGE,
  TERRAIN_PLAINS,
  hexKey,
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  REPUTATION_REASON_ASSAULT,
  ENEMY_GUARDSMEN,
  PLAYER_WITHDREW,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemyHelpers.js";

/**
 * Helper to create a keep site
 */
function createKeepSite(): Site {
  return {
    type: SiteType.Keep,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Helper to create a conquered keep site
 */
function createConqueredKeepSite(owner: string): Site {
  return {
    type: SiteType.Keep,
    owner,
    isConquered: true,
    isBurned: false,
  };
}

/**
 * Create test state with a keep at a specific location with enemies
 */
function createTestStateWithKeep(
  keepCoord: { q: number; r: number },
  enemies: readonly EnemyTokenId[] = [],
  isConquered = false,
  owner: string | null = null
): GameState {
  const baseState = createTestGameState();

  // Create hex with keep and enemies
  const originHex = baseState.map.hexes[hexKey({ q: 0, r: 0 })];
  const keepHex: HexState = {
    coord: keepCoord,
    terrain: TERRAIN_PLAINS,
    tileId: originHex?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
    site: isConquered && owner ? createConqueredKeepSite(owner) : createKeepSite(),
    enemies: enemies,
    shieldTokens: owner ? [owner] : [],
    rampagingEnemies: [],
  };

  const hexes: Record<string, HexState> = {
    ...baseState.map.hexes,
    [hexKey(keepCoord)]: keepHex,
  };

  return {
    ...baseState,
    map: { ...baseState.map, hexes },
  };
}

describe("Combat Trigger Integration", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("Auto-combat entry on fortified site assault", () => {
    it("should auto-enter combat when moving to unconquered keep", () => {
      // Create enemy token for the keep
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);

      // Set up state with player adjacent to keep
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      // Update player with enough move points
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should have triggered combat
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      // Should be in combat now
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);
    });

    it("should NOT auto-enter combat when moving to own conquered keep", () => {
      // Set up state with player adjacent to their own conquered keep
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [], true, "player1");

      // Update player
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to own conquered keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should NOT have triggered combat
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: COMBAT_TRIGGERED })
      );

      // Should NOT be in combat
      expect(result.state.combat).toBeNull();
    });

    it("should trigger assault on opponent-owned keep", () => {
      // Set up state with keep conquered by player2
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [], true, "player2");

      // Player1 is adjacent
      const player1 = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });
      const player2 = createTestPlayer({
        id: "player2",
        position: { q: 2, r: 0 },
      });
      state = {
        ...state,
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      };

      // Player1 moves into player2's keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should have triggered combat
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      // Should apply -1 reputation
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          reason: REPUTATION_REASON_ASSAULT,
        })
      );

      // Should be in combat
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);

      // Player reputation should be -1
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });
  });

  describe("Reputation penalty on assault", () => {
    it("should apply -1 reputation on assault", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          newValue: -1,
          reason: REPUTATION_REASON_ASSAULT,
        })
      );

      // Player reputation should be -1
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });
  });

  describe("One combat per turn enforcement", () => {
    it("should prevent second combat same turn", () => {
      let state = createTestGameState();

      // Mark player as having combatted this turn
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: true,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Try to enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });

      // Should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You can only have one combat per turn",
        })
      );
    });

    it("should allow combat when hasCombattedThisTurn is false", () => {
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });

      // Should succeed
      expect(result.state.combat).not.toBeNull();
    });
  });

  describe("Conquest on combat victory", () => {
    it("should conquest site on combat victory", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

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
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        blocks: [{ element: "physical", value: 6 }], // Swift doubles block requirement
      });
      state = result.state;

      // Assign Damage phase - skip (enemy is blocked)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase - skip (just end to finish)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat the enemy with siege attack (Guardsmen armor 3)
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }], // More than enough
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

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
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

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
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        blocks: [{ element: "physical", value: 6 }], // Swift doubles block requirement
      });
      state = result.state;

      // Assign Damage phase - skip (enemy is blocked)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat enemy
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

  describe("hasCombattedThisTurn flag", () => {
    it("should be set after combat ends", () => {
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
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
      });
      state = result.state;

      // Ranged/Siege phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        blocks: [{ element: "physical", value: 6 }], // Swift doubles block requirement
      });
      state = result.state;

      // Assign Damage phase - skip (enemy is blocked)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat enemy
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

      // hasCombattedThisTurn should be true
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasCombattedThisTurn).toBe(true);
    });

    it("should be set when assault triggers combat", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        hasCombattedThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to trigger assault
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // hasCombattedThisTurn should be true
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasCombattedThisTurn).toBe(true);
    });
  });

  describe("Withdrawal on failed fortified assault", () => {
    it("should withdraw to origin hex on failed fortified assault", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });
      state = result.state;

      // Verify assault origin was stored
      expect(state.combat?.assaultOrigin).toEqual(originCoord);

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase (don't block - enemy will attack)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from unblocked enemy (mandatory before advancing)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Now advance to attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip attack phase — don't defeat enemy, just end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat without victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
        })
      );

      // Should have withdrawn
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
          playerId: "player1",
          from: keepCoord,
          to: originCoord,
        })
      );

      // Player should be back at origin
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual(originCoord);
    });

    it("should NOT withdraw on failed adventure site combat", () => {
      // Adventure sites don't set isAtFortifiedSite, so no withdrawal
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat manually (non-fortified, like dungeon)
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
        isAtFortifiedSite: false,
      });
      state = result.state;

      // Combat should NOT have assaultOrigin
      expect(state.combat?.isAtFortifiedSite).toBe(false);

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from unblocked enemy (mandatory before advancing)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Now advance to attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat without victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
        })
      );

      // Should NOT have withdrawn
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
        })
      );

      // Player should still be at same position
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual({ q: 0, r: 0 });
    });

    it("should NOT withdraw if all enemies defeated", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });
      state = result.state;

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        blocks: [{ element: "physical", value: 6 }],
      });
      state = result.state;

      // Skip damage assignment phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat enemy with siege attack
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End attack phase
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

      // Should NOT have withdrawn
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
        })
      );

      // Player should be at keep (victory = conquest)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual(keepCoord);
    });

    it("should store assaultOrigin when assault starts", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [enemyToken]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Combat state should have assaultOrigin set to original position
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.assaultOrigin).toEqual(originCoord);
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);
    });
  });
});
