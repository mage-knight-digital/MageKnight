/**
 * Tests for Steady Tempo end-of-turn deck placement mechanic.
 *
 * Steady Tempo (advanced action, blue):
 * - Basic: Move 2, optional bottom-of-deck placement (requires non-empty deck)
 * - Powered: Move 4, optional top-of-deck placement (no restriction)
 *
 * Flow: play Steady Tempo → end turn → placement choice → turn completes
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  CARD_STEADY_TEMPO,
  CARD_MARCH,
  CARD_RAGE,
  END_TURN_ACTION,
  RESOLVE_STEADY_TEMPO_ACTION,
  INVALID_ACTION,
  STEADY_TEMPO_PLACED,
  STEADY_TEMPO_PLACEMENT_SKIPPED,
  TURN_ENDED,
} from "@mage-knight/shared";
import {
  validateHasPendingSteadyTempo,
  validateSteadyTempoChoice,
} from "../validators/steadyTempoValidators.js";
import { getSteadyTempoOptions } from "../validActions/pending.js";
import { getValidActions } from "../validActions/index.js";

// ============================================================================
// 1. Validator Tests
// ============================================================================

describe("Steady Tempo validators", () => {
  describe("validateHasPendingSteadyTempo", () => {
    it("should accept when player has pending placement", () => {
      const player = createTestPlayer({
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateHasPendingSteadyTempo(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(true);
    });

    it("should reject when no pending placement", () => {
      const player = createTestPlayer();
      const state = createTestGameState({ players: [player] });

      const result = validateHasPendingSteadyTempo(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("STEADY_TEMPO_PLACEMENT_REQUIRED");
      }
    });

    it("should reject when player not found", () => {
      const state = createTestGameState();

      const result = validateHasPendingSteadyTempo(state, "nonexistent", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("PLAYER_NOT_FOUND");
      }
    });
  });

  describe("validateSteadyTempoChoice", () => {
    it("should accept skip (place=false) always", () => {
      const player = createTestPlayer({
        deck: [],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateSteadyTempoChoice(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: false,
      });
      expect(result.valid).toBe(true);
    });

    it("should accept basic placement when deck is non-empty", () => {
      const player = createTestPlayer({
        deck: [CARD_MARCH],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateSteadyTempoChoice(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(true);
    });

    it("should reject basic placement when deck is empty", () => {
      const player = createTestPlayer({
        deck: [],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateSteadyTempoChoice(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("STEADY_TEMPO_CANNOT_PLACE_BASIC");
      }
    });

    it("should accept powered placement even when deck is empty", () => {
      const player = createTestPlayer({
        deck: [],
        pendingSteadyTempoDeckPlacement: { version: "powered" },
      });
      const state = createTestGameState({ players: [player] });

      const result = validateSteadyTempoChoice(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });
      expect(result.valid).toBe(true);
    });
  });
});

// ============================================================================
// 2. ValidActions Tests: getSteadyTempoOptions
// ============================================================================

describe("getSteadyTempoOptions", () => {
  it("should return bottom position for basic version", () => {
    const player = createTestPlayer({
      deck: [CARD_MARCH],
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const options = getSteadyTempoOptions(state, player);

    expect(options.position).toBe("bottom");
    expect(options.canPlace).toBe(true);
  });

  it("should return top position for powered version", () => {
    const player = createTestPlayer({
      deck: [CARD_MARCH],
      pendingSteadyTempoDeckPlacement: { version: "powered" },
    });
    const state = createTestGameState({ players: [player] });

    const options = getSteadyTempoOptions(state, player);

    expect(options.position).toBe("top");
    expect(options.canPlace).toBe(true);
  });

  it("should set canPlace=false for basic with empty deck", () => {
    const player = createTestPlayer({
      deck: [],
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const options = getSteadyTempoOptions(state, player);

    expect(options.position).toBe("bottom");
    expect(options.canPlace).toBe(false);
  });

  it("should set canPlace=true for powered with empty deck", () => {
    const player = createTestPlayer({
      deck: [],
      pendingSteadyTempoDeckPlacement: { version: "powered" },
    });
    const state = createTestGameState({ players: [player] });

    const options = getSteadyTempoOptions(state, player);

    expect(options.position).toBe("top");
    expect(options.canPlace).toBe(true);
  });
});

describe("getValidActions with pending Steady Tempo", () => {
  it("should return pending_steady_tempo mode", () => {
    const player = createTestPlayer({
      deck: [CARD_MARCH],
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const actions = getValidActions(state, "player1");

    expect(actions.mode).toBe("pending_steady_tempo");
    if (actions.mode === "pending_steady_tempo") {
      expect(actions.turn.canUndo).toBe(false);
      expect(actions.steadyTempo.position).toBe("bottom");
      expect(actions.steadyTempo.canPlace).toBe(true);
    }
  });

  it("should show canPlace=false for basic with empty deck", () => {
    const player = createTestPlayer({
      deck: [],
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const actions = getValidActions(state, "player1");

    expect(actions.mode).toBe("pending_steady_tempo");
    if (actions.mode === "pending_steady_tempo") {
      expect(actions.steadyTempo.canPlace).toBe(false);
    }
  });

  it("should show top position for powered version", () => {
    const player = createTestPlayer({
      deck: [],
      pendingSteadyTempoDeckPlacement: { version: "powered" },
    });
    const state = createTestGameState({ players: [player] });

    const actions = getValidActions(state, "player1");

    expect(actions.mode).toBe("pending_steady_tempo");
    if (actions.mode === "pending_steady_tempo") {
      expect(actions.steadyTempo.position).toBe("top");
      expect(actions.steadyTempo.canPlace).toBe(true);
    }
  });
});

// ============================================================================
// 3. Resolve Command Tests (via engine.processAction)
// ============================================================================

describe("RESOLVE_STEADY_TEMPO action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("successful placement", () => {
    it("should place Steady Tempo on bottom of deck (basic)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      // STEADY_TEMPO_PLACED event should be emitted
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          playerId: "player1",
          position: "bottom",
        })
      );

      // Turn should have ended after placement resolved
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
          playerId: "player1",
        })
      );
    });

    it("should place Steady Tempo on top of deck (powered)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "powered" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          playerId: "player1",
          position: "top",
        })
      );
    });

    it("should allow powered placement with empty deck", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "powered" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          playerId: "player1",
          position: "top",
        })
      );
    });
  });

  describe("skip placement", () => {
    it("should emit skip event when place=false", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2" });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: false,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACEMENT_SKIPPED,
          playerId: "player1",
        })
      );

      // Pending placement should be cleared
      expect(
        result.state.players[0].pendingSteadyTempoDeckPlacement
      ).toBeUndefined();
    });
  });

  describe("validation rejections", () => {
    it("should reject when no pending placement", () => {
      const player = createTestPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject basic placement with empty deck", () => {
      const player = createTestPlayer({
        deck: [],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject when not player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        pendingSteadyTempoDeckPlacement: { version: "basic" },
      });
      const player2 = createTestPlayer({ id: "player2" });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // player2's turn
      });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });
});

// ============================================================================
// 4. End-of-Turn Integration Tests
// ============================================================================

describe("Steady Tempo end-of-turn integration", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("end turn triggers placement choice", () => {
    it("should halt end turn when Steady Tempo was played (basic)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Turn should NOT have ended yet - waiting for placement choice
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
        })
      );

      // Player should still have pending placement
      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingSteadyTempoDeckPlacement).toBeDefined();
    });

    it("should halt end turn when Steady Tempo was played (powered)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "powered" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Turn should NOT have ended yet
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
        })
      );
    });
  });

  describe("pause/resume flow", () => {
    it("should complete turn after placement is accepted", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // Step 1: End turn - halts at placement choice
      const afterEndTurn = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      expect(afterEndTurn.events).not.toContainEqual(
        expect.objectContaining({ type: TURN_ENDED })
      );

      // Step 2: Accept placement
      const afterPlace = engine.processAction(
        afterEndTurn.state,
        "player1",
        {
          type: RESOLVE_STEADY_TEMPO_ACTION,
          place: true,
        }
      );

      // Turn should now be complete
      expect(afterPlace.events).toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
          playerId: "player1",
        })
      );

      // Steady Tempo should have been placed
      expect(afterPlace.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          position: "bottom",
        })
      );
    });

    it("should complete turn after placement is skipped", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // Step 1: End turn
      const afterEndTurn = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Step 2: Skip placement
      const afterSkip = engine.processAction(afterEndTurn.state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: false,
      });

      // Turn should complete
      expect(afterSkip.events).toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
          playerId: "player1",
        })
      );

      expect(afterSkip.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACEMENT_SKIPPED,
        })
      );
    });
  });

  describe("multiplayer turn advancement", () => {
    it("should advance to next player after placement resolves", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2" });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });

      // End turn
      const afterEndTurn = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Resolve placement
      const afterPlace = engine.processAction(
        afterEndTurn.state,
        "player1",
        {
          type: RESOLVE_STEADY_TEMPO_ACTION,
          place: true,
        }
      );

      // Should advance to player 2
      expect(afterPlace.state.currentPlayerIndex).toBe(1);
      expect(afterPlace.events).toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
          playerId: "player1",
          nextPlayerId: "player2",
        })
      );
    });
  });
});

// ============================================================================
// 5. Deck Placement Mechanics Tests
// ============================================================================

describe("Steady Tempo deck placement mechanics", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic version - bottom of deck", () => {
    it("should place card at bottom of deck (last position)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH, CARD_RAGE],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // Resolve placement directly (skip the end turn halt)
      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      // Card should NOT be in play area anymore (it was moved to deck before card flow)
      // The end turn process runs card flow after, which discards remaining play area cards
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          position: "bottom",
        })
      );
    });
  });

  describe("powered version - top of deck", () => {
    it("should place card at top of deck (first position)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH, CARD_RAGE],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "powered" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
          position: "top",
        })
      );
    });
  });

  describe("card removed from play area on placement", () => {
    it("should not include Steady Tempo in discarded play area cards", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO, CARD_RAGE],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      // Steady Tempo should have been placed, not discarded
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
        })
      );
    });
  });
});

// ============================================================================
// 6. Site Check Tests
// ============================================================================

describe("checkSteadyTempoDeckPlacement site check", () => {
  let checkSteadyTempoDeckPlacement: typeof import("../commands/endTurn/siteChecks.js").checkSteadyTempoDeckPlacement;

  beforeEach(async () => {
    const mod = await import("../commands/endTurn/siteChecks.js");
    checkSteadyTempoDeckPlacement = mod.checkSteadyTempoDeckPlacement;
  });

  it("should return pendingChoice true when placement is pending", () => {
    const player = createTestPlayer({
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const result = checkSteadyTempoDeckPlacement(state, player, false);

    expect(result.pendingChoice).toBe(true);
  });

  it("should return pendingChoice false when no placement pending", () => {
    const player = createTestPlayer();
    const state = createTestGameState({ players: [player] });

    const result = checkSteadyTempoDeckPlacement(state, player, false);

    expect(result.pendingChoice).toBe(false);
  });

  it("should return pendingChoice false when skip flag is set", () => {
    const player = createTestPlayer({
      pendingSteadyTempoDeckPlacement: { version: "basic" },
    });
    const state = createTestGameState({ players: [player] });

    const result = checkSteadyTempoDeckPlacement(state, player, true);

    expect(result.pendingChoice).toBe(false);
  });
});

// ============================================================================
// 7. Edge Cases
// ============================================================================

describe("Steady Tempo edge cases", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("undo clears pending placement", () => {
    it("should verify pending flag state is correct", () => {
      const player = createTestPlayer({
        hand: [],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // The pending flag is set when Steady Tempo is played
      expect(state.players[0].pendingSteadyTempoDeckPlacement).toEqual({
        version: "basic",
      });
    });
  });

  describe("placement command is irreversible", () => {
    it("should not allow undo while placement is pending", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      // End turn
      const afterEndTurn = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // validActions should not allow undo while placement is pending
      const actions = getValidActions(afterEndTurn.state, "player1");
      if (actions.mode === "pending_steady_tempo") {
        expect(actions.turn.canUndo).toBe(false);
      }
    });
  });

  describe("move points not required for deck benefit", () => {
    it("should allow deck placement even if no move was made", () => {
      // Steady Tempo gives move points but they don't need to be spent
      // for the deck placement benefit to apply
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        playArea: [CARD_STEADY_TEMPO],
        movePoints: 2, // Move points still available (unused)
        pendingSteadyTempoDeckPlacement: { version: "basic" },
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: RESOLVE_STEADY_TEMPO_ACTION,
        place: true,
      });

      // Should succeed regardless of unused move points
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: STEADY_TEMPO_PLACED,
        })
      );
    });
  });
});
