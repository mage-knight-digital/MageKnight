/**
 * Tests for Power of Pain skill (Arythea)
 *
 * Skill effect: Once a turn, play one Wound sideways as non-Wound card.
 * It gives +2 instead of +1. At end of turn, put that Wound in discard pile.
 *
 * Key rules:
 * - Enables playing one Wound sideways per activation
 * - Wound gives +2 instead of +1 when played sideways
 * - Cannot combine with other sideways bonus skills (exclusion group)
 * - Knockout tracking unaffected by discarding Wound via this skill
 * - Wound goes to discard pile at end of turn (normal card flow)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  CARD_MARCH,
  CARD_WOUND,
  CARD_KRANG_RUTHLESS_COERCION,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_POWER_OF_PAIN } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { isRuleActive } from "../modifiers/index.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS } from "../../types/modifierConstants.js";

describe("Power of Pain skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_ARYTHEA_POWER_OF_PAIN);
    });

    it("should enable RULE_WOUNDS_PLAYABLE_SIDEWAYS after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(
        isRuleActive(result.state, "player1", RULE_WOUNDS_PLAYABLE_SIDEWAYS)
      ).toBe(true);
    });

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
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
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_POWER_OF_PAIN],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("wound sideways play", () => {
    it("should allow playing wound sideways for +2 move after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for move
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(2);
    });

    it("should allow playing wound sideways for +2 influence", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH, CARD_KRANG_RUTHLESS_COERCION],
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for influence
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(afterSideways.state.players[0].influencePoints).toBe(2);
    });

    it("should move wound to play area when played sideways", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Wound should be in play area, not in hand
      expect(afterSideways.state.players[0].hand).not.toContain(CARD_WOUND);
      expect(afterSideways.state.players[0].playArea).toContain(CARD_WOUND);
    });

    it("should consume modifiers after playing one wound sideways", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play first wound sideways
      const afterFirst = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Modifiers should be consumed
      expect(
        isRuleActive(afterFirst.state, "player1", RULE_WOUNDS_PLAYABLE_SIDEWAYS)
      ).toBe(false);

      // Second wound should not be playable sideways
      const result = engine.processAction(afterFirst.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not allow playing wound sideways without activating skill first", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Try to play wound sideways without activating skill
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("undo", () => {
    it("should undo skill activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_ARYTHEA_POWER_OF_PAIN);
      expect(afterSkill.state.activeModifiers.length).toBeGreaterThan(0);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_ARYTHEA_POWER_OF_PAIN);
      expect(
        afterUndo.state.activeModifiers.some(
          (m) =>
            m.source.type === "skill" &&
            m.source.skillId === SKILL_ARYTHEA_POWER_OF_PAIN
        )
      ).toBe(false);
    });

    it("should undo wound sideways play and restore modifiers", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(2);
      expect(
        isRuleActive(afterSideways.state, "player1", RULE_WOUNDS_PLAYABLE_SIDEWAYS)
      ).toBe(false);

      // Undo the sideways play
      const afterUndo = engine.processAction(afterSideways.state, "player1", {
        type: UNDO_ACTION,
      });

      // Wound should be back in hand
      expect(afterUndo.state.players[0].hand).toContain(CARD_WOUND);
      // Move points should be restored
      expect(afterUndo.state.players[0].movePoints).toBe(0);
      // Modifiers should be restored
      expect(
        isRuleActive(afterUndo.state, "player1", RULE_WOUNDS_PLAYABLE_SIDEWAYS)
      ).toBe(true);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_ARYTHEA_POWER_OF_PAIN],
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
            skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
          })
        );
      }
    });

    it("should show wound as playable sideways after skill activation", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      const validActions = getValidActions(afterSkill.state, "player1");

      // The wound should show up in playCard cards with sideways options
      const woundCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_WOUND
      );
      expect(woundCard).toBeDefined();
      expect(woundCard?.canPlaySideways).toBe(true);
      expect(woundCard?.sidewaysOptions).toBeDefined();
      expect(woundCard?.sidewaysOptions?.length).toBeGreaterThan(0);
    });
  });

  describe("exclusion group", () => {
    it("should not allow second wound sideways after first is consumed", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play first wound sideways - should succeed with +2
      const afterFirst = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterFirst.state.players[0].movePoints).toBe(2);

      // Try to play second wound sideways - should fail
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSecond.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("normal card sideways unaffected", () => {
    it("should not give +2 to non-wound cards played sideways", () => {
      const player = createTestPlayer({
        hero: Hero.Arythea,
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH, CARD_WOUND],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play non-wound card sideways - should get +1 (normal)
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Normal cards should still get +1 (not affected by Power of Pain)
      expect(afterSideways.state.players[0].movePoints).toBe(1);
    });
  });
});
