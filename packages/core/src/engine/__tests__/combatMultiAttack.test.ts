/**
 * Combat Multi-Attack Tests
 *
 * Tests for enemies with multiple attacks per the rulebook rules:
 * - Attacks are handled separately, one by one, in any order
 * - Cannot group attacks into a single block - each needs its own block value
 * - "Successfully blocked" means ALL attacks are blocked (for Disease, Counterattack, Elusive)
 * - Attack-prevention effects stop ALL attacks
 * - Attack-modifying effects apply to ONE attack (player choice)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withBlockSources } from "./combatTestHelpers.js";
import type { GameState } from "../../state/GameState.js";
import type { CombatEnemy, CombatState } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  DAMAGE_ASSIGNED,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ENEMY_COLOR_GREEN,
  ENEMY_DIGGERS,
} from "@mage-knight/shared";
import type { EnemyDefinition } from "@mage-knight/shared";

/**
 * Create a test multi-attack enemy definition.
 * Two physical attacks of 3 damage each.
 */
function createMultiAttackEnemy(): EnemyDefinition {
  return {
    id: ENEMY_DIGGERS, // Use existing ID to pass validation
    name: "Test Multi-Attack Enemy",
    color: ENEMY_COLOR_GREEN,
    attack: 3, // Legacy field (first attack)
    attackElement: ELEMENT_PHYSICAL,
    armor: 4,
    fame: 3,
    resistances: [],
    abilities: [],
    attacks: [
      { damage: 3, element: ELEMENT_PHYSICAL },
      { damage: 2, element: ELEMENT_PHYSICAL },
    ],
  };
}

/**
 * Create a test multi-attack enemy with mixed elements.
 */
function createMixedElementMultiAttackEnemy(): EnemyDefinition {
  return {
    id: ENEMY_DIGGERS,
    name: "Test Mixed Element Enemy",
    color: ENEMY_COLOR_GREEN,
    attack: 4,
    attackElement: ELEMENT_FIRE,
    armor: 5,
    fame: 4,
    resistances: [],
    abilities: [],
    attacks: [
      { damage: 4, element: ELEMENT_FIRE },
      { damage: 3, element: ELEMENT_ICE },
    ],
  };
}

/**
 * Create a combat state with a custom multi-attack enemy.
 */
function createMultiAttackCombatState(
  enemy: EnemyDefinition,
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_ASSIGN_DAMAGE = COMBAT_PHASE_BLOCK
): CombatState {
  const combatEnemy: CombatEnemy = {
    instanceId: "enemy_0",
    enemyId: enemy.id,
    definition: enemy,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    // Initialize per-attack tracking for multi-attack enemies
    attacksBlocked: enemy.attacks?.map(() => false),
    attacksDamageAssigned: enemy.attacks?.map(() => false),
  };

  return {
    phase,
    enemies: [combatEnemy],
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite: false,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin: null,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
    pendingSwiftBlock: {},
    combatContext: "standard",
  };
}

/**
 * Create a test state in combat with a multi-attack enemy.
 */
function createStateWithMultiAttackEnemy(
  enemy: EnemyDefinition,
  phase: typeof COMBAT_PHASE_RANGED_SIEGE | typeof COMBAT_PHASE_BLOCK | typeof COMBAT_PHASE_ASSIGN_DAMAGE = COMBAT_PHASE_BLOCK
): GameState {
  const baseState = createTestGameState();
  return {
    ...baseState,
    combat: createMultiAttackCombatState(enemy, phase),
  };
}

