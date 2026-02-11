/**
 * Tests for REST action
 *
 * Two modes of resting:
 * 1. Legacy atomic REST_ACTION (deprecated but supported for backward compatibility)
 * 2. New two-phase DECLARE_REST + COMPLETE_REST (per FAQ p.30)
 *
 * The new two-phase approach:
 * - DECLARE_REST: Enters isResting state, blocks movement/combat/interaction
 * - COMPLETE_REST: Completes rest with discards (type determined by hand state)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  REST_ACTION,
  REST_TYPE_STANDARD,
  REST_TYPE_SLOW_RECOVERY,
  PLAYER_RESTED,
  END_OF_ROUND_ANNOUNCED,
  REST_UNDONE,
  REST_DECLARED,
  REST_DECLARE_UNDONE,
  UNDO_ACTION,
  INVALID_ACTION,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
  MOVE_ACTION,
  END_TURN_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
} from "@mage-knight/shared";

describe("REST action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Standard Rest", () => {
    it("should discard exactly one non-wound plus wounds to discard pile", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND, CARD_WOUND],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH, CARD_WOUND],
      });

      // ALL cards go to discard (wounds too - this is NOT healing)
      expect(result.state.players[0].discard).toContain(CARD_MARCH);
      expect(result.state.players[0].discard).toContain(CARD_WOUND);
      expect(result.state.players[0].hand).toEqual([CARD_WOUND]); // One wound remains
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          restType: REST_TYPE_STANDARD,
          cardsDiscarded: 2,
          woundsDiscarded: 1,
        })
      );
    });

    it("should reject discarding multiple non-wound cards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH, CARD_RAGE], // Two non-wounds
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason:
            "Standard Rest requires exactly one non-wound card (plus any number of wounds)",
        })
      );
    });

    it("should reject discarding only wounds in standard rest", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_WOUND], // Only wounds
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason:
            "Standard Rest requires exactly one non-wound card (plus any number of wounds)",
        })
      );
    });

    it("should emit END_OF_ROUND_ANNOUNCED when requested", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH],
        announceEndOfRound: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: END_OF_ROUND_ANNOUNCED,
          playerId: "player1",
        })
      );
    });

    it("should mark player as having taken action", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH],
      });

      expect(result.state.players[0].hasTakenActionThisTurn).toBe(true);
    });

    it("should reject rest with no cards to discard", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Must discard at least one card to rest",
        })
      );
    });

    it("should reject rest if card not in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_RAGE], // Not in hand
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("not in your hand"),
        })
      );
    });

    it("should reject rest if already taken action", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          // Reason from validateHasNotActed
        })
      );
    });

    it("should be undoable", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        discard: [],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Rest
      const afterRest = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH],
      });

      expect(afterRest.state.players[0].hand).toEqual([CARD_RAGE]);
      expect(afterRest.state.players[0].discard).toContain(CARD_MARCH);

      // Undo
      const afterUndo = engine.processAction(afterRest.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].hand).toContain(CARD_MARCH);
      expect(afterUndo.state.players[0].hand).toContain(CARD_RAGE);
      expect(afterUndo.state.players[0].discard).not.toContain(CARD_MARCH);
      expect(afterUndo.state.players[0].hasTakenActionThisTurn).toBe(false);
      expect(afterUndo.events).toContainEqual(
        expect.objectContaining({
          type: REST_UNDONE,
        })
      );
    });

    it("should allow discarding one non-wound with multiple wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND, CARD_WOUND],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_STANDARD,
        discardCardIds: [CARD_MARCH, CARD_WOUND, CARD_WOUND],
      });

      expect(result.state.players[0].hand).toHaveLength(0);
      // All cards go to discard (wounds too)
      expect(result.state.players[0].discard).toContain(CARD_MARCH);
      expect(result.state.players[0].discard).toContain(CARD_WOUND);
      expect(result.state.players[0].discard).toHaveLength(3);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          cardsDiscarded: 3,
          woundsDiscarded: 2,
        })
      );
    });
  });

  describe("Slow Recovery", () => {
    it("should allow discarding one wound when hand is all wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_SLOW_RECOVERY,
        discardCardIds: [CARD_WOUND],
      });

      expect(result.state.players[0].hand).toHaveLength(1);
      expect(result.state.players[0].discard).toContain(CARD_WOUND);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          restType: REST_TYPE_SLOW_RECOVERY,
          cardsDiscarded: 1,
          woundsDiscarded: 1,
        })
      );
    });

    it("should reject slow recovery when hand has non-wound cards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_SLOW_RECOVERY,
        discardCardIds: [CARD_WOUND],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason:
            "Slow Recovery is only allowed when your hand contains only wound cards",
        })
      );
    });

    it("should reject slow recovery when discarding more than one wound", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_SLOW_RECOVERY,
        discardCardIds: [CARD_WOUND, CARD_WOUND],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Slow Recovery requires discarding exactly one wound card",
        })
      );
    });

    it("should be undoable", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        discard: [],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Slow Recovery
      const afterRest = engine.processAction(state, "player1", {
        type: REST_ACTION,
        restType: REST_TYPE_SLOW_RECOVERY,
        discardCardIds: [CARD_WOUND],
      });

      expect(afterRest.state.players[0].hand).toHaveLength(1);
      expect(afterRest.state.players[0].discard).toContain(CARD_WOUND);

      // Undo
      const afterUndo = engine.processAction(afterRest.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].hand).toHaveLength(2);
      expect(afterUndo.state.players[0].discard).not.toContain(CARD_WOUND);
      expect(afterUndo.state.players[0].hasTakenActionThisTurn).toBe(false);
    });
  });
});

/**
 * Two-Phase Rest Tests (new state-based resting per FAQ p.30)
 */
