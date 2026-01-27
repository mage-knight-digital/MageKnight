import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  END_TURN_ACTION,
  TURN_ENDED,
  ROUND_ENDED,
  END_OF_ROUND_ANNOUNCED,
  MOVE_ACTION,
  INVALID_ACTION,
  TERRAIN_PLAINS,
  TURN_START_MOVE_POINTS,
  CARD_MARCH,
  CARD_RAGE,
  CARD_STAMINA,
  CARD_SWIFTNESS,
  CARD_DETERMINATION,
  CARD_PROMISE,
  CARD_THREATEN,
  MANA_BLUE,
  MANA_GREEN,
} from "@mage-knight/shared";
import type { SkillId } from "@mage-knight/shared";
import type { SourceDie } from "../../types/mana.js";
import { sourceDieId } from "../../types/mana.js";
import {
  DURATION_ROUND,
  DURATION_TURN,
  EFFECT_TERRAIN_COST,
  SCOPE_SELF,
  SOURCE_SKILL,
} from "../modifierConstants.js";
import { createEmptyCombatAccumulator } from "../../types/player.js";

describe("END_TURN action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should advance to next player", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 4, playedCardFromHandThisTurn: true });
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
    const player2 = createTestPlayer({ id: "player2", movePoints: 4, playedCardFromHandThisTurn: true });
    const state = createTestGameState({
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 1,
      players: [player1, player2],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    expect(result.state.currentPlayerIndex).toBe(0);
    // When wrapping around without announcement, round does NOT end
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player2",
        nextPlayerId: "player1",
      })
    );
    // ROUND_ENDED only happens when end-of-round was announced
    expect(result.events).not.toContainEqual(
      expect.objectContaining({
        type: ROUND_ENDED,
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
      playedCardFromHandThisTurn: true,
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
    expect(updatedPlayer?.movePoints).toBe(TURN_START_MOVE_POINTS);
    expect(updatedPlayer?.hasMovedThisTurn).toBe(false);
    expect(updatedPlayer?.hasTakenActionThisTurn).toBe(false);
    expect(updatedPlayer?.influencePoints).toBe(0);
    expect(updatedPlayer?.usedManaFromSource).toBe(false);
  });

  it("should give next player starting move points", () => {
    const player1 = createTestPlayer({ id: "player1", movePoints: 4, playedCardFromHandThisTurn: true });
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
    expect(nextPlayer?.movePoints).toBe(TURN_START_MOVE_POINTS);
  });

  it("should clear command stack (not undoable)", () => {
    const state = createTestGameState({
      players: [createTestPlayer({ movePoints: 4, playedCardFromHandThisTurn: true })],
    });

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
      players: [createTestPlayer({ movePoints: 4, playedCardFromHandThisTurn: true })],
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
      players: [createTestPlayer({ movePoints: 4, playedCardFromHandThisTurn: true })],
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

describe("END_TURN card flow", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should move play area cards to discard", () => {
    const player = createTestPlayer({
      playArea: [CARD_MARCH, CARD_RAGE],
      discard: [CARD_STAMINA],
      deck: [CARD_SWIFTNESS, CARD_DETERMINATION],
      hand: [],
      handLimit: 5,
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    expect(updatedPlayer?.playArea).toHaveLength(0);
    expect(updatedPlayer?.discard).toContain(CARD_MARCH);
    expect(updatedPlayer?.discard).toContain(CARD_RAGE);
    expect(updatedPlayer?.discard).toContain(CARD_STAMINA);
    expect(updatedPlayer?.discard).toHaveLength(3);
  });

  it("should draw up to hand limit", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH], // 1 card in hand
      deck: [
        CARD_RAGE,
        CARD_STAMINA,
        CARD_SWIFTNESS,
        CARD_DETERMINATION,
        CARD_PROMISE,
      ],
      discard: [],
      playArea: [],
      handLimit: 5,
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    expect(updatedPlayer?.hand).toHaveLength(5); // Drew 4 cards to reach limit
    expect(updatedPlayer?.deck).toHaveLength(1); // 5 - 4 = 1 remaining
  });

  it("should stop drawing if deck empties (no mid-round reshuffle)", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH], // 1 card
      deck: [CARD_RAGE, CARD_STAMINA], // Only 2 cards in deck
      discard: [CARD_SWIFTNESS, CARD_DETERMINATION], // Cards in discard
      playArea: [],
      handLimit: 5,
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    expect(updatedPlayer?.hand).toHaveLength(3); // 1 + 2 drawn = 3 (not 5)
    expect(updatedPlayer?.deck).toHaveLength(0); // Deck empty
    expect(updatedPlayer?.discard).toHaveLength(2); // Discard NOT shuffled back
  });

  it("should not discard down if over hand limit", () => {
    const player = createTestPlayer({
      hand: [
        CARD_MARCH,
        CARD_RAGE,
        CARD_STAMINA,
        CARD_SWIFTNESS,
        CARD_DETERMINATION,
        CARD_PROMISE,
      ], // 6 cards
      deck: [CARD_THREATEN],
      discard: [],
      playArea: [],
      handLimit: 5, // Over limit
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    expect(updatedPlayer?.hand).toHaveLength(6); // Still 6, no forced discard
  });

  it("should include card counts in TURN_ENDED event", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      deck: [CARD_RAGE, CARD_STAMINA, CARD_SWIFTNESS, CARD_DETERMINATION],
      discard: [],
      playArea: [CARD_PROMISE, CARD_THREATEN],
      handLimit: 5,
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        cardsDiscarded: 2,
        cardsDrawn: 4,
      })
    );
  });

  it("should reset combat accumulator at end of turn", () => {
    // Create a modified accumulator with some values
    const modifiedAccumulator = {
      ...createEmptyCombatAccumulator(),
      attack: {
        ...createEmptyCombatAccumulator().attack,
        normal: 5,
        ranged: 3,
        normalElements: { physical: 5, fire: 0, ice: 0, coldFire: 0 },
        rangedElements: { physical: 3, fire: 0, ice: 0, coldFire: 0 },
      },
      block: 4,
      blockElements: { physical: 4, fire: 0, ice: 0, coldFire: 0 },
    };
    const player = createTestPlayer({
      combatAccumulator: modifiedAccumulator,
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer = result.state.players[0];
    expect(updatedPlayer?.combatAccumulator).toEqual(createEmptyCombatAccumulator());
  });
});

