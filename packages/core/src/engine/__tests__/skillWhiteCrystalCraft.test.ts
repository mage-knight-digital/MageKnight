/**
 * Tests for White Crystal Craft skill (Goldyx)
 *
 * Skill effect: Flip to gain 1 blue crystal and 1 white mana token.
 *
 * Key rules:
 * - Once per round (flips after use, resets at end of round)
 * - Grants 1 blue crystal to inventory (respects 3-max limit)
 * - Grants 1 white mana token
 * - Can be used on any player's turn
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  MANA_BLUE,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_SKILL,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("White Crystal Craft skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
        })
      );
    });

    it("should add skill to usedThisRound cooldown (once per round)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [], // No skills learned
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT], // Already used
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("effect", () => {
    it("should grant 1 blue crystal and 1 white mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      const updatedPlayer = result.state.players[0];

      // Should have 1 blue crystal
      expect(updatedPlayer.crystals[MANA_BLUE]).toBe(1);

      // Should have 1 white mana token from skill
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]).toMatchObject({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_SKILL,
      });
    });

    it("should respect 3-crystal limit - at 3 blue crystals, only token is gained", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 3, green: 0, white: 0 }, // Already at max
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      const updatedPlayer = result.state.players[0];

      // Blue crystals should remain at 3 (not increase)
      expect(updatedPlayer.crystals[MANA_BLUE]).toBe(3);

      // White mana token should still be granted
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]).toMatchObject({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_SKILL,
      });
    });

    it("should gain crystal if under 3 blue crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 2, green: 0, white: 0 }, // 2 blue crystals
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      const updatedPlayer = result.state.players[0];

      // Should now have 3 blue crystals
      expect(updatedPlayer.crystals[MANA_BLUE]).toBe(3);

      // White mana token should be granted
      expect(updatedPlayer.pureMana).toHaveLength(1);
    });

    it("should append mana token to existing tokens", () => {
      const existingToken = { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_SKILL };
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [existingToken],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      const updatedPlayer = result.state.players[0];

      // Should have 2 mana tokens
      expect(updatedPlayer.pureMana).toHaveLength(2);
      expect(updatedPlayer.pureMana[0]).toEqual(existingToken);
      expect(updatedPlayer.pureMana[1]).toMatchObject({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_SKILL,
      });
    });
  });

  describe("undo", () => {
    it("should be undoable", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 1, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      // Verify skill was applied
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT);
      expect(afterSkill.state.players[0].crystals[MANA_BLUE]).toBe(2);
      expect(afterSkill.state.players[0].pureMana).toHaveLength(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT);

      // Crystal should be removed
      expect(afterUndo.state.players[0].crystals[MANA_BLUE]).toBe(1);

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });

    it("should handle undo when at crystal limit", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 3, green: 0, white: 0 }, // At max
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
      });

      // Blue crystals should still be 3 (at limit)
      expect(afterSkill.state.players[0].crystals[MANA_BLUE]).toBe(3);
      // Token should still be granted
      expect(afterSkill.state.players[0].pureMana).toHaveLength(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Crystals should remain at 3 (no crystal was gained, so none removed)
      expect(afterUndo.state.players[0].crystals[MANA_BLUE]).toBe(3);

      // Token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT], // Already used
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or the skill is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_WHITE_CRYSTAL_CRAFT,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [], // No skills
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Skills should be undefined since no skills are available
      expect(validActions.skills).toBeUndefined();
    });
  });
});
