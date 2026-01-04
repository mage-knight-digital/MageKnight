/**
 * Conquest system tests
 */

import { describe, it, expect } from "vitest";
import {
  countOwnedKeeps,
  isNearOwnedKeep,
  getEffectiveHandLimit,
} from "../helpers/handLimitHelpers.js";
import { createConquerSiteCommand } from "../commands/conquerSiteCommand.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import { TERRAIN_PLAINS, hexKey, SITE_CONQUERED, SHIELD_TOKEN_PLACED } from "@mage-knight/shared";
import type { CityState } from "../../types/city.js";
import {
  CITY_COLOR_RED,
} from "../../types/mapConstants.js";

/**
 * Helper to create a keep site
 */
function createKeepSite(owner: string | null = null): Site {
  return {
    type: SiteType.Keep,
    owner,
    isConquered: owner !== null,
    isBurned: false,
  };
}

/**
 * Helper to create a city site
 */
function createCitySite(cityColor: typeof CITY_COLOR_RED): Site {
  return {
    type: SiteType.City,
    owner: null,
    isConquered: false,
    isBurned: false,
    cityColor,
  };
}

/**
 * Helper to create adventure site
 */
function createAdventureSite(): Site {
  return {
    type: SiteType.AncientRuins,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create test state with keeps at specified locations
 */
function createTestStateWithKeeps(
  keeps: { coord: { q: number; r: number }; owner: string | null }[]
): GameState {
  const baseState = createTestGameState();
  const hexes: Record<string, HexState> = { ...baseState.map.hexes };

  for (const keep of keeps) {
    hexes[hexKey(keep.coord)] = createTestHex(
      keep.coord.q,
      keep.coord.r,
      TERRAIN_PLAINS,
      createKeepSite(keep.owner)
    );
  }

  return {
    ...baseState,
    map: { ...baseState.map, hexes },
  };
}

/**
 * Create test state with player at a keep they own
 */
function createTestStateWithPlayerAtKeep(
  playerId: string,
  coord: { q: number; r: number }
): GameState {
  const player = createTestPlayer({
    id: playerId,
    position: coord,
    handLimit: 5,
  });

  const state = createTestStateWithKeeps([{ coord, owner: playerId }]);
  return {
    ...state,
    players: [player],
    turnOrder: [playerId],
  };
}

/**
 * Create test state with player adjacent to owned keep
 */
function createTestStateWithPlayerAdjacentToKeep(playerId: string): GameState {
  // Player at (0,0), keep at (1,0) which is East/adjacent
  const player = createTestPlayer({
    id: playerId,
    position: { q: 0, r: 0 },
    handLimit: 5,
  });

  const state = createTestStateWithKeeps([
    { coord: { q: 1, r: 0 }, owner: playerId },
  ]);
  return {
    ...state,
    players: [player],
    turnOrder: [playerId],
  };
}

/**
 * Create test state with player far from their keep
 */
function createTestStateWithPlayerFarFromKeep(playerId: string): GameState {
  // Player at (0,0), keep at (5,5) which is not adjacent
  const player = createTestPlayer({
    id: playerId,
    position: { q: 0, r: 0 },
    handLimit: 5,
  });

  const state = createTestStateWithKeeps([
    { coord: { q: 5, r: 5 }, owner: playerId },
  ]);
  return {
    ...state,
    players: [player],
    turnOrder: [playerId],
  };
}

/**
 * Create test state where player owns 2 keeps and is adjacent to one
 */
function createTestStateWithTwoKeepsOwned(playerId: string): GameState {
  // Player at (0,0), owns keeps at (1,0) and (5,5)
  // Adjacent to (1,0), so should get bonus
  const player = createTestPlayer({
    id: playerId,
    position: { q: 0, r: 0 },
    handLimit: 5,
  });

  const state = createTestStateWithKeeps([
    { coord: { q: 1, r: 0 }, owner: playerId },
    { coord: { q: 5, r: 5 }, owner: playerId },
  ]);
  return {
    ...state,
    players: [player],
    turnOrder: [playerId],
  };
}

/**
 * Create test state where player owns keeps but is not near any
 */
function createTestStateNotNearKeeps(playerId: string): GameState {
  // Player at (0,0), owns keeps at (5,5) and (6,6)
  // Not adjacent to any
  const player = createTestPlayer({
    id: playerId,
    position: { q: 0, r: 0 },
    handLimit: 5,
  });

  const state = createTestStateWithKeeps([
    { coord: { q: 5, r: 5 }, owner: playerId },
    { coord: { q: 6, r: 6 }, owner: playerId },
  ]);
  return {
    ...state,
    players: [player],
    turnOrder: [playerId],
  };
}

describe("Conquest System", () => {
  describe("Keep hand limit bonus", () => {
    it("should return 0 keeps when none owned", () => {
      const state = createTestStateWithKeeps([]);
      expect(countOwnedKeeps(state, "player1")).toBe(0);
    });

    it("should count all owned keeps", () => {
      const state = createTestStateWithKeeps([
        { coord: { q: 0, r: 0 }, owner: "player1" },
        { coord: { q: 5, r: 5 }, owner: "player1" },
        { coord: { q: 3, r: 3 }, owner: "player2" },
      ]);
      expect(countOwnedKeeps(state, "player1")).toBe(2);
    });

    it("should detect when player is on owned keep", () => {
      const state = createTestStateWithPlayerAtKeep("player1", { q: 0, r: 0 });
      expect(isNearOwnedKeep(state, "player1")).toBe(true);
    });

    it("should detect when player is adjacent to owned keep", () => {
      const state = createTestStateWithPlayerAdjacentToKeep("player1");
      expect(isNearOwnedKeep(state, "player1")).toBe(true);
    });

    it("should return false when not near any owned keep", () => {
      const state = createTestStateWithPlayerFarFromKeep("player1");
      expect(isNearOwnedKeep(state, "player1")).toBe(false);
    });

    it("should add keep bonus to hand limit when adjacent", () => {
      // Player owns 2 keeps, is adjacent to one
      // Base hand limit: 5
      // Expected: 5 + 2 = 7
      const state = createTestStateWithTwoKeepsOwned("player1");
      expect(getEffectiveHandLimit(state, "player1")).toBe(7);
    });

    it("should not add keep bonus when not adjacent to owned keep", () => {
      // Player owns 2 keeps, but is not near any of them
      // Expected: 5 (base only)
      const state = createTestStateNotNearKeeps("player1");
      expect(getEffectiveHandLimit(state, "player1")).toBe(5);
    });

    it("should return default hand limit for unknown player", () => {
      const state = createTestGameState();
      expect(getEffectiveHandLimit(state, "unknown")).toBe(5);
    });
  });

  describe("Site conquest command", () => {
    it("should mark site as conquered", () => {
      // Create state with an unconquered adventure site
      const hexCoord = { q: 2, r: 2 };
      const player = createTestPlayer({ id: "player1", position: hexCoord });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createAdventureSite()
        ),
      };

      const state: GameState = {
        ...baseState,
        players: [player],
        turnOrder: ["player1"],
        map: { ...baseState.map, hexes },
      };

      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
      });

      const result = command.execute(state);

      const conqueredHex = result.state.map.hexes[hexKey(hexCoord)];
      expect(conqueredHex?.site?.isConquered).toBe(true);
      expect(conqueredHex?.site?.owner).toBe("player1");
    });

    it("should add shield token to hex", () => {
      const hexCoord = { q: 2, r: 2 };
      const player = createTestPlayer({ id: "player1", position: hexCoord });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createAdventureSite()
        ),
      };

      const state: GameState = {
        ...baseState,
        players: [player],
        turnOrder: ["player1"],
        map: { ...baseState.map, hexes },
      };

      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
      });

      const result = command.execute(state);

      const conqueredHex = result.state.map.hexes[hexKey(hexCoord)];
      expect(conqueredHex?.shieldTokens).toContain("player1");
    });

    it("should emit SITE_CONQUERED and SHIELD_TOKEN_PLACED events", () => {
      const hexCoord = { q: 2, r: 2 };
      const player = createTestPlayer({ id: "player1", position: hexCoord });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createAdventureSite()
        ),
      };

      const state: GameState = {
        ...baseState,
        players: [player],
        turnOrder: ["player1"],
        map: { ...baseState.map, hexes },
      };

      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
      });

      const result = command.execute(state);

      const siteConqueredEvent = result.events.find(
        (e) => e.type === SITE_CONQUERED
      );
      const shieldPlacedEvent = result.events.find(
        (e) => e.type === SHIELD_TOKEN_PLACED
      );

      expect(siteConqueredEvent).toBeDefined();
      expect(shieldPlacedEvent).toBeDefined();
      if (shieldPlacedEvent && shieldPlacedEvent.type === SHIELD_TOKEN_PLACED) {
        expect(shieldPlacedEvent.totalShields).toBe(1);
      }
    });

    it("should throw error when no site at location", () => {
      const hexCoord = { q: 0, r: 0 }; // Has no site in default test state
      const state = createTestGameState();

      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
      });

      expect(() => command.execute(state)).toThrow("No site at this location");
    });

    it("should track multiple shields for cities", () => {
      const hexCoord = { q: 3, r: 3 };
      const player = createTestPlayer({ id: "player1", position: hexCoord });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createCitySite(CITY_COLOR_RED)
        ),
      };

      // Add city state
      const cityState: CityState = {
        color: CITY_COLOR_RED,
        level: 1,
        garrison: [],
        shields: [],
        isConquered: false,
        leaderId: null,
      };

      const state: GameState = {
        ...baseState,
        players: [player],
        turnOrder: ["player1"],
        map: { ...baseState.map, hexes },
        cities: { [CITY_COLOR_RED]: cityState },
      };

      // Conquer city defeating 3 enemies
      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
        enemiesDefeated: 3,
      });

      const result = command.execute(state);

      // Check city state has 3 shields
      const updatedCityState = result.state.cities[CITY_COLOR_RED];
      expect(updatedCityState?.shields.length).toBe(3);
      expect(updatedCityState?.isConquered).toBe(true);

      // Check event
      const shieldEvent = result.events.find(
        (e) => e.type === SHIELD_TOKEN_PLACED
      );
      if (shieldEvent && shieldEvent.type === SHIELD_TOKEN_PLACED) {
        expect(shieldEvent.totalShields).toBe(3);
      }
    });

    it("should determine city leader correctly", () => {
      const hexCoord = { q: 3, r: 3 };
      const player1 = createTestPlayer({ id: "player1", position: hexCoord });
      const player2 = createTestPlayer({ id: "player2", position: { q: 0, r: 0 } });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createCitySite(CITY_COLOR_RED)
        ),
      };

      // City already has 1 shield from player2
      const cityState: CityState = {
        color: CITY_COLOR_RED,
        level: 1,
        garrison: [],
        shields: [{ playerId: "player2", order: 0 }],
        isConquered: false,
        leaderId: "player2",
      };

      const state: GameState = {
        ...baseState,
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        map: { ...baseState.map, hexes },
        cities: { [CITY_COLOR_RED]: cityState },
      };

      // Player 1 conquers, defeating 2 enemies (gets 2 shields)
      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
        enemiesDefeated: 2,
      });

      const result = command.execute(state);

      // Player 1 now has 2 shields, player 2 has 1
      // Leader should be player 1
      const updatedCityState = result.state.cities[CITY_COLOR_RED];
      expect(updatedCityState?.leaderId).toBe("player1");
    });

    it("should break city leader ties by first placement", () => {
      const hexCoord = { q: 3, r: 3 };
      const player1 = createTestPlayer({ id: "player1", position: hexCoord });
      const player2 = createTestPlayer({ id: "player2", position: { q: 0, r: 0 } });
      const baseState = createTestGameState();

      const hexes: Record<string, HexState> = {
        ...baseState.map.hexes,
        [hexKey(hexCoord)]: createTestHex(
          hexCoord.q,
          hexCoord.r,
          TERRAIN_PLAINS,
          createCitySite(CITY_COLOR_RED)
        ),
      };

      // City already has 2 shields from player2
      const cityState: CityState = {
        color: CITY_COLOR_RED,
        level: 1,
        garrison: [],
        shields: [
          { playerId: "player2", order: 0 },
          { playerId: "player2", order: 1 },
        ],
        isConquered: false,
        leaderId: "player2",
      };

      const state: GameState = {
        ...baseState,
        players: [player1, player2],
        turnOrder: ["player1", "player2"],
        map: { ...baseState.map, hexes },
        cities: { [CITY_COLOR_RED]: cityState },
      };

      // Player 1 conquers, defeating 2 enemies (gets 2 shields)
      // Both have 2 shields, but player 2 placed first
      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
        enemiesDefeated: 2,
      });

      const result = command.execute(state);

      // Tie at 2 shields each, player 2 placed first (order 0)
      // Leader should still be player 2
      const updatedCityState = result.state.cities[CITY_COLOR_RED];
      expect(updatedCityState?.leaderId).toBe("player2");
    });

    it("should not allow undo", () => {
      const hexCoord = { q: 2, r: 2 };
      const state = createTestGameState();

      const command = createConquerSiteCommand({
        playerId: "player1",
        hexCoord,
      });

      expect(() => command.undo(state)).toThrow("Cannot undo CONQUER_SITE");
    });
  });
});
