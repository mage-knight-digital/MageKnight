/**
 * Tests for terrain cost reduction commands and validators
 *
 * Tests:
 * - Hex command: Valid coordinate applies modifier
 * - Hex command: Invalid coordinate rejected by validator
 * - Terrain command: Valid terrain applies modifier
 * - Terrain command: Invalid terrain rejected by validator
 * - Commands create modifiers with correct properties
 * - Modifiers have DURATION_TURN
 * - No modifiers applied for invalid actions
 * - isReversible flag set correctly
 */

import { describe, it, expect } from "bun:test";
import { createTestGameState, createTestPlayer } from "../engine/__tests__/testHelpers.js";
import {
  createResolveHexCostReductionCommand,
  createResolveTerrainCostReductionCommand,
} from "../engine/commands/terrainCostReductionCommands.js";
import {
  validateHasPendingHexCostReduction,
  validateHexCostReductionCoordinate,
  validateHasPendingTerrainCostReduction,
  validateTerrainCostReductionTerrain,
} from "../engine/validators/terrainCostReductionValidators.js";
import {
  RESOLVE_HEX_COST_REDUCTION_ACTION,
  RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";
import type { HexCoord, PlayerAction } from "@mage-knight/shared";
import {
  TERRAIN_COST_REDUCTION_REQUIRED,
  TERRAIN_COST_REDUCTION_INVALID_COORDINATE,
  TERRAIN_COST_REDUCTION_INVALID_TERRAIN,
} from "../engine/validators/validationCodes.js";
import { DURATION_TURN, EFFECT_TERRAIN_COST, TERRAIN_ALL } from "../types/modifierConstants.js";
import type { PendingTerrainCostReduction } from "../types/player.js";

const PLAYER_ID = "player1";
const COORD_A: HexCoord = { q: 0, r: 1 };
const COORD_B: HexCoord = { q: 1, r: 0 };
const COORD_C: HexCoord = { q: 2, r: 0 };

function createHexPendingState(
  availableCoordinates: readonly HexCoord[] = [COORD_A, COORD_B]
): PendingTerrainCostReduction {
  return {
    mode: "hex",
    availableCoordinates,
    availableTerrains: [],
    reduction: -1,
    minimumCost: 2,
  };
}

function createTerrainPendingState(
  availableTerrains: readonly string[] = [TERRAIN_FOREST, TERRAIN_HILLS, TERRAIN_PLAINS]
): PendingTerrainCostReduction {
  return {
    mode: "terrain",
    availableCoordinates: [],
    availableTerrains,
    reduction: -1,
    minimumCost: 2,
  };
}

describe("Terrain Cost Reduction Commands", () => {
  describe("resolveHexCostReductionCommand", () => {
    it("applies terrain cost modifier for specific coordinate", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState(),
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: COORD_A,
      });

      const result = command.execute(state);

      // Modifier should be added
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0]!;
      expect(modifier.effect.type).toBe(EFFECT_TERRAIN_COST);
      expect(modifier.duration).toBe(DURATION_TURN);
      expect(modifier.createdByPlayerId).toBe(PLAYER_ID);

      // Check the terrain cost modifier specifics
      if (modifier.effect.type === EFFECT_TERRAIN_COST) {
        expect(modifier.effect.terrain).toBe(TERRAIN_ALL);
        expect(modifier.effect.amount).toBe(-1);
        expect(modifier.effect.minimum).toBe(2);
        expect(modifier.effect.specificCoordinate).toEqual(COORD_A);
      }
    });

    it("clears pending terrain cost reduction state", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState(),
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: COORD_A,
      });

      const result = command.execute(state);
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      expect(player?.pendingTerrainCostReduction).toBeNull();
    });

    it("is not reversible", () => {
      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: COORD_A,
      });
      expect(command.isReversible).toBe(false);
    });

    it("returns empty events", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState(),
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: COORD_A,
      });

      const result = command.execute(state);
      expect(result.events).toHaveLength(0);
    });

    it("throws if player not found", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ id: "other_player" })],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: COORD_A,
      });

      expect(() => command.execute(state)).toThrow("Player not found");
    });
  });

  describe("resolveTerrainCostReductionCommand", () => {
    it("applies terrain cost modifier for specific terrain type", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState(),
          }),
        ],
      });

      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });

      const result = command.execute(state);

      // Modifier should be added
      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0]!;
      expect(modifier.effect.type).toBe(EFFECT_TERRAIN_COST);
      expect(modifier.duration).toBe(DURATION_TURN);
      expect(modifier.createdByPlayerId).toBe(PLAYER_ID);

      // Check the terrain cost modifier specifics
      if (modifier.effect.type === EFFECT_TERRAIN_COST) {
        expect(modifier.effect.terrain).toBe(TERRAIN_FOREST);
        expect(modifier.effect.amount).toBe(-1);
        expect(modifier.effect.minimum).toBe(2);
        expect(modifier.effect.specificCoordinate).toBeUndefined();
      }
    });

    it("clears pending terrain cost reduction state", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState(),
          }),
        ],
      });

      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });

      const result = command.execute(state);
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      expect(player?.pendingTerrainCostReduction).toBeNull();
    });

    it("is not reversible", () => {
      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });
      expect(command.isReversible).toBe(false);
    });
  });
});