describe("Two-Phase REST (DECLARE_REST + COMPLETE_REST)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("DECLARE_REST", () => {
    it("should enter resting state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      expect(result.state.players[0].isResting).toBe(true);
      expect(result.state.players[0].hasTakenActionThisTurn).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REST_DECLARED,
          playerId: "player1",
        })
      );
    });

    it("should reject if already resting", () => {
      // When already resting, the validateHasNotActed runs first since declaring rest
      // sets hasTakenActionThisTurn. This is correct behavior - you can't declare rest
      // twice because the first declare already consumed your action.
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      // The "already taken action" validator runs before "already resting"
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You have already taken an action this turn",
        })
      );
    });

    it("should reject if already taken action", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should allow declare rest after action when hand is all wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      expect(result.state.players[0].isResting).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REST_DECLARED,
          playerId: "player1",
        })
      );
    });

    it("should reject if already moved this turn (rest means no movement phase)", () => {
      // Per FAQ: "Resting doesn't prevent you from playing cards: it merely prevents
      // you from Moving..." - this means rest and movement are mutually exclusive.
      // If you've already moved, you can't declare rest.
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasMovedThisTurn: true,
        hasTakenActionThisTurn: false, // Haven't taken action yet
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Cannot rest after moving - rest replaces your entire turn",
        })
      );
    });

    it("should be undoable", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Declare rest
      const afterDeclare = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });
      expect(afterDeclare.state.players[0].isResting).toBe(true);

      // Undo
      const afterUndo = engine.processAction(afterDeclare.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].isResting).toBe(false);
      expect(afterUndo.state.players[0].hasTakenActionThisTurn).toBe(false);
      expect(afterUndo.events).toContainEqual(
        expect.objectContaining({
          type: REST_DECLARE_UNDONE,
        })
      );
    });
  });

  describe("Resting State Restrictions", () => {
    it("should block movement while resting", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
        isResting: true,
        hasTakenActionThisTurn: true,
        movePoints: 4,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Cannot move while resting",
        })
      );
    });

    it("should block ending turn without completing rest", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        isResting: true,
        hasTakenActionThisTurn: true,
        playedCardFromHandThisTurn: true, // Satisfy minimum turn requirement
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You must complete your rest before ending your turn",
        })
      );
    });

    it("should block playing cards sideways while resting", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Cannot play cards sideways while resting",
        })
      );
    });
  });

  describe("COMPLETE_REST", () => {
    it("should complete Standard Rest with 1 non-wound + wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND, CARD_WOUND],
        discard: [],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH, CARD_WOUND],
      });

      expect(result.state.players[0].isResting).toBe(false);
      expect(result.state.players[0].discard).toContain(CARD_MARCH);
      expect(result.state.players[0].discard).toContain(CARD_WOUND);
      expect(result.state.players[0].hand).toEqual([CARD_WOUND]);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          restType: REST_TYPE_STANDARD,
          cardsDiscarded: 2,
          woundsDiscarded: 1,
        })
      );
    });

    it("should complete Slow Recovery when hand is all wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        discard: [],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_WOUND],
      });

      expect(result.state.players[0].isResting).toBe(false);
      expect(result.state.players[0].discard).toContain(CARD_WOUND);
      expect(result.state.players[0].hand).toHaveLength(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          restType: REST_TYPE_SLOW_RECOVERY,
          cardsDiscarded: 1,
          woundsDiscarded: 1,
        })
      );
    });

    it("should allow Slow Recovery with no discard when hand is empty (all wounds healed)", () => {
      // Per FAQ Q2 A2: If you heal all wounds during rest, Slow Recovery with no discard is valid
      const player = createTestPlayer({
        hand: [],
        deck: [],
        discard: [],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [],
      });

      expect(result.state.players[0].isResting).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_RESTED,
          restType: REST_TYPE_SLOW_RECOVERY,
          cardsDiscarded: 0,
        })
      );
    });

    it("should reject if not in resting state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        isResting: false,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You must declare rest first before completing it",
        })
      );
    });

    it("should reject Standard Rest with wrong number of non-wounds", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_WOUND],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // Try to discard 2 non-wounds
      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH, CARD_RAGE],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason:
            "Standard Rest requires discarding exactly one non-wound card (plus any number of wounds)",
        })
      );
    });

    it("should reject Slow Recovery with more than 1 wound", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_WOUND, CARD_WOUND],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Slow Recovery requires discarding exactly one wound card",
        })
      );
    });

    it("should emit END_OF_ROUND_ANNOUNCED when requested", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH],
        announceEndOfRound: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: END_OF_ROUND_ANNOUNCED,
          playerId: "player1",
        })
      );
    });

    it("should be undoable back to resting state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
        discard: [],
        isResting: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // Complete rest
      const afterComplete = engine.processAction(state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH],
      });
      expect(afterComplete.state.players[0].isResting).toBe(false);
      expect(afterComplete.state.players[0].discard).toContain(CARD_MARCH);

      // Undo
      const afterUndo = engine.processAction(afterComplete.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].isResting).toBe(true);
      expect(afterUndo.state.players[0].hand).toContain(CARD_MARCH);
      expect(afterUndo.state.players[0].discard).not.toContain(CARD_MARCH);
      expect(afterUndo.events).toContainEqual(
        expect.objectContaining({
          type: REST_UNDONE,
        })
      );
    });
  });

  describe("Full Rest Flow", () => {
    it("should support declare -> complete flow", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_WOUND],
        discard: [],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Step 1: Declare rest
      const afterDeclare = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });
      expect(afterDeclare.state.players[0].isResting).toBe(true);

      // Step 2: Complete rest
      const afterComplete = engine.processAction(afterDeclare.state, "player1", {
        type: COMPLETE_REST_ACTION,
        discardCardIds: [CARD_MARCH, CARD_WOUND],
      });

      expect(afterComplete.state.players[0].isResting).toBe(false);
      expect(afterComplete.state.players[0].discard).toContain(CARD_MARCH);
      expect(afterComplete.state.players[0].discard).toContain(CARD_WOUND);
      expect(afterComplete.state.players[0].hand).toEqual([]);
    });

    it("should support declare -> undo flow", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        hasTakenActionThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Declare rest
      const afterDeclare = engine.processAction(state, "player1", {
        type: DECLARE_REST_ACTION,
      });

      // Undo (player changed their mind)
      const afterUndo = engine.processAction(afterDeclare.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].isResting).toBe(false);
      expect(afterUndo.state.players[0].hasTakenActionThisTurn).toBe(false);
    });
  });
});
