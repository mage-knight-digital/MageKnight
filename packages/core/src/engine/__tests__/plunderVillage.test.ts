/**
 * Plunder village tests
 *
 * Tests for:
 * - Validation: must be at village, haven't plundered this turn
 * - Execution: reputation loss, card draw
 * - Undo: state restoration
 * - Turn reset: flag cleared at end of turn
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex, createVillageSite } from "./testHelpers.js";
import {
  PLUNDER_VILLAGE_ACTION,
  INVALID_ACTION,
  VILLAGE_PLUNDERED,
  REPUTATION_CHANGED,
  CARD_DRAWN,
  TERRAIN_PLAINS,
  hexKey,
  REPUTATION_REASON_PLUNDER_VILLAGE,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Helper to create a monastery site (for testing "not at village")
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
 * Create test state with player at a village
 */
function createStateAtVillage(
  stateOverrides: Partial<GameState> = {},
  playerOverrides: Parameters<typeof createTestPlayer>[0] = {}
): GameState {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    movePoints: 0,
    deck: ["card1" as CardId, "card2" as CardId, "card3" as CardId, "card4" as CardId],
    hand: ["handCard1" as CardId],
    reputation: 0,
    ...playerOverrides,
  });

  const villageHex = createTestHex(0, 0, TERRAIN_PLAINS, createVillageSite());

  return createTestGameState({
    players: [player],
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: villageHex,
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
    ...stateOverrides,
  });
}

describe("Plunder Village", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("validation", () => {
    it("rejects plunder if not at a village", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
      });

      const monasteryHex = createTestHex(0, 0, TERRAIN_PLAINS, createMonasterySite());

      const state = createTestGameState({
        players: [player],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: monasteryHex,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects plunder if player already plundered this turn", () => {
      const state = createStateAtVillage({}, {
        hasPlunderedThisTurn: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects plunder if not players turn", () => {
      const state = createStateAtVillage({
        currentPlayerIndex: 1, // Not player1's turn
        players: [
          createTestPlayer({
            id: "player1",
            position: { q: 0, r: 0 },
          }),
          createTestPlayer({
            id: "player2",
            position: { q: 1, r: 0 },
          }),
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects plunder if player has already taken action this turn", () => {
      // Plundering is a "before turn" action - must be done before any other action
      const state = createStateAtVillage({}, {
        hasTakenActionThisTurn: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects plunder if player has already moved this turn", () => {
      // Plundering is a "before turn" action - must be done before moving
      const state = createStateAtVillage({}, {
        hasMovedThisTurn: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });
  });

  describe("execution", () => {
    it("emits VILLAGE_PLUNDERED event", () => {
      const state = createStateAtVillage();

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: VILLAGE_PLUNDERED,
          playerId: "player1",
          hexCoord: { q: 0, r: 0 },
          cardsDrawn: 2,
        })
      );
    });

    it("reduces reputation by 1", () => {
      const state = createStateAtVillage({}, {
        reputation: 3,
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Should emit REPUTATION_CHANGED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          newValue: 2,
          reason: REPUTATION_REASON_PLUNDER_VILLAGE,
        })
      );

      // Player reputation should be 2
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.reputation).toBe(2);
    });

    it("draws 2 cards from deck", () => {
      const state = createStateAtVillage({}, {
        deck: ["card1" as CardId, "card2" as CardId, "card3" as CardId],
        hand: ["handCard1" as CardId],
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Should emit CARD_DRAWN
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_DRAWN,
          playerId: "player1",
          count: 2,
        })
      );

      // Player should have 3 cards in hand (1 original + 2 drawn)
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hand.length).toBe(3);
      expect(player?.hand).toContain("handCard1" as CardId);
      expect(player?.hand).toContain("card1" as CardId);
      expect(player?.hand).toContain("card2" as CardId);

      // Deck should have 1 card left
      expect(player?.deck.length).toBe(1);
      expect(player?.deck).toContain("card3" as CardId);
    });

    it("draws only available cards if deck has fewer than 2", () => {
      const state = createStateAtVillage({}, {
        deck: ["onlyCard" as CardId],
        hand: [],
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Should emit CARD_DRAWN with count 1
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_DRAWN,
          playerId: "player1",
          count: 1,
        })
      );

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hand.length).toBe(1);
      expect(player?.deck.length).toBe(0);
    });

    it("draws no cards if deck is empty", () => {
      const state = createStateAtVillage({}, {
        deck: [],
        hand: ["handCard1" as CardId],
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Should still emit VILLAGE_PLUNDERED (plundering still happens)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: VILLAGE_PLUNDERED,
          cardsDrawn: 0,
        })
      );

      // Should NOT emit CARD_DRAWN with count 0
      const cardDrawnEvent = result.events.find(
        (e) => e.type === CARD_DRAWN && "count" in e && e.count === 0
      );
      expect(cardDrawnEvent).toBeUndefined();

      // Hand should be unchanged
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hand.length).toBe(1);
    });

    it("sets hasPlunderedThisTurn flag", () => {
      const state = createStateAtVillage();

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hasPlunderedThisTurn).toBe(true);
    });

    it("reputation does not go below -7", () => {
      const state = createStateAtVillage({}, {
        reputation: -7,
      });

      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Reputation change event should show -7 to -7
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: -1,
          newValue: -7, // Capped at -7
        })
      );

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.reputation).toBe(-7);
    });
  });

  describe("undo", () => {
    it("can be undone to restore previous state", () => {
      const state = createStateAtVillage({}, {
        deck: ["card1" as CardId, "card2" as CardId, "card3" as CardId],
        hand: ["handCard1" as CardId],
        reputation: 2,
      });

      // Execute plunder
      const result = engine.processAction(state, "player1", {
        type: PLUNDER_VILLAGE_ACTION,
      });

      // Verify plunder happened
      const playerAfterPlunder = result.state.players.find((p) => p.id === "player1");
      expect(playerAfterPlunder?.reputation).toBe(1);
      expect(playerAfterPlunder?.hand.length).toBe(3);
      expect(playerAfterPlunder?.hasPlunderedThisTurn).toBe(true);

      // Undo the plunder
      const undoResult = engine.processAction(result.state, "player1", {
        type: "UNDO",
      });

      // Verify state is restored
      const playerAfterUndo = undoResult.state.players.find((p) => p.id === "player1");
      expect(playerAfterUndo?.reputation).toBe(2);
      expect(playerAfterUndo?.hand.length).toBe(1);
      expect(playerAfterUndo?.hasPlunderedThisTurn).toBe(false);
      expect(playerAfterUndo?.deck.length).toBe(3);
    });
  });
});
