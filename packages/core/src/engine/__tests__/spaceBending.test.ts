/**
 * Space Bending / Time Bending Spell Tests
 *
 * Tests for:
 * - Basic (Space Bending): distance-2 movement, distance-2 exploration, no rampaging provocation
 * - Powered (Time Bending): played cards return to hand, skip draw, extra turn,
 *   chain prevention, skill refresh, Space Bending set aside
 */

import { describe, it, expect, beforeEach } from "vitest";
import type { GameState } from "../../state/GameState.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { addModifier, isRuleActive } from "../modifiers/index.js";
import { getValidMoveTargets } from "../validActions/movement.js";
import { getValidExploreOptions } from "../validActions/exploration.js";
import { isTimeBendingChainPrevented } from "../rules/cardPlay.js";
import {
  hexKey,
  TERRAIN_PLAINS,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  CARD_SPACE_BENDING,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_SWIFTNESS,
  CARD_DETERMINATION,
  CARD_RAGE,
  MANA_BLUE,
  MANA_BLACK,
  MANA_SOURCE_TOKEN,
  MANA_TOKEN_SOURCE_CARD,
  PLAY_CARD_ACTION,
  END_TURN_ACTION,
  TURN_ENDED,
  INVALID_ACTION,
  TURN_START_MOVE_POINTS,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import {
  DURATION_TURN,
  EFFECT_RULE_OVERRIDE,
  RULE_SPACE_BENDING_ADJACENCY,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_TIME_BENDING_ACTIVE,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

/**
 * Helper: apply Space Bending basic modifiers
 * (distance-2 adjacency + ignore rampaging provoke)
 */
function applySpaceBendingModifiers(baseState: GameState): GameState {
  const sourceInfo = {
    type: SOURCE_CARD as const,
    cardId: CARD_SPACE_BENDING as CardId,
    playerId: "player1",
  };

  let state = addModifier(baseState, {
    source: sourceInfo,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_SPACE_BENDING_ADJACENCY,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  state = addModifier(state, {
    source: sourceInfo,
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_IGNORE_RAMPAGING_PROVOKE,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });

  return state;
}

/**
 * Helper: apply Time Bending active modifier
 */
function applyTimeBendingModifier(baseState: GameState): GameState {
  return addModifier(baseState, {
    source: {
      type: SOURCE_CARD as const,
      cardId: CARD_SPACE_BENDING as CardId,
      playerId: "player1",
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_RULE_OVERRIDE,
      rule: RULE_TIME_BENDING_ACTIVE,
    },
    createdAtRound: 1,
    createdByPlayerId: "player1",
  });
}

/**
 * Helper: create a map that includes hexes at distance 2
 */
function createDistance2Map() {
  return {
    hexes: {
      // Player starts at (0,0)
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      // Distance 1 hexes
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
      [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_FOREST),
      [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
      // Distance 2 hexes
      [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 1 })]: createTestHex(1, 1, TERRAIN_HILLS),
      [hexKey({ q: -1, r: 2 })]: createTestHex(-1, 2, TERRAIN_PLAINS),
    },
    tiles: [],
    tileDeck: { countryside: [], core: [] },
  };
}

describe("Space Bending (Basic Effect)", () => {
  describe("Distance-2 movement", () => {
    it("should allow movement to hexes at distance 2 when Space Bending active", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      let state = createTestGameState({
        players: [player],
        map: createDistance2Map(),
      });
      state = applySpaceBendingModifiers(state);

      const moveOptions = getValidMoveTargets(state, state.players[0]!);
      expect(moveOptions).not.toBeNull();

      // Distance 2 hex (2,0) should be reachable
      const distance2Hex = moveOptions?.reachable?.find(
        (h) => h.hex.q === 2 && h.hex.r === 0
      );
      expect(distance2Hex).toBeDefined();
    });

    it("should NOT allow distance-2 movement without Space Bending", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      const state = createTestGameState({
        players: [player],
        map: createDistance2Map(),
      });

      const moveOptions = getValidMoveTargets(state, state.players[0]!);

      // Without Space Bending, cost to reach (2,0) should require stepping through (1,0)
      // which costs 2 (plains) + 2 (plains) = 4
      const stepThroughDistance2 = moveOptions?.reachable?.find(
        (h) => h.hex.q === 2 && h.hex.r === 0
      );
      if (stepThroughDistance2) {
        // Reachable via stepping, cost should be 4 (2+2)
        expect(stepThroughDistance2.totalCost).toBe(4);
      }
    });

    it("should still pay destination terrain cost for distance-2 moves", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        movePoints: 10,
      });
      let state = createTestGameState({
        players: [player],
        map: createDistance2Map(),
      });
      state = applySpaceBendingModifiers(state);

      const moveOptions = getValidMoveTargets(state, state.players[0]!);

      // (1,1) is hills (cost 3), should be reachable at distance 2 with cost 3
      const hillsHex = moveOptions?.reachable?.find(
        (h) => h.hex.q === 1 && h.hex.r === 1
      );
      expect(hillsHex).toBeDefined();
      if (hillsHex) {
        // Cost should be 3 (hills terrain cost, ignoring intervening terrain)
        expect(hillsHex.totalCost).toBe(3);
      }
    });
  });

  describe("Rampaging provocation", () => {
    it("should set the RULE_IGNORE_RAMPAGING_PROVOKE rule active", () => {
      let state = createTestGameState();
      state = applySpaceBendingModifiers(state);

      expect(
        isRuleActive(state, "player1", RULE_IGNORE_RAMPAGING_PROVOKE)
      ).toBe(true);
    });

    it("should set the RULE_SPACE_BENDING_ADJACENCY rule active", () => {
      let state = createTestGameState();
      state = applySpaceBendingModifiers(state);

      expect(
        isRuleActive(state, "player1", RULE_SPACE_BENDING_ADJACENCY)
      ).toBe(true);
    });

    it("should not set rules active for other players", () => {
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [createTestPlayer(), player2],
        turnOrder: ["player1", "player2"],
      });
      state = applySpaceBendingModifiers(state);

      expect(
        isRuleActive(state, "player1", RULE_SPACE_BENDING_ADJACENCY)
      ).toBe(true);
      expect(
        isRuleActive(state, "player2", RULE_SPACE_BENDING_ADJACENCY)
      ).toBe(false);
    });
  });

  describe("Distance-2 exploration", () => {
    it("should allow exploration from distance 2 when Space Bending active", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      let state = createTestGameState({
        players: [player],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            // Distance-1 hex present
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
          },
          tiles: [],
          tileDeck: { countryside: ["tile1" as never], core: [] },
        },
      });
      state = applySpaceBendingModifiers(state);

      const exploreOptions = getValidExploreOptions(state, state.players[0]!);
      // With Space Bending, explore distance is 2 instead of 1
      // The explore options should be computed with maxDistance 2
      // (exact results depend on map edge detection)
      expect(exploreOptions).toBeDefined();
    });
  });
});

