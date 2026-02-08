/**
 * Ruins validation and valid actions tests
 *
 * Tests for:
 * - validateAtRuinsWithAltar: must be at ruins with revealed altar token
 * - validateSiteHasEnemiesOrDraws: ENTER_SITE requires enemy token at ruins
 * - getSiteOptions: altar info shown for altar tokens, canEnter for enemy tokens
 * - moveCommand: reveals face-down ruins tokens on entry
 */

import { describe, it, expect } from "vitest";
import {
  validateAtRuinsWithAltar,
  validateSiteHasEnemiesOrDraws,
} from "../validators/siteValidators.js";
import { getSiteOptions } from "../validActions/sites.js";
import { createMoveCommand } from "../commands/moveCommand.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  hexKey,
  TERRAIN_PLAINS,
  ENTER_SITE_ACTION,
  ALTAR_TRIBUTE_ACTION,
  RUINS_TOKEN_REVEALED,
  type RuinsTokenId,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState, RuinsToken } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import {
  NO_SITE,
  NOT_AT_RUINS,
  NO_ALTAR_TOKEN,
  SITE_ALREADY_CONQUERED,
  NO_ENEMIES_AT_SITE,
  NOT_ENEMY_TOKEN,
} from "../validators/validationCodes.js";

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

function createStateWithRuins(
  tokenId: string | null,
  options: {
    isConquered?: boolean;
    isRevealed?: boolean;
    playerOverrides?: Partial<Parameters<typeof createTestPlayer>[0]>;
    siteType?: SiteType;
  } = {}
): GameState {
  const baseState = createTestGameState();
  const playerCoord = { q: 0, r: 0 };

  const siteType = options.siteType ?? SiteType.AncientRuins;
  const site: Site = {
    type: siteType,
    owner: options.isConquered ? "player1" : null,
    isConquered: options.isConquered ?? false,
    isBurned: false,
  };

  const ruinsToken = tokenId
    ? createRuinsToken(tokenId, options.isRevealed ?? true)
    : null;

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
    ...options.playerOverrides,
  });

  return {
    ...baseState,
    players: [player],
    turnOrder: ["player1"],
    map: { ...baseState.map, hexes },
  };
}

// =============================================================================
// TESTS: validateAtRuinsWithAltar
// =============================================================================

describe("validateAtRuinsWithAltar", () => {
  it("should pass for non-ALTAR_TRIBUTE actions", () => {
    const state = createStateWithRuins("altar_blue");
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ENTER_SITE_ACTION,
    });
    expect(result.valid).toBe(true);
  });

  it("should pass when at ruins with revealed altar token", () => {
    const state = createStateWithRuins("altar_blue");
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(true);
  });

  it("should fail when not at a site", () => {
    const baseState = createTestGameState();
    const player = createTestPlayer({ id: "player1", position: { q: 0, r: 0 } });
    const state = { ...baseState, players: [player], turnOrder: ["player1"] };

    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NO_SITE);
    }
  });

  it("should fail when not at Ancient Ruins", () => {
    const state = createStateWithRuins("altar_blue", { siteType: SiteType.Village });
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NOT_AT_RUINS);
    }
  });

  it("should fail when site already conquered", () => {
    const state = createStateWithRuins("altar_blue", { isConquered: true });
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(SITE_ALREADY_CONQUERED);
    }
  });

  it("should fail when no ruins token", () => {
    const state = createStateWithRuins(null);
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NO_ALTAR_TOKEN);
    }
  });

  it("should fail when ruins token not revealed", () => {
    const state = createStateWithRuins("altar_blue", { isRevealed: false });
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NO_ALTAR_TOKEN);
    }
  });

  it("should fail when token is enemy token (not altar)", () => {
    const state = createStateWithRuins("enemy_green_brown_artifact");
    const result = validateAtRuinsWithAltar(state, "player1", {
      type: ALTAR_TRIBUTE_ACTION,
      manaSources: [],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NO_ALTAR_TOKEN);
    }
  });
});

// =============================================================================
// TESTS: validateSiteHasEnemiesOrDraws for ruins
// =============================================================================

