/**
 * Dungeon/Tomb combat restrictions tests
 *
 * Tests for:
 * - Units not allowed in dungeon/tomb combat
 * - Night mana rules (no gold, yes black) in dungeon/tomb
 * - Re-entry to conquered dungeons/tombs
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_SITE_ACTION,
  ACTIVATE_UNIT_ACTION,
  PLAY_CARD_ACTION,
  INVALID_ACTION,
  TERRAIN_PLAINS,
  hexKey,
  TIME_OF_DAY_DAY,
  MANA_SOURCE_TOKEN,
  MANA_GOLD,
  MANA_BLACK,
  UNIT_STATE_READY,
  ENEMIES,
  ENEMY_COLOR_BROWN,
  UNIT_PEASANTS,
  CARD_STAMINA,
} from "@mage-knight/shared";
import type { EnemyId } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import { createEnemyTokenPiles, resetTokenCounter } from "../helpers/enemyHelpers.js";
import { createRng } from "../../utils/rng.js";
import { createCombatState } from "../../types/combat.js";
import type { Player } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";

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
 * Create test state with player in dungeon combat
 */
function createStateInDungeonCombat(): GameState {
  const baseState = createTestGameState();
  const playerCoord = { q: 0, r: 0 };

  // Create hex with dungeon site
  const siteHex: HexState = {
    coord: playerCoord,
    terrain: TERRAIN_PLAINS,
    tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
    site: createDungeonSite(),
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
  };

  const hexes: Record<string, HexState> = {
    ...baseState.map.hexes,
    [hexKey(playerCoord)]: siteHex,
  };

  // Create enemy token piles
  const rng = createRng(12345);
  const { piles: enemyTokens } = createEnemyTokenPiles(rng);

  // Find a brown enemy for combat
  const brownEnemyId = (Object.keys(ENEMIES) as EnemyId[]).find(
    (id) => ENEMIES[id].color === ENEMY_COLOR_BROWN
  );
  if (!brownEnemyId) throw new Error("No brown enemy found");

  // Create a unit for the player
  const testUnit: PlayerUnit = {
    instanceId: "unit1",
    unitId: UNIT_PEASANTS,
    state: UNIT_STATE_READY,
    wounded: false,
    usedResistanceThisCombat: false,
  };

  const player = createTestPlayer({
    id: "player1",
    position: playerCoord,
    hasTakenActionThisTurn: false,
    hasCombattedThisTurn: true,
    units: [testUnit],
    // Add mana tokens for testing mana restrictions
    pureMana: [
      { id: "gold1", color: MANA_GOLD },
      { id: "black1", color: MANA_BLACK },
    ],
  });

  // Create combat state with dungeon restrictions
  const combat = createCombatState(
    [brownEnemyId],
    false, // not fortified
    {
      unitsAllowed: false, // Dungeon: no units
      nightManaRules: true, // Dungeon: night mana rules
    }
  );

  return {
    ...baseState,
    timeOfDay: TIME_OF_DAY_DAY, // Even during day, dungeon uses night rules
    players: [player],
    turnOrder: ["player1"],
    map: { ...baseState.map, hexes },
    enemyTokens,
    rng,
    combat,
  };
}

/**
 * Create test state with player in monster den combat (normal rules)
 */
function createStateInMonsterDenCombat(): GameState {
  const state = createStateInDungeonCombat();

  // Update the site to monster den
  const key = hexKey({ q: 0, r: 0 });
  const hex = state.map.hexes[key];
  if (!hex) throw new Error("Hex not found");

  const updatedHex: HexState = {
    ...hex,
    site: {
      type: SiteType.MonsterDen,
      owner: null,
      isConquered: false,
      isBurned: false,
    },
  };

  // Create combat state with NORMAL restrictions (not dungeon)
  const brownEnemyId = (Object.keys(ENEMIES) as EnemyId[]).find(
    (id) => ENEMIES[id].color === ENEMY_COLOR_BROWN
  );
  if (!brownEnemyId) throw new Error("No brown enemy found");

  const combat = createCombatState(
    [brownEnemyId],
    false, // not fortified
    {
      unitsAllowed: true, // Monster den: units allowed
      nightManaRules: false, // Monster den: normal mana rules
    }
  );

  return {
    ...state,
    map: { ...state.map, hexes: { ...state.map.hexes, [key]: updatedHex } },
    combat,
  };
}

