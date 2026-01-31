/**
 * Cooperative Assault tests
 *
 * Tests for:
 * - Proposing a cooperative assault
 * - Accepting/declining proposals
 * - Cancelling proposals
 * - Validation of eligibility requirements
 * - Round end cleanup
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, type MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestGameState, createTestHex } from "./testHelpers.js";
import {
  PROPOSE_COOPERATIVE_ASSAULT_ACTION,
  RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
  CANCEL_COOPERATIVE_PROPOSAL_ACTION,
  COOPERATIVE_ASSAULT_PROPOSED,
  COOPERATIVE_ASSAULT_RESPONSE,
  COOPERATIVE_ASSAULT_AGREED,
  COOPERATIVE_ASSAULT_REJECTED,
  COOPERATIVE_ASSAULT_CANCELLED,
  COOPERATIVE_RESPONSE_ACCEPT,
  COOPERATIVE_RESPONSE_DECLINE,
  CITY_COLOR_RED,
  INVALID_ACTION,
  CARD_MARCH,
  CARD_WOUND,
  hexKey,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { EnemyTokenId } from "../../types/enemy.js";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import { createCityState } from "../../types/city.js";

/**
 * Create a test state with a city and players adjacent to it.
 */
function createStateWithCity(options: {
  cityColor?: string;
  initiatorPosition?: { q: number; r: number };
  inviteePosition?: { q: number; r: number };
  inviteeTokenFlipped?: boolean;
  inviteeHand?: string[];
  endOfRoundAnnounced?: boolean;
  scenarioEndTriggered?: boolean;
  initiatorActed?: boolean;
}) {
  const cityColor = options.cityColor ?? CITY_COLOR_RED;
  // City at (2, 0), initiator and invitee are adjacent
  const cityCoord = { q: 2, r: 0 };
  const initiatorPos = options.initiatorPosition ?? { q: 1, r: 0 }; // Adjacent to city
  const inviteePos = options.inviteePosition ?? { q: 2, r: -1 }; // Also adjacent to city

  const initiator = createTestPlayer({
    id: "player1",
    position: initiatorPos,
    hand: [CARD_MARCH],
    hasTakenActionThisTurn: options.initiatorActed ?? false,
  });

  const invitee = createTestPlayer({
    id: "player2",
    position: inviteePos,
    hand: options.inviteeHand ?? [CARD_MARCH],
    roundOrderTokenFlipped: options.inviteeTokenFlipped ?? false,
  });

  const citySite: Site = {
    type: SiteType.City,
    owner: null,
    isConquered: false,
    isBurned: false,
    cityColor: cityColor,
  };

  const cityHex = createTestHex(cityCoord.q, cityCoord.r, TERRAIN_PLAINS, citySite);

  const hexes: Record<string, HexState> = {
    [hexKey(initiatorPos)]: createTestHex(initiatorPos.q, initiatorPos.r, TERRAIN_PLAINS),
    [hexKey(inviteePos)]: createTestHex(inviteePos.q, inviteePos.r, TERRAIN_PLAINS),
    [hexKey(cityCoord)]: cityHex,
  };

  // Create city state with garrison
  const cities = {
    [cityColor]: createCityState(
      cityColor as "red" | "blue" | "green" | "white",
      1,
      ["orc_swordsmen_1" as EnemyTokenId, "orc_swordsmen_2" as EnemyTokenId]
    ),
  };

  return createTestGameState({
    players: [initiator, invitee],
    turnOrder: ["player1", "player2"],
    map: {
      hexes,
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
    cities,
    endOfRoundAnnouncedBy: options.endOfRoundAnnounced ? "someone" : null,
    scenarioEndTriggered: options.scenarioEndTriggered ?? false,
  });
}

describe("Cooperative Assault", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("Proposing a cooperative assault", () => {
    it("should allow proposing when all conditions are met", () => {
      const state = createStateWithCity({});

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.state.pendingCooperativeAssault).not.toBeNull();
      expect(result.state.pendingCooperativeAssault?.initiatorId).toBe("player1");
      expect(result.state.pendingCooperativeAssault?.targetCity).toBe(CITY_COLOR_RED);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_PROPOSED,
          initiatorId: "player1",
          targetCity: CITY_COLOR_RED,
        })
      );
    });

    it("should reject proposal when initiator not adjacent to city", () => {
      const state = createStateWithCity({
        initiatorPosition: { q: 0, r: 0 }, // Not adjacent to city at (2,0)
      });

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("adjacent"),
        })
      );
    });

    it("should reject proposal when end of round is announced", () => {
      const state = createStateWithCity({
        endOfRoundAnnounced: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("announced"),
        })
      );
    });

    it("should reject proposal when initiator has taken action", () => {
      const state = createStateWithCity({
        initiatorActed: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("action"),
        })
      );
    });

    it("should reject proposal when invitee token is flipped", () => {
      const state = createStateWithCity({
        inviteeTokenFlipped: true,
      });

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("flipped"),
        })
      );
    });

    it("should reject proposal when invitee has no non-wound cards", () => {
      const state = createStateWithCity({
        inviteeHand: [CARD_WOUND, CARD_WOUND], // Only wounds
      });

      const result = engine.processAction(state, "player1", {
        type: PROPOSE_COOPERATIVE_ASSAULT_ACTION,
        targetCity: CITY_COLOR_RED,
        invitedPlayerIds: ["player2"],
        distribution: [
          { playerId: "player1", enemyCount: 1 },
          { playerId: "player2", enemyCount: 1 },
        ],
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("non-wound"),
        })
      );
    });
  });

  describe("Responding to a proposal", () => {
    function createStateWithProposal() {
      const state = createStateWithCity({});
      return {
        ...state,
        pendingCooperativeAssault: {
          initiatorId: "player1",
          targetCity: CITY_COLOR_RED,
          invitedPlayerIds: ["player2"],
          distribution: [
            { playerId: "player1", enemyCount: 1 },
            { playerId: "player2", enemyCount: 1 },
          ],
          acceptedPlayerIds: [],
        },
      } as GameState;
    }

    it("should accept proposal and flip tokens when all accept", () => {
      const state = createStateWithProposal();

      const result = engine.processAction(state, "player2", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      expect(result.state.pendingCooperativeAssault).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_RESPONSE,
          playerId: "player2",
          accepted: true,
        })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_AGREED,
          initiatorId: "player1",
        })
      );

      // Check tokens are flipped
      const player1 = result.state.players.find((p) => p.id === "player1");
      const player2 = result.state.players.find((p) => p.id === "player2");
      expect(player1?.roundOrderTokenFlipped).toBe(true);
      expect(player2?.roundOrderTokenFlipped).toBe(true);
    });

    it("should decline proposal and clear it", () => {
      const state = createStateWithProposal();

      const result = engine.processAction(state, "player2", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_DECLINE,
      });

      expect(result.state.pendingCooperativeAssault).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_RESPONSE,
          playerId: "player2",
          accepted: false,
        })
      );
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_REJECTED,
          initiatorId: "player1",
          rejectingPlayerId: "player2",
        })
      );
    });

    it("should reject response from non-invitee", () => {
      const state = createStateWithProposal();

      const result = engine.processAction(state, "player1", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("invited"),
        })
      );
    });

    it("should reject response when no proposal exists", () => {
      const state = createStateWithCity({});

      const result = engine.processAction(state, "player2", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("pending"),
        })
      );
    });
  });

  describe("Cancelling a proposal", () => {
    function createStateWithProposal() {
      const state = createStateWithCity({});
      return {
        ...state,
        pendingCooperativeAssault: {
          initiatorId: "player1",
          targetCity: CITY_COLOR_RED,
          invitedPlayerIds: ["player2"],
          distribution: [
            { playerId: "player1", enemyCount: 1 },
            { playerId: "player2", enemyCount: 1 },
          ],
          acceptedPlayerIds: [],
        },
      } as GameState;
    }

    it("should allow initiator to cancel", () => {
      const state = createStateWithProposal();

      const result = engine.processAction(state, "player1", {
        type: CANCEL_COOPERATIVE_PROPOSAL_ACTION,
      });

      expect(result.state.pendingCooperativeAssault).toBeNull();
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_CANCELLED,
          initiatorId: "player1",
        })
      );
    });

    it("should reject cancel from non-initiator", () => {
      const state = createStateWithProposal();

      const result = engine.processAction(state, "player2", {
        type: CANCEL_COOPERATIVE_PROPOSAL_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("initiator"),
        })
      );
    });

    it("should reject cancel when no proposal exists", () => {
      const state = createStateWithCity({});

      const result = engine.processAction(state, "player1", {
        type: CANCEL_COOPERATIVE_PROPOSAL_ACTION,
      });

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          reason: expect.stringContaining("pending"),
        })
      );
    });
  });

  describe("Multi-player acceptance", () => {
    function createStateWithThreePlayers() {
      const cityCoord = { q: 2, r: 0 };
      const citySite: Site = {
        type: SiteType.City,
        owner: null,
        isConquered: false,
        isBurned: false,
        cityColor: CITY_COLOR_RED,
      };

      const player1 = createTestPlayer({
        id: "player1",
        position: { q: 1, r: 0 },
        hand: [CARD_MARCH],
      });

      const player2 = createTestPlayer({
        id: "player2",
        position: { q: 2, r: -1 },
        hand: [CARD_MARCH],
      });

      const player3 = createTestPlayer({
        id: "player3",
        position: { q: 3, r: 0 },
        hand: [CARD_MARCH],
      });

      const hexes: Record<string, HexState> = {
        [hexKey({ q: 1, r: 0 })]: createTestHex(1, 0, TERRAIN_PLAINS),
        [hexKey({ q: 2, r: -1 })]: createTestHex(2, -1, TERRAIN_PLAINS),
        [hexKey({ q: 3, r: 0 })]: createTestHex(3, 0, TERRAIN_PLAINS),
        [hexKey(cityCoord)]: createTestHex(cityCoord.q, cityCoord.r, TERRAIN_PLAINS, citySite),
      };

      const cities = {
        [CITY_COLOR_RED]: createCityState(CITY_COLOR_RED, 1, [
          "orc_swordsmen_1" as EnemyTokenId,
          "orc_swordsmen_2" as EnemyTokenId,
          "orc_swordsmen_3" as EnemyTokenId,
        ]),
      };

      return createTestGameState({
        players: [player1, player2, player3],
        turnOrder: ["player1", "player2", "player3"],
        map: {
          hexes,
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
        cities,
        pendingCooperativeAssault: {
          initiatorId: "player1",
          targetCity: CITY_COLOR_RED,
          invitedPlayerIds: ["player2", "player3"],
          distribution: [
            { playerId: "player1", enemyCount: 1 },
            { playerId: "player2", enemyCount: 1 },
            { playerId: "player3", enemyCount: 1 },
          ],
          acceptedPlayerIds: [],
        },
      }) as GameState;
    }

    it("should wait for all invitees to accept", () => {
      const state = createStateWithThreePlayers();

      // First player accepts
      const result1 = engine.processAction(state, "player2", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      // Proposal still pending
      expect(result1.state.pendingCooperativeAssault).not.toBeNull();
      expect(result1.state.pendingCooperativeAssault?.acceptedPlayerIds).toContain("player2");

      // Second player accepts
      const result2 = engine.processAction(result1.state, "player3", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      // Now proposal is complete
      expect(result2.state.pendingCooperativeAssault).toBeNull();
      expect(result2.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_AGREED,
        })
      );
    });

    it("should reject proposal if any invitee declines", () => {
      const state = createStateWithThreePlayers();

      // First player accepts
      const result1 = engine.processAction(state, "player2", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_ACCEPT,
      });

      // Second player declines
      const result2 = engine.processAction(result1.state, "player3", {
        type: RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
        response: COOPERATIVE_RESPONSE_DECLINE,
      });

      // Proposal is rejected
      expect(result2.state.pendingCooperativeAssault).toBeNull();
      expect(result2.events).toContainEqual(
        expect.objectContaining({
          type: COOPERATIVE_ASSAULT_REJECTED,
          rejectingPlayerId: "player3",
        })
      );
    });
  });
});
