/**
 * Tests for Potion Making skill (Goldyx)
 *
 * Skill effect: Once per round, except during combat: Flip this to get Heal 2.
 *
 * Key rules:
 * - Provides Heal 2 when activated (removes up to 2 wound cards from hand)
 * - Cannot be activated during combat
 * - Once per round usage (flips after use, resets at end of round)
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
  CARD_MARCH,
  CARD_WOUND,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_POTION_MAKING } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [],
    usedThisTurn: [],
    usedThisCombat: [],
    activeUntilNextTurn: [],
  };
}

describe("Potion Making skill (Goldyx)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should provide Heal 2 and remove 2 wounds from hand", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_POTION_MAKING,
        })
      );

      const updatedPlayer = result.state.players[0];
      // Both wounds should be removed
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      // March should remain
      expect(updatedPlayer.hand).toContain(CARD_MARCH);
      expect(updatedPlayer.hand).toHaveLength(1);
    });

    it("should heal only 1 wound when player has only 1 wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      const updatedPlayer = result.state.players[0];
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      expect(updatedPlayer.hand).toContain(CARD_MARCH);
      expect(updatedPlayer.hand).toHaveLength(1);
    });

    it("should return healed wounds to the wound pile", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      expect(result.state.woundPileCount).toBe(12);
    });

    it("should add skill to usedThisRound cooldown (once per round)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_POTION_MAKING);
    });
  });

  describe("combat restriction", () => {
    it("should reject activation during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
      });

      const state = createTestGameState({
        players: [player],
        combat: {
          phase: COMBAT_PHASE_BLOCK,
          enemies: [],
          siteType: null,
          pendingBlock: {},
          pendingSwiftBlock: {},
          pendingDamage: {},
          forcedUnblockEnemyId: null,
          playersAssigningDamage: [],
          damageAssignmentIndex: 0,
          cooperativeData: null,
        },
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not show skill in valid actions when in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
      });

      const state = createTestGameState({
        players: [player],
        combat: {
          phase: COMBAT_PHASE_BLOCK,
          enemies: [],
          siteType: null,
          pendingBlock: {},
          pendingSwiftBlock: {},
          pendingDamage: {},
          forcedUnblockEnemyId: null,
          playersAssigningDamage: [],
          damageAssignmentIndex: 0,
          cooperativeData: null,
        },
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_POTION_MAKING,
          })
        );
      }
    });
  });

  describe("valid actions", () => {
    it("should show Potion Making as activatable when learned and not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_GOLDYX_POTION_MAKING,
        })
      );
    });

    it("should not show Potion Making when on round cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisRound: [SKILL_GOLDYX_POTION_MAKING],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_POTION_MAKING,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should restore cooldown on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_POTION_MAKING],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_POTION_MAKING,
      });

      // Verify skill was applied
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_GOLDYX_POTION_MAKING);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_GOLDYX_POTION_MAKING);
    });
  });
});
