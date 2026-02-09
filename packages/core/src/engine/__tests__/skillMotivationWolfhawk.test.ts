/**
 * Tests for Motivation skill (Wolfhawk)
 *
 * Skill effect: Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain Fame 1.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always draws 2 cards
 * - Fame +1 if player has lowest or tied-for-lowest fame
 * - In solo play, always counts as lowest fame
 * - After use, cannot use another Motivation skill until end of next turn
 * - Can be used on any player's turn (not just your own)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_RAGE,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_MOTIVATION } from "../../data/skills/index.js";
import { SKILL_GOLDYX_MOTIVATION } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Motivation skill (Wolfhawk)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation - draws 2 cards", () => {
    it("should draw 2 cards from deck", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_MOTIVATION,
        })
      );

      // Should have drawn 2 cards (hand started with 1, now 3)
      expect(result.state.players[0].hand).toHaveLength(3);
      // Deck should be empty (started with 2, drew 2)
      expect(result.state.players[0].deck).toHaveLength(0);
    });

    it("should draw fewer cards if deck has less than 2", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA], // Only 1 card in deck
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should have drawn 1 card (hand started with 1, now 2)
      expect(result.state.players[0].hand).toHaveLength(2);
      expect(result.state.players[0].deck).toHaveLength(0);
    });
  });

  describe("Fame bonus - solo play (always lowest fame)", () => {
    it("should grant Fame +1 in solo play", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        fame: 5,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should have gained 1 fame (solo = always lowest fame)
      expect(result.state.players[0].fame).toBe(6);
    });
  });

  describe("Fame bonus - multiplayer", () => {
    it("should grant Fame +1 when player has lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        fame: 0, // Lowest fame
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Tovak,
        position: { q: 1, r: 0 },
        fame: 10, // Higher fame
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should have gained 1 fame (player has lowest fame)
      expect(result.state.players[0].fame).toBe(1);
    });

    it("should not grant Fame +1 when player has higher fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        fame: 10, // Higher fame
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Tovak,
        position: { q: 1, r: 0 },
        fame: 5, // Lower fame
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should NOT have gained fame (player has higher fame)
      expect(result.state.players[0].fame).toBe(10);
    });

    it("should grant Fame +1 when tied for lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        fame: 5, // Same fame
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Tovak,
        position: { q: 1, r: 0 },
        fame: 5, // Same fame (tied)
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Tied for lowest counts as lowest
      expect(result.state.players[0].fame).toBe(6);
    });
  });

  describe("cross-turn usage", () => {
    it("should allow use on another player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Tovak,
        position: { q: 1, r: 0 },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1, // It's player2's turn
      });

      // Player1 uses Motivation on player2's turn
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should succeed
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_MOTIVATION,
        })
      );

      // Should have drawn 2 cards
      expect(result.state.players[0].hand).toHaveLength(3);
    });
  });

  describe("Motivation lockout", () => {
    it("should set activeUntilNextTurn for all Motivation skills", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Should have set activeUntilNextTurn for all motivation skills
      expect(
        result.state.players[0].skillCooldowns.activeUntilNextTurn
      ).toContain(SKILL_WOLFHAWK_MOTIVATION);
    });

    it("should reject using Goldyx Motivation while Wolfhawk Motivation lockout is active", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION, SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_WOLFHAWK_MOTIVATION, SKILL_GOLDYX_MOTIVATION],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("cooldown", () => {
    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_MOTIVATION);
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_WOLFHAWK_MOTIVATION],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_MOTIVATION,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_WOLFHAWK_MOTIVATION],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_MOTIVATION,
          })
        );
      }
    });

    it("should not show skill when Motivation lockout is active", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [SKILL_WOLFHAWK_MOTIVATION],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_MOTIVATION,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should not be undoable (draw cards is irreversible)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_MOTIVATION,
      });

      // Verify activation
      expect(afterSkill.state.players[0].hand).toHaveLength(3);
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_MOTIVATION);

      // Undo should fail (draw cards creates checkpoint)
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should still be on cooldown — undo was blocked
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_MOTIVATION);

      // Hand should still have drawn cards
      expect(afterUndo.state.players[0].hand).toHaveLength(3);
    });
  });
});
