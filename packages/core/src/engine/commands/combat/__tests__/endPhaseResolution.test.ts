/**
 * Tests for end phase damage resolution
 *
 * These test that enemies are defeated via DECLARE_ATTACK_TARGETS + FINALIZE_ATTACK
 * during RANGED_SIEGE and ATTACK phases, applying resistances and
 * defeating enemies where effective damage >= armor.
 *
 * END_COMBAT_PHASE no longer auto-resolves pending damage — enemies must be
 * explicitly defeated via FINALIZE_ATTACK.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_ATTACK_ACTION,
  DECLARE_ATTACK_TARGETS_ACTION,
  FINALIZE_ATTACK_ACTION,
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  ENEMY_WOLF_RIDERS,
  ATTACK_TYPE_RANGED,
  ATTACK_ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
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

describe("End Phase Damage Resolution", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("RANGED_SIEGE phase resolution via FINALIZE_ATTACK", () => {
    it("should defeat enemy when finalize attack has sufficient damage", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give player ranged attack (enough to defeat Prowlers with armor 3)
      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Finalize attack
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Should emit ENEMY_DEFEATED event
      expect(finalizeResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // Enemy should be marked as defeated
      const enemy = finalizeResult.state.combat?.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(true);

      // Fame should be accumulated
      expect(finalizeResult.state.combat?.fameGained).toBeGreaterThan(0);

      // End ranged/siege phase
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should emit COMBAT_PHASE_CHANGED event
      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_PHASE_CHANGED,
          previousPhase: COMBAT_PHASE_RANGED_SIEGE,
          newPhase: COMBAT_PHASE_BLOCK,
        })
      );

      // Pending damage should be cleared
      expect(endResult.state.combat?.pendingDamage).toEqual({});

      // Assigned attack should be cleared
      const player = endResult.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.ranged).toBe(0);
    });

    it("should not defeat enemy with insufficient damage", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give only 2 ranged damage (not enough to defeat armor 3)
      state = withAccumulatedAttack(state, "player1", { ranged: 2 });

      // Finalize attack
      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Should emit ATTACK_FAILED, NOT ENEMY_DEFEATED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
        })
      );
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
        })
      );

      // Enemy should NOT be defeated
      const enemy = result.state.combat?.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(false);
    });
  });

  describe("ATTACK phase resolution via FINALIZE_ATTACK", () => {
    it("should defeat enemy via finalize then end combat", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give player melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Finalize attack — defeats enemy
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      expect(finalizeResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // End attack phase (ends combat)
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should emit COMBAT_ENDED with victory
      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 1,
          enemiesSurvived: 0,
        })
      );

      // Combat should be null (ended)
      expect(endResult.state.combat).toBeNull();
    });

    it("should defeat multiple enemies via grouped finalize", () => {
      let state = createTestGameState();

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare both as targets (combined armor: 3 + 4 = 7)
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
      }).state;

      // Give enough melee attack for combined armor
      state = withAccumulatedAttack(state, "player1", { normal: 10 });

      // Finalize attack
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Both enemies should be defeated
      const defeatedEvents = finalizeResult.events.filter(
        (e) => e.type === ENEMY_DEFEATED
      );
      expect(defeatedEvents.length).toBe(2);

      // End combat
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should report 2 enemies defeated
      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          enemiesDefeated: 2,
          enemiesSurvived: 0,
        })
      );
    });
  });

  describe("resistance calculations", () => {
    it("should halve damage against resistant enemies", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mages (armor 5, fire resistant)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGES],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give player 8 fire melee attack - should become 4 effective (halved)
      // Fire Mages have armor 5, so 4 is not enough
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 8, ice: 0, coldFire: 0 },
      });

      // Finalize attack
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Enemy should NOT be defeated (8 fire → 4 effective < 5 armor)
      expect(finalizeResult.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
        })
      );
      expect(finalizeResult.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
        })
      );

      // End combat phase
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
          enemiesDefeated: 0,
          enemiesSurvived: 1,
        })
      );
    });

    it("should defeat enemy when halved damage still meets armor", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mages (armor 5, fire resistant)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGES],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give 10 fire attack - should become 5 effective (halved)
      // Fire Mages have armor 5, so 5 = 5 should defeat
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 10, ice: 0, coldFire: 0 },
      });

      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Enemy SHOULD be defeated (10 fire → 5 effective = 5 armor)
      expect(finalizeResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
        })
      );
    });

    it("should combine resisted and unresisted damage", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mages (armor 5, fire resistant)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGES],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give 3 physical + 4 fire melee attack (normal = 7 total)
      // Fire is halved: 4 → 2 effective. Total: 3 + 2 = 5 = armor
      state = withAccumulatedAttack(state, "player1", {
        normal: 7,
        normalElements: { physical: 0, fire: 4, ice: 0, coldFire: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Enemy SHOULD be defeated (3 + 2 = 5 >= 5 armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
        })
      );
    });
  });

  describe("fame accumulation", () => {
    it("should accumulate fame from defeated enemies via finalize", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (fame: 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Get initial fame
      const initialFameGained = state.combat?.fameGained ?? 0;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Finalize attack to defeat
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Fame should be accumulated on combat state
      expect(finalizeResult.state.combat?.fameGained).toBeGreaterThan(initialFameGained);

      // End combat
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // COMBAT_ENDED should report total fame gained
      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          totalFameGained: expect.any(Number),
        })
      );

      // Fame gained should be positive
      const combatEndedEvent = endResult.events.find(
        (e) => e.type === COMBAT_ENDED
      );
      expect(
        combatEndedEvent && "totalFameGained" in combatEndedEvent
          ? combatEndedEvent.totalFameGained
          : 0
      ).toBeGreaterThan(initialFameGained);
    });

    it("should increase player.fame when defeating enemy via finalize in attack phase", () => {
      let state = createTestGameState();

      // Get initial player fame
      const initialPlayerFame =
        state.players.find((p) => p.id === "player1")?.fame ?? 0;

      // Enter combat with Prowlers (fame: 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Skip to attack phase
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              phase: COMBAT_PHASE_ATTACK,
            }
          : null,
      };

      // Declare targets + give attack + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Player's fame should have increased by the enemy's fame value (Prowlers = 2)
      const fameAfterFinalize =
        finalizeResult.state.players.find((p) => p.id === "player1")?.fame ?? 0;
      expect(fameAfterFinalize).toBe(initialPlayerFame + 2);

      // End combat
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Combat should have ended
      expect(endResult.state.combat).toBeNull();

      // Fame should still be correct
      const finalPlayerFame =
        endResult.state.players.find((p) => p.id === "player1")?.fame ?? 0;
      expect(finalPlayerFame).toBe(initialPlayerFame + 2);
    });

    it("should increase player.fame when defeating enemy via finalize in ranged phase", () => {
      let state = createTestGameState();

      // Get initial player fame
      const initialPlayerFame =
        state.players.find((p) => p.id === "player1")?.fame ?? 0;

      // Enter combat with Prowlers (fame: 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Declare targets + give ranged attack + finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Player's fame should have increased
      const fameAfterFinalize =
        finalizeResult.state.players.find((p) => p.id === "player1")?.fame ?? 0;
      expect(fameAfterFinalize).toBe(initialPlayerFame + 2);

      // End ranged phase
      const endResult = engine.processAction(finalizeResult.state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have advanced to block phase
      expect(endResult.state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Fame should still be correct
      const finalPlayerFame =
        endResult.state.players.find((p) => p.id === "player1")?.fame ?? 0;
      expect(finalPlayerFame).toBe(initialPlayerFame + 2);
    });
  });

  describe("state clearing after phase transition", () => {
    it("should clear pending damage after ranged/siege phase transition", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Assign some damage (via legacy ASSIGN_ATTACK)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2, // Not enough to defeat
      }).state;

      expect(state.combat?.pendingDamage["enemy_0"]).toBeDefined();

      // End phase (no FINALIZE_ATTACK, so no defeat)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Pending damage should be cleared even though enemy wasn't defeated
      expect(result.state.combat?.pendingDamage).toEqual({});
    });

    it("should clear assigned attack after phase transition", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Assign attack
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      const playerBefore = state.players.find((p) => p.id === "player1");
      expect(playerBefore?.combatAccumulator.assignedAttack.ranged).toBe(3);

      // End phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Assigned attack should be cleared
      const playerAfter = result.state.players.find((p) => p.id === "player1");
      expect(playerAfter?.combatAccumulator.assignedAttack.ranged).toBe(0);
    });

    it("should clear ranged/siege attack after phase transition but preserve melee", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5, siege: 4, normal: 3 });

      // Assign some ranged attack
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      // End ranged phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Ranged/siege attack should be cleared; melee remains for attack phase
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.ranged).toBe(0);
      expect(player?.combatAccumulator.attack.siege).toBe(0);
      expect(player?.combatAccumulator.attack.normal).toBe(3);
    });
  });
});
