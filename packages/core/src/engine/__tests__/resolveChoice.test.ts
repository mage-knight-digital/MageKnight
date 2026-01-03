/**
 * Tests for choice resolution
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  PLAY_CARD_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  CHOICE_RESOLVED,
  INVALID_ACTION,
  UNDO_ACTION,
  MOVE_ACTION,
  CARD_RAGE,
} from "@mage-knight/shared";

describe("Choice resolution", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("setting pending choice", () => {
    it("should set pending choice when playing choice card", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.cardId).toBe(CARD_RAGE);
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_REQUIRED,
          options: ["Attack 2", "Block 2"],
        })
      );
    });
  });

  describe("resolving choice with Attack", () => {
    it("should resolve choice with Attack", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      // Play Rage
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      // Choose Attack (index 0)
      const afterChoice = engine.processAction(afterPlay.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.state.players[0].pendingChoice).toBeNull();
      expect(afterChoice.state.players[0].combatAccumulator.attack.normal).toBe(
        2
      );
      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_RESOLVED,
          chosenIndex: 0,
          effect: "Gained 2 Attack",
        })
      );
    });
  });

  describe("resolving choice with Block", () => {
    it("should resolve choice with Block", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      // Choose Block (index 1)
      const afterChoice = engine.processAction(afterPlay.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      expect(afterChoice.state.players[0].combatAccumulator.block).toBe(2);
      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_RESOLVED,
          chosenIndex: 1,
          effect: "Gained 2 Block",
        })
      );
    });
  });

  describe("blocking other actions while choice is pending", () => {
    it("should block move action while choice is pending", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        movePoints: 4,
      });
      const state = createTestGameState({ players: [player] });

      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      // Try to move — should fail
      const moveResult = engine.processAction(afterPlay.state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(moveResult.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Must resolve pending choice first",
        })
      );
    });
  });

  describe("validation", () => {
    it("should reject invalid choice index", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      // Try invalid index
      const result = engine.processAction(afterPlay.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 5, // Only 0 and 1 are valid
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Choice index must be 0-1",
        })
      );
    });

    it("should reject resolve choice when no choice pending", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      // Try to resolve choice without playing a card first
      const result = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "No choice pending",
        })
      );
    });
  });

  describe("undo", () => {
    it("should be undoable", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      const afterChoice = engine.processAction(afterPlay.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.state.players[0].combatAccumulator.attack.normal).toBe(
        2
      );
      expect(afterChoice.state.players[0].pendingChoice).toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterChoice.state, "player1", {
        type: UNDO_ACTION,
      });

      // Choice should be pending again
      expect(afterUndo.state.players[0].pendingChoice).not.toBeNull();
      expect(afterUndo.state.players[0].combatAccumulator.attack.normal).toBe(
        0
      );
      // Should re-emit CHOICE_REQUIRED
      expect(afterUndo.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_REQUIRED,
          options: ["Attack 2", "Block 2"],
        })
      );
    });

    it("should undo playing a choice card (before resolving choice)", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_RAGE,
        powered: false,
      });

      expect(afterPlay.state.players[0].pendingChoice).not.toBeNull();

      // Undo playing the card
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      // Card should be back in hand, no pending choice
      expect(afterUndo.state.players[0].hand).toContain(CARD_RAGE);
      expect(afterUndo.state.players[0].playArea).not.toContain(CARD_RAGE);
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();
    });
  });
});
