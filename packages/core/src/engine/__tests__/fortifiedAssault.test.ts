/**
 * Fortified Assault Tests
 *
 * Tests for:
 * - Auto-combat entry when moving to fortified sites
 * - Reputation penalty on assault
 * - Withdrawal on failed fortified assault
 * - Fortified assault with provoked rampaging enemies
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestHex, createHexEnemy } from "./testHelpers.js";
import {
  withBlockSources,
  withSiegeAttack,
  createKeepSite,
  createTestStateWithKeep,
} from "./combatTestHelpers.js";
import {
  MOVE_ACTION,
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_ATTACK_ACTION,
  DECLARE_BLOCK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  PLAYER_MOVED,
  COMBAT_TRIGGERED,
  REPUTATION_CHANGED,
  COMBAT_ENDED,
  SITE_CONQUERED,
  COMBAT_TYPE_SIEGE,
  TERRAIN_PLAINS,
  hexKey,
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  REPUTATION_REASON_ASSAULT,
  ENEMY_GUARDSMEN,
  ENEMY_DIGGERS,
  PLAYER_WITHDREW,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
} from "@mage-knight/shared";
import { RampagingEnemyType } from "../../types/map.js";
import type { HexState } from "../../types/map.js";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemy/index.js";

describe("Fortified Assault", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("Auto-combat entry on fortified site assault", () => {
    it("should auto-enter combat when moving to unconquered keep", () => {
      // Create enemy token for the keep
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);

      // Set up state with player adjacent to keep
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      // Update player with enough move points
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should have triggered combat
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      // Should be in combat now
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);
    });

    it("should NOT auto-enter combat when moving to own conquered keep", () => {
      // Set up state with player adjacent to their own conquered keep
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [], true, "player1");

      // Update player
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to own conquered keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should NOT have triggered combat
      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: COMBAT_TRIGGERED })
      );

      // Should NOT be in combat
      expect(result.state.combat).toBeNull();
    });

    it("should trigger assault on opponent-owned keep", () => {
      // Set up state with keep conquered by player2
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [], true, "player2");

      // Player1 is adjacent
      const player1 = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });
      const player2 = createTestPlayer({
        id: "player2",
        position: { q: 2, r: 0 },
      });
      state = {
        ...state,
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
      };

      // Player1 moves into player2's keep
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should have triggered combat
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      // Should apply -1 reputation
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          reason: REPUTATION_REASON_ASSAULT,
        })
      );

      // Should be in combat
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);

      // Player reputation should be -1
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });
  });

  describe("Reputation penalty on assault", () => {
    it("should apply -1 reputation on assault", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Should emit REPUTATION_CHANGED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -1,
          newValue: -1,
          reason: REPUTATION_REASON_ASSAULT,
        })
      );

      // Player reputation should be -1
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });
  });

  describe("Withdrawal on failed fortified assault", () => {
    it("should withdraw to origin hex on failed fortified assault", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });
      state = result.state;

      // Verify assault origin was stored
      expect(state.combat?.assaultOrigin).toEqual(originCoord);

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase (don't block - enemy will attack)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from unblocked enemy (mandatory before advancing)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Now advance to attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip attack phase — don't defeat enemy, just end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat without victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
        })
      );

      // Should have withdrawn
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
          playerId: "player1",
          from: keepCoord,
          to: originCoord,
        })
      );

      // Player should be back at origin
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual(originCoord);
    });

    it("should NOT withdraw on failed adventure site combat", () => {
      // Adventure sites don't set isAtFortifiedSite, so no withdrawal
      let state = createTestStateWithKeep({ q: 1, r: 0 }, []); // Empty keep for state setup

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat manually (non-fortified, like dungeon)
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
        isAtFortifiedSite: false,
      });
      state = result.state;

      // Combat should NOT have assaultOrigin
      expect(state.combat?.isAtFortifiedSite).toBe(false);

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from unblocked enemy (mandatory before advancing)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Now advance to attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat without victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: false,
        })
      );

      // Should NOT have withdrawn
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
        })
      );

      // Player should still be at same position
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual({ q: 0, r: 0 });
    });

    it("should NOT withdraw if all enemies defeated", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });
      state = result.state;

      // Skip ranged phase
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

      // Attack phase - defeat enemy with siege attack
      // Set up siege attack in accumulator (required by validator)
      state = withSiegeAttack(state, "player1", 10);
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"],
        attacks: [{ element: "physical", value: 10 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // End attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have ended combat with victory
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true,
        })
      );

      // Should NOT have withdrawn
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: PLAYER_WITHDREW,
        })
      );

      // Player should be at keep (victory = conquest)
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.position).toEqual(keepCoord);
    });

    it("should store assaultOrigin when assault starts", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const keepCoord = { q: 1, r: 0 };
      const originCoord = { q: 0, r: 0 };
      let state = createTestStateWithKeep(keepCoord, [createHexEnemy(enemyToken)]);

      const player = createTestPlayer({
        id: "player1",
        position: originCoord,
        movePoints: 4,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Move to keep (triggers assault)
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });

      // Combat state should have assaultOrigin set to original position
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.assaultOrigin).toEqual(originCoord);
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);
    });
  });

  describe("Fortified assault with provoked rampaging enemies", () => {
    /**
     * Per rulebook (line 608):
     * "An assault is a move, and it can happen that it provokes one or more rampaging enemies.
     * You have to fight both the defenders and these rampaging enemies at once. The rampaging
     * enemies are not fortified, though, and you can conquer the site even if you do not defeat them."
     *
     * Test scenario:
     * - Player at (0,0)
     * - Rampaging enemy at (1,0)
     * - Keep (fortified site) at (1,-1) with a garrison
     * - Player moves from (0,0) to (1,-1)
     *
     * Both (0,0) and (1,-1) are adjacent to (1,0), so moving between them provokes
     * the rampaging enemy. The player must fight BOTH the keep garrison AND the
     * provoked rampaging enemy in a single combat.
     */
    it("should include both fortified site defenders AND provoked rampaging enemies in combat", () => {
      // Create enemy tokens
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      // Set up state
      let state = createTestStateWithKeep({ q: 1, r: -1 }, []);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
        reputation: 0,
      });

      // Create the keep at (1,-1) with garrison
      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      // Create rampaging enemy at (1,0) - adjacent to both (0,0) and (1,-1)
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      // Create player's starting hex (0,0)
      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      // Move from (0,0) to (1,-1)
      // This should:
      // 1. Trigger fortified assault (keep)
      // 2. Provoke rampaging enemy at (1,0)
      // 3. Both enemies should be in the same combat
      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Should have moved
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: PLAYER_MOVED })
      );

      // Should have triggered combat
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      // Should be in combat
      expect(result.state.combat).not.toBeNull();

      // CRITICAL ASSERTION: Combat should have BOTH enemies
      // - The keep defender (guardsmen)
      // - The provoked rampaging enemy (diggers)
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Verify both enemy types are present
      const enemyIds = result.state.combat?.enemies.map((e) => e.enemyId) ?? [];
      expect(enemyIds).toContain(ENEMY_GUARDSMEN);
      expect(enemyIds).toContain(ENEMY_DIGGERS);

      // Combat should be at fortified site (for the keep defenders)
      expect(result.state.combat?.isAtFortifiedSite).toBe(true);

      // Player reputation should be -1 from assault
      const updatedPlayer = result.state.players.find((p) => p.id === "player1");
      expect(updatedPlayer?.reputation).toBe(-1);
    });

    it("should emit both COMBAT_TRIGGERED events when provoking during assault", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestStateWithKeep({ q: 1, r: -1 }, []);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Should have two COMBAT_TRIGGERED events:
      // 1. FORTIFIED_ASSAULT for the keep
      // 2. PROVOKE_RAMPAGING for the orc
      const combatTriggeredEvents = result.events.filter(
        (e) => e.type === COMBAT_TRIGGERED
      );

      expect(combatTriggeredEvents).toHaveLength(2);

      expect(combatTriggeredEvents).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_FORTIFIED_ASSAULT,
        })
      );

      expect(combatTriggeredEvents).toContainEqual(
        expect.objectContaining({
          type: COMBAT_TRIGGERED,
          triggerType: COMBAT_TRIGGER_PROVOKE_RAMPAGING,
        })
      );
    });

    it("should mark provoked rampaging enemies as not required for conquest", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestStateWithKeep({ q: 1, r: -1 }, []);

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      const result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: { q: 1, r: -1 },
      });

      // Verify the flags are set correctly
      const enemies = result.state.combat?.enemies ?? [];
      expect(enemies).toHaveLength(2);

      // Site defender (guardsmen) should be required for conquest
      const siteDefender = enemies.find((e) => e.enemyId === ENEMY_GUARDSMEN);
      expect(siteDefender?.isRequiredForConquest).toBe(true);

      // Provoked rampaging enemy (diggers) should NOT be required for conquest
      const rampagingEnemy = enemies.find((e) => e.enemyId === ENEMY_DIGGERS);
      expect(rampagingEnemy?.isRequiredForConquest).toBe(false);
    });

    it("should conquer site when only site defenders are defeated (rampaging enemies survive)", () => {
      const keepDefenderToken = createEnemyTokenId(ENEMY_GUARDSMEN);
      const rampagingEnemyToken = createEnemyTokenId(ENEMY_DIGGERS);

      let state = createTestStateWithKeep({ q: 1, r: -1 }, []);
      const keepCoord = { q: 1, r: -1 };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        movePoints: 4,
      });

      const keepHex: HexState = {
        ...createTestHex(1, -1, TERRAIN_PLAINS),
        site: createKeepSite(),
        enemies: [createHexEnemy(keepDefenderToken)],
      };

      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingEnemyToken)],
      };

      const startHex = createTestHex(0, 0, TERRAIN_PLAINS);

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: startHex,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
            [hexKey({ q: 1, r: -1 })]: keepHex,
          },
        },
      };

      // Move to keep (triggers assault + provoke)
      let result = engine.processAction(state, "player1", {
        type: MOVE_ACTION,
        target: keepCoord,
      });
      state = result.state;

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Block phase - only block the site defender (guardsmen)
      // Guardsmen: attack 3, Fortified (not Swift), need 3 block
      state = withBlockSources(state, "player1", [{ element: "physical", value: 3 }]);
      result = engine.processAction(state, "player1", {
        type: DECLARE_BLOCK_ACTION,
        targetEnemyInstanceId: "enemy_0", // Guardsmen (site defender)
      });
      state = result.state;

      // End Block phase -> Assign Damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign Damage from unblocked rampaging enemy (enemy_1 - Diggers)
      // This will deal wounds but we continue
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1", // Diggers (rampaging) - unblocked
      });
      state = result.state;

      // End Assign Damage phase -> Attack phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Attack phase - defeat ONLY the site defender (guardsmen), leave rampaging enemy alive
      state = withSiegeAttack(state, "player1", 7); // Guardsmen armor 7
      result = engine.processAction(state, "player1", {
        type: DECLARE_ATTACK_ACTION,
        targetEnemyInstanceIds: ["enemy_0"], // Only target guardsmen (site defender)
        attacks: [{ element: "physical", value: 7 }],
        attackType: COMBAT_TYPE_SIEGE,
      });
      state = result.state;

      // Verify only guardsmen is defeated, diggers survives
      expect(state.combat?.enemies[0]?.isDefeated).toBe(true); // Guardsmen defeated
      expect(state.combat?.enemies[1]?.isDefeated).toBe(false); // Diggers survives

      // End attack phase to end combat
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });

      // Should have VICTORY even though rampaging enemy survives
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_ENDED,
          victory: true, // Victory because all REQUIRED enemies defeated
          enemiesDefeated: 1,
          enemiesSurvived: 1,
        })
      );

      // Should have conquered the site
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_CONQUERED,
          playerId: "player1",
        })
      );

      // Site should be conquered
      const hex = result.state.map.hexes[hexKey(keepCoord)];
      expect(hex?.site?.isConquered).toBe(true);
      expect(hex?.site?.owner).toBe("player1");
    });
  });
});
