/**
 * Round Cycle tests
 *
 * Tests for:
 * - Announcing end of round
 * - Final turn tracking
 * - Round end processing (day/night toggle, mana reset, unit readying, deck reshuffle)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import {
  ANNOUNCE_END_OF_ROUND_ACTION,
  END_TURN_ACTION,
  MOVE_ACTION,
  END_OF_ROUND_ANNOUNCED,
  ROUND_ENDED,
  NEW_ROUND_STARTED,
  TIME_OF_DAY_CHANGED,
  MANA_SOURCE_RESET,
  DECKS_RESHUFFLED,
  UNITS_READIED,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  INVALID_ACTION,
  CARD_MARCH,
  CARD_STAMINA,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { UNIT_STATE_SPENT, UNIT_STATE_READY } from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import type { UnitId } from "@mage-knight/shared";

describe("Round Cycle", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Announce end of round", () => {
    it("should allow announcement when deck is empty", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [], // Empty deck
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        endOfRoundAnnouncedBy: null,
      });

      const result = engine.processAction(state, "player1", {
        type: ANNOUNCE_END_OF_ROUND_ACTION,
      });

      expect(result.state.endOfRoundAnnouncedBy).toBe("player1");
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: END_OF_ROUND_ANNOUNCED,
          playerId: "player1",
        })
      );
    });

    it("should reject announcement when deck has cards", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [CARD_MARCH], // Not empty
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: ANNOUNCE_END_OF_ROUND_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("deck is empty"),
        })
      );
    });

    it("should reject announcement when already announced", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [],
      });
      const state = createTestGameState({
        players: [player],
        endOfRoundAnnouncedBy: "player1", // Already announced
      });

      const result = engine.processAction(state, "player1", {
        type: ANNOUNCE_END_OF_ROUND_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("already been announced"),
        })
      );
    });

    it("should set playersWithFinalTurn for other players", () => {
      const player1 = createTestPlayer({ id: "player1", deck: [] });
      const player2 = createTestPlayer({ id: "player2", deck: [CARD_MARCH] });
      const player3 = createTestPlayer({ id: "player3", deck: [CARD_STAMINA] });

      const state = createTestGameState({
        players: [player1, player2, player3],
        turnOrder: ["player1", "player2", "player3"],
        currentPlayerIndex: 0,
      });

      const result = engine.processAction(state, "player1", {
        type: ANNOUNCE_END_OF_ROUND_ACTION,
      });

      expect(result.state.endOfRoundAnnouncedBy).toBe("player1");
      expect(result.state.playersWithFinalTurn).toEqual(["player2", "player3"]);

      // Announcing player should have hasTakenActionThisTurn set (forfeited turn)
      const announcingPlayer = result.state.players.find(
        (p) => p.id === "player1"
      );
      expect(announcingPlayer?.hasTakenActionThisTurn).toBe(true);
    });
  });

  describe("Final turn tracking", () => {
    it("should remove player from final turn list when they end turn", () => {
      const player1 = createTestPlayer({ id: "player1", deck: [] });
      const player2 = createTestPlayer({ id: "player2", deck: [], hand: [CARD_MARCH] });

      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // Player 2's turn
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: ["player2"],
      });

      const result = engine.processAction(state, "player2", {
        type: END_TURN_ACTION,
      });

      // Player 2 was the last one, so round should end
      expect(result.state.playersWithFinalTurn).toEqual([]);
    });
  });

  describe("Round end processing", () => {
    it("should toggle day to night when announcing player ends turn", () => {
      const player = createTestPlayer({ id: "player1", deck: [], hand: [] });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(result.state.timeOfDay).toBe(TIME_OF_DAY_NIGHT);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TIME_OF_DAY_CHANGED,
          from: TIME_OF_DAY_DAY,
          to: TIME_OF_DAY_NIGHT,
        })
      );
    });

    it("should toggle night to day", () => {
      const player = createTestPlayer({ id: "player1", deck: [], hand: [] });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(result.state.timeOfDay).toBe(TIME_OF_DAY_DAY);
    });

    it("should reset mana source", () => {
      const player = createTestPlayer({ id: "player1", deck: [], hand: [] });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
        source: { dice: [] },
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Should have playerCount + 2 dice (1 + 2 = 3)
      expect(result.state.source.dice.length).toBe(3);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MANA_SOURCE_RESET,
          diceCount: 3,
        })
      );
    });

    it("should ready all units including wounded", () => {
      const spentUnit: PlayerUnit = {
        instanceId: "unit1",
        unitId: "peasants" as UnitId,
        state: UNIT_STATE_SPENT,
        wounded: false,
        usedResistanceThisCombat: false,
      };
      const woundedSpentUnit: PlayerUnit = {
        instanceId: "unit2",
        unitId: "foresters" as UnitId,
        state: UNIT_STATE_SPENT,
        wounded: true,
        usedResistanceThisCombat: true,
      };

      const player = createTestPlayer({
        id: "player1",
        deck: [],
        hand: [],
        units: [spentUnit, woundedSpentUnit],
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer).toBeDefined();

      // Both units should be ready
      expect(updatedPlayer?.units[0]?.state).toBe(UNIT_STATE_READY);
      expect(updatedPlayer?.units[1]?.state).toBe(UNIT_STATE_READY);

      // Wounded unit should still be wounded (wounds don't heal at round end)
      expect(updatedPlayer?.units[0]?.wounded).toBe(false);
      expect(updatedPlayer?.units[1]?.wounded).toBe(true);

      // Resistance tracking should be cleared
      expect(updatedPlayer?.units[0]?.usedResistanceThisCombat).toBe(false);
      expect(updatedPlayer?.units[1]?.usedResistanceThisCombat).toBe(false);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: UNITS_READIED,
          playerId: "player1",
          unitCount: 2,
        })
      );
    });

    it("should reshuffle decks and draw to hand limit", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [],
        hand: [CARD_MARCH],
        discard: [CARD_STAMINA],
        playArea: [],
        handLimit: 5,
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer).toBeDefined();

      // All 2 cards should be accounted for
      const totalCards =
        (updatedPlayer?.hand.length ?? 0) +
        (updatedPlayer?.deck.length ?? 0) +
        (updatedPlayer?.discard.length ?? 0);
      expect(totalCards).toBe(2);

      // Hand should have up to hand limit (2 cards available, limit is 5, so should have 2)
      expect(updatedPlayer?.hand.length).toBe(2);
      // Deck should have remaining cards
      expect(updatedPlayer?.deck.length).toBe(0);
      // Discard should be empty after reshuffle
      expect(updatedPlayer?.discard.length).toBe(0);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DECKS_RESHUFFLED,
          playerId: "player1",
        })
      );
    });

    it("should increment round number", () => {
      const player = createTestPlayer({ id: "player1", deck: [], hand: [] });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
        round: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(result.state.round).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ROUND_ENDED,
          round: 1,
        })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: NEW_ROUND_STARTED,
          roundNumber: 2,
        })
      );
    });

    it("should reset round tracking state", () => {
      const player = createTestPlayer({ id: "player1", deck: [], hand: [] });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: [],
      });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(result.state.endOfRoundAnnouncedBy).toBeNull();
      expect(result.state.playersWithFinalTurn).toEqual([]);
      expect(result.state.currentPlayerIndex).toBe(0);
    });
  });

  describe("Multi-player round end flow", () => {
    it("should NOT trigger round end when announcer ends turn", () => {
      // Setup: 3 players, player1 announces, player2 and player3 get final turns
      const player1 = createTestPlayer({ id: "player1", deck: [] });
      const player2 = createTestPlayer({ id: "player2", deck: [], hand: [CARD_MARCH] });
      const player3 = createTestPlayer({ id: "player3", deck: [], hand: [CARD_STAMINA] });

      let state: GameState = createTestGameState({
        players: [player1, player2, player3],
        turnOrder: ["player1", "player2", "player3"],
        currentPlayerIndex: 0,
        round: 1,
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Player 1 announces end of round
      const announceResult = engine.processAction(state, "player1", {
        type: ANNOUNCE_END_OF_ROUND_ACTION,
      });
      state = announceResult.state;
      expect(state.endOfRoundAnnouncedBy).toBe("player1");
      expect(state.playersWithFinalTurn).toEqual(["player2", "player3"]);

      // Player 1 ends turn - should NOT trigger round end yet
      // (other players still need their final turns)
      const player1EndResult = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Round should NOT have ended - still waiting for final turns
      expect(player1EndResult.state.round).toBe(1);
      expect(player1EndResult.state.timeOfDay).toBe(TIME_OF_DAY_DAY);
      expect(player1EndResult.state.endOfRoundAnnouncedBy).toBe("player1");
      // Final turn list should still have both players
      expect(player1EndResult.state.playersWithFinalTurn).toEqual(["player2", "player3"]);
    });

    it("should trigger round end only after ALL final turns complete", () => {
      // Setup: 3 players, announcement already made, player2 and player3 have final turns
      const player1 = createTestPlayer({ id: "player1", deck: [], hasTakenActionThisTurn: true });
      const player2 = createTestPlayer({ id: "player2", deck: [], hand: [CARD_MARCH] });
      const player3 = createTestPlayer({ id: "player3", deck: [], hand: [CARD_STAMINA] });

      let state: GameState = createTestGameState({
        players: [player1, player2, player3],
        turnOrder: ["player1", "player2", "player3"],
        currentPlayerIndex: 1, // Player 2's turn
        round: 1,
        timeOfDay: TIME_OF_DAY_DAY,
        endOfRoundAnnouncedBy: "player1",
        playersWithFinalTurn: ["player2", "player3"],
      });

      // Player 2 ends their final turn
      const player2EndResult = engine.processAction(state, "player2", {
        type: END_TURN_ACTION,
      });
      state = player2EndResult.state;

      // Round should NOT have ended yet - player3 still needs their turn
      expect(state.round).toBe(1);
      expect(state.playersWithFinalTurn).toEqual(["player3"]);
      expect(state.currentPlayerIndex).toBe(2); // Moved to player 3

      // Player 3 ends their final turn
      const player3EndResult = engine.processAction(state, "player3", {
        type: END_TURN_ACTION,
      });
      state = player3EndResult.state;

      // NOW round should have ended
      expect(state.round).toBe(2);
      expect(state.timeOfDay).toBe(TIME_OF_DAY_NIGHT);
      expect(state.endOfRoundAnnouncedBy).toBeNull();
      expect(state.playersWithFinalTurn).toEqual([]);
    });
  });

  describe("Mandatory announcement", () => {
    it("should require announcement when deck and hand are empty", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [], // Empty deck
        hand: [], // Empty hand
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: null, // Not announced yet
      });

      // Try to take a move action - should be blocked
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        to: { q: 1, r: 0 },
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("must announce end of round"),
        })
      );
    });

    it("should allow actions after announcement is made", () => {
      const player = createTestPlayer({
        id: "player1",
        deck: [], // Empty deck
        hand: [], // Empty hand
      });
      const state = createTestGameState({
        players: [player],
        turnOrder: ["player1"],
        currentPlayerIndex: 0,
        endOfRoundAnnouncedBy: "player1", // Already announced
        playersWithFinalTurn: [],
      });

      // End turn should work
      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Should not have the mandatory announcement error
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("must announce"),
        })
      );
    });
  });
});
