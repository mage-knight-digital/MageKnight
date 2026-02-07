/**
 * Tests for Red Crystal Craft skill (Goldyx)
 *
 * Skill effect: Once a round, flip this to gain one blue crystal to your
 * inventory, and one red mana token.
 *
 * Key rules:
 * - Once per round (flip to activate)
 * - Always grants 1 blue crystal (no choice)
 * - Always grants 1 red mana token (no choice)
 * - Respects crystal limit (max 3 per color)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  MANA_RED,
  MANA_TOKEN_SOURCE_CARD,
  CARD_MARCH,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_RED_CRYSTAL_CRAFT } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

describe("Red Crystal Craft skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should grant blue crystal and red mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_RED_CRYSTAL_CRAFT],
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
        skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
        })
      );

      expect(result.state.players[0].crystals.blue).toBe(1);

      expect(result.state.players[0].pureMana).toHaveLength(1);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });

      expect(result.state.players[0].pendingChoice).toBeNull();
    });
  });

  describe("crystal limit", () => {
    it("should only grant mana token when at 3 blue crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_RED_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 3, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
      });

      expect(result.state.players[0].crystals.blue).toBe(3);

      expect(result.state.players[0].pureMana).toHaveLength(1);
      expect(result.state.players[0].pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_RED_CRYSTAL_CRAFT],
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
          skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_RED_CRYSTAL_CRAFT],
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_RED_CRYSTAL_CRAFT],
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
            skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
          })
        );
      }
    });
  });
});
