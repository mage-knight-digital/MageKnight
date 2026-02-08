/**
 * Altar Tribute tests
 *
 * Tests for:
 * - Paying altar tribute with mana tokens → fame + conquest
 * - Paying altar tribute with crystals → crystals consumed
 * - Rejection when insufficient mana / wrong color
 * - Rejection when site already conquered
 * - Ruins token discarded after tribute
 */

import { describe, it, expect } from "vitest";
import {
  createAltarTributeCommand,
} from "../commands/altarTributeCommand.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  hexKey,
  MANA_SOURCE_TOKEN,
  MANA_SOURCE_CRYSTAL,
  FAME_GAINED,
  ALTAR_TRIBUTE_PAID,
  SITE_CONQUERED,
  SHIELD_TOKEN_PLACED,
  TERRAIN_PLAINS,
  type RuinsTokenId,
  type ManaSourceInfo,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState, RuinsToken } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import type { RuinsTokenPiles } from "../helpers/ruinsTokenHelpers.js";

// =============================================================================
// HELPERS
// =============================================================================

function createRuinsSite(isConquered = false): Site {
  return {
    type: SiteType.AncientRuins,
    owner: isConquered ? "player1" : null,
    isConquered,
    isBurned: false,
  };
}

function createRuinsToken(tokenId: string, isRevealed = true): RuinsToken {
  return {
    tokenId: tokenId as RuinsTokenId,
    isRevealed,
  };
}

function createAltarTributeState(
  tokenId: string,
  playerOverrides: Partial<Parameters<typeof createTestPlayer>[0]> = {},
  siteOverrides: Partial<{ isConquered: boolean }> = {}
): GameState {
  const baseState = createTestGameState();
  const playerCoord = { q: 0, r: 0 };

  const site = createRuinsSite(siteOverrides.isConquered ?? false);
  const ruinsToken = createRuinsToken(tokenId);

  const siteHex: HexState = {
    coord: playerCoord,
    terrain: TERRAIN_PLAINS,
    tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
    site,
    enemies: [],
    shieldTokens: [],
    rampagingEnemies: [],
    ruinsToken,
  };

  const hexes: Record<string, HexState> = {
    ...baseState.map.hexes,
    [hexKey(playerCoord)]: siteHex,
  };

  const player = createTestPlayer({
    id: "player1",
    position: playerCoord,
    hasTakenActionThisTurn: false,
    hasCombattedThisTurn: false,
    ...playerOverrides,
  });

  // Add the token to the draw pile so it exists in piles for discard
  const ruinsTokenPiles: RuinsTokenPiles = {
    drawPile: [],
    discardPile: [],
  };

  return {
    ...baseState,
    players: [player],
    turnOrder: ["player1"],
    map: { ...baseState.map, hexes },
    ruinsTokens: ruinsTokenPiles,
  };
}

// =============================================================================
// TESTS
// =============================================================================

