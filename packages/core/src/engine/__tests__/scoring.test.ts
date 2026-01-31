/**
 * Tests for the Standard Achievements Scoring System
 *
 * Tests all 6 achievement categories:
 * - Greatest Knowledge: +2 per Spell, +1 per Advanced Action
 * - Greatest Loot: +2 per Artifact, +1 per 2 crystals
 * - Greatest Leader: +1 per unit level (wounded = half, floor)
 * - Greatest Conqueror: +2 per shield on keep/mage tower/monastery
 * - Greatest Adventurer: +2 per shield on adventure site
 * - Greatest Beating: -2 per wound in deck
 *
 * Also tests title bonuses and tie handling.
 */

import { describe, it, expect } from "vitest";
import {
  calculateGreatestKnowledge,
  calculateGreatestLoot,
  calculateGreatestLeader,
  calculateGreatestConqueror,
  calculateGreatestAdventurer,
  calculateGreatestBeating,
} from "../scoring/achievementCalculators.js";
import {
  calculateAchievementResults,
  calculateFinalScores,
  createDefaultScoringConfig,
} from "../scoring/standardAchievements.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { SiteType } from "../../types/map.js";
import {
  CARD_WOUND,
  hexKey,
  UNIT_PEASANTS,
  UNIT_FIRE_MAGES,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_SHIELD_BASH,
  CARD_ICE_SHIELD,
  CARD_ENDLESS_BAG_OF_GOLD,
  ACHIEVEMENT_GREATEST_KNOWLEDGE,
  ACHIEVEMENT_GREATEST_BEATING,
  ACHIEVEMENT_MODE_COMPETITIVE,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";

describe("Achievement Score Calculators", () => {
  describe("calculateGreatestKnowledge", () => {
    it("returns 0 for player with no spells or advanced actions", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        discard: [],
      });

      expect(calculateGreatestKnowledge(player)).toBe(0);
    });

    it("calculates +2 per spell", () => {
      const player = createTestPlayer({
        hand: [CARD_FIREBALL],
        deck: [CARD_SNOWSTORM],
        discard: [],
      });

      // 2 spells * 2 points = 4
      expect(calculateGreatestKnowledge(player)).toBe(4);
    });

    it("calculates +1 per advanced action", () => {
      const player = createTestPlayer({
        hand: [CARD_SHIELD_BASH],
        deck: [],
        discard: [CARD_ICE_SHIELD],
      });

      // 2 advanced actions * 1 point = 2
      expect(calculateGreatestKnowledge(player)).toBe(2);
    });

    it("calculates combined score for spells and advanced actions", () => {
      const player = createTestPlayer({
        hand: [CARD_FIREBALL, CARD_SHIELD_BASH],
        deck: [CARD_SNOWSTORM],
        discard: [CARD_ICE_SHIELD],
      });

      // 2 spells * 2 = 4, 2 AAs * 1 = 2, total = 6
      expect(calculateGreatestKnowledge(player)).toBe(6);
    });
  });

  describe("calculateGreatestLoot", () => {
    it("returns 0 for player with no artifacts or crystals", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        discard: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      expect(calculateGreatestLoot(player)).toBe(0);
    });

    it("calculates +2 per artifact", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_BAG_OF_GOLD],
        deck: [],
        discard: [],
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      // 1 artifact * 2 points = 2
      expect(calculateGreatestLoot(player)).toBe(2);
    });

    it("calculates +1 per 2 crystals (floor)", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        discard: [],
        crystals: { red: 2, blue: 1, green: 2, white: 0 },
      });

      // 5 crystals / 2 = 2 (floor)
      expect(calculateGreatestLoot(player)).toBe(2);
    });

    it("calculates combined score for artifacts and crystals", () => {
      const player = createTestPlayer({
        hand: [CARD_ENDLESS_BAG_OF_GOLD],
        deck: [],
        discard: [],
        crystals: { red: 3, blue: 3, green: 0, white: 0 },
      });

      // 1 artifact * 2 = 2, 6 crystals / 2 = 3, total = 5
      expect(calculateGreatestLoot(player)).toBe(5);
    });
  });

  describe("calculateGreatestLeader", () => {
    it("returns 0 for player with no units", () => {
      const player = createTestPlayer({
        units: [],
      });

      expect(calculateGreatestLeader(player)).toBe(0);
    });

    it("calculates +1 per unit level for healthy units", () => {
      const player = createTestPlayer({
        units: [
          { instanceId: "u1", unitId: UNIT_PEASANTS, state: "ready", wounded: false, usedResistanceThisCombat: false },
          { instanceId: "u2", unitId: UNIT_FIRE_MAGES, state: "ready", wounded: false, usedResistanceThisCombat: false },
        ],
      });

      // Peasants (level 1) + Fire Mages (level 3) = 4
      expect(calculateGreatestLeader(player)).toBe(4);
    });

    it("calculates half level (floor) for wounded units", () => {
      const player = createTestPlayer({
        units: [
          { instanceId: "u1", unitId: UNIT_PEASANTS, state: "ready", wounded: true, usedResistanceThisCombat: false },
          { instanceId: "u2", unitId: UNIT_FIRE_MAGES, state: "ready", wounded: true, usedResistanceThisCombat: false },
        ],
      });

      // Wounded Peasants (level 1): floor(1/2) = 0
      // Wounded Fire Mages (level 3): floor(3/2) = 1
      // Total = 1
      expect(calculateGreatestLeader(player)).toBe(1);
    });

    it("calculates mixed healthy and wounded units", () => {
      const player = createTestPlayer({
        units: [
          { instanceId: "u1", unitId: UNIT_PEASANTS, state: "ready", wounded: false, usedResistanceThisCombat: false },
          { instanceId: "u2", unitId: UNIT_FIRE_MAGES, state: "ready", wounded: true, usedResistanceThisCombat: false },
        ],
      });

      // Healthy Peasants: 1
      // Wounded Fire Mages: floor(3/2) = 1
      // Total = 2
      expect(calculateGreatestLeader(player)).toBe(2);
    });
  });

  describe("calculateGreatestConqueror", () => {
    it("returns 0 for player with no conquered sites", () => {
      const state = createTestGameState();
      const player = state.players[0];
      if (!player) throw new Error("Test setup error: no player");

      expect(calculateGreatestConqueror(player, state)).toBe(0);
    });

    it("calculates +2 per shield on keep", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.Keep, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestConqueror(player, state)).toBe(2);
    });

    it("calculates +2 per shield on mage tower", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.MageTower, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestConqueror(player, state)).toBe(2);
    });

    it("calculates +2 per shield on monastery", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.Monastery, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestConqueror(player, state)).toBe(2);
    });
  });

  describe("calculateGreatestAdventurer", () => {
    it("returns 0 for player with no conquered adventure sites", () => {
      const state = createTestGameState();
      const player = state.players[0];
      if (!player) throw new Error("Test setup error: no player");

      expect(calculateGreatestAdventurer(player, state)).toBe(0);
    });

    it("calculates +2 per shield on dungeon", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.Dungeon, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestAdventurer(player, state)).toBe(2);
    });

    it("calculates +2 per shield on tomb", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.Tomb, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestAdventurer(player, state)).toBe(2);
    });

    it("calculates +2 per shield on monster den", () => {
      const player = createTestPlayer({ id: "player1" });
      const state = createTestGameState({
        players: [player],
        map: {
          ...createTestGameState().map,
          hexes: {
            [hexKey({ q: 0, r: 0 })]: {
              coord: { q: 0, r: 0 },
              terrain: TERRAIN_PLAINS,
              tileId: "starting_a" as const,
              site: { type: SiteType.MonsterDen, owner: "player1", isConquered: true, isBurned: false },
              enemies: [],
              shieldTokens: ["player1"],
              rampagingEnemies: [],
              ruinsToken: null,
            },
          },
        },
      });

      expect(calculateGreatestAdventurer(player, state)).toBe(2);
    });
  });

  describe("calculateGreatestBeating", () => {
    it("returns 0 for player with no wounds", () => {
      const player = createTestPlayer({
        hand: [],
        deck: [],
        discard: [],
      });

      expect(calculateGreatestBeating(player)).toBe(0);
    });

    it("calculates -2 per wound in deck", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        deck: [CARD_WOUND, CARD_WOUND],
        discard: [],
      });

      // 3 wounds * -2 = -6
      expect(calculateGreatestBeating(player)).toBe(-6);
    });

    it("counts wounds in all deck locations", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        deck: [CARD_WOUND],
        discard: [CARD_WOUND],
      });

      // 3 wounds * -2 = -6
      expect(calculateGreatestBeating(player)).toBe(-6);
    });
  });
});

