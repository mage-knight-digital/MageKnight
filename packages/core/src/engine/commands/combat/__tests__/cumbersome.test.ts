/**
 * Tests for Cumbersome enemy ability
 *
 * Cumbersome: In the Block phase, you may spend Move points; for each Move point
 * spent, the attack is reduced by 1 for the rest of the turn. An attack reduced
 * to 0 is considered successfully blocked.
 *
 * CRITICAL: Reduction applies BEFORE Swift doubling and BEFORE Brutal damage doubling.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import {
  SPEND_MOVE_ON_CUMBERSOME_ACTION,
  DECLARE_BLOCK_ACTION,
  UNDO_ACTION,
  INVALID_ACTION,
  MOVE_SPENT_ON_CUMBERSOME,
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  type EnemyId,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_RANGED_SIEGE,
} from "../../../../types/combat.js";
import type { GameState } from "../../../../state/GameState.js";
import type { CombatEnemy } from "../../../../types/combat.js";
import type { EnemyDefinition } from "@mage-knight/shared";
import { ELEMENT_PHYSICAL } from "@mage-knight/shared";

// Mock enemy with Cumbersome ability for testing
const CUMBERSOME_ENEMY_DEF: EnemyDefinition = {
  id: "test_cumbersome" as EnemyId,
  name: "Cumbersome Test Enemy",
  color: "green",
  attack: 5,
  armor: 4,
  fame: 3,
  attackElement: ELEMENT_PHYSICAL,
  abilities: ["cumbersome"],
  resistances: {},
};

// Mock enemy with Cumbersome + Swift for testing interaction
const CUMBERSOME_SWIFT_ENEMY_DEF: EnemyDefinition = {
  id: "test_cumbersome_swift" as EnemyId,
  name: "Cumbersome Swift Enemy",
  color: "green",
  attack: 4,
  armor: 3,
  fame: 4,
  attackElement: ELEMENT_PHYSICAL,
  abilities: ["cumbersome", "swift"],
  resistances: {},
};

/**
 * Helper to set up a combat state with a custom enemy for testing Cumbersome.
 */
function setupCumbersomeCombat(
  state: GameState,
  enemyDef: EnemyDefinition,
  playerMovePoints: number = 5
): GameState {
  const combatEnemy: CombatEnemy = {
    instanceId: "enemy_cumbersome_0",
    definition: enemyDef,
    isDefeated: false,
    isBlocked: false,
    attacksBlocked: undefined,
    isSummonerHidden: false,
    summonedByInstanceId: undefined,
  };

  // Update player with move points
  const playerIndex = state.players.findIndex((p) => p.id === "player1");
  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...updatedPlayers[playerIndex],
    movePoints: playerMovePoints,
    hasCombattedThisTurn: true,
  };

  return {
    ...state,
    players: updatedPlayers,
    combat: {
      enemies: [combatEnemy],
      phase: COMBAT_PHASE_BLOCK,
      initiatorId: "player1",
      isCooperative: false,
      fortificationLevel: 0,
      pendingDamage: {},
      pendingBlock: {},
      pendingSwiftBlock: {},
      cumbersomeReductions: {},
    },
  };
}

/**
 * Helper to give player block for testing.
 */
function withPlayerBlock(state: GameState, physicalBlock: number): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === "player1");
  const player = state.players[playerIndex];

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      block: physicalBlock,
      blockElements: {
        ...player.combatAccumulator.blockElements,
        physical: physicalBlock,
      },
    },
  };

  return { ...state, players: updatedPlayers };
}

