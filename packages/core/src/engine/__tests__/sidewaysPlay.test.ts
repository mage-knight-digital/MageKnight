/**
 * Tests for PLAY_CARD_SIDEWAYS action
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  CARD_PLAYED,
  CARD_PLAY_UNDONE,
  UNDO_ACTION,
  INVALID_ACTION,
  CARD_MARCH,
  CARD_RAGE,
  CARD_WOUND,
  CARD_PROMISE,
} from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  DURATION_TURN,
  EFFECT_SIDEWAYS_VALUE,
  SCOPE_SELF,
  SOURCE_TYPE_SKILL,
} from "../modifierConstants.js";
import type { SkillId } from "@mage-knight/shared";

describe("PLAY_CARD_SIDEWAYS action", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic sideways play", () => {
    it("should gain Move 1 when playing card sideways for move", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE], // Normally an attack card
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(1);
      expect(result.state.players[0].playArea).toContain(CARD_RAGE);
      expect(result.state.players[0].hand).not.toContain(CARD_RAGE);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_RAGE,
          sideways: true,
          effect: "Gained 1 Move (sideways)",
        })
      );
    });

    it("should gain Influence 1 when playing card sideways for influence", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH], // Normally a move card
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(result.state.players[0].influencePoints).toBe(1);
      expect(result.state.players[0].playArea).toContain(CARD_MARCH);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          sideways: true,
          effect: "Gained 1 Influence (sideways)",
        })
      );
    });

    it("should gain Attack 1 when playing card sideways for attack", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_ATTACK,
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          sideways: true,
          effect: "Gained 1 Attack (sideways)",
        })
      );
    });

    it("should gain Block 1 when playing card sideways for block", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_BLOCK,
      });

      expect(result.state.players[0].combatAccumulator.block).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          sideways: true,
          effect: "Gained 1 Block (sideways)",
        })
      );
    });
  });

  describe("validation", () => {
    it("should reject sideways play for wound cards", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Wound cards cannot be played sideways",
        })
      );
    });

    it("should reject if card not in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE], // March not in hand
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Card is not in your hand",
        })
      );
    });
  });

  describe("undo", () => {
    it("should be undoable for move", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 2,
      });
      const state = createTestGameState({ players: [player] });

      // Play sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterPlay.state.players[0].movePoints).toBe(3);
      expect(afterPlay.state.players[0].hand).not.toContain(CARD_MARCH);
      expect(afterPlay.state.players[0].playArea).toContain(CARD_MARCH);

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].movePoints).toBe(2);
      expect(afterUndo.state.players[0].hand).toContain(CARD_MARCH);
      expect(afterUndo.state.players[0].playArea).not.toContain(CARD_MARCH);
      expect(afterUndo.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAY_UNDONE,
          cardId: CARD_MARCH,
        })
      );
    });

    it("should be undoable for influence", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        influencePoints: 5,
      });
      const state = createTestGameState({ players: [player] });

      // Play sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(afterPlay.state.players[0].influencePoints).toBe(6);

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].influencePoints).toBe(5);
    });

    it("should be undoable for attack", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: { normal: 3, ranged: 0, siege: 0 },
          block: 0,
        },
      });
      const state = createTestGameState({ players: [player] });

      // Play sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_ATTACK,
      });

      expect(afterPlay.state.players[0].combatAccumulator.attack.normal).toBe(4);

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].combatAccumulator.attack.normal).toBe(3);
    });

    it("should be undoable for block", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        combatAccumulator: {
          attack: { normal: 0, ranged: 0, siege: 0 },
          block: 2,
        },
      });
      const state = createTestGameState({ players: [player] });

      // Play sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_BLOCK,
      });

      expect(afterPlay.state.players[0].combatAccumulator.block).toBe(3);

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].combatAccumulator.block).toBe(2);
    });

    it("should restore card to original hand position", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE, CARD_MARCH, CARD_PROMISE],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Play the middle card sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterPlay.state.players[0].hand).toEqual([CARD_RAGE, CARD_PROMISE]);

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      // Card should be back in original position
      expect(afterUndo.state.players[0].hand).toEqual([
        CARD_RAGE,
        CARD_MARCH,
        CARD_PROMISE,
      ]);
    });
  });

  describe("modifiers", () => {
    it("should apply sideways value modifier", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
      });

      // Add modifier that increases sideways value to 2
      const modifier: ActiveModifier = {
        id: "test-mod",
        source: {
          type: SOURCE_TYPE_SKILL,
          skillId: "test_skill" as SkillId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_SIDEWAYS_VALUE,
          newValue: 2,
          forWounds: false,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          sideways: true,
          effect: "Gained 2 Move (sideways)",
        })
      );
    });

    it("should undo with modified value correctly", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 5,
      });

      // Add modifier that increases sideways value to 3
      const modifier: ActiveModifier = {
        id: "test-mod",
        source: {
          type: SOURCE_TYPE_SKILL,
          skillId: "test_skill" as SkillId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_SIDEWAYS_VALUE,
          newValue: 3,
          forWounds: false,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const state = createTestGameState({
        players: [player],
        activeModifiers: [modifier],
      });

      // Play sideways
      const afterPlay = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterPlay.state.players[0].movePoints).toBe(8); // 5 + 3

      // Undo
      const afterUndo = engine.processAction(afterPlay.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(afterUndo.state.players[0].movePoints).toBe(5);
    });
  });

  describe("multiple cards", () => {
    it("should allow playing multiple cards sideways", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        movePoints: 0,
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Play first card sideways for move
      const afterFirst = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterFirst.state.players[0].movePoints).toBe(1);

      // Play second card sideways for influence
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(afterSecond.state.players[0].influencePoints).toBe(1);
      expect(afterSecond.state.players[0].playArea).toHaveLength(2);
      expect(afterSecond.state.players[0].hand).toHaveLength(0);
    });
  });
});
