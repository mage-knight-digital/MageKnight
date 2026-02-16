/**
 * Tests for combat attack declaration flow (target-first attack)
 *
 * DECLARE_ATTACK_TARGETS → accumulate attack → FINALIZE_ATTACK
 * - All-or-nothing: combined armor of all targets must be met
 * - Combined resistances apply across the group
 * - Phase attack wiped after finalize
 * - END_COMBAT_PHASE does NOT auto-resolve
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_TARGETS_ACTION,
  FINALIZE_ATTACK_ACTION,
  UNDO_ACTION,
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  ENEMY_PROWLERS,
  ENEMY_FIRE_MAGES,
  ENEMY_WOLF_RIDERS,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";
import type { AccumulatedAttack } from "../../types/player.js";
import { getValidActions } from "../validActions/index.js";

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

/**
 * Helper to skip to a specific combat phase by directly setting it.
 */
function withCombatPhase(state: GameState, phase: typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_RANGED_SIEGE): GameState {
  if (!state.combat) throw new Error("Not in combat");
  return {
    ...state,
    combat: {
      ...state.combat,
      phase,
    },
  };
}

describe("Combat Attack Declaration Flow", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("DECLARE_ATTACK_TARGETS + FINALIZE_ATTACK", () => {
    it("should defeat enemies when declaring targets then finalizing with sufficient attack", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3, fame 2)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Skip to attack phase
      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give player melee attack
      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      // Finalize attack
      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Should emit ENEMY_DEFEATED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // Enemy should be defeated in state
      const enemy = result.state.combat?.enemies.find(
        (e) => e.instanceId === "enemy_0"
      );
      expect(enemy?.isDefeated).toBe(true);

      // Player fame should increase by 2 (Prowlers fame)
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.fame).toBe(2);
    });

    it("should require combined armor to defeat grouped targets", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3) + Wolf Riders (armor 4) = 7 combined
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      // Skip to attack phase
      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Declare both as targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
      }).state;

      // Give 6 melee attack — not enough for combined 7
      state = withAccumulatedAttack(state, "player1", { normal: 6 });

      // Finalize attack
      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Attack should fail
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
        })
      );

      // Neither enemy should be defeated
      const enemies = result.state.combat?.enemies ?? [];
      expect(enemies.every((e) => !e.isDefeated)).toBe(true);
    });

    it("should defeat grouped targets with sufficient combined attack", () => {
      let state = createTestGameState();

      // Enter combat with Prowlers (armor 3) + Wolf Riders (armor 4) = 7 combined
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Declare both as targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
      }).state;

      // Give 7 melee attack — exactly enough for combined 7
      state = withAccumulatedAttack(state, "player1", { normal: 7 });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Both should be defeated
      const defeatedEvents = result.events.filter(
        (e) => e.type === ENEMY_DEFEATED
      );
      expect(defeatedEvents.length).toBe(2);
    });
  });

  describe("combined resistances", () => {
    it("should apply combined resistances when grouping enemies with fire resistance", () => {
      let state = createTestGameState();

      // Fire Mages (armor 5, fire resist) + Prowlers (armor 3, no resist) = 8 combined armor
      // Fire resist applies to ALL fire damage in the group
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGES, ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Declare both as targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0", "enemy_1"],
      }).state;

      // Give 16 fire melee attack → halved to 8 effective (matches combined armor 8)
      state = withAccumulatedAttack(state, "player1", {
        normalElements: { physical: 0, fire: 16, ice: 0, coldFire: 0 },
      });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Both enemies should be defeated (16 fire → 8 effective >= 8 combined armor)
      const defeatedEvents = result.events.filter(
        (e) => e.type === ENEMY_DEFEATED
      );
      expect(defeatedEvents.length).toBe(2);
    });
  });

  describe("attack pool wiping", () => {
    it("should wipe ALL phase attack after finalize (no leftover)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give 15 melee attack — way more than needed for armor 3
      state = withAccumulatedAttack(state, "player1", { normal: 15 });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // All melee attack should be wiped to 0 (not 12 remaining)
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(0);
    });

    it("should wipe attack pool even on failed attack", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give only 2 melee attack — not enough for armor 3
      state = withAccumulatedAttack(state, "player1", { normal: 2 });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Attack should fail
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: ATTACK_FAILED })
      );

      // Attack pool should still be wiped
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(0);
    });
  });

  describe("multiple attacks per phase", () => {
    it("should support multiple declare+finalize cycles in one phase", () => {
      let state = createTestGameState();

      // Enter combat with two enemies
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS, ENEMY_WOLF_RIDERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Attack #1: Declare Prowlers, give attack, finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      state = withAccumulatedAttack(state, "player1", { normal: 5 });

      const result1 = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });
      state = result1.state;

      // Prowlers should be defeated
      expect(result1.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // Attack pool should be wiped
      let player = state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.normal).toBe(0);

      // Attack #2: Declare Wolf Riders, give new attack, finalize
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
      }).state;

      state = withAccumulatedAttack(state, "player1", { normal: 4 });

      const result2 = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Wolf Riders should be defeated
      expect(result2.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_1",
        })
      );

      // Both enemies should be defeated
      const enemies = result2.state.combat?.enemies ?? [];
      expect(enemies.every((e) => e.isDefeated)).toBe(true);
    });
  });

  describe("END_COMBAT_PHASE does NOT auto-defeat", () => {
    it("should NOT defeat enemies on end phase without FINALIZE_ATTACK", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Give plenty of melee attack but do NOT declare targets or finalize
      state = withAccumulatedAttack(state, "player1", { normal: 10 });

      // End attack phase (ends combat)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should NOT emit ENEMY_DEFEATED
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: ENEMY_DEFEATED })
      );

      // Should end combat as a loss
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
          enemiesDefeated: 0,
          enemiesSurvived: 1,
        })
      );
    });
  });

  describe("DECLARE_ATTACK_TARGETS is reversible", () => {
    it("should undo target declaration", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // Declare targets
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      expect(state.combat?.declaredAttackTargets).toEqual(["enemy_0"]);

      // Undo
      state = engine.processAction(state, "player1", {
        type: UNDO_ACTION,
      }).state;

      // Targets should be cleared
      expect(state.combat?.declaredAttackTargets).toBeUndefined();
    });
  });

  describe("ranged phase finalize then transition", () => {
    it("should finalize in ranged phase then transition to block", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Declare targets in ranged phase
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give ranged attack
      state = withAccumulatedAttack(state, "player1", { ranged: 5 });

      // Finalize attack in ranged phase
      const finalizeResult = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });
      state = finalizeResult.state;

      // Prowlers should be defeated
      expect(finalizeResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );

      // End ranged phase → transitions to block
      const endResult = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(endResult.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_PHASE_CHANGED,
          previousPhase: COMBAT_PHASE_RANGED_SIEGE,
          newPhase: COMBAT_PHASE_BLOCK,
        })
      );

      expect(endResult.state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);
    });

    it("should wipe ranged/siege attack after finalize in ranged phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      // Give ranged + siege + melee attack
      state = withAccumulatedAttack(state, "player1", {
        ranged: 5,
        siege: 4,
        normal: 3,
      });

      const result = engine.processAction(state, "player1", {
        type: FINALIZE_ATTACK_ACTION,
      });

      // Ranged and siege should be wiped, melee preserved
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.combatAccumulator.attack.ranged).toBe(0);
      expect(player?.combatAccumulator.attack.siege).toBe(0);
      expect(player?.combatAccumulator.attack.normal).toBe(3);
    });
  });

  describe("valid actions gating", () => {
    it("should offer DECLARE_ATTACK_TARGETS when no targets declared", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.canDeclareTargets).toBe(true);
      expect(validActions.combat?.declareTargetOptions).toContain("enemy_0");
    });

    it("should offer FINALIZE_ATTACK when targets are declared", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_TARGETS_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
      }).state;

      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.canFinalizeAttack).toBe(true);
      expect(validActions.combat?.declaredTargets).toEqual(["enemy_0"]);
    });

    it("should offer DECLARE_ATTACK_TARGETS but not FINALIZE_ATTACK when no targets declared", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      state = withCombatPhase(state, COMBAT_PHASE_ATTACK);

      // No targets declared → can declare but cannot finalize
      const validActions = getValidActions(state, "player1");
      expect(validActions.combat?.canDeclareTargets).toBe(true);
      expect(validActions.combat?.canFinalizeAttack).toBeUndefined();
    });
  });
});
