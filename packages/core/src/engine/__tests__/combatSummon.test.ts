/**
 * Combat Summon Ability Tests
 *
 * Tests for the Summon enemy ability (Orc Summoners, Illusionists).
 *
 * Summon behavior:
 * 1. At start of Block phase, each summoner draws a brown enemy token
 * 2. During Block and Assign Damage phases, the summoned enemy is targetable,
 *    the summoner is hidden
 * 3. At start of Attack phase, summoned enemies are discarded (no fame)
 *    and summoners return
 * 4. If brown pool is empty, summoner attacks normally (no summoned enemy)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DECLARE_ATTACK_ACTION,
  ENEMY_ORC_SUMMONERS,
  ENEMY_ILLUSIONISTS,
  ENEMY_SHROUDED_NECROMANCERS,
  ENEMY_DRAGON_SUMMONER,
  ENEMY_DIGGERS,
  ENEMY_CENTAUR_OUTRIDERS,
  ENEMY_GARGOYLE,
  ENEMY_SUMMONED,
  SUMMONED_ENEMY_DISCARDED,
  ENEMY_DEFEATED,
  CARD_MARCH,
  ELEMENT_PHYSICAL,
  COMBAT_TYPE_MELEE,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { EnemyTokenPiles } from "../../types/enemy.js";
import { getValidActions } from "../validActions/index.js";

/**
 * Create enemy token piles with specific brown tokens for testing summons
 */