describe("Round end reshuffling", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should reshuffle all cards at end of round", () => {
    const player1 = createTestPlayer({
      id: "player1",
      hand: [CARD_MARCH],
      deck: [], // Empty deck
      discard: [CARD_RAGE, CARD_STAMINA, CARD_SWIFTNESS],
      playArea: [CARD_DETERMINATION],
      handLimit: 5,
    });
    const player2 = createTestPlayer({
      id: "player2",
      hand: [CARD_PROMISE],
      deck: [CARD_THREATEN],
      discard: [],
      playArea: [],
      handLimit: 5,
      playedCardFromHandThisTurn: true,
    });

    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 1, // Player 2's turn
      // Player 2 announced end of round, so ending their turn triggers round end
      endOfRoundAnnouncedBy: "player2",
      playersWithFinalTurn: [],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    // Round should have ended
    expect(result.state.round).toBe(state.round + 1);

    // Player 1 should have reshuffled deck
    const updatedPlayer1 = result.state.players[0];
    expect(updatedPlayer1?.discard).toHaveLength(0); // Discard cleared
    // Total cards (hand + deck) should equal original total
    // Original: 1 (hand) + 0 (deck) + 3 (discard) + 1 (play area) = 5
    const totalCards =
      (updatedPlayer1?.hand.length ?? 0) + (updatedPlayer1?.deck.length ?? 0);
    expect(totalCards).toBe(5);
    // Should have drawn up to hand limit
    expect(updatedPlayer1?.hand).toHaveLength(5);
    expect(updatedPlayer1?.deck).toHaveLength(0);
  });

  it("should reshuffle player with more cards than hand limit", () => {
    const player1 = createTestPlayer({
      id: "player1",
      hand: [CARD_MARCH, CARD_RAGE],
      deck: [CARD_STAMINA, CARD_SWIFTNESS, CARD_DETERMINATION],
      discard: [CARD_PROMISE, CARD_THREATEN],
      playArea: [],
      handLimit: 5,
    });
    const player2 = createTestPlayer({
      id: "player2",
      hand: [],
      deck: [],
      discard: [],
      playArea: [],
      handLimit: 5,
      playedCardFromHandThisTurn: true, // Empty hand, but satisfies requirement via flag
    });

    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 1, // Player 2's turn
      // Player 2 announced end of round
      endOfRoundAnnouncedBy: "player2",
      playersWithFinalTurn: [],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    const updatedPlayer1 = result.state.players[0];
    // Original total: 2 + 3 + 2 = 7 cards
    const totalCards =
      (updatedPlayer1?.hand.length ?? 0) + (updatedPlayer1?.deck.length ?? 0);
    expect(totalCards).toBe(7);
    expect(updatedPlayer1?.hand).toHaveLength(5); // Hand limit
    expect(updatedPlayer1?.deck).toHaveLength(2); // Remaining in deck
    expect(updatedPlayer1?.discard).toHaveLength(0); // Discard cleared
  });

  it("should emit ROUND_ENDED event with round number", () => {
    const player1 = createTestPlayer({ id: "player1" });
    const player2 = createTestPlayer({ id: "player2", playedCardFromHandThisTurn: true });

    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 1,
      round: 3,
      // Player 2 announced end of round
      endOfRoundAnnouncedBy: "player2",
      playersWithFinalTurn: [],
    });

    const result = engine.processAction(state, "player2", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: ROUND_ENDED,
        round: 3,
      })
    );
  });
});

