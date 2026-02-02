/**
 * Tests for Thunderstorm skill (Braevalar)
 *
 * Skill effect: Once a round, flip this to gain one green or blue mana token
 * and one green or white mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - First choice: green OR blue mana token
 * - Second choice: green OR white mana token
 * - Choices are independent (can choose green twice)
 * - Grants mana tokens (not crystals)
 *
 * Possible combinations:
 * - Green + Green (2 green)
 * - Green + White
 * - Blue + Green
 * - Blue + White
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_REQUIRED,
  CARD_MARCH,
  MANA_GREEN,
  MANA_BLUE,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_THUNDERSTORM } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Thunderstorm skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill and present first choice (green or blue)", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
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
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_THUNDERSTORM,
        })
      );

      // Should emit CHOICE_REQUIRED event with first choice options
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_REQUIRED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_THUNDERSTORM,
          options: expect.arrayContaining([
            expect.stringContaining("green"),
            expect.stringContaining("blue"),
          ]),
        })
      );

      // Should have pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
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
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_BRAEVALAR_THUNDERSTORM);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [], // No skills learned
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
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [SKILL_BRAEVALAR_THUNDERSTORM], // Already used
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("mana combinations", () => {
    it("should allow green + green combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // First choice: select green (index 0)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      // Should have one green mana token
      expect(afterFirstChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterFirstChoice.state.players[0].pureMana[0]).toEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // Should have second choice pending (green or white)
      expect(afterFirstChoice.state.players[0].pendingChoice).not.toBeNull();

      // Second choice: select green (index 0)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      // Should have two green mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toEqual([
        { color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD },
        { color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD },
      ]);

      // No more pending choice
      expect(afterSecondChoice.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow green + white combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // First choice: select green (index 0)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      // Second choice: select white (index 1)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // White
      });

      // Should have green and white mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should allow blue + green combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // First choice: select blue (index 1)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Blue
      });

      // Second choice: select green (index 0)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      // Should have blue and green mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should allow blue + white combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // First choice: select blue (index 1)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Blue
      });

      // Second choice: select white (index 1)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // White
      });

      // Should have blue and white mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("mana tokens (not crystals)", () => {
    it("should grant mana tokens not crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Activate and resolve both choices
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Green
      });

      // Crystals should remain unchanged
      expect(afterSecondChoice.state.players[0].crystals).toEqual({
        red: 0,
        blue: 0,
        green: 0,
        white: 0,
      });

      // Tokens should be added with CARD source
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      for (const token of afterSecondChoice.state.players[0].pureMana) {
        expect(token.source).toBe(MANA_TOKEN_SOURCE_CARD);
      }
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
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

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_BRAEVALAR_THUNDERSTORM,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [SKILL_BRAEVALAR_THUNDERSTORM], // Already used
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or the skill is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_BRAEVALAR_THUNDERSTORM,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [], // No skills
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

      // Skills should be undefined since no skills are available
      expect(validActions.skills).toBeUndefined();
    });
  });

  describe("undo", () => {
    it("should be undoable before making first choice", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // Verify skill was activated
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_BRAEVALAR_THUNDERSTORM);
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_BRAEVALAR_THUNDERSTORM);

      // Pending choice should be cleared
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();

      // No mana tokens should be gained
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });

    it("should be undoable after making first choice", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_THUNDERSTORM],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_THUNDERSTORM,
      });

      // Make first choice (green)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify first choice was applied and second choice is pending
      expect(afterFirstChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterFirstChoice.state.players[0].pendingChoice).not.toBeNull();

      // Undo the first choice
      const afterUndo = engine.processAction(afterFirstChoice.state, "player1", {
        type: UNDO_ACTION,
      });

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);

      // Should be back to first choice pending
      expect(afterUndo.state.players[0].pendingChoice).not.toBeNull();
      expect(afterUndo.state.players[0].pendingChoice?.options).toHaveLength(2);
    });
  });
});
