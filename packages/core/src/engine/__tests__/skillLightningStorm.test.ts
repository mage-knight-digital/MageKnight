/**
 * Tests for Lightning Storm skill (Braevalar)
 *
 * Skill effect: Once a round, flip this to gain one blue or green mana token
 * and one blue or red mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - First choice: blue OR green mana token
 * - Second choice: blue OR red mana token
 * - Choices are independent (can choose blue twice)
 * - Grants mana tokens (not crystals)
 *
 * Possible combinations:
 * - Blue + Blue (2 blue)
 * - Blue + Red
 * - Green + Blue
 * - Green + Red
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
  MANA_BLUE,
  MANA_GREEN,
  MANA_RED,
  MANA_TOKEN_SOURCE_CARD,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_LIGHTNING_STORM } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Lightning Storm skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill and present first choice (blue or green)", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
        })
      );

      // Should emit CHOICE_REQUIRED event with first choice options
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_REQUIRED,
          playerId: "player1",
          skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
          options: expect.arrayContaining([
            expect.stringContaining("blue"),
            expect.stringContaining("green"),
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
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_BRAEVALAR_LIGHTNING_STORM);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
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
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
        skillCooldowns: {
          usedThisRound: [SKILL_BRAEVALAR_LIGHTNING_STORM],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("mana combinations", () => {
    it("should allow blue + blue combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // First choice: select blue (index 0)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
      });

      // Should have one blue mana token
      expect(afterFirstChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterFirstChoice.state.players[0].pureMana[0]).toEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // Should have second choice pending (blue or red)
      expect(afterFirstChoice.state.players[0].pendingChoice).not.toBeNull();

      // Second choice: select blue (index 0)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
      });

      // Should have two blue mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toEqual([
        { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD },
        { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_CARD },
      ]);

      // No more pending choice
      expect(afterSecondChoice.state.players[0].pendingChoice).toBeNull();
    });

    it("should allow blue + red combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // First choice: select blue (index 0)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
      });

      // Second choice: select red (index 1)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Red
      });

      // Should have blue and red mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should allow green + blue combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // First choice: select green (index 1)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Green
      });

      // Second choice: select blue (index 0)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
      });

      // Should have green and blue mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should allow green + red combination", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // First choice: select green (index 1)
      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Green
      });

      // Second choice: select red (index 1)
      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Red
      });

      // Should have green and red mana tokens
      expect(afterSecondChoice.state.players[0].pureMana).toHaveLength(2);
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(afterSecondChoice.state.players[0].pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("mana tokens (not crystals)", () => {
    it("should grant mana tokens not crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      const afterFirstChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
      });

      const afterSecondChoice = engine.processAction(afterFirstChoice.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Blue
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
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
          skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
        skillCooldowns: {
          usedThisRound: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
            skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable before making first choice", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // Verify skill was activated
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_BRAEVALAR_LIGHTNING_STORM);
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_BRAEVALAR_LIGHTNING_STORM);

      // Pending choice should be cleared
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();

      // No mana tokens should be gained
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });

    it("should be undoable after making first choice", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_LIGHTNING_STORM],
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
        skillId: SKILL_BRAEVALAR_LIGHTNING_STORM,
      });

      // Make first choice (blue)
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