describe("Combat Multi-Attack", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Per-attack blocking", () => {
    it("should allow blocking first attack only", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block first attack (attack 3) with block 3
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      // First attack should be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[0]).toBe(true);
      // Second attack should not be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[1]).toBe(false);
      // Enemy should not be fully blocked (isBlocked flag)
      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      // Should emit ENEMY_BLOCKED event with attackIndex
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          attackIndex: 0,
          blockValue: 3,
        })
      );
    });

    it("should allow blocking second attack only", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block second attack (attack 2) with block 2
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 1,
      });

      // First attack should not be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[0]).toBe(false);
      // Second attack should be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[1]).toBe(true);
      // Enemy should not be fully blocked
      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
    });

    it("should set isBlocked when all attacks are blocked", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block first attack
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Block second attack
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 1,
      });

      // Both attacks should be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[0]).toBe(true);
      expect(result.state.combat?.enemies[0].attacksBlocked?.[1]).toBe(true);
      // Enemy should now be fully blocked
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should fail to block with insufficient block value", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Try to block first attack (needs 3) with only 2
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 2 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      // Attack should not be blocked
      expect(result.state.combat?.enemies[0].attacksBlocked?.[0]).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          attackIndex: 0,
        })
      );
    });

    it("should reject blocking an already blocked attack", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block first attack
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Try to block first attack again
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should reject invalid attack index", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Try to block attack index 2 (enemy only has 2 attacks: indices 0 and 1)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 2,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Per-attack damage assignment", () => {
    it("should allow assigning damage from first attack only", () => {
      const enemy = createMultiAttackEnemy();
      const state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage from first attack
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      // First attack should have damage assigned
      expect(result.state.combat?.enemies[0].attacksDamageAssigned?.[0]).toBe(true);
      // Second attack should not
      expect(result.state.combat?.enemies[0].attacksDamageAssigned?.[1]).toBe(false);
      // Enemy should not be fully assigned
      expect(result.state.combat?.enemies[0].damageAssigned).toBe(false);
      // Should emit DAMAGE_ASSIGNED event with attackIndex
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          enemyInstanceId: "enemy_0",
          attackIndex: 0,
          damage: 3,
        })
      );
    });

    it("should set damageAssigned when all unblocked attacks have damage assigned", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage from first attack
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Assign damage from second attack
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 1,
      });

      // Both attacks should have damage assigned
      expect(result.state.combat?.enemies[0].attacksDamageAssigned?.[0]).toBe(true);
      expect(result.state.combat?.enemies[0].attacksDamageAssigned?.[1]).toBe(true);
      // Enemy should now be fully assigned
      expect(result.state.combat?.enemies[0].damageAssigned).toBe(true);
    });

    it("should not require damage assignment for blocked attacks", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block first attack
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Advance to ASSIGN_DAMAGE phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to assign damage from blocked attack - should fail
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    it("should allow assigning damage only from unblocked attack when one is blocked", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block first attack only
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Advance to ASSIGN_DAMAGE phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from second (unblocked) attack
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 1,
      });

      // Second attack should have damage assigned
      expect(result.state.combat?.enemies[0].attacksDamageAssigned?.[1]).toBe(true);
      // Enemy should be fully assigned (first is blocked, second has damage assigned)
      expect(result.state.combat?.enemies[0].damageAssigned).toBe(true);
    });

    it("should reject assigning damage from already assigned attack", () => {
      const enemy = createMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage from first attack
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 0,
      }).state;

      // Try to assign damage from first attack again
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
        attackIndex: 0,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });
  });

  describe("Mixed element multi-attack", () => {
    it("should handle different elemental blocks for different attacks", () => {
      const enemy = createMixedElementMultiAttackEnemy();
      let state = createStateWithMultiAttackEnemy(enemy, COMBAT_PHASE_BLOCK);

      // Block fire attack with ice (efficient)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 4 },
      ]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 0, // Fire attack
      }).state;

      // Block ice attack with fire (efficient)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_FIRE, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        attackIndex: 1, // Ice attack
      });

      // Both attacks should be blocked
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });
  });

  describe("Backwards compatibility", () => {
    it("should handle single-attack enemies with default attackIndex", () => {
      // Enter combat with regular single-attack enemy
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS], // Single-attack enemy
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block without specifying attackIndex (should default to 0)
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
        // No attackIndex specified - should work for single-attack enemies
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });
  });
});
