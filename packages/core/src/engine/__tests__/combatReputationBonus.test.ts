/**
 * Combat Reputation Bonus Tests
 *
 * Tests for enemies that grant reputation when defeated (e.g., Thugs Gray).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withSiegeAttack, withBlockSources } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ENEMY_THUGS_GRAY,
  ENEMY_HEROES,
  REPUTATION_CHANGED,
  REPUTATION_REASON_DEFEAT_ENEMY,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ELEMENT_PHYSICAL,
  ABILITY_BRUTAL,
  ENEMY_COLOR_GRAY,
} from "@mage-knight/shared";

describe("Combat Reputation Bonus", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Thugs (Gray) enemy with reputation bonus", () => {
    it("should apply +1 reputation when Thugs are defeated via ranged attack", () => {
      let state = createTestGameState();

      // Set initial reputation to 3
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 3 } : p
        ),
      };

      // Enter combat with Thugs (armor 5, fame 2, brutal, reputationBonus 1)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      // Ranged phase - attack with 5 damage (equals armor)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Player should gain fame 2
      expect(result.state.players[0].fame).toBe(2);

      // Player should gain 1 reputation (3 -> 4)
      expect(result.state.players[0].reputation).toBe(4);

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: 1,
          newValue: 4,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });

    it("should apply reputation bonus when Thugs are defeated in ATTACK phase via melee", () => {
      let state = createTestGameState();

      // Set initial reputation to 2
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 2 } : p
        ),
      };

      // Enter combat with Thugs
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      // Ranged/Siege phase - skip
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block phase - block the attack (Brutal: 3 attack, need 3 block)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Advance to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Advance to Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with melee 5 (equals armor)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Player should gain 1 reputation (2 -> 3)
      expect(result.state.players[0].reputation).toBe(3);

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: 1,
          newValue: 3,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });

    it("should clamp reputation at +7 maximum", () => {
      let state = createTestGameState();

      // Set reputation to +7 (maximum)
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 7 } : p
        ),
      };

      // Enter combat with Thugs
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      // Defeat with ranged attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);

      // Reputation should stay at +7 (clamped)
      expect(result.state.players[0].reputation).toBe(7);

      // No REPUTATION_CHANGED event since value didn't change
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
        })
      );
    });

    it("should stack reputation bonuses from multiple Thugs enemies", () => {
      let state = createTestGameState();

      // Set initial reputation to 2
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 2 } : p
        ),
      };

      // Enter combat with three Thugs enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY, ENEMY_THUGS_GRAY, ENEMY_THUGS_GRAY],
      }).state;

      // Defeat all with ranged attack (15 damage total - 5 per enemy)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1", "enemy_2"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 15 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      // All enemies should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.combat?.enemies[1].isDefeated).toBe(true);
      expect(result.state.combat?.enemies[2].isDefeated).toBe(true);

      // Player should gain 6 fame (2 per Thugs)
      expect(result.state.players[0].fame).toBe(6);

      // Player should gain 3 reputation (2 -> 5)
      expect(result.state.players[0].reputation).toBe(5);

      // Should emit REPUTATION_CHANGED event with +3 delta
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: 3,
          newValue: 5,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });
  });

  describe("Mixed bonus and penalty enemies", () => {
    it("should net to zero when defeating Thugs (+1) and Heroes (-1) together", () => {
      let state = createTestGameState();

      // Set initial reputation to 3
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 3 } : p
        ),
      };

      // Enter combat with both Thugs (bonus) and Heroes (penalty)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY, ENEMY_HEROES],
      }).state;

      // Set up siege attack (both are defeatable with siege)
      // Thugs armor 5, Heroes armor 4 = need 9 total
      state = withSiegeAttack(state, "player1", 9);

      // Defeat both with siege attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 9 }],
        attackType: COMBAT_TYPE_SIEGE,
      });

      // Both enemies should be defeated
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.combat?.enemies[1].isDefeated).toBe(true);

      // Reputation should remain unchanged (3) - net change is 0
      expect(result.state.players[0].reputation).toBe(3);

      // No REPUTATION_CHANGED event since net change is 0
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
        })
      );
    });

    it("should handle partial clamping correctly", () => {
      let state = createTestGameState();

      // Set reputation to +6
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1" ? { ...p, reputation: 6 } : p
        ),
      };

      // Enter combat with three Thugs (would be +3, but clamped to +1)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY, ENEMY_THUGS_GRAY, ENEMY_THUGS_GRAY],
      }).state;

      // Defeat all with ranged attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1", "enemy_2"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 15 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      // Reputation should be clamped to +7 (not +9)
      expect(result.state.players[0].reputation).toBe(7);

      // Event delta should be +1 (actual change), not +3 (requested change)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          delta: 1,
          newValue: 7,
          reason: REPUTATION_REASON_DEFEAT_ENEMY,
        })
      );
    });
  });

  describe("Thugs (Gray) enemy stats", () => {
    it("should have correct attack value (3 physical)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy).toBeDefined();
      expect(thugsEnemy?.definition.attack).toBe(3);
      expect(thugsEnemy?.definition.attackElement).toBe(ELEMENT_PHYSICAL);
    });

    it("should have correct armor (5)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.armor).toBe(5);
    });

    it("should have correct fame (2)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.fame).toBe(2);
    });

    it("should have Brutal ability", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.abilities).toContain(ABILITY_BRUTAL);
    });

    it("should have reputation bonus of 1", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.reputationBonus).toBe(1);
    });

    it("should have gray color", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.color).toBe(ENEMY_COLOR_GRAY);
    });

    it("should have no resistances", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_THUGS_GRAY],
      }).state;

      const thugsEnemy = state.combat?.enemies[0];
      expect(thugsEnemy?.definition.resistances).toEqual([]);
    });
  });
});
