/**
 * Shared test helpers for engine tests
 */

import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexState } from "../../types/map.js";
import { Hero } from "../../types/hero.js";
import { TileId, SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { Terrain } from "@mage-knight/shared";
import {
  GAME_PHASE_ROUND,
  TIME_OF_DAY_DAY,
  TERRAIN_FOREST,
  TERRAIN_HILLS,
  TERRAIN_PLAINS,
  hexKey,
  CARD_MARCH,
} from "@mage-knight/shared";

/**
 * Create a test player with sensible defaults
 */
export function createTestPlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "player1",
    hero: Hero.Arythea,
    position: { q: 0, r: 0 },
    fame: 0,
    level: 1,
    reputation: 0,
    armor: 2,
    handLimit: 5,
    commandTokens: 1,
    hand: [CARD_MARCH], // Default to having a card to avoid mandatory announcement
    deck: [],
    discard: [],
    units: [],
    skills: [],
    skillCooldowns: {
      usedThisRound: [],
      usedThisTurn: [],
      usedThisCombat: [],
      activeUntilNextTurn: [],
    },
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    tacticCard: null,
    knockedOut: false,
    roundOrderTokenFaceDown: false,
    movePoints: 0,
    influencePoints: 0,
    playArea: [],
    pureMana: [],
    usedManaFromSource: false,
    usedDieId: null,
    hasMovedThisTurn: false,
    hasTakenActionThisTurn: false,
    combatAccumulator: {
      attack: {
        normal: 0,
        ranged: 0,
        siege: 0,
        normalElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        rangedElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
        siegeElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
      },
      block: 0,
      blockElements: { physical: 0, fire: 0, ice: 0, coldFire: 0 },
    },
    pendingChoice: null,
    pendingLevelUps: [],
    hasCombattedThisTurn: false,
    ...overrides,
  };
}

/**
 * Create a test hex with sensible defaults
 */
export function createTestHex(
  q: number,
  r: number,
  terrain: Terrain = TERRAIN_PLAINS,
  site: Site | null = null
): HexState {
  return {
    coord: { q, r },
    terrain,
    tileId: TileId.StartingTileA,
    site,
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
  };
}

/**
 * Create a default village site
 */
export function createVillageSite(): Site {
  return {
    type: SiteType.Village,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create a test game state with a small map
 */
export function createTestGameState(
  overrides: Partial<GameState> = {}
): GameState {
  const baseState = createInitialGameState();
  const player = createTestPlayer({ movePoints: 4 });

  // Create a small map with adjacent hexes
  const hexes: Record<string, HexState> = {
    [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, TERRAIN_PLAINS), // Player starts here
    [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS), // East - cost 2
    [hexKey({ q: 0, r: 1 })]: createTestHex(0, 1, TERRAIN_FOREST), // Southeast - cost 3 day, 5 night
    [hexKey({ q: -1, r: 0 })]: createTestHex(-1, 0, TERRAIN_HILLS), // West - cost 3
  };

  return {
    ...baseState,
    phase: GAME_PHASE_ROUND,
    timeOfDay: TIME_OF_DAY_DAY,
    turnOrder: ["player1"],
    currentPlayerIndex: 0,
    endOfRoundAnnouncedBy: null,
    playersWithFinalTurn: [],
    players: [player],
    map: {
      ...baseState.map,
      hexes,
    },
    ...overrides,
  };
}
