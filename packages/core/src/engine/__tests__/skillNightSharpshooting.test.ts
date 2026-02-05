/**
 * Tests for Night Sharpshooting skill (Tovak)
 *
 * Skill effect: Ranged Attack 1 (day) or Ranged Attack 2 (night).
 * Dungeons/Tombs count as night for this skill.
 * Only usable during the ranged/siege or attack phase of combat.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  getSkillsFromValidActions,
  ENEMY_PROWLERS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_NIGHT_SHARPSHOOTING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  createCombatState,
} from "../../types/combat.js";

describe("Night Sharpshooting skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
        })
      );
    });

    it("should grant Ranged Attack 1 during the day", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({
        players: [player],
        combat,
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
      });

      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(1);
    });

    it("should grant Ranged Attack 2 during the night", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({
        players: [player],
        combat,
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
      });

      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
    });

    it("should grant Ranged Attack 2 in dungeon during the day", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS], false, {
        nightManaRules: true,
      });
      const state = createTestGameState({
        players: [player],
        combat,
        timeOfDay: TIME_OF_DAY_DAY,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
      });

      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(2);
    });

    it("should activate during attack phase and grant ranged attack", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
        })
      );
      expect(result.state.players[0].combatAccumulator.attack.ranged).toBe(1);
    });

    it("should reject if not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
        skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
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
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
          skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
        })
      );
    });

    it("should show skill during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
          skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
        })
      );
    });

    it("should not show skill when not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_NIGHT_SHARPSHOOTING],
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
            skillId: SKILL_TOVAK_NIGHT_SHARPSHOOTING,
          })
        );
      }
    });
  });
});