function createTokenPilesWithBrownPool(
  brownTokenIds: readonly string[]
): EnemyTokenPiles {
  // Cast string[] to EnemyTokenId[] since test helper creates token IDs directly
  const brownTokens = brownTokenIds as readonly import("../../types/enemy.js").EnemyTokenId[];
  return {
    drawPiles: {
      green: [],
      red: [],
      brown: brownTokens,
      violet: [],
      gray: [],
      white: [],
    },
    discardPiles: {
      green: [],
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
  };
}

/**
 * Create enemy token piles with specific green tokens for testing green summons
 */
function createTokenPilesWithGreenPool(
  greenTokenIds: readonly string[]
): EnemyTokenPiles {
  const greenTokens = greenTokenIds as readonly import("../../types/enemy.js").EnemyTokenId[];
  return {
    drawPiles: {
      green: greenTokens,
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
    discardPiles: {
      green: [],
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
  };
}

/**
 * Create enemy token piles with both green and brown tokens
 */
function createTokenPilesWithGreenAndBrownPools(
  greenTokenIds: readonly string[],
  brownTokenIds: readonly string[]
): EnemyTokenPiles {
  const greenTokens = greenTokenIds as readonly import("../../types/enemy.js").EnemyTokenId[];
  const brownTokens = brownTokenIds as readonly import("../../types/enemy.js").EnemyTokenId[];
  return {
    drawPiles: {
      green: greenTokens,
      red: [],
      brown: brownTokens,
      violet: [],
      gray: [],
      white: [],
    },
    discardPiles: {
      green: [],
      red: [],
      brown: [],
      violet: [],
      gray: [],
      white: [],
    },
  };
}

describe("Combat Summon Ability", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("basic summon behavior", () => {
    it("should draw a brown enemy when transitioning to Block phase with Orc Summoner", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner (attack 0, armor 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      expect(state.combat?.enemies).toHaveLength(1);
      expect(state.combat?.enemies[0].enemyId).toBe(ENEMY_ORC_SUMMONERS);

      // End Ranged/Siege phase -> Block phase (summon happens here)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Should have ENEMY_SUMMONED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
          summonerName: "Orc Summoners",
          summonedName: "Gargoyle",
        })
      );

      // Should now have 2 enemies: hidden summoner + summoned gargoyle
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Orc Summoner should be hidden
      const summoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_ORC_SUMMONERS
      );
      expect(summoner?.isSummonerHidden).toBe(true);

      // Gargoyle should be summoned (linked to summoner)
      const summoned = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_GARGOYLE
      );
      expect(summoned?.summonedByInstanceId).toBe(summoner?.instanceId);
    });

    it("should draw a brown enemy with Illusionist (violet)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["minotaur_0"]),
      });

      // Enter combat with Illusionist
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ILLUSIONISTS],
      }).state;

      // End Ranged/Siege phase -> Block phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ENEMY_SUMMONED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
          summonerName: "Illusionists",
          summonedName: "Minotaur",
        })
      );

      // Illusionist should be hidden
      const summoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_ILLUSIONISTS
      );
      expect(summoner?.isSummonerHidden).toBe(true);
    });

    it("should discard summoned enemy at start of Attack phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege phase -> Block phase (summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      expect(state.combat?.enemies).toHaveLength(2);

      // End Block phase -> Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Get the summoned enemy's instance ID for damage assignment
      const summonedEnemy = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      );
      if (!summonedEnemy) throw new Error("Summoned enemy not found");

      // Assign damage from summoned enemy (Gargoyle has attack 5)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: summonedEnemy.instanceId,
      }).state;

      // End Assign Damage phase -> Attack phase (discard summon)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should have SUMMONED_ENEMY_DISCARDED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SUMMONED_ENEMY_DISCARDED,
          summonedName: "Gargoyle",
          summonerName: "Orc Summoners",
        })
      );

      // Should only have the original summoner, not the summoned enemy
      expect(result.state.combat?.enemies).toHaveLength(1);
      expect(result.state.combat?.enemies[0].enemyId).toBe(ENEMY_ORC_SUMMONERS);
      expect(result.state.combat?.enemies[0].isSummonerHidden).toBe(false);

      // Gargoyle token should be in brown discard
      expect(
        result.state.enemyTokens.discardPiles.brown
      ).toContain("gargoyle_0");
    });
  });

  describe("targeting restrictions", () => {
    it("should not allow blocking hidden summoner", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 10,
          blockElements: { physical: 10, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block (summon happens)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Get the hidden summoner's instance ID
      const summoner = state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_ORC_SUMMONERS
      );
      expect(summoner?.isSummonerHidden).toBe(true);

      // Valid actions should NOT include the hidden summoner in block options
      const validActions = getValidActions(state, "player1");
      const blockOptions =
        validActions.mode === "combat" ? (validActions.combat.blocks ?? []) : [];

      expect(blockOptions.map((b) => b.enemyInstanceId)).not.toContain(
        summoner?.instanceId
      );

      // Should only be able to block the summoned gargoyle
      const summonedId = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      )?.instanceId;
      expect(blockOptions.map((b) => b.enemyInstanceId)).toContain(summonedId);
    });

    it("should not allow assigning damage from hidden summoner", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End Block -> Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Valid actions should NOT include the hidden summoner in damage assignments
      const validActions = getValidActions(state, "player1");
      const damageOptions =
        validActions.mode === "combat"
          ? (validActions.combat.damageAssignments ?? [])
          : [];

      const summonerId = state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_ORC_SUMMONERS
      )?.instanceId;

      expect(damageOptions.map((d) => d.enemyInstanceId)).not.toContain(
        summonerId
      );

      // Should only be able to take damage from the summoned gargoyle
      const summonedId = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      )?.instanceId;
      expect(damageOptions.map((d) => d.enemyInstanceId)).toContain(summonedId);
    });

    it("should allow attacking summoner in Attack phase (after summon discarded)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
        combatAccumulator: {
          attack: {
            normal: 5,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 5, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block (summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // End Block -> Assign Damage
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from gargoyle
      const summonedEnemy = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      );
      if (!summonedEnemy) throw new Error("Summoned enemy not found");
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: summonedEnemy.instanceId,
      }).state;

      // End Assign Damage -> Attack (discard summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Summoner should be the only enemy and no longer hidden
      expect(state.combat?.enemies).toHaveLength(1);
      expect(state.combat?.enemies[0].enemyId).toBe(ENEMY_ORC_SUMMONERS);
      expect(state.combat?.enemies[0].isSummonerHidden).toBe(false);

      // Should be able to attack the summoner
      const validActions = getValidActions(state, "player1");
      const attackOptions =
        validActions.mode === "combat" ? (validActions.combat.enemies ?? []) : [];

      expect(attackOptions.map((e) => e.enemyInstanceId)).toContain(
        state.combat?.enemies[0].instanceId
      );
    });
  });

  describe("empty brown pool edge case", () => {
    it("should not summon when brown pool is empty", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        // Empty brown pool
        enemyTokens: createTokenPilesWithBrownPool([]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block (summon would happen, but pool is empty)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should NOT have ENEMY_SUMMONED event
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
        })
      );

      // Should still only have 1 enemy (the summoner)
      expect(result.state.combat?.enemies).toHaveLength(1);

      // Summoner should NOT be hidden (no summoned enemy to replace it)
      expect(result.state.combat?.enemies[0].isSummonerHidden).toBeUndefined();
    });

    it("should allow summoner to be blocked when no summon occurred", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 5,
          blockElements: { physical: 5, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({
        players: [player],
        // Empty brown pool
        enemyTokens: createTokenPilesWithBrownPool([]),
      });

      // Enter combat with Orc Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block (no summon due to empty pool)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Valid actions SHOULD include the summoner in block options
      // (because it wasn't hidden since no summon occurred)
      // However, Orc Summoners have attack 0, so there's nothing to block
      const validActions = getValidActions(state, "player1");
      const blockOptions =
        validActions.mode === "combat" ? (validActions.combat.blocks ?? []) : [];

      // Orc Summoners have attack 0, so they won't appear as something to block
      // This is correct behavior - they don't attack
      expect(blockOptions).toHaveLength(0);
    });
  });

  describe("multiple summoners", () => {
    it("should handle multiple summoners each drawing a brown enemy", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        // Two brown tokens for two summoners
        enemyTokens: createTokenPilesWithBrownPool([
          "gargoyle_0",
          "minotaur_0",
        ]),
      });

      // Enter combat with two summoners
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS, ENEMY_ILLUSIONISTS],
      }).state;

      expect(state.combat?.enemies).toHaveLength(2);

      // End Ranged/Siege -> Block (both summon)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have 2 ENEMY_SUMMONED events
      const summonEvents = result.events.filter(
        (e) => e.type === ENEMY_SUMMONED
      );
      expect(summonEvents).toHaveLength(2);

      // Should now have 4 enemies (2 summoners + 2 summoned)
      expect(result.state.combat?.enemies).toHaveLength(4);

      // Both summoners should be hidden
      const summoners = result.state.combat?.enemies.filter(
        (e) =>
          e.enemyId === ENEMY_ORC_SUMMONERS || e.enemyId === ENEMY_ILLUSIONISTS
      );
      expect(summoners).toHaveLength(2);
      expect(summoners?.every((s) => s.isSummonerHidden)).toBe(true);

      // Both summoned enemies should be linked
      const summonedEnemies = result.state.combat?.enemies.filter(
        (e) => e.summonedByInstanceId !== undefined
      );
      expect(summonedEnemies).toHaveLength(2);
    });
  });

  describe("fame and conquest", () => {
    it("should grant fame for defeating summoner, not for discarding summoned enemy", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 10, // High armor to survive
        fame: 0,
        combatAccumulator: {
          attack: {
            normal: 10,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 10, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 10,
          blockElements: { physical: 10, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Orc Summoner (fame 4)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege -> Block (summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Get the summoned gargoyle
      const summonedEnemy = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      );
      if (!summonedEnemy) throw new Error("Summoned enemy not found");

      // End Block -> Assign Damage (gargoyle wasn't blocked, need to take damage)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Assign damage from gargoyle (take it to hero since we have high armor)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: summonedEnemy.instanceId,
      }).state;

      // End Assign Damage -> Attack (discard summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Fame should still be 0 (discarding summon grants no fame)
      expect(state.players[0].fame).toBe(0);

      // Now defeat the summoner - get summoner's instanceId
      const summonerEnemy = state.combat?.enemies[0];
      if (!summonerEnemy) throw new Error("Summoner enemy not found");

      // Assign 4+ attack to defeat Orc Summoner (armor 4)
      // Player has 10 melee attack accumulated from test setup
      const attackResult = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: [summonerEnemy.instanceId],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 5 }],
        attackType: COMBAT_TYPE_MELEE,
      });
      state = attackResult.state;

      // Should have ENEMY_DEFEATED event for summoner (from attack action)
      expect(attackResult.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_DEFEATED,
          enemyName: "Orc Summoners",
          fameGained: 4, // Orc Summoner fame
        })
      );

      // End combat
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Player should have gained 4 fame
      expect(result.state.players[0].fame).toBe(4);
    });
  });

  describe("Shrouded Necromancers - green summon", () => {
    it("should draw a green enemy when transitioning to Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithGreenPool(["diggers_0"]),
      });

      // Enter combat with Shrouded Necromancers (attack 0, armor 5)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      expect(state.combat?.enemies).toHaveLength(1);
      expect(state.combat?.enemies[0].enemyId).toBe(ENEMY_SHROUDED_NECROMANCERS);

      // End Ranged/Siege phase -> Block phase (summon happens here)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_BLOCK);

      // Should have ENEMY_SUMMONED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
          summonerName: "Shrouded Necromancers",
          summonedName: "Diggers",
        })
      );

      // Should now have 2 enemies: hidden summoner + summoned green enemy
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Shrouded Necromancers should be hidden
      const summoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_SHROUDED_NECROMANCERS
      );
      expect(summoner?.isSummonerHidden).toBe(true);

      // Diggers should be summoned (linked to summoner)
      const summoned = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DIGGERS
      );
      expect(summoned?.summonedByInstanceId).toBe(summoner?.instanceId);

      // Green draw pile should be reduced
      expect(result.state.enemyTokens.drawPiles.green).not.toContain("diggers_0");
    });

    it("should not summon when green pool is empty", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        // Empty green pool
        enemyTokens: createTokenPilesWithGreenPool([]),
      });

      // Enter combat with Shrouded Necromancers
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      // End Ranged/Siege -> Block (summon would happen, but pool is empty)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should NOT have ENEMY_SUMMONED event
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
        })
      );

      // Should still only have 1 enemy (the summoner)
      expect(result.state.combat?.enemies).toHaveLength(1);

      // Summoner should NOT be hidden (no summoned enemy to replace it)
      expect(result.state.combat?.enemies[0].isSummonerHidden).toBeUndefined();
    });

    it("should discard summoned green enemy at start of Attack phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithGreenPool(["diggers_0"]),
      });

      // Enter combat with Shrouded Necromancers
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      // End Ranged/Siege phase -> Block phase (summon)
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      expect(state.combat?.enemies).toHaveLength(2);

      // End Block phase -> Assign Damage phase
      state = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      }).state;

      // Get the summoned enemy's instance ID for damage assignment
      const summonedEnemy = state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      );
      if (!summonedEnemy) throw new Error("Summoned enemy not found");

      // Assign damage from summoned enemy (Diggers has attack 3)
      state = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: summonedEnemy.instanceId,
      }).state;

      // End Assign Damage phase -> Attack phase (discard summon)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      expect(result.state.combat?.phase).toBe(COMBAT_PHASE_ATTACK);

      // Should have SUMMONED_ENEMY_DISCARDED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SUMMONED_ENEMY_DISCARDED,
          summonedName: "Diggers",
          summonerName: "Shrouded Necromancers",
        })
      );

      // Should only have the original summoner, not the summoned enemy
      expect(result.state.combat?.enemies).toHaveLength(1);
      expect(result.state.combat?.enemies[0].enemyId).toBe(ENEMY_SHROUDED_NECROMANCERS);
      expect(result.state.combat?.enemies[0].isSummonerHidden).toBe(false);

      // Diggers token should be in green discard
      expect(
        result.state.enemyTokens.discardPiles.green
      ).toContain("diggers_0");
    });

    it("should have Fortified ability (only Siege attacks in ranged phase)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
        combatAccumulator: {
          attack: {
            normal: 0,
            ranged: 5, // Have ranged attack
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 5, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          assignedAttack: {
            normal: 0,
            ranged: 0,
            siege: 0,
            normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
            siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          },
          block: 0,
          blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
          blockSources: [],
        },
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithGreenPool(["diggers_0"]),
      });

      // Enter combat with Shrouded Necromancers
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      // In Ranged/Siege phase, Fortified enemies can only be attacked with Siege
      const validActions = getValidActions(state, "player1");
      const rangedAttacks =
        validActions.mode === "combat" && validActions.combat.assignableAttacks
          ? validActions.combat.assignableAttacks.filter(
              (a) => a.attackType === "ranged"
            )
          : [];

      const enemyInstanceId = state.combat?.enemies[0]?.instanceId ?? "";

      // Should NOT be able to use regular ranged attacks on Fortified enemy
      // Either there are no ranged attacks, or none target this enemy
      const canTargetWithRanged = rangedAttacks.some(
        (a) => a.enemyInstanceId === enemyInstanceId
      );
      expect(canTargetWithRanged).toBe(false);
    });
  });

  describe("Faction priority drawing", () => {
    it("should prefer Dark Crusaders faction token when summoner is Dark Crusaders", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });

      // Put a non-faction token first, Dark Crusaders faction token second
      // Currently no green enemies have Dark Crusaders faction,
      // so this test validates the mechanism works even when no match is found
      let state = createTestGameState({
        players: [player],
        // Centaur Outriders is Elementalist faction, Diggers has no faction
        enemyTokens: createTokenPilesWithGreenPool([
          "centaur_outriders_0", // Elementalist faction
          "diggers_0", // No faction
        ]),
      });

      // Enter combat with Shrouded Necromancers (Dark Crusaders faction)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      // End Ranged/Siege phase -> Block phase (summon happens)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should summon something (first available since no Dark Crusaders match)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
          summonerName: "Shrouded Necromancers",
        })
      );

      // When there's no faction match, should draw from top (first token)
      const summoned = result.state.combat?.enemies.find(
        (e) => e.summonedByInstanceId !== undefined
      );
      expect(summoned?.enemyId).toBe(ENEMY_CENTAUR_OUTRIDERS);
    });

    it("should not affect brown summon when summoner has no faction", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });

      let state = createTestGameState({
        players: [player],
        // Orc Summoners have no faction - should draw brown normally
        enemyTokens: createTokenPilesWithGreenAndBrownPools(
          ["diggers_0"],
          ["gargoyle_0"]
        ),
      });

      // Enter combat with Orc Summoner (no faction)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      }).state;

      // End Ranged/Siege phase -> Block phase (summon happens)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should summon from brown pool
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMY_SUMMONED,
          summonerName: "Orc Summoners",
          summonedName: "Gargoyle",
        })
      );
    });
  });

  describe("Mixed summoner types", () => {
    it("should handle both brown and green summoners in same combat", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });

      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithGreenAndBrownPools(
          ["diggers_0"],
          ["gargoyle_0"]
        ),
      });

      // Enter combat with both Orc Summoner (brown) and Shrouded Necromancers (green)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS, ENEMY_SHROUDED_NECROMANCERS],
      }).state;

      expect(state.combat?.enemies).toHaveLength(2);

      // End Ranged/Siege phase -> Block phase (both summon)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have 2 ENEMY_SUMMONED events
      const summonEvents = result.events.filter(
        (e) => e.type === ENEMY_SUMMONED
      );
      expect(summonEvents).toHaveLength(2);

      // Should have 4 enemies total
      expect(result.state.combat?.enemies).toHaveLength(4);

      // One should be from green pool (Diggers)
      const diggersSummoned = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DIGGERS
      );
      expect(diggersSummoned).toBeDefined();

      // One should be from brown pool (Gargoyle)
      const gargoyleSummoned = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_GARGOYLE
      );
      expect(gargoyleSummoned).toBeDefined();

      // Green pool should be emptied
      expect(result.state.enemyTokens.drawPiles.green).not.toContain("diggers_0");

      // Brown pool should be emptied
      expect(result.state.enemyTokens.drawPiles.brown).not.toContain("gargoyle_0");
    });
  });

  describe("Dragon Summoner double summon", () => {
    /**
     * Dragon Summoner has two Summon attacks (per-attack ability), so it should
     * draw TWO brown enemy tokens at the start of Block phase.
     *
     * Per FAQ: "DRAGON SUMMONERS draws two MONSTER tokens and uses the attack
     * of each MONSTER token once; it doesn't draw one MONSTER token and use
     * its attack twice."
     */
    it("should draw two brown enemies when Dragon Summoner enters Block phase", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0", "minotaur_1"]),
      });

      // Enter combat with Dragon Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DRAGON_SUMMONER],
      }).state;

      expect(state.combat?.phase).toBe(COMBAT_PHASE_RANGED_SIEGE);
      expect(state.combat?.enemies).toHaveLength(1);
      expect(state.combat?.enemies[0].enemyId).toBe(ENEMY_DRAGON_SUMMONER);

      // End Ranged/Siege phase -> Block phase (double summon happens here)
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have 2 ENEMY_SUMMONED events (one for each summon attack)
      const summonEvents = result.events.filter(
        (e) => e.type === ENEMY_SUMMONED
      );
      expect(summonEvents).toHaveLength(2);

      // Should have 3 enemies total: Dragon Summoner + 2 summoned
      expect(result.state.combat?.enemies).toHaveLength(3);

      // Dragon Summoner should be hidden
      const dragonSummoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DRAGON_SUMMONER
      );
      expect(dragonSummoner?.isSummonerHidden).toBe(true);

      // Both summoned enemies should be from brown pool
      const summonedEnemies = result.state.combat?.enemies.filter(
        (e) => e.summonedByInstanceId !== undefined
      );
      expect(summonedEnemies).toHaveLength(2);

      // Brown pool should be emptied (both tokens drawn)
      expect(result.state.enemyTokens.drawPiles.brown).toHaveLength(0);
    });

    it("should only summon as many enemies as available in brown pool", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        // Only 1 brown token available
        enemyTokens: createTokenPilesWithBrownPool(["gargoyle_0"]),
      });

      // Enter combat with Dragon Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DRAGON_SUMMONER],
      }).state;

      // End Ranged/Siege phase -> Block phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should only have 1 ENEMY_SUMMONED event (pool ran out after first)
      const summonEvents = result.events.filter(
        (e) => e.type === ENEMY_SUMMONED
      );
      expect(summonEvents).toHaveLength(1);

      // Should have 2 enemies total: Dragon Summoner + 1 summoned
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Dragon Summoner should still be hidden (at least one summon succeeded)
      const dragonSummoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DRAGON_SUMMONER
      );
      expect(dragonSummoner?.isSummonerHidden).toBe(true);
    });

    it("should not hide Dragon Summoner if brown pool is empty", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        armor: 2,
      });
      let state = createTestGameState({
        players: [player],
        // Empty brown pool
        enemyTokens: createTokenPilesWithBrownPool([]),
      });

      // Enter combat with Dragon Summoner
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_DRAGON_SUMMONER],
      }).state;

      // End Ranged/Siege phase -> Block phase
      const result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have 0 ENEMY_SUMMONED events
      const summonEvents = result.events.filter(
        (e) => e.type === ENEMY_SUMMONED
      );
      expect(summonEvents).toHaveLength(0);

      // Should only have Dragon Summoner (no summoned enemies)
      expect(result.state.combat?.enemies).toHaveLength(1);

      // Dragon Summoner should NOT be hidden (no summons succeeded)
      const dragonSummoner = result.state.combat?.enemies.find(
        (e) => e.enemyId === ENEMY_DRAGON_SUMMONER
      );
      expect(dragonSummoner?.isSummonerHidden).toBeFalsy();
    });
  });
});