describe("validateSiteHasEnemiesOrDraws for ruins", () => {
  it("should pass when ruins has enemy token", () => {
    const state = createStateWithRuins("enemy_green_brown_artifact");
    const result = validateSiteHasEnemiesOrDraws(state, "player1", {
      type: ENTER_SITE_ACTION,
    });
    expect(result.valid).toBe(true);
  });

  it("should fail when ruins has no token", () => {
    const state = createStateWithRuins(null);
    const result = validateSiteHasEnemiesOrDraws(state, "player1", {
      type: ENTER_SITE_ACTION,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NO_ENEMIES_AT_SITE);
    }
  });

  it("should fail when ruins has altar token (must use ALTAR_TRIBUTE instead)", () => {
    const state = createStateWithRuins("altar_blue");
    const result = validateSiteHasEnemiesOrDraws(state, "player1", {
      type: ENTER_SITE_ACTION,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe(NOT_ENEMY_TOKEN);
    }
  });
});

// =============================================================================
// TESTS: getSiteOptions for ruins
// =============================================================================

describe("getSiteOptions for ruins", () => {
  it("should show canEnter for ruins with enemy token", () => {
    const state = createStateWithRuins("enemy_green_brown_artifact");
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options).toBeDefined();
    expect(options?.canEnter).toBe(true);
    expect(options?.enterDescription).toContain("Fight");
    expect(options?.enterDescription).toContain("Green");
    expect(options?.enterDescription).toContain("Brown");
  });

  it("should show canTribute for ruins with altar token", () => {
    const state = createStateWithRuins("altar_blue");
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options).toBeDefined();
    // canEnter should be false for altar tokens
    expect(options?.canEnter).toBe(false);
    // Altar tribute info should be present
    expect((options as Record<string, unknown>).canTribute).toBe(true);
    expect((options as Record<string, unknown>).altarManaColor).toBe("blue");
    expect((options as Record<string, unknown>).altarManaCost).toBe(3);
    expect((options as Record<string, unknown>).altarFameReward).toBe(7);
  });

  it("should not show canTribute when site already conquered", () => {
    const state = createStateWithRuins("altar_blue", { isConquered: true });
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options).toBeDefined();
    expect((options as Record<string, unknown>).canTribute).toBeUndefined();
  });

  it("should not show canTribute when player has already acted", () => {
    const state = createStateWithRuins("altar_blue", {
      playerOverrides: { hasTakenActionThisTurn: true },
    });
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options).toBeDefined();
    expect((options as Record<string, unknown>).canTribute).toBeUndefined();
  });

  it("should show token-specific conquest reward for enemy tokens", () => {
    const state = createStateWithRuins("enemy_green_brown_artifact");
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options?.conquestReward).toContain("Artifact");
  });

  it("should show fame reward for altar tokens", () => {
    const state = createStateWithRuins("altar_blue");
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options?.conquestReward).toContain("7 Fame");
  });

  it("should show compound rewards for tokens with multiple rewards", () => {
    // enemy_green_red_artifact_unit: rewards: artifact + advanced_action
    const state = createStateWithRuins("enemy_green_red_artifact_unit");
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    expect(options?.conquestReward).toContain("Artifact");
    expect(options?.conquestReward).toContain("Advanced Action");
  });

  it("should show unrevealed token fallback message", () => {
    const state = createStateWithRuins("altar_blue", { isRevealed: false });
    const player = state.players[0]!;

    const options = getSiteOptions(state, player);
    // With unrevealed token, should show generic message
    expect(options?.conquestReward).toBe("Depends on token");
  });
});

// =============================================================================
// TESTS: moveCommand ruins token reveal
// =============================================================================

describe("moveCommand ruins token reveal", () => {
  it("should reveal face-down ruins token when moving to hex", () => {
    const baseState = createTestGameState();
    const fromCoord = { q: 1, r: 0 };
    const toCoord = { q: 0, r: 0 };

    // Create destination hex with unrevealed ruins token
    const ruinsToken = createRuinsToken("altar_green", false);
    const destinationHex: HexState = {
      coord: toCoord,
      terrain: TERRAIN_PLAINS,
      tileId: baseState.map.hexes[hexKey(toCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
      site: createRuinsSite(),
      enemies: [],
      shieldTokens: [],
      rampagingEnemies: [],
      ruinsToken,
    };

    const hexes: Record<string, HexState> = {
      ...baseState.map.hexes,
      [hexKey(toCoord)]: destinationHex,
    };

    const player = createTestPlayer({
      id: "player1",
      position: fromCoord,
      movePoints: 4,
    });

    const state: GameState = {
      ...baseState,
      players: [player],
      turnOrder: ["player1"],
      map: { ...baseState.map, hexes },
    };

    const command = createMoveCommand({
      playerId: "player1",
      from: fromCoord,
      to: toCoord,
      terrainCost: 2,
      hadMovedThisTurn: false,
    });

    const result = command.execute(state);

    // Token should now be revealed on the hex
    const updatedHex = result.state.map.hexes[hexKey(toCoord)];
    expect(updatedHex?.ruinsToken?.isRevealed).toBe(true);

    // Should emit RUINS_TOKEN_REVEALED event
    const revealEvent = result.events.find(
      (e) => e.type === RUINS_TOKEN_REVEALED
    );
    expect(revealEvent).toBeDefined();
    if (revealEvent && "tokenId" in revealEvent) {
      expect(revealEvent.tokenId).toBe("altar_green");
    }
  });

  it("should not emit reveal event for already-revealed token", () => {
    const baseState = createTestGameState();
    const fromCoord = { q: 1, r: 0 };
    const toCoord = { q: 0, r: 0 };

    // Create destination hex with already-revealed ruins token
    const ruinsToken = createRuinsToken("altar_green", true);
    const destinationHex: HexState = {
      coord: toCoord,
      terrain: TERRAIN_PLAINS,
      tileId: baseState.map.hexes[hexKey(toCoord)]?.tileId ?? ("StartingTileA" as import("../../types/map.js").TileId),
      site: createRuinsSite(),
      enemies: [],
      shieldTokens: [],
      rampagingEnemies: [],
      ruinsToken,
    };

    const hexes: Record<string, HexState> = {
      ...baseState.map.hexes,
      [hexKey(toCoord)]: destinationHex,
    };

    const player = createTestPlayer({
      id: "player1",
      position: fromCoord,
      movePoints: 4,
    });

    const state: GameState = {
      ...baseState,
      players: [player],
      turnOrder: ["player1"],
      map: { ...baseState.map, hexes },
    };

    const command = createMoveCommand({
      playerId: "player1",
      from: fromCoord,
      to: toCoord,
      terrainCost: 2,
      hadMovedThisTurn: false,
    });

    const result = command.execute(state);

    // Should NOT emit RUINS_TOKEN_REVEALED event (already revealed)
    const revealEvent = result.events.find(
      (e) => e.type === RUINS_TOKEN_REVEALED
    );
    expect(revealEvent).toBeUndefined();
  });
});
