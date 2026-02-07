/**
 * Tests for Prayer of Weather skill (Norowas)
 *
 * Skill effect: Once per round, not in combat: The move cost of all terrains is
 * reduced by 2 (min 1) for you this turn. Put this in the center. Any other
 * player may return it face down to reduce terrain costs by 1 (min 1) on their turn.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  UNDO_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  CARD_MARCH,
  TERRAIN_PLAINS,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_NOROWAS_PRAYER_OF_WEATHER } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { getEffectiveTerrainCost } from "../modifiers/terrain.js";
import {
  EFFECT_TERRAIN_COST,
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

describe("Prayer of Weather skill (Norowas)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("owner activation", () => {
    it("reduces terrain costs by 2 (min 1) for the activating player", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
        })
      );

      // Plains: 2 - 2 = 0 → clamped to min 1
      const plainsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_PLAINS,
        "player1"
      );
      expect(plainsCost).toBe(1);

      // Forest (day): 3 - 2 = 1
      const forestCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_FOREST,
        "player1"
      );
      expect(forestCost).toBe(1);

      // Hills (day): 3 - 2 = 1
      const hillsCost = getEffectiveTerrainCost(
        result.state,
        TERRAIN_HILLS,
        "player1"
      );
      expect(hillsCost).toBe(1);
    });

    it("places the skill in the center with marker modifiers", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Should have a center marker modifier for this skill (from PLACE_SKILL_IN_CENTER)
      const centerModifiers = result.state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER
      );

      // Center marker modifier exists (the self -2 modifier uses SOURCE_CARD from EFFECT_APPLY_MODIFIER)
      expect(centerModifiers.length).toBeGreaterThanOrEqual(1);

      // Center marker is a terrain cost modifier with amount 0
      const centerMarker = centerModifiers.find(
        (m) =>
          m.effect.type === EFFECT_TERRAIN_COST &&
          (m.effect as { amount?: number }).amount === 0
      );
      expect(centerMarker).toBeDefined();
    });

    it("is once per round (goes on cooldown)", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Skill should be on round cooldown
      expect(
        result.state.players[0]!.skillCooldowns.usedThisRound
      ).toContain(SKILL_NOROWAS_PRAYER_OF_WEATHER);
    });

    it("cannot be used during combat", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const combat = {
        enemies: [],
        phase: "ranged_siege" as const,
        combatType: "standard" as const,
        fortifiedSite: null,
        unitsAllowed: true,
        goldManaAllowed: true,
        defeatedEnemies: [],
        damageAssignments: [],
        blockAssignments: [],
        pendingDamage: [],
        enemyAssignments: null,
      };
      const state = createTestGameState({
        players: [player],
        combat,
      });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("valid actions", () => {
    it("shows Prayer of Weather as activatable when learned and not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      expect(validActions.mode).toBe("normal_turn");
      if (validActions.mode === "normal_turn") {
        expect(validActions.skills).toBeDefined();
        expect(validActions.skills!.activatable).toContainEqual(
          expect.objectContaining({
            skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
          })
        );
      }
    });

    it("does not show Prayer of Weather when on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisRound: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      if (validActions.mode === "normal_turn") {
        const skillOptions = validActions.skills;
        if (skillOptions) {
          expect(skillOptions.activatable).not.toContainEqual(
            expect.objectContaining({
              skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
            })
          );
        }
      }
    });
  });

  describe("other player return mechanic", () => {
    function createTwoPlayerState() {
      const norowas = createTestPlayer({
        id: "player1",
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const otherPlayer = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        hand: [CARD_MARCH],
      });
      return createTestGameState({
        players: [norowas, otherPlayer],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 0,
      });
    }

    it("allows another player to return the skill for -1 terrain cost", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Switch to player 2's turn
      const stateForPlayer2 = {
        ...afterActivation.state,
        currentPlayerIndex: 1,
      };

      // Player 2 returns the skill
      const afterReturn = engine.processAction(stateForPlayer2, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      expect(afterReturn.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
        })
      );

      // Player 2 should have -1 terrain cost (min 1)
      // Plains: 2 - 1 = 1
      const plainsCost = getEffectiveTerrainCost(
        afterReturn.state,
        TERRAIN_PLAINS,
        "player2"
      );
      expect(plainsCost).toBe(1);

      // Forest (day): 3 - 1 = 2
      const forestCost = getEffectiveTerrainCost(
        afterReturn.state,
        TERRAIN_FOREST,
        "player2"
      );
      expect(forestCost).toBe(2);

      // Hills (day): 3 - 1 = 2
      const hillsCost = getEffectiveTerrainCost(
        afterReturn.state,
        TERRAIN_HILLS,
        "player2"
      );
      expect(hillsCost).toBe(2);
    });

    it("flips the skill face-down on Norowas when returned", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Switch to player 2's turn
      const stateForPlayer2 = {
        ...afterActivation.state,
        currentPlayerIndex: 1,
      };

      // Player 2 returns the skill
      const afterReturn = engine.processAction(stateForPlayer2, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Norowas (player1) should have the skill flipped face-down
      expect(
        afterReturn.state.players[0]!.skillFlipState.flippedSkills
      ).toContain(SKILL_NOROWAS_PRAYER_OF_WEATHER);
    });

    it("removes center modifiers after the skill is returned", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Switch to player 2's turn
      const stateForPlayer2 = {
        ...afterActivation.state,
        currentPlayerIndex: 1,
      };

      // Player 2 returns the skill
      const afterReturn = engine.processAction(stateForPlayer2, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // No center marker modifiers should remain from the prayer skill owner
      const centerModifiers = afterReturn.state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER &&
          m.createdByPlayerId === "player1" &&
          (m.effect as { amount?: number }).amount === 0
      );
      expect(centerModifiers).toHaveLength(0);
    });

    it("shows returnable skills in valid actions for non-owner player", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Switch to player 2's turn
      const stateForPlayer2 = {
        ...afterActivation.state,
        currentPlayerIndex: 1,
      };

      // Check valid actions for player 2
      const validActions = getValidActions(stateForPlayer2, "player2");
      expect(validActions.mode).toBe("normal_turn");
      if (validActions.mode === "normal_turn") {
        expect(validActions.returnableSkills).toBeDefined();
        expect(validActions.returnableSkills!.returnable).toContainEqual(
          expect.objectContaining({
            skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
          })
        );
      }
    });

    it("does not show returnable skills to the skill owner", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Check valid actions for player 1 (owner)
      const validActions = getValidActions(afterActivation.state, "player1");
      if (validActions.mode === "normal_turn") {
        const returnableSkills = validActions.returnableSkills;
        // Owner should not see their own skill as returnable
        if (returnableSkills) {
          expect(returnableSkills.returnable).not.toContainEqual(
            expect.objectContaining({
              skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
            })
          );
        }
      }
    });

    it("rejects return by the skill owner", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Norowas tries to return their own skill
      const result = engine.processAction(afterActivation.state, "player1", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("rejects return when skill is not in center", () => {
      const norowas = createTestPlayer({
        id: "player1",
        hero: Hero.Norowas,
        skills: [SKILL_NOROWAS_PRAYER_OF_WEATHER],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const otherPlayer = createTestPlayer({
        id: "player2",
        hero: Hero.Arythea,
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({
        players: [norowas, otherPlayer],
        turnOrder: ["player1", "player2"],
        currentPlayerIndex: 1,
      });

      // Player 2 tries to return a skill that's not in center
      const result = engine.processAction(state, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("can be undone: restores center modifiers, terrain costs, and flip state", () => {
      const state = createTwoPlayerState();

      // Norowas activates Prayer of Weather
      const afterActivation = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Switch to player 2's turn
      const stateForPlayer2 = {
        ...afterActivation.state,
        currentPlayerIndex: 1,
      };

      // Count center modifiers before return
      const centerModsBefore = stateForPlayer2.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER
      );

      // Player 2 returns the skill
      const afterReturn = engine.processAction(stateForPlayer2, "player2", {
        type: RETURN_INTERACTIVE_SKILL_ACTION,
        skillId: SKILL_NOROWAS_PRAYER_OF_WEATHER,
      });

      // Verify the return took effect
      expect(
        afterReturn.state.players[0]!.skillFlipState.flippedSkills
      ).toContain(SKILL_NOROWAS_PRAYER_OF_WEATHER);

      // Undo the return
      const afterUndo = engine.processAction(afterReturn.state, "player2", {
        type: UNDO_ACTION,
      });

      // Center modifiers should be restored
      const centerModsAfterUndo = afterUndo.state.activeModifiers.filter(
        (m) =>
          m.source.type === SOURCE_SKILL &&
          m.source.skillId === SKILL_NOROWAS_PRAYER_OF_WEATHER
      );
      expect(centerModsAfterUndo.length).toBe(centerModsBefore.length);

      // Skill should no longer be flipped face-down on Norowas
      expect(
        afterUndo.state.players[0]!.skillFlipState.flippedSkills
      ).not.toContain(SKILL_NOROWAS_PRAYER_OF_WEATHER);

      // Player 2 should no longer have the -1 terrain cost benefit
      const plainsCost = getEffectiveTerrainCost(
        afterUndo.state,
        TERRAIN_PLAINS,
        "player2"
      );
      expect(plainsCost).toBe(2); // Back to default
    });
  });
});
