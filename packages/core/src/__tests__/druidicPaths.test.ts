/**
 * Tests for Druidic Paths card - terrain cost reduction feature
 *
 * Acceptance Criteria from #132:
 * AC1: Basic effect: Move 2 + select one space for cost -1 (min 2)
 * AC2: Powered effect: Move 4 + select terrain type for cost -1 (min 2)
 * AC3: Minimum cost of 2 enforced
 * AC4: Cost reduction persists for entire turn
 * AC5: Works with other movement modifiers (stacking rules)
 */

import { describe, it, expect } from "bun:test";
import {
  CARD_BRAEVALAR_DRUIDIC_PATHS,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_PLAINS,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_WASTELAND,
  hexKey,
} from "@mage-knight/shared";
import type { HexCoord } from "@mage-knight/shared";
import { BRAEVALAR_DRUIDIC_PATHS } from "../data/basicActions/green/braevalar-druidic-paths.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "../engine/__tests__/testHelpers.js";
import { resolveEffect } from "../engine/effects/index.js";
import {
  createResolveHexCostReductionCommand,
  createResolveTerrainCostReductionCommand,
} from "../engine/commands/terrainCostReductionCommands.js";
import { getEffectiveTerrainCost } from "../engine/modifiers/terrain.js";
import { addModifier } from "../engine/modifiers/index.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_MOVE,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
} from "../types/effectTypes.js";
import type { CompoundEffect } from "../types/cards.js";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  TERRAIN_ALL,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../types/modifierConstants.js";
import type { CardId } from "@mage-knight/shared";

const PLAYER_ID = "player1";