describe("Achievement Title Bonuses", () => {
  describe("Competitive multiplayer", () => {
    it("awards +3 to sole winner", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [CARD_FIREBALL, CARD_SNOWSTORM], // 4 points
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [CARD_FIREBALL], // 2 points
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const config = {
        enabled: true,
        mode: ACHIEVEMENT_MODE_COMPETITIVE as const,
      };

      const results = calculateAchievementResults([player1, player2], state, config);
      const p1Result = results.get("player1");
      const p2Result = results.get("player2");

      // Player 1 should have Greatest Knowledge title with +3 bonus
      const p1Knowledge = p1Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_KNOWLEDGE
      );
      expect(p1Knowledge?.basePoints).toBe(4);
      expect(p1Knowledge?.titleBonus).toBe(3);
      expect(p1Knowledge?.hasTitle).toBe(true);
      expect(p1Knowledge?.isTied).toBe(false);

      // Player 2 should not have the title
      const p2Knowledge = p2Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_KNOWLEDGE
      );
      expect(p2Knowledge?.basePoints).toBe(2);
      expect(p2Knowledge?.titleBonus).toBe(0);
      expect(p2Knowledge?.hasTitle).toBe(false);
    });

    it("awards +1 to each tied player", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [CARD_FIREBALL], // 2 points
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [CARD_SNOWSTORM], // 2 points
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const config = {
        enabled: true,
        mode: ACHIEVEMENT_MODE_COMPETITIVE as const,
      };

      const results = calculateAchievementResults([player1, player2], state, config);
      const p1Result = results.get("player1");
      const p2Result = results.get("player2");

      // Both should have +1 for tie
      const p1Knowledge = p1Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_KNOWLEDGE
      );
      expect(p1Knowledge?.titleBonus).toBe(1);
      expect(p1Knowledge?.hasTitle).toBe(true);
      expect(p1Knowledge?.isTied).toBe(true);

      const p2Knowledge = p2Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_KNOWLEDGE
      );
      expect(p2Knowledge?.titleBonus).toBe(1);
      expect(p2Knowledge?.hasTitle).toBe(true);
      expect(p2Knowledge?.isTied).toBe(true);
    });

    it("no bonus when tied at 0 for Greatest Knowledge", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [], // 0 spells/AAs
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [], // 0 spells/AAs
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const config = {
        enabled: true,
        mode: ACHIEVEMENT_MODE_COMPETITIVE as const,
      };

      const results = calculateAchievementResults([player1, player2], state, config);
      const p1Result = results.get("player1");

      const p1Knowledge = p1Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_KNOWLEDGE
      );
      expect(p1Knowledge?.basePoints).toBe(0);
      expect(p1Knowledge?.titleBonus).toBe(0);
      expect(p1Knowledge?.hasTitle).toBe(false);
    });

    it("awards -3 penalty for most wounds (Greatest Beating)", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND], // -6 points
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [CARD_WOUND], // -2 points
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const config = {
        enabled: true,
        mode: ACHIEVEMENT_MODE_COMPETITIVE as const,
      };

      const results = calculateAchievementResults([player1, player2], state, config);
      const p1Result = results.get("player1");
      const p2Result = results.get("player2");

      // Player 1 has more wounds, gets -3 penalty
      const p1Beating = p1Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_BEATING
      );
      expect(p1Beating?.basePoints).toBe(-6);
      expect(p1Beating?.titleBonus).toBe(-3);
      expect(p1Beating?.hasTitle).toBe(true);

      // Player 2 has fewer wounds, no penalty
      const p2Beating = p2Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_BEATING
      );
      expect(p2Beating?.basePoints).toBe(-2);
      expect(p2Beating?.titleBonus).toBe(0);
      expect(p2Beating?.hasTitle).toBe(false);
    });

    it("no penalty when tied at 0 wounds for Greatest Beating", () => {
      const player1 = createTestPlayer({
        id: "player1",
        hand: [], // 0 wounds
      });
      const player2 = createTestPlayer({
        id: "player2",
        hand: [], // 0 wounds
      });

      const state = createTestGameState({
        players: [player1, player2],
      });

      const config = {
        enabled: true,
        mode: ACHIEVEMENT_MODE_COMPETITIVE as const,
      };

      const results = calculateAchievementResults([player1, player2], state, config);
      const p1Result = results.get("player1");

      const p1Beating = p1Result?.categoryScores.find(
        (s) => s.category === ACHIEVEMENT_GREATEST_BEATING
      );
      expect(p1Beating?.basePoints).toBe(0);
      expect(p1Beating?.titleBonus).toBe(0);
      expect(p1Beating?.hasTitle).toBe(false);
    });
  });
});

