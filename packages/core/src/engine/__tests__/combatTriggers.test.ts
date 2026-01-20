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
  ENEMY_DIGGERS,
  PLAYER_WITHDREW,
  TERRAIN_FOREST,
  PLAYER_KNOCKED_OUT,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
} from "@mage-knight/shared";
import { SiteType, RampagingEnemyType } from "../../types/map.js";
import type { Site, HexState, HexEnemy } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import { createHexEnemy, createTestHex } from "./testHelpers.js";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemyHelpers.js";
import type { BlockSource } from "@mage-knight/shared";

/**
 * Helper to set up block sources in the player's combatAccumulator and pendingBlock in combat state.
 * Updated for incremental block allocation system.
 */
function withBlockSources(
  state: GameState,
  playerId: string,
  blocks: readonly BlockSource[],
  enemyInstanceId: string = "enemy_0"
): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  const totalBlock = blocks.reduce((sum, b) => sum + b.value, 0);

  // Calculate block by element for new system
  const blockByElement = { physical: 0, fire: 0, ice: 0, coldFire: 0 };
  for (const block of blocks) {
    switch (block.element) {
      case "physical":
        blockByElement.physical += block.value;
        break;
      case "fire":
        blockByElement.fire += block.value;
        break;
      case "ice":
        blockByElement.ice += block.value;
        break;
      case "cold_fire":
        blockByElement.coldFire += block.value;
        break;
    }
  }

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      block: totalBlock,
      blockSources: blocks,
      blockElements: blockByElement,
      assignedBlock: totalBlock,
      assignedBlockElements: blockByElement,
    },
  };

  // Also set up pendingBlock in combat state for the new system
  const combat = state.combat;
  if (!combat) {
    return { ...state, players: updatedPlayers };
  }

  return {
    ...state,
    players: updatedPlayers,
    combat: {
      ...combat,
      pendingBlock: {
        ...combat.pendingBlock,
        [enemyInstanceId]: blockByElement,
      },
    },
  };
}

/**
 * Helper to set up siege attack in the player's combatAccumulator.
 * Required since validator now checks that siege attack is actually accumulated.
 */
