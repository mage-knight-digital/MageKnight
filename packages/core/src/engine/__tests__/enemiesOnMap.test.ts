/**
 * Tests for Enemies on Map feature
 *
 * Tests:
 * - Enemy deck setup and shuffling
 * - Drawing enemies from decks
 * - Enemy placement on tile reveal (rampaging + site defenders)
 * - Movement validation for rampaging hexes
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createEnemyTokenPiles,
  drawEnemy,
  discardEnemy,
  getEnemyIdFromToken,
  getSiteDefenders,
  getAdventureSiteEnemies,
  getRampagingEnemyColor,
  drawEnemiesForHex,
  resetTokenCounter,
} from "../helpers/enemyHelpers.js";
import { createRng } from "../../utils/rng.js";
import {
  ENEMY_COLOR_GREEN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_VIOLET,
  ENEMY_COLOR_RED,
  ENEMY_COLOR_WHITE,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { SiteType, RampagingEnemyType } from "../../types/map.js";
import { validateNotBlockedByRampaging } from "../validators/movementValidators.js";
import { createTestGameState, createTestHex } from "./testHelpers.js";
import { hexKey, MOVE_ACTION, TERRAIN_PLAINS } from "@mage-knight/shared";
import type { EnemyTokenId } from "../../types/enemy.js";

describe("Enemies on Map", () => {
  beforeEach(() => {
    resetTokenCounter();
  });

  describe("Enemy deck setup", () => {
    it("should create shuffled enemy decks by color", () => {
      const rng = createRng(42);
      const { piles } = createEnemyTokenPiles(rng);

      // Verify all 6 color decks exist
      expect(piles.drawPiles[ENEMY_COLOR_GREEN].length).toBeGreaterThan(0);
      expect(piles.drawPiles[ENEMY_COLOR_GRAY].length).toBeGreaterThan(0);
      expect(piles.drawPiles[ENEMY_COLOR_BROWN].length).toBeGreaterThan(0);
      expect(piles.drawPiles[ENEMY_COLOR_VIOLET].length).toBeGreaterThan(0);
      expect(piles.drawPiles[ENEMY_COLOR_RED].length).toBeGreaterThan(0);
      expect(piles.drawPiles[ENEMY_COLOR_WHITE].length).toBeGreaterThan(0);

      // Verify discard piles are empty
      expect(piles.discardPiles[ENEMY_COLOR_GREEN]).toHaveLength(0);
      expect(piles.discardPiles[ENEMY_COLOR_GRAY]).toHaveLength(0);
      expect(piles.discardPiles[ENEMY_COLOR_BROWN]).toHaveLength(0);
      expect(piles.discardPiles[ENEMY_COLOR_VIOLET]).toHaveLength(0);
      expect(piles.discardPiles[ENEMY_COLOR_RED]).toHaveLength(0);
      expect(piles.discardPiles[ENEMY_COLOR_WHITE]).toHaveLength(0);
    });

    it("should create deterministic decks with same seed", () => {
      const rng1 = createRng(42);
      const rng2 = createRng(42);

      resetTokenCounter();
      const { piles: piles1 } = createEnemyTokenPiles(rng1);
      resetTokenCounter();
      const { piles: piles2 } = createEnemyTokenPiles(rng2);

      // Same seed should produce same order
      expect(piles1.drawPiles[ENEMY_COLOR_GREEN]).toEqual(
        piles2.drawPiles[ENEMY_COLOR_GREEN]
      );
    });

    it("should create different decks with different seeds", () => {
      const rng1 = createRng(42);
      const rng2 = createRng(999);

      resetTokenCounter();
      const { piles: piles1 } = createEnemyTokenPiles(rng1);
      resetTokenCounter();
      const { piles: piles2 } = createEnemyTokenPiles(rng2);

      // Different seeds should (very likely) produce different order
      // Compare green deck as a representative sample
      const deck1 = piles1.drawPiles[ENEMY_COLOR_GREEN];
      const deck2 = piles2.drawPiles[ENEMY_COLOR_GREEN];

      // At least one token should be in a different position
      const hasAnyDifference = deck1.some(
        (token, i) => token !== deck2[i]
      );
      expect(hasAnyDifference).toBe(true);
    });
  });

  describe("Draw enemy", () => {
    it("should draw enemy from correct deck", () => {
      const rng = createRng(42);
      const { piles } = createEnemyTokenPiles(rng);

      const initialGreenCount = piles.drawPiles[ENEMY_COLOR_GREEN].length;

      const result = drawEnemy(piles, ENEMY_COLOR_GREEN, rng);

      expect(result.tokenId).not.toBeNull();
      expect(result.piles.drawPiles[ENEMY_COLOR_GREEN]).toHaveLength(
        initialGreenCount - 1
      );
    });

    it("should verify enemy removed from deck", () => {
      const rng = createRng(42);
      const { piles } = createEnemyTokenPiles(rng);

      const topToken = piles.drawPiles[ENEMY_COLOR_GREEN][0];
      const result = drawEnemy(piles, ENEMY_COLOR_GREEN, rng);

      expect(result.tokenId).toBe(topToken);
      expect(result.piles.drawPiles[ENEMY_COLOR_GREEN]).not.toContain(topToken);
    });

    it("should reshuffle discard when draw pile is empty", () => {
      let rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);
      rng = rng2;

      // Empty the green deck
      let currentPiles = piles;
      const drawnTokens: EnemyTokenId[] = [];
      while (currentPiles.drawPiles[ENEMY_COLOR_GREEN].length > 0) {
        const result = drawEnemy(currentPiles, ENEMY_COLOR_GREEN, rng);
        if (result.tokenId) {
          drawnTokens.push(result.tokenId);
        }
        currentPiles = result.piles;
        rng = result.rng;
      }

      // Put all tokens in discard
      for (const token of drawnTokens) {
        currentPiles = discardEnemy(currentPiles, token);
      }

      expect(currentPiles.drawPiles[ENEMY_COLOR_GREEN]).toHaveLength(0);
      expect(currentPiles.discardPiles[ENEMY_COLOR_GREEN]).toHaveLength(
        drawnTokens.length
      );

      // Now draw - should reshuffle
      const result = drawEnemy(currentPiles, ENEMY_COLOR_GREEN, rng);
      expect(result.tokenId).not.toBeNull();
      expect(result.piles.discardPiles[ENEMY_COLOR_GREEN]).toHaveLength(0);
    });

    it("should return null if both draw and discard are empty", () => {
      const rng = createRng(42);
      const { piles } = createEnemyTokenPiles(rng);

      // Manually empty the green deck
      const emptyPiles = {
        ...piles,
        drawPiles: {
          ...piles.drawPiles,
          [ENEMY_COLOR_GREEN]: [],
        },
        discardPiles: {
          ...piles.discardPiles,
          [ENEMY_COLOR_GREEN]: [],
        },
      };

      const result = drawEnemy(emptyPiles, ENEMY_COLOR_GREEN, rng);
      expect(result.tokenId).toBeNull();
    });
  });

  describe("Get enemy ID from token", () => {
    it("should extract enemy ID from token ID", () => {
      const tokenId = "diggers_1" as EnemyTokenId;
      expect(getEnemyIdFromToken(tokenId)).toBe("diggers");
    });

    it("should handle enemy IDs with underscores", () => {
      const tokenId = "cursed_hags_5" as EnemyTokenId;
      expect(getEnemyIdFromToken(tokenId)).toBe("cursed_hags");
    });
  });

  describe("Site defender mapping", () => {
    it("should return gray defender for Keep", () => {
      const config = getSiteDefenders(SiteType.Keep);
      expect(config).toEqual({ color: ENEMY_COLOR_GRAY, count: 1 });
    });

    it("should return violet defender for Mage Tower", () => {
      const config = getSiteDefenders(SiteType.MageTower);
      expect(config).toEqual({ color: ENEMY_COLOR_VIOLET, count: 1 });
    });

    // Monster Den and Spawning Grounds: enemies drawn on EXPLORE, not at tile reveal
    it("should return null for Spawning Grounds at tile reveal (enemies drawn on explore)", () => {
      const config = getSiteDefenders(SiteType.SpawningGrounds);
      expect(config).toBeNull();
    });

    it("should return null for Monster Den at tile reveal (enemies drawn on explore)", () => {
      const config = getSiteDefenders(SiteType.MonsterDen);
      expect(config).toBeNull();
    });

    it("should return null for Village (no defenders)", () => {
      const config = getSiteDefenders(SiteType.Village);
      expect(config).toBeNull();
    });

    it("should return null for Monastery (no defenders)", () => {
      const config = getSiteDefenders(SiteType.Monastery);
      expect(config).toBeNull();
    });

    // Dungeon/Tomb: enemies drawn on EXPLORE, not at tile reveal
    it("should return null for Dungeon at tile reveal (enemies drawn on explore)", () => {
      const config = getSiteDefenders(SiteType.Dungeon);
      expect(config).toBeNull();
    });

    it("should return null for Tomb at tile reveal (enemies drawn on explore)", () => {
      const config = getSiteDefenders(SiteType.Tomb);
      expect(config).toBeNull();
    });

    // Ancient Ruins: uses yellow ruins tokens (not enemy tokens)
    // Ruins tokens are handled separately via ruinsTokenHelpers
    it("should return null for Ancient Ruins (uses ruins tokens instead)", () => {
      // Day
      expect(getSiteDefenders(SiteType.AncientRuins, TIME_OF_DAY_DAY)).toBeNull();
      // Night
      expect(getSiteDefenders(SiteType.AncientRuins, TIME_OF_DAY_NIGHT)).toBeNull();
    });
  });

  describe("Adventure site enemies (drawn on explore)", () => {
    it("should return 1 brown enemy for Dungeon", () => {
      // Per rules: "reveal a brown enemy token and fight it"
      const config = getAdventureSiteEnemies(SiteType.Dungeon);
      expect(config).toEqual({ color: ENEMY_COLOR_BROWN, count: 1 });
    });

    it("should return 1 red enemy for Tomb", () => {
      // Per rules: "draw a red Draconum enemy token to fight"
      const config = getAdventureSiteEnemies(SiteType.Tomb);
      expect(config).toEqual({ color: ENEMY_COLOR_RED, count: 1 });
    });

    it("should return 1 brown enemy for Monster Den", () => {
      // Per rules: "draw a brown enemy token to fight"
      const config = getAdventureSiteEnemies(SiteType.MonsterDen);
      expect(config).toEqual({ color: ENEMY_COLOR_BROWN, count: 1 });
    });

    it("should return 2 brown enemies for Spawning Grounds", () => {
      // Per rules: "draw two brown enemy tokens and fight them"
      const config = getAdventureSiteEnemies(SiteType.SpawningGrounds);
      expect(config).toEqual({ color: ENEMY_COLOR_BROWN, count: 2 });
    });

    it("should return null for Keep (defenders drawn at reveal)", () => {
      const config = getAdventureSiteEnemies(SiteType.Keep);
      expect(config).toBeNull();
    });

    it("should return null for Village (no enemies)", () => {
      const config = getAdventureSiteEnemies(SiteType.Village);
      expect(config).toBeNull();
    });
  });

  describe("Rampaging enemy mapping", () => {
    it("should return green for Orc Marauder", () => {
      expect(getRampagingEnemyColor(RampagingEnemyType.OrcMarauder)).toBe(
        ENEMY_COLOR_GREEN
      );
    });

    it("should return red for Draconum", () => {
      expect(getRampagingEnemyColor(RampagingEnemyType.Draconum)).toBe(
        ENEMY_COLOR_RED
      );
    });
  });

  describe("Enemy placement on tile reveal", () => {
    it("should place rampaging enemies on hex", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      const result = drawEnemiesForHex(
        [RampagingEnemyType.OrcMarauder],
        null, // no site
        piles,
        rng2
      );

      expect(result.enemies).toHaveLength(1);
      // Should have drawn from green deck
      expect(result.piles.drawPiles[ENEMY_COLOR_GREEN].length).toBe(
        piles.drawPiles[ENEMY_COLOR_GREEN].length - 1
      );
    });

    it("should place defenders at keep", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      const result = drawEnemiesForHex(
        [], // no rampaging
        SiteType.Keep,
        piles,
        rng2
      );

      expect(result.enemies).toHaveLength(1);
      // Should have drawn from gray deck
      expect(result.piles.drawPiles[ENEMY_COLOR_GRAY].length).toBe(
        piles.drawPiles[ENEMY_COLOR_GRAY].length - 1
      );
    });

    it("should NOT place enemies at dungeon on tile reveal", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      // Dungeon enemies are drawn when player explores, not at tile reveal
      const result = drawEnemiesForHex(
        [], // no rampaging
        SiteType.Dungeon,
        piles,
        rng2
      );

      expect(result.enemies).toHaveLength(0);
      // Brown deck should be unchanged
      expect(result.piles.drawPiles[ENEMY_COLOR_BROWN].length).toBe(
        piles.drawPiles[ENEMY_COLOR_BROWN].length
      );
    });

    it("should NOT place enemies at tomb on tile reveal", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      // Tomb enemies are drawn when player explores, not at tile reveal
      const result = drawEnemiesForHex(
        [], // no rampaging
        SiteType.Tomb,
        piles,
        rng2
      );

      expect(result.enemies).toHaveLength(0);
      // Red deck should be unchanged
      expect(result.piles.drawPiles[ENEMY_COLOR_RED].length).toBe(
        piles.drawPiles[ENEMY_COLOR_RED].length
      );
    });

    it("should NOT place enemies at ancient ruins during day", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      const result = drawEnemiesForHex(
        [], // no rampaging
        SiteType.AncientRuins,
        piles,
        rng2,
        TIME_OF_DAY_DAY
      );

      expect(result.enemies).toHaveLength(0);
      // Brown deck should be unchanged
      expect(result.piles.drawPiles[ENEMY_COLOR_BROWN].length).toBe(
        piles.drawPiles[ENEMY_COLOR_BROWN].length
      );
    });

    it("should place no enemies at ancient ruins (uses ruins tokens instead)", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      // Ancient Ruins no longer use enemy tokens - they use yellow ruins tokens
      // which are handled separately via ruinsTokenHelpers
      const resultDay = drawEnemiesForHex(
        [], // no rampaging
        SiteType.AncientRuins,
        piles,
        rng2,
        TIME_OF_DAY_DAY
      );
      expect(resultDay.enemies).toHaveLength(0);

      const resultNight = drawEnemiesForHex(
        [], // no rampaging
        SiteType.AncientRuins,
        piles,
        resultDay.rng,
        TIME_OF_DAY_NIGHT
      );
      expect(resultNight.enemies).toHaveLength(0);
    });

    it("should place both rampaging and site defenders", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      // Orc marauder + Keep (this combo is unlikely but tests the logic)
      const result = drawEnemiesForHex(
        [RampagingEnemyType.OrcMarauder],
        SiteType.Keep,
        piles,
        rng2
      );

      // 1 green (orc) + 1 gray (keep defender)
      expect(result.enemies).toHaveLength(2);
    });

    it("should place no enemies for safe sites", () => {
      const rng = createRng(42);
      const { piles, rng: rng2 } = createEnemyTokenPiles(rng);

      const result = drawEnemiesForHex(
        [], // no rampaging
        SiteType.Village,
        piles,
        rng2
      );

      expect(result.enemies).toHaveLength(0);
    });
  });

  describe("Combat triggers - movement validation", () => {
    it("should block movement into rampaging hex", () => {
      const state = createTestGameState();
      const targetHex = createTestHex(1, 0, TERRAIN_PLAINS);

      // Add rampaging enemies to target hex
      const hexWithEnemies = {
        ...targetHex,
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: ["orc_1" as EnemyTokenId], // Has actual enemy
      };

      const stateWithEnemies = {
        ...state,
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: hexWithEnemies,
          },
        },
      };

      const action = {
        type: MOVE_ACTION as const,
        target: { q: 1, r: 0 },
      };

      const result = validateNotBlockedByRampaging(
        stateWithEnemies,
        "player1",
        action
      );

      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.error.code).toBe("RAMPAGING_ENEMY_BLOCKS");
      }
    });

    it("should allow movement into hex where rampaging enemies are defeated", () => {
      const state = createTestGameState();
      const targetHex = createTestHex(1, 0, TERRAIN_PLAINS);

      // Hex had rampaging enemies but they were defeated (enemies array empty)
      const hexWithDefeatedEnemies = {
        ...targetHex,
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [] as EnemyTokenId[], // Enemies defeated
      };

      const stateWithDefeatedEnemies = {
        ...state,
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: hexWithDefeatedEnemies,
          },
        },
      };

      const action = {
        type: MOVE_ACTION as const,
        target: { q: 1, r: 0 },
      };

      const result = validateNotBlockedByRampaging(
        stateWithDefeatedEnemies,
        "player1",
        action
      );

      expect(result.valid).toBe(true);
    });

    it("should allow movement into hex with site defenders (non-rampaging)", () => {
      const state = createTestGameState();
      const targetHex = createTestHex(1, 0, TERRAIN_PLAINS, {
        type: SiteType.Keep,
        owner: null,
        isConquered: false,
        isBurned: false,
      });

      // Site defenders are not rampaging, movement is allowed
      // (combat triggers when you assault, but movement is allowed)
      const hexWithDefenders = {
        ...targetHex,
        rampagingEnemies: [] as RampagingEnemyType[], // Not rampaging
        enemies: ["swordsmen_1" as EnemyTokenId],
      };

      const stateWithDefenders = {
        ...state,
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: hexWithDefenders,
          },
        },
      };

      const action = {
        type: MOVE_ACTION as const,
        target: { q: 1, r: 0 },
      };

      const result = validateNotBlockedByRampaging(
        stateWithDefenders,
        "player1",
        action
      );

      expect(result.valid).toBe(true);
    });
  });
});
