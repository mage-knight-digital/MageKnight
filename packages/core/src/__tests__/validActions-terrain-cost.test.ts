/**
 * Tests for terrain cost reduction ValidActions computation
 *
 * Tests the getHexCostReductionValidActions and getTerrainCostReductionValidActions
 * functions which compute what hex coordinates and terrain types are available for
 * the player to choose from during a terrain cost reduction effect.
 */

import { describe, it, expect } from "vitest";
import {
  getHexCostReductionValidActions,
  getTerrainCostReductionValidActions,
} from "../engine/validActions/terrainCostReduction.js";
import { createTestGameState } from "../engine/__tests__/testHelpers.js";
import {
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
} from "@mage-knight/shared";
import type { Player } from "../types/player.js";
import type { GameState } from "../state/GameState.js";
import type { PendingTerrainCostReduction } from "../types/player.js";

/**
 * Helper to create a player with a pending hex cost reduction state.
 */
function withPendingHexCostReduction(
  player: Player,
  availableCoordinates: Array<{ q: number; r: number }>
): Player {
  const pending: PendingTerrainCostReduction = {
    mode: "hex",
    availableCoordinates,
    availableTerrains: [],
    reduction: -1,
    minimumCost: 2,
  };

  return {
    ...player,
    pendingTerrainCostReduction: pending,
  };
}

/**
 * Helper to create a player with a pending terrain cost reduction state.
 */
function withPendingTerrainCostReduction(
  player: Player,
  availableTerrains: string[] = []
): Player {
  const pending: PendingTerrainCostReduction = {
    mode: "terrain",
    availableCoordinates: [],
    availableTerrains,
    reduction: -1,
    minimumCost: 2,
  };

  return {
    ...player,
    pendingTerrainCostReduction: pending,
  };
}

/**
 * Helper to update a player in the game state.
 */
function updatePlayer(state: GameState, player: Player): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === player.id);
  if (playerIndex === -1) throw new Error(`Player not found: ${player.id}`);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = player;
  return { ...state, players: updatedPlayers };
}

describe("Terrain Cost Reduction ValidActions", () => {
  describe("getHexCostReductionValidActions", () => {
    it("returns null when player has no pending hex cost reduction state", () => {
      const state = createTestGameState();
      const player = state.players[0];

      const result = getHexCostReductionValidActions(state, player);

      expect(result).toBeNull();
    });

    it("returns null when pending state is terrain mode, not hex mode", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingTerrainCostReduction(player);
      state = updatePlayer(state, player);

      const result = getHexCostReductionValidActions(state, player);

      expect(result).toBeNull();
    });

    it("returns available coordinates when in hex mode", () => {
      let state = createTestGameState();
      let player = state.players[0];

      const coordinates = [
        { q: 1, r: 0 },
        { q: 0, r: 1 },
      ];

      player = withPendingHexCostReduction(player, coordinates);
      state = updatePlayer(state, player);

      const result = getHexCostReductionValidActions(state, player);

      expect(result).not.toBeNull();
      expect(result!.availableCoordinates).toEqual(coordinates);
    });

    it("returns correct reduction and minimum cost values", () => {
      let state = createTestGameState();
      let player = state.players[0];

      const coordinates = [{ q: 1, r: 0 }];
      player = withPendingHexCostReduction(player, coordinates);
      state = updatePlayer(state, player);

      const result = getHexCostReductionValidActions(state, player);

      expect(result!.reduction).toBe(-1);
      expect(result!.minimumCost).toBe(2);
    });

    it("returns empty list when no coordinates available", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingHexCostReduction(player, []);
      state = updatePlayer(state, player);

      const result = getHexCostReductionValidActions(state, player);

      expect(result!.availableCoordinates).toEqual([]);
    });
  });

  describe("getTerrainCostReductionValidActions", () => {
    it("returns null when player has no pending terrain cost reduction state", () => {
      const state = createTestGameState();
      const player = state.players[0];

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result).toBeNull();
    });

    it("returns null when pending state is hex mode, not terrain mode", () => {
      let state = createTestGameState();
      let player = state.players[0];

      const coordinates = [{ q: 1, r: 0 }];
      player = withPendingHexCostReduction(player, coordinates);
      state = updatePlayer(state, player);

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result).toBeNull();
    });

    it("returns all terrain types when in terrain mode", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingTerrainCostReduction(player, []);
      state = updatePlayer(state, player);

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result).not.toBeNull();
      expect(result!.availableTerrains).toContain(TERRAIN_PLAINS);
      expect(result!.availableTerrains).toContain(TERRAIN_HILLS);
      expect(result!.availableTerrains).toContain(TERRAIN_FOREST);
      expect(result!.availableTerrains).toContain(TERRAIN_WASTELAND);
      expect(result!.availableTerrains).toContain(TERRAIN_DESERT);
      expect(result!.availableTerrains).toContain(TERRAIN_SWAMP);
      expect(result!.availableTerrains).toContain(TERRAIN_LAKE);
      expect(result!.availableTerrains).toContain(TERRAIN_MOUNTAIN);
    });

    it("returns 8 terrain types total", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingTerrainCostReduction(player, []);
      state = updatePlayer(state, player);

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result!.availableTerrains).toHaveLength(8);
    });

    it("returns correct reduction and minimum cost values", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingTerrainCostReduction(player);
      state = updatePlayer(state, player);

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result!.reduction).toBe(-1);
      expect(result!.minimumCost).toBe(2);
    });
  });

  describe("integration with pending state resolution", () => {
    it("returns valid actions in correct mode when hex reduction is active", () => {
      let state = createTestGameState();
      let player = state.players[0];

      const coordinates = [
        { q: 1, r: 0 },
        { q: 2, r: -1 },
      ];

      player = withPendingHexCostReduction(player, coordinates);
      state = updatePlayer(state, player);

      const result = getHexCostReductionValidActions(state, player);

      expect(result).not.toBeNull();
      expect(result!.availableCoordinates.length).toBeGreaterThan(0);
    });

    it("returns valid actions in correct mode when terrain reduction is active", () => {
      let state = createTestGameState();
      let player = state.players[0];

      player = withPendingTerrainCostReduction(player);
      state = updatePlayer(state, player);

      const result = getTerrainCostReductionValidActions(state, player);

      expect(result).not.toBeNull();
      expect(result!.availableTerrains.length).toBe(8);
    });
  });
});
