/**
 * Tests for Flight skill (Goldyx)
 *
 * Skill effect: Once a round, flip this to move to an adjacent space for free,
 * or to move two spaces for 2 Move points. You must end this move in a safe
 * space. This move does not provoke rampaging enemies.
 *
 * Key rules:
 * - Choice between 1 space free (option 0) or 2 spaces for 2 Move (option 1)
 * - Can fly over mountains, lakes, unconquered fortified sites
 * - Does NOT provoke rampaging enemies
 * - Must end in safe space (cannot end on lake/mountain without other abilities)
 * - Once per round (flip to activate)
 * - Interacts correctly with Space Bending modifier
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  MOVE_ACTION,
  SKILL_USED,
  TERRAIN_PLAINS,
  TERRAIN_MOUNTAIN,
  TERRAIN_LAKE,
  TERRAIN_FOREST,
  CARD_MARCH,
  hexKey,
  getSkillsFromValidActions,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_GOLDYX_FLIGHT } from "../../data/skills/index.js";
import { getValidActions } from "../validActions/index.js";
import { getValidMoveTargets } from "../validActions/movement.js";
import {
  getEffectiveTerrainCost,
  isTerrainSafe,
  isRuleActive,
} from "../modifiers/index.js";
import { RULE_IGNORE_RAMPAGING_PROVOKE } from "../../types/modifierConstants.js";
import { RampagingEnemyType } from "../../types/map.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import type { HexState } from "../../types/map.js";

describe("Flight skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  /**
   * Create a state with a map that includes mountains, lakes, and plains
   * for testing flight movement over obstacles.
   */
  function createFlightTestState(
    playerOverrides: Partial<ReturnType<typeof createTestPlayer>> = {},
    hexOverrides: Record<string, HexState> = {}
  ) {
    const player = createTestPlayer({
      hero: Hero.Goldyx,
      skills: [SKILL_GOLDYX_FLIGHT],
      skillCooldowns: {
        usedThisRound: [],
        usedThisTurn: [],
        usedThisCombat: [],
        activeUntilNextTurn: [],
      },
      hand: [CARD_MARCH],
      movePoints: 0,
      ...playerOverrides,
    });

    const hexes: Record<string, HexState> = {
      [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_MOUNTAIN),
      [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_LAKE),
      [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_PLAINS),
      [hexKey({ q: 1, r: -1 })]: createTestHex(1, -1, TERRAIN_FOREST),
      [hexKey({ q: -1, r: 1 })]: createTestHex(-1, 1, TERRAIN_PLAINS),
      // Distance-2 hexes for extended move tests
      [hexKey({ q: 2, r: 0 })]: createTestHex(2, 0, TERRAIN_PLAINS),
      [hexKey({ q: 2, r: -1 })]: createTestHex(2, -1, TERRAIN_PLAINS),
      ...hexOverrides,
    };

    return createTestGameState({
      players: [player],
      map: {
        hexes,
        tiles: [],
        tileDeck: { countryside: [], core: [] },
        tileSlots: {},
      },
    });
  }

  describe("activation", () => {
    it("should present choice between free move and extended move", () => {
      const state = createFlightTestState();

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SKILL_USED,
          playerId: "player1",
          skillId: SKILL_GOLDYX_FLIGHT,
        })
      );

      // Should have a pending choice with 2 options
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should add to round cooldown after activation", () => {
      const state = createFlightTestState();

      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });

      expect(result.state.players[0].skillCooldowns.usedThisRound).toContain(
        SKILL_GOLDYX_FLIGHT
      );
    });
  });

  describe("option 1: free adjacent move", () => {
    it("should grant 1 move point with all terrain free", () => {
      const state = createFlightTestState();

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });

      // Choose option 0 (free adjacent move)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have 1 move point
      expect(afterChoice.state.players[0].movePoints).toBe(1);

      // All terrain should cost 0
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_MOUNTAIN, "player1")
      ).toBe(0);
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_LAKE, "player1")
      ).toBe(0);
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_PLAINS, "player1")
      ).toBe(0);
    });

    it("should allow flying over mountain to adjacent hex", () => {
      const state = createFlightTestState();

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Mountain hex (1,0) should now be a valid move target
      const player = afterChoice.state.players[0];
      const moveOptions = getValidMoveTargets(afterChoice.state, player);

      expect(moveOptions).toBeDefined();
      expect(moveOptions?.targets).toContainEqual(
        expect.objectContaining({
          hex: { q: 1, r: 0 },
          cost: 0,
        })
      );
    });

    it("should not provoke rampaging enemies", () => {
      const state = createFlightTestState();

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Verify the ignore rampaging rule is active
      expect(
        isRuleActive(
          afterChoice.state,
          "player1",
          RULE_IGNORE_RAMPAGING_PROVOKE
        )
      ).toBe(true);
    });
  });

  describe("option 2: extended move (2 spaces for 2 Move)", () => {
    it("should grant 2 move points with all terrain costing 1", () => {
      const state = createFlightTestState();

      // Activate skill
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });

      // Choose option 1 (extended move)
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have 2 move points
      expect(afterChoice.state.players[0].movePoints).toBe(2);

      // All terrain should cost 1
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_MOUNTAIN, "player1")
      ).toBe(1);
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_LAKE, "player1")
      ).toBe(1);
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_PLAINS, "player1")
      ).toBe(1);
      expect(
        getEffectiveTerrainCost(afterChoice.state, TERRAIN_FOREST, "player1")
      ).toBe(1);
    });

    it("should allow moving 2 spaces through mountain", () => {
      const state = createFlightTestState();

      // Activate skill and choose extended move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Move to mountain hex (1,0) — costs 1 move point
      const afterMove1 = engine.processAction(afterChoice.state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });

      expect(afterMove1.state.players[0].position).toEqual({ q: 1, r: 0 });
      expect(afterMove1.state.players[0].movePoints).toBe(1);

      // Move to plains hex (2,0) — costs 1 more move point
      const afterMove2 = engine.processAction(afterMove1.state, "player1", {
        type: MOVE_ACTION,
        target: { q: 2, r: 0 },
      });

      expect(afterMove2.state.players[0].position).toEqual({ q: 2, r: 0 });
      expect(afterMove2.state.players[0].movePoints).toBe(0);
    });

    it("should require exactly 2 move points for 2 spaces", () => {
      const state = createFlightTestState();

      // Activate skill and choose extended move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // After 2 moves (each costing 1), should have 0 move points left
      const afterMove1 = engine.processAction(afterChoice.state, "player1", {
        type: MOVE_ACTION,
        target: { q: -1, r: 0 },
      });
      const afterMove2 = engine.processAction(afterMove1.state, "player1", {
        type: MOVE_ACTION,
        target: { q: -1, r: 1 },
      });

      expect(afterMove2.state.players[0].movePoints).toBe(0);
    });
  });

  describe("rampaging enemy interaction", () => {
    it("should not provoke rampaging enemy when flying past", () => {
      // Set up a rampaging enemy adjacent to both from and to hexes
      const rampagingHex: HexState = {
        ...createTestHex(0, -1, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [{ tokenId: "orc_marauder_1" as EnemyTokenId, color: "green", isRevealed: true }],
      };

      const state = createFlightTestState(
        {},
        {
          [hexKey({ q: 0, r: -1 })]: rampagingHex,
        }
      );

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Move from (0,0) to (1,-1) — both adjacent to rampaging hex (0,-1)
      // Normally this would provoke, but Flight ignores rampaging
      const afterMove = engine.processAction(afterChoice.state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Should have moved without triggering combat
      expect(afterMove.state.players[0].position).toEqual({ q: 1, r: -1 });
      expect(afterMove.state.combat).toBeNull();
    });
  });

  describe("safe space requirement", () => {
    it("should not mark mountains as safe (cannot end on mountain)", () => {
      const state = createFlightTestState();

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Mountains should NOT be safe spaces (can fly over, not land)
      expect(
        isTerrainSafe(afterChoice.state, "player1", TERRAIN_MOUNTAIN)
      ).toBe(false);
    });

    it("should not mark lakes as safe (cannot end on lake)", () => {
      const state = createFlightTestState();

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Lakes should NOT be safe spaces
      expect(
        isTerrainSafe(afterChoice.state, "player1", TERRAIN_LAKE)
      ).toBe(false);
    });
  });

  describe("valid actions", () => {
    it("should show skill in valid actions when available", () => {
      const state = createFlightTestState();

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      expect(skills).toBeDefined();
      expect(skills?.activatable).toContainEqual(
        expect.objectContaining({
          skillId: SKILL_GOLDYX_FLIGHT,
        })
      );
    });

    it("should not show skill when on round cooldown", () => {
      const state = createFlightTestState({
        skillCooldowns: {
          usedThisRound: [SKILL_GOLDYX_FLIGHT],
          usedThisTurn: [],
          usedThisCombat: [],
          activeUntilNextTurn: [],
        },
      });

      const validActions = getValidActions(state, "player1");
      const skills = getSkillsFromValidActions(validActions);

      if (skills) {
        expect(skills.activatable).not.toContainEqual(
          expect.objectContaining({
            skillId: SKILL_GOLDYX_FLIGHT,
          })
        );
      }
    });

    it("should show mountain as valid move target after flight activation", () => {
      // Without flight, mountain should not be in valid move targets
      const stateWithMovePoints = createFlightTestState({ movePoints: 4, skills: [] });
      const player0 = stateWithMovePoints.players[0];
      const beforeMove = getValidMoveTargets(stateWithMovePoints, player0);
      const mountainTargetBefore = beforeMove?.targets.find(
        (t) => t.hex.q === 1 && t.hex.r === 0
      );
      expect(mountainTargetBefore).toBeUndefined();

      // Activate flight and choose free move
      const state = createFlightTestState();
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Mountain should now be a valid target
      const playerAfter = afterChoice.state.players[0];
      const afterMove = getValidMoveTargets(afterChoice.state, playerAfter);
      const mountainTargetAfter = afterMove?.targets.find(
        (t) => t.hex.q === 1 && t.hex.r === 0
      );
      expect(mountainTargetAfter).toBeDefined();
      expect(mountainTargetAfter?.cost).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("should work with existing move points (option 1 adds 1 more)", () => {
      const state = createFlightTestState({ movePoints: 3 });

      // Activate skill and choose free move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      });

      // Should have original 3 + 1 from flight = 4
      expect(afterChoice.state.players[0].movePoints).toBe(4);
    });

    it("should work with existing move points (option 2 adds 2 more)", () => {
      const state = createFlightTestState({ movePoints: 3 });

      // Activate skill and choose extended move
      const afterSkill = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_GOLDYX_FLIGHT,
      });
      const afterChoice = engine.processAction(afterSkill.state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      });

      // Should have original 3 + 2 from flight = 5
      expect(afterChoice.state.players[0].movePoints).toBe(5);
    });
  });
});
