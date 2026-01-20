/**
 * Tests for incremental attack assignment commands
 *
 * These test the ASSIGN_ATTACK and UNASSIGN_ATTACK commands
 * which are part of the incremental damage allocation system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  UNDO_ACTION,
  INVALID_ACTION,
  ATTACK_ASSIGNED,
  ATTACK_UNASSIGNED,
  ENEMY_PROWLERS,
  ENEMY_WOLF_RIDERS,
  ATTACK_TYPE_MELEE,
  ATTACK_TYPE_RANGED,
  ATTACK_TYPE_SIEGE,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../../../types/combat.js";
import type { GameState } from "../../../../state/GameState.js";
import type { AccumulatedAttack } from "../../../../types/player.js";

/**
 * Helper to set up accumulated attack values in the player's combatAccumulator.
 */
function withAccumulatedAttack(
  state: GameState,
  playerId: string,
  attack: Partial<AccumulatedAttack>
): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];

  const defaultAttack: AccumulatedAttack = {
    normal: 0,
    ranged: 0,
    siege: 0,
    normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: { ...defaultAttack, ...attack },
    },
  };

  return { ...state, players: updatedPlayers };
}

describe("Incremental Attack Assignment", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("ASSIGN_ATTACK", () => {
    it("should assign melee attack to enemy in attack phase", () => {
      let state = createTestGameState();

      // Enter combat with Orc (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Skip to attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // Ranged -> Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state; // Block -> Assign Damage (no unblocked enemies attacking)

      // We need to skip damage phase - but there's no damage to assign since we blocked nothing
      // Actually, the enemy is unblocked, so they deal damage
      // For simplicity, let's check we're in attack phase by skipping damage assignment
      // The orc will attack (armor 3, attack 3) - we need to take damage first
      // Actually for this test let's just set up attack phase directly

      // For a cleaner test, manually set combat phase to attack
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Give player some melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 3 physical melee to enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      // Should emit ATTACK_ASSIGNED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_ASSIGNED,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 3,
        })
      );

      // Check pending damage was updated
      expect(result.state.combat?.pendingDamage["enemy_0"]).toEqual({
        physical: 3,
        fire: 0,
        ice: 0,
        coldFire: 0,
      });

      // Check assigned attack was tracked
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.normal).toBe(3);
    });

    it("should assign elemental attack", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Give player fire melee attack
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 4, ice: 0, coldFire: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_FIRE,
        amount: 2,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_ASSIGNED,
          element: ATTACK_ELEMENT_FIRE,
          amount: 2,
        })
      );

      expect(result.state.combat?.pendingDamage["enemy_0"]).toEqual({
        physical: 0,
        fire: 2,
        ice: 0,
        coldFire: 0,
      });
    });

    it("should fail when assigning more than available", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Give player only 2 melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 2 });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 5, // Trying to assign more than available
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should fail when not in combat", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Not in combat",
        })
      );
    });

    it("should fail when targeting defeated enemy", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
              enemies: state.combat.enemies.map((e) => ({
                ...e,
                isDefeated: true,
              })),
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should allow assigning to multiple enemies", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Give player enough melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 10 });

      // Assign to first enemy
      const result1 = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      // Assign to second enemy
      const result2 = engine.processAction(result1.state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_1",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      expect(result2.state.combat?.pendingDamage["enemy_0"]?.physical).toBe(3);
      expect(result2.state.combat?.pendingDamage["enemy_1"]?.physical).toBe(3);

      const player = result2.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.normal).toBe(6);
    });

    it("should track assigned attack separately from accumulated", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Give player 5 melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 2
      const result1 = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      const player1 = result1.state.players.find((p) => p.id === "player1");
      expect(player1?.combatAccumulator.attack.normal).toBe(5); // Still has 5 accumulated
      expect(player1?.combatAccumulator.assignedAttack.normal).toBe(2); // 2 assigned

      // Assign 2 more (should work since we have 5-2=3 available)
      const result2 = engine.processAction(result1.state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      const player2 = result2.state.players.find((p) => p.id === "player1");
      expect(player2?.combatAccumulator.attack.normal).toBe(5); // Still 5 accumulated
      expect(player2?.combatAccumulator.assignedAttack.normal).toBe(4); // 4 assigned

      // Try to assign 2 more (should fail - only 1 available)
      const result3 = engine.processAction(result2.state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      expect(result3.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    describe("ranged/siege phase restrictions", () => {
      it("should allow ranged attack in ranged/siege phase", () => {
        let state = createTestGameState();

        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

        // Give player ranged attack
        state = withAccumulatedAttack(state, "player1", { ranged: 5 });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_RANGED,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 3,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: ATTACK_ASSIGNED,
            attackType: ATTACK_TYPE_RANGED,
          })
        );
      });

      it("should allow siege attack in ranged/siege phase", () => {
        let state = createTestGameState();

        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        // Give player siege attack
        state = withAccumulatedAttack(state, "player1", { siege: 5 });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_SIEGE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 3,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: ATTACK_ASSIGNED,
            attackType: ATTACK_TYPE_SIEGE,
          })
        );
      });

      it("should reject melee attack in ranged/siege phase", () => {
        let state = createTestGameState();

        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        // Give player melee attack
        state = withAccumulatedAttack(state, "player1", { normal: 5 });

        const result = engine.processAction(state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 3,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: INVALID_ACTION,
          })
        );
      });

      it("should allow all attack types in attack phase", () => {
        let state = createTestGameState();

        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        state = {
          ...state,
          combat: state.combat
            ? {
                ...state.combat,
                phase: COMBAT_PHASE_ATTACK,
              }
            : null,
        };

        // Give player all attack types
        state = withAccumulatedAttack(state, "player1", {
          normal: 5,
          ranged: 5,
          siege: 5,
        });

        // Melee should work
        let result = engine.processAction(state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 1,
        });
        expect(result.events).toContainEqual(
          expect.objectContaining({ type: ATTACK_ASSIGNED })
        );

        // Ranged should work
        result = engine.processAction(result.state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_RANGED,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 1,
        });
        expect(result.events).toContainEqual(
          expect.objectContaining({ type: ATTACK_ASSIGNED })
        );

        // Siege should work
        result = engine.processAction(result.state, "player1", {
          type: ASSIGN_ATTACK_ACTION,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_SIEGE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 1,
        });
        expect(result.events).toContainEqual(
          expect.objectContaining({ type: ATTACK_ASSIGNED })
        );
      });
    });
  });

  describe("UNASSIGN_ATTACK", () => {
    it("should unassign previously assigned attack", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 3
      const assignResult = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      // Unassign 2
      const unassignResult = engine.processAction(assignResult.state, "player1", {
        type: UNASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      expect(unassignResult.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_UNASSIGNED,
          enemyInstanceId: "enemy_0",
          attackType: ATTACK_TYPE_MELEE,
          element: ATTACK_ELEMENT_PHYSICAL,
          amount: 2,
        })
      );

      // Should have 1 pending damage left
      expect(unassignResult.state.combat?.pendingDamage["enemy_0"]?.physical).toBe(1);

      // Should have 1 assigned left
      const player = unassignResult.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.normal).toBe(1);
    });

    it("should fail when unassigning more than assigned", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 2
      const assignResult = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      // Try to unassign 5
      const unassignResult = engine.processAction(assignResult.state, "player1", {
        type: UNASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 5,
      });

      expect(unassignResult.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should fail when nothing is assigned", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      const result = engine.processAction(state, "player1", {
        type: UNASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 1,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should remove pending damage entry when all unassigned", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 3
      const assignResult = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      expect(assignResult.state.combat?.pendingDamage["enemy_0"]).toBeDefined();

      // Unassign all 3
      const unassignResult = engine.processAction(assignResult.state, "player1", {
        type: UNASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      // Pending damage entry should be removed (not just zeroed)
      expect(unassignResult.state.combat?.pendingDamage["enemy_0"]).toBeUndefined();
    });

    it("should allow reassigning after unassign", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 3 to enemy_0
      let result = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      // Unassign 2 from enemy_0
      result = engine.processAction(result.state, "player1", {
        type: UNASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      });

      // Now should have 4 available (5 accumulated - 1 assigned)
      // Assign 3 to enemy_1
      result = engine.processAction(result.state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_1",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({ type: ATTACK_ASSIGNED })
      );

      expect(result.state.combat?.pendingDamage["enemy_0"]?.physical).toBe(1);
      expect(result.state.combat?.pendingDamage["enemy_1"]?.physical).toBe(3);
    });
  });

  describe("undo functionality", () => {
    it("should be able to undo assign attack via engine undo", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign attack
      const assignResult = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      });

      expect(assignResult.state.combat?.pendingDamage["enemy_0"]?.physical).toBe(3);

      // Undo via UNDO_ACTION
      const undoResult = engine.processAction(assignResult.state, "player1", {
        type: UNDO_ACTION,
      });

      // Should be back to no pending damage
      expect(
        undoResult.state.combat?.pendingDamage["enemy_0"]
      ).toBeUndefined();

      // Assigned attack should be back to 0
      const player = undoResult.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.normal).toBe(0);
    });
  });
});
