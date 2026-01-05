/**
 * Enter adventure site tests
 *
 * Tests for:
 * - Validation: must be at adventure site, site not conquered
 * - Dungeon: draws 2 brown enemies, starts combat
 * - Tomb: draws 2 red enemies, starts combat
 * - Monster den: fights existing enemy
 * - Ruins: day = auto-conquest if empty, night = fight brown enemy
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_SITE_ACTION,
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
  ENEMY_COLOR_GREEN,
  ENEMIES,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import { createEnemyTokenId, resetTokenCounter, createEnemyTokenPiles } from "../helpers/enemyHelpers.js";
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
  enemies: readonly EnemyTokenId[] = [],
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

    it("should reject if monster den has no enemies", () => {
      // Monster den with no enemies (shouldn't happen normally, but test the validator)
      const state = createTestStateWithSite(createMonsterDenSite(), []);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "There are no enemies at this site",
        })
      );
    });
  });

  describe("dungeon", () => {
    it("should draw 2 brown enemies when entering dungeon", () => {
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

      // Should emit ENEMIES_DRAWN_FOR_SITE event with 2 enemies
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          playerId: "player1",
          siteType: SiteType.Dungeon,
          enemyCount: 2,
        })
      );

      // Should emit COMBAT_STARTED event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_STARTED,
          playerId: "player1",
        })
      );

      // Combat should have 2 enemies
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Enemies should be from brown deck
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
    it("should draw 2 red enemies when entering tomb", () => {
      const state = createTestStateWithSite(createTombSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should emit ENEMIES_DRAWN_FOR_SITE event with 2 enemies
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
          siteType: SiteType.Tomb,
          enemyCount: 2,
        })
      );

      // Combat should have 2 enemies
      expect(result.state.combat?.enemies).toHaveLength(2);

      // Enemies should be from red deck
      for (const enemy of result.state.combat?.enemies ?? []) {
        const enemyDef = ENEMIES[enemy.enemyId];
        expect(enemyDef.color).toBe(ENEMY_COLOR_RED);
      }
    });
  });

  describe("monster den", () => {
    it("should fight existing enemy at monster den", () => {
      // Create a green enemy already on the hex (from tile reveal)
      const greenEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_GREEN
      );
      if (!greenEnemyId) throw new Error("No green enemy found");

      const enemyToken = createEnemyTokenId(greenEnemyId);
      const state = createTestStateWithSite(createMonsterDenSite(), [enemyToken]);

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

      // Should NOT emit ENEMIES_DRAWN_FOR_SITE (enemies already there)
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: ENEMIES_DRAWN_FOR_SITE,
        })
      );

      // Combat should have 1 enemy
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
        [enemyToken],
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

      // Should have 2 fewer brown enemies in draw pile
      const brownAfter = result.state.enemyTokens.drawPiles[ENEMY_COLOR_BROWN].length;
      expect(brownAfter).toBe(brownBefore - 2);
    });

    it("should update hex with drawn enemies", () => {
      const state = createTestStateWithSite(createDungeonSite());

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Hex should have enemies
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(2);
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
      // Create a green enemy for monster den
      const greenEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_GREEN
      );
      if (!greenEnemyId) throw new Error("No green enemy found");

      const enemyToken = createEnemyTokenId(greenEnemyId);
      const state = createTestStateWithSite(createMonsterDenSite(), [enemyToken]);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.unitsAllowed).toBe(true);
    });

    it("should set nightManaRules=false for monster den combat", () => {
      const greenEnemyId = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]).find(
        (id) => ENEMIES[id].color === ENEMY_COLOR_GREEN
      );
      if (!greenEnemyId) throw new Error("No green enemy found");

      const enemyToken = createEnemyTokenId(greenEnemyId);
      const state = createTestStateWithSite(createMonsterDenSite(), [enemyToken]);

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      expect(result.state.combat?.nightManaRules).toBe(false);
    });
  });
});
