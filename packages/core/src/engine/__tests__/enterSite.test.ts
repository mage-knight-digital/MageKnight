/**
 * Enter adventure site tests
 *
 * Tests for:
 * - Validation: must be at adventure site, site not conquered
 * - Dungeon: draws 1 brown enemy, starts combat (night rules, no units)
 * - Tomb: draws 1 red Draconum, starts combat (night rules, no units)
 * - Monster den: draws 1 brown enemy OR fights existing (normal rules)
 * - Ruins: day = auto-conquest if empty, night = fight brown enemy
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_SITE_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  SITE_ENTERED,
  ENEMIES_DRAWN_FOR_SITE,
  COMBAT_STARTED,
  SITE_CONQUERED,
  TERRAIN_PLAINS,
  hexKey,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_RED,
  ENEMIES,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState, HexEnemy } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import { createEnemyTokenId, resetTokenCounter, createEnemyTokenPiles } from "../helpers/enemy/index.js";
import { createHexEnemy } from "./testHelpers.js";
import { createRng } from "../../utils/rng.js";

/**
 * Helper to create a dungeon site
 */
function createDungeonSite(isConquered = false): Site {
  return {
    type: SiteType.Dungeon,
    owner: isConquered ? "player1" : null,
    isConquered,
    isBurned: false,
  };
}

/**
 * Helper to create a tomb site
 */