describe("END_TURN with empty deck and hand", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should auto-announce end of round when deck and hand are empty", () => {
    const player = createTestPlayer({
      id: "player1",
      deck: [],
      hand: [],
      discard: [CARD_MARCH, CARD_RAGE], // Cards exist but not in deck/hand
      playArea: [],
    });
    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
      currentPlayerIndex: 0,
      endOfRoundAnnouncedBy: null, // Not yet announced
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Should have auto-converted to announce end of round
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: END_OF_ROUND_ANNOUNCED,
        playerId: "player1",
      })
    );

    // State should reflect announcement
    expect(result.state.endOfRoundAnnouncedBy).toBe("player1");
  });

  it("should allow normal end turn if end of round already announced", () => {
    const player = createTestPlayer({
      id: "player1",
      deck: [],
      hand: [],
      discard: [CARD_MARCH, CARD_RAGE],
      playArea: [],
    });
    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
      currentPlayerIndex: 0,
      endOfRoundAnnouncedBy: "player1", // Already announced
      playersWithFinalTurn: [], // No one left for final turn
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Should proceed as normal end turn (triggering round end since no final turns left)
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );

    // Should NOT emit another END_OF_ROUND_ANNOUNCED
    const announceEvents = result.events.filter(
      (e) => e.type === END_OF_ROUND_ANNOUNCED
    );
    expect(announceEvents).toHaveLength(0);
  });

  it("should allow normal end turn if hand has cards (and played one)", () => {
    const player = createTestPlayer({
      id: "player1",
      deck: [],
      hand: [CARD_MARCH], // Has card in hand
      discard: [CARD_RAGE],
      playArea: [],
      playedCardFromHandThisTurn: true, // Must have played a card to end turn
    });
    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
      currentPlayerIndex: 0,
      endOfRoundAnnouncedBy: null,
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Should be normal end turn, not announcement
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );

    // Should NOT announce
    const announceEvents = result.events.filter(
      (e) => e.type === END_OF_ROUND_ANNOUNCED
    );
    expect(announceEvents).toHaveLength(0);
  });

  it("should allow normal end turn if deck has cards", () => {
    const player = createTestPlayer({
      id: "player1",
      deck: [CARD_MARCH], // Has card in deck
      hand: [],
      discard: [CARD_RAGE],
      playArea: [],
    });
    const state = createTestGameState({
      players: [player],
      turnOrder: ["player1"],
      currentPlayerIndex: 0,
      endOfRoundAnnouncedBy: null,
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Should be normal end turn with card draw
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );

    // Should NOT announce
    const announceEvents = result.events.filter(
      (e) => e.type === END_OF_ROUND_ANNOUNCED
    );
    expect(announceEvents).toHaveLength(0);
  });
});

