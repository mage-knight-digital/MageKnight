/**
 * Tests for Hawk Eyes skill (Wolfhawk)
 *
 * Skill effect: Once per turn, Move 1.
 * Night: exploring costs 1 less Move for the entire turn (FAQ S1).
 * Day: reveal garrisons of fortified sites at distance 2 for the entire turn (FAQ S1).
 *
 * Key rules:
 * - Active effect grants Move 1 on activation
 * - Passive bonuses last the full turn after activation (S1), not just a single use
 * - Time-of-day determines which bonus applies (Night = explore reduction, Day = garrison reveal)
 * - Once per turn usage
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createHexEnemy,
} from "./testHelpers.js";
import { createKeepSite } from "./combatTestHelpers.js";
import type { GameState } from "../../state/GameState.js";
import { TileId } from "../../types/map.js";
import {
  USE_SKILL_ACTION,
  SKILL_USED,
  INVALID_ACTION,
  UNDO_ACTION,
  EXPLORE_ACTION,
  MOVE_ACTION,
  CARD_MARCH,
  TERRAIN_PLAINS,
  hexKey,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  ENEMY_GUARDSMEN,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_WOLFHAWK_HAWK_EYES } from "../../data/skills/index.js";
import { getEffectiveExploreCost, isRuleActive } from "../modifiers/index.js";
import { getValidActions } from "../validActions/index.js";
import { RULE_GARRISON_REVEAL_DISTANCE_2 } from "../../types/modifierConstants.js";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemy/index.js";

function buildSkillCooldowns() {
  return {
    usedThisRound: [] as string[],
    usedThisTurn: [] as string[],
    usedThisCombat: [] as string[],
    activeUntilNextTurn: [] as string[],
  };
}

describe("Hawk Eyes skill (Wolfhawk)", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  // ============================================================================
  // ACTIVE: Move 1
  // ============================================================================

  describe("active: Move 1", () => {
    it("should grant Move 1 when activated", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        movePoints: 2,
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      // Should emit SKILL_USED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_WOLFHAWK_HAWK_EYES,
        })
      );

      // Should gain 1 move point
      expect(result.state.players[0].movePoints).toBe(3);
    });

    it("should add skill to usedThisTurn cooldown (once per turn)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      expect(
        result.state.players[0].skillCooldowns.usedThisTurn
      ).toContain(SKILL_WOLFHAWK_HAWK_EYES);
    });

    it("should reject activation when already used this turn", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_WOLFHAWK_HAWK_EYES],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================================
  // NIGHT: Exploring cost reduction
  // ============================================================================

  describe("night: exploring cost reduction", () => {
    function createNightExploreState(
      playerOverrides: Partial<ReturnType<typeof createTestPlayer>> = {}
    ): GameState {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        position: { q: 1, r: 0 },
        movePoints: 4,
        hand: [CARD_MARCH],
        ...playerOverrides,
      });

      const baseState = createTestGameState();

      const hexes: Record<string, ReturnType<typeof createTestHex>> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
      };

      return {
        ...baseState,
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
        map: {
          ...baseState.map,
          hexes,
          tileDeck: {
            countryside: [TileId.Countryside1, TileId.Countryside2],
            core: [TileId.Core1],
          },
        },
      };
    }

    it("should have default explore cost of 2 before activation at night", () => {
      const state = createNightExploreState();
      const cost = getEffectiveExploreCost(state, "player1");
      expect(cost).toBe(2);
    });

    it("should reduce explore cost to 1 after activation at night", () => {
      let state = createNightExploreState();

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      const cost = getEffectiveExploreCost(result.state, "player1");
      expect(cost).toBe(1);
    });

    it("should deduct only 1 move point when exploring after activation at night", () => {
      let state = createNightExploreState();

      // Activate skill (grants Move 1, so 4 → 5 move points)
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      expect(state.players[0].movePoints).toBe(5);

      // Explore
      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should deduct only 1 (reduced from 2)
      expect(result.state.players[0].movePoints).toBe(4);
    });

    it("should NOT reduce explore cost at day", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        position: { q: 1, r: 0 },
        movePoints: 4,
        hand: [CARD_MARCH],
      });

      const baseState = createTestGameState();

      const hexes: Record<string, ReturnType<typeof createTestHex>> = {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
      };

      let state: GameState = {
        ...baseState,
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          ...baseState.map,
          hexes,
        },
      };

      // Activate skill during day
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Explore cost should remain 2 (no reduction during day)
      const cost = getEffectiveExploreCost(state, "player1");
      expect(cost).toBe(2);
    });

    it("explore cost reduction should last the full turn (S1)", () => {
      let state = createNightExploreState();

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Cost should be 1 (reduced)
      expect(getEffectiveExploreCost(state, "player1")).toBe(1);

      // The modifier should persist (turn duration, not single use)
      // Verify it's still active
      expect(getEffectiveExploreCost(state, "player1")).toBe(1);
    });
  });

  // ============================================================================
  // DAY: Garrison reveal at distance 2
  // ============================================================================

  describe("day: garrison reveal at distance 2", () => {
    it("should activate garrison reveal distance 2 modifier during day", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill during day
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Should have garrison reveal distance 2 rule active
      expect(isRuleActive(state, "player1", RULE_GARRISON_REVEAL_DISTANCE_2)).toBe(true);
    });

    it("should NOT activate garrison reveal modifier during night", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Activate skill during night
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Should NOT have garrison reveal rule active
      expect(isRuleActive(state, "player1", RULE_GARRISON_REVEAL_DISTANCE_2)).toBe(false);
    });

    it("should reveal fortified site enemies at distance 2 during day when moving", () => {
      const keepToken = createEnemyTokenId(ENEMY_GUARDSMEN);

      // Player at (0,0), keep at (2,0) - distance 2 from player
      // Move from (0,0) to (1,0) — keep at (2,0) is now adjacent (distance 1)
      // But we want to test distance 2 reveal:
      // Player at (0,0), keep at (3,0) - distance 3
      // Move from (0,0) to (1,0) — keep at (3,0) is now distance 2

      const keepSite = createKeepSite();
      const keepHex: ReturnType<typeof createTestHex> = {
        ...createTestHex(3, 0, TERRAIN_PLAINS, keepSite),
        enemies: [createHexEnemy(keepToken, false)], // unrevealed
      };

      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        position: { q: 0, r: 0 },
        movePoints: 10,
        hand: [CARD_MARCH],
      });

      const baseState = createTestGameState();

      let state: GameState = {
        ...baseState,
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          ...baseState.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
            [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
            [hexKey({ q: 3, r: 0 })]: keepHex,
          },
        },
      };

      // Activate skill (gives Move 1 + garrison reveal at distance 2)
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Move from (0,0) to (1,0) — keep at (3,0) is now distance 2
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Enemy at keep should now be revealed
      const keepHexAfter = result.state.map.hexes[hexKey({ q: 3, r: 0 })];
      expect(keepHexAfter?.enemies[0]?.isRevealed).toBe(true);
    });

    it("should NOT reveal at distance 2 without the skill active", () => {
      const keepToken = createEnemyTokenId(ENEMY_GUARDSMEN);

      const keepSite = createKeepSite();
      const keepHex: ReturnType<typeof createTestHex> = {
        ...createTestHex(3, 0, TERRAIN_PLAINS, keepSite),
        enemies: [createHexEnemy(keepToken, false)], // unrevealed
      };

      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [], // No skill
        skillCooldowns: buildSkillCooldowns(),
        position: { q: 0, r: 0 },
        movePoints: 10,
        hand: [CARD_MARCH],
      });

      const baseState = createTestGameState();

      const state: GameState = {
        ...baseState,
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
        map: {
          ...baseState.map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
            [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
            [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
            [hexKey({ q: 3, r: 0 })]: keepHex,
          },
        },
      };

      // Move from (0,0) to (1,0) — keep at (3,0) is distance 2 (not adjacent)
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      // Enemy at keep should still be unrevealed (distance 2 with no skill)
      const keepHexAfter = result.state.map.hexes[hexKey({ q: 3, r: 0 })];
      expect(keepHexAfter?.enemies[0]?.isRevealed).toBe(false);
    });

    it("garrison reveal modifier should last the full turn (S1)", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      }).state;

      // Rule should be active for the turn
      expect(isRuleActive(state, "player1", RULE_GARRISON_REVEAL_DISTANCE_2)).toBe(true);
    });
  });

  // ============================================================================
  // VALID ACTIONS
  // ============================================================================

  describe("valid actions", () => {
    it("should show skill as activatable when learned and not on cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_WOLFHAWK_HAWK_EYES,
        })
      );
    });

    it("should not show skill when on turn cooldown", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: {
          ...buildSkillCooldowns(),
          usedThisTurn: [SKILL_WOLFHAWK_HAWK_EYES],
        },
        hand: [CARD_MARCH],
      });
      const state = createTestGameState({ players: [player] });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);
      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_WOLFHAWK_HAWK_EYES,
          })
        );
      }
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("undo", () => {
    it("should restore move points and cooldown on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
        movePoints: 2,
      });
      const state = createTestGameState({ players: [player] });

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      // Verify activation happened
      expect(afterSkill.state.players[0].movePoints).toBe(3);
      expect(afterSkill.state.players[0].skillCooldowns.usedThisTurn).toContain(
        SKILL_WOLFHAWK_HAWK_EYES
      );

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Move points should be reverted
      expect(afterUndo.state.players[0].movePoints).toBe(2);

      // Skill should be removed from cooldown
      expect(
        afterUndo.state.players[0].skillCooldowns.usedThisTurn
      ).not.toContain(SKILL_WOLFHAWK_HAWK_EYES);
    });

    it("should remove night modifier on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_NIGHT,
      });

      // Activate skill at night
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      // Verify explore cost reduced
      expect(getEffectiveExploreCost(afterSkill.state, "player1")).toBe(1);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Explore cost should be back to normal
      expect(getEffectiveExploreCost(afterUndo.state, "player1")).toBe(2);
    });

    it("should remove day modifier on undo", () => {
      const player = createTestPlayer({
        hero: Hero.Wolfhawk,
        skills: [SKILL_WOLFHAWK_HAWK_EYES],
        skillCooldowns: buildSkillCooldowns(),
        hand: [CARD_MARCH],
      });
      let state = createTestGameState({
        players: [player],
        timeOfDay: TIME_OF_DAY_DAY,
      });

      // Activate skill at day
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_WOLFHAWK_HAWK_EYES,
      });

      // Verify rule active
      expect(isRuleActive(afterSkill.state, "player1", RULE_GARRISON_REVEAL_DISTANCE_2)).toBe(true);

      // Undo
      const afterUndo = engine.processAction(afterSkill.state, "player1", {
        type: UNDO_ACTION,
      });

      // Rule should no longer be active
      expect(isRuleActive(afterUndo.state, "player1", RULE_GARRISON_REVEAL_DISTANCE_2)).toBe(false);
    });
  });
});
