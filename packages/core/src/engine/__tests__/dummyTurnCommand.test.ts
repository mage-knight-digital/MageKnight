/**
 * Tests for the dummy turn command
 */

import { describe, it, expect } from "vitest";
import { executeDummyPlayerTurn } from "../commands/dummyTurnCommand.js";
import { DUMMY_PLAYER_ID } from "../../types/dummyPlayer.js";
import type { DummyPlayer } from "../../types/dummyPlayer.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { CardId } from "@mage-knight/shared";
import {
  DUMMY_TURN_EXECUTED,
  DUMMY_END_OF_ROUND_ANNOUNCED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_STAMINA,
  CARD_DETERMINATION,
  CARD_CRYSTALLIZE,
} from "@mage-knight/shared";

function createTestDummy(overrides: Partial<DummyPlayer> = {}): DummyPlayer {
  return {
    heroId: "arythea" as DummyPlayer["heroId"],
    deck: [CARD_RAGE, CARD_MARCH, CARD_SWIFTNESS, CARD_STAMINA, CARD_DETERMINATION, CARD_CRYSTALLIZE] as readonly CardId[],
    discard: [],
    crystals: { [MANA_RED]: 0, [MANA_BLUE]: 0, [MANA_GREEN]: 0, [MANA_WHITE]: 0 },
    precomputedTurns: [
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 3 },
      { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 0 },
    ],
    currentTurnIndex: 0,
    ...overrides,
  };
}

describe("executeDummyPlayerTurn", () => {
  it("should return unchanged state when no dummy player exists", () => {
    const state = createTestGameState({ dummyPlayer: null });

    const result = executeDummyPlayerTurn(state);

    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
    expect(result.announcedEndOfRound).toBe(false);
  });

  it("should execute a pre-computed turn and emit DUMMY_TURN_EXECUTED", () => {
    const dummy = createTestDummy();
    const state = createTestGameState({ dummyPlayer: dummy });

    const result = executeDummyPlayerTurn(state);

    expect(result.announcedEndOfRound).toBe(false);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({
        type: DUMMY_TURN_EXECUTED,
        cardsFlipped: 3,
        bonusFlipped: 0,
        matchedColor: null,
        deckRemaining: 3,
      })
    );
    expect(result.state.dummyPlayer!.currentTurnIndex).toBe(1);
    expect(result.state.dummyPlayer!.deck).toHaveLength(3);
    expect(result.state.dummyPlayer!.discard).toHaveLength(3);
  });

  it("should emit bonus flip info in DUMMY_TURN_EXECUTED", () => {
    const dummy = createTestDummy({
      precomputedTurns: [
        { cardsFlipped: 3, bonusFlipped: 2, matchedColor: MANA_RED, deckRemainingAfter: 1 },
      ],
    });
    const state = createTestGameState({ dummyPlayer: dummy });

    const result = executeDummyPlayerTurn(state);

    expect(result.events[0]).toEqual(
      expect.objectContaining({
        type: DUMMY_TURN_EXECUTED,
        bonusFlipped: 2,
        matchedColor: MANA_RED,
      })
    );
  });

  it("should announce end of round when deck is exhausted", () => {
    const dummy = createTestDummy({
      deck: [],
      precomputedTurns: [],
      currentTurnIndex: 0,
    });
    const player1 = createTestPlayer({ id: "player1" });
    const state = createTestGameState({
      dummyPlayer: dummy,
      players: [player1],
    });

    const result = executeDummyPlayerTurn(state);

    expect(result.announcedEndOfRound).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toEqual(
      expect.objectContaining({ type: DUMMY_END_OF_ROUND_ANNOUNCED })
    );
    expect(result.state.endOfRoundAnnouncedBy).toBe(DUMMY_PLAYER_ID);
    expect(result.state.playersWithFinalTurn).toEqual(["player1"]);
  });

  it("should set playersWithFinalTurn to all human players", () => {
    const dummy = createTestDummy({
      deck: [],
      precomputedTurns: [],
      currentTurnIndex: 0,
    });
    const player1 = createTestPlayer({ id: "player1" });
    const player2 = createTestPlayer({ id: "player2" });
    const state = createTestGameState({
      dummyPlayer: dummy,
      players: [player1, player2],
    });

    const result = executeDummyPlayerTurn(state);

    expect(result.state.playersWithFinalTurn).toEqual(["player1", "player2"]);
  });

  it("should announce end of round when currentTurnIndex exceeds precomputedTurns", () => {
    const dummy = createTestDummy({
      deck: [],
      precomputedTurns: [
        { cardsFlipped: 3, bonusFlipped: 0, matchedColor: null, deckRemainingAfter: 0 },
      ],
      currentTurnIndex: 1, // Past the only turn
    });
    const state = createTestGameState({ dummyPlayer: dummy });

    const result = executeDummyPlayerTurn(state);

    expect(result.announcedEndOfRound).toBe(true);
    expect(result.state.endOfRoundAnnouncedBy).toBe(DUMMY_PLAYER_ID);
  });
});
