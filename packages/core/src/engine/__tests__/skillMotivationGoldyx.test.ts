/**
 * Tests for Motivation skill (Goldyx)
 *
 * Skill effect: Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a green mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Can be used on any player's turn
 * - Always draws 2 cards (no reshuffle if deck empty)
 * - Green mana if player has lowest or tied-for-lowest fame
 * - In solo play, always counts as lowest fame
 * - Sets Motivation cooldown after use (cross-hero)
 * - Cannot use any Motivation skill while cooldown active
 * - Cooldown expires at end of player's next turn
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { createUseSkillCommand } from "../commands/useSkillCommand.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_RAGE,
  MANA_GREEN,
  MANA_TOKEN_SOURCE_CARD,
  END_TURN_ACTION,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_GOLDYX_MOTIVATION,
  SKILL_TOVAK_MOTIVATION,
  SKILL_ARYTHEA_MOTIVATION,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
} from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Motivation skill (Goldyx)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation - draws 2 cards", () => {
    it("should draw 2 cards from deck", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
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
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_MOTIVATION,
        })
      );

      // Should have drawn 2 cards (hand started with 1, now 3)
      expect(result.state.players[0].hand).toHaveLength(3);
      // Deck should be empty (started with 2, drew 2)
      expect(result.state.players[0].deck).toHaveLength(0);
    });

    it("should draw fewer cards if deck has less than 2", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].hand).toHaveLength(2);
      expect(result.state.players[0].deck).toHaveLength(0);
    });

    it("should draw 0 cards if deck is empty", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
        })
      );
      expect(result.state.players[0].hand).toHaveLength(1);
    });
  });

  describe("green mana - solo play (always lowest fame)", () => {
    it("should grant green mana token in solo play", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
        fame: 5,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("green mana - multiplayer", () => {
    it("should grant green mana when player has lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
        fame: 0,
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 10,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should not grant green mana when player has higher fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
        fame: 10,
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 5,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].pureMana).toHaveLength(0);
    });

    it("should grant green mana when tied for lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
        fame: 5,
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 5,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("cooldown", () => {
    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
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
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_MOTIVATION);
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_MOTIVATION],
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
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
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
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Motivation cross-hero cooldown", () => {
    it("should set activeUntilNextTurn for all Motivation skills after use", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
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
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      const cooldowns = result.state.players[0].skillCooldowns.activeUntilNextTurn;
      expect(cooldowns).toContain(SKILL_GOLDYX_MOTIVATION);
      expect(cooldowns).toContain(SKILL_TOVAK_MOTIVATION);
      expect(cooldowns).toContain(SKILL_ARYTHEA_MOTIVATION);
    });

    it("should reject using another Motivation skill while cooldown active", () => {
      // Goldyx has learned both Goldyx Motivation and (hypothetically) Tovak Motivation
      // After using Goldyx Motivation, Tovak Motivation should be blocked
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION, SKILL_TOVAK_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_MOTIVATION],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [
            SKILL_GOLDYX_MOTIVATION,
            SKILL_TOVAK_MOTIVATION,
            SKILL_ARYTHEA_MOTIVATION,
          ],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should clear activeUntilNextTurn cooldown at end of turn", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_MOTIVATION],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [
            SKILL_GOLDYX_MOTIVATION,
            SKILL_TOVAK_MOTIVATION,
            SKILL_ARYTHEA_MOTIVATION,
          ],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        playedCardFromHandThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: END_TURN_ACTION,
      });

      // After ending turn, activeUntilNextTurn should be cleared
      expect(
        result.state.players[0].skillCooldowns.activeUntilNextTurn
      ).toHaveLength(0);
    });

    it("should not show Motivation in valid actions when cooldown active", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [
            SKILL_GOLDYX_MOTIVATION,
            SKILL_TOVAK_MOTIVATION,
            SKILL_ARYTHEA_MOTIVATION,
          ],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_MOTIVATION,
          })
        );
      }
    });
  });

  describe("any player's turn", () => {
    it("should allow Motivation to be used on another player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 10,
      });
      // player2 is the current player (index 1 in turn order)
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0, // player2's turn
      });

      // player1 uses Motivation on player2's turn
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      // Should succeed (not rejected for "not your turn")
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_MOTIVATION,
        })
      );
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Should have drawn 2 cards
      expect(result.state.players[0].hand).toHaveLength(3);
    });

    it("should grant green mana when player has lowest fame on another player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
        fame: 0, // Lowest fame
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
        fame: 10,
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0, // player2's turn
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should allow other heroes' Motivation on another player's turn", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_MOTIVATION],
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
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0, // player2's turn
      });

      // Tovak's Motivation should also work on another player's turn
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
        })
      );
    });

    it("should reject non-Motivation skill on another player's turn", () => {
      // Who Needs Magic (non-Motivation) should be blocked on another's turn
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_WHO_NEEDS_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const player2 = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        position: { q: 1, r: 0 },
      });
      const state = createTestGameState({
        players: [player1, player2],
        turnOrder: ["player2", "player1"],
        currentPlayerIndex: 0, // player2's turn
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
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
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
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
          skillId: SKILL_GOLDYX_MOTIVATION,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_MOTIVATION],
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
            skillId: SKILL_GOLDYX_MOTIVATION,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should not be undoable (draw cards is irreversible)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      // Verify activation
      expect(afterSkill.state.players[0].hand).toHaveLength(3);
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_MOTIVATION);

      // Undo should fail (draw cards creates checkpoint)
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: "UNDO" as const,
      });

      // Skill should still be on cooldown — undo was blocked
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_MOTIVATION);

      // Hand should still have drawn cards
      expect(afterUndo.state.players[0].hand).toHaveLength(3);
    });

    it("should clear Motivation cooldown on command undo", () => {
      // Test the undo path directly via command (since engine blocks undo for irreversible)
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const command = createUseSkillCommand({
        playerId: "player1",
        skillId: SKILL_GOLDYX_MOTIVATION,
      });

      // Execute the command
      const executeResult = command.execute(state);

      // Verify cooldowns were set
      expect(
        executeResult.state.players[0].skillCooldowns.activeUntilNextTurn
      ).toContain(SKILL_GOLDYX_MOTIVATION);

      // Undo the command directly
      const undoResult = command.undo(executeResult.state);

      // activeUntilNextTurn should be cleared
      expect(
        undoResult.state.players[0].skillCooldowns.activeUntilNextTurn
      ).toHaveLength(0);

      // usedThisRound should be cleared
      expect(
        undoResult.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_GOLDYX_MOTIVATION);
    });
  });
});
