/**
 * Tests for Ritual of Pain skill (Arythea)
 *
 * Skill effect: Once a round, except in combat: throw away up to two Wounds from hand,
 * then place the skill in the center. Any other player may return it to play a Wound
 * sideways as if it were a non-Wound card, gaining +3 instead of +1.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  END_TURN_ACTION,
  PLAY_SIDEWAYS_AS_MOVE,
  INVALID_ACTION,
  SKILL_USED,
  CARD_WOUND,
  CARD_MARCH,
  ENEMY_PROWLERS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_ARYTHEA_RITUAL_OF_PAIN } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { createCombatState, COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import {
  EFFECT_RULE_OVERRIDE,
  EFFECT_SIDEWAYS_VALUE,
  SOURCE_SKILL,
} from "../../types/modifierConstants.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [],
    usedThisTurn: [],
    usedThisCombat: [],
    activeUntilNextTurn: [],
  };
}

describe("Ritual of Pain skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  it("allows activation with zero wounds and places the skill in the center", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({ players: [player] });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: SKILL_USED,
        playerId: "player1",
        skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
      })
    );

    const ritualModifiers = result.state.activeModifiers.filter(
      (modifier) =>
        modifier.source.type === SOURCE_SKILL &&
        modifier.source.skillId === SKILL_ARYTHEA_RITUAL_OF_PAIN
    );

    expect(ritualModifiers.some((modifier) => modifier.effect.type === EFFECT_RULE_OVERRIDE)).
      toBe(true);
    expect(ritualModifiers.some((modifier) => modifier.effect.type === EFFECT_SIDEWAYS_VALUE)).
      toBe(true);
  });

  it("allows discarding up to two wounds when activating", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH],
    });
    const state = createTestGameState({ players: [player] });
    const woundPileBefore = state.woundPileCount;

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    expect(afterUse.state.players[0].pendingChoice?.options).toHaveLength(3);

    const afterChoice = engine.processAction(afterUse.state, "player1", {
      type: RESOLVE_CHOICE_ACTION,
      choiceIndex: 2, // discard 2 wounds
    });

    const updatedPlayer = afterChoice.state.players[0];
    expect(updatedPlayer.hand.filter((cardId) => cardId === CARD_WOUND)).toHaveLength(0);
    if (woundPileBefore !== null) {
      expect(afterChoice.state.woundPileCount).toBe(woundPileBefore + 2);
    }
  });

  it("cannot be activated during combat", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const combat = createCombatState([ENEMY_PROWLERS]);
    const state = createTestGameState({ players: [player], combat });

    const result = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    expect(result.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        playerId: "player1",
      })
    );
  });

  it("is limited to once per round", () => {
    const player = createTestPlayer({
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const state = createTestGameState({ players: [player] });

    const firstUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    expect(firstUse.state.players[0].skillCooldowns.usedThisRound).toContain(
      SKILL_ARYTHEA_RITUAL_OF_PAIN
    );

    const secondUse = engine.processAction(firstUse.state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    expect(secondUse.events).toContainEqual(
      expect.objectContaining({
        type: INVALID_ACTION,
        playerId: "player1",
      })
    );
  });

  it("lets another player play a wound sideways for +3 and returns the skill", () => {
    const arythea = createTestPlayer({
      id: "player1",
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const otherPlayer = createTestPlayer({
      id: "player2",
      hero: Hero.Tovak,
      hand: [CARD_WOUND, CARD_WOUND],
    });

    const state = createTestGameState({
      players: [arythea, otherPlayer],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    const otherTurnState = {
      ...afterUse.state,
      currentPlayerIndex: 1,
    };

    const afterSideways = engine.processAction(otherTurnState, "player2", {
      type: PLAY_CARD_SIDEWAYS_ACTION,
      cardId: CARD_WOUND,
      handIndex: 0,
      as: PLAY_SIDEWAYS_AS_MOVE,
    });

    const otherAfter = afterSideways.state.players[1];
    expect(otherAfter.movePoints).toBe(3);

    const ritualModifiersRemaining = afterSideways.state.activeModifiers.filter(
      (modifier) =>
        modifier.source.type === SOURCE_SKILL &&
        modifier.source.skillId === SKILL_ARYTHEA_RITUAL_OF_PAIN
    );
    expect(ritualModifiersRemaining).toHaveLength(0);

    const validAfter = getValidActions(afterSideways.state, "player2");
    const playableIds = validAfter.playCard?.cards.map((card) => card.cardId) ?? [];
    expect(playableIds).not.toContain(CARD_WOUND);
  });

  it("allows wounds to be played sideways during combat when the skill is in the center", () => {
    const arythea = createTestPlayer({
      id: "player1",
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const otherPlayer = createTestPlayer({
      id: "player2",
      hero: Hero.Tovak,
      hand: [CARD_WOUND],
    });

    const combat = {
      ...createCombatState([ENEMY_PROWLERS]),
      phase: COMBAT_PHASE_ATTACK,
    };

    const state = createTestGameState({
      players: [arythea, otherPlayer],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    const otherTurnState = {
      ...afterUse.state,
      currentPlayerIndex: 1,
      combat,
    };

    const validActions = getValidActions(otherTurnState, "player2");
    const woundCard = validActions.playCard?.cards.find((card) => card.cardId === CARD_WOUND);
    expect(woundCard?.canPlaySideways).toBe(true);
    expect(woundCard?.sidewaysOptions?.[0]?.value).toBe(3);
  });

  it("sends a sideways-played wound to the discard pile at end of turn", () => {
    const arythea = createTestPlayer({
      id: "player1",
      hero: Hero.Arythea,
      skills: [SKILL_ARYTHEA_RITUAL_OF_PAIN],
      skillCooldowns: buildSkillCooldowns(),
      hand: [CARD_MARCH],
    });
    const otherPlayer = createTestPlayer({
      id: "player2",
      hero: Hero.Tovak,
      hand: [CARD_WOUND],
      deck: [CARD_MARCH],
    });

    const state = createTestGameState({
      players: [arythea, otherPlayer],
      turnOrder: ["player1", "player2"],
      currentPlayerIndex: 0,
    });

    const afterUse = engine.processAction(state, "player1", {
      type: USE_SKILL_ACTION,
      skillId: SKILL_ARYTHEA_RITUAL_OF_PAIN,
    });

    const otherTurnState = {
      ...afterUse.state,
      currentPlayerIndex: 1,
    };

    const afterSideways = engine.processAction(otherTurnState, "player2", {
      type: PLAY_CARD_SIDEWAYS_ACTION,
      cardId: CARD_WOUND,
      handIndex: 0,
      as: PLAY_SIDEWAYS_AS_MOVE,
    });

    const afterEndTurn = engine.processAction(afterSideways.state, "player2", {
      type: END_TURN_ACTION,
    });

    const otherAfter = afterEndTurn.state.players[1];
    expect(otherAfter.discard).toContain(CARD_WOUND);
    expect(otherAfter.hand).not.toContain(CARD_WOUND);
  });
});
