/**
 * Tests for Feral Allies skill (Braevalar)
 *
 * Passive: Exploring costs 1 less Move for all tiles explored.
 * Active (once per turn): Attack 1 (physical, melee) OR reduce enemy attack by 1.
 *
 * Key rules:
 * - Passive exploring reduction applies for the entire turn, every tile (Q1)
 * - Active is once per turn
 * - Attack reduction works on Arcane Immune enemies (S2)
 * - Attack reduction is attack modification (before Brutal doubling)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";
import { TileId } from "../../types/map.js";
import {
  USE_SKILL_ACTION,
  RESOLVE_CHOICE_ACTION,
  EXPLORE_ACTION,
  ENTER_COMBAT_ACTION,
  INVALID_ACTION,
  TERRAIN_PLAINS,
  hexKey,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMY_ORC_SKIRMISHERS,
} from "@mage-knight/shared";
import { Hero } from "../../types/hero.js";
import { SKILL_BRAEVALAR_FERAL_ALLIES } from "../../data/skills/index.js";
import { getEffectiveExploreCost } from "../modifiers/index.js";
import { getEffectiveEnemyAttack } from "../modifiers/combat.js";
import { getValidExploreOptions } from "../validActions/exploration.js";

describe("Feral Allies skill", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  // ============================================================================
  // PASSIVE: Exploring cost reduction
  // ============================================================================

  describe("passive: exploring cost reduction", () => {
    function createExploreState(
      playerOverrides: Partial<ReturnType<typeof createTestPlayer>> = {}
    ): GameState {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        position: { q: 1, r: 0 },
        movePoints: 4,
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

    it("should reduce effective explore cost from 2 to 1", () => {
      const state = createExploreState();
      const cost = getEffectiveExploreCost(state, "player1");
      expect(cost).toBe(1);
    });

    it("should have default explore cost of 2 without the skill", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [],
        position: { q: 1, r: 0 },
        movePoints: 4,
      });
      const state = createTestGameState({ players: [player] });
      const cost = getEffectiveExploreCost(state, "player1");
      expect(cost).toBe(2);
    });

    it("should deduct only 1 move point when exploring with skill", () => {
      const state = createExploreState();
      expect(state.players[0]?.movePoints).toBe(4);

      const result = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });

      // Should deduct 1 instead of 2
      expect(result.state.players[0]?.movePoints).toBe(3);
    });

    it("should allow exploring with only 1 move point", () => {
      const state = createExploreState({ movePoints: 1 });
      const player = state.players[0]!;
      const options = getValidExploreOptions(state, player);

      // Should be able to explore with just 1 move point
      expect(options).toBeDefined();
    });

    it("should NOT allow exploring with 0 move points", () => {
      const state = createExploreState({ movePoints: 0 });
      const player = state.players[0]!;
      const options = getValidExploreOptions(state, player);

      expect(options).toBeUndefined();
    });

    it("should apply to every tile explored (Q1)", () => {
      // Start with 4 move points
      let state = createExploreState({ movePoints: 4 });

      // First explore: deducts 1 (not 2)
      const result1 = engine.processAction(state, "player1", {
        type: EXPLORE_ACTION,
        direction: "E",
        fromTileCoord: { q: 0, r: 0 },
      });
      expect(result1.state.players[0]?.movePoints).toBe(3);
    });
  });

  // ============================================================================
  // ACTIVE: Attack 1 or enemy attack -1
  // ============================================================================

  describe("active: combat choice", () => {
    const defaultCooldowns = {
      usedThisRound: [] as string[],
      usedThisTurn: [] as string[],
      usedThisCombat: [] as string[],
      activeUntilNextTurn: [] as string[],
    };

    it("should present 2 choices when activated in combat", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Activate skill
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      });

      // Should present 2 options: Attack 1 or enemy attack -1
      expect(result.state.players[0].pendingChoice).not.toBeNull();
      expect(result.state.players[0].pendingChoice?.options).toHaveLength(2);
    });

    it("should grant Attack 1 when first option is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      }).state;

      // Choose Attack 1 (index 0)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // Should have 1 melee attack accumulated
      expect(state.players[0].combatAccumulator.attack.normal).toBe(1);
    });

    it("should reduce enemy attack by 1 when second option is chosen", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(3);

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      }).state;

      // Choose enemy attack reduction (index 1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Select the target enemy
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Verify attack was reduced by 1
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        2
      );
    });

    it("should be usable once per turn", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: {
          ...defaultCooldowns,
          usedThisTurn: [SKILL_BRAEVALAR_FERAL_ALLIES],
        },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // Try to activate skill again - should fail
      const result = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      });

      // Should be invalid action (already used this turn)
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: INVALID_ACTION })
      );
    });
  });

  // ============================================================================
  // ARCANE IMMUNITY (S2)
  // ============================================================================

  describe("Arcane Immunity interaction (S2)", () => {
    const defaultCooldowns = {
      usedThisRound: [] as string[],
      usedThisTurn: [] as string[],
      usedThisCombat: [] as string[],
      activeUntilNextTurn: [] as string[],
    };

    it("should allow targeting Arcane Immune enemies with attack reduction", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Sorcerers (has Arcane Immunity, Attack 6)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SORCERERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      const baseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      expect(baseAttack).toBe(6);

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      }).state;

      // Choose enemy attack reduction (index 1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Select the Sorcerers as target
      if (state.players[0].pendingChoice) {
        state = engine.processAction(state, "player1", {
          type: RESOLVE_CHOICE_ACTION,
          choiceIndex: 0,
        }).state;
      }

      // Attack reduction should work on Arcane Immune enemies (S2)
      expect(getEffectiveEnemyAttack(state, enemyInstanceId, baseAttack)).toBe(
        5
      );
    });
  });

  // ============================================================================
  // MULTI-ENEMY combat
  // ============================================================================

  describe("multi-enemy combat", () => {
    const defaultCooldowns = {
      usedThisRound: [] as string[],
      usedThisTurn: [] as string[],
      usedThisCombat: [] as string[],
      activeUntilNextTurn: [] as string[],
    };

    it("should only reduce attack of the selected enemy", () => {
      const player = createTestPlayer({
        hero: Hero.Braevalar,
        skills: [SKILL_BRAEVALAR_FERAL_ALLIES],
        skillCooldowns: { ...defaultCooldowns },
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS, ENEMY_ORC_SKIRMISHERS],
      }).state;

      const enemy1InstanceId = state.combat?.enemies[0].instanceId ?? "";
      const enemy2InstanceId = state.combat?.enemies[1].instanceId ?? "";
      const enemy1BaseAttack = state.combat?.enemies[0].definition.attack ?? 0;
      const enemy2BaseAttack = state.combat?.enemies[1].definition.attack ?? 0;

      // Activate skill
      state = engine.processAction(state, "player1", {
        type: USE_SKILL_ACTION,
        skillId: SKILL_BRAEVALAR_FERAL_ALLIES,
      }).state;

      // Choose enemy attack reduction (index 1)
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 1,
      }).state;

      // Should have 2 enemy selection options
      expect(state.players[0].pendingChoice?.options).toHaveLength(2);

      // Select first enemy
      state = engine.processAction(state, "player1", {
        type: RESOLVE_CHOICE_ACTION,
        choiceIndex: 0,
      }).state;

      // First enemy should have reduced attack
      expect(
        getEffectiveEnemyAttack(state, enemy1InstanceId, enemy1BaseAttack)
      ).toBe(enemy1BaseAttack - 1);

      // Second enemy should have unchanged attack
      expect(
        getEffectiveEnemyAttack(state, enemy2InstanceId, enemy2BaseAttack)
      ).toBe(enemy2BaseAttack);
    });
  });
});
