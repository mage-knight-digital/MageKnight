/**
 * Tests for Monastery Advanced Action drawing on tile reveal
 *
 * When a tile containing a monastery is explored, an Advanced Action
 * should be drawn from the AA deck and added to the monastery offer.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";
import { TileId, SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import {
  EXPLORE_ACTION,
  TILE_EXPLORED,
  MONASTERY_AA_REVEALED,
  hexKey,
  TERRAIN_PLAINS,
  type CardId,
} from "@mage-knight/shared";
import {
  hasMonasterySite,
  countMonasteries,
  drawMonasteryAdvancedAction,
} from "../helpers/monasteryHelpers.js";
import { placeTile } from "../../data/tiles/index.js";
import { createEmptyOffers } from "../../types/offers.js";
import { createEmptyDecks } from "../../types/decks.js";

describe("Monastery AA drawing", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a monastery site for testing
   */
  function createMonasterySite(): Site {
    return {
      type: SiteType.Monastery,
      owner: null,
      isConquered: false,
      isBurned: false,
    };
  }

  /**
   * Create a game state with player on edge of map ready to explore
   * Includes a populated AA deck for testing
   */
  function createExploreStateWithAAs(
    tileIds: TileId[],
    aaDeck: readonly CardId[] = ["blood_rage" as CardId, "fire_bolt" as CardId, "ice_bolt" as CardId]
  ): GameState {
    const player = createTestPlayer({
      id: "player1",
      position: { q: 1, r: 0 },
      movePoints: 4,
    });

    const baseState = createTestGameState();

    // Only two hexes revealed - player is on edge
    const hexes: Record<string, ReturnType<typeof createTestHex>> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
    };

    return {
      ...baseState,
      players: [player],
      map: {
        ...baseState.map,
        hexes,
        tileDeck: {
          countryside: tileIds,
          core: [],
        },
      },
      decks: {
        ...baseState.decks,
        advancedActions: aaDeck,
      },
      offers: {
        ...baseState.offers,
        monasteryAdvancedActions: [],
      },
    };
  }

  describe("hasMonasterySite helper", () => {
    it("should return true when hexes contain a monastery", () => {
      const hexes = [
        createTestHex(0, 0, TERRAIN_PLAINS),
        createTestHex(1, 0, TERRAIN_PLAINS, createMonasterySite()),
      ];

      expect(hasMonasterySite(hexes)).toBe(true);
    });

    it("should return false when hexes do not contain a monastery", () => {
      const hexes = [
        createTestHex(0, 0, TERRAIN_PLAINS),
        createTestHex(1, 0, TERRAIN_PLAINS),
      ];

      expect(hasMonasterySite(hexes)).toBe(false);
    });
  });

  describe("countMonasteries helper", () => {
    it("should count zero monasteries when none present", () => {
      const hexes = [
        createTestHex(0, 0, TERRAIN_PLAINS),
        createTestHex(1, 0, TERRAIN_PLAINS),
      ];

      expect(countMonasteries(hexes)).toBe(0);
    });

    it("should count one monastery correctly", () => {
      const hexes = [
        createTestHex(0, 0, TERRAIN_PLAINS),
        createTestHex(1, 0, TERRAIN_PLAINS, createMonasterySite()),
      ];

      expect(countMonasteries(hexes)).toBe(1);
    });

    it("should count multiple monasteries correctly", () => {
      const hexes = [
        createTestHex(0, 0, TERRAIN_PLAINS, createMonasterySite()),
        createTestHex(1, 0, TERRAIN_PLAINS),
        createTestHex(2, 0, TERRAIN_PLAINS, createMonasterySite()),
      ];

      expect(countMonasteries(hexes)).toBe(2);
    });
  });

  describe("drawMonasteryAdvancedAction helper", () => {
    it("should draw AA from deck and add to monastery offer", () => {
      const offers = {
        ...createEmptyOffers(),
        monasteryAdvancedActions: [],
      };
      const decks = {
        ...createEmptyDecks(),
        advancedActions: ["blood_rage" as CardId, "fire_bolt" as CardId],
      };

      const result = drawMonasteryAdvancedAction(offers, decks);

      expect(result.cardId).toBe("blood_rage");
      expect(result.offers.monasteryAdvancedActions).toContain("blood_rage");
      expect(result.offers.monasteryAdvancedActions).toHaveLength(1);
      expect(result.decks.advancedActions).not.toContain("blood_rage");
      expect(result.decks.advancedActions).toHaveLength(1);
    });

    it("should return null cardId when AA deck is empty", () => {
      const offers = {
        ...createEmptyOffers(),
        monasteryAdvancedActions: [],
      };
      const decks = {
        ...createEmptyDecks(),
        advancedActions: [],
      };

      const result = drawMonasteryAdvancedAction(offers, decks);

      expect(result.cardId).toBeNull();
      expect(result.offers.monasteryAdvancedActions).toHaveLength(0);
    });

    it("should preserve existing monastery AAs when adding new one", () => {
      const offers = {
        ...createEmptyOffers(),
        monasteryAdvancedActions: ["ice_bolt" as CardId],
      };
      const decks = {
        ...createEmptyDecks(),
        advancedActions: ["blood_rage" as CardId],
      };

      const result = drawMonasteryAdvancedAction(offers, decks);

      expect(result.offers.monasteryAdvancedActions).toHaveLength(2);
      expect(result.offers.monasteryAdvancedActions).toContain("ice_bolt");
      expect(result.offers.monasteryAdvancedActions).toContain("blood_rage");
    });
  });

  describe("explore command integration", () => {
    it("should draw AA when exploring tile with monastery (Countryside5)", () => {
      // Countryside5 has a monastery at the NE hex
      const state = createExploreStateWithAAs([TileId.Countryside5]);

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should have TILE_EXPLORED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TILE_EXPLORED,
          tileId: TileId.Countryside5,
        })
      );

      // Should have MONASTERY_AA_REVEALED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MONASTERY_AA_REVEALED,
          cardId: "blood_rage", // First card in deck
        })
      );

      // Monastery offer should have the drawn AA
      expect(result.state.offers.monasteryAdvancedActions).toContain("blood_rage");
      expect(result.state.offers.monasteryAdvancedActions).toHaveLength(1);

      // AA deck should have the card removed
      expect(result.state.decks.advancedActions).not.toContain("blood_rage");
    });

    it("should not draw AA when exploring tile without monastery (Countryside3)", () => {
      // Countryside3 does not have a monastery
      const state = createExploreStateWithAAs([TileId.Countryside3]);

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should have TILE_EXPLORED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TILE_EXPLORED,
          tileId: TileId.Countryside3,
        })
      );

      // Should NOT have MONASTERY_AA_REVEALED event
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: MONASTERY_AA_REVEALED,
        })
      );

      // Monastery offer should remain empty
      expect(result.state.offers.monasteryAdvancedActions).toHaveLength(0);

      // AA deck should be unchanged
      expect(result.state.decks.advancedActions).toHaveLength(3);
    });

    it("should handle empty AA deck gracefully", () => {
      // Countryside5 has a monastery, but AA deck is empty
      const state = createExploreStateWithAAs([TileId.Countryside5], []);

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should have TILE_EXPLORED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TILE_EXPLORED,
          tileId: TileId.Countryside5,
        })
      );

      // Should NOT have MONASTERY_AA_REVEALED event (no card to draw)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: MONASTERY_AA_REVEALED,
        })
      );

      // Monastery offer should remain empty
      expect(result.state.offers.monasteryAdvancedActions).toHaveLength(0);
    });

    it("should emit event with correct cardId", () => {
      const customDeck = ["custom_card" as CardId, "other_card" as CardId];
      const state = createExploreStateWithAAs([TileId.Countryside5], customDeck);

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Event should have the first card from the deck
      const monasteryEvent = result.events.find(
        (e) => e.type === MONASTERY_AA_REVEALED
      );
      expect(monasteryEvent).toBeDefined();
      expect((monasteryEvent as { cardId: CardId }).cardId).toBe("custom_card");
    });

    it("should preserve state immutability", () => {
      const state = createExploreStateWithAAs([TileId.Countryside5]);
      const originalDeckLength = state.decks.advancedActions.length;
      const originalMonasteryOfferLength = state.offers.monasteryAdvancedActions.length;

      engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Original state should not be mutated
      expect(state.decks.advancedActions).toHaveLength(originalDeckLength);
      expect(state.offers.monasteryAdvancedActions).toHaveLength(originalMonasteryOfferLength);
    });
  });

  describe("tile definition verification", () => {
    it("Countryside5 should have a monastery", () => {
      // Verify our test tile actually has a monastery
      const hexes = placeTile(TileId.Countryside5, { q: 0, r: 0 });
      expect(hasMonasterySite(hexes)).toBe(true);
      expect(countMonasteries(hexes)).toBe(1);
    });

    it("Countryside7 should have a monastery", () => {
      const hexes = placeTile(TileId.Countryside7, { q: 0, r: 0 });
      expect(hasMonasterySite(hexes)).toBe(true);
      expect(countMonasteries(hexes)).toBe(1);
    });

    it("Core1 should have a monastery", () => {
      const hexes = placeTile(TileId.Core1, { q: 0, r: 0 });
      expect(hasMonasterySite(hexes)).toBe(true);
      expect(countMonasteries(hexes)).toBe(1);
    });

    it("Countryside3 should not have a monastery", () => {
      const hexes = placeTile(TileId.Countryside3, { q: 0, r: 0 });
      expect(hasMonasterySite(hexes)).toBe(false);
      expect(countMonasteries(hexes)).toBe(0);
    });
  });
});
