/**
 * Tests for Refreshing Breeze skill (Wolfhawk)
 *
 * Skill effect: Once per round, except during combat: Flip this to get Heal 1
 * and one white crystal to your inventory.
 *
 * Key rules:
 * - Provides Heal 1 when activated (removes up to 1 wound card from hand)
 * - Grants 1 white crystal (permanent, to inventory)
 * - Both effects happen together
 * - Cannot be activated during combat
 * - Once per round usage (flips after use, resets at end of round)
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
import { SKILL_WOLFHAWK_REFRESHING_BREEZE } from "../../data/skills/index.js";
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

describe("Refreshing Breeze skill (Wolfhawk)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should grant Heal 1 and 1 white crystal", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
        })
      );

      const updatedPlayer = result.state.players[0];

      // Wound should be removed (Heal 1)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(0);
      // March should remain
      expect(updatedPlayer.hand).toContain(CARD_MARCH);

      // White crystal should be granted
      expect(updatedPlayer.crystals.white).toBe(1);

      // No pending choice (both effects are immediate)
      expect(updatedPlayer.pendingChoice).toBeNull();
    });

    it("should grant both effects even when no wounds to heal", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      // Crystal should still be granted even with no wounds
      expect(result.state.players[0].crystals.white).toBe(1);
    });

    it("should return healed wounds to the wound pile", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      expect(result.state.woundPileCount).toBe(11);
    });

    it("should add skill to usedThisRound cooldown (once per round)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_REFRESHING_BREEZE);
    });

    it("should heal only 1 wound when multiple wounds in hand (Heal 1)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      const updatedPlayer = result.state.players[0];
      // Only 1 wound should be healed (Heal 1, not Heal 2)
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(1);
    });
  });

  describe("crystal limit", () => {
    it("should still heal when at max white crystals", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 3 },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      // White crystals should stay at 3 (capped)
      expect(result.state.players[0].crystals.white).toBe(3);

      // Healing should still work
      expect(
        result.state.players[0].hand.filter((c) => c === CARD_WOUND)
      ).toHaveLength(0);
    });
  });

  describe("combat restriction", () => {
    it("should reject activation during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
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
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not show skill in valid actions when in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_WOUND, CARD_MARCH],
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
            skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
          })
        );
      }
    });
  });

  describe("valid actions", () => {
    it("should show skill as activatable when learned and not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
        })
      );
    });

    it("should not show skill when on round cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisRound: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
          })
        );
      }
    });
  });

  describe("undo", () => {
    it("should restore cooldown and crystal on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_REFRESHING_BREEZE],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        pureMana: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_REFRESHING_BREEZE,
      });

      // Verify activation happened
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisRound
      ).toContain(SKILL_WOLFHAWK_REFRESHING_BREEZE);
      expect(afterSkill.state.players[0].crystals.white).toBe(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisRound
      ).not.toContain(SKILL_WOLFHAWK_REFRESHING_BREEZE);

      // Crystal should be reverted
      expect(afterUndo.state.players[0].crystals.white).toBe(0);
    });
  });
});
