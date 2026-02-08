/**
 * Integration tests for dummy player in turn order, tactic selection,
 * end turn advancement, and end round offer gains.
 *
 * These tests exercise the dummy player code paths in:
 * - selectTacticCommand.ts (dummy auto-select, dummy-first in turn order)
 * - tactics/helpers.ts (calculateTurnOrder with dummy)
 * - endTurn/index.ts (auto-execute dummy turns when next)
 * - endRound/index.ts (dummy offer gains + reset)
 */

import { describe, it, expect } from "vitest";
import { createSelectTacticCommand } from "../commands/selectTacticCommand.js";
import { createTestPlayer, createTacticsSelectionState } from "./testHelpers.js";
import { DUMMY_PLAYER_ID } from "../../types/dummyPlayer.js";
import type { DummyPlayer } from "../../types/dummyPlayer.js";
import type { CardId } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_STAMINA,
  CARD_DETERMINATION,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
  TACTIC_PLANNING,
  TACTIC_THE_RIGHT_MOMENT,
  ROUND_PHASE_PLAYER_TURNS,
  DUMMY_TACTIC_SELECTED,
  TACTICS_PHASE_ENDED,
  DUMMY_TACTIC_AFTER_HUMANS,
  DUMMY_TURN_EXECUTED,
  DUMMY_END_OF_ROUND_ANNOUNCED,
} from "@mage-knight/shared";
import { createEngine } from "../index.js";
import { createTestGameState } from "./testHelpers.js";
import { isDummyPlayer } from "../../types/dummyPlayer.js";
import { Hero } from "../../types/hero.js";

/**
 * Create a minimal dummy player for test fixtures.
 */
function createTestDummy(overrides: Partial<DummyPlayer> = {}): DummyPlayer {
  return {
    heroId: Hero.Goldyx as DummyPlayer["heroId"],
    deck: [
      CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA,
      CARD_DETERMINATION, CARD_TRANQUILITY, CARD_PROMISE, CARD_THREATEN,
      CARD_CRYSTALLIZE, CARD_MANA_DRAW, CARD_CONCENTRATION, CARD_IMPROVISATION,
      CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA,
    ] as readonly CardId[],
    discard: [],
    crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
    precomputedTurns: [
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 13 },
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 10 },
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 7 },
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 4 },
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 1 },
      { cardsFlipped: 1, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 0 },
    ],
    currentTurnIndex: 0,
    ...overrides,
  };
}

describe("Dummy player tactic selection integration", () => {
  it("should auto-select dummy tactic when last human selects", () => {
    const state = createTacticsSelectionState(["player1"], "day", {
      dummyPlayer: createTestDummy(),
      dummyPlayerTactic: null,
      scenarioConfig: {
        dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS,
      },
    });

    const command = createSelectTacticCommand({
      playerId: "player1",
      tacticId: TACTIC_PLANNING,
    });

    const result = command.execute(state);

    // Should emit DUMMY_TACTIC_SELECTED
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: DUMMY_TACTIC_SELECTED })
    );

    // Should emit TACTICS_PHASE_ENDED
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: TACTICS_PHASE_ENDED })
    );

    // Should transition to player turns
    expect(result.state.roundPhase).toBe(ROUND_PHASE_PLAYER_TURNS);

    // Dummy should be in the turn order
    expect(result.state.turnOrder).toContain(DUMMY_PLAYER_ID);
  });

  it("should not select dummy tactic when dummyPlayer is null", () => {
    const state = createTacticsSelectionState(["player1"], "day", {
      dummyPlayer: null,
      dummyPlayerTactic: null,
      scenarioConfig: {
        dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS,
      },
    });

    const command = createSelectTacticCommand({
      playerId: "player1",
      tacticId: TACTIC_PLANNING,
    });

    const result = command.execute(state);

    // Should NOT emit DUMMY_TACTIC_SELECTED
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ type: DUMMY_TACTIC_SELECTED })
    );

    // Should NOT include dummy in turn order
    expect(result.state.turnOrder).not.toContain(DUMMY_PLAYER_ID);
  });

  it("should execute dummy turn if dummy is first in turn order", () => {
    // Use Early Bird (turnOrder: 1) for human, and hope dummy gets a lower tactic
    // Instead, let's manually set up a scenario where dummy ends up first
    const state = createTacticsSelectionState(["player1"], "day", {
      dummyPlayer: createTestDummy(),
      dummyPlayerTactic: null,
      scenarioConfig: {
        dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS,
      },
    });

    // Human picks The Right Moment (turnOrder: 6, highest)
    const command = createSelectTacticCommand({
      playerId: "player1",
      tacticId: TACTIC_THE_RIGHT_MOMENT,
    });

    const result = command.execute(state);

    // If dummy got a tactic with lower turn order, dummy is first
    // The dummy picks randomly from remaining tactics, so we verify the behavior
    const dummyPosition = result.state.turnOrder.indexOf(DUMMY_PLAYER_ID);
    const humanPosition = result.state.turnOrder.indexOf("player1");

    if (dummyPosition === 0) {
      // Dummy was first — should have auto-executed its turn
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: DUMMY_TURN_EXECUTED })
      );
      // Human should be current player (dummy was auto-advanced)
      expect(result.state.currentPlayerIndex).toBe(humanPosition);
    }
    // Either way, turn order should contain both
    expect(result.state.turnOrder).toContain(DUMMY_PLAYER_ID);
    expect(result.state.turnOrder).toContain("player1");
  });
});