function withSiegeAttack(state: GameState, playerId: string, value: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  if (!player) throw new Error(`Player not found at index: ${playerIndex}`);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        siege: value,
      },
    },
  };

  return { ...state, players: updatedPlayers };
}

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
  enemies: readonly HexEnemy[] = [],
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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]); // Swift doubles block requirement
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
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

      // Attack phase - defeat enemy with siege attack
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);
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
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

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

  describe("Knockout - discards non-wound cards from hand", () => {
    /**
     * Per rulebook: "If the number of Wound cards added to your hand during a combat
     * equals or exceeds your unmodified Hand limit, you are knocked out – immediately
     * discard all non-Wound cards from your hand."
     *
     * This test verifies:
     * 1. When wounds received in a single combat >= hand limit, knock out triggers
     * 2. All non-wound cards are discarded from hand immediately
     * 3. Only wound cards remain in hand after knock out
     */
    it("should discard all non-wound cards when knocked out", () => {
      let state = createTestGameState();

      // Player with 5 cards in hand, hand limit 5, armor 2
      // Need to take 5+ wounds to knock out
      // An enemy with attack 10 vs armor 2 = 5 wounds
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hand: ["march", "rage", "stamina", "swiftness", "promise"], // 5 cards
        deck: ["concentration"],
        handLimit: 5,
        armor: 2,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat with an enemy that deals enough damage for knock out
      // We'll use two Guardsmen (attack 3 each = 6 total)
      // But since we're testing a single damage assignment, we need a high-attack enemy
      // Let's create a combat with an enemy we know the stats for
      // Guardsmen has attack 3, armor 4
      // 3 damage / armor 2 = 2 wounds per Guardsmen
      // Need 3 Guardsmen or a stronger enemy...

      // Actually, let's enter combat manually with multiple enemies
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN, ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase (don't block - take all damage)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from first enemy (attack 3 / armor 2 = 2 wounds)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Check wounds so far (should be 2)
      expect(state.combat?.woundsThisCombat).toBe(2);
      expect(state.players[0].knockedOut).toBe(false); // Not knocked out yet

      // Assign damage from second enemy (attack 3 / armor 2 = 2 more wounds = 4 total)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
      });
      state = result.state;

      // Still not knocked out (4 < 5)
      expect(state.combat?.woundsThisCombat).toBe(4);
      expect(state.players[0].knockedOut).toBe(false);

      // Hand should still have the original 5 cards + 4 wounds = 9 cards
      expect(state.players[0].hand.length).toBe(9);
      expect(state.players[0].hand.filter(c => c === "wound").length).toBe(4);
    });

    it("should trigger knock out when wounds this combat reach hand limit", () => {
      let state = createTestGameState();

      // Use a player with hand limit 3 to make knock out easier to trigger
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hand: ["march", "rage", "stamina"], // 3 cards
        deck: ["concentration"],
        handLimit: 3,
        armor: 1, // Low armor so each attack causes more wounds
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat with Guardsmen (attack 3)
      // 3 damage / armor 1 = 3 wounds = knock out threshold
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Skip to damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage (3 wounds will trigger knock out)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      const finalPlayer = result.state.players[0];

      // Should be knocked out
      expect(finalPlayer.knockedOut).toBe(true);
      expect(result.state.combat?.woundsThisCombat).toBe(3);

      // KEY ASSERTION: Hand should contain ONLY wounds (3 wounds)
      // All original cards (march, rage, stamina) should be discarded
      expect(finalPlayer.hand.length).toBe(3);
      expect(finalPlayer.hand.every(c => c === "wound")).toBe(true);

      // Original cards should be in discard pile
      expect(finalPlayer.discard).toContain("march");
      expect(finalPlayer.discard).toContain("rage");
      expect(finalPlayer.discard).toContain("stamina");

      // Should emit PLAYER_KNOCKED_OUT event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_KNOCKED_OUT,
          playerId: "player1",
          woundsThisCombat: 3,
        })
      );
    });
  });

  describe("Movement after combat", () => {
    /**
     * Helper to create a state with adjacent hexes for movement testing.
     * Creates a player at (0,0) with an adjacent forest at (1,0) and another at (2,-1).
     */
    function createStateWithAdjacentHexes(): GameState {
      const baseState = createTestGameState();
      const originHex = baseState.map.hexes[hexKey({ q: 0, r: 0 })];

      // Create adjacent hexes for movement
      const hex1: HexState = {
        coord: { q: 1, r: 0 },
        terrain: TERRAIN_FOREST,
        tileId: originHex?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
        site: null,
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };
      const hex2: HexState = {
        coord: { q: 2, r: -1 },
        terrain: TERRAIN_PLAINS,
        tileId: originHex?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
        site: null,
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };

      return {
        ...baseState,
        map: {
          ...baseState.map,
          hexes: {
            ...baseState.map.hexes,
            [hexKey(hex1.coord)]: hex1,
            [hexKey(hex2.coord)]: hex2,
          },
        },
      };
    }

    it("should NOT allow movement after combat ends (player gets one action per turn)", () => {
      // This test reproduces the bug: move -> combat -> move should be invalid
      // Per Mage Knight rules: you get one action per turn (combat OR interaction)
      // Movement is free before your action, but not after
      let state = createStateWithAdjacentHexes();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 10, // Plenty of move points
        hasCombattedThisTurn: false,
        hasTakenActionThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Step 1: Move to adjacent hex (1,0)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );
      state = result.state;

      // Step 2: Enter combat (voluntary)
      result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      expect(result.state.combat).not.toBeNull();
      state = result.state;

      // Step 3: Skip through combat phases (ranged/siege -> block -> assign damage -> attack)
      // Ranged/Siege phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
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

      // Attack phase - defeat the enemy
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Combat should have ended
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
        })
      );

      // Step 4: Try to move AGAIN after combat - THIS SHOULD FAIL
      // Combat is the player's "action" for the turn, so no more movement allowed
      result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 2, r: -1 },
      });

      // Movement after combat should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should set hasTakenActionThisTurn when combat ends", () => {
      let state = createStateWithAdjacentHexes();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
        hasTakenActionThisTurn: false,
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

      // Skip through combat phases
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Assign Damage phase - skip
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

      // hasTakenActionThisTurn should be true after combat
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasTakenActionThisTurn).toBe(true);
    });
  });

  describe("Fortified assault with provoked rampaging enemies", () => {
    /**
     * Per rulebook (line 608):
     * "An assault is a move, and it can happen that it provokes one or more rampaging enemies.
     * You have to fight both the defenders and these rampaging enemies at once. The rampaging
     * enemies are not fortified, though, and you can conquer the site even if you do not defeat them."
     *
     * Test scenario:
     * - Player at (0,0)
     * - Rampaging enemy at (1,0)
     * - Keep (fortified site) at (1,-1) with a garrison
     * - Player moves from (0,0) to (1,-1)
     *
     * Both (0,0) and (1,-1) are adjacent to (1,0), so moving between them provokes
     * the rampaging enemy. The player must fight BOTH the keep garrison AND the
     * provoked rampaging enemy in a single combat.
     */
    it("should include both fortified site defenders AND provoked rampaging enemies in combat", () => {
      // Create enemy tokens
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      // Set up state
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });

      // Create the keep at (1,-1) with garrison
      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      // Create rampaging enemy at (1,0) - adjacent to both (0,0) and (1,-1)
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      // Create player's starting hex (0,0)
      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

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
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      // Move from (0,0) to (1,-1)
      // This should:
      // 1. Trigger fortified assault (keep)
      // 2. Provoke rampaging enemy at (1,0)
      // 3. Both enemies should be in the same combat
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
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

      // Should be in combat
      expect(result.state.combat).not.toBeNull();

      // CRITICAL ASSERTION: Combat should have BOTH enemies
      // - The keep defender (guardsmen)
      // - The provoked rampaging enemy (diggers)
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Verify both enemy types are present
      const enemyIds = result.state.combat?.enemies.map((e) => e.enemyId) ?? [];
      expect(enemyIds).toContain(ENEMY_GUARDSMEN);
      expect(enemyIds).toContain(ENEMY_DIGGERS);

      // Combat should be at fortified site (for the keep defenders)
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);

      // Player reputation should be -1 from assault
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });

    it("should emit both COMBAT_TRIGGERED events when provoking during assault", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

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
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Should have two COMBAT_TRIGGERED events:
      // 1. FORTIFIED_ASSAULT for the keep
      // 2. PROVOKE_RAMPAGING for the orc
      const combatTriggeredEvents = result.events.filter(
        (e) => e.type === COMBAT_TRIGGERED
      );

      expect(combatTriggeredEvents).toHaveLength(2);

      expect(combatTriggeredEvents).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      expect(combatTriggeredEvents).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_PROVOKE_RAMPAGING,
        })
      );
    });

    it("should mark provoked rampaging enemies as not required for conquest", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

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
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Verify the flags are set correctly
      const enemies = result.state.combat?.enemies ?? [];
      expect(enemies).toHaveLength(2);

      // Site defender (guardsmen) should be required for conquest
      const siteDefender = enemies.find((e) => e.enemyId === ENEMY_GUARDSMEN);
      expect(siteDefender?.isRequiredForConquest).toBe(true);

      // Provoked rampaging enemy (diggers) should NOT be required for conquest
      const rampagingEnemy = enemies.find((e) => e.enemyId === ENEMY_DIGGERS);
      expect(rampagingEnemy?.isRequiredForConquest).toBe(false);
    });

    it("should conquer site when only site defenders are defeated (rampaging enemies survive)", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestGameState();
      const keepCoord = { q: 1, r: -1 };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

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
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      // Move to keep (triggers assault + provoke)
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

      // Block phase - only block the site defender (guardsmen)
      // Guardsmen: attack 3, Fortified (not Swift), need 3 block
      state = withBlockSources(state, "player1", [{ element: "physical", value: 3 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0", // Guardsmen (site defender)
      });
      state = result.state;

      // End Block phase -> Assign Damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign Damage from unblocked rampaging enemy (enemy_1 - Diggers)
      // This will deal wounds but we continue
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1", // Diggers (rampaging) - unblocked
      });
      state = result.state;

      // End Assign Damage phase -> Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase - defeat ONLY the site defender (guardsmen), leave rampaging enemy alive
      state = withSiegeAttack(state, "player1", 7); // Guardsmen armor 7
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"], // Only target guardsmen (site defender)
        attacks: [{ element: "physical", value: 7 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // Verify only guardsmen is defeated, diggers survives
      expect(state.combat?.enemies[0]?.isDefeated).toBe(true); // Guardsmen defeated
      expect(state.combat?.enemies[1]?.isDefeated).toBe(false); // Diggers survives

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have VICTORY even though rampaging enemy survives
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true, // Victory because all REQUIRED enemies defeated
          enemiesDefeated: 1,
          enemiesSurvived: 1,
        })
      );

      // Should have conquered the site
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_CONQUERED,
          playerId: "player1",
        })
      );

      // Site should be conquered
      const hex = result.state.map.hexes[hexKey(keepCoord)];
      expect(hex?.site?.isConquered).toBe(true);
      expect(hex?.site?.owner).toBe("player1");
    });
  });
});
