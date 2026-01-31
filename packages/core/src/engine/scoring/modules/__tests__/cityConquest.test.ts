/**
 * City Conquest Scoring Module Tests
 */

import { describe, it, expect } from "vitest";
import { calculateCityConquestScore } from "../cityConquest.js";
import {
  createTestGameState,
  createTestPlayer,
} from "../../../__tests__/testHelpers.js";
import type { GameState } from "../../../../state/GameState.js";
import type { CityState, CityShield } from "../../../../types/city.js";
import type { CityConquestModule } from "@mage-knight/shared";
import { SCORING_MODULE_CITY_CONQUEST } from "@mage-knight/shared";
import { CITY_COLOR_RED, CITY_COLOR_BLUE, CITY_COLOR_GREEN } from "../../../../types/mapConstants.js";
import type { CityColor } from "../../../../types/map.js";

/**
 * Default city conquest configuration for testing
 */
const defaultConfig: CityConquestModule = {
  type: SCORING_MODULE_CITY_CONQUEST,
  leaderPoints: 7,
  participantPoints: 4,
  titleName: "Greatest City Conqueror",
  titleBonus: 5,
  titleTiedBonus: 2,
};

/**
 * Create a city state with specified shields
 */
function createCityState(
  color: CityColor,
  shields: readonly CityShield[],
  leaderId: string | null = null,
  isConquered = true
): CityState {
  return {
    color,
    level: 1,
    garrison: [],
    shields,
    isConquered,
    leaderId,
  };
}

/**
 * Create a test state with specified cities and players
 */
function createTestStateWithCities(
  playerIds: string[],
  cities: Partial<Record<CityColor, CityState>>
): GameState {
  const players = playerIds.map((id) =>
    createTestPlayer({ id, position: { q: 0, r: 0 } })
  );

  const baseState = createTestGameState({
    players,
    turnOrder: playerIds,
  });

  return {
    ...baseState,
    cities,
  };
}

