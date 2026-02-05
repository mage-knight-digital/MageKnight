/**
 * Tests for Burning Power skill (Arythea)
 *
 * Skill effect: Siege Attack 1 or Fire Siege Attack 1.
 * Only usable during the ranged/siege phase of combat.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  RESOLVE_CHOICE_ACTION,
  CHOICE_RESOLVED,
  ENEMY_PROWLERS,
  ELEMENT_FIRE,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_BURNING_POWER } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_BLOCK,
  createCombatState,
} from "../../types/combat.js";

describe("Burning Power skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_BURNING_POWER,
        })
      );
    });

    it("should activate during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_BURNING_POWER,
        })
      );
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should reject if not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("pending choice", () => {
    it("should create pending choice with 2 options after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.pendingChoice).not.toBeNull();
      expect(updatedPlayer.pendingChoice?.options).toHaveLength(2);
      expect(updatedPlayer.pendingChoice?.skillId).toBe(SKILL_ARYTHEA_BURNING_POWER);
      expect(updatedPlayer.pendingChoice?.cardId).toBeNull();
    });
  });

  describe("attack options", () => {
    it("should grant Siege Attack 1 when choosing physical option", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      expect(afterChoice.events).toContainEqual(
        expect.objectContaining({
          type: CHOICE_RESOLVED,
        })
      );

      const updatedPlayer = afterChoice.state.players[0];
      expect(updatedPlayer.combatAccumulator.attack.siege).toBe(1);
      expect(updatedPlayer.pendingChoice).toBeNull();
    });

    it("should grant Fire Siege Attack 1 when choosing fire option", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const combat = createCombatState([ENEMY_PROWLERS]);
      const state = createTestGameState({ players: [player], combat });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_BURNING_POWER,
      });

      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      const updatedPlayer = afterChoice.state.players[0];
      expect(
        updatedPlayer.combatAccumulator.attack.siegeElements[ELEMENT_FIRE]
      ).toBe(1);
    });
  });

  describe("valid actions", () => {
    it("should show skill during ranged/siege phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
          skillId: SKILL_ARYTHEA_BURNING_POWER,
        })
      );
    });

    it("should show skill during attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
          skillId: SKILL_ARYTHEA_BURNING_POWER,
        })
      );
    });

    it("should not show skill when not in ranged/siege or attack phase", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_BURNING_POWER],
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
            skillId: SKILL_ARYTHEA_BURNING_POWER,
          })
        );
      }
    });
  });
});
