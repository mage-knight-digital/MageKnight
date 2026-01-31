/**
 * Tests for Power of Pain skill (Arythea)
 *
 * Power of Pain allows playing one Wound sideways for +2 instead of +1 once per turn.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  CARD_PLAYED,
  CARD_WOUND,
  CARD_MARCH,
  INVALID_ACTION,
  SKILL_USED,
} from "@mage-knight/shared";
import { SKILL_ARYTHEA_POWER_OF_PAIN } from "../../data/skills/index.js";
import { isRuleActive, getEffectiveSidewaysValue } from "../modifiers.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS } from "../modifierConstants.js";
import { getPlayableCardsForNormalTurn } from "../validActions/cards/normalTurn.js";
import { getPlayableCardsForCombat } from "../validActions/cards/combat.js";
import { COMBAT_PHASE_BLOCK, COMBAT_PHASE_ATTACK, COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";

describe("Power of Pain skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("skill activation", () => {
    it("should activate successfully when player owns skill and has wound in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
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

    it("should create rule override modifier for wounds playable sideways", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(isRuleActive(result.state, "player1", RULE_WOUNDS_PLAYABLE_SIDEWAYS)).toBe(true);
    });

    it("should create sideways value modifier for wounds with +2 value", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // For wounds, should return 2
      const woundValue = getEffectiveSidewaysValue(
        result.state,
        "player1",
        true, // isWound
        false, // usedManaFromSource
        undefined
      );
      expect(woundValue).toBe(2);

      // For non-wounds, should still be 1
      const normalValue = getEffectiveSidewaysValue(
        result.state,
        "player1",
        false, // isWound
        false,
        undefined
      );
      expect(normalValue).toBe(1);
    });

    it("should fail if player does not own the skill", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [], // No skills
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You do not own this skill",
        })
      );
    });

    it("should fail if player has no wound in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH], // No wounds
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Power of Pain requires at least one Wound in hand",
        })
      );
    });

    it("should fail if skill already used this turn", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_WOUND], // Two wounds
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate first time
      const afterFirst = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(afterFirst.events).toContainEqual(
        expect.objectContaining({ type: SKILL_USED })
      );

      // Try to activate again
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(afterSecond.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Skill already used this turn",
        })
      );
    });

    it("should track skill in usedThisTurn cooldowns", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      expect(result.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_ARYTHEA_POWER_OF_PAIN
      );
    });
  });

  describe("playing wounds sideways after activation", () => {
    it("should allow playing wound sideways for +2 Move", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for move
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_WOUND,
          sideways: true,
          effect: "Gained 2 Move (sideways)",
        })
      );
    });

    it("should allow playing wound sideways for +2 Influence", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for influence
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(result.state.players[0].influencePoints).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_WOUND,
          sideways: true,
          effect: "Gained 2 Influence (sideways)",
        })
      );
    });

    it("should allow playing wound sideways for +2 Attack", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for attack
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_ATTACK,
      });

      expect(result.state.players[0].combatAccumulator.attack.normal).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_WOUND,
          sideways: true,
          effect: "Gained 2 Attack (sideways)",
        })
      );
    });

    it("should allow playing wound sideways for +2 Block", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways for block
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_BLOCK,
      });

      expect(result.state.players[0].combatAccumulator.block).toBe(2);
      expect(result.state.players[0].combatAccumulator.blockElements.physical).toBe(2);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_WOUND,
          sideways: true,
          effect: "Gained 2 Block (sideways)",
        })
      );
    });

    it("should move wound to play area when played sideways", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play wound sideways
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].hand).not.toContain(CARD_WOUND);
      expect(result.state.players[0].playArea).toContain(CARD_WOUND);
    });
  });

  describe("valid actions integration", () => {
    it("should include wound in playable cards for normal turn after activation", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Before activation - wound should not be playable
      const beforeCards = getPlayableCardsForNormalTurn(state, state.players[0]);
      expect(beforeCards.cards.find((c) => c.cardId === CARD_WOUND)).toBeUndefined();

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // After activation - wound should be playable sideways
      const afterCards = getPlayableCardsForNormalTurn(
        afterSkill.state,
        afterSkill.state.players[0]
      );
      const woundCard = afterCards.cards.find((c) => c.cardId === CARD_WOUND);
      expect(woundCard).toBeDefined();
      expect(woundCard?.canPlaySideways).toBe(true);
      expect(woundCard?.canPlayBasic).toBe(false);
      expect(woundCard?.canPlayPowered).toBe(false);
    });

    it("should show +2 sideways options for wound after activation", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      const playableCards = getPlayableCardsForNormalTurn(
        afterSkill.state,
        afterSkill.state.players[0]
      );
      const woundCard = playableCards.cards.find((c) => c.cardId === CARD_WOUND);

      expect(woundCard?.sidewaysOptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ as: PLAY_SIDEWAYS_AS_MOVE, value: 2 }),
          expect.objectContaining({ as: PLAY_SIDEWAYS_AS_INFLUENCE, value: 2 }),
        ])
      );
    });

    it("should include wound in combat block phase after activation", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_BLOCK);
      const state = createTestGameState({ players: [player] });

      // Before activation - wound should not be playable
      const beforeCards = getPlayableCardsForCombat(state, state.players[0], combat);
      expect(beforeCards.cards.find((c) => c.cardId === CARD_WOUND)).toBeUndefined();

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // After activation - wound should be playable in block phase
      const afterCards = getPlayableCardsForCombat(
        afterSkill.state,
        afterSkill.state.players[0],
        combat
      );
      const woundCard = afterCards.cards.find((c) => c.cardId === CARD_WOUND);
      expect(woundCard).toBeDefined();
      expect(woundCard?.canPlaySideways).toBe(true);
      expect(woundCard?.sidewaysOptions).toEqual([
        expect.objectContaining({ as: PLAY_SIDEWAYS_AS_BLOCK, value: 2 }),
      ]);
    });

    it("should include wound in combat attack phase after activation", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // After activation - wound should be playable in attack phase
      const afterCards = getPlayableCardsForCombat(
        afterSkill.state,
        afterSkill.state.players[0],
        combat
      );
      const woundCard = afterCards.cards.find((c) => c.cardId === CARD_WOUND);
      expect(woundCard).toBeDefined();
      expect(woundCard?.sidewaysOptions).toEqual([
        expect.objectContaining({ as: PLAY_SIDEWAYS_AS_ATTACK, value: 2 }),
      ]);
    });

    it("should NOT include wound in ranged/siege phase (per FAQ)", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
      });
      const combat = createUnitCombatState(COMBAT_PHASE_RANGED_SIEGE);
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Wound should not be playable in ranged/siege phase per FAQ
      const afterCards = getPlayableCardsForCombat(
        afterSkill.state,
        afterSkill.state.players[0],
        combat
      );
      const woundCard = afterCards.cards.find((c) => c.cardId === CARD_WOUND);
      expect(woundCard).toBeUndefined();
    });
  });

  describe("without skill activation", () => {
    it("should still reject wounds sideways without skill", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [], // No skills
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Wound cards cannot be played sideways",
        })
      );
    });

    it("should still reject wounds sideways with skill but not activated", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN], // Has skill but not activated
      });
      const state = createTestGameState({ players: [player] });

      // Try to play wound without activating skill first
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_WOUND,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Wound cards cannot be played sideways",
        })
      );
    });
  });

  describe("normal cards still work normally", () => {
    it("should not affect normal card sideways value after skill activation", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH],
        skills: [SKILL_ARYTHEA_POWER_OF_PAIN],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_ARYTHEA_POWER_OF_PAIN,
      });

      // Play March sideways - should still be +1
      const result = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_PLAYED,
          cardId: CARD_MARCH,
          sideways: true,
          effect: "Gained 1 Move (sideways)",
        })
      );
    });
  });
});
