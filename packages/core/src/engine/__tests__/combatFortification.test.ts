/**
 * Combat Fortification Tests
 *
 * Tests for fortification mechanics including enemy abilities, site fortification,
 * and siege attack requirements.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState } from "./testHelpers.js";
import { withBlockSources, withSiegeAttack } from "./combatTestHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  INVALID_ACTION,
  ENEMY_DEFEATED,
  ENEMY_DIGGERS,
  ENEMY_PROWLERS,
  ENEMY_ORC_WAR_BEASTS,
  ENEMIES,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";
import { COMBAT_PHASE_RANGED_SIEGE } from "../../types/combat.js";

describe("Combat Fortification", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

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

    it("should allow ranged attack at fortified site for unfortified enemy", () => {
      let state = createTestGameState();

      // Enter combat at fortified site with Orc War Beasts (has ABILITY_UNFORTIFIED)
      state = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_WAR_BEASTS],
        isAtFortifiedSite: true,
      }).state;

      const result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: ELEMENT_PHYSICAL, value: 3 }],
        attackType: COMBAT_TYPE_RANGED,
      });

      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
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
      state = withBlockSources(state, "player1", [
        { element: ELEMENT_PHYSICAL, value: 3 },
      ]);
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
      const playerIndex = state.players.findIndex((p) => p.id === "player1");
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
            siege: 0, // But NO siege attack!
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
      const playerIndex = state.players.findIndex((p) => p.id === "player1");
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