describe("Dungeon/Tomb combat restrictions", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("units not allowed", () => {
    it("should reject unit activation in dungeon combat", () => {
      const state = createStateInDungeonCombat();

      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "unit1",
        abilityIndex: 0, // First ability (Attack for Peasants)
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Units cannot be used in this combat (dungeon/tomb)",
        })
      );
    });

    it("should allow unit activation in monster den combat", () => {
      const state = createStateInMonsterDenCombat();

      // This should NOT be rejected for units (may fail for other reasons like phase)
      const result = engine.processAction(state, "player1", {
        type: ACTIVATE_UNIT_ACTION,
        unitInstanceId: "unit1",
        abilityIndex: 0,
      });

      // Should NOT contain the "units not allowed" rejection
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("Units cannot be used"),
        })
      );
    });
  });

  describe("night mana rules", () => {
    it("should reject gold mana in dungeon combat", () => {
      const state = createStateInDungeonCombat();

      // Try to play a card powered with gold mana
      const player = state.players[0];
      if (!player) throw new Error("Player not found");

      // Add a card to hand
      const updatedPlayer: Player = {
        ...player,
        hand: [CARD_STAMINA],
      };

      const stateWithCard: GameState = {
        ...state,
        players: [updatedPlayer],
      };

      const result = engine.processAction(stateWithCard, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_STAMINA,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_TOKEN,
          color: MANA_GOLD,
        },
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Gold mana cannot be used in dungeon/tomb combat (night rules apply)",
        })
      );
    });

    it("should allow black mana in dungeon combat (even during day)", () => {
      const state = createStateInDungeonCombat();

      // Verify it's daytime
      expect(state.timeOfDay).toBe(TIME_OF_DAY_DAY);

      // Try to play a card powered with black mana
      const player = state.players[0];
      if (!player) throw new Error("Player not found");

      // Add a card to hand (note: black can't power action cards normally,
      // but should NOT be rejected by time-of-day check)
      const updatedPlayer: Player = {
        ...player,
        hand: [CARD_STAMINA],
      };

      const stateWithCard: GameState = {
        ...state,
        players: [updatedPlayer],
      };

      const result = engine.processAction(stateWithCard, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_STAMINA,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_TOKEN,
          color: MANA_BLACK,
        },
      });

      // Should NOT be rejected for "black mana day" - that's the point of dungeon rules!
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("Black mana cannot be used during the day"),
        })
      );

      // It WILL be rejected because black can't power action cards (different rule)
      // but that's a different validation
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: "Black mana cannot power action cards",
        })
      );
    });

    it("should allow gold mana in monster den combat during day", () => {
      const state = createStateInMonsterDenCombat();

      const player = state.players[0];
      if (!player) throw new Error("Player not found");

      // Add a green card to hand (gold matches green during day)
      const updatedPlayer: Player = {
        ...player,
        hand: [CARD_STAMINA], // Stamina is green
      };

      const stateWithCard: GameState = {
        ...state,
        players: [updatedPlayer],
      };

      const result = engine.processAction(stateWithCard, "player1", {
        type: PLAY_CARD_ACTION,
        cardId: CARD_STAMINA,
        powered: true,
        manaSource: {
          type: MANA_SOURCE_TOKEN,
          color: MANA_GOLD,
        },
      });

      // Should NOT be rejected for dungeon mana rules
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("dungeon/tomb combat"),
        })
      );
    });
  });

  describe("re-entry", () => {
    it("should allow re-entering conquered dungeon", () => {
      const baseState = createTestGameState();
      const playerCoord = { q: 0, r: 0 };

      // Create hex with CONQUERED dungeon site
      const siteHex: HexState = {
        coord: playerCoord,
        terrain: TERRAIN_PLAINS,
        tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
        site: createDungeonSite(true), // Conquered
        enemies: [],
        shieldTokens: [{ playerId: "player1", placedRound: 1 }],
        rampagingEnemies: [],
      };

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(playerCoord)]: siteHex,
      };

      const rng = createRng(12345);
      const { piles: enemyTokens } = createEnemyTokenPiles(rng);

      const player = createTestPlayer({
        id: "player1",
        position: playerCoord,
        hasTakenActionThisTurn: false,
        hasCombattedThisTurn: false,
      });

      const state: GameState = {
        ...baseState,
        timeOfDay: TIME_OF_DAY_DAY,
        players: [player],
        turnOrder: ["player1"],
        map: { ...baseState.map, hexes },
        enemyTokens,
        rng,
      };

      const result = engine.processAction(state, "player1", {
        type: ENTER_SITE_ACTION,
      });

      // Should NOT be rejected
      expect(result.events).not.toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );

      // Combat should start
      expect(result.state.combat).not.toBeNull();
    });
  });
});