describe("Cumbersome Ability", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("SPEND_MOVE_ON_CUMBERSOME", () => {
    it("should reduce enemy attack by move points spent", () => {
      let state = createTestGameState();
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);

      // Spend 3 move points on Cumbersome enemy
      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 3,
      });

      // Should emit MOVE_SPENT_ON_CUMBERSOME event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MOVE_SPENT_ON_CUMBERSOME,
          enemyInstanceId: "enemy_cumbersome_0",
          movePointsSpent: 3,
          totalReduction: 3,
        })
      );

      // Move points should be deducted
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(2);

      // Reduction should be tracked
      expect(
        result.state.combat?.cumbersomeReductions["enemy_cumbersome_0"]
      ).toBe(3);
    });

    it("should allow spending multiple times on same enemy", () => {
      let state = createTestGameState();
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 10);

      // Spend 2 move points
      let result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 2,
      });

      // Spend 3 more
      result = engine.processAction(result.state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 3,
      });

      // Total reduction should be 5
      expect(
        result.state.combat?.cumbersomeReductions["enemy_cumbersome_0"]
      ).toBe(5);

      // Player should have 5 move points left
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(5);
    });

    it("should fail when player has no move points", () => {
      let state = createTestGameState();
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 0);

      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should fail when enemy does not have Cumbersome", () => {
      let state = createTestGameState();
      // Use a regular enemy without Cumbersome
      const regularEnemy: CombatEnemy = {
        instanceId: "enemy_regular_0",
        definition: {
          id: "test_regular" as EnemyId,
          name: "Regular Enemy",
          color: "green",
          attack: 3,
          armor: 2,
          fame: 2,
          attackElement: ELEMENT_PHYSICAL,
          abilities: [],
          resistances: {},
        },
        isDefeated: false,
        isBlocked: false,
        attacksBlocked: undefined,
        isSummonerHidden: false,
        summonedByInstanceId: undefined,
      };

      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1"
            ? { ...p, movePoints: 5, hasCombattedThisTurn: true }
            : p
        ),
        combat: {
          enemies: [regularEnemy],
          phase: COMBAT_PHASE_BLOCK,
          initiatorId: "player1",
          isCooperative: false,
          fortificationLevel: 0,
          pendingDamage: {},
          pendingBlock: {},
          pendingSwiftBlock: {},
          cumbersomeReductions: {},
        },
      };

      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_regular_0",
        movePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should fail when not in Block phase", () => {
      let state = createTestGameState();
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);

      // Change to ranged phase
      state = {
        ...state,
        combat: state.combat
          ? { ...state.combat, phase: COMBAT_PHASE_RANGED_SIEGE }
          : null,
      };

      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should be reversible via undo", () => {
      let state = createTestGameState();
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);

      // Spend 3 move points
      const spendResult = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 3,
      });

      expect(spendResult.state.combat?.cumbersomeReductions["enemy_cumbersome_0"]).toBe(3);

      // Undo
      const undoResult = engine.processAction(spendResult.state, "player1", {
        type: UNDO_ACTION,
      });

      // Reduction should be removed
      expect(
        undoResult.state.combat?.cumbersomeReductions["enemy_cumbersome_0"]
      ).toBeUndefined();

      // Move points should be restored
      const player = undoResult.state.players.find((p) => p.id === "player1");
      expect(player?.movePoints).toBe(5);
    });
  });

  describe("blocking interaction", () => {
    it("should reduce block requirement based on Cumbersome reduction", () => {
      let state = createTestGameState();
      // Enemy has attack 5, we'll reduce by 3 (need 2 block)
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);
      state = withPlayerBlock(state, 2);

      // Spend 3 move points to reduce attack from 5 to 2
      let result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 3,
      });

      // Assign 2 block to the enemy
      result = {
        ...result,
        state: {
          ...result.state,
          combat: result.state.combat
            ? {
                ...result.state.combat,
                pendingBlock: {
                  ["enemy_cumbersome_0"]: {
                    physical: 2,
                    fire: 0,
                    ice: 0,
                    coldFire: 0,
                  },
                },
                pendingSwiftBlock: {},
              }
            : null,
        },
      };

      // Mark assigned block in player accumulator
      const playerIndex = result.state.players.findIndex((p) => p.id === "player1");
      const updatedPlayers = [...result.state.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        combatAccumulator: {
          ...updatedPlayers[playerIndex].combatAccumulator,
          assignedBlock: 2,
          assignedBlockElements: { physical: 2, fire: 0, ice: 0, coldFire: 0 },
        },
      };
      result = { ...result, state: { ...result.state, players: updatedPlayers } };

      // Declare block - should succeed because 2 block >= 2 reduced attack
      const blockResult = engine.processAction(result.state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_cumbersome_0",
      });

      expect(blockResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_cumbersome_0",
        })
      );
    });

    it("should fail block if insufficient after Cumbersome reduction", () => {
      let state = createTestGameState();
      // Enemy has attack 5, we'll reduce by 2 (need 3 block, but we only have 2)
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);
      state = withPlayerBlock(state, 2);

      // Spend 2 move points to reduce attack from 5 to 3
      let result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 2,
      });

      // Assign 2 block
      result = {
        ...result,
        state: {
          ...result.state,
          combat: result.state.combat
            ? {
                ...result.state.combat,
                pendingBlock: {
                  ["enemy_cumbersome_0"]: {
                    physical: 2,
                    fire: 0,
                    ice: 0,
                    coldFire: 0,
                  },
                },
                pendingSwiftBlock: {},
              }
            : null,
        },
      };

      const playerIndex = result.state.players.findIndex((p) => p.id === "player1");
      const updatedPlayers = [...result.state.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        combatAccumulator: {
          ...updatedPlayers[playerIndex].combatAccumulator,
          assignedBlock: 2,
          assignedBlockElements: { physical: 2, fire: 0, ice: 0, coldFire: 0 },
        },
      };
      result = { ...result, state: { ...result.state, players: updatedPlayers } };

      // Declare block - should fail because 2 block < 3 reduced attack
      const blockResult = engine.processAction(result.state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_cumbersome_0",
      });

      expect(blockResult.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_cumbersome_0",
        })
      );
    });

    it("should count attack reduced to 0 as blocked", () => {
      let state = createTestGameState();
      // Enemy has attack 5, we'll reduce by 5 (0 block needed)
      state = setupCumbersomeCombat(state, CUMBERSOME_ENEMY_DEF, 5);
      state = withPlayerBlock(state, 0); // No block needed

      // Spend 5 move points to reduce attack from 5 to 0
      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 5,
      });

      // No pending block needed since attack is 0
      // Declare block with 0 block should succeed
      const blockResult = engine.processAction(result.state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_cumbersome_0",
      });

      expect(blockResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_cumbersome_0",
        })
      );
    });
  });

  describe("Swift interaction (CRITICAL order of operations)", () => {
    it("should apply Cumbersome BEFORE Swift doubling", () => {
      let state = createTestGameState();
      // Enemy has attack 4 with Cumbersome + Swift
      // Without reduction: need 8 block (4 * 2)
      // With 2 reduction: need 4 block ((4-2) * 2)
      state = setupCumbersomeCombat(state, CUMBERSOME_SWIFT_ENEMY_DEF, 5);
      state = withPlayerBlock(state, 4);

      // Spend 2 move points to reduce attack from 4 to 2
      let result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 2,
      });

      // Assign 4 block
      result = {
        ...result,
        state: {
          ...result.state,
          combat: result.state.combat
            ? {
                ...result.state.combat,
                pendingBlock: {
                  ["enemy_cumbersome_0"]: {
                    physical: 4,
                    fire: 0,
                    ice: 0,
                    coldFire: 0,
                  },
                },
                pendingSwiftBlock: {},
              }
            : null,
        },
      };

      const playerIndex = result.state.players.findIndex((p) => p.id === "player1");
      const updatedPlayers = [...result.state.players];
      updatedPlayers[playerIndex] = {
        ...updatedPlayers[playerIndex],
        combatAccumulator: {
          ...updatedPlayers[playerIndex].combatAccumulator,
          assignedBlock: 4,
          assignedBlockElements: { physical: 4, fire: 0, ice: 0, coldFire: 0 },
        },
      };
      result = { ...result, state: { ...result.state, players: updatedPlayers } };

      // Declare block - should succeed
      // Reduced attack = 4 - 2 = 2
      // Swift doubles: 2 * 2 = 4
      // Block 4 >= 4 required
      const blockResult = engine.processAction(result.state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_cumbersome_0",
      });

      expect(blockResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_cumbersome_0",
        })
      );
    });

    it("should reduce Swift enemy attack to 0 and count as blocked", () => {
      let state = createTestGameState();
      // Enemy has attack 4 with Cumbersome + Swift
      // Reduce attack to 0: need 0 block (0 * 2 = 0)
      state = setupCumbersomeCombat(state, CUMBERSOME_SWIFT_ENEMY_DEF, 5);
      state = withPlayerBlock(state, 0);

      // Spend 4 move points to reduce attack from 4 to 0
      const result = engine.processAction(state, "player1", {
        type: SPEND_MOVE_ON_CUMBERSOME_ACTION,
        enemyInstanceId: "enemy_cumbersome_0",
        movePointsToSpend: 4,
      });

      // Declare block - should succeed with 0 block
      const blockResult = engine.processAction(result.state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_cumbersome_0",
      });

      expect(blockResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_cumbersome_0",
        })
      );
    });
  });
});
