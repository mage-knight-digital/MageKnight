import { describe, it, expect, beforeEach } from "vitest";
import { MageKnightEngine, createEngine } from "../MageKnightEngine.js";
import type { GameState } from "../../state/GameState.js";
import {
  INVALID_ACTION,
  MOVE_ACTION,
  MOVE_UNDONE,
  PLAYER_MOVED,
  TERRAIN_PLAINS,
  TIME_OF_DAY_NIGHT,
  UNDO_FAILED,
  UNDO_FAILED_NOTHING_TO_UNDO,
  UNDO_FAILED_NOT_YOUR_TURN,
  UNDO_ACTION,
  hexKey,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";
import {
  createTestPlayer,
  createTestHex,
  createTestGameState,
} from "./testHelpers.js";

describe("MageKnightEngine", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("MOVE action", () => {
    it("should move player to adjacent hex and deduct move points", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Player should have moved
      const player = result.state.players[0];
      expect(player.position).toEqual({ q: 1, r: 0 });

      // Move points should be deducted (plains = 2)
      expect(player.movePoints).toBe(2); // Started with 4, spent 2

      // hasMovedThisTurn should be true
      expect(player.hasMovedThisTurn).toBe(true);

      // Should have PLAYER_MOVED event
      expect(result.events).toContainEqual({
        type: PLAYER_MOVED,
        playerId: "player1",
        from: { q: 0, r: 0 },
        to: { q: 1, r: 0 },
      });

      // Command should be on the stack
      expect(result.state.commandStack.commands.length).toBe(1);
    });

    it("should reject move when not player's turn", () => {
      const state = createTestGameState({
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0, // player2's turn
      });

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Should have INVALID_ACTION event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          playerId: "player1",
          reason: "It is not your turn",
        })
      );

      // State should be unchanged
      expect(result.state.players[0].position).toEqual({ q: 0, r: 0 });
    });

    it("should reject move to non-adjacent hex", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 2, r: 0 }, // Two hexes away
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Target hex is not adjacent",
        })
      );
    });

    it("should reject move to non-existent hex", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 }, // Adjacent to (0,0) but not in our test map
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Target hex does not exist",
        })
      );
    });

    it("should reject move with insufficient move points", () => {
      const player = createTestPlayer({ movePoints: 1 }); // Only 1 point
      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 }, // Plains costs 2
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Need 2 move points, have 1",
        })
      );
    });

    it("should reject move after player has taken action", () => {
      const player = createTestPlayer({
        movePoints: 4,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You have already taken an action this turn",
        })
      );
    });

    it("should use correct terrain cost for forest during day", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 0, r: 1 }, // Forest
      });

      const player = result.state.players[0];
      expect(player.movePoints).toBe(1); // Started with 4, forest costs 3 during day
    });

    it("should use correct terrain cost for forest during night", () => {
      const state = createTestGameState({
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Give player enough points for night forest (5)
      const player = createTestPlayer({ movePoints: 6 });
      const stateWithPoints = { ...state, players: [player] };

      const result = engine.processAction(stateWithPoints, "player1", {
        type: MOVE_ACTION,
        target: { q: 0, r: 1 }, // Forest
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.movePoints).toBe(1); // Started with 6, forest costs 5 at night
    });

    it("should reject move during combat", () => {
      const state = createTestGameState({
        combat: { _placeholder: undefined }, // In combat
      });

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Cannot perform this action during combat",
        })
      );
    });
  });

  describe("UNDO action", () => {
    it("should undo a move and restore previous state", () => {
      const state = createTestGameState();

      // First, move
      const afterMove = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(afterMove.state.players[0].position).toEqual({ q: 1, r: 0 });
      expect(afterMove.state.players[0].movePoints).toBe(2);

      // Now undo
      const afterUndo = engine.processAction(afterMove.state, "player1", {
        type: UNDO_ACTION,
      });

      // Player should be back
      expect(afterUndo.state.players[0].position).toEqual({ q: 0, r: 0 });
      expect(afterUndo.state.players[0].movePoints).toBe(4);
      expect(afterUndo.state.players[0].hasMovedThisTurn).toBe(false);

      // Should have MOVE_UNDONE event
      expect(afterUndo.events).toContainEqual({
        type: MOVE_UNDONE,
        playerId: "player1",
        from: { q: 1, r: 0 },
        to: { q: 0, r: 0 },
      });

      // Command stack should be empty
      expect(afterUndo.state.commandStack.commands.length).toBe(0);
    });

    it("should undo multiple moves in order", () => {
      const state = createTestGameState();

      // Move twice
      const afterMove1 = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Add the destination hex so we can move again
      const stateWithMoreHexes = {
        ...afterMove1.state,
        map: {
          ...afterMove1.state.map,
          hexes: {
            ...afterMove1.state.map.hexes,
            [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
          },
        },
      };

      const afterMove2 = engine.processAction(stateWithMoreHexes, "player1", {
        type: MOVE_ACTION,
        target: { q: 2, r: 0 },
      });

      expect(afterMove2.state.players[0].position).toEqual({ q: 2, r: 0 });
      expect(afterMove2.state.commandStack.commands.length).toBe(2);

      // Undo second move
      const afterUndo1 = engine.processAction(afterMove2.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo1.state.players[0].position).toEqual({ q: 1, r: 0 });
      expect(afterUndo1.state.commandStack.commands.length).toBe(1);

      // Undo first move
      const afterUndo2 = engine.processAction(afterUndo1.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo2.state.players[0].position).toEqual({ q: 0, r: 0 });
      expect(afterUndo2.state.commandStack.commands.length).toBe(0);
    });

    it("should fail undo when nothing to undo", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: UNDO_ACTION,
      });

      expect(result.events).toContainEqual({
        type: UNDO_FAILED,
        playerId: "player1",
        reason: UNDO_FAILED_NOTHING_TO_UNDO,
      });
    });

    it("should fail undo when not player's turn", () => {
      const state = createTestGameState({
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0,
      });

      const result = engine.processAction(state, "player1", {
        type: UNDO_ACTION,
      });

      expect(result.events).toContainEqual({
        type: UNDO_FAILED,
        playerId: "player1",
        reason: UNDO_FAILED_NOT_YOUR_TURN,
      });
    });
  });

  describe("Modifier integration", () => {
    it("should apply terrain cost modifiers", () => {
      const state = createTestGameState();

      // Add a modifier that reduces plains cost by 1
      const stateWithModifier: GameState = {
        ...state,
        activeModifiers: [
          {
            id: "test-mod",
            source: {
              type: SOURCE_SKILL,
              skillId: "test" as SkillId,
              playerId: "player1",
            },
            duration: DURATION_TURN,
            scope: { type: SCOPE_SELF },
            effect: {
              type: EFFECT_TERRAIN_COST,
              terrain: TERRAIN_PLAINS,
              amount: -1,
              minimum: 0,
            },
            createdAtRound: 1,
            createdByPlayerId: "player1",
          },
        ],
      };

      const result = engine.processAction(stateWithModifier, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 }, // Plains, normally costs 2
      });

      const player = result.state.players[0];
      // Should only cost 1 now (2 - 1 = 1)
      expect(player.movePoints).toBe(3); // Started with 4, spent 1
    });
  });
});