describe("END_TURN minimum turn requirement", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should reject END_TURN if player has cards but hasn't played any", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH, CARD_RAGE], // Has cards in hand
      playedCardFromHandThisTurn: false, // Hasn't played a card
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        reason: "You must play or discard at least one card from your hand before ending your turn",
      })
    );
    // State should not change
    expect(result.state.currentPlayerIndex).toBe(state.currentPlayerIndex);
  });

  it("should allow END_TURN if player played a card from hand", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      playedCardFromHandThisTurn: true, // Played a card
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );
  });

  it("should allow END_TURN if player has empty hand", () => {
    const player = createTestPlayer({
      hand: [], // No cards in hand
      deck: [CARD_MARCH], // But has cards in deck
      playedCardFromHandThisTurn: false, // Didn't play a card
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Should succeed - empty hand waives the requirement
    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );
  });

  it("should reset playedCardFromHandThisTurn at start of next turn", () => {
    const player1 = createTestPlayer({
      id: "player1",
      playedCardFromHandThisTurn: true,
    });
    const player2 = createTestPlayer({
      id: "player2",
      playedCardFromHandThisTurn: true,
    });
    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // Player 1's flag should be reset for their next turn
    const updatedPlayer1 = result.state.players.find((p) => p.id === "player1");
    expect(updatedPlayer1?.playedCardFromHandThisTurn).toBe(false);
  });

  it("should set playedCardFromHandThisTurn when resting", () => {
    // This test verifies that resting satisfies the minimum turn requirement
    // because rest involves discarding cards from hand
    const player = createTestPlayer({
      hand: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
      deck: [],
      discard: [],
      playedCardFromHandThisTurn: false,
      hasTakenActionThisTurn: false,
    });
    const state = createTestGameState({ players: [player] });

    // Rest by discarding one non-wound card
    const restResult = engine.processAction(state, "player1", {
      type: "REST",
      restType: "standard",
      discardCardIds: [CARD_MARCH],
    });

    // After resting, the flag should be set
    const updatedPlayer = restResult.state.players[0];
    expect(updatedPlayer?.playedCardFromHandThisTurn).toBe(true);

    // Now player should be able to END_TURN
    const endResult = engine.processAction(restResult.state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(endResult.events).toContainEqual(
      expect.objectContaining({
        type: TURN_ENDED,
        playerId: "player1",
      })
    );
  });
});

describe("END_TURN mana source dice cleanup", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("should clear takenByPlayerId for all dice used this turn (not just the last one)", () => {
    // This test reproduces a bug where playing multiple powered cards in one turn
    // would only track the LAST die used, leaving earlier dice stuck as "taken"

    // Set up dice where two are marked as taken by player1
    // (simulating what happens after playing two powered cards)
    const dice: SourceDie[] = [
      { id: sourceDieId("die_0"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player1" },
      { id: sourceDieId("die_1"), color: MANA_GREEN, isDepleted: false, takenByPlayerId: "player1" },
      { id: sourceDieId("die_2"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
    ];

    // Player has used mana from source, tracking BOTH dice they used
    const player = createTestPlayer({
      id: "player1",
      usedManaFromSource: true,
      usedDieIds: [sourceDieId("die_0"), sourceDieId("die_1")], // Both dice used this turn
      playedCardFromHandThisTurn: true,
    });

    const state = createTestGameState({
      players: [player],
      source: { dice },
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    // ALL dice that were taken by this player should be cleared at end of turn
    const resultDice = result.state.source.dice;

    // die_0 was taken by player1 - should be cleared
    expect(resultDice.find((d) => d.id === "die_0")?.takenByPlayerId).toBeNull();

    // die_1 was taken by player1 - should be cleared (and rerolled)
    expect(resultDice.find((d) => d.id === "die_1")?.takenByPlayerId).toBeNull();

    // die_2 was not taken - should remain null
    expect(resultDice.find((d) => d.id === "die_2")?.takenByPlayerId).toBeNull();
  });

  it("should not clear dice taken by other players", () => {
    // Set up dice where one is taken by player2
    const dice: SourceDie[] = [
      { id: sourceDieId("die_0"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: "player1" },
      { id: sourceDieId("die_1"), color: MANA_GREEN, isDepleted: false, takenByPlayerId: "player2" },
      { id: sourceDieId("die_2"), color: MANA_BLUE, isDepleted: false, takenByPlayerId: null },
    ];

    const player1 = createTestPlayer({
      id: "player1",
      usedManaFromSource: true,
      usedDieIds: [sourceDieId("die_0")],
      playedCardFromHandThisTurn: true,
    });
    const player2 = createTestPlayer({
      id: "player2",
      usedManaFromSource: true,
      usedDieIds: [sourceDieId("die_1")],
    });

    const state = createTestGameState({
      players: [player1, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      source: { dice },
    });

    const result = engine.processAction(state, "player1", {
      type: END_TURN_ACTION,
    });

    const resultDice = result.state.source.dice;

    // die_0 was taken by player1 - should be cleared
    expect(resultDice.find((d) => d.id === "die_0")?.takenByPlayerId).toBeNull();

    // die_1 was taken by player2 - should NOT be cleared (it's their die)
    expect(resultDice.find((d) => d.id === "die_1")?.takenByPlayerId).toBe("player2");

    // die_2 was not taken - should remain null
    expect(resultDice.find((d) => d.id === "die_2")?.takenByPlayerId).toBeNull();
  });
});