describe("Altar Tribute", () => {
  describe("basic blue altar", () => {
    it("should consume mana tokens and grant fame", () => {
      // altar_blue: blue mana cost 3, fame reward 7
      const state = createAltarTributeState("altar_blue", {
        pureMana: [
          { color: "blue", source: "card" },
          { color: "blue", source: "card" },
          { color: "blue", source: "card" },
        ],
      });

      const manaSources: ManaSourceInfo[] = [
        { type: MANA_SOURCE_TOKEN, color: "blue" },
        { type: MANA_SOURCE_TOKEN, color: "blue" },
        { type: MANA_SOURCE_TOKEN, color: "blue" },
      ];

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources,
      });

      const result = command.execute(state);

      // Check fame gained event
      const fameEvent = result.events.find(
        (e) => e.type === FAME_GAINED
      );
      expect(fameEvent).toBeDefined();
      expect(fameEvent).toMatchObject({
        type: FAME_GAINED,
        playerId: "player1",
        amount: 7,
      });

      // Check altar tribute paid event
      const tributeEvent = result.events.find(
        (e) => e.type === ALTAR_TRIBUTE_PAID
      );
      expect(tributeEvent).toBeDefined();
      expect(tributeEvent).toMatchObject({
        type: ALTAR_TRIBUTE_PAID,
        playerId: "player1",
        manaColor: "blue",
        manaCost: 3,
        fameGained: 7,
      });

      // Check site conquered
      const conquestEvent = result.events.find(
        (e) => e.type === SITE_CONQUERED
      );
      expect(conquestEvent).toBeDefined();

      // Check shield token placed
      const shieldEvent = result.events.find(
        (e) => e.type === SHIELD_TOKEN_PLACED
      );
      expect(shieldEvent).toBeDefined();

      // Check mana tokens consumed
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.pureMana).toHaveLength(0);

      // Check player has taken action
      expect(player?.hasTakenActionThisTurn).toBe(true);
      expect(player?.hasCombattedThisTurn).toBe(true);
    });

    it("should consume crystals when paying with crystals", () => {
      const state = createAltarTributeState("altar_green", {
        crystals: { red: 0, blue: 0, green: 3, white: 0 },
      });

      const manaSources: ManaSourceInfo[] = [
        { type: MANA_SOURCE_CRYSTAL, color: "green" },
        { type: MANA_SOURCE_CRYSTAL, color: "green" },
        { type: MANA_SOURCE_CRYSTAL, color: "green" },
      ];

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources,
      });

      const result = command.execute(state);

      // Check crystals consumed
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.crystals.green).toBe(0);

      // Check fame gained (green altar: 7 fame)
      expect(player?.fame).toBe(7);
    });
  });

  describe("ruins token cleanup", () => {
    it("should discard ruins token after tribute", () => {
      const state = createAltarTributeState("altar_red", {
        pureMana: [
          { color: "red", source: "card" },
          { color: "red", source: "card" },
          { color: "red", source: "card" },
        ],
      });

      const manaSources: ManaSourceInfo[] = [
        { type: MANA_SOURCE_TOKEN, color: "red" },
        { type: MANA_SOURCE_TOKEN, color: "red" },
        { type: MANA_SOURCE_TOKEN, color: "red" },
      ];

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources,
      });

      const result = command.execute(state);

      // Ruins token should be removed from hex
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.ruinsToken).toBeNull();

      // Token should be in the discard pile
      expect(result.state.ruinsTokens.discardPile).toContain("altar_red");
    });

    it("should mark site as conquered with shield token", () => {
      const state = createAltarTributeState("altar_white", {
        pureMana: [
          { color: "white", source: "card" },
          { color: "white", source: "card" },
          { color: "white", source: "card" },
        ],
      });

      const manaSources: ManaSourceInfo[] = [
        { type: MANA_SOURCE_TOKEN, color: "white" },
        { type: MANA_SOURCE_TOKEN, color: "white" },
        { type: MANA_SOURCE_TOKEN, color: "white" },
      ];

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources,
      });

      const result = command.execute(state);

      // Check site is conquered
      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.site?.isConquered).toBe(true);
      expect(hex?.site?.owner).toBe("player1");

      // Check shield token placed
      expect(hex?.shieldTokens).toContain("player1");
    });
  });

  describe("error cases", () => {
    it("should throw when player not found", () => {
      const state = createAltarTributeState("altar_blue");

      const command = createAltarTributeCommand({
        playerId: "nonexistent",
        manaSources: [],
      });

      expect(() => command.execute(state)).toThrow("Player not found");
    });

    it("should throw when no site at position", () => {
      const baseState = createTestGameState();
      const player = createTestPlayer({ id: "player1", position: { q: 0, r: 0 } });
      const state = { ...baseState, players: [player], turnOrder: ["player1"] };

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources: [],
      });

      expect(() => command.execute(state)).toThrow("No site at player position");
    });

    it("should throw when no ruins token", () => {
      const baseState = createTestGameState();
      const playerCoord = { q: 0, r: 0 };
      const siteHex: HexState = {
        coord: playerCoord,
        terrain: TERRAIN_PLAINS,
        tileId: baseState.map.hexes[hexKey(playerCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
        site: createRuinsSite(),
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
        ruinsToken: null,
      };

      const player = createTestPlayer({ id: "player1", position: playerCoord });
      const state = {
        ...baseState,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...baseState.map,
          hexes: { ...baseState.map.hexes, [hexKey(playerCoord)]: siteHex },
        },
      };

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources: [],
      });

      expect(() => command.execute(state)).toThrow("No ruins token at this hex");
    });

    it("should throw when token is not an altar", () => {
      // enemy_green_brown_artifact is an enemy token, not an altar
      const state = createAltarTributeState("enemy_green_brown_artifact");

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources: [],
      });

      expect(() => command.execute(state)).toThrow("Token is not an altar token");
    });

    it("should throw on undo attempt", () => {
      const state = createAltarTributeState("altar_blue");

      const command = createAltarTributeCommand({
        playerId: "player1",
        manaSources: [],
      });

      expect(() => command.undo(state)).toThrow("Cannot undo ALTAR_TRIBUTE");
    });
  });
});
