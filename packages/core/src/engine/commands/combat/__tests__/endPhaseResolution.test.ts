/**
 * Tests for end phase damage resolution
 *
 * These test that pending damage is resolved when ending
 * RANGED_SIEGE and ATTACK phases, applying resistances and
 * defeating enemies where effective damage >= armor.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../../../MageKnightEngine.js";
import { createTestGameState } from "../../../__tests__/testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_ATTACK_ACTION,
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  ENEMY_DEFEATED,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  ENEMY_WOLF_RIDERS,
  ATTACK_TYPE_MELEE,
  ATTACK_TYPE_RANGED,
  ATTACK_ELEMENT_PHYSICAL,
  ATTACK_ELEMENT_FIRE,
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

  describe("RANGED_SIEGE phase resolution", () => {
    it("should resolve pending damage when ending ranged/siege phase", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Give player ranged attack
      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Assign 3 ranged damage (enough to defeat Prowlers with armor 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should emit ENEMY_DEFEATED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // Should emit COMBAT_PHASE_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_PHASE_CHANGED,
          previousPhase: COMBAT_PHASE_RANGED_SIEGE,
          newPhase: COMBAT_PHASE_BLOCK,
        })
      );

      // Enemy should be marked as defeated
      const enemy = result.state.combat?.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(true);

      // Fame should be accumulated
      expect(result.state.combat?.fameGained).toBeGreaterThan(0);

      // Pending damage should be cleared
      expect(result.state.combat?.pendingDamage).toEqual({});

      // Assigned attack should be cleared
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.assignedAttack.ranged).toBe(0);
    });

    it("should not defeat enemy with insufficient damage", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Assign only 2 ranged damage (not enough to defeat armor 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2,
      }).state;

      // End ranged/siege phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should NOT emit ENEMY_DEFEATED event
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

      // Pending damage should still be cleared (damage was wasted)
      expect(result.state.combat?.pendingDamage).toEqual({});
    });
  });

  describe("ATTACK phase resolution", () => {
    it("should resolve pending damage when ending combat after attack phase", () => {
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

      // Give player melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign 3 melee damage
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      // End attack phase (ends combat)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should emit ENEMY_DEFEATED event before COMBAT_ENDED
      const defeatedIndex = result.events.findIndex(
        (e) => e.type === ENEMY_DEFEATED
      );
      const endedIndex = result.events.findIndex(
        (e) => e.type === COMBAT_ENDED
      );
      expect(defeatedIndex).toBeLessThan(endedIndex);

      // Should emit COMBAT_ENDED with victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 1,
          enemiesSurvived: 0,
        })
      );

      // Combat should be null (ended)
      expect(result.state.combat).toBeNull();
    });

    it("should resolve damage with defeat before ending combat", () => {
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

      // Give player lots of melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 10 });

      // Assign enough to defeat both enemies
      // Prowlers: armor 3, Wolf Riders: armor 4
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_1",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 4,
      }).state;

      // End attack phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Both enemies should be defeated
      const defeatedEvents = result.events.filter(
        (e) => e.type === ENEMY_DEFEATED
      );
      expect(defeatedEvents.length).toBe(2);

      // Should report 2 enemies defeated
      expect(result.events).toContainEqual(
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

      // Give player fire melee attack
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 8, ice: 0, coldFire: 0 },
      });

      // Assign 8 fire damage - should become 4 effective (halved)
      // Fire Mages have armor 5, so 4 is not enough
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_FIRE,
        amount: 8,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Enemy should NOT be defeated (8 fire → 4 effective < 5 armor)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
        })
      );

      expect(result.events).toContainEqual(
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

      // Give player fire melee attack
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 10, ice: 0, coldFire: 0 },
      });

      // Assign 10 fire damage - should become 5 effective (halved)
      // Fire Mages have armor 5, so 5 = 5 should defeat
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_FIRE,
        amount: 10,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Enemy SHOULD be defeated (10 fire → 5 effective = 5 armor)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      expect(result.events).toContainEqual(
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

      // Give player both physical and fire attack
      state = withAccumulatedAttack(state, "player1", {
        normal: 3,
        normalElements: { physical: 0, fire: 4, ice: 0, coldFire: 0 },
      });

      // Assign 3 physical (unresisted) + 4 fire (→ 2 effective)
      // Total: 3 + 2 = 5 = armor
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_FIRE,
        amount: 4,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
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
    it("should accumulate fame from defeated enemies", () => {
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

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Assign enough to defeat
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_MELEE,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 3,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // COMBAT_ENDED should report total fame gained
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          totalFameGained: expect.any(Number),
        })
      );

      // Fame gained should be positive
      const combatEndedEvent = result.events.find(
        (e) => e.type === COMBAT_ENDED
      );
      expect(
        combatEndedEvent && "totalFameGained" in combatEndedEvent
          ? combatEndedEvent.totalFameGained
          : 0
      ).toBeGreaterThan(initialFameGained);
    });
  });

  describe("state clearing after resolution", () => {
    it("should clear pending damage after ranged/siege resolution", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Assign some damage
      state = engine.processAction(state, "player1", {
        type: ASSIGN_ATTACK_ACTION,
        enemyInstanceId: "enemy_0",
        attackType: ATTACK_TYPE_RANGED,
        element: ATTACK_ELEMENT_PHYSICAL,
        amount: 2, // Not enough to defeat
      }).state;

      expect(state.combat?.pendingDamage["enemy_0"]).toBeDefined();

      // End phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Pending damage should be cleared even though enemy wasn't defeated
      expect(result.state.combat?.pendingDamage).toEqual({});
    });

    it("should clear assigned attack after resolution", () => {
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

    it("should preserve accumulated attack after resolution", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withAccumulatedAttack(state, "player1", { ranged: 5, normal: 3 });

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

      // Accumulated attack should be preserved (for attack phase)
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.ranged).toBe(5);
      expect(player?.combatAccumulator.attack.normal).toBe(3);
    });
  });
});
