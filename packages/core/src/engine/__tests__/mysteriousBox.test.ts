import { beforeEach, describe, expect, it } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { createPlayerUnit } from "../../types/unit.js";
import type { ResolveMysteriousBoxUseEffect } from "../../types/cards.js";
import { EFFECT_RESOLVE_MYSTERIOUS_BOX_USE } from "../../types/effectTypes.js";
import {
  CARD_AMULET_OF_THE_SUN,
  CARD_BANNER_OF_COMMAND,
  CARD_MARCH,
  CARD_MYSTERIOUS_BOX,
  CARD_RUBY_RING,
  END_TURN_ACTION,
  INVALID_ACTION,
  MANA_GOLD,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  RESOLVE_CHOICE_ACTION,
  UNIT_PEASANTS,
} from "@mage-knight/shared";

function getMysteriousBoxChoiceIndex(
  state: ReturnType<MageKnightEngine["processAction"]>["state"],
  mode: ResolveMysteriousBoxUseEffect["mode"]
): number {
  const pendingChoice = state.players[0]!.pendingChoice;
  expect(pendingChoice).not.toBeNull();

  const index = pendingChoice!.options.findIndex((option) => {
    if (option.type !== EFFECT_RESOLVE_MYSTERIOUS_BOX_USE) {
      return false;
    }
    return (option as ResolveMysteriousBoxUseEffect).mode === mode;
  });

  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe("Mysterious Box", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("reveals the top artifact and removes it from the deck", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
    });
    const state = createTestGameState({
      players: [player],
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const result = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    expect(result.state.players[0]!.mysteriousBoxState).toEqual(
      expect.objectContaining({
        revealedArtifactId: CARD_AMULET_OF_THE_SUN,
        usedAs: "unused",
      })
    );
    expect(result.state.decks.artifacts).toEqual([CARD_RUBY_RING]);
    expect(result.state.players[0]!.pendingChoice).not.toBeNull();
  });

  it("can use the revealed artifact's basic effect and gains Fame +1", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
      fame: 0,
      pureMana: [],
    });
    const state = createTestGameState({
      players: [player],
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const afterPlay = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    const basicIndex = getMysteriousBoxChoiceIndex(afterPlay.state, "basic");

    const afterChoice = engine.processAction(afterPlay.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: basicIndex,
    });

    const updatedPlayer = afterChoice.state.players[0]!;
    expect(updatedPlayer.fame).toBe(1);
    expect(
      updatedPlayer.pureMana.filter((token) => token.color === MANA_GOLD)
    ).toHaveLength(1);
    expect(updatedPlayer.mysteriousBoxState?.usedAs).toBe("basic");
  });

  it("can use the revealed artifact's powered effect and is removed at end of turn", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
      fame: 0,
      pureMana: [],
      removedCards: [],
    });
    const player2 = createTestPlayer({
      id: "player2",
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({
      players: [player, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const afterPlay = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    const poweredIndex = getMysteriousBoxChoiceIndex(afterPlay.state, "powered");
    const afterChoice = engine.processAction(afterPlay.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: poweredIndex,
    });

    const playerAfterChoice = afterChoice.state.players[0]!;
    expect(playerAfterChoice.fame).toBe(1);
    expect(
      playerAfterChoice.pureMana.filter((token) => token.color === MANA_GOLD)
    ).toHaveLength(3);

    const afterEndTurn = engine.processAction(afterChoice.state, "player1", {
      type: END_TURN_ACTION,
    });

    const playerAfterEnd = afterEndTurn.state.players[0]!;
    expect(playerAfterEnd.removedCards).toContain(CARD_MYSTERIOUS_BOX);
    expect(playerAfterEnd.discard).not.toContain(CARD_MYSTERIOUS_BOX);
    expect(afterEndTurn.state.decks.artifacts).toEqual([
      CARD_RUBY_RING,
      CARD_AMULET_OF_THE_SUN,
    ]);
  });

  it("can attach as banner when revealed artifact is a banner and discards at end of turn", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
      units: [createPlayerUnit(UNIT_PEASANTS, "unit_1")],
      attachedBanners: [],
      discard: [],
    });
    const player2 = createTestPlayer({
      id: "player2",
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({
      players: [player, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_BANNER_OF_COMMAND, CARD_RUBY_RING],
      },
    });

    const afterPlay = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    const bannerIndex = getMysteriousBoxChoiceIndex(afterPlay.state, "banner");
    const afterChoice = engine.processAction(afterPlay.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: bannerIndex,
    });

    const playerAfterChoice = afterChoice.state.players[0]!;
    expect(playerAfterChoice.fame).toBe(1);
    expect(playerAfterChoice.attachedBanners).toContainEqual(
      expect.objectContaining({ bannerId: CARD_MYSTERIOUS_BOX })
    );

    const afterEndTurn = engine.processAction(afterChoice.state, "player1", {
      type: END_TURN_ACTION,
    });

    const playerAfterEnd = afterEndTurn.state.players[0]!;
    expect(
      playerAfterEnd.attachedBanners.some(
        (attachment) => attachment.bannerId === CARD_MYSTERIOUS_BOX
      )
    ).toBe(false);
    expect(playerAfterEnd.discard).toContain(CARD_MYSTERIOUS_BOX);
  });

  it("returns to hand and grants no Fame when left unused", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
      fame: 0,
      discard: [],
      removedCards: [],
    });
    const player2 = createTestPlayer({
      id: "player2",
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({
      players: [player, player2],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const afterPlay = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    const unusedIndex = getMysteriousBoxChoiceIndex(afterPlay.state, "unused");
    const afterChoice = engine.processAction(afterPlay.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: unusedIndex,
    });

    expect(afterChoice.state.players[0]!.fame).toBe(0);
    expect(afterChoice.state.players[0]!.mysteriousBoxState?.usedAs).toBe("unused");

    const afterEndTurn = engine.processAction(afterChoice.state, "player1", {
      type: END_TURN_ACTION,
    });

    const playerAfterEnd = afterEndTurn.state.players[0]!;
    expect(playerAfterEnd.hand).toContain(CARD_MYSTERIOUS_BOX);
    expect(playerAfterEnd.discard).not.toContain(CARD_MYSTERIOUS_BOX);
    expect(playerAfterEnd.removedCards).not.toContain(CARD_MYSTERIOUS_BOX);
    expect(afterEndTurn.state.decks.artifacts).toEqual([
      CARD_RUBY_RING,
      CARD_AMULET_OF_THE_SUN,
    ]);
  });

  it("playing and returning it unused does not satisfy minimum turn requirement", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX, CARD_MARCH],
      playedCardFromHandThisTurn: false,
    });
    const state = createTestGameState({
      players: [player],
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const afterPlay = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      powered: false,
    });

    const unusedIndex = getMysteriousBoxChoiceIndex(afterPlay.state, "unused");
    const afterChoice = engine.processAction(afterPlay.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: unusedIndex,
    });

    expect(afterChoice.state.players[0]!.playedCardFromHandThisTurn).toBe(false);

    const endTurnAttempt = engine.processAction(afterChoice.state, "player1", {
      type: END_TURN_ACTION,
    });

    expect(endTurnAttempt.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
      })
    );
  });

  it("can be played sideways for no Fame and no reveal", () => {
    const player = createTestPlayer({
      hand: [CARD_MYSTERIOUS_BOX],
      fame: 0,
    });
    const state = createTestGameState({
      players: [player],
      decks: {
        ...createTestGameState().decks,
        artifacts: [CARD_AMULET_OF_THE_SUN, CARD_RUBY_RING],
      },
    });

    const result = engine.processAction(state, "player1", {
      type: PLAY_CARD_SIDEWAYS_ACTION,
      cardId: CARD_MYSTERIOUS_BOX,
      as: PLAY_SIDEWAYS_AS_MOVE,
    });

    expect(result.state.players[0]!.fame).toBe(0);
    expect(result.state.players[0]!.mysteriousBoxState).toBeNull();
    expect(result.state.decks.artifacts).toEqual([
      CARD_AMULET_OF_THE_SUN,
      CARD_RUBY_RING,
    ]);
  });
});
