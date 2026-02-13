/**
 * Tests for Universal Power skill (Goldyx)
 *
 * Skill effect: Add 1 mana to sideways cards to increase bonus.
 * - +3 instead of +1 for all cards
 * - +4 if mana color matches Action/Spell card color
 * - Artifacts always receive +3 (ruling S6)
 *
 * FAQ:
 * - Cannot stack with I Don't Give a Damn, Who Needs Magic, Wolf's Howl (ruling S2)
 * - Cannot combine with Power of Pain (ruling S3)
 * - Depleted dice cannot be used (ruling S4)
 * - Black mana at night grants only +3 (ruling S5)
 * - Sideways attacks must be non-elemental, non-siege, non-ranged (ruling S1)
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
  CARD_DETERMINATION,
  CARD_BLOOD_RAGE,
  CARD_FIREBALL,
  CARD_BANNER_OF_GLORY,
  MANA_RED,
  MANA_GREEN,
  MANA_BLUE,
  MANA_SOURCE_TOKEN,
  CARD_KRANG_RUTHLESS_COERCION,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_GOLDYX_UNIVERSAL_POWER,
} from "../../data/skills/index.js";
import { getSkillsFromValidActions } from "@mage-knight/shared";
import { getValidActions } from "../validActions/index.js";
import type { ManaSourceInfo } from "@mage-knight/shared";

/** Helper to create a mana source info for a token of a given color */
function tokenMana(color: string): ManaSourceInfo {
  return { type: MANA_SOURCE_TOKEN, color: color as ManaSourceInfo["color"] };
}

describe("Universal Power skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill with mana and emit SKILL_USED event", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_GOLDYX_UNIVERSAL_POWER);
    });

    it("should consume the mana token", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      // Mana token should be consumed
      expect(result.state.players[0].pureMana).toHaveLength(0);
    });

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_GOLDYX_UNIVERSAL_POWER],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject if no mana source provided", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        // No manaSource provided
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Basic Action sideways = +3", () => {
    it("should give +3 for Basic Action (March) with green mana", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_GREEN),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // March is green, matching green mana → should get +4
      expect(afterSideways.state.players[0].movePoints).toBe(4);
    });

    it("should give +3 when mana color does not match Basic Action", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // March is green, mana is red → no match, should get +3
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("color matching = +4", () => {
    it("should give +4 when mana color matches Action card (Rage with red mana)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_RAGE],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Rage is red, matching red mana → +4
      expect(afterSideways.state.players[0].movePoints).toBe(4);
    });

    it("should give +4 when mana color matches Determination (blue mana)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_DETERMINATION],
        pureMana: [{ color: MANA_BLUE, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_BLUE),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_DETERMINATION,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Determination is blue, matching blue mana → +4
      expect(afterSideways.state.players[0].movePoints).toBe(4);
    });

    it("should give +3 when mana color doesn't match (blue mana on Rage)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_RAGE],
        pureMana: [{ color: MANA_BLUE, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_BLUE),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Rage is red, mana is blue → no match, +3
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Advanced Action sideways", () => {
    it("should give +4 for Advanced Action with matching color (Blood Rage + red mana)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_BLOOD_RAGE],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_BLOOD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Blood Rage is red, matching red mana → +4
      expect(afterSideways.state.players[0].movePoints).toBe(4);
    });

    it("should give +3 for Advanced Action with non-matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_BLOOD_RAGE],
        pureMana: [{ color: MANA_BLUE, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_BLUE),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_BLOOD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Blood Rage is red, mana is blue → no match, +3
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Spell sideways", () => {
    it("should give +4 for Spell with matching color (Fireball + red mana)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_FIREBALL],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_FIREBALL,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Fireball poweredBy [MANA_BLACK, MANA_RED], red mana matches → +4
      expect(afterSideways.state.players[0].movePoints).toBe(4);
    });

    it("should give +3 for Spell with non-matching color", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_FIREBALL],
        pureMana: [{ color: MANA_GREEN, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_GREEN),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_FIREBALL,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Fireball poweredBy [MANA_BLACK, MANA_RED], green mana doesn't match → +3
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Artifact sideways = +3 always (ruling S6)", () => {
    it("should give +3 for Artifact even with matching mana color", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_BANNER_OF_GLORY, CARD_KRANG_RUTHLESS_COERCION],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_BANNER_OF_GLORY,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      // Artifacts always get +3, not +4 (ruling S6)
      expect(afterSideways.state.players[0].influencePoints).toBe(3);
    });
  });

  describe("modifier persistence", () => {
    it("modifier should persist for the whole turn (applies to all sideways plays)", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_MARCH, CARD_RAGE],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      // Play first card sideways - March (green) with red mana → +3 (no match)
      const afterFirst = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_MARCH,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterFirst.state.players[0].movePoints).toBe(3);

      // Play second card sideways - Rage (red) with red mana → +4 (match)
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: CARD_RAGE,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      expect(afterSecond.state.players[0].movePoints).toBe(7); // 3 + 4
    });
  });

  describe("undo", () => {
    it("should be undoable and restore mana", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_GOLDYX_UNIVERSAL_POWER);
      expect(afterSkill.state.activeModifiers.length).toBeGreaterThan(0);
      expect(afterSkill.state.players[0].pureMana).toHaveLength(0);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_GOLDYX_UNIVERSAL_POWER);
      // Modifiers should be removed
      expect(
        afterUndo.state.activeModifiers.some(
          (m) =>
            m.source.type === "skill" &&
            m.source.skillId === SKILL_GOLDYX_UNIVERSAL_POWER
        )
      ).toBe(false);
      // Mana should be restored
      expect(afterUndo.state.players[0].pureMana).toHaveLength(1);
      expect(afterUndo.state.players[0].pureMana[0].color).toBe(MANA_RED);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when mana is available", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        })
      );
    });

    it("should not show skill when no mana is available", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [], // No mana
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });
      // Make sure no source dice have basic colors available
      const state = createTestGameState({
        players: [player],
        source: { dice: [] },
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
          })
        );
      }
    });

    it("should not show skill when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_GOLDYX_UNIVERSAL_POWER],
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
            skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
          })
        );
      }
    });

    it("should show enhanced sideways value in valid actions for matching card", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_RAGE],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const validActions = getValidActions(afterSkill.state, "player1");
      const rageCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_RAGE
      );

      expect(rageCard).toBeDefined();
      expect(rageCard?.sidewaysOptions).toBeDefined();
      // Should show value 4 for red card with red mana (matching)
      expect(rageCard?.sidewaysOptions?.[0]?.value).toBe(4);
    });

    it("should show +3 in valid actions for non-matching card", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
        hand: [CARD_MARCH],
        pureMana: [{ color: MANA_RED, source: "card" as const }],
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill with red mana
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_UNIVERSAL_POWER,
        manaSource: tokenMana(MANA_RED),
      });

      const validActions = getValidActions(afterSkill.state, "player1");
      const marchCard = validActions.playCard?.cards.find(
        (c) => c.cardId === CARD_MARCH
      );

      expect(marchCard).toBeDefined();
      expect(marchCard?.sidewaysOptions).toBeDefined();
      // Should show value 3 for green card with red mana (no match)
      expect(marchCard?.sidewaysOptions?.[0]?.value).toBe(3);
    });
  });

  describe("without skill activation", () => {
    it("should give default +1 when skill is not activated", () => {
      const player = createTestPlayer({
        hero: Hero.Goldyx,
        skills: [SKILL_GOLDYX_UNIVERSAL_POWER],
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
