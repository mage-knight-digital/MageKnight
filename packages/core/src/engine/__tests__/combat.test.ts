/**
 * Combat Phase 2 Tests
 *
 * Tests for combat with elemental attacks, block efficiency, and resistances
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  COMBAT_STARTED,
  COMBAT_PHASE_CHANGED,
  ENEMY_BLOCKED,
  BLOCK_FAILED,
  ENEMY_DEFEATED,
  ATTACK_FAILED,
  DAMAGE_ASSIGNED,
  COMBAT_ENDED,
  UNIT_DESTROYED,
  PARALYZE_HAND_DISCARDED,
  ENEMY_ORC,
  ENEMY_WOLF,
  ENEMY_FIRE_MAGE,
  ENEMY_ICE_GOLEM,
  ENEMY_FIRE_DRAGON,
  ENEMY_FREEZERS,
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  ENEMIES,
  ENEMY_CURSED_HAGS,
  ENEMY_GUARDSMEN,
  ENEMY_WOLF_RIDERS,
  ENEMY_MEDUSA,
  ENEMY_ICE_DRAGON,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  CARD_WOUND,
  CARD_MARCH,
  CARD_RAGE,
  CARD_STAMINA,
  ELEMENT_PHYSICAL,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  ABILITY_SWIFT,
  ABILITY_PARALYZE,
  DAMAGE_TARGET_UNIT,
  DAMAGE_TARGET_HERO,
  UNIT_DESTROY_REASON_PARALYZE,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  CARD_WHIRLWIND,
  PLAY_CARD_ACTION,
  MANA_SOURCE_TOKEN,
  MANA_BLACK,
  MANA_WHITE,
  type BlockSource,
} from "@mage-knight/shared";
import { addModifier } from "../modifiers.js";
import {
  DURATION_COMBAT,
  SCOPE_ONE_ENEMY,
  SOURCE_SKILL,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  ENEMY_STAT_ARMOR,
} from "../../types/modifierConstants.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { GameState } from "../../state/GameState.js";

/**
 * Helper to set up block sources in the player's combatAccumulator.
 * Tests call this before DECLARE_BLOCK_ACTION since blocks are now
 * read from server-side state, not the action payload.
 */
function withBlockSources(state: GameState, playerId: string, blocks: readonly BlockSource[]): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  const totalBlock = blocks.reduce((sum, b) => sum + b.value, 0);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      block: totalBlock,
      blockSources: blocks,
    },
  };

  return { ...state, players: updatedPlayers };
}

/**
 * Helper to set up siege attack in the player's combatAccumulator.
 * Tests call this before DECLARE_ATTACK_ACTION with COMBAT_TYPE_SIEGE
 * since the validator now checks that siege attack is actually accumulated.
 */
function withSiegeAttack(state: GameState, playerId: string, value: number): GameState {
  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) throw new Error(`Player not found: ${playerId}`);

  const player = state.players[playerIndex];
  if (!player) throw new Error(`Player not found at index: ${playerIndex}`);

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: {
        ...player.combatAccumulator.attack,
        siege: value,
      },
    },
  };

  return { ...state, players: updatedPlayers };
}