describe("City Conquest Scoring Module", () => {
  describe("Base Scoring", () => {
    it("should return 0 points when no cities conquered", () => {
      const state = createTestStateWithCities(["player1", "player2"], {});

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results).toHaveLength(2);
      expect(results[0].points).toBe(0);
      expect(results[0].breakdown).toHaveLength(0);
      expect(results[1].points).toBe(0);
      expect(results[1].breakdown).toHaveLength(0);
    });

    it("should award leader points for leading a city", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1 leads 1 city = 7 points + 5 title bonus = 12
      expect(results[0].points).toBe(12);
      expect(results[0].breakdown).toContainEqual({
        description: "Cities led",
        points: 7,
        quantity: 1,
      });
      // player2 has no participation
      expect(results[1].points).toBe(0);
    });

    it("should award participant points for participating without leading", () => {
      // player1 has 3 shields (leader), player2 has 1 shield (participant)
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player1", order: 3 },
            { playerId: "player2", order: 4 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1 leads = 7 points + 5 title (most shields)
      expect(results[0].points).toBe(12);
      // player2 participates = 4 points
      expect(results[1].points).toBe(4);
      expect(results[1].breakdown).toContainEqual({
        description: "Cities participated",
        points: 4,
        quantity: 1,
      });
    });

    it("should award both leader and participant points for different cities", () => {
      // player1 leads red, participates in blue
      // player2 leads blue
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
          ],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [
            { playerId: "player2", order: 1 },
            { playerId: "player2", order: 2 },
            { playerId: "player1", order: 3 },
          ],
          "player2"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1: 7 (led red) + 4 (participated blue) = 11 base
      // player1 has 3 shields total, player2 has 2 shields total
      // player1 wins title outright = +5
      expect(results[0].points).toBe(11 + 5); // 16
      expect(results[0].breakdown).toContainEqual({
        description: "Cities led",
        points: 7,
        quantity: 1,
      });
      expect(results[0].breakdown).toContainEqual({
        description: "Cities participated",
        points: 4,
        quantity: 1,
      });
      expect(results[0].title?.isTied).toBe(false);

      // player2: 7 (led blue) = 7 base, no title
      expect(results[1].points).toBe(7);
      expect(results[1].title).toBeUndefined();
    });

    it("should handle player with no participation", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(
        ["player1", "player2", "player3"],
        cities
      );

      const results = calculateCityConquestScore(state, defaultConfig);

      // player3 has no participation
      expect(results[2].points).toBe(0);
      expect(results[2].breakdown).toHaveLength(0);
      expect(results[2].title).toBeUndefined();
    });

    it("should not count unconquered cities", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1",
          false // not conquered
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].points).toBe(0);
      expect(results[0].breakdown).toHaveLength(0);
    });
  });

  describe("Title Calculation", () => {
    it("should award title to player with most total shields", () => {
      // player1: 3 shields, player2: 2 shields
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player2", order: 3 },
          ],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player2", order: 2 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1 has title (most shields)
      expect(results[0].title).toEqual({
        name: "Greatest City Conqueror",
        bonus: 5,
        isTied: false,
      });
      expect(results[1].title).toBeUndefined();
    });

    it("should break ties using earliest shield order", () => {
      // Both have 2 shields, but player2 placed first shield earlier
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player2", order: 1 }, // player2's first shield
            { playerId: "player1", order: 2 }, // player1's first shield
            { playerId: "player1", order: 3 },
            { playerId: "player2", order: 4 },
          ],
          "player2" // player2 leads due to earlier order
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player2 wins title due to earliest first shield
      expect(results[0].title).toBeUndefined(); // player1
      expect(results[1].title).toEqual({
        name: "Greatest City Conqueror",
        bonus: 5,
        isTied: false,
      });
    });

    it("should award tied bonus when shields and orders match", () => {
      // Both players have 1 shield each with same order number
      // (In separate cities, so order 1 for each)
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [{ playerId: "player2", order: 1 }],
          "player2"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // Both get tied bonus
      expect(results[0].title).toEqual({
        name: "Greatest City Conqueror",
        bonus: 2,
        isTied: true,
      });
      expect(results[1].title).toEqual({
        name: "Greatest City Conqueror",
        bonus: 2,
        isTied: true,
      });
    });

    it("should not award title when no cities conquered", () => {
      const state = createTestStateWithCities(["player1", "player2"], {});

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].title).toBeUndefined();
      expect(results[1].title).toBeUndefined();
    });

    it("should award title in single player game", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].title).toEqual({
        name: "Greatest City Conqueror",
        bonus: 5,
        isTied: false,
      });
    });
  });

  describe("Breakdown Generation", () => {
    it("should include cities led in breakdown", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].breakdown).toContainEqual({
        description: "Cities led",
        points: 14, // 7 * 2
        quantity: 2,
      });
    });

    it("should include cities participated in breakdown", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player2", order: 2 },
          ],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player2", order: 2 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player2 participated in 2 cities
      expect(results[1].breakdown).toContainEqual({
        description: "Cities participated",
        points: 8, // 4 * 2
        quantity: 2,
      });
    });

    it("should have empty breakdown when no participation", () => {
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[1].breakdown).toHaveLength(0);
    });

    it("should set correct moduleType", () => {
      const state = createTestStateWithCities(["player1"], {});

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].moduleType).toBe(SCORING_MODULE_CITY_CONQUEST);
    });
  });

  describe("Multi-City Scenarios", () => {
    it("should handle multiple cities with different leaders", () => {
      // player1 leads red, player2 leads blue, player3 leads green
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [{ playerId: "player2", order: 1 }],
          "player2"
        ),
        [CITY_COLOR_GREEN]: createCityState(
          CITY_COLOR_GREEN,
          [{ playerId: "player3", order: 1 }],
          "player3"
        ),
      };
      const state = createTestStateWithCities(
        ["player1", "player2", "player3"],
        cities
      );

      const results = calculateCityConquestScore(state, defaultConfig);

      // All three lead one city each = 7 points each
      // All tied for shields = +2 each
      expect(results[0].points).toBe(9);
      expect(results[1].points).toBe(9);
      expect(results[2].points).toBe(9);

      // All have tied title
      expect(results[0].title?.isTied).toBe(true);
      expect(results[1].title?.isTied).toBe(true);
      expect(results[2].title?.isTied).toBe(true);
    });

    it("should count shields across all cities for title", () => {
      // player1: 2 shields in red, 3 shields in blue = 5 total
      // player2: 1 shield in red, 1 shield in blue = 2 total
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player2", order: 3 },
          ],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player1", order: 3 },
            { playerId: "player2", order: 4 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1 has most shields, wins title
      expect(results[0].title).toBeDefined();
      expect(results[0].title?.isTied).toBe(false);
      expect(results[1].title).toBeUndefined();
    });

    it("should handle complex participation patterns", () => {
      // player1: leads red, participates in blue and green
      // player2: leads blue, participates in red
      // player3: leads green, no other participation
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player2", order: 3 },
          ],
          "player1"
        ),
        [CITY_COLOR_BLUE]: createCityState(
          CITY_COLOR_BLUE,
          [
            { playerId: "player2", order: 1 },
            { playerId: "player2", order: 2 },
            { playerId: "player1", order: 3 },
          ],
          "player2"
        ),
        [CITY_COLOR_GREEN]: createCityState(
          CITY_COLOR_GREEN,
          [
            { playerId: "player3", order: 1 },
            { playerId: "player3", order: 2 },
            { playerId: "player1", order: 3 },
          ],
          "player3"
        ),
      };
      const state = createTestStateWithCities(
        ["player1", "player2", "player3"],
        cities
      );

      const results = calculateCityConquestScore(state, defaultConfig);

      // player1: 7 (lead red) + 4 (blue) + 4 (green) = 15 base
      // player1 has 4 shields total, most shields, wins title
      expect(results[0].points).toBe(15 + 5); // 20

      // player2: 7 (lead blue) + 4 (red) = 11 base
      // player2 has 3 shields
      expect(results[1].points).toBe(11);

      // player3: 7 (lead green) = 7 base
      // player3 has 2 shields
      expect(results[2].points).toBe(7);
    });
  });

  describe("Configuration Overrides", () => {
    it("should use custom leader points", () => {
      const customConfig: CityConquestModule = {
        ...defaultConfig,
        leaderPoints: 10,
      };
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, customConfig);

      expect(results[0].breakdown).toContainEqual({
        description: "Cities led",
        points: 10,
        quantity: 1,
      });
    });

    it("should use custom participant points", () => {
      const customConfig: CityConquestModule = {
        ...defaultConfig,
        participantPoints: 3,
      };
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player2", order: 2 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1", "player2"], cities);

      const results = calculateCityConquestScore(state, customConfig);

      expect(results[1].breakdown).toContainEqual({
        description: "Cities participated",
        points: 3,
        quantity: 1,
      });
    });

    it("should use custom title bonuses", () => {
      const customConfig: CityConquestModule = {
        ...defaultConfig,
        titleBonus: 8,
        titleTiedBonus: 4,
      };
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, customConfig);

      expect(results[0].title?.bonus).toBe(8);
    });

    it("should use custom title name", () => {
      const customConfig: CityConquestModule = {
        ...defaultConfig,
        titleName: "Master Conqueror",
      };
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [{ playerId: "player1", order: 1 }],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, customConfig);

      expect(results[0].title?.name).toBe("Master Conqueror");
    });
  });

  describe("Edge Cases", () => {
    it("should handle city with empty shields array (theoretical)", () => {
      // This shouldn't happen in practice, but handle gracefully
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(CITY_COLOR_RED, [], null),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results[0].points).toBe(0);
      expect(results[0].title).toBeUndefined();
    });

    it("should handle many players with varying participation", () => {
      const playerIds = ["p1", "p2", "p3", "p4", "p5"];
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "p1", order: 1 },
            { playerId: "p2", order: 2 },
            { playerId: "p3", order: 3 },
          ],
          "p1"
        ),
      };
      const state = createTestStateWithCities(playerIds, cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      expect(results).toHaveLength(5);
      // p1 leads
      expect(results[0].points).toBeGreaterThan(0);
      // p2 and p3 participated
      expect(results[1].points).toBe(4);
      expect(results[2].points).toBe(4);
      // p4 and p5 didn't participate
      expect(results[3].points).toBe(0);
      expect(results[4].points).toBe(0);
    });

    it("should handle single player with multiple shields in same city", () => {
      // Player has 5 shields on a city (defeated 5 enemies)
      const cities: Partial<Record<CityColor, CityState>> = {
        [CITY_COLOR_RED]: createCityState(
          CITY_COLOR_RED,
          [
            { playerId: "player1", order: 1 },
            { playerId: "player1", order: 2 },
            { playerId: "player1", order: 3 },
            { playerId: "player1", order: 4 },
            { playerId: "player1", order: 5 },
          ],
          "player1"
        ),
      };
      const state = createTestStateWithCities(["player1"], cities);

      const results = calculateCityConquestScore(state, defaultConfig);

      // Still only leads 1 city = 7 points + 5 title
      expect(results[0].points).toBe(12);
      expect(results[0].breakdown).toContainEqual({
        description: "Cities led",
        points: 7,
        quantity: 1,
      });
    });
  });
});
