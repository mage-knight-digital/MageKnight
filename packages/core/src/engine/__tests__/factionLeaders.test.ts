/**
 * Faction Leader Tests
 *
 * Tests for faction leader type definitions, level-based stats,
 * and integration with combat system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENEMY_ELEMENTALIST_LEADER,
  ENEMY_DARK_CRUSADER_LEADER,
  FACTION_LEADERS,
  getFactionLeader,
  getFactionLeaderLevelStats,
  isFactionLeaderDefinition,
  isFactionLeaderId,
  ABILITY_ARCANE_IMMUNITY,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
} from "@mage-knight/shared";
import {
  createCombatState,
  isCombatFactionLeader,
  getCombatFactionLeaderStats,
  getCombatEnemyBaseArmor,
  getCombatEnemyBaseAttack,
} from "../../types/combat.js";

describe("Faction Leaders", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Type definitions", () => {
    it("should have two faction leaders defined", () => {
      expect(Object.keys(FACTION_LEADERS)).toHaveLength(2);
      expect(FACTION_LEADERS[ENEMY_ELEMENTALIST_LEADER]).toBeDefined();
      expect(FACTION_LEADERS[ENEMY_DARK_CRUSADER_LEADER]).toBeDefined();
    });

    it("should identify Elementalist as faction leader", () => {
      const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
      expect(isFactionLeaderDefinition(leader)).toBe(true);
      expect(leader.isFactionLeader).toBe(true);
    });

    it("should identify Dark Crusader as faction leader", () => {
      const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
      expect(isFactionLeaderDefinition(leader)).toBe(true);
      expect(leader.isFactionLeader).toBe(true);
    });

    it("should correctly check faction leader IDs", () => {
      expect(isFactionLeaderId(ENEMY_ELEMENTALIST_LEADER)).toBe(true);
      expect(isFactionLeaderId(ENEMY_DARK_CRUSADER_LEADER)).toBe(true);
      expect(isFactionLeaderId("diggers")).toBe(false);
    });
  });

  describe("Arcane Immunity", () => {
    it("should have Arcane Immunity ability on Elementalist", () => {
      const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
      expect(leader.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
    });

    it("should have Arcane Immunity ability on Dark Crusader", () => {
      const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
      expect(leader.abilities).toContain(ABILITY_ARCANE_IMMUNITY);
    });
  });

  describe("Level-based stats", () => {
    describe("Elementalist", () => {
      it("should have stats for all 4 levels", () => {
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        expect(leader.levelStats[1]).toBeDefined();
        expect(leader.levelStats[2]).toBeDefined();
        expect(leader.levelStats[3]).toBeDefined();
        expect(leader.levelStats[4]).toBeDefined();
      });

      it("should have increasing armor at higher levels", () => {
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const stats1 = getFactionLeaderLevelStats(leader, 1);
        const stats2 = getFactionLeaderLevelStats(leader, 2);
        const stats3 = getFactionLeaderLevelStats(leader, 3);
        const stats4 = getFactionLeaderLevelStats(leader, 4);

        expect(stats1.armor).toBeLessThan(stats2.armor);
        expect(stats2.armor).toBeLessThan(stats3.armor);
        expect(stats3.armor).toBeLessThan(stats4.armor);
      });

      it("should have multiple attacks at level 2+", () => {
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const stats1 = getFactionLeaderLevelStats(leader, 1);
        const stats2 = getFactionLeaderLevelStats(leader, 2);
        const stats4 = getFactionLeaderLevelStats(leader, 4);

        expect(stats1.attacks.length).toBe(1);
        expect(stats2.attacks.length).toBeGreaterThanOrEqual(2);
        expect(stats4.attacks.length).toBeGreaterThanOrEqual(2);
      });

      it("should have elemental attacks at higher levels", () => {
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const stats3 = getFactionLeaderLevelStats(leader, 3);

        const elements = stats3.attacks.map((a) => a.element);
        expect(elements).toContain(ELEMENT_FIRE);
        expect(elements).toContain(ELEMENT_ICE);
      });

      it("should clamp out-of-range levels to valid range", () => {
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const statsNegative = getFactionLeaderLevelStats(leader, -1);
        const stats0 = getFactionLeaderLevelStats(leader, 0);
        const stats5 = getFactionLeaderLevelStats(leader, 5);
        const stats1 = getFactionLeaderLevelStats(leader, 1);
        const stats4 = getFactionLeaderLevelStats(leader, 4);

        // Out of range should clamp to 1 or 4
        expect(statsNegative.armor).toBe(stats1.armor);
        expect(stats0.armor).toBe(stats1.armor);
        expect(stats5.armor).toBe(stats4.armor);
      });
    });

    describe("Dark Crusader", () => {
      it("should have stats for all 4 levels", () => {
        const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
        expect(leader.levelStats[1]).toBeDefined();
        expect(leader.levelStats[2]).toBeDefined();
        expect(leader.levelStats[3]).toBeDefined();
        expect(leader.levelStats[4]).toBeDefined();
      });

      it("should have increasing armor at higher levels", () => {
        const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
        const stats1 = getFactionLeaderLevelStats(leader, 1);
        const stats4 = getFactionLeaderLevelStats(leader, 4);

        expect(stats1.armor).toBeLessThan(stats4.armor);
      });

      it("should have physical attacks", () => {
        const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
        const stats1 = getFactionLeaderLevelStats(leader, 1);
        const firstAttack = stats1.attacks[0];

        expect(firstAttack).toBeDefined();
        if (firstAttack) {
          expect(firstAttack.element).toBe(ELEMENT_PHYSICAL);
        }
      });
    });
  });

  describe("Combat integration", () => {
    it("should create combat enemy with default level 1", () => {
      const combat = createCombatState([ENEMY_ELEMENTALIST_LEADER], false);
      const enemy = combat.enemies[0];

      expect(enemy).toBeDefined();
      if (enemy) {
        expect(isCombatFactionLeader(enemy)).toBe(true);
        expect(enemy.currentLevel).toBe(1);
      }
    });

    it("should create combat enemy with specified level", () => {
      const combat = createCombatState(
        [{ enemyId: ENEMY_ELEMENTALIST_LEADER, level: 3 }],
        false
      );
      const enemy = combat.enemies[0];

      expect(enemy).toBeDefined();
      if (enemy) {
        expect(enemy.currentLevel).toBe(3);
      }
    });

    it("should return level-based stats in combat", () => {
      const combat = createCombatState(
        [{ enemyId: ENEMY_ELEMENTALIST_LEADER, level: 2 }],
        false
      );
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        const stats = getCombatFactionLeaderStats(enemy);
        expect(stats).toBeDefined();

        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const expectedStats = getFactionLeaderLevelStats(leader, 2);
        if (stats) {
          expect(stats.armor).toBe(expectedStats.armor);
        }
      }
    });

    it("should get correct base armor for faction leader", () => {
      const combat = createCombatState(
        [{ enemyId: ENEMY_ELEMENTALIST_LEADER, level: 3 }],
        false
      );
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        const baseArmor = getCombatEnemyBaseArmor(enemy);
        const leader = getFactionLeader(ENEMY_ELEMENTALIST_LEADER);
        const expectedStats = getFactionLeaderLevelStats(leader, 3);

        expect(baseArmor).toBe(expectedStats.armor);
      }
    });

    it("should get correct base attack for faction leader", () => {
      const combat = createCombatState(
        [{ enemyId: ENEMY_DARK_CRUSADER_LEADER, level: 2 }],
        false
      );
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        const baseAttack = getCombatEnemyBaseAttack(enemy);
        const leader = getFactionLeader(ENEMY_DARK_CRUSADER_LEADER);
        const expectedStats = getFactionLeaderLevelStats(leader, 2);
        const firstAttack = expectedStats.attacks[0];

        if (firstAttack) {
          expect(baseAttack).toBe(firstAttack.value);
        }
      }
    });

    it("should not set currentLevel for regular enemies", () => {
      const combat = createCombatState(["diggers"], false);
      const enemy = combat.enemies[0];

      expect(enemy).toBeDefined();
      if (enemy) {
        expect(isCombatFactionLeader(enemy)).toBe(false);
        expect(enemy.currentLevel).toBeUndefined();
      }
    });

    it("should use definition armor for regular enemies", () => {
      const combat = createCombatState(["diggers"], false);
      const enemy = combat.enemies[0];
      expect(enemy).toBeDefined();
      if (enemy) {
        const baseArmor = getCombatEnemyBaseArmor(enemy);
        expect(baseArmor).toBe(enemy.definition.armor);
      }
    });
  });

  describe("Game engine integration", () => {
    it("should enter combat with faction leader", () => {
      const player = createTestPlayer();
      const state = createTestGameState({ players: [player] });

      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ELEMENTALIST_LEADER],
      });

      expect(result.state.combat).toBeDefined();
      const combat = result.state.combat;
      if (combat) {
        expect(combat.enemies).toHaveLength(1);
        const enemy = combat.enemies[0];
        if (enemy) {
          expect(isCombatFactionLeader(enemy)).toBe(true);
        }
      }
    });

    it("should enter combat with faction leader at specified level", () => {
      // Note: The ENTER_COMBAT_ACTION doesn't currently support level specification
      // This test verifies that combat state is created correctly when used with
      // the createCombatState helper directly
      const combat = createCombatState(
        [{ enemyId: ENEMY_DARK_CRUSADER_LEADER, level: 4 }],
        false
      );

      const enemy = combat.enemies[0];
      if (enemy) {
        expect(enemy.currentLevel).toBe(4);
      }
    });

    it("should progress through combat phases with faction leader", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DARK_CRUSADER_LEADER],
      }).state;

      const combat1 = state.combat;
      expect(combat1).toBeDefined();
      if (combat1) {
        expect(combat1.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      }

      // Skip ranged phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const combat2 = state.combat;
      expect(combat2).toBeDefined();
      if (combat2) {
        expect(combat2.phase).toBe(COMBAT_PHASE_BLOCK);
      }
    });
  });
});
