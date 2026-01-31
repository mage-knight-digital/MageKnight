/**
 * Tests for I Don't Give a Damn skill (Tovak)
 *
 * Skill effect: One sideways card gives +2 instead of +1.
 * If it's an Advanced Action, Spell, or Artifact, it gives +3 instead.
 *
 * FAQ Rulings:
 * - S1: Cannot stack with Who Needs Magic, Universal Power, or Wolf's Howl
 * - S2: Hero-specific cards (Cold Toughness, etc.) are Basic Actions (+2, not +3)
 * - S3: Cannot be used with Wound cards
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
  CARD_BLOOD_RAGE,
  CARD_TREMOR,
  CARD_ENDLESS_BAG_OF_GOLD,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import {
  SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
  SKILL_TOVAK_WHO_NEEDS_MAGIC,
} from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { SOURCE_SKILL } from "../modifierConstants.js";
import type { CardId } from "@mage-knight/shared";

// Test card IDs for different card types
// These are real cards from the game data
const BASIC_ACTION_CARD = CARD_MARCH as CardId; // Basic Action
const ADVANCED_ACTION_CARD = CARD_BLOOD_RAGE as CardId; // Advanced Action
const SPELL_CARD = CARD_TREMOR as CardId; // Spell
const ARTIFACT_CARD = CARD_ENDLESS_BAG_OF_GOLD as CardId; // Artifact

describe("I Don't Give a Damn skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
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
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
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

    it("should reject if skill not learned", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [], // No skills learned
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
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

    it("should reject if skill already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN], // Already used
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

  describe("Basic Actions - sideways value +2", () => {
    it("should give +2 to Basic Action played sideways as Move", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [BASIC_ACTION_CARD],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play Basic Action card sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: BASIC_ACTION_CARD,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Should get +2 for Basic Action
      expect(afterSideways.state.players[0].movePoints).toBe(2);
    });

    it("should give +2 to Basic Action played sideways as Influence", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [BASIC_ACTION_CARD],
        influencePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play Basic Action card sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: BASIC_ACTION_CARD,
        as: PLAY_SIDEWAYS_AS_INFLUENCE,
      });

      // Should get +2 for Basic Action
      expect(afterSideways.state.players[0].influencePoints).toBe(2);
    });
  });

  describe("Advanced Actions - sideways value +3", () => {
    it("should give +3 to Advanced Action played sideways as Move", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [ADVANCED_ACTION_CARD],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play Advanced Action card sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: ADVANCED_ACTION_CARD,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Should get +3 for Advanced Action
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Spells - sideways value +3", () => {
    it("should give +3 to Spell played sideways as Move", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [SPELL_CARD],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play Spell card sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: SPELL_CARD,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Should get +3 for Spell
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("Artifacts - sideways value +3", () => {
    it("should give +3 to Artifact played sideways as Move", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [ARTIFACT_CARD],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Play Artifact card sideways
      const afterSideways = engine.processAction(afterSkill.state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: ARTIFACT_CARD,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Should get +3 for Artifact
      expect(afterSideways.state.players[0].movePoints).toBe(3);
    });
  });

  describe("skill exclusion group", () => {
    it("should reject activating I Don't Give a Damn when Who Needs Magic is already active", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN, SKILL_TOVAK_WHO_NEEDS_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      // First activate Who Needs Magic
      const afterFirst = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
      });

      expect(afterFirst.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
        })
      );

      // Now try to activate I Don't Give a Damn - should fail
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(afterSecond.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject activating Who Needs Magic when I Don't Give a Damn is already active", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN, SKILL_TOVAK_WHO_NEEDS_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      // First activate I Don't Give a Damn
      const afterFirst = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      expect(afterFirst.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
        })
      );

      // Now try to activate Who Needs Magic - should fail
      const afterSecond = engine.processAction(afterFirst.state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC,
      });

      expect(afterSecond.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not show conflicting skill in valid actions when another is active", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN, SKILL_TOVAK_WHO_NEEDS_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      // Before activation - both should be available
      const validActionsBefore = getValidActions(state, "player1");
      expect(validActionsBefore.skills?.activatable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN })
      );
      expect(validActionsBefore.skills?.activatable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC })
      );

      // Activate I Don't Give a Damn
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // After activation - Who Needs Magic should not be available
      const validActionsAfter = getValidActions(afterSkill.state, "player1");
      if (validActionsAfter.skills) {
        expect(validActionsAfter.skills.activatable).not.toContainEqual(
          expect.objectContaining({ skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC })
        );
      }
    });
  });

  describe("undo", () => {
    it("should be undoable", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
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
            m.source.type === SOURCE_SKILL &&
            m.source.skillId === SKILL_TOVAK_I_DONT_GIVE_A_DAMN
        )
      ).toBe(false);
    });

    it("should restore conflict availability after undo", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN, SKILL_TOVAK_WHO_NEEDS_MAGIC],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      // Activate I Don't Give a Damn
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
      });

      // Who Needs Magic should not be available
      const validActionsDuring = getValidActions(afterSkill.state, "player1");
      if (validActionsDuring.skills) {
        expect(validActionsDuring.skills.activatable).not.toContainEqual(
          expect.objectContaining({ skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC })
        );
      }

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Both skills should be available again
      const validActionsAfter = getValidActions(afterUndo.state, "player1");
      expect(validActionsAfter.skills?.activatable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN })
      );
      expect(validActionsAfter.skills?.activatable).toContainEqual(
        expect.objectContaining({ skillId: SKILL_TOVAK_WHO_NEEDS_MAGIC })
      );
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      expect(validActions.skills).toBeDefined();
      expect(validActions.skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or the skill is not in the list
      if (validActions.skills) {
        expect(validActions.skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_I_DONT_GIVE_A_DAMN,
          })
        );
      }
    });
  });

  describe("without skill active", () => {
    it("should only give +1 to sideways card when skill is not active", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [BASIC_ACTION_CARD],
        movePoints: 0,
      });
      const state = createTestGameState({ players: [player] });

      // Play card sideways WITHOUT activating skill
      const afterSideways = engine.processAction(state, "player1", {
        type: PLAY_CARD_SIDEWAYS_ACTION,
        cardId: BASIC_ACTION_CARD,
        as: PLAY_SIDEWAYS_AS_MOVE,
      });

      // Should only get +1 (default)
      expect(afterSideways.state.players[0].movePoints).toBe(1);
    });
  });

  describe("multiple sideways plays", () => {
    it("should apply bonus to all sideways cards played after activation", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_DONT_GIVE_A_DAMN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
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
});
