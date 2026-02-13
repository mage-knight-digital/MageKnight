/**
 * Tests for I Don't Give a Damn skill (Tovak)
 *
 * Skill effect: One sideways card gives +2 instead of +1.
 * Advanced Actions, Spells, and Artifacts give +3 instead.
 *
 * FAQ:
 * - Cannot be used with Wound cards
 * - Hero-specific Basic Actions (Cold Toughness, etc.) count as Basic (+2, not +3)
 * - Cannot stack with Universal Power, Who Needs Magic, Wolf's Howl on same sideways card
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
  CARD_RAGE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_BLOOD_RAGE,
  CARD_FIREBALL,
  CARD_BANNER_OF_GLORY,
  CARD_WOUND,
  CARD_KRANG_RUTHLESS_COERCION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
} from "../../data/skills/index.js";
import { getSkillsFromValidActions } from "@mage-knight/shared";
import { getValidActions } from "../validActions/index.js";

describe("I Don't Give a Damn skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill and emit SKILL_USED event", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_I_DONT_GIVE_A_DAMN);
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Basic Action sideways = +2", () => {
    it("should give +2 for shared Basic Action (March)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(2);
    });

    it("should give +2 for another Basic Action (Rage)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_RAGE],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(2);
    });
  });

  describe("Hero-specific Basic Actions = +2 (not +3)", () => {
    it("should give +2 for hero-specific card (Cold Toughness)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_TOVAK_COLD_TOUGHNESS],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_TOVAK_COLD_TOUGHNESS,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Cold Toughness is a Basic Action, so should get +2, not +3
      expect(afterSideways.state.players[0].movePoints).toBe(2);
    });
  });

  describe("Advanced Action sideways = +3", () => {
    it("should give +3 for Advanced Action (Blood Rage)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_BLOOD_RAGE],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_BLOOD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Spell sideways = +3", () => {
    it("should give +3 for Spell (Fireball)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_FIREBALL],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_FIREBALL,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Artifact sideways = +3", () => {
    it("should give +3 for Artifact (Banner of Glory)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_BANNER_OF_GLORY, CARD_KRANG_RUTHLESS_COERCION],
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_BANNER_OF_GLORY,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      expect(afterSideways.state.players[0].influencePoints).toBe(3);
    });
  });

  describe("wound restriction", () => {
    it("should not allow wounds to benefit (wounds still cannot be played sideways by default)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_WOUND],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Wounds cannot be played sideways without RULE_WOUNDS_PLAYABLE_SIDEWAYS
      const result = engine.processAction(afterSkill.state, "player1", {
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

  describe("modifier consumption", () => {
    it("modifier should persist for the whole turn (applies to all sideways plays)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_MARCH, CARD_RAGE],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play first card sideways - should get +2
      const afterFirst = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterFirst.state.players[0].movePoints).toBe(2);

      // Play second card sideways - should also get +2 (modifier lasts for turn)
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSecond.state.players[0].movePoints).toBe(4); // 2 + 2
    });
  });

  describe("undo", () => {
    it("should be undoable", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_I_DONT_GIVE_A_DAMN);
      expect(afterSkill.state.activeModifiers.length).toBeGreaterThan(0);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_TOVAK_I_DONT_GIVE_A_DAMN);
      // Modifiers should be removed
      expect(
        afterUndo.state.activeModifiers.some(
          (m) =>
            m.source.type === "skill" &&
            m.source.skillId === SKILL_TOVAK_I_DONT_GIVE_A_DAMN
        )
      ).toBe(false);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
        })
      );
    });

    it("should not show skill when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
          })
        );
      }
    });

    it("should show enhanced sideways value in valid actions for Basic Actions", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const validActions = getValidActions(afterSkill.state, "player1");
      const marchCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_MARCH
      );

      expect(marchCard).toBeDefined();
      expect(marchCard?.sidewaysOptions).toBeDefined();
      // Should show value 2 for Basic Action
      expect(marchCard?.sidewaysOptions?.[0]?.value).toBe(2);
    });

    it("should show enhanced sideways value in valid actions for Advanced Actions", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_BLOOD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      const validActions = getValidActions(afterSkill.state, "player1");
      const bloodRageCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_BLOOD_RAGE
      );

      expect(bloodRageCard).toBeDefined();
      expect(bloodRageCard?.sidewaysOptions).toBeDefined();
      // Should show value 3 for Advanced Action
      expect(bloodRageCard?.sidewaysOptions?.[0]?.value).toBe(3);
    });
  });

  describe("without skill activation", () => {
    it("should give default +1 when skill is not activated", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        hand: [CARD_MARCH],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Play sideways WITHOUT activating skill
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(result.state.players[0].movePoints).toBe(1);
    });
  });
});
