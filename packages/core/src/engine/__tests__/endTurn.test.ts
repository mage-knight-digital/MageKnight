import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  END_TURN_ACTION,
  TURN_ENDED,
  ROUND_ENDED,
  MOVE_ACTION,
  INVALID_ACTION,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import { TERRAIN_PLAINS } from "@mage-knight/shared";
import {
  DURATION_ROUND,
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../modifierConstants.js";

describe("END_TURN action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should advance to next player", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 4 });
    const player2 = createTestPlayer({ id: "player2", movePoints: 0 });
    const state = createTestGameState({
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      players: [player1, player2],
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.state.currentPlayerIndex).toBe(1);
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
        nextPlayerId: "player2",
      })
    );
  });

  it("should wrap around to first player", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 0 });
    const player2 = createTestPlayer({ id: "player2", movePoints: 4 });
    const state = createTestGameState({
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 1,
      players: [player1, player2],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    expect(result.state.currentPlayerIndex).toBe(0);
    // When wrapping around, we also emit ROUND_ENDED
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player2",
        nextPlayerId: "player1",
      })
    );
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: ROUND_ENDED,
        round: 1,
      })
    );
  });

  it("should reset current player turn state", () => {
    const player = createTestPlayer({
      id: "player1",
      movePoints: 2,
      hasMovedThisTurn: true,
      hasTakenActionThisTurn: true,
      influencePoints: 5,
      usedManaFromSource: true,
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    // Current player should have turn state reset
    expect(updatedPlayer?.movePoints).toBe(4); // Gets new points for next turn (since single player)
    expect(updatedPlayer?.hasMovedThisTurn).toBe(false);
    expect(updatedPlayer?.hasTakenActionThisTurn).toBe(false);
    expect(updatedPlayer?.influencePoints).toBe(0);
    expect(updatedPlayer?.usedManaFromSource).toBe(false);
  });

  it("should give next player starting move points", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 4 });
    const player2 = createTestPlayer({ id: "player2", movePoints: 0 });
    const state = createTestGameState({
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      players: [player1, player2],
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const nextPlayer = result.state.players.find((p) => p.id === "player2");
    expect(nextPlayer?.movePoints).toBe(4); // TEMPORARY starting move points
  });

  it("should clear command stack (not undoable)", () => {
    const state = createTestGameState();

    // Move first
    const afterMove = engine.processAction(state, "player1", {
      type: MOVE_ACTION,
      target: { q: 1, r: 0 },
    });

    expect(afterMove.state.commandStack.commands.length).toBe(1);

    // End turn
    const afterEnd = engine.processAction(afterMove.state, "player1", {
      type: END_TURN_ACTION,
    });

    // Command stack should be cleared (checkpoint set)
    expect(afterEnd.state.commandStack.commands.length).toBe(0);
    expect(afterEnd.state.commandStack.checkpoint).not.toBeNull();
  });

  it("should expire turn-duration modifiers", () => {
    const state = createTestGameState({
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
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.state.activeModifiers.length).toBe(0);
  });

  it("should not expire round-duration modifiers", () => {
    const state = createTestGameState({
      activeModifiers: [
        {
          id: "round-mod",
          source: {
            type: SOURCE_SKILL,
            skillId: "test" as SkillId,
            playerId: "player1",
          },
          duration: DURATION_ROUND,
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
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.state.activeModifiers.length).toBe(1);
  });

  it("should reject if not player's turn", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 4 });
    const player2 = createTestPlayer({ id: "player2", movePoints: 0 });
    const state = createTestGameState({
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0, // player1's turn
      players: [player1, player2],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        playerId: "player2",
      })
    );
  });

  it("should reject during combat", () => {
    const state = createTestGameState({
      combat: { _placeholder: undefined },
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "Cannot perform this action during combat",
      })
    );
  });
});
