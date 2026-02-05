/**
 * Tests for Day Sharpshooting skill (Norowas)
 *
 * Skill effect: Ranged Attack 2 (day) or Ranged Attack 1 (night).
 * Only usable during the ranged/siege or attack phase of combat.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_DAY_SHARPSHOOTING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";
import { ENEMY_PROWLERS } from "@mage-knight/shared";

describe("Day Sharpshooting skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
        })
      );
    });

    it("should activate during attack phase and grant ranged attack", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
        })
      );
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
    });

    it("should reject if not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
        })
      );
    });

    it("should show skill during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_ATTACK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
        })
      );
    });

    it("should not show skill when not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_DAY_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = {
        ...createCombatState([ENEMY_PROWLERS]),
        phase: COMBAT_PHASE_BLOCK,
      };
      const state = createTestGameState({ players: [player], combat });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_NOROWAS_DAY_SHARPSHOOTING,
          })
        );
      }
    });
  });
});
