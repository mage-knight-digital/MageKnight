/**
 * Combat Reputation Penalty Tests
 *
 * Tests for enemies that cause reputation loss when defeated (e.g., Heroes).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withBlockSources, withSiegeAttack } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ENEMY_HEROES,
  ENEMY_PROWLERS,
  REPUTATION_CHANGED,
  REPUTATION_REASON_DEFEAT_ENEMY,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ELEMENT_PHYSICAL,
  ABILITY_FORTIFIED,
} from "@mage-knight/shared";

describe("Combat Reputation Penalty", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Heroes enemy with reputation penalty", () => {
    it("should apply -1 reputation when Heroes enemy is defeated via siege attack", () => {
      let state = createTestGameState();

      // Set initial reputation to 5
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 5 } : p
        ),
      };

      // Enter combat with Heroes (armor 4, fame 5, fortified, reputationPenalty 1)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      // Ranged/Siege phase - attack with siege (Heroes are fortified)
      // Set up siege attack in accumulator
      state = withSiegeAttack(state, "player1", 4);

      // Attack with Siege Physical 4 (equals armor)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_SIEGE,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Player should gain fame 5
      expect(result.state.players[0].fame).toBe(5);

      // Player should lose 1 reputation (5 -> 4)
      expect(result.state.players[0].reputation).toBe(4);

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          newValue: 4,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });

    it("should apply reputation penalty when Heroes are defeated in ATTACK phase via melee", () => {
      let state = createTestGameState();

      // Set initial reputation to 3
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 3 } : p
        ),
      };

      // Enter combat with Heroes
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      // Ranged/Siege phase - skip
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block phase - block both attacks (5 + 3 = 8 total)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 5 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 1,
      }).state;

      // Advance to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Advance to Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with melee 4 (equals armor)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Player should lose 1 reputation (3 -> 2)
      expect(result.state.players[0].reputation).toBe(2);

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: -1,
          newValue: 2,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });

    it("should clamp reputation at -7 minimum", () => {
      let state = createTestGameState();

      // Set reputation to -7 (minimum)
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: -7 } : p
        ),
      };

      // Enter combat with Heroes
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      // Set up siege attack
      state = withSiegeAttack(state, "player1", 4);

      // Defeat with siege attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
        attackType: COMBAT_TYPE_SIEGE,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Reputation should stay at -7 (clamped)
      expect(result.state.players[0].reputation).toBe(-7);

      // No REPUTATION_CHANGED event since value didn't change
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
        })
      );
    });

    it("should stack reputation penalties from multiple Heroes enemies", () => {
      let state = createTestGameState();

      // Set initial reputation to 5
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 5 } : p
        ),
      };

      // Enter combat with two Heroes enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES, ENEMY_HEROES],
      }).state;

      // Set up siege attack (8 damage total - 4 per enemy)
      state = withSiegeAttack(state, "player1", 8);

      // Defeat both with siege attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 8 }],
        attackType: COMBAT_TYPE_SIEGE,
      });

      // Both enemies should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.combat?.enemies[1].isDefeated).toBe(true);

      // Player should gain 10 fame (5 per Heroes)
      expect(result.state.players[0].fame).toBe(10);

      // Player should lose 2 reputation (5 -> 3)
      expect(result.state.players[0].reputation).toBe(3);

      // Should emit REPUTATION_CHANGED event with -2 delta
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: -2,
          newValue: 3,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });
  });

  describe("Enemies without reputation penalty", () => {
    it("should not affect reputation when defeating normal enemies", () => {
      let state = createTestGameState();

      // Set initial reputation to 3
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 3 } : p
        ),
      };

      // Enter combat with Prowlers (non-fortified, no reputation penalty)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Defeat in ranged phase
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Reputation should remain unchanged
      expect(result.state.players[0].reputation).toBe(3);

      // No REPUTATION_CHANGED event
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
        })
      );
    });
  });

  describe("Heroes enemy stats", () => {
    it("should have correct attack stats (Multiple Attacks: 5, 3)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      const heroesEnemy = state.combat?.enemies[0];
      expect(heroesEnemy).toBeDefined();
      expect(heroesEnemy?.definition.attacks).toEqual([
        { damage: 5, element: ELEMENT_PHYSICAL },
        { damage: 3, element: ELEMENT_PHYSICAL },
      ]);
    });

    it("should have correct armor (4)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      const heroesEnemy = state.combat?.enemies[0];
      expect(heroesEnemy?.definition.armor).toBe(4);
    });

    it("should have correct fame (5)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      const heroesEnemy = state.combat?.enemies[0];
      expect(heroesEnemy?.definition.fame).toBe(5);
    });

    it("should have Fortified ability", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      const heroesEnemy = state.combat?.enemies[0];
      expect(heroesEnemy?.definition.abilities).toContain(ABILITY_FORTIFIED);
    });

    it("should have reputation penalty of 1", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_HEROES],
      }).state;

      const heroesEnemy = state.combat?.enemies[0];
      expect(heroesEnemy?.definition.reputationPenalty).toBe(1);
    });
  });
});
