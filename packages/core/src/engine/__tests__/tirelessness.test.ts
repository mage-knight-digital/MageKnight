/**
 * Tests for Wolfhawk's Tirelessness
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_PROMISE,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_MOVEMENT_CARD_BONUS,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

describe("Tirelessness", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("basic effect grants +1 to the next movement card only", () => {
    const player = createTestPlayer({
      hand: [CARD_WOLFHAWK_TIRELESSNESS, CARD_MARCH, CARD_SWIFTNESS],
      movePoints: 0,
    });
    const state = createTestGameState({ players: [player] });

    const afterTirelessness = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_WOLFHAWK_TIRELESSNESS,
      powered: false,
    });

    expect(afterTirelessness.state.players[0].movePoints).toBe(2);
    expect(afterTirelessness.state.activeModifiers).toHaveLength(1);
    expect(afterTirelessness.state.activeModifiers[0]?.effect.type).toBe(
      EFFECT_MOVEMENT_CARD_BONUS
    );

    const afterMarch = engine.processAction(afterTirelessness.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: false,
    });

    expect(afterMarch.state.players[0].movePoints).toBe(5);
    expect(afterMarch.state.activeModifiers).toHaveLength(0);

    const afterSwiftness = engine.processAction(afterMarch.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_SWIFTNESS,
      powered: false,
    });

    expect(afterSwiftness.state.players[0].movePoints).toBe(7);
  });

  it("powered effect grants +1 to all subsequent movement cards", () => {
    const player = createTestPlayer({
      hand: [CARD_WOLFHAWK_TIRELESSNESS, CARD_MARCH, CARD_SWIFTNESS],
      movePoints: 0,
      pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD }],
    });
    const state = createTestGameState({ players: [player] });

    const afterTirelessness = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_WOLFHAWK_TIRELESSNESS,
      powered: true,
      manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
    });

    expect(afterTirelessness.state.players[0].movePoints).toBe(4);
    expect(afterTirelessness.state.activeModifiers).toHaveLength(1);

    const afterMarch = engine.processAction(afterTirelessness.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: false,
    });

    expect(afterMarch.state.players[0].movePoints).toBe(7);
    expect(afterMarch.state.activeModifiers).toHaveLength(1);

    const afterSwiftness = engine.processAction(afterMarch.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_SWIFTNESS,
      powered: false,
    });

    expect(afterSwiftness.state.players[0].movePoints).toBe(10);
    expect(afterSwiftness.state.activeModifiers).toHaveLength(1);
  });

  it("sideways move benefits from the bonus", () => {
    const player = createTestPlayer({
      hand: [CARD_WOLFHAWK_TIRELESSNESS, CARD_PROMISE],
      movePoints: 0,
    });
    const state = createTestGameState({ players: [player] });

    const afterTirelessness = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_WOLFHAWK_TIRELESSNESS,
      powered: false,
    });

    const afterSideways = engine.processAction(afterTirelessness.state, "player1", {
      type: PLAY_CARD_SIDEWAYS_ACTION,
      cardId: CARD_PROMISE,
      as: PLAY_SIDEWAYS_AS_MOVE,
    });

    expect(afterSideways.state.players[0].movePoints).toBe(4);
  });

  it("non-move cards do not consume the bonus", () => {
    const player = createTestPlayer({
      hand: [CARD_WOLFHAWK_TIRELESSNESS, CARD_PROMISE, CARD_MARCH],
      movePoints: 0,
    });
    const state = createTestGameState({ players: [player] });

    const afterTirelessness = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_WOLFHAWK_TIRELESSNESS,
      powered: false,
    });

    const afterPromise = engine.processAction(afterTirelessness.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_PROMISE,
      powered: false,
    });

    expect(afterPromise.state.activeModifiers).toHaveLength(1);

    const afterMarch = engine.processAction(afterPromise.state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: false,
    });

    expect(afterMarch.state.players[0].movePoints).toBe(5);
    expect(afterMarch.state.activeModifiers).toHaveLength(0);
  });

  it("stacks multiple movement bonuses", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      movePoints: 0,
    });

    const modifierOne: ActiveModifier = {
      id: "bonus_one",
      source: {
        type: SOURCE_CARD,
        cardId: CARD_WOLFHAWK_TIRELESSNESS,
        playerId: "player1",
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_MOVEMENT_CARD_BONUS, amount: 1, remaining: 1 },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    };

    const modifierTwo: ActiveModifier = {
      id: "bonus_two",
      source: {
        type: SOURCE_CARD,
        cardId: CARD_WOLFHAWK_TIRELESSNESS,
        playerId: "player1",
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: { type: EFFECT_MOVEMENT_CARD_BONUS, amount: 1, remaining: 1 },
      createdAtRound: 1,
      createdByPlayerId: "player1",
    };

    const state = createTestGameState({
      players: [player],
      activeModifiers: [modifierOne, modifierTwo],
    });

    const result = engine.processAction(state, "player1", {
      type: PLAY_CARD_ACTION,
      cardId: CARD_MARCH,
      powered: false,
    });

    expect(result.state.players[0].movePoints).toBe(4);
    expect(result.state.activeModifiers).toHaveLength(0);
  });
});
