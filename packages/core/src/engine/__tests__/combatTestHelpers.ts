/**
 * Shared helpers for combat tests
 *
 * Contains utility functions used across multiple combat test files.
 */

import type { BlockSource } from "@mage-knight/shared";
import { hexKey, TERRAIN_PLAINS, TERRAIN_FOREST } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Site, HexState, HexEnemy } from "../../types/map.js";
import { SiteType, TileId } from "../../types/map.js";
import { createTestGameState } from "./testHelpers.js";

/**
 * Helper to set up block sources in the player's combatAccumulator.
 * Tests call this before DECLARE_BLOCK_ACTION since blocks are now
 * read from server-side state, not the action payload.
 */
export function withBlockSources(
  state: GameState,
  playerId: string,
  blocks: readonly BlockSource[],
  enemyInstanceId: string = "enemy_0"
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
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
 * Tests call this before DECLARE_ATTACK_ACTION with COMBAT_TYPE_SIEGE
 * since the validator now checks that siege attack is actually accumulated.
 */
export function withSiegeAttack(
  state: GameState,
  playerId: string,
  value: number
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
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
export function createKeepSite(): Site {
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
export function createConqueredKeepSite(owner: string): Site {
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
export function createTestStateWithKeep(
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
    tileId: originHex?.tileId ?? TileId.StartingTileA,
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

/**
 * Helper to create a state with adjacent hexes for movement testing.
 * Creates a player at (0,0) with an adjacent forest at (1,0) and another at (2,-1).
 */
export function createStateWithAdjacentHexes(): GameState {
  const baseState = createTestGameState();
  const originHex = baseState.map.hexes[hexKey({ q: 0, r: 0 })];

  // Create adjacent hexes for movement
  const hex1: HexState = {
    coord: { q: 1, r: 0 },
    terrain: TERRAIN_FOREST,
    tileId: originHex?.tileId ?? TileId.StartingTileA,
    site: null,
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
  };
  const hex2: HexState = {
    coord: { q: 2, r: -1 },
    terrain: TERRAIN_PLAINS,
    tileId: originHex?.tileId ?? TileId.StartingTileA,
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