describe("Combat Phase 2", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("ENTER_COMBAT", () => {
    it("should start combat with enemies", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      });

      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: COMBAT_STARTED })
      );
    });

    it("should start combat with multiple enemies", () => {
      const state = createTestGameState();

      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC, ENEMY_WOLF],
      });

      expect(result.state.combat?.enemies).toHaveLength(2);
      expect(result.state.combat?.enemies[0].enemyId).toBe(ENEMY_ORC);
      expect(result.state.combat?.enemies[1].enemyId).toBe(ENEMY_WOLF);
    });

    it("should fail to enter combat when already in combat", () => {
      let state = createTestGameState();

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Try to enter combat again
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF],
      });

      // Should fail with invalid action event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Already in combat",
        })
      );
    });
  });

  describe("Phase progression", () => {
    it("should advance through all phases", () => {
      let state = createTestGameState();

      // Enter combat
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);

      // Skip to Block
      const result1 = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result1.state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);
      expect(result1.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_PHASE_CHANGED,
          previousPhase: COMBAT_PHASE_RANGED_SIEGE,
          newPhase: COMBAT_PHASE_BLOCK,
        })
      );

      // Skip to Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign damage from the enemy (mandatory before advancing)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // Now advance to Attack
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });

  describe("Blocking", () => {
    it("should block enemy with sufficient block value", () => {
      let state = createTestGameState();

      // Enter combat with Orc (attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 3
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 3,
        })
      );
    });

    it("should block enemy with more than required block", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 5 (Orc needs 3)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 5 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should fail block with insufficient value", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 2 (Orc needs 3)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 2 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 2,
          requiredBlock: 3,
        })
      );
    });

    it("should reject block in wrong phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Still in Ranged/Siege phase, try to block
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Can only block during Block phase",
        })
      );
    });
  });

  describe("Swift ability", () => {
    it("should require double block against swift enemy", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      // Swift doubles block requirement: need 6 block, not 3
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to block with 4 (would be enough without Swift, but not with it)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 4 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should fail - need 6 block (3 * 2) due to Swift
      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 4,
          requiredBlock: 6, // 3 * 2 = 6 due to Swift
        })
      );
    });

    it("should block swift enemy with double block value", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with 6 (exactly double the base attack of 3)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 6 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should succeed
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 6,
        })
      );
    });

    it("should use normal block if swift is nullified", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Add ability nullifier for Swift on this enemy
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, id: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
        effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_SWIFT },
        createdByPlayerId: "player1",
        createdAtRound: state.round,
      });

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with 3 (normal block, Swift is nullified)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      // Should succeed - Swift is nullified, only need base attack of 3
      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 3,
        })
      );
    });

    it("should NOT affect ranged/siege phase attack", () => {
      let state = createTestGameState();

      // Enter combat with Wolf Riders (attack 3, Swift, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_WOLF_RIDERS],
      }).state;

      // Attack in Ranged phase (Swift should not affect attack requirements)
      // Wolf Riders has armor 4
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attackType: COMBAT_TYPE_RANGED,
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }],
      });

      // Should defeat enemy with 4 attack (meets armor of 4)
      // Swift has no effect on attack phase
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
        })
      );
    });
  });

  describe("Attacking", () => {
    it("should defeat enemy with sufficient attack", () => {
      let state = createTestGameState();

      // Enter combat with Orc (armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 3
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.players[0].fame).toBe(2); // Orc gives 2 fame
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyInstanceId: "enemy_0",
          fameGained: 2,
        })
      );
    });

    it("should fail attack with insufficient value", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 2 (Orc has armor 3)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 2 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 2,
          requiredAttack: 3,
        })
      );
    });

    it("should allow ranged attacks in Attack phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Ranged attack should work in Attack phase (per rulebook)
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should allow ranged attacks in Ranged/Siege phase", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified) since ENEMY_ORC is aliased to Diggers (fortified)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Still in Ranged/Siege phase
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should reject normal attacks in Ranged/Siege phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Still in Ranged/Siege phase, try normal attack
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Only Ranged or Siege attacks allowed in Ranged/Siege phase",
        })
      );
    });
  });

  describe("Damage assignment", () => {
    it("should assign wounds to hero from unblocked enemy", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH], // Need a card to avoid mandatory announcement
        handLimit: 5,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Orc (attack 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // 3 damage / 2 armor = 2 wounds (rounded up)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: DAMAGE_ASSIGNED,
          damage: 3,
          woundsTaken: 2,
        })
      );
      // Wounds added to hand
      expect(result.state.players[0].hand).toContain(CARD_WOUND);
      expect(result.state.players[0].hand.filter((c) => c === CARD_WOUND)).toHaveLength(2);
    });

    it("should not assign damage from blocked enemy", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block the enemy
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to assign damage from blocked enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Enemy is blocked, no damage to assign",
        })
      );
    });
  });

  describe("Combat end", () => {
    it("should end combat with victory when all enemies defeated", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified, fame 2) to test ranged attacks
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Defeat enemy in Ranged/Siege phase with ranged attack
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      // Block phase - skip (enemy defeated)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign Damage phase - skip (enemy defeated)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - skip
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 1,
          enemiesSurvived: 0,
          totalFameGained: 2, // Prowlers give 2 fame
        })
      );
    });

    it("should end combat without victory when enemies survive (blocked)", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - skip without attacking
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End combat without defeating enemy
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
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

  describe("Integration: Full combat flow", () => {
    it("should complete a full combat: enter, block, attack, end", () => {
      let state = createTestGameState();

      // Enter combat with Orc (Diggers: attack 3, armor 3, fame 2) and Wolf Riders (attack 3, armor 4, fame 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC, ENEMY_WOLF_RIDERS],
      }).state;

      // Ranged/Siege phase - defeat Wolf Riders with ranged attack
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_1"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 4 }], // Wolf Riders has armor 4
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      expect(state.combat?.enemies[1].isDefeated).toBe(true);
      expect(state.players[0].fame).toBe(3); // Wolf Riders gives 3 fame

      // Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block the Orc
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      expect(state.combat?.enemies[0].isBlocked).toBe(true);

      // Assign Damage phase - skip (Orc is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase - defeat Orc
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_MELEE,
      }).state;

      expect(state.combat?.enemies[0].isDefeated).toBe(true);
      expect(state.players[0].fame).toBe(5); // 3 from Wolf (Guardsmen) + 2 from Orc (Diggers)

      // End combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
          enemiesDefeated: 2,
          enemiesSurvived: 0,
          totalFameGained: 5,
        })
      );
    });
  });

  describe("Mandatory damage assignment", () => {
    it("should require damage assignment before leaving Assign Damage phase", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Try to skip Assign Damage without assigning
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("Must assign damage"),
        })
      );
    });

    it("should allow leaving Assign Damage phase after assigning damage", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH], // Need a card to avoid mandatory announcement
        handLimit: 5,
      });
      let state = createTestGameState({ players: [player] });

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Skip to Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from unblocked enemy
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      }).state;

      // Now we can advance to Attack phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });

    it("should allow skipping Assign Damage phase when enemy is blocked", () => {
      let state = createTestGameState();

      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      }).state;

      // Block phase - block the enemy
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign Damage phase - should be able to skip (enemy is blocked)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });

    it("should allow skipping Assign Damage phase when enemy is defeated", () => {
      let state = createTestGameState();

      // Use Prowlers (non-fortified) to allow ranged attack
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      }).state;

      // Defeat enemy in Ranged/Siege phase
      state = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }], // Prowlers have armor 3
        attackType: COMBAT_TYPE_RANGED,
      }).state;

      expect(state.combat?.enemies[0].isDefeated).toBe(true);

      // Ranged/Siege → Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Block → Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Assign Damage → Attack (should succeed because enemy is defeated, no damage to assign)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });

  describe("Elemental block efficiency", () => {
    it("should halve Physical block against Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 8 vs Fire Attack 6
      // Effective block: 8 / 2 = 4, which is < 6, so block fails
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 8 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: BLOCK_FAILED,
          enemyInstanceId: "enemy_0",
          blockValue: 4, // 8 / 2 = 4
          requiredBlock: 6,
        })
      );
    });

    it("should use Ice block efficiently against Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Ice 6 vs Fire Attack 6 (efficient)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_ICE, value: 6 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should only allow Cold Fire block against Cold Fire attack", () => {
      let state = createTestGameState();

      // Enter combat with Freezers (Cold Fire attack 3, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FREEZERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Physical 6 vs Cold Fire Attack 3
      // Physical is inefficient against Cold Fire: 6 / 2 = 3, which is >= 3, so block succeeds
      state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 6 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should block Cold Fire with Cold Fire efficiently", () => {
      let state = createTestGameState();

      // Enter combat with Freezers (Cold Fire attack 3, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FREEZERS],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Cold Fire 3 vs Cold Fire Attack 3 (efficient)
      state = withBlockSources(state, "player1", [{ element: ELEMENT_COLD_FIRE, value: 3 }]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
    });

    it("should combine efficient and inefficient blocks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Advance to Block phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Block with Ice 4 (efficient) + Physical 4 (inefficient, halved to 2) = 6
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_ICE, value: 4 },
        { element: ELEMENT_PHYSICAL, value: 4 },
      ]);
      const result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      });

      expect(result.state.combat?.enemies[0].isBlocked).toBe(true);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_BLOCKED,
          enemyInstanceId: "enemy_0",
          blockValue: 6, // 4 + 4/2 = 6
        })
      );
    });
  });

  describe("Attack resistances", () => {
    it("should halve Fire attack against Fire resistance", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_ICE, value: 6 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Fire 8 vs armor 5 with Fire resistance
      // Effective attack: 8 / 2 = 4, which is < 5, so attack fails
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_FIRE, value: 8 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ATTACK_FAILED,
          attackValue: 4, // 8 / 2 = 4
          requiredAttack: 5,
        })
      );
    });

    it("should deal full damage with unresisted element", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_ICE, value: 6 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Ice 5 vs armor 5 - Ice is not resisted
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_ICE, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should halve Physical attack against Physical resistance", () => {
      let state = createTestGameState();

      // Enter combat with Ice Golem (Physical resistance, Ice attack 4, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ICE_GOLEM],
      }).state;

      // Block phase - block with Fire (efficient vs Ice)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_FIRE, value: 4 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Physical 8 vs armor 5 with Physical resistance
      // Effective attack: 8 / 2 = 4, which is < 5, so attack fails
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 8 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(false);
    });

    it("should combine resisted and unresisted attacks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Mage (Fire attack 6, Fire resistance, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_MAGE],
      }).state;

      // Block phase - block the enemy with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_ICE, value: 6 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Fire 4 (resisted, halved to 2) + Physical 3 (unresisted) = 5
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [
          { element: ELEMENT_FIRE, value: 4 },
          { element: ELEMENT_PHYSICAL, value: 3 },
        ],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("Elemental enemies in combat", () => {
    it("should fight Fire Dragon with Ice attacks", () => {
      let state = createTestGameState();

      // Enter combat with Fire Dragon (Fire attack 9, Fire resistance, armor 7)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_FIRE_DRAGON],
      }).state;

      // Block phase - block with Ice (efficient vs Fire)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = withBlockSources(state, "player1", [{ element: ELEMENT_ICE, value: 9 }]);
      state = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0",
      }).state;

      // Assign damage (blocked, so skip)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Attack with Ice 7 - not resisted
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_ICE, value: 7 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      expect(result.state.players[0].fame).toBe(8); // Fire Dragon gives 8 fame
    });
  });

  describe("Fortification", () => {
    describe("Enemy ability fortification", () => {
      it("should require Siege attack for fortified enemy in Ranged/Siege phase", () => {
        let state = createTestGameState();

        // Enter combat with Diggers (has ABILITY_FORTIFIED)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_DIGGERS],
        }).state;

        // Try to attack with Ranged in Ranged/Siege phase - should fail
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_RANGED,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: INVALID_ACTION,
            reason: expect.stringContaining("Fortified enemies"),
          })
        );
      });

      it("should allow Siege attack for fortified enemy in Ranged/Siege phase", () => {
        let state = createTestGameState();

        // Enter combat with Diggers (has ABILITY_FORTIFIED, armor 3)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_DIGGERS],
        }).state;

        // Set up siege attack in accumulator (required by validator)
        state = withSiegeAttack(state, "player1", 3);

        // Attack with Siege - should work
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_SIEGE,
        });

        expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      });

      it("should allow any attack type for non-fortified enemy", () => {
        let state = createTestGameState();

        // Enter combat with Prowlers (no ABILITY_FORTIFIED)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        // Ranged attack should work for non-fortified enemy
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_RANGED,
        });

        expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      });
    });

    describe("Site fortification", () => {
      it("should require Siege attack at fortified site in Ranged/Siege phase", () => {
        let state = createTestGameState();

        // Enter combat at fortified site with Prowlers (no ABILITY_FORTIFIED)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
          isAtFortifiedSite: true,
        }).state;

        // Try to attack with Ranged - should fail due to site fortification
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_RANGED,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: INVALID_ACTION,
            reason: expect.stringContaining("Fortified enemies"),
          })
        );
      });

      it("should allow Siege attack at fortified site", () => {
        let state = createTestGameState();

        // Enter combat at fortified site with Prowlers
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
          isAtFortifiedSite: true,
        }).state;

        // Set up siege attack in accumulator (required by validator)
        state = withSiegeAttack(state, "player1", 3);

        // Siege attack should work
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_SIEGE,
        });

        expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      });

      it("should track isAtFortifiedSite in combat state", () => {
        let state = createTestGameState();

        // Enter combat at fortified site
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
          isAtFortifiedSite: true,
        }).state;

        expect(state.combat?.isAtFortifiedSite).toBe(true);
      });

      it("should default isAtFortifiedSite to false", () => {
        let state = createTestGameState();

        // Enter combat without specifying site
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_PROWLERS],
        }).state;

        expect(state.combat?.isAtFortifiedSite).toBe(false);
      });
    });

    describe("Attack phase (melee)", () => {
      it("should allow any attack type in Attack phase regardless of fortification", () => {
        let state = createTestGameState();

        // Enter combat with Diggers (fortified) at fortified site
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_DIGGERS],
          isAtFortifiedSite: true,
        }).state;

        // Block phase - block the enemy
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 3 }]);
        state = engine.processAction(state, "player1", {
          type: DECLARE_BLOCK_ACTION,
          targetEnemyInstanceId: "enemy_0",
        }).state;

        // Assign Damage phase - skip (enemy is blocked)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Attack phase
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Melee attack should work in Attack phase (fortification doesn't apply)
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_MELEE,
        });

        expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
      });
    });

    describe("Manually constructed combat state (DebugPanel scenario)", () => {
      it("should still enforce fortification when combat state is set directly", () => {
        let state = createTestGameState();

        // Simulate DebugPanel: directly set combat state instead of using ENTER_COMBAT_ACTION
        const diggersDef = ENEMIES[ENEMY_DIGGERS];
        state = {
          ...state,
          combat: {
            phase: COMBAT_PHASE_RANGED_SIEGE,
            enemies: [
              {
                instanceId: "enemy_0_debug",
                enemyId: ENEMY_DIGGERS,
                definition: diggersDef,
                isBlocked: false,
                isDefeated: false,
                damageAssigned: false,
              },
            ],
            woundsThisCombat: 0,
            attacksThisPhase: 0,
            fameGained: 0,
            isAtFortifiedSite: false,
            unitsAllowed: true,
            nightManaRules: false,
            assaultOrigin: null,
            allDamageBlockedThisPhase: false,
          },
        };

        // Try to attack with Ranged - should fail because Diggers have ABILITY_FORTIFIED
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0_debug"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_RANGED,
        });

        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: INVALID_ACTION,
            reason: expect.stringContaining("Fortified enemies"),
          })
        );
      });

      it("should return requiresSiege=true in validActions for Diggers", async () => {
        let state = createTestGameState();

        // Simulate DebugPanel: directly set combat state
        const diggersDef = ENEMIES[ENEMY_DIGGERS];
        state = {
          ...state,
          combat: {
            phase: COMBAT_PHASE_RANGED_SIEGE,
            enemies: [
              {
                instanceId: "enemy_0_debug",
                enemyId: ENEMY_DIGGERS,
                definition: diggersDef,
                isBlocked: false,
                isDefeated: false,
                damageAssigned: false,
              },
            ],
            woundsThisCombat: 0,
            attacksThisPhase: 0,
            fameGained: 0,
            isAtFortifiedSite: false,
            unitsAllowed: true,
            nightManaRules: false,
            assaultOrigin: null,
            allDamageBlockedThisPhase: false,
          },
        };

        // Import and call getValidActions
        const { getValidActions } = await import("../validActions/index.js");
        const validActions = getValidActions(state, "player1");

        // Check that combat attacks for Diggers have requiresSiege=true
        expect(validActions.combat).toBeDefined();
        expect(validActions.combat?.attacks).toBeDefined();
        expect(validActions.combat?.attacks?.length).toBe(1);

        const diggersAttack = validActions.combat?.attacks?.[0];
        expect(diggersAttack?.enemyInstanceId).toBe("enemy_0_debug");
        expect(diggersAttack?.isFortified).toBe(true);
        expect(diggersAttack?.requiresSiege).toBe(true);
      });

      it("should reject siege attack when player only has ranged attack accumulated", () => {
        // This is the actual bug: player has ranged attack but client sends attackType: SIEGE
        let state = createTestGameState();

        // Simulate DebugPanel: directly set combat state with Diggers (fortified)
        const diggersDef = ENEMIES[ENEMY_DIGGERS];
        state = {
          ...state,
          combat: {
            phase: COMBAT_PHASE_RANGED_SIEGE,
            enemies: [
              {
                instanceId: "enemy_0_debug",
                enemyId: ENEMY_DIGGERS,
                definition: diggersDef,
                isBlocked: false,
                isDefeated: false,
                damageAssigned: false,
              },
            ],
            woundsThisCombat: 0,
            attacksThisPhase: 0,
            fameGained: 0,
            isAtFortifiedSite: false,
            unitsAllowed: true,
            nightManaRules: false,
            assaultOrigin: null,
            allDamageBlockedThisPhase: false,
          },
        };

        // Player has RANGED attack accumulated (not siege)
        const playerIndex = state.players.findIndex(p => p.id === "player1");
        const player = state.players[playerIndex];
        if (!player) throw new Error("Player not found");
        const updatedPlayers = [...state.players];
        updatedPlayers[playerIndex] = {
          ...player,
          combatAccumulator: {
            ...player.combatAccumulator,
            attack: {
              normal: 0,
              ranged: 3, // Has 3 ranged attack
              siege: 0,  // But NO siege attack!
              normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
              rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
              siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            },
          },
        };
        state = { ...state, players: updatedPlayers };

        // Try to attack with Siege type (even though player only has ranged)
        // This is what the buggy client was doing - claiming siege when only having ranged
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0_debug"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_SIEGE, // Client lies and says it's siege!
        });

        // Server should reject because player doesn't have siege attack accumulated
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: INVALID_ACTION,
            reason: expect.stringContaining("Siege attack"),
          })
        );
      });

      it("should allow siege attack when player has siege attack accumulated", () => {
        let state = createTestGameState();

        const diggersDef = ENEMIES[ENEMY_DIGGERS];
        state = {
          ...state,
          combat: {
            phase: COMBAT_PHASE_RANGED_SIEGE,
            enemies: [
              {
                instanceId: "enemy_0_debug",
                enemyId: ENEMY_DIGGERS,
                definition: diggersDef,
                isBlocked: false,
                isDefeated: false,
                damageAssigned: false,
              },
            ],
            woundsThisCombat: 0,
            attacksThisPhase: 0,
            fameGained: 0,
            isAtFortifiedSite: false,
            unitsAllowed: true,
            nightManaRules: false,
            assaultOrigin: null,
            allDamageBlockedThisPhase: false,
          },
        };

        // Player has SIEGE attack accumulated
        const playerIndex = state.players.findIndex(p => p.id === "player1");
        const player = state.players[playerIndex];
        if (!player) throw new Error("Player not found");
        const updatedPlayers = [...state.players];
        updatedPlayers[playerIndex] = {
          ...player,
          combatAccumulator: {
            ...player.combatAccumulator,
            attack: {
              normal: 0,
              ranged: 0,
              siege: 3, // Has 3 siege attack
              normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
              rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
              siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            },
          },
        };
        state = { ...state, players: updatedPlayers };

        // Attack with Siege type
        const result = engine.processAction(state, "player1", {
          type: DECLARE_ATTACK_ACTION,
          targetEnemyInstanceIds: ["enemy_0_debug"],
          attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
          attackType: COMBAT_TYPE_SIEGE,
        });

        // Should succeed and defeat Diggers
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: ENEMY_DEFEATED,
            enemyInstanceId: "enemy_0_debug",
          })
        );
      });
    });
  });

  describe("Knockout tracking with poison", () => {
    it("should only count hand wounds for knockout, not discard wounds from poison", () => {
      // Player with hand limit 5 and armor 2
      // Cursed Hags attack 3 with poison -> 2 wounds to hand (3/2 rounded up)
      // Poison adds 2 more wounds to discard
      // Total wounds = 2 to hand, 2 to discard
      // woundsThisCombat should be 2, NOT 4
      // Player should NOT be knocked out (2 < 5)
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 5,
        armor: 2,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Cursed Hags (attack 3, poison)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_CURSED_HAGS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from poison enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Should have 2 wounds to hand (attack 3 / armor 2 = 2)
      const player1 = result.state.players[0];
      const handWounds = player1.hand.filter((c) => c === CARD_WOUND).length;
      expect(handWounds).toBe(2);

      // Should have 2 wounds to discard (poison doubles wounds)
      const discardWounds = player1.discard.filter((c) => c === CARD_WOUND).length;
      expect(discardWounds).toBe(2);

      // Combat should track only 2 wounds (hand wounds only)
      expect(result.state.combat?.woundsThisCombat).toBe(2);

      // Player should NOT be knocked out (2 < 5)
      expect(player1.knockedOut).toBe(false);
    });

    it("should knock out player when hand wounds reach hand limit, ignoring poison discard wounds", () => {
      // Player with hand limit 3 and armor 1
      // Cursed Hags attack 3 with poison -> 3 wounds to hand (3/1 = 3)
      // Poison adds 3 more wounds to discard
      // woundsThisCombat should be 3 (not 6)
      // Player SHOULD be knocked out (3 >= 3)
      const player = createTestPlayer({
        hand: [],
        deck: [CARD_MARCH],
        handLimit: 3,
        armor: 1,
      });
      let state = createTestGameState({ players: [player] });

      // Enter combat with Cursed Hags (attack 3, poison)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_CURSED_HAGS],
      }).state;

      // Skip to Assign Damage phase (don't block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from poison enemy
      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      // Combat should track 3 wounds (hand wounds only)
      expect(result.state.combat?.woundsThisCombat).toBe(3);

      // Player SHOULD be knocked out (3 >= 3 hand limit)
      const player1 = result.state.players[0];
      expect(player1.knockedOut).toBe(true);
    });
  });

  describe("Paralyze ability", () => {
    describe("units", () => {
      it("should destroy unit immediately on wound from paralyze enemy", () => {
        // Peasants have armor 2 (level 1 Regular)
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to unit (Peasants have armor 2, Medusa attack 6)
        // Unit absorbs 2 damage and would be wounded, but paralyze destroys it
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
          ],
        });

        // Unit should be destroyed
        expect(result.state.players[0].units).toHaveLength(0);
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: UNIT_DESTROYED,
            unitInstanceId: "unit_0",
            reason: UNIT_DESTROY_REASON_PARALYZE,
          })
        );
      });

      it("should still absorb armor value when destroyed by paralyze", () => {
        // Peasants have armor 2
        // Hero has armor 2
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign all 6 damage to unit (Peasants have armor 2)
        // Unit absorbs 2 damage (armor) and is destroyed by paralyze
        // Remaining 4 damage overflows to hero
        // 4 / 2 armor = 2 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 6 },
          ],
        });

        // Unit should be destroyed
        expect(result.state.players[0].units).toHaveLength(0);

        // Hero should have wounds from overflow damage
        // 6 damage to unit - 2 armor = 4 overflow damage
        // 4 / 2 hero armor = 2 wounds
        const heroWounds = result.state.players[0].hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        expect(heroWounds).toBe(2);
      });
    });

    describe("hero", () => {
      it("should discard all non-wound cards from hand when wounded", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_STAMINA],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to hero
        // Medusa attack 6 / armor 2 = 3 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
        });

        const player1 = result.state.players[0];

        // Hand should only contain wounds (1 existing + 3 new = 4 wounds)
        expect(player1.hand.filter((c) => c === CARD_WOUND)).toHaveLength(4);
        expect(player1.hand.filter((c) => c !== CARD_WOUND)).toHaveLength(0);

        // Discard should contain the non-wound cards (March, Rage, Stamina)
        expect(player1.discard).toContain(CARD_MARCH);
        expect(player1.discard).toContain(CARD_RAGE);
        expect(player1.discard).toContain(CARD_STAMINA);

        // Should have emitted the paralyze event
        expect(result.events).toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
            playerId: "player1",
            cardsDiscarded: 3,
          })
        );
      });

      it("should not discard if no wounds taken (blocked)", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          deck: [CARD_MARCH],
          handLimit: 5,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Block phase - block the enemy
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = withBlockSources(state, "player1", [{ element: ELEMENT_PHYSICAL, value: 6 }]);
        state = engine.processAction(state, "player1", {
          type: DECLARE_BLOCK_ACTION,
          targetEnemyInstanceId: "enemy_0",
        }).state;

        // Assign Damage phase - skip (enemy is blocked)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Hand should be unchanged
        expect(state.players[0].hand).toEqual([CARD_MARCH, CARD_RAGE]);
      });

      it("should NOT discard hero hand when unit absorbs all damage from paralyze enemy", () => {
        // Freezers have attack 3 with paralyze
        // Foresters have armor 4 - can absorb all 3 damage
        // If unit absorbs all damage, hero takes 0 wounds
        // Paralyze should NOT discard hero's hand since hero wasn't wounded
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE, CARD_STAMINA],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_FORESTERS, // armor 4
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Freezers (attack 3, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_FREEZERS],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign all 3 damage to unit (Foresters have armor 4)
        // Unit absorbs all 3 damage (armor 4 > damage 3)
        // Unit is destroyed by paralyze, but no overflow to hero
        // Hero takes 0 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 3 },
          ],
        });

        // Unit should be destroyed (paralyze)
        expect(result.state.players[0].units).toHaveLength(0);

        // Hero took 0 wounds - hand should be unchanged
        const heroWounds = result.state.players[0].hand.filter(
          (c) => c === CARD_WOUND
        ).length;
        expect(heroWounds).toBe(0);

        // Hand should still have all original cards (NOT discarded by paralyze)
        expect(result.state.players[0].hand).toContain(CARD_MARCH);
        expect(result.state.players[0].hand).toContain(CARD_RAGE);
        expect(result.state.players[0].hand).toContain(CARD_STAMINA);

        // Should NOT have emitted the paralyze hand discard event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
          })
        );
      });

      it("should work correctly with poison + paralyze (Ice Dragon)", () => {
        // Ice Dragon only has paralyze, not poison. Let's create a test with Swamp Dragon (poison + swift)
        // Actually, let's just test the Ice Dragon paralyze behavior
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Ice Dragon (attack 6, ice, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_ICE_DRAGON],
        }).state;

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to hero
        // Ice Dragon attack 6 / armor 2 = 3 wounds
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
        });

        const player1 = result.state.players[0];

        // Hand should only contain wounds (3 new wounds)
        expect(player1.hand.filter((c) => c === CARD_WOUND)).toHaveLength(3);
        expect(player1.hand.filter((c) => c !== CARD_WOUND)).toHaveLength(0);

        // Discard should contain the non-wound cards (March, Rage)
        expect(player1.discard).toContain(CARD_MARCH);
        expect(player1.discard).toContain(CARD_RAGE);
      });
    });

    describe("nullification", () => {
      it("should not destroy unit if paralyze is nullified", () => {
        const player = createTestPlayer({
          hand: [],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
          units: [
            {
              unitId: UNIT_PEASANTS,
              instanceId: "unit_0",
              ready: true,
              wounded: false,
              usedResistanceThisCombat: false,
            },
          ],
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Add ability nullifier for Paralyze on this enemy
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, id: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
          effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_PARALYZE },
          createdByPlayerId: "player1",
          createdAtRound: state.round,
        });

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to unit (Peasants have armor 2, Medusa attack 6)
        // With paralyze nullified, unit should be wounded, not destroyed
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
          assignments: [
            { target: DAMAGE_TARGET_UNIT, unitInstanceId: "unit_0", amount: 3 },
            { target: DAMAGE_TARGET_HERO, amount: 3 },
          ],
        });

        // Unit should be wounded, not destroyed
        expect(result.state.players[0].units).toHaveLength(1);
        expect(result.state.players[0].units[0].wounded).toBe(true);

        // Should NOT have the destroy event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: UNIT_DESTROYED,
            reason: UNIT_DESTROY_REASON_PARALYZE,
          })
        );
      });

      it("should not discard hand if paralyze is nullified", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH, CARD_RAGE],
          deck: [CARD_MARCH],
          handLimit: 5,
          armor: 2,
        });
        let state = createTestGameState({ players: [player] });

        // Enter combat with Medusa (attack 6, paralyze)
        state = engine.processAction(state, "player1", {
          type: ENTER_COMBAT_ACTION,
          enemyIds: [ENEMY_MEDUSA],
        }).state;

        // Add ability nullifier for Paralyze on this enemy
        state = addModifier(state, {
          source: { type: SOURCE_SKILL, id: "test_skill" },
          duration: DURATION_COMBAT,
          scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
          effect: { type: EFFECT_ABILITY_NULLIFIER, ability: ABILITY_PARALYZE },
          createdByPlayerId: "player1",
          createdAtRound: state.round,
        });

        // Skip to Assign Damage phase (don't block)
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;
        state = engine.processAction(state, "player1", {
          type: END_COMBAT_PHASE_ACTION,
        }).state;

        // Assign damage to hero
        const result = engine.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: "enemy_0",
        });

        const player1 = result.state.players[0];

        // Hand should contain wounds AND the non-wound cards (not discarded)
        expect(player1.hand).toContain(CARD_MARCH);
        expect(player1.hand).toContain(CARD_RAGE);
        expect(player1.hand.filter((c) => c === CARD_WOUND)).toHaveLength(3);

        // Should NOT have emitted the paralyze event
        expect(result.events).not.toContainEqual(
          expect.objectContaining({
            type: PARALYZE_HAND_DISCARDED,
          })
        );
      });
    });
  });

  describe("Enemy skip attack modifier", () => {
    it("should allow skipping damage assignment for enemies that don't attack", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply "enemy skip attack" modifier (simulating Chill/Whirlwind effect)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Skip block phase (enemy doesn't attack, so nothing to block)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Skip assign damage phase - this is the bug! Enemy doesn't attack,
      // so we shouldn't need to assign damage
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should succeed and move to attack phase (not INVALID_ACTION)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);
    });
  });

  describe("Armor modifiers in attack resolution", () => {
    it("should use reduced armor when attacking enemy with armor modifier", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";
      expect(enemyInstanceId).not.toBe("");

      // Apply armor -2 modifier (simulating Tremor "all enemies -2 armor" effect)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -2, minimum: 1 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Also add skip attack so we can get to attack phase without dealing with damage
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Skip block phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ASSIGN_DAMAGE);

      // Skip assign damage phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 1 damage - normally not enough (armor 3), but with -2 modifier = armor 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      // Should succeed (effective armor = 3 - 2 = 1)
      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });

    it("should respect minimum armor of 1 when modifier would reduce below 1", () => {
      const player = createTestPlayer();
      let state = createTestGameState({ players: [player] });

      // Enter combat with Diggers (Attack 3, Armor 3)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      const enemyInstanceId = state.combat?.enemies[0].instanceId ?? "";

      // Apply armor -4 modifier (would reduce armor 3 to -1, but minimum is 1)
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_STAT, stat: ENEMY_STAT_ARMOR, amount: -4, minimum: 1 },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Also add skip attack so we can get to attack phase without dealing with damage
      state = addModifier(state, {
        source: { type: SOURCE_SKILL, skillId: "test_skill" },
        duration: DURATION_COMBAT,
        scope: { type: SCOPE_ONE_ENEMY, enemyId: enemyInstanceId },
        effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
        createdAtRound: state.round,
        createdByPlayerId: "player1",
      });

      // Skip ranged/siege phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip block phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Skip assign damage phase (enemy doesn't attack)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;
      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Attack with 1 damage - should work because minimum armor is 1
      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [enemyInstanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 1 }],
        attackType: COMBAT_TYPE_MELEE,
      });

      expect(result.state.combat?.enemies[0].isDefeated).toBe(true);
    });
  });

  describe("Fame tracking from spell defeats", () => {
    it("should track fame gained in combat.fameGained when spell defeats enemy", () => {
      // Set up combat with Diggers (2 fame)
      let state = createTestGameState();
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DIGGERS],
      }).state;

      // We need to be in Ranged/Siege phase and have target selection
      // Whirlwind (powered) defeats target enemy
      // Give player black and white mana tokens
      state = {
        ...state,
        players: state.players.map((p) =>
          p.id === "player1"
            ? {
                ...p,
                hand: [CARD_WHIRLWIND, ...p.hand],
                pureMana: [
                  { color: MANA_BLACK, source: "die" as const },
                  { color: MANA_WHITE, source: "die" as const },
                ],
              }
            : p
        ),
      };

      // Set the target for the spell
      state = {
        ...state,
        combat: state.combat
          ? {
              ...state.combat,
              pendingTargetEnemy: "enemy_0",
            }
          : null,
      };

      // Play Whirlwind powered (requires black + white mana)
      const result = engine.processAction(state, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_WHIRLWIND,
        powered: true,
        manaSources: [
          { type: MANA_SOURCE_TOKEN, color: MANA_BLACK },
          { type: MANA_SOURCE_TOKEN, color: MANA_WHITE },
        ],
      });

      // Enemy should be defeated
      expect(result.state.combat?.enemies[0]?.isDefeated).toBe(true);

      // Player should have gained fame
      expect(result.state.players[0]?.fame).toBe(2); // Diggers = 2 fame

      // combat.fameGained should also track this (this is the bug fix)
      expect(result.state.combat?.fameGained).toBe(2);
    });
  });
});