describe("Terrain Cost Reduction Validators", () => {
  describe("validateHasPendingHexCostReduction", () => {
    it("succeeds when player has pending hex cost reduction", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState(),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_HEX_COST_REDUCTION_ACTION,
        coordinate: COORD_A,
      };

      const result = validateHasPendingHexCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(true);
    });

    it("fails when no pending state", () => {
      const state = createTestGameState({
        players: [createTestPlayer()],
      });

      const action: PlayerAction = {
        type: RESOLVE_HEX_COST_REDUCTION_ACTION,
        coordinate: COORD_A,
      };

      const result = validateHasPendingHexCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(TERRAIN_COST_REDUCTION_REQUIRED);
      }
    });

    it("fails when pending state is terrain mode, not hex", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState(),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_HEX_COST_REDUCTION_ACTION,
        coordinate: COORD_A,
      };

      const result = validateHasPendingHexCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateHexCostReductionCoordinate", () => {
    it("succeeds for valid coordinate", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState([COORD_A, COORD_B]),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_HEX_COST_REDUCTION_ACTION,
        coordinate: COORD_A,
      };

      const result = validateHexCostReductionCoordinate(state, PLAYER_ID, action);
      expect(result.valid).toBe(true);
    });

    it("fails for invalid coordinate", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState([COORD_A, COORD_B]),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_HEX_COST_REDUCTION_ACTION,
        coordinate: COORD_C, // Not in available list
      };

      const result = validateHexCostReductionCoordinate(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(TERRAIN_COST_REDUCTION_INVALID_COORDINATE);
      }
    });
  });

  describe("validateHasPendingTerrainCostReduction", () => {
    it("succeeds when player has pending terrain cost reduction", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState(),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain: TERRAIN_FOREST,
      };

      const result = validateHasPendingTerrainCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(true);
    });

    it("fails when no pending state", () => {
      const state = createTestGameState({
        players: [createTestPlayer()],
      });

      const action: PlayerAction = {
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain: TERRAIN_FOREST,
      };

      const result = validateHasPendingTerrainCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(TERRAIN_COST_REDUCTION_REQUIRED);
      }
    });

    it("fails when pending state is hex mode, not terrain", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createHexPendingState(),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain: TERRAIN_FOREST,
      };

      const result = validateHasPendingTerrainCostReduction(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
    });
  });

  describe("validateTerrainCostReductionTerrain", () => {
    it("succeeds for valid terrain", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState([
              TERRAIN_FOREST,
              TERRAIN_HILLS,
            ]),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain: TERRAIN_FOREST,
      };

      const result = validateTerrainCostReductionTerrain(state, PLAYER_ID, action);
      expect(result.valid).toBe(true);
    });

    it("fails for invalid terrain", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: createTerrainPendingState([TERRAIN_FOREST]),
          }),
        ],
      });

      const action: PlayerAction = {
        type: RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
        terrain: TERRAIN_HILLS, // Not in available list
      };

      const result = validateTerrainCostReductionTerrain(state, PLAYER_ID, action);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe(TERRAIN_COST_REDUCTION_INVALID_TERRAIN);
      }
    });
  });
});