describe("Final Score Calculation", () => {
  it("calculates total score from fame + achievements", () => {
    const player1 = createTestPlayer({
      id: "player1",
      fame: 50,
      hand: [CARD_FIREBALL, CARD_SNOWSTORM], // 4 points knowledge
    });

    const state = createTestGameState({
      players: [player1],
    });

    const scoringConfig = createDefaultScoringConfig(true); // Solo mode
    const result = calculateFinalScores(state, scoringConfig);

    expect(result.playerResults.length).toBe(1);
    expect(result.playerResults[0]?.baseScore).toBe(50);
    // In solo mode, no title bonuses, so just base achievement points
    expect(result.playerResults[0]?.achievements?.totalAchievementPoints).toBe(4);
    expect(result.playerResults[0]?.totalScore).toBe(54);
  });

  it("determines winner based on total score", () => {
    const player1 = createTestPlayer({
      id: "player1",
      fame: 40,
      hand: [CARD_FIREBALL, CARD_SNOWSTORM], // 4 points
    });
    const player2 = createTestPlayer({
      id: "player2",
      fame: 50,
      hand: [], // 0 points
    });

    const state = createTestGameState({
      players: [player1, player2],
    });

    const scoringConfig = createDefaultScoringConfig(false); // Competitive
    const result = calculateFinalScores(state, scoringConfig);

    // Player 1: 40 fame + 4 base + 3 title bonus = 47
    // Player 2: 50 fame + 0 = 50
    // Player 2 wins
    expect(result.rankings[0]).toBe("player2");
    expect(result.isTied).toBe(false);
  });

  it("detects ties", () => {
    const player1 = createTestPlayer({
      id: "player1",
      fame: 50,
      hand: [],
    });
    const player2 = createTestPlayer({
      id: "player2",
      fame: 50,
      hand: [],
    });

    const state = createTestGameState({
      players: [player1, player2],
    });

    const scoringConfig = createDefaultScoringConfig(false);
    const result = calculateFinalScores(state, scoringConfig);

    expect(result.isTied).toBe(true);
  });
});
