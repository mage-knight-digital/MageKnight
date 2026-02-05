/**
 * Tests for Dark Fire Magic skill (Arythea)
 *
 * Skill effect: Once a round, flip this to gain one red crystal to your
 * inventory, and one red or black mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always grants 1 red crystal (no choice)
 * - Player chooses red OR black mana token
 * - Black mana follows normal day/night usage rules
 *
 * Possible outcomes:
 * - Red crystal + Red mana token
 * - Red crystal + Black mana token
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
  MANA_RED,
  MANA_BLACK,
  MANA_TOKEN_SOURCE_CARD,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_DARK_FIRE_MAGIC } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Dark Fire Magic skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill, grant red crystal, and present mana choice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
        })
      );

      // Red crystal should be granted immediately (compound first effect)
      expect(result.state.players[0].crystals.red).toBe(1);

      // Should emit CHOICE_REQUIRED for mana selection
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_REQUIRED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
          options: expect.arrayContaining([
            expect.stringContaining("red"),
            expect.stringContaining("black"),
          ]),
        })
      );

      // Should have pending choice with 2 options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_ARYTHEA_DARK_FIRE_MAGIC);
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
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("mana choice - red", () => {
    it("should grant red crystal and red mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      // Choose red mana (index 0)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Red
      });

      // Red crystal should be granted
      expect(afterChoice.state.players[0].crystals.red).toBe(1);

      // Red mana token should be added
      expect(afterChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterChoice.state.players[0].pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // No more pending choice
      expect(afterChoice.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("mana choice - black", () => {
    it("should grant red crystal and black mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      // Choose black mana (index 1)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1, // Black
      });

      // Red crystal should be granted
      expect(afterChoice.state.players[0].crystals.red).toBe(1);

      // Black mana token should be added
      expect(afterChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterChoice.state.players[0].pureMana[0]).toEqual({
        color: MANA_BLACK,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // No more pending choice
      expect(afterChoice.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("crystal vs mana token distinction", () => {
    it("should grant crystal (permanent) and mana token (temporary)", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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

      // Activate and resolve
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // Red mana
      });

      // Crystal: exactly 1 red, others unchanged
      expect(afterChoice.state.players[0].crystals).toEqual({
        red: 1,
        blue: 0,
        green: 0,
        white: 0,
      });

      // Mana token with CARD source
      expect(afterChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterChoice.state.players[0].pureMana[0].source).toBe(
        MANA_TOKEN_SOURCE_CARD
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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
          skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
        skillCooldowns: {
          usedThisRound: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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
            skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable before making mana choice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      // Verify activation happened
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_ARYTHEA_DARK_FIRE_MAGIC);
      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_ARYTHEA_DARK_FIRE_MAGIC);

      // Pending choice should be cleared
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();

      // Crystal should be reverted
      expect(afterUndo.state.players[0].crystals.red).toBe(0);

      // No mana tokens
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });

    it("should be undoable after making mana choice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_FIRE_MAGIC],
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

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC,
      });

      // Make mana choice (red)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify choice was applied
      expect(afterChoice.state.players[0].pureMana).toHaveLength(1);
      expect(afterChoice.state.players[0].pendingChoice).toBeNull();

      // Undo the choice
      const afterUndo = engine.processAction(afterChoice.state, "player1", {
        type: UNDO_ACTION,
      });

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);

      // Should be back to mana choice pending
      expect(afterUndo.state.players[0].pendingChoice).not.toBeNull();
      expect(afterUndo.state.players[0].pendingChoice?.options).toHaveLength(2);
    });
  });
});
