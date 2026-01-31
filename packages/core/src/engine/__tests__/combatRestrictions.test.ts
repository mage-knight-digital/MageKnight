/**
 * Combat Restrictions Tests
 *
 * Tests for:
 * - One combat per turn enforcement
 * - hasCombattedThisTurn flag tracking
 * - Movement restrictions after combat
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestGameState, createHexEnemy } from "./testHelpers.js";
import {
  withBlockSources,
  withSiegeAttack,
  createStateWithAdjacentHexes,
  createTestStateWithKeep,
} from "./combatTestHelpers.js";
import {
  MOVE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  DECLARE_BLOCK_ACTION,
  PLAYER_MOVED,
  COMBAT_ENDED,
  INVALID_ACTION,
  COMBAT_TYPE_SIEGE,
  ENEMY_GUARDSMEN,
} from "@mage-knight/shared";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemy/index.js";

describe("Combat Restrictions", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("One combat per turn enforcement", () => {
    it("should prevent second combat same turn", () => {
      let state = createTestGameState();

      // Mark player as having combatted this turn
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: true,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Try to enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });

      // Should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "You can only have one combat per turn",
        })
      );
    });

    it("should allow combat when hasCombattedThisTurn is false", () => {
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });

      // Should succeed
      expect(result.state.combat).not.toBeNull();
    });
  });

  describe("hasCombattedThisTurn flag", () => {
    it("should be set after combat ends", () => {
      let state = createTestGameState();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Ranged/Siege phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Assign Damage phase - skip (enemy is blocked)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat enemy
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // hasCombattedThisTurn should be true
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasCombattedThisTurn).toBe(true);
    });

    it("should be set when assault triggers combat", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        hasCombattedThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to trigger assault
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // hasCombattedThisTurn should be true
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasCombattedThisTurn).toBe(true);
    });
  });

  describe("Movement after combat", () => {
    it("should NOT allow movement after combat ends (player gets one action per turn)", () => {
      // This test reproduces the bug: move -> combat -> move should be invalid
      // Per Mage Knight rules: you get one action per turn (combat OR interaction)
      // Movement is free before your action, but not after
      let state = createStateWithAdjacentHexes();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 10, // Plenty of move points
        hasCombattedThisTurn: false,
        hasTakenActionThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Step 1: Move to adjacent hex (1,0)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: 0 },
      });
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );
      state = result.state;

      // Step 2: Enter combat (voluntary)
      result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      expect(result.state.combat).not.toBeNull();
      state = result.state;

      // Step 3: Skip through combat phases (ranged/siege -> block -> assign damage -> attack)
      // Ranged/Siege phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy (Guardsmen: attack 3, Swift doubles to 6)
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // End Block phase -> Assign Damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip Assign Damage phase (enemy is blocked) -> Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase - defeat the enemy
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Combat should have ended
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
        })
      );

      // Step 4: Try to move AGAIN after combat - THIS SHOULD FAIL
      // Combat is the player's "action" for the turn, so no more movement allowed
      result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 2, r: -1 },
      });

      // Movement after combat should be rejected
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should set hasTakenActionThisTurn when combat ends", () => {
      let state = createStateWithAdjacentHexes();

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hasCombattedThisTurn: false,
        hasTakenActionThisTurn: false,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Skip through combat phases
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - block the enemy
      state = withBlockSources(state, "player1", [{ element: "physical", value: 6 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Assign Damage phase - skip
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Defeat enemy
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // hasTakenActionThisTurn should be true after combat
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.hasTakenActionThisTurn).toBe(true);
    });
  });
});
