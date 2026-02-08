/**
 * Tests for On Her Own skill (Wolfhawk)
 *
 * Skill effect: Once per turn, Influence 1.
 * Influence 3 instead if no unit recruited for influence this turn.
 *
 * Key rules:
 * - Grants Influence 1 as baseline
 * - Grants Influence 3 instead when no unit was recruited this turn
 * - Once per turn usage
 * - Condition checks hasRecruitedUnitThisTurn flag
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
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_ON_HER_OWN } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as string[],
    usedThisTurn: [] as string[],
    usedThisCombat: [] as string[],
    activeUntilNextTurn: [] as string[],
  };
}

describe("On Her Own skill (Wolfhawk)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================================
  // ACTIVATION: Influence conditional on recruitment
  // ============================================================================

  describe("activation", () => {
    it("should grant Influence 3 when no unit recruited this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        influencePoints: 0,
        hasRecruitedUnitThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_ON_HER_OWN,
        })
      );

      expect(result.state.players[0].influencePoints).toBe(3);
    });

    it("should grant Influence 1 when a unit was recruited this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        influencePoints: 0,
        hasRecruitedUnitThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_ON_HER_OWN,
        })
      );

      expect(result.state.players[0].influencePoints).toBe(1);
    });

    it("should add influence to existing influence points", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        influencePoints: 2,
        hasRecruitedUnitThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(result.state.players[0].influencePoints).toBe(5);
    });

    it("should add skill to usedThisTurn cooldown (once per turn)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_ON_HER_OWN);
    });

    it("should reject activation when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_WOLFHAWK_ON_HER_OWN],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================================
  // VALID ACTIONS
  // ============================================================================

  describe("valid actions", () => {
    it("should show skill as activatable when learned and not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_ON_HER_OWN,
        })
      );
    });

    it("should not show skill when on turn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_WOLFHAWK_ON_HER_OWN],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_ON_HER_OWN,
          })
        );
      }
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("undo", () => {
    it("should set undo checkpoint (conditional effects are non-reversible)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_ON_HER_OWN],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        influencePoints: 0,
        hasRecruitedUnitThisTurn: false,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill (should get 3 influence since no recruitment)
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_ON_HER_OWN,
      });

      expect(afterSkill.state.players[0].influencePoints).toBe(3);
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_ON_HER_OWN);

      // Undo should NOT revert (non-reversible sets checkpoint)
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill remains activated — conditional effects create undo checkpoints
      expect(afterUndo.state.players[0].influencePoints).toBe(3);
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_ON_HER_OWN);
    });
  });
});