function createTombSite(): Site {
  return {
    type: SiteType.Tomb,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Helper to create a monster den site
 */
function createMonsterDenSite(): Site {
  return {
    type: SiteType.MonsterDen,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Helper to create ancient ruins site
 */
function createRuinsSite(): Site {
  return {
    type: SiteType.AncientRuins,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Helper to create a village site (NOT an adventure site)
 */
function createVillageSite(): Site {
  return {
    type: SiteType.Village,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create test state with player at an adventure site
 */
function createTestStateWithSite(
  site: Site,
  enemies: readonly HexEnemy[] = [],
  timeOfDay: typeof TIME_OF_DAY_DAY | typeof TIME_OF_DAY_NIGHT = TIME_OF_DAY_DAY
): GameState {
  const baseState = createTestGameState();
  const playerCoord = { q: 0, r: 0 };

  // Create hex with site
  const siteHex: HexState = {
    coord: playerCoord,
    terrain: TERRAIN_PLAINS,
    tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
    site,
    enemies,
    shieldTokens: [],
    rampagingEnemies: [],
  };

  const hexes: Record<string, HexState> = {
    ...baseState.map.hexes,
    [hexKey(playerCoord)]: siteHex,
  };

  // Create enemy token piles with enemies
  const rng = createRng(12345);
  const { piles: enemyTokens } = createEnemyTokenPiles(rng);

  const player = createTestPlayer({
    id: "player1",
    position: playerCoord,
    hasTakenActionThisTurn: false,
    hasCombattedThisTurn: false,
  });

  return {
    ...baseState,
    timeOfDay,
    players: [player],
    turnOrder: ["player1"],
    map: { ...baseState.map, hexes },
    enemyTokens,
    rng,
  };
}

describe("Enter adventure site", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("validation", () => {
    it("should reject if not at adventure site", () => {
      // Player at village (not an adventure site)
      const state = createTestStateWithSite(createVillageSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "This is not an adventure site",
        })
      );
    });

    it("should reject if non-dungeon site already conquered (e.g. monster den)", () => {
      // Player at conquered monster den (not allowed to re-enter)
      const conqueredMonsterDen: Site = {
        type: SiteType.MonsterDen,
        owner: "player1",
        isConquered: true,
        isBurned: false,
      };
      const state = createTestStateWithSite(conqueredMonsterDen);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "This site has already been conquered",
        })
      );
    });

    it("should ALLOW re-entering conquered dungeon", () => {
      // Player at conquered dungeon (CAN re-enter for fame grinding)
      const state = createTestStateWithSite(createDungeonSite(true));

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should NOT be rejected
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Should emit SITE_ENTERED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_ENTERED,
          siteType: SiteType.Dungeon,
        })
      );

      // Combat should start
      expect(result.state.combat).not.toBeNull();
    });

    it("should reject if player has already taken action this turn", () => {
      let state = createTestStateWithSite(createDungeonSite());

      // Mark action already taken
      const player = state.players[0];
      if (!player) throw new Error("Player not found");
      state = {
        ...state,
        players: [{ ...player, hasTakenActionThisTurn: true }],
      };

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
    });

    // NOTE: Monster den now draws enemies on enter (per rules), so
    // "no enemies" rejection no longer applies to monster den
  });

  describe("dungeon", () => {
    it("should draw 1 brown enemy when entering dungeon", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit SITE_ENTERED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_ENTERED,
          playerId: "player1",
          siteType: SiteType.Dungeon,
        })
      );

      // Should emit ENEMIES_DRAWN_FOR_SITE event with 1 enemy
      // Per rules: "reveal a brown enemy token and fight it"
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          playerId: "player1",
          siteType: SiteType.Dungeon,
          enemyCount: 1,
        })
      );

      // Should emit COMBAT_STARTED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_STARTED,
          playerId: "player1",
        })
      );

      // Combat should have 1 enemy
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);

      // Enemy should be from brown deck
      for (const enemy of result.state.combat?.enemies ?? []) {
        const enemyDef = ENEMIES[enemy.enemyId];
        expect(enemyDef.color).toBe(ENEMY_COLOR_BROWN);
      }
    });

    it("should mark action taken and combatted this turn", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hasTakenActionThisTurn).toBe(true);
      expect(player?.hasCombattedThisTurn).toBe(true);
    });
  });

  describe("tomb", () => {
    it("should draw 1 red Draconum enemy when entering tomb", () => {
      const state = createTestStateWithSite(createTombSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit ENEMIES_DRAWN_FOR_SITE event with 1 enemy
      // Per rules: "draw a red Draconum enemy token to fight"
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          siteType: SiteType.Tomb,
          enemyCount: 1,
        })
      );

      // Combat should have 1 enemy
      expect(result.state.combat?.enemies).toHaveLength(1);

      // Enemy should be from red deck (Draconum)
      for (const enemy of result.state.combat?.enemies ?? []) {
        const enemyDef = ENEMIES[enemy.enemyId];
        expect(enemyDef.color).toBe(ENEMY_COLOR_RED);
      }
    });

    it("should always draw fresh enemy even if one exists on hex (enemies discarded after combat)", () => {
      // Per rules: "discard it afterwards (next time, a new token will be drawn)"
      // This means even if combat fails and enemy "stays", re-entering draws fresh
      // The existing enemy should be replaced/ignored

      // Create a red enemy already on the hex (simulating failed previous attempt)
      const redEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_RED
      );
      if (!redEnemyId) throw new Error("No red enemy found");

      const existingEnemyToken = createEnemyTokenId(redEnemyId);
      const state = createTestStateWithSite(createTombSite(), [createHexEnemy(existingEnemyToken)]);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit ENEMIES_DRAWN_FOR_SITE (always draws fresh for tomb)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          siteType: SiteType.Tomb,
          enemyCount: 1,
        })
      );

      // Combat should have exactly 1 enemy (the newly drawn one, NOT 2)
      expect(result.state.combat?.enemies).toHaveLength(1);
    });
  });

  describe("dungeon", () => {
    it("should always draw fresh enemy even if one exists on hex (enemies discarded after combat)", () => {
      // Per rules: dungeons also discard enemies after combat
      // "discard this token and claim your reward"

      // Create a brown enemy already on the hex (simulating failed previous attempt)
      const brownEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_BROWN
      );
      if (!brownEnemyId) throw new Error("No brown enemy found");

      const existingEnemyToken = createEnemyTokenId(brownEnemyId);
      const state = createTestStateWithSite(createDungeonSite(), [createHexEnemy(existingEnemyToken)]);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit ENEMIES_DRAWN_FOR_SITE (always draws fresh for dungeon)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          siteType: SiteType.Dungeon,
          enemyCount: 1,
        })
      );

      // Combat should have exactly 1 enemy (the newly drawn one, NOT 2)
      expect(result.state.combat?.enemies).toHaveLength(1);
    });
  });

  describe("monster den", () => {
    it("should draw 1 brown enemy when entering empty monster den", () => {
      // Monster den with no existing enemies - should draw fresh
      const state = createTestStateWithSite(createMonsterDenSite(), []);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit SITE_ENTERED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_ENTERED,
          siteType: SiteType.MonsterDen,
        })
      );

      // Should emit ENEMIES_DRAWN_FOR_SITE with 1 enemy
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          siteType: SiteType.MonsterDen,
          enemyCount: 1,
        })
      );

      // Combat should have 1 brown enemy
      expect(result.state.combat?.enemies).toHaveLength(1);
      const enemy = result.state.combat?.enemies[0];
      if (enemy) {
        expect(ENEMIES[enemy.enemyId].color).toBe(ENEMY_COLOR_BROWN);
      }
    });

    it("should fight existing enemy at monster den (from failed previous attempt)", () => {
      // Create a brown enemy already on the hex (persisted from failed attempt)
      // Per rules: "If you fail to defeat it, leave the enemy token face up on the space"
      const brownEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_BROWN
      );
      if (!brownEnemyId) throw new Error("No brown enemy found");

      const enemyToken = createEnemyTokenId(brownEnemyId);
      const state = createTestStateWithSite(createMonsterDenSite(), [createHexEnemy(enemyToken)]);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit SITE_ENTERED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_ENTERED,
          siteType: SiteType.MonsterDen,
        })
      );

      // Should NOT emit ENEMIES_DRAWN_FOR_SITE (fight existing enemy)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
        })
      );

      // Combat should have 1 enemy (the existing one)
      expect(result.state.combat?.enemies).toHaveLength(1);
    });
  });

  describe("ruins", () => {
    it("should fight brown enemy at night ruins", () => {
      // Create a brown enemy for night ruins
      const brownEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_BROWN
      );
      if (!brownEnemyId) throw new Error("No brown enemy found");

      const enemyToken = createEnemyTokenId(brownEnemyId);
      const state = createTestStateWithSite(
        createRuinsSite(),
        [createHexEnemy(enemyToken)],
        TIME_OF_DAY_NIGHT
      );

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should start combat
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
    });

    it("should auto-conquer day ruins with no enemies", () => {
      // Day ruins with no enemies = instant conquest
      const state = createTestStateWithSite(
        createRuinsSite(),
        [], // No enemies
        TIME_OF_DAY_DAY
      );

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit SITE_ENTERED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_ENTERED,
          siteType: SiteType.AncientRuins,
        })
      );

      // Should emit SITE_CONQUERED (auto-conquest)
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: SITE_CONQUERED,
          playerId: "player1",
        })
      );

      // Should NOT start combat
      expect(result.state.combat).toBeNull();

      // Site should be conquered
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.site?.isConquered).toBe(true);
      expect(hex?.site?.owner).toBe("player1");
    });
  });

  describe("integration", () => {
    it("should update enemy token piles after drawing", () => {
      const state = createTestStateWithSite(createDungeonSite());

      // Count brown enemies before
      const brownBefore = state.enemyTokens.drawPiles[ENEMY_COLOR_BROWN].length;

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should have 1 fewer brown enemy in draw pile (dungeon draws 1)
      const brownAfter = result.state.enemyTokens.drawPiles[ENEMY_COLOR_BROWN].length;
      expect(brownAfter).toBe(brownBefore - 1);
    });

    it("should update hex with drawn enemies", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Hex should have 1 enemy (dungeon draws 1)
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(1);
    });
  });

  describe("dungeon/tomb enemy discard on failure", () => {
    /**
     * Helper to run through all combat phases without defeating enemy.
     * This simulates a failed combat where player takes wounds but doesn't kill enemy.
     */
    function failCombat(
      eng: MageKnightEngine,
      initialState: GameState
    ): { state: GameState; events: import("@mage-knight/shared").GameEvent[] } {
      let state = initialState;
      const allEvents: import("@mage-knight/shared").GameEvent[] = [];

      // Phase 1: Ranged/Siege -> Block
      let result = eng.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      allEvents.push(...result.events);

      // Phase 2: Block -> Assign Damage
      result = eng.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      allEvents.push(...result.events);

      // Phase 3: Assign Damage - must process damage from unblocked enemy
      // For multi-attack enemies, each attack needs damage assigned separately
      const enemy = state.combat?.enemies[0];
      const enemyInstanceId = enemy?.instanceId;
      if (enemyInstanceId) {
        const numAttacks = enemy?.definition?.attacks?.length ?? 1;
        for (let attackIndex = 0; attackIndex < numAttacks; attackIndex++) {
          result = eng.processAction(state, "player1", {
            type: ASSIGN_DAMAGE_ACTION,
            enemyInstanceId,
            attackIndex,
          });
          state = result.state;
          allEvents.push(...result.events);
        }
      }

      // Phase 3 continued: Assign Damage -> Attack
      result = eng.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      allEvents.push(...result.events);

      // Phase 4: Attack -> Combat ends (enemy not defeated = failure)
      result = eng.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      allEvents.push(...result.events);

      return { state, events: allEvents };
    }

    it("should discard tomb enemy immediately when combat fails (not persist on hex)", () => {
      // This is the key rule: "discard it afterwards (next time, a new token will be drawn)"
      // Enemy should be discarded AFTER combat ends, not left on hex
      const state = createTestStateWithSite(createTombSite());

      // Enter tomb - starts combat with 1 red enemy
      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
      expect(result.state.combat?.discardEnemiesOnFailure).toBe(true);

      // Run through combat, failing to defeat the enemy
      const finalResult = failCombat(engine, result.state);

      // Combat should have ended
      expect(finalResult.state.combat).toBeNull();

      // CRITICAL: Enemy should be discarded from hex (not persist for next attempt)
      const hex = finalResult.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(0);
    });

    it("should discard dungeon enemy immediately when combat fails (not persist on hex)", () => {
      const state = createTestStateWithSite(createDungeonSite());

      // Enter dungeon - starts combat with 1 brown enemy
      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.discardEnemiesOnFailure).toBe(true);

      // Run through combat, failing to defeat the enemy
      const finalResult = failCombat(engine, result.state);

      // Combat ended, enemy should be discarded
      expect(finalResult.state.combat).toBeNull();
      const hex = finalResult.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(0);
    });

    it("should NOT discard monster den enemy when combat fails (persists for next attempt)", () => {
      const state = createTestStateWithSite(createMonsterDenSite(), []);

      // Enter monster den - draws 1 brown enemy
      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.discardEnemiesOnFailure).toBe(false);

      // Run through combat, failing to defeat the enemy
      const finalResult = failCombat(engine, result.state);

      // Combat ended, but enemy SHOULD persist on hex for monster den
      expect(finalResult.state.combat).toBeNull();
      const hex = finalResult.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(1); // Enemy stays!
    });
  });

  describe("dungeon/tomb combat restrictions", () => {
    it("should set unitsAllowed=false for dungeon combat", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.unitsAllowed).toBe(false);
    });

    it("should set nightManaRules=true for dungeon combat", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.nightManaRules).toBe(true);
    });

    it("should set unitsAllowed=false for tomb combat", () => {
      const state = createTestStateWithSite(createTombSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.unitsAllowed).toBe(false);
    });

    it("should set nightManaRules=true for tomb combat", () => {
      const state = createTestStateWithSite(createTombSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.nightManaRules).toBe(true);
    });

    it("should set unitsAllowed=true for monster den combat", () => {
      // Monster den allows units (unlike dungeon/tomb)
      const state = createTestStateWithSite(createMonsterDenSite(), []);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.unitsAllowed).toBe(true);
    });

    it("should set nightManaRules=false for monster den combat", () => {
      // Monster den uses normal mana rules (unlike dungeon/tomb)
      const state = createTestStateWithSite(createMonsterDenSite(), []);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.nightManaRules).toBe(false);
    });
  });
});
