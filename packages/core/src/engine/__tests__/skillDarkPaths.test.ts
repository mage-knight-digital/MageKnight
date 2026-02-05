/**
 * Tests for Dark Paths skill (Arythea)
 *
 * Skill effect: Move 1 (day) or Move 2 (night/underground).
 * Movement points are standalone (can be used independently).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  ENEMY_PROWLERS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_DARK_PATHS } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { createCombatState } from "../../types/combat.js";

describe("Dark Paths skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("day movement", () => {
    it("should grant Move 1 during day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        movePoints: 0,
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
      expect(result.state.players[0].movePoints).toBe(1);
    });
  });

  describe("night movement", () => {
    it("should grant Move 2 at night", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        movePoints: 0,
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
      expect(result.state.players[0].movePoints).toBe(2);
    });
  });

  describe("dungeon/tomb combat (underground)", () => {
    it("should grant Move 2 in dungeon combat during day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        movePoints: 0,
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      // nightManaRules: true means dungeon/tomb (counts as underground)
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        nightManaRules: true,
      };
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
      expect(result.state.players[0].movePoints).toBe(2);
    });

    it("should grant Move 1 in normal outdoor combat during day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        movePoints: 0,
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      // nightManaRules: false means normal outdoor combat
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        nightManaRules: false,
      };
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
      expect(result.state.players[0].movePoints).toBe(1);
    });
  });

  describe("valid actions", () => {
    it("should show skill as activatable outside combat during day", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
    });

    it("should show skill as activatable outside combat at night", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_DARK_PATHS,
        })
      );
    });

    it("should not show skill after used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_DARK_PATHS],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const validActions = getValidActions(state, "player1");

      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_DARK_PATHS,
          })
        );
      }
    });
  });

  describe("standalone movement points", () => {
    it("should add to existing movement points", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_DARK_PATHS],
        movePoints: 3,
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      });

      // Should add 2 (night) to existing 3 = 5
      expect(result.state.players[0].movePoints).toBe(5);
    });
  });
});