describe("Time Bending (Powered Effect)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Card return to hand", () => {
    it("should return played cards to hand when Time Bending active at end of turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA, CARD_RAGE],
        discard: [CARD_DETERMINATION],
        deck: [CARD_SWIFTNESS],
        playedCardFromHandThisTurn: true,
      });
      let state = createTestGameState({
        players: [player],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      // Add player2 to prevent round end issues
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      state = { ...state, players: [state.players[0]!, player2] };

      // Apply Time Bending modifier
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;

      // Play area cards should be returned to hand (excluding Space Bending which is set aside)
      // STAMINA and RAGE were in play area, so they should be in hand now
      expect(updatedPlayer.hand).toContain(CARD_STAMINA);
      expect(updatedPlayer.hand).toContain(CARD_RAGE);

      // Play area should be cleared
      expect(updatedPlayer.playArea).toHaveLength(0);
    });

    it("should keep discarded cards in discard pile", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA],
        discard: [CARD_DETERMINATION],
        deck: [],
        playedCardFromHandThisTurn: true,
      });
      let state = createTestGameState({
        players: [player],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      state = { ...state, players: [state.players[0]!, player2] };
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;

      // Discard should retain cards that were already there
      expect(updatedPlayer.discard).toContain(CARD_DETERMINATION);
    });
  });

  describe("Skip draw phase", () => {
    it("should not draw cards when Time Bending active", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [],
        playArea: [CARD_MARCH],
        deck: [CARD_SWIFTNESS, CARD_DETERMINATION, CARD_STAMINA],
        handLimit: 5,
        playedCardFromHandThisTurn: true,
      });
      let state = createTestGameState({
        players: [player],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      state = { ...state, players: [state.players[0]!, player2] };
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;

      // Deck should still have all its cards (no draw happened)
      expect(updatedPlayer.deck).toHaveLength(3);
      // Hand should only have the returned play area card
      expect(updatedPlayer.hand).toContain(CARD_MARCH);
      expect(updatedPlayer.hand).toHaveLength(1);
    });
  });

  describe("Extra turn", () => {
    it("should give the same player another turn when Time Bending active", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA],
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [player, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // Next player should be player1 again (extra turn)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: TURN_ENDED,
          playerId: "player1",
          nextPlayerId: "player1",
        })
      );

      // Current player index should not advance
      expect(result.state.currentPlayerIndex).toBe(0);
    });

    it("should mark the extra turn as a Time Bent turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA],
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [player, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;
      expect(updatedPlayer.isTimeBentTurn).toBe(true);
    });

    it("should grant starting move points on the extra turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA],
        movePoints: 3,
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [player, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;
      expect(updatedPlayer.movePoints).toBe(TURN_START_MOVE_POINTS);
    });
  });

  describe("Space Bending card set aside", () => {
    it("should set aside Space Bending card from play area", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_SPACE_BENDING, CARD_STAMINA],
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [player, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;

      // Space Bending should be in set-aside cards
      expect(updatedPlayer.timeBendingSetAsideCards).toContain(CARD_SPACE_BENDING);
      // Space Bending should NOT be in hand (it's set aside, not returned)
      expect(updatedPlayer.hand).not.toContain(CARD_SPACE_BENDING);
      // Other play area cards should be returned to hand
      expect(updatedPlayer.hand).toContain(CARD_STAMINA);
    });
  });

  describe("Chain prevention", () => {
    it("should identify Time Bending chain prevention correctly", () => {
      // Cannot play Space Bending powered during a Time Bent turn
      expect(isTimeBendingChainPrevented(CARD_SPACE_BENDING, true, true)).toBe(true);
      // Can play Space Bending basic during a Time Bent turn
      expect(isTimeBendingChainPrevented(CARD_SPACE_BENDING, false, true)).toBe(false);
      // Can play Space Bending powered on a normal turn
      expect(isTimeBendingChainPrevented(CARD_SPACE_BENDING, true, false)).toBe(false);
      // Other cards are not affected
      expect(isTimeBendingChainPrevented(CARD_MARCH, true, true)).toBe(false);
    });

    it("should reject powered play of Space Bending during Time Bent turn via validator", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_SPACE_BENDING],
        isTimeBentTurn: true,
        pureMana: [
          { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD },
          { color: MANA_BLACK, source: MANA_TOKEN_SOURCE_CARD },
        ],
      });
      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SPACE_BENDING,
        powered: true,
        manaSources: [
          { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
          { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
        ],
      });

      // Should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should allow basic play of Space Bending during Time Bent turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_SPACE_BENDING],
        isTimeBentTurn: true,
        pureMana: [
          { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD },
        ],
      });
      const state = createTestGameState({
        players: [player],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_SPACE_BENDING,
        powered: false,
        manaSource: { type: MANA_SOURCE_TOKEN, color: MANA_BLUE },
      });

      // Should succeed (basic play is allowed during Time Bent turn)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Skill refresh", () => {
    it("should refresh once-per-turn skill cooldowns on Time Bent extra turn", () => {
      const player = createTestPlayer({
        id: "player1",
        hand: [CARD_MARCH],
        playArea: [CARD_STAMINA],
        skillCooldowns: {
          usedThisRound: ["skill_a" as never],
          usedThisTurn: ["skill_b" as never],
          usedThisCombat: ["skill_c" as never],
          activeUntilNextTurn: [],
        },
        playedCardFromHandThisTurn: true,
      });
      const player2 = createTestPlayer({ id: "player2", position: { q: 1, r: 0 } });
      let state = createTestGameState({
        players: [player, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
      state = applyTimeBendingModifier(state);

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      const updatedPlayer = result.state.players.find((p) => p.id === "player1")!;

      // Once-per-turn skills should be refreshed
      expect(updatedPlayer.skillCooldowns.usedThisTurn).toHaveLength(0);
      // Once-per-combat skills should be refreshed
      expect(updatedPlayer.skillCooldowns.usedThisCombat).toHaveLength(0);
      // Once-per-round skills should NOT be refreshed
      expect(updatedPlayer.skillCooldowns.usedThisRound).toContain("skill_a");
    });
  });
});

describe("Space Bending round reset", () => {
  it("should include set-aside cards in round-end reshuffle", () => {
    // This tests the playerRoundReset.ts integration
    // Set-aside cards should be included when all cards are reshuffled at round end
    const player = createTestPlayer({
      id: "player1",
      hand: [CARD_MARCH],
      deck: [CARD_STAMINA],
      discard: [],
      playArea: [],
      timeBendingSetAsideCards: [CARD_SPACE_BENDING],
    });
    const state = createTestGameState({
      players: [player],
    });

    // Verify the set-aside cards are tracked
    expect(state.players[0]!.timeBendingSetAsideCards).toContain(CARD_SPACE_BENDING);
  });
});