describe("Druidic Paths card", () => {
  describe("Card definition", () => {
    it("exists with correct properties", () => {
      expect(BRAEVALAR_DRUIDIC_PATHS).toBeDefined();
      expect(BRAEVALAR_DRUIDIC_PATHS.id).toBe(CARD_BRAEVALAR_DRUIDIC_PATHS);
      expect(BRAEVALAR_DRUIDIC_PATHS.name).toBe("Druidic Paths");
    });

    it("is a basic action card", () => {
      expect(BRAEVALAR_DRUIDIC_PATHS.cardType).toBe("basic_action");
    });

    it("is powered by green mana", () => {
      expect(BRAEVALAR_DRUIDIC_PATHS.poweredBy).toContain("green");
    });

    it("has movement category", () => {
      expect(BRAEVALAR_DRUIDIC_PATHS.categories).toContain("movement");
    });

    it("has sideways value of 1", () => {
      expect(BRAEVALAR_DRUIDIC_PATHS.sidewaysValue).toBe(1);
    });

    it("basic effect is a compound of Move 2 + hex cost reduction selection", () => {
      const effect = BRAEVALAR_DRUIDIC_PATHS.basicEffect;
      expect(effect.type).toBe(EFFECT_COMPOUND);
      const compound = effect as CompoundEffect;
      expect(compound.effects).toHaveLength(2);
      expect(compound.effects[0]!.type).toBe(EFFECT_GAIN_MOVE);
      expect(compound.effects[1]!.type).toBe(EFFECT_SELECT_HEX_FOR_COST_REDUCTION);
    });

    it("powered effect is a compound of Move 4 + terrain cost reduction selection", () => {
      const effect = BRAEVALAR_DRUIDIC_PATHS.poweredEffect;
      expect(effect.type).toBe(EFFECT_COMPOUND);
      const compound = effect as CompoundEffect;
      expect(compound.effects).toHaveLength(2);
      expect(compound.effects[0]!.type).toBe(EFFECT_GAIN_MOVE);
      expect(compound.effects[1]!.type).toBe(EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION);
    });
  });

  describe("AC1: Basic effect grants Move 2 and hex selection", () => {
    it("resolving basic effect grants move points and sets pending hex state", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0 })],
      });

      const result = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.basicEffect);

      // Player should have gained 2 move points
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      expect(player?.movePoints).toBe(2);

      // Player should have pending hex cost reduction state
      expect(player?.pendingTerrainCostReduction).not.toBeNull();
      expect(player?.pendingTerrainCostReduction?.mode).toBe("hex");
      expect(player?.pendingTerrainCostReduction?.reduction).toBe(-1);
      expect(player?.pendingTerrainCostReduction?.minimumCost).toBe(2);
    });

    it("available coordinates include map hexes (excluding player position)", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0, position: { q: 0, r: 0 } })],
      });

      const result = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.basicEffect);
      const player = result.state.players.find((p) => p.id === PLAYER_ID);

      // Should have available coordinates from the map
      const coords = player?.pendingTerrainCostReduction?.availableCoordinates ?? [];
      expect(coords.length).toBeGreaterThan(0);

      // Player's current position should NOT be in the list
      const hasPlayerPos = coords.some((c) => c.q === 0 && c.r === 0);
      expect(hasPlayerPos).toBe(false);
    });
  });

  describe("AC2: Powered effect grants Move 4 and terrain selection", () => {
    it("resolving powered effect grants move points and sets pending terrain state", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0 })],
      });

      const result = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.poweredEffect);

      // Player should have gained 4 move points
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      expect(player?.movePoints).toBe(4);

      // Player should have pending terrain cost reduction state
      expect(player?.pendingTerrainCostReduction).not.toBeNull();
      expect(player?.pendingTerrainCostReduction?.mode).toBe("terrain");
      expect(player?.pendingTerrainCostReduction?.reduction).toBe(-1);
      expect(player?.pendingTerrainCostReduction?.minimumCost).toBe(2);
    });

    it("available terrains include all terrain types", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0 })],
      });

      const result = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.poweredEffect);
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      const terrains = player?.pendingTerrainCostReduction?.availableTerrains ?? [];

      expect(terrains).toContain(TERRAIN_PLAINS);
      expect(terrains).toContain(TERRAIN_HILLS);
      expect(terrains).toContain(TERRAIN_FOREST);
      expect(terrains).toContain(TERRAIN_WASTELAND);
      expect(terrains).toContain(TERRAIN_DESERT);
      expect(terrains).toContain(TERRAIN_SWAMP);
      expect(terrains).toContain(TERRAIN_LAKE);
      expect(terrains).toContain(TERRAIN_MOUNTAIN);
    });
  });

  describe("AC3: Hex selection applies coordinate-specific cost reduction", () => {
    it("selecting a hex reduces cost at that coordinate but not others", () => {
      // Set up state with pending hex selection and forest hexes
      const forestCoord: HexCoord = { q: 0, r: 1 };
      const otherForestCoord: HexCoord = { q: 1, r: 1 };

      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "hex",
              availableCoordinates: [forestCoord, otherForestCoord],
              availableTerrains: [],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey(forestCoord)]: createTestHex(forestCoord.q, forestCoord.r, TERRAIN_FOREST),
            [hexKey(otherForestCoord)]: createTestHex(otherForestCoord.q, otherForestCoord.r, TERRAIN_FOREST),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Select hex for cost reduction
      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: forestCoord,
      });
      const result = command.execute(state);

      // Cost at selected forest hex should be reduced: 3 - 1 = 2
      const costAtSelected = getEffectiveTerrainCost(
        result.state, TERRAIN_FOREST, PLAYER_ID, forestCoord
      );
      expect(costAtSelected).toBe(2);

      // Cost at other forest hex should be unchanged: 3
      const costAtOther = getEffectiveTerrainCost(
        result.state, TERRAIN_FOREST, PLAYER_ID, otherForestCoord
      );
      expect(costAtOther).toBe(3);
    });
  });

  describe("AC4: Terrain selection applies terrain-type cost reduction", () => {
    it("selecting a terrain reduces cost for all hexes of that type", () => {
      const forest1: HexCoord = { q: 0, r: 1 };
      const forest2: HexCoord = { q: 1, r: 1 };
      const plains1: HexCoord = { q: 1, r: 0 };

      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "terrain",
              availableCoordinates: [],
              availableTerrains: [TERRAIN_FOREST, TERRAIN_HILLS, TERRAIN_PLAINS],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey(forest1)]: createTestHex(forest1.q, forest1.r, TERRAIN_FOREST),
            [hexKey(forest2)]: createTestHex(forest2.q, forest2.r, TERRAIN_FOREST),
            [hexKey(plains1)]: createTestHex(plains1.q, plains1.r, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Select forest as the terrain type for reduction
      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });
      const result = command.execute(state);

      // Both forest hexes should have reduced cost: 3 - 1 = 2
      expect(getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forest1)).toBe(2);
      expect(getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forest2)).toBe(2);

      // Plains should be unaffected: cost remains 2
      expect(getEffectiveTerrainCost(result.state, TERRAIN_PLAINS, PLAYER_ID, plains1)).toBe(2);
    });
  });

  describe("AC5: Minimum cost of 2 enforced", () => {
    it("terrain that normally costs 3 is reduced to 2 (not below)", () => {
      // Forest costs 3 during day, -1 = 2 (min 2 enforced)
      const forestCoord: HexCoord = { q: 0, r: 1 };
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "hex",
              availableCoordinates: [forestCoord],
              availableTerrains: [],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: forestCoord,
      });
      const result = command.execute(state);

      // Forest 3 - 1 = 2 (min 2 satisfied)
      const cost = getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2);
    });

    it("terrain that normally costs 2 stays at 2 (minimum floor)", () => {
      // Plains costs 2 during day, -1 would be 1, but minimum 2 enforced
      const plainsCoord: HexCoord = { q: 1, r: 0 };
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "hex",
              availableCoordinates: [plainsCoord],
              availableTerrains: [],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: plainsCoord,
      });
      const result = command.execute(state);

      // Plains 2 - 1 = 1, but minimum 2 enforced → 2
      const cost = getEffectiveTerrainCost(result.state, TERRAIN_PLAINS, PLAYER_ID, plainsCoord);
      expect(cost).toBe(2);
    });

    it("terrain that costs more than 3 is reduced but stays above minimum", () => {
      // Desert costs 5 during day, -1 = 4 (above minimum 2)
      const desertCoord: HexCoord = { q: 2, r: 0 };
      const state = createTestGameState({
        players: [createTestPlayer({
          pendingTerrainCostReduction: {
            mode: "terrain",
            availableCoordinates: [],
            availableTerrains: [TERRAIN_DESERT],
            reduction: -1,
            minimumCost: 2,
          },
        })],
      });

      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_DESERT,
      });
      const result = command.execute(state);

      // Desert 5 - 1 = 4
      const cost = getEffectiveTerrainCost(result.state, TERRAIN_DESERT, PLAYER_ID, desertCoord);
      expect(cost).toBe(4);
    });
  });

  describe("AC6: Cost reduction persists for entire turn", () => {
    it("modifier has DURATION_TURN scope", () => {
      const forestCoord: HexCoord = { q: 0, r: 1 };
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "hex",
              availableCoordinates: [forestCoord],
              availableTerrains: [],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: forestCoord,
      });
      const result = command.execute(state);

      expect(result.state.activeModifiers).toHaveLength(1);
      expect(result.state.activeModifiers[0]!.duration).toBe(DURATION_TURN);
    });

    it("cost remains reduced after multiple queries (simulates multiple moves)", () => {
      const forestCoord: HexCoord = { q: 0, r: 1 };
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "hex",
              availableCoordinates: [forestCoord],
              availableTerrains: [],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
      });

      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: forestCoord,
      });
      const result = command.execute(state);

      // Query cost multiple times — should remain reduced
      const cost1 = getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      const cost2 = getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      const cost3 = getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost1).toBe(2);
      expect(cost2).toBe(2);
      expect(cost3).toBe(2);
    });

    it("terrain-type reduction persists for all hexes of that type", () => {
      const state = createTestGameState({
        players: [
          createTestPlayer({
            pendingTerrainCostReduction: {
              mode: "terrain",
              availableCoordinates: [],
              availableTerrains: [TERRAIN_FOREST],
              reduction: -1,
              minimumCost: 2,
            },
          }),
        ],
      });

      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });
      const result = command.execute(state);

      // Different forest coordinates should all get the reduction
      const coord1: HexCoord = { q: 0, r: 1 };
      const coord2: HexCoord = { q: 2, r: 3 };
      const coord3: HexCoord = { q: -1, r: 2 };

      expect(getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, coord1)).toBe(2);
      expect(getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, coord2)).toBe(2);
      expect(getEffectiveTerrainCost(result.state, TERRAIN_FOREST, PLAYER_ID, coord3)).toBe(2);
    });
  });

  describe("AC7: Works with other movement modifiers (stacking rules)", () => {
    it("stacks with replacement modifier (Mist Form sets cost to 2)", () => {
      const baseState = createTestGameState();
      const forestCoord: HexCoord = { q: 0, r: 1 };

      // Apply Mist Form modifier (replacement: all terrain costs 2)
      let state = addModifier(baseState, {
        source: { type: SOURCE_CARD, cardId: "mist_form" as CardId, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: 0,
          minimum: 0,
          replaceCost: 2,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Apply Druidic Paths hex reduction
      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: forestCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // At the selected hex: Mist Form sets to 2, then Druidic Paths -1 = 1
      // But Druidic Paths minimum is 2, so final = max(2, 1) = 2
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2);
    });

    it("stacks additively with unit terrain modifiers (e.g., Foresters)", () => {
      const baseState = createTestGameState();
      const forestCoord: HexCoord = { q: 0, r: 1 };

      // Apply Foresters-like unit modifier: forest -1, minimum 0
      let state = addModifier(baseState, {
        source: { type: SOURCE_CARD, cardId: "foresters" as CardId, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Apply Druidic Paths hex reduction
      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: forestCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // At the selected hex: Forest base 3, Foresters -1 = 2, Druidic -1 = 1
      // But Druidic minimum is 2 → max(2, 1) = 2
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2);
    });

    it("terrain-type reduction stacks additively with unit modifiers", () => {
      const baseState = createTestGameState();
      const forestCoord: HexCoord = { q: 0, r: 1 };

      // Apply Foresters: forest -1, min 0
      let state = addModifier(baseState, {
        source: { type: SOURCE_CARD, cardId: "foresters" as CardId, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Apply Druidic Paths terrain reduction (forest -1, min 2)
      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 2,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Forest base 3, Foresters -1, Druidic -1 = 1
      // But Druidic minimum is 2, so max(2, 1) = 2
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2);
    });

    it("does not produce negative costs", () => {
      const baseState = createTestGameState();
      const plainsCoord: HexCoord = { q: 1, r: 0 };

      // Multiple reductions on plains (cost 2)
      let state = addModifier(baseState, {
        source: { type: SOURCE_CARD, cardId: "unit1" as CardId, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_PLAINS,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      state = addModifier(state, {
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: plainsCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Plains 2 - 1 - 1 = 0, but minimum 2 enforced → 2
      const cost = getEffectiveTerrainCost(state, TERRAIN_PLAINS, PLAYER_ID, plainsCoord);
      expect(cost).toBe(2);
    });
  });

  describe("Edge cases", () => {
    it("hex cost reduction does not affect non-matching hexes", () => {
      const baseState = createTestGameState();
      const selectedCoord: HexCoord = { q: 0, r: 1 };
      const otherCoord: HexCoord = { q: 1, r: 0 };

      const state = addModifier(baseState, {
        source: { type: SOURCE_CARD, cardId: CARD_BRAEVALAR_DRUIDIC_PATHS, playerId: PLAYER_ID },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: selectedCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: PLAYER_ID,
      });

      // Cost at other coordinate should be unaffected
      const costAtOther = getEffectiveTerrainCost(state, TERRAIN_FOREST, PLAYER_ID, otherCoord);
      expect(costAtOther).toBe(3); // Forest default

      // Cost at selected coordinate should be reduced
      const costAtSelected = getEffectiveTerrainCost(state, TERRAIN_FOREST, PLAYER_ID, selectedCoord);
      expect(costAtSelected).toBe(2); // 3 - 1 = 2 (min 2)
    });

    it("effect resolution with no hexes on map still works", () => {
      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0 })],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Should not throw even with minimal map
      const result = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.basicEffect);
      const player = result.state.players.find((p) => p.id === PLAYER_ID);
      expect(player?.pendingTerrainCostReduction?.mode).toBe("hex");
      // No hexes other than player position, so empty list
      expect(player?.pendingTerrainCostReduction?.availableCoordinates).toHaveLength(0);
    });

    it("full flow: resolve basic effect → select hex → verify cost reduction", () => {
      const forestCoord: HexCoord = { q: 0, r: 1 };

      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0, position: { q: 0, r: 0 } })],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey(forestCoord)]: createTestHex(forestCoord.q, forestCoord.r, TERRAIN_FOREST),
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      // Step 1: Resolve effect
      const effectResult = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.basicEffect);
      const playerAfterEffect = effectResult.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(playerAfterEffect.movePoints).toBe(2);
      expect(playerAfterEffect.pendingTerrainCostReduction?.mode).toBe("hex");

      // Step 2: Select hex
      const command = createResolveHexCostReductionCommand({
        playerId: PLAYER_ID,
        coordinate: forestCoord,
      });
      const selectResult = command.execute(effectResult.state);
      const playerAfterSelect = selectResult.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(playerAfterSelect.pendingTerrainCostReduction).toBeNull();

      // Step 3: Verify cost reduction
      const cost = getEffectiveTerrainCost(selectResult.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2); // 3 - 1 = 2
    });

    it("full flow: resolve powered effect → select terrain → verify cost reduction", () => {
      const forestCoord: HexCoord = { q: 0, r: 1 };

      const state = createTestGameState({
        players: [createTestPlayer({ movePoints: 0, position: { q: 0, r: 0 } })],
      });

      // Step 1: Resolve powered effect
      const effectResult = resolveEffect(state, PLAYER_ID, BRAEVALAR_DRUIDIC_PATHS.poweredEffect);
      const playerAfterEffect = effectResult.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(playerAfterEffect.movePoints).toBe(4);
      expect(playerAfterEffect.pendingTerrainCostReduction?.mode).toBe("terrain");

      // Step 2: Select forest terrain
      const command = createResolveTerrainCostReductionCommand({
        playerId: PLAYER_ID,
        terrain: TERRAIN_FOREST,
      });
      const selectResult = command.execute(effectResult.state);
      const playerAfterSelect = selectResult.state.players.find((p) => p.id === PLAYER_ID)!;
      expect(playerAfterSelect.pendingTerrainCostReduction).toBeNull();

      // Step 3: Verify cost reduction for any forest hex
      const cost = getEffectiveTerrainCost(selectResult.state, TERRAIN_FOREST, PLAYER_ID, forestCoord);
      expect(cost).toBe(2); // 3 - 1 = 2

      // Hills should still cost 3 (not selected)
      const hillsCost = getEffectiveTerrainCost(
        selectResult.state, TERRAIN_HILLS, PLAYER_ID, { q: -1, r: 0 }
      );
      expect(hillsCost).toBe(3);
    });
  });
});
