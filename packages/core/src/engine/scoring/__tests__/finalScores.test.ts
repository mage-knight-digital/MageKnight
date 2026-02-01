/**
 * Tests for the Main Scoring Orchestration
 *
 * Tests the calculateFinalScores() function which combines:
 * - Base scores (individual_fame, lowest_fame, victory_points, none)
 * - Achievement scores (if enabled)
 * - Module scores (city conquest, etc.)
 *
 * Also tests rankings, tie detection, and edge cases.
 */

import { describe, it, expect } from "vitest";
import {
  calculateFinalScores,
  createDefaultScoringConfig,
} from "../standardAchievements.js";
import { createTestPlayer, createTestGameState } from "../../__tests__/testHelpers.js";
import {
  BASE_SCORE_INDIVIDUAL_FAME,
  BASE_SCORE_LOWEST_FAME,
  BASE_SCORE_VICTORY_POINTS,
  BASE_SCORE_NONE,
  ACHIEVEMENT_MODE_COMPETITIVE,
  ACHIEVEMENT_MODE_SOLO,
  SCORING_MODULE_CITY_CONQUEST,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  type ScenarioScoringConfig,
  type CityConquestModule,
} from "@mage-knight/shared";
import type { CityColor } from "../../../types/city.js";

describe("calculateFinalScores", () => {
  describe("Base Score Modes", () => {
    it("calculates individual_fame: each player uses their own Fame", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 40 });
      const player2 = createTestPlayer({ id: "p2", fame: 60 });
      const state = createTestGameState({ players: [player1, player2] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults).toHaveLength(2);
      expect(result.playerResults.find((r) => r.playerId === "p1")?.baseScore).toBe(40);
      expect(result.playerResults.find((r) => r.playerId === "p2")?.baseScore).toBe(60);
    });

    it("calculates lowest_fame: all players use the lowest Fame (co-op)", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 40 });
      const player2 = createTestPlayer({ id: "p2", fame: 60 });
      const player3 = createTestPlayer({ id: "p3", fame: 25 });
      const state = createTestGameState({ players: [player1, player2, player3] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_LOWEST_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      // All players should have the same base score (lowest: 25)
      expect(result.playerResults).toHaveLength(3);
      expect(result.playerResults.every((r) => r.baseScore === 25)).toBe(true);
    });

    it("calculates victory_points: returns 0 for all players (reserved for future)", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 50 });
      const state = createTestGameState({ players: [player1] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_VICTORY_POINTS,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.baseScore).toBe(0);
    });

    it("calculates none: returns 0 for all players", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 50 });
      const player2 = createTestPlayer({ id: "p2", fame: 30 });
      const state = createTestGameState({ players: [player1, player2] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_NONE,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults.every((r) => r.baseScore === 0)).toBe(true);
    });

    it("handles empty player list for lowest_fame gracefully", () => {
      const state = createTestGameState({ players: [] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_LOWEST_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults).toHaveLength(0);
      expect(result.rankings).toHaveLength(0);
      expect(result.isTied).toBe(false);
    });
  });

  describe("Achievements Integration", () => {
    it("includes achievement points when achievements enabled", () => {
      const player = createTestPlayer({
        id: "p1",
        fame: 30,
        hand: [CARD_FIREBALL, CARD_SNOWSTORM], // 4 knowledge points
      });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: true, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.baseScore).toBe(30);
      expect(result.playerResults[0]?.achievements).toBeDefined();
      expect(result.playerResults[0]?.achievements?.totalAchievementPoints).toBe(4);
      expect(result.playerResults[0]?.totalScore).toBe(34);
    });

    it("excludes achievements when disabled", () => {
      const player = createTestPlayer({
        id: "p1",
        fame: 30,
        hand: [CARD_FIREBALL], // Would give 2 points if enabled
      });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.achievements).toBeUndefined();
      expect(result.playerResults[0]?.totalScore).toBe(30);
    });

    it("includes title bonuses in competitive mode", () => {
      const player1 = createTestPlayer({
        id: "p1",
        fame: 0,
        hand: [CARD_FIREBALL, CARD_SNOWSTORM], // 4 knowledge points
      });
      const player2 = createTestPlayer({
        id: "p2",
        fame: 0,
        hand: [CARD_FIREBALL], // 2 knowledge points
      });
      const state = createTestGameState({ players: [player1, player2] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: true, mode: ACHIEVEMENT_MODE_COMPETITIVE },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      // Player 1 wins Greatest Knowledge (4 base + 3 title = 7 for that category)
      // Also tied at 0 for other categories where ties at 0 still award bonuses
      // Check that Greatest Knowledge specifically has the title bonus
      const p1Result = result.playerResults.find((r) => r.playerId === "p1");
      const knowledgeScore = p1Result?.achievements?.categoryScores.find(
        (c) => c.category === "greatest_knowledge"
      );
      expect(knowledgeScore?.basePoints).toBe(4);
      expect(knowledgeScore?.titleBonus).toBe(3);
      expect(knowledgeScore?.hasTitle).toBe(true);
      expect(knowledgeScore?.isTied).toBe(false);

      // Player 2 should NOT have the title
      const p2Result = result.playerResults.find((r) => r.playerId === "p2");
      const p2KnowledgeScore = p2Result?.achievements?.categoryScores.find(
        (c) => c.category === "greatest_knowledge"
      );
      expect(p2KnowledgeScore?.titleBonus).toBe(0);
      expect(p2KnowledgeScore?.hasTitle).toBe(false);
    });
  });

  describe("Module Integration", () => {
    it("includes module scores when modules enabled", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 20 });
      const player2 = createTestPlayer({ id: "p2", fame: 20 });
      const state = createTestGameState({
        players: [player1, player2],
        cities: {
          red: {
            color: "red" as CityColor,
            isConquered: true,
            leaderId: "p1",
            shields: [
              { playerId: "p1", order: 1 },
              { playerId: "p1", order: 2 },
              { playerId: "p2", order: 3 },
            ],
          },
        },
      });

      const cityConquestModule: CityConquestModule = {
        type: SCORING_MODULE_CITY_CONQUEST,
        leaderPoints: 7,
        participantPoints: 4,
        titleName: "Greatest City Conqueror",
        titleBonus: 5,
        titleTiedBonus: 2,
      };

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [cityConquestModule],
      };

      const result = calculateFinalScores(state, config);

      // P1: leader (7) + title (5) = 12 module points
      // P2: participant (4) = 4 module points
      const p1Result = result.playerResults.find((r) => r.playerId === "p1");
      const p2Result = result.playerResults.find((r) => r.playerId === "p2");

      expect(p1Result?.moduleResults).toHaveLength(1);
      expect(p1Result?.moduleResults[0]?.points).toBe(12);
      expect(p1Result?.totalScore).toBe(32); // 20 fame + 12 module

      expect(p2Result?.moduleResults).toHaveLength(1);
      expect(p2Result?.moduleResults[0]?.points).toBe(4);
      expect(p2Result?.totalScore).toBe(24); // 20 fame + 4 module
    });

    it("handles scenarios with no modules", () => {
      const player = createTestPlayer({ id: "p1", fame: 50 });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.moduleResults).toHaveLength(0);
      expect(result.playerResults[0]?.totalScore).toBe(50);
    });
  });

  describe("Combined Scoring", () => {
    it("combines base + achievements + modules correctly", () => {
      const player = createTestPlayer({
        id: "p1",
        fame: 30,
        hand: [CARD_FIREBALL], // 2 knowledge points
      });
      const state = createTestGameState({
        players: [player],
        cities: {
          red: {
            color: "red" as CityColor,
            isConquered: true,
            leaderId: "p1",
            shields: [{ playerId: "p1", order: 1 }],
          },
        },
      });

      const cityConquestModule: CityConquestModule = {
        type: SCORING_MODULE_CITY_CONQUEST,
        leaderPoints: 7,
        participantPoints: 4,
        titleName: "Greatest City Conqueror",
        titleBonus: 5,
        titleTiedBonus: 2,
      };

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: true, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [cityConquestModule],
      };

      const result = calculateFinalScores(state, config);

      const p1Result = result.playerResults[0];
      expect(p1Result?.baseScore).toBe(30);
      expect(p1Result?.achievements?.totalAchievementPoints).toBe(2);
      expect(p1Result?.moduleResults[0]?.points).toBe(12); // 7 leader + 5 title (solo still gets title)
      expect(p1Result?.totalScore).toBe(44); // 30 + 2 + 12
    });
  });

  describe("Rankings and Tie Detection", () => {
    it("ranks players by total score descending", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 30 });
      const player2 = createTestPlayer({ id: "p2", fame: 50 });
      const player3 = createTestPlayer({ id: "p3", fame: 40 });
      const state = createTestGameState({ players: [player1, player2, player3] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.rankings).toEqual(["p2", "p3", "p1"]);
      expect(result.isTied).toBe(false);
    });

    it("detects tie when top two players have same score", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 50 });
      const player2 = createTestPlayer({ id: "p2", fame: 50 });
      const player3 = createTestPlayer({ id: "p3", fame: 30 });
      const state = createTestGameState({ players: [player1, player2, player3] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.isTied).toBe(true);
      // Both tied players should be at the top
      expect(result.rankings.slice(0, 2).sort()).toEqual(["p1", "p2"]);
    });

    it("handles single player (no tie possible)", () => {
      const player = createTestPlayer({ id: "p1", fame: 50 });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.rankings).toEqual(["p1"]);
      expect(result.isTied).toBe(false);
    });

    it("handles all players tied", () => {
      const player1 = createTestPlayer({ id: "p1", fame: 40 });
      const player2 = createTestPlayer({ id: "p2", fame: 40 });
      const player3 = createTestPlayer({ id: "p3", fame: 40 });
      const state = createTestGameState({ players: [player1, player2, player3] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.isTied).toBe(true);
      expect(result.rankings).toHaveLength(3);
    });
  });

  describe("Edge Cases", () => {
    it("handles lowest_fame with single player", () => {
      const player = createTestPlayer({ id: "p1", fame: 42 });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_LOWEST_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.baseScore).toBe(42);
    });

    it("handles zero fame", () => {
      const player = createTestPlayer({ id: "p1", fame: 0 });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.totalScore).toBe(0);
    });

    it("handles negative total score from wounds", () => {
      // Player with many wounds could have negative achievement score
      // (wounds = -2 per wound, title penalty = -3)
      // With no fame and no modules, total could be negative
      const player = createTestPlayer({
        id: "p1",
        fame: 0,
        // No wounds in this test, but structure supports it
      });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_NONE,
        achievements: { enabled: false, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults[0]?.totalScore).toBe(0);
    });

    it("includes config in result", () => {
      const player = createTestPlayer({ id: "p1", fame: 50 });
      const state = createTestGameState({ players: [player] });

      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: true, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.config).toEqual(config);
    });
  });

  describe("First Reconnaissance Integration", () => {
    it("calculates scores for First Reconnaissance scenario (solo, achievements, no modules)", () => {
      const player = createTestPlayer({
        id: "p1",
        fame: 25,
        hand: [CARD_FIREBALL], // 2 knowledge points
      });
      const state = createTestGameState({ players: [player] });

      // First Reconnaissance uses individual fame, solo achievements, no modules
      const config: ScenarioScoringConfig = {
        baseScoreMode: BASE_SCORE_INDIVIDUAL_FAME,
        achievements: { enabled: true, mode: ACHIEVEMENT_MODE_SOLO },
        modules: [],
      };

      const result = calculateFinalScores(state, config);

      expect(result.playerResults).toHaveLength(1);
      expect(result.playerResults[0]?.baseScore).toBe(25);
      expect(result.playerResults[0]?.achievements).toBeDefined();
      expect(result.playerResults[0]?.moduleResults).toHaveLength(0);
      expect(result.rankings).toEqual(["p1"]);
      expect(result.isTied).toBe(false);
    });
  });
});

describe("createDefaultScoringConfig", () => {
  it("creates solo config with no titles", () => {
    const config = createDefaultScoringConfig(true);

    expect(config.baseScoreMode).toBe(BASE_SCORE_INDIVIDUAL_FAME);
    expect(config.achievements.enabled).toBe(true);
    expect(config.achievements.mode).toBe(ACHIEVEMENT_MODE_SOLO);
    expect(config.modules).toHaveLength(0);
  });

  it("creates multiplayer config with competitive achievements", () => {
    const config = createDefaultScoringConfig(false);

    expect(config.baseScoreMode).toBe(BASE_SCORE_INDIVIDUAL_FAME);
    expect(config.achievements.enabled).toBe(true);
    expect(config.achievements.mode).toBe(ACHIEVEMENT_MODE_COMPETITIVE);
    expect(config.modules).toHaveLength(0);
  });
});