describe("Dummy player in endTurn flow", () => {
  it("should auto-execute dummy turn when it is next in turn order", () => {
    const dummy = createTestDummy();
    const player = createTestPlayer({
      id: "player1",
      hand: [CARD_MARCH],
      movePoints: 0,
      selectedTactic: TACTIC_PLANNING,
      tacticFlipped: true,
      playedCardFromHandThisTurn: true,
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1", DUMMY_PLAYER_ID],
      currentPlayerIndex: 0,
      dummyPlayer: dummy,
    });

    const engine = createEngine();
    const result = engine.processAction(state, "player1", {
      type: "END_TURN",
    });

    // Dummy turn should have been auto-executed
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: DUMMY_TURN_EXECUTED })
    );

    // After dummy's turn, should advance back to player1 (wraps around)
    const currentPlayerId = result.state.turnOrder[result.state.currentPlayerIndex];
    expect(currentPlayerId).toBe("player1");
  });

  it("should handle dummy announcing end of round when next in turn order", () => {
    // Dummy with exhausted deck
    const dummy = createTestDummy({
      deck: [],
      precomputedTurns: [],
      currentTurnIndex: 0,
    });
    const player = createTestPlayer({
      id: "player1",
      hand: [CARD_MARCH],
      movePoints: 0,
      selectedTactic: TACTIC_PLANNING,
      tacticFlipped: true,
      playedCardFromHandThisTurn: true,
    });

    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1", DUMMY_PLAYER_ID],
      currentPlayerIndex: 0,
      dummyPlayer: dummy,
    });

    const engine = createEngine();
    const result = engine.processAction(state, "player1", {
      type: "END_TURN",
    });

    // Dummy should announce end of round
    expect(result.events).toContainEqual(
      expect.objectContaining({ type: DUMMY_END_OF_ROUND_ANNOUNCED })
    );

    // End of round should be announced by dummy
    expect(result.state.endOfRoundAnnouncedBy).toBe(DUMMY_PLAYER_ID);

    // Player1 should get a final turn
    expect(result.state.playersWithFinalTurn).toContain("player1");
  });
});

describe("calculateTurnOrder with dummy", () => {
  it("should include dummy in turn order based on tactic number", () => {
    const state = createTacticsSelectionState(["player1"], "day", {
      dummyPlayer: createTestDummy(),
      dummyPlayerTactic: null,
      scenarioConfig: {
        dummyTacticOrder: DUMMY_TACTIC_AFTER_HUMANS,
      },
    });

    const command = createSelectTacticCommand({
      playerId: "player1",
      tacticId: TACTIC_PLANNING,
    });

    const result = command.execute(state);

    // Turn order should have exactly 2 entries (player + dummy)
    expect(result.state.turnOrder).toHaveLength(2);

    // Both should be in the turn order
    const hasPlayer = result.state.turnOrder.includes("player1");
    const hasDummy = result.state.turnOrder.some(isDummyPlayer);
    expect(hasPlayer).toBe(true);
    expect(hasDummy).toBe(true);
  });
});
