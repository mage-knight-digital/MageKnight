/**
 * Tests for Invocation skill (Arythea)
 *
 * Skill effect: Once a turn, discard a card to gain a mana token.
 * - Discard a Wound → gain red or black mana token
 * - Discard a non-Wound → gain white or green mana token
 * - Mana must be used immediately
 * - Usable during combat (CATEGORY_SPECIAL)
 * - Cannot interrupt other effects
 *
 * Key rules:
 * - Once per turn usage
 * - Wound cards are returned to wound pile (not discard pile)
 * - Non-wound cards go to discard pile
 * - Black mana during day only usable in Dungeon/Tomb
 * - Works with Polarization (can convert gained mana before using)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  CARD_MARCH,
  CARD_WOUND,
  MANA_RED,
  MANA_BLACK,
  MANA_WHITE,
  MANA_GREEN,
  getSkillsFromValidActions,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_INVOCATION } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { EFFECT_INVOCATION_RESOLVE } from "../../types/effectTypes.js";

describe("Invocation skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill and create pending choice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_INVOCATION,
        })
      );

      // Should have a pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.skillId).toBe(
        SKILL_ARYTHEA_INVOCATION
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_ARYTHEA_INVOCATION);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_INVOCATION],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("choice options", () => {
    it("should offer red and black mana for wound cards", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = result.state.players[0].pendingChoice?.options;
      expect(options).toBeDefined();
      expect(options).toHaveLength(2);

      // Should have red and black options for wound
      const colors = options?.map(
        (o) => (o as { manaColor: string }).manaColor
      );
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLACK);

      // All options should be for wound card
      for (const option of options ?? []) {
        expect((option as { isWound: boolean }).isWound).toBe(true);
        expect((option as { cardId: string }).cardId).toBe(CARD_WOUND);
      }
    });

    it("should offer white and green mana for non-wound cards", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = result.state.players[0].pendingChoice?.options;
      expect(options).toBeDefined();
      expect(options).toHaveLength(2);

      // Should have white and green options for non-wound
      const colors = options?.map(
        (o) => (o as { manaColor: string }).manaColor
      );
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_GREEN);

      // All options should be for non-wound card
      for (const option of options ?? []) {
        expect((option as { isWound: boolean }).isWound).toBe(false);
        expect((option as { cardId: string }).cardId).toBe(CARD_MARCH);
      }
    });

    it("should offer both wound and non-wound options when hand has both", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = result.state.players[0].pendingChoice?.options;
      expect(options).toBeDefined();
      // 2 for wound (red, black) + 2 for march (white, green) = 4
      expect(options).toHaveLength(4);

      const colors = options?.map(
        (o) => (o as { manaColor: string }).manaColor
      );
      expect(colors).toContain(MANA_RED);
      expect(colors).toContain(MANA_BLACK);
      expect(colors).toContain(MANA_WHITE);
      expect(colors).toContain(MANA_GREEN);
    });

    it("should deduplicate options for multiple copies of same card", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = result.state.players[0].pendingChoice?.options;
      // Should only have 2 options (red, black) even with 3 wounds
      expect(options).toHaveLength(2);
    });

    it("should use EFFECT_INVOCATION_RESOLVE type for all options", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = result.state.players[0].pendingChoice?.options;
      for (const option of options ?? []) {
        expect(option.type).toBe(EFFECT_INVOCATION_RESOLVE);
      }
    });
  });

  describe("wound discard → mana", () => {
    it("should discard wound and gain red mana when choosing red option", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      // Find the red mana wound option
      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const redWoundIndex = options.findIndex(
        (o) =>
          (o as { manaColor: string }).manaColor === MANA_RED &&
          (o as { isWound: boolean }).isWound === true
      );
      expect(redWoundIndex).toBeGreaterThanOrEqual(0);

      // Resolve the choice
      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: redWoundIndex,
      });

      // Wound should be removed from hand
      expect(afterResolve.state.players[0].hand).not.toContain(CARD_WOUND);
      // Non-wound card should still be in hand
      expect(afterResolve.state.players[0].hand).toContain(CARD_MARCH);
      // Should have gained red mana token
      expect(afterResolve.state.players[0].pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_RED })
      );
    });

    it("should discard wound and gain black mana when choosing black option", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      // Find the black mana wound option
      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const blackWoundIndex = options.findIndex(
        (o) =>
          (o as { manaColor: string }).manaColor === MANA_BLACK &&
          (o as { isWound: boolean }).isWound === true
      );
      expect(blackWoundIndex).toBeGreaterThanOrEqual(0);

      // Resolve the choice
      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: blackWoundIndex,
      });

      // Wound should be removed from hand
      expect(afterResolve.state.players[0].hand).not.toContain(CARD_WOUND);
      // Should have gained black mana token
      expect(afterResolve.state.players[0].pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_BLACK })
      );
    });

    it("should return wound to wound pile (not discard pile)", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
        discard: [],
      });
      const initialWoundPileCount = 10;
      const state = createTestGameState({
        players: [player],
        woundPileCount: initialWoundPileCount,
      });

      // Activate and choose wound → red
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const redWoundIndex = options.findIndex(
        (o) =>
          (o as { manaColor: string }).manaColor === MANA_RED &&
          (o as { isWound: boolean }).isWound === true
      );

      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: redWoundIndex,
      });

      // Wound should NOT be in discard pile
      expect(afterResolve.state.players[0].discard).not.toContain(CARD_WOUND);
      // Wound pile count should increase
      expect(afterResolve.state.woundPileCount).toBe(
        initialWoundPileCount + 1
      );
    });
  });

  describe("non-wound discard → mana", () => {
    it("should discard non-wound and gain white mana", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_MARCH],
        pureMana: [],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      // Find the white mana option
      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const whiteIndex = options.findIndex(
        (o) =>
          (o as { manaColor: string }).manaColor === MANA_WHITE &&
          (o as { isWound: boolean }).isWound === false
      );
      expect(whiteIndex).toBeGreaterThanOrEqual(0);

      // Resolve the choice
      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: whiteIndex,
      });

      // Card should be in discard pile (not wound pile)
      expect(afterResolve.state.players[0].hand).not.toContain(CARD_MARCH);
      expect(afterResolve.state.players[0].discard).toContain(CARD_MARCH);
      // Should have gained white mana token
      expect(afterResolve.state.players[0].pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_WHITE })
      );
    });

    it("should discard non-wound and gain green mana", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_MARCH],
        pureMana: [],
        discard: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      // Find the green mana option
      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const greenIndex = options.findIndex(
        (o) =>
          (o as { manaColor: string }).manaColor === MANA_GREEN &&
          (o as { isWound: boolean }).isWound === false
      );
      expect(greenIndex).toBeGreaterThanOrEqual(0);

      // Resolve the choice
      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: greenIndex,
      });

      // Card should be in discard pile
      expect(afterResolve.state.players[0].discard).toContain(CARD_MARCH);
      // Should have gained green mana token
      expect(afterResolve.state.players[0].pureMana).toContainEqual(
        expect.objectContaining({ color: MANA_GREEN })
      );
    });
  });

  describe("mana token source", () => {
    it("should add mana token with skill source", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND],
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Activate and choose red mana from wound
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const afterResolve = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0, // First option (red mana for wound)
      });

      const token = afterResolve.state.players[0].pureMana[0];
      expect(token).toBeDefined();
      expect(token?.source).toBe("skill");
    });
  });

  describe("undo", () => {
    it("should undo skill activation and clear pending choice", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      expect(afterSkill.state.players[0].pendingChoice).not.toBeNull();
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_ARYTHEA_INVOCATION);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Pending choice should be cleared
      expect(afterUndo.state.players[0].pendingChoice).toBeNull();
      // Cooldown should be removed
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_ARYTHEA_INVOCATION);
      // Hand should be unchanged
      expect(afterUndo.state.players[0].hand).toContain(CARD_WOUND);
      expect(afterUndo.state.players[0].hand).toContain(CARD_MARCH);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_INVOCATION,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_INVOCATION],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_INVOCATION,
          })
        );
      }
    });

    it("should not show skill when hand is empty", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_ARYTHEA_INVOCATION,
          })
        );
      }
    });
  });

  describe("usable during combat", () => {
    it("should show skill as available during combat (CATEGORY_SPECIAL)", () => {
      // CATEGORY_SPECIAL skills are available both in and out of combat
      // They don't have CATEGORY_COMBAT which would restrict to combat-only
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Verify skill is available outside combat
      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_INVOCATION,
        })
      );
    });
  });

  describe("night time", () => {
    it("should offer black mana option at night", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_INVOCATION],
        hand: [CARD_WOUND],
      });
      const state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_INVOCATION,
      });

      const options = afterSkill.state.players[0].pendingChoice?.options ?? [];
      const colors = options.map(
        (o) => (o as { manaColor: string }).manaColor
      );
      expect(colors).toContain(MANA_BLACK);
    });
  });
});
