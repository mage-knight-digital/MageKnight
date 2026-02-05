/**
 * Tests for I Feel No Pain skill (Tovak)
 *
 * Skill effect: Once a turn, except in combat: discard one Wound from hand.
 * If you do, draw a card.
 *
 * Key rules:
 * - Cannot be activated during combat
 * - Requires a Wound in hand to activate
 * - Discards the Wound to the wound pile (not healing)
 * - Draws one card from deck
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
  CARD_RAGE,
  CARD_WOUND,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_TOVAK_I_FEEL_NO_PAIN } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";

describe("I Feel No Pain skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("activation", () => {
    it("should activate skill when player has learned it and has wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
        })
      );
    });

    it("should add skill to usedThisTurn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND],
        deck: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_I_FEEL_NO_PAIN);
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
        hand: [CARD_WOUND],
        deck: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
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
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_FEEL_NO_PAIN], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND],
        deck: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("combat restriction", () => {
    it("should reject if player is in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });

      // Create a minimal combat state - just needs to be non-null to trigger the combat check
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
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not show skill in valid actions when in combat", () => {
      // The skill availability check happens in getSkillOptions which checks state.combat !== null.
      // Since the activation test above validates the combat rejection, we just need to verify
      // the valid actions logic by checking a simpler combat state setup.
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });

      // Create a minimal combat state - just needs to be non-null to trigger the check
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

      // Either skills is undefined or the skill is not in the list
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
          })
        );
      }
    });
  });

  describe("wound requirement", () => {
    it("should reject if no wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH], // No wound in hand
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should not show skill in valid actions when no wound in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_MARCH], // No wound in hand
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or the skill is not in the list
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
          })
        );
      }
    });
  });

  describe("effect", () => {
    it("should discard wound from hand and draw a card", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      const updatedPlayer = result.state.players[0];

      // Wound should be removed from hand
      expect(updatedPlayer.hand).not.toContain(CARD_WOUND);

      // Card should be drawn - hand now has CARD_MARCH and CARD_RAGE
      expect(updatedPlayer.hand).toContain(CARD_MARCH);
      expect(updatedPlayer.hand).toContain(CARD_RAGE);
      expect(updatedPlayer.hand).toHaveLength(2);

      // Deck should be empty (drew CARD_RAGE)
      expect(updatedPlayer.deck).toHaveLength(0);
    });

    it("should return wound to wound pile", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND],
        deck: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      // Wound pile should increase by 1
      expect(result.state.woundPileCount).toBe(11);
    });

    it("should handle unlimited wound pile", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND],
        deck: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: null, // Unlimited
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      // Wound pile should remain null (unlimited)
      expect(result.state.woundPileCount).toBeNull();
    });

    it("should work when deck is empty (no card drawn)", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [], // Empty deck
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      const updatedPlayer = result.state.players[0];

      // Wound should be removed from hand
      expect(updatedPlayer.hand).not.toContain(CARD_WOUND);

      // Hand should only have CARD_MARCH (no card drawn from empty deck)
      expect(updatedPlayer.hand).toEqual([CARD_MARCH]);

      // Wound pile should still increase
      expect(result.state.woundPileCount).toBe(11);
    });

    it("should only discard one wound when multiple wounds in hand", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_WOUND, CARD_MARCH], // Multiple wounds
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      const updatedPlayer = result.state.players[0];

      // One wound should remain in hand
      expect(updatedPlayer.hand.filter((c) => c === CARD_WOUND)).toHaveLength(1);

      // Card should be drawn
      expect(updatedPlayer.hand).toContain(CARD_RAGE);

      // Total hand size: 1 wound + 1 MARCH + 1 RAGE = 3
      expect(updatedPlayer.hand).toHaveLength(3);

      // Wound pile should increase by 1 only
      expect(result.state.woundPileCount).toBe(11);
    });
  });

  describe("undo", () => {
    it("should be undoable", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({
        players: [player],
        woundPileCount: 10,
      });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
      });

      // Verify skill was applied
      expect(
        afterSkill.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_TOVAK_I_FEEL_NO_PAIN);
      expect(afterSkill.state.players[0].hand).not.toContain(CARD_WOUND);
      expect(afterSkill.state.woundPileCount).toBe(11);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_TOVAK_I_FEEL_NO_PAIN);

      // Wound should be back in hand
      expect(afterUndo.state.players[0].hand).toContain(CARD_WOUND);

      // Wound pile should be restored
      expect(afterUndo.state.woundPileCount).toBe(10);

      // Card should be back in deck
      expect(afterUndo.state.players[0].deck).toContain(CARD_RAGE);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
        })
      );
    });

    it("should not show skill in valid actions when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [SKILL_TOVAK_I_FEEL_NO_PAIN],
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [SKILL_TOVAK_I_FEEL_NO_PAIN], // Already used
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Either skills is undefined or the skill is not in the list
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_TOVAK_I_FEEL_NO_PAIN,
          })
        );
      }
    });

    it("should not show skill if player has not learned it", () => {
      const player = createTestPlayer({
        hero: Hero.Tovak,
        skills: [], // No skills
        skillCooldowns: {
          usedThisRound: [],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
        hand: [CARD_WOUND, CARD_MARCH],
        deck: [CARD_RAGE],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");

      // Skills should be undefined since no skills are available
      expect(getSkillsFromValidActions(validActions)).toBeUndefined();
    });
  });
});
