/**
 * Tests for Meditation/Trance spell (Green Spell #06)
 *
 * Meditation (basic): Randomly pick 2 cards from discard → place on top or bottom of deck.
 *   Hand limit +2 on next draw.
 * Trance (powered): Choose 2 cards from discard → place on top or bottom of deck.
 *   Hand limit +2 on next draw.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  CARD_MEDITATION,
  CARD_MARCH,
  CARD_RAGE,
  CARD_STAMINA,
  CARD_WOUND,
  RESOLVE_MEDITATION_ACTION,
  MEDITATION_CARDS_SELECTED,
  MEDITATION_CARDS_PLACED,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import { getMeditationSelectCount, canPlayMeditation } from "../rules/meditation.js";
import {
  validateHasPendingMeditation,
  validateMeditationChoice,
} from "../validators/meditationValidators.js";
import { getMeditationOptions } from "../validActions/pending.js";
import { getValidActions } from "../validActions/index.js";
import { createPlayCardCommand } from "../commands/playCardCommand.js";
import { createResolveMeditationCommand } from "../commands/resolveMeditationCommand.js";
import type { GameState } from "../../state/GameState.js";

// ============================================================================
// 1. Rule Unit Tests
// ============================================================================

describe("Meditation rules", () => {
  it("getMeditationSelectCount returns min(2, discard.length)", () => {
    const player0 = createTestPlayer({ discard: [] });
    expect(getMeditationSelectCount(player0)).toBe(0);

    const player1 = createTestPlayer({ discard: [CARD_MARCH] });
    expect(getMeditationSelectCount(player1)).toBe(1);

    const player2 = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE],
    });
    expect(getMeditationSelectCount(player2)).toBe(2);

    const player3 = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
    });
    expect(getMeditationSelectCount(player3)).toBe(2);
  });

  it("canPlayMeditation requires at least 1 card in discard", () => {
    const empty = createTestPlayer({ discard: [] });
    expect(canPlayMeditation(empty)).toBe(false);

    const hasOne = createTestPlayer({ discard: [CARD_MARCH] });
    expect(canPlayMeditation(hasOne)).toBe(true);
  });
});

// ============================================================================
// 2. Validator Tests
// ============================================================================

describe("Meditation validators", () => {
  it("validateHasPendingMeditation rejects when no pending state", () => {
    const player = createTestPlayer({ pendingMeditation: undefined });
    const state = createTestGameState({ players: [player] });
    const result = validateHasPendingMeditation(state, "player1", {} as never);
    expect(result.valid).toBe(false);
  });

  it("validateHasPendingMeditation passes when pending state exists", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
    });
    const state = createTestGameState({ players: [player] });
    const result = validateHasPendingMeditation(state, "player1", {} as never);
    expect(result.valid).toBe(true);
  });

  it("validateMeditationChoice rejects missing card selection in select_cards phase", () => {
    const player = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE],
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = { type: RESOLVE_MEDITATION_ACTION } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(false);
  });

  it("validateMeditationChoice rejects wrong count in select_cards phase", () => {
    const player = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE],
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = {
      type: RESOLVE_MEDITATION_ACTION,
      selectedCardIds: [CARD_MARCH],
    } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(false);
  });

  it("validateMeditationChoice rejects cards not in discard", () => {
    const player = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE],
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = {
      type: RESOLVE_MEDITATION_ACTION,
      selectedCardIds: [CARD_MARCH, CARD_STAMINA],
    } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(false);
  });

  it("validateMeditationChoice accepts valid selection in select_cards phase", () => {
    const player = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE],
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = {
      type: RESOLVE_MEDITATION_ACTION,
      selectedCardIds: [CARD_MARCH, CARD_RAGE],
    } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(true);
  });

  it("validateMeditationChoice rejects missing placeOnTop in place_cards phase", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH, CARD_RAGE],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = { type: RESOLVE_MEDITATION_ACTION } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(false);
  });

  it("validateMeditationChoice accepts placeOnTop in place_cards phase", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH, CARD_RAGE],
      },
    });
    const state = createTestGameState({ players: [player] });
    const action = {
      type: RESOLVE_MEDITATION_ACTION,
      placeOnTop: true,
    } as never;
    const result = validateMeditationChoice(state, "player1", action);
    expect(result.valid).toBe(true);
  });
});

// ============================================================================
// 3. ValidActions Tests
// ============================================================================

describe("Meditation validActions", () => {
  it("returns pending_meditation mode with select_cards phase (powered)", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
      discard: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, "player1");

    expect(validActions.mode).toBe("pending_meditation");
    if (validActions.mode === "pending_meditation") {
      expect(validActions.meditation.phase).toBe("select_cards");
      expect(validActions.meditation.version).toBe("powered");
      expect(validActions.meditation.selectCount).toBe(2);
      expect(validActions.meditation.eligibleCardIds).toHaveLength(3);
    }
  });

  it("returns pending_meditation mode with place_cards phase (basic)", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH, CARD_RAGE],
      },
    });
    const state = createTestGameState({ players: [player] });
    const validActions = getValidActions(state, "player1");

    expect(validActions.mode).toBe("pending_meditation");
    if (validActions.mode === "pending_meditation") {
      expect(validActions.meditation.phase).toBe("place_cards");
      expect(validActions.meditation.version).toBe("basic");
      expect(validActions.meditation.selectedCardIds).toEqual([
        CARD_MARCH,
        CARD_RAGE,
      ]);
    }
  });

  it("getMeditationOptions returns correct data for select_cards phase", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
      discard: [CARD_MARCH, CARD_RAGE],
    });
    const state = createTestGameState({ players: [player] });
    const options = getMeditationOptions(state, player);

    expect(options.phase).toBe("select_cards");
    expect(options.version).toBe("powered");
    expect(options.selectCount).toBe(2);
    expect(options.eligibleCardIds).toEqual([CARD_MARCH, CARD_RAGE]);
  });

  it("getMeditationOptions returns correct data for place_cards phase", () => {
    const player = createTestPlayer({
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH],
      },
    });
    const state = createTestGameState({ players: [player] });
    const options = getMeditationOptions(state, player);

    expect(options.phase).toBe("place_cards");
    expect(options.version).toBe("basic");
    expect(options.selectedCardIds).toEqual([CARD_MARCH]);
  });
});

// ============================================================================
// 4. PlayCardCommand Integration Tests
// ============================================================================

describe("Meditation playCardCommand integration", () => {
  function createMeditationState(
    discardCards: CardId[]
  ): GameState {
    const player = createTestPlayer({
      hand: [CARD_MEDITATION, CARD_MARCH],
      discard: discardCards,
    });
    return createTestGameState({ players: [player] });
  }

  it("basic mode: sets pendingMeditation with place_cards phase and random selection", () => {
    const state = createMeditationState(
      [CARD_MARCH, CARD_RAGE, CARD_STAMINA]
    );
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MEDITATION,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;

    expect(player.pendingMeditation).toBeDefined();
    expect(player.pendingMeditation!.version).toBe("basic");
    expect(player.pendingMeditation!.phase).toBe("place_cards");
    expect(player.pendingMeditation!.selectedCardIds).toHaveLength(2);
    expect(player.meditationHandLimitBonus).toBe(2);

    // Cards selected should be from the discard pile
    for (const cardId of player.pendingMeditation!.selectedCardIds) {
      expect(state.players[0]!.discard).toContain(cardId);
    }

    // Should emit MEDITATION_CARDS_SELECTED event
    const selectEvent = result.events.find(
      (e) => e.type === MEDITATION_CARDS_SELECTED
    );
    expect(selectEvent).toBeDefined();
  });

  it("basic mode: RNG advances (non-reversible)", () => {
    const state = createMeditationState(
      [CARD_MARCH, CARD_RAGE]
    );
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MEDITATION,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    // RNG should have advanced
    expect(result.state.rng).not.toEqual(state.rng);
  });

  it("powered mode: sets pendingMeditation with select_cards phase", () => {
    const playerWithCrystals = createTestPlayer({
      hand: [CARD_MEDITATION, CARD_MARCH],
      discard: [CARD_MARCH, CARD_RAGE],
      crystals: { red: 0, blue: 0, green: 1, white: 0 },
    });
    const stateWithCrystals = createTestGameState({
      players: [playerWithCrystals],
    });
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MEDITATION,
      handIndex: 0,
      powered: true,
      manaSources: [
        { type: "crystal", color: "black" },
        { type: "crystal", color: "green" },
      ],
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(stateWithCrystals);
    const player = result.state.players[0]!;

    expect(player.pendingMeditation).toBeDefined();
    expect(player.pendingMeditation!.version).toBe("powered");
    expect(player.pendingMeditation!.phase).toBe("select_cards");
    expect(player.pendingMeditation!.selectedCardIds).toEqual([]);
    expect(player.meditationHandLimitBonus).toBe(2);
  });

  it("basic mode with only 1 card in discard: selects 1 card", () => {
    const state = createMeditationState([CARD_MARCH]);
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MEDITATION,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const result = cmd.execute(state);
    const player = result.state.players[0]!;

    expect(player.pendingMeditation!.selectedCardIds).toHaveLength(1);
    expect(player.pendingMeditation!.selectedCardIds[0]).toBe(CARD_MARCH);
  });

  it("undo clears pendingMeditation and meditationHandLimitBonus", () => {
    const state = createMeditationState(
      [CARD_MARCH, CARD_RAGE]
    );
    const cmd = createPlayCardCommand({
      playerId: "player1",
      cardId: CARD_MEDITATION,
      handIndex: 0,
      powered: false,
      previousPlayedCardFromHand: false,
    });

    const executeResult = cmd.execute(state);
    const player = executeResult.state.players[0]!;
    expect(player.pendingMeditation).toBeDefined();
    expect(player.meditationHandLimitBonus).toBe(2);

    const undoResult = cmd.undo(executeResult.state);
    const undoPlayer = undoResult.state.players[0]!;
    expect(undoPlayer.pendingMeditation).toBeUndefined();
    expect(undoPlayer.meditationHandLimitBonus).toBe(0);
  });
});

// ============================================================================
// 5. ResolveMeditationCommand Tests
// ============================================================================

describe("resolveMeditationCommand", () => {
  it("phase 1: stores selectedCardIds and advances to place_cards", () => {
    const player = createTestPlayer({
      discard: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
      pendingMeditation: {
        version: "powered",
        phase: "select_cards",
        selectedCardIds: [],
      },
      meditationHandLimitBonus: 2,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createResolveMeditationCommand({
      playerId: "player1",
      selectedCardIds: [CARD_MARCH, CARD_RAGE],
    });

    const result = cmd.execute(state);
    const updatedPlayer = result.state.players[0]!;

    expect(updatedPlayer.pendingMeditation!.phase).toBe("place_cards");
    expect(updatedPlayer.pendingMeditation!.selectedCardIds).toEqual([
      CARD_MARCH,
      CARD_RAGE,
    ]);

    const selectEvent = result.events.find(
      (e) => e.type === MEDITATION_CARDS_SELECTED
    );
    expect(selectEvent).toBeDefined();
  });

  it("phase 2: places cards on top of deck", () => {
    const player = createTestPlayer({
      deck: [CARD_WOUND],
      discard: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH, CARD_RAGE],
      },
      meditationHandLimitBonus: 2,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createResolveMeditationCommand({
      playerId: "player1",
      placeOnTop: true,
    });

    const result = cmd.execute(state);
    const updatedPlayer = result.state.players[0]!;

    // Cards should be on top of deck
    expect(updatedPlayer.deck[0]).toBe(CARD_MARCH);
    expect(updatedPlayer.deck[1]).toBe(CARD_RAGE);
    expect(updatedPlayer.deck[2]).toBe(CARD_WOUND);

    // Cards should be removed from discard
    expect(updatedPlayer.discard).not.toContain(CARD_MARCH);
    expect(updatedPlayer.discard).not.toContain(CARD_RAGE);
    expect(updatedPlayer.discard).toContain(CARD_STAMINA);

    // Pending state should be cleared
    expect(updatedPlayer.pendingMeditation).toBeUndefined();

    const placeEvent = result.events.find(
      (e) => e.type === MEDITATION_CARDS_PLACED
    );
    expect(placeEvent).toBeDefined();
    if (placeEvent && placeEvent.type === MEDITATION_CARDS_PLACED) {
      expect(placeEvent.position).toBe("top");
    }
  });

  it("phase 2: places cards on bottom of deck", () => {
    const player = createTestPlayer({
      deck: [CARD_WOUND],
      discard: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH, CARD_RAGE],
      },
      meditationHandLimitBonus: 2,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createResolveMeditationCommand({
      playerId: "player1",
      placeOnTop: false,
    });

    const result = cmd.execute(state);
    const updatedPlayer = result.state.players[0]!;

    // Cards should be on bottom of deck
    expect(updatedPlayer.deck[0]).toBe(CARD_WOUND);
    expect(updatedPlayer.deck[1]).toBe(CARD_MARCH);
    expect(updatedPlayer.deck[2]).toBe(CARD_RAGE);

    // Pending state should be cleared
    expect(updatedPlayer.pendingMeditation).toBeUndefined();

    const placeEvent = result.events.find(
      (e) => e.type === MEDITATION_CARDS_PLACED
    );
    if (placeEvent && placeEvent.type === MEDITATION_CARDS_PLACED) {
      expect(placeEvent.position).toBe("bottom");
    }
  });

  it("phase 2: preserves meditationHandLimitBonus (consumed at end of turn)", () => {
    const player = createTestPlayer({
      deck: [],
      discard: [CARD_MARCH],
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH],
      },
      meditationHandLimitBonus: 2,
    });
    const state = createTestGameState({ players: [player] });

    const cmd = createResolveMeditationCommand({
      playerId: "player1",
      placeOnTop: true,
    });

    const result = cmd.execute(state);
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.meditationHandLimitBonus).toBe(2);
  });
});

// ============================================================================
// 6. Hand Limit Integration
// ============================================================================

describe("Meditation hand limit bonus", () => {
  it("getEndTurnDrawLimit includes meditationHandLimitBonus", async () => {
    const { getEndTurnDrawLimit } = await import("../helpers/handLimitHelpers.js");

    const player = createTestPlayer({
      meditationHandLimitBonus: 2,
      handLimit: 5,
    });
    const state = createTestGameState({ players: [player] });

    const limit = getEndTurnDrawLimit(state, "player1", 0);
    // Base 5 + meditation bonus 2 = 7
    expect(limit).toBe(7);
  });

  it("getEndTurnDrawLimit works without meditationHandLimitBonus", async () => {
    const { getEndTurnDrawLimit } = await import("../helpers/handLimitHelpers.js");

    const player = createTestPlayer({
      meditationHandLimitBonus: 0,
      handLimit: 5,
    });
    const state = createTestGameState({ players: [player] });

    const limit = getEndTurnDrawLimit(state, "player1", 0);
    expect(limit).toBe(5);
  });
});

// ============================================================================
// 7. Player Reset Tests
// ============================================================================

describe("Meditation player reset", () => {
  it("createResetPlayer clears meditation state", async () => {
    const { createResetPlayer } = await import("../commands/endTurn/playerReset.js");

    const player = createTestPlayer({
      pendingMeditation: {
        version: "basic",
        phase: "place_cards",
        selectedCardIds: [CARD_MARCH],
      },
      meditationHandLimitBonus: 2,
    });

    const resetPlayer = createResetPlayer(player, {
      hand: [],
      deck: [],
      discard: [],
      playArea: [],
    });

    expect(resetPlayer.pendingMeditation).toBeUndefined();
    expect(resetPlayer.meditationHandLimitBonus).toBe(0);
  });
});
