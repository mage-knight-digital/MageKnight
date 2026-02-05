/**
 * Tests for Motivation skill (Arythea)
 *
 * Skill effect: Once a round, on any player's turn: flip this to draw two cards.
 * If you have the least Fame (not tied), also gain a red mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always draws 2 cards (no reshuffle if deck empty)
 * - Red mana if player has lowest or tied-for-lowest fame
 * - In solo play, always counts as lowest fame
 * - Identical to Tovak's Motivation except red mana instead of blue
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
  MANA_RED,
  MANA_TOKEN_SOURCE_CARD,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_MOTIVATION } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Motivation skill (Arythea)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation - draws 2 cards", () => {
    it("should draw 2 cards from deck", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_MOTIVATION,
        })
      );

      // Should have drawn 2 cards (hand started with 1, now 3)
      expect(result.state.players[0].hand).toHaveLength(3);
      // Deck should be empty (started with 2, drew 2)
      expect(result.state.players[0].deck).toHaveLength(0);
    });

    it("should draw fewer cards if deck has less than 2", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Should have drawn 1 card (hand started with 1, now 2)
      expect(result.state.players[0].hand).toHaveLength(2);
      expect(result.state.players[0].deck).toHaveLength(0);
    });
  });

  describe("red mana - solo play (always lowest fame)", () => {
    it("should grant red mana token in solo play", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Should have red mana token (solo = always lowest fame)
      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("red mana - multiplayer", () => {
    it("should grant red mana when player has lowest fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Should have red mana (player has lowest fame)
      expect(result.state.players[0].pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should not grant red mana when player has higher fame", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE],
        pureMana: [],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Should NOT have red mana (player has higher fame)
      expect(result.state.players[0].pureMana).toHaveLength(0);
    });
  });

  describe("cooldown", () => {
    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_ARYTHEA_MOTIVATION);
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
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
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
          skillId: SKILL_ARYTHEA_MOTIVATION,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_MOTIVATION],
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
            skillId: SKILL_ARYTHEA_MOTIVATION,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should not be undoable (draw cards is irreversible)", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
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
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      // Verify activation
      expect(afterSkill.state.players[0].hand).toHaveLength(3);
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_ARYTHEA_MOTIVATION);

      // Undo should fail (draw cards creates checkpoint)
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should still be on cooldown — undo was blocked
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_ARYTHEA_MOTIVATION);

      // Hand should still have drawn cards
      expect(afterUndo.state.players[0].hand).toHaveLength(3);
    });

    it("should not allow infinite card draw via undo exploit", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_MOTIVATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        deck: [CARD_STAMINA, CARD_RAGE, CARD_MARCH, CARD_STAMINA],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Use Motivation — draws 2 cards
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });
      expect(afterSkill.state.players[0].hand).toHaveLength(3);

      // Attempt undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Try to use Motivation again — should be rejected (still on cooldown)
      const afterSecondUse = engine.processAction(afterUndo.state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_MOTIVATION,
      });

      expect(afterSecondUse.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Hand should still be 3, not 5
      expect(afterSecondUse.state.players[0].hand).toHaveLength(3);
    });
  });
});
