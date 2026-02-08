/**
 * Tests for Whispers in the Treetops skill (Norowas)
 *
 * Skill effect: Once a round, flip this to gain one white crystal to your
 * inventory, and one green mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always grants 1 white crystal (no choice)
 * - Always grants 1 green mana token (no choice)
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
import { SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Whispers in the Treetops skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should grant white crystal and green mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
        })
      );

      // White crystal should be granted
      expect(result.state.players[0].crystals.white).toBe(1);

      // Green mana token should be added
      expect(result.state.players[0].pureMana).toHaveLength(1);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      // No pending choice (both effects are immediate)
      expect(result.state.players[0].pendingChoice).toBeNull();
    });

    it("should add skill to usedThisRound cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS);
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
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
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
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
        skillCooldowns: {
          usedThisRound: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("crystal limit", () => {
    it("should only grant mana token when at 3 white crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 3 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      // White crystals should stay at 3 (capped)
      expect(result.state.players[0].crystals.white).toBe(3);

      // White crystal overflows to token + green mana token from skill
      expect(result.state.players[0].pureMana).toHaveLength(2);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_WHITE,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(result.state.players[0].pureMana[1]).toEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("crystal vs mana token distinction", () => {
    it("should grant crystal (permanent) and mana token (temporary)", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      // Crystal: exactly 1 white, others unchanged
      expect(result.state.players[0].crystals).toEqual({
        red: 0,
        blue: 0,
        green: 0,
        white: 1,
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
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
          skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
        skillCooldowns: {
          usedThisRound: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
            skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS],
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
        skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
      });

      // Verify activation happened
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS);
      expect(afterSkill.state.players[0].crystals.white).toBe(1);
      expect(afterSkill.state.players[0].pureMana).toHaveLength(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS);

      // Crystal should be reverted
      expect(afterUndo.state.players[0].crystals.white).toBe(0);

      // Mana token should be removed
      expect(afterUndo.state.players[0].pureMana).toHaveLength(0);
    });
  });
});
