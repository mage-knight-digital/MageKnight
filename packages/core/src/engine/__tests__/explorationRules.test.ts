import { describe, expect, it } from "vitest";
import { CARD_SPACE_BENDING, TERRAIN_PLAINS, hexKey } from "@mage-knight/shared";
import { addModifier } from "../modifiers/index.js";
import { createTestGameState, createTestHex, createTestPlayer } from "./testHelpers.js";
import { getExploreDistance, isPlayerNearExploreEdge } from "../rules/exploration.js";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_SPACE_BENDING_ADJACENCY,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

describe("exploration rules", () => {
  it("returns default explore distance of 1", () => {
    const state = createTestGameState({
      players: [createTestPlayer({ id: "player1", position: { q: 0, r: 0 } })],
    });

    expect(getExploreDistance(state, "player1")).toBe(1);
  });

  it("returns explore distance of 2 when space-bending adjacency is active", () => {
    let state = createTestGameState({
      players: [createTestPlayer({ id: "player1", position: { q: 0, r: 0 } })],
    });

    state = addModifier(state, {
      source: {
        type: SOURCE_CARD,
        cardId: CARD_SPACE_BENDING,
        playerId: "player1",
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_SPACE_BENDING_ADJACENCY,
      },
      createdAtRound: state.round,
      createdByPlayerId: "player1",
    });

    expect(getExploreDistance(state, "player1")).toBe(2);
  });

  it("uses shared distance rules for edge eligibility", () => {
    const player = createTestPlayer({
      id: "player1",
      position: { q: 0, r: 0 },
    });

    const hexes = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
      [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_PLAINS),
      [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
      [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS),
      [hexKey({ q: 0, r: -1 })]: createTestHex(0, -1, TERRAIN_PLAINS),
    };

    const baseState = createTestGameState();
    let state = createTestGameState({
      players: [player],
      map: {
        ...baseState.map,
        hexes,
      },
    });

    expect(isPlayerNearExploreEdge(state, player)).toBe(false);

    state = addModifier(state, {
      source: {
        type: SOURCE_CARD,
        cardId: CARD_SPACE_BENDING,
        playerId: "player1",
      },
      duration: DURATION_TURN,
      scope: { type: SCOPE_SELF },
      effect: {
        type: EFFECT_RULE_OVERRIDE,
        rule: RULE_SPACE_BENDING_ADJACENCY,
      },
      createdAtRound: state.round,
      createdByPlayerId: "player1",
    });

    expect(isPlayerNearExploreEdge(state, state.players[0]!)).toBe(true);
  });
});
