/**
 * Tests for Leaves in the Wind skill (Norowas)
 *
 * Skill effect: Once a round, flip this to gain one green crystal to your
 * inventory, and one white mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always grants 1 green crystal (no choice)
 * - Always grants 1 white mana token (no choice)
 * - Respects crystal limit (max 3 per color)
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
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_LEAVES_IN_THE_WIND } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Leaves in the Wind skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should grant green crystal and white mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
        })
      );

      // Green crystal should be granted
      expect(result.state.players[0].crystals.green).toBe(1);

      // White mana token should be added
      expect(result.state.players[0].pureMana).toHaveLength(1);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // No pending choice (both effects are immediate)
      expect(result.state.players[0].pendingChoice).toBeNull();
    });

    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_NOROWAS_LEAVES_IN_THE_WIND);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
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
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this round", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
        skillCooldowns: {
          usedThisRound: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("crystal limit", () => {
    it("should only grant mana token when at 3 green crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 3, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      // Green crystals should stay at 3 (capped)
      expect(result.state.players[0].crystals.green).toBe(3);

      // Green crystal overflows to token + white mana token from skill
      expect(result.state.players[0].pureMana).toHaveLength(2);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(result.state.players[0].pureMana[1]).toEqual({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("crystal vs mana token distinction", () => {
    it("should grant crystal (permanent) and mana token (temporary)", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      // Crystal: exactly 1 green, others unchanged
      expect(result.state.players[0].crystals).toEqual({
        red: 0,
        blue: 0,
        green: 1,
        white: 0,
      });

      // Mana token with CARD source
      expect(result.state.players[0].pureMana).toHaveLength(1);
      expect(result.state.players[0].pureMana[0].source).toBe(
        MANA_TOKEN_SOURCE_CARD
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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
          skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
        skillCooldowns: {
          usedThisRound: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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
            skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_LEAVES_IN_THE_WIND],
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
        skillId: SKILL_NOROWAS_LEAVES_IN_THE_WIND,
      });

      // Verify activation happened
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_NOROWAS_LEAVES_IN_THE_WIND);
      expect(afterSkill.state.players[0].crystals.green).toBe(1);
      expect(afterSkill.state.players[0].pureMana).toHaveLength(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_NOROWAS_LEAVES_IN_THE_WIND);

      // Crystal should be reverted
      expect(afterUndo.state.players[0].crystals.green).toBe(0);

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });
  });
});
