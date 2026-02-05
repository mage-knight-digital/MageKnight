/**
 * Terrain Cost Modifier Tests
 *
 * Tests for:
 * - Coordinate-specific terrain cost modifiers
 * - Terrain-type modifiers (existing functionality)
 * - Stacking of multiple modifiers
 * - Minimum cost enforcement
 * - Priority order: replaceCost → additive → minimum
 */

import { describe, it, expect } from "bun:test";
import {
  createTestGameState,
} from "./testHelpers.js";
import {
  getEffectiveTerrainCost,
} from "../modifiers/terrain.js";
import { addModifier } from "../modifiers/index.js";
import {
  TERRAIN_PLAINS,
  TERRAIN_FOREST,
} from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  TERRAIN_ALL,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import type { CardId, HexCoord } from "@mage-knight/shared";

const playerId = "player1";

describe("Terrain Cost Modifiers", () => {
  describe("Coordinate-specific modifiers", () => {
    it("applies coordinate-specific modifier only to matching coordinate", () => {
      const baseState = createTestGameState();
      const coord1: HexCoord = { q: 0, r: 0 };
      const coord2: HexCoord = { q: 1, r: 0 };

      // Apply coordinate-specific modifier to coord1
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "druidic_paths" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: coord1,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Cost at coord1 should be reduced by 1
      const costAt1 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord1);
      // Forest normally costs 3 (day), with -1 reduction = 2, but minimum is 2
      expect(costAt1).toBe(2);

      // Cost at coord2 should be unaffected (uses default)
      const costAt2 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord2);
      expect(costAt2).toBe(3); // Forest default
    });

    it("does not apply coordinate-specific modifier when no coordinate provided", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "druidic_paths" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -2,
          minimum: 0,
          specificCoordinate: coord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // When called without coordinate, should not include coordinate-specific modifier
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId);
      expect(cost).toBe(3); // Forest default, unchanged
    });

    it("does not apply coordinate-specific modifier to different coordinates", () => {
      const baseState = createTestGameState();
      const targetCoord: HexCoord = { q: 1, r: 1 };
      const otherCoord: HexCoord = { q: 2, r: 2 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "druidic_paths" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_PLAINS,
          amount: -1,
          minimum: 0,
          specificCoordinate: targetCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Should not apply to different coordinate
      const cost = getEffectiveTerrainCost(state, TERRAIN_PLAINS, playerId, otherCoord);
      expect(cost).toBe(2); // Plains default, unchanged
    });
  });

  describe("Terrain-type modifiers (backward compatibility)", () => {
    it("applies terrain-type modifier to all hexes of that terrain", () => {
      const baseState = createTestGameState();
      const coord1: HexCoord = { q: 0, r: 0 };
      const coord2: HexCoord = { q: 1, r: 1 };

      // Apply terrain-type modifier
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Should apply to all forest hexes
      const costAt1 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord1);
      const costAt2 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord2);

      expect(costAt1).toBe(2); // Forest normally 3, with -1 = 2
      expect(costAt2).toBe(2); // Same terrain type, same reduction
    });

    it("terrain-type modifier without coordinate still works", () => {
      const baseState = createTestGameState();

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Should apply when no coordinate is provided
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId);
      expect(cost).toBe(2); // Forest normally 3, with -1 = 2
    });
  });

  describe("Stacking multiple modifiers", () => {
    it("stacks coordinate-specific and terrain-type modifiers", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      // Apply terrain-type modifier
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "card1" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Apply coordinate-specific modifier for the same terrain
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "card2" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
          specificCoordinate: coord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Both should apply
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(1); // Forest normally 3, -1 from terrain type, -1 from coordinate = 1
    });

    it("does not double-apply when coordinate matches but no specificCoordinate set", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      // Apply terrain-type modifier
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "card1" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Should apply only once
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(2); // Forest normally 3, -1 = 2 (not double applied)
    });

    it("multiple coordinate-specific modifiers for different hexes", () => {
      const baseState = createTestGameState();
      const coord1: HexCoord = { q: 0, r: 0 };
      const coord2: HexCoord = { q: 1, r: 1 };

      // Apply modifier to coord1
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "card1" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 0,
          specificCoordinate: coord1,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Apply separate modifier to coord2
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "card2" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -2,
          minimum: 0,
          specificCoordinate: coord2,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Each should apply its own reduction
      const costAt1 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord1);
      const costAt2 = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord2);

      expect(costAt1).toBe(2); // 3 + (-1) = 2
      expect(costAt2).toBe(1); // 3 + (-2) = 1
    });
  });

  describe("Minimum cost enforcement", () => {
    it("enforces minimum cost from additive modifiers", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -5, // Large reduction
          minimum: 2, // Minimum enforced
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(2); // Would be negative, but minimum enforced
    });

    it("enforces minimum with coordinate-specific modifier", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "druidic_paths" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 2,
          specificCoordinate: coord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(2); // Forest costs 2, -1 = 1, but minimum is 2
    });

    it("uses highest minimum when multiple modifiers apply", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      // First modifier with minimum 1
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "card1" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Second modifier with minimum 3
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "card2" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 3,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(3); // Highest minimum (3) is enforced
    });
  });

  describe("Priority order: replaceCost → additive → minimum", () => {
    it("replaceCost takes priority over additive modifiers", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      // Apply replaceCost modifier (e.g., Mist Form)
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "mist_form" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: 0, // Ignored when replaceCost is set
          minimum: 0,
          replaceCost: 2,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // Apply additive modifier on top
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "druidic_paths" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -1,
          minimum: 0,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // replaceCost (2) + additive (-1) = 1
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(1);
    });

    it("minimum is enforced after replaceCost and additive", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      // Apply replaceCost (2)
      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "mist_form" as CardId,
          playerId,
        },
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
        createdByPlayerId: playerId,
      });

      // Apply additive (-3, which would go below minimum)
      state = addModifier(state, {
        source: {
          type: SOURCE_CARD,
          cardId: "card2" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_ALL,
          amount: -3,
          minimum: 1,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // replaceCost 2 + additive (-3) = -1, but minimum 1 enforced
      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(1);
    });
  });

  describe("Edge cases", () => {
    it("handles zero-coordinate correctly", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: 0, r: 0 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
          specificCoordinate: coord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(2);
    });

    it("handles negative coordinates", () => {
      const baseState = createTestGameState();
      const coord: HexCoord = { q: -5, r: -3 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -1,
          minimum: 0,
          specificCoordinate: coord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      const cost = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, coord);
      expect(cost).toBe(2);
    });

    it("no modifiers returns default cost", () => {
      const baseState = createTestGameState();
      const cost = getEffectiveTerrainCost(baseState, TERRAIN_FOREST, playerId);
      expect(cost).toBe(3); // Forest default
    });

    it("coordinate-only modifier filters out non-matching", () => {
      const baseState = createTestGameState();
      const targetCoord: HexCoord = { q: 1, r: 1 };
      const otherCoord: HexCoord = { q: 2, r: 2 };

      let state = addModifier(baseState, {
        source: {
          type: SOURCE_CARD,
          cardId: "test_card" as CardId,
          playerId,
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_TERRAIN_COST,
          terrain: TERRAIN_FOREST,
          amount: -5,
          minimum: 0,
          specificCoordinate: targetCoord,
        },
        createdAtRound: 1,
        createdByPlayerId: playerId,
      });

      // At target coord: -5 applied, but minimum 0 enforced
      const costAtTarget = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, targetCoord);
      expect(costAtTarget).toBe(0); // 3 + (-5) = -2, but minimum 0 enforced

      // At other coord: modifier not applied
      const costAtOther = getEffectiveTerrainCost(state, TERRAIN_FOREST, playerId, otherCoord);
      expect(costAtOther).toBe(3); // No reduction
    });
  });
});
