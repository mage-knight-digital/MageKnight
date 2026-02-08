/**
 * Tests for Base Score Calculation
 *
 * Tests calculateBaseScores() for all modes:
 * - individual_fame: Each player's own Fame
 * - lowest_fame: Minimum Fame across all players (co-op)
 * - victory_points: Returns 0 (reserved for future)
 * - none: Returns 0 for all players
 *
 * Also tests with 1-4 players and edge cases.
 */

import { describe, it, expect } from "vitest";
import { calculateBaseScores } from "../baseScore.js";
import { createTestPlayer } from "../../__tests__/testHelpers.js";
import {
  BASE_SCORE_INDIVIDUAL_FAME,
  BASE_SCORE_LOWEST_FAME,
  BASE_SCORE_VICTORY_POINTS,
  BASE_SCORE_NONE,
} from "@mage-knight/shared";

describe("calculateBaseScores", () => {
  describe("individual_fame mode", () => {
    it("returns each player's own Fame with 1 player", () => {
      const players = [createTestPlayer({ id: "p1", fame: 42 })];
      const result = calculateBaseScores(players, BASE_SCORE_INDIVIDUAL_FAME);

      expect(result.get("p1")).toBe(42);
      expect(result.size).toBe(1);
    });

    it("returns each player's own Fame with 2 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 40 }),
        createTestPlayer({ id: "p2", fame: 60 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_INDIVIDUAL_FAME);

      expect(result.get("p1")).toBe(40);
      expect(result.get("p2")).toBe(60);
    });

    it("returns each player's own Fame with 3 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 30 }),
        createTestPlayer({ id: "p2", fame: 50 }),
        createTestPlayer({ id: "p3", fame: 70 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_INDIVIDUAL_FAME);

      expect(result.get("p1")).toBe(30);
      expect(result.get("p2")).toBe(50);
      expect(result.get("p3")).toBe(70);
    });

    it("returns each player's own Fame with 4 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 10 }),
        createTestPlayer({ id: "p2", fame: 20 }),
        createTestPlayer({ id: "p3", fame: 30 }),
        createTestPlayer({ id: "p4", fame: 40 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_INDIVIDUAL_FAME);

      expect(result.get("p1")).toBe(10);
      expect(result.get("p2")).toBe(20);
      expect(result.get("p3")).toBe(30);
      expect(result.get("p4")).toBe(40);
    });

    it("handles zero fame", () => {
      const players = [createTestPlayer({ id: "p1", fame: 0 })];
      const result = calculateBaseScores(players, BASE_SCORE_INDIVIDUAL_FAME);

      expect(result.get("p1")).toBe(0);
    });
  });

  describe("lowest_fame mode", () => {
    it("returns the player's fame with 1 player", () => {
      const players = [createTestPlayer({ id: "p1", fame: 42 })];
      const result = calculateBaseScores(players, BASE_SCORE_LOWEST_FAME);

      expect(result.get("p1")).toBe(42);
    });

    it("returns minimum fame for all players with 2 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 40 }),
        createTestPlayer({ id: "p2", fame: 60 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_LOWEST_FAME);

      expect(result.get("p1")).toBe(40);
      expect(result.get("p2")).toBe(40);
    });

    it("returns minimum fame for all players with 3 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 50 }),
        createTestPlayer({ id: "p2", fame: 25 }),
        createTestPlayer({ id: "p3", fame: 75 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_LOWEST_FAME);

      expect(result.get("p1")).toBe(25);
      expect(result.get("p2")).toBe(25);
      expect(result.get("p3")).toBe(25);
    });

    it("returns minimum fame for all players with 4 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 100 }),
        createTestPlayer({ id: "p2", fame: 15 }),
        createTestPlayer({ id: "p3", fame: 50 }),
        createTestPlayer({ id: "p4", fame: 80 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_LOWEST_FAME);

      const expected = 15;
      expect(result.get("p1")).toBe(expected);
      expect(result.get("p2")).toBe(expected);
      expect(result.get("p3")).toBe(expected);
      expect(result.get("p4")).toBe(expected);
    });

    it("handles all players with same fame", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 30 }),
        createTestPlayer({ id: "p2", fame: 30 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_LOWEST_FAME);

      expect(result.get("p1")).toBe(30);
      expect(result.get("p2")).toBe(30);
    });

    it("handles empty player list", () => {
      const result = calculateBaseScores([], BASE_SCORE_LOWEST_FAME);

      expect(result.size).toBe(0);
    });
  });

  describe("none mode", () => {
    it("returns 0 for single player", () => {
      const players = [createTestPlayer({ id: "p1", fame: 50 })];
      const result = calculateBaseScores(players, BASE_SCORE_NONE);

      expect(result.get("p1")).toBe(0);
    });

    it("returns 0 for all players with 2 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 40 }),
        createTestPlayer({ id: "p2", fame: 60 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_NONE);

      expect(result.get("p1")).toBe(0);
      expect(result.get("p2")).toBe(0);
    });

    it("returns 0 for all players with 4 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 10 }),
        createTestPlayer({ id: "p2", fame: 20 }),
        createTestPlayer({ id: "p3", fame: 30 }),
        createTestPlayer({ id: "p4", fame: 40 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_NONE);

      for (const [, score] of result) {
        expect(score).toBe(0);
      }
    });
  });

  describe("victory_points mode", () => {
    it("returns 0 for single player", () => {
      const players = [createTestPlayer({ id: "p1", fame: 50 })];
      const result = calculateBaseScores(players, BASE_SCORE_VICTORY_POINTS);

      expect(result.get("p1")).toBe(0);
    });

    it("returns 0 for all players with 2 players", () => {
      const players = [
        createTestPlayer({ id: "p1", fame: 40 }),
        createTestPlayer({ id: "p2", fame: 60 }),
      ];
      const result = calculateBaseScores(players, BASE_SCORE_VICTORY_POINTS);

      expect(result.get("p1")).toBe(0);
      expect(result.get("p2")).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles empty player list for all modes", () => {
      expect(calculateBaseScores([], BASE_SCORE_INDIVIDUAL_FAME).size).toBe(0);
      expect(calculateBaseScores([], BASE_SCORE_LOWEST_FAME).size).toBe(0);
      expect(calculateBaseScores([], BASE_SCORE_VICTORY_POINTS).size).toBe(0);
      expect(calculateBaseScores([], BASE_SCORE_NONE).size).toBe(0);
    });
  });
});
