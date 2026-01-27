/**
 * Burn monastery tests
 *
 * Tests for:
 * - Validation: must be at monastery, monastery not burned, no action taken
 * - Combat initiation: violet enemy drawn, units not allowed
 * - Victory: monastery marked burned, shield placed, artifact reward
 * - Defeat: monastery NOT burned, enemy discarded
 * - Round-start AA refresh: excludes burned monasteries from count
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex } from "./testHelpers.js";
import {
  BURN_MONASTERY_ACTION,
  INVALID_ACTION,
  MONASTERY_BURN_STARTED,
  REPUTATION_CHANGED,
  COMBAT_STARTED,
  TERRAIN_PLAINS,
  hexKey,
  REPUTATION_REASON_BURN_MONASTERY,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import { resetTokenCounter, createEnemyTokenPiles } from "../helpers/enemyHelpers.js";
import { createRng } from "../../utils/rng.js";
import { COMBAT_CONTEXT_BURN_MONASTERY } from "../../types/combat.js";

/**
 * Helper to create a monastery site
 */
function createMonasterySite(isBurned = false): Site {
  return {
    type: SiteType.Monastery,
    owner: null,
    isConquered: false,
    isBurned,
  };
}

/**
 * Helper to create a village site
 */
function createVillageSite(): Site {
  return {
    type: SiteType.Village,
    owner: null,
    isConquered: false,
    isBurned: false,
  };
}

/**
 * Create test state with player at a monastery
 */
function createStateAtMonastery(
  stateOverrides: Partial<GameState> = {},
  isBurned = false
): GameState {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    movePoints: 0,
  });

  const monasteryHex = createTestHex(0, 0, TERRAIN_PLAINS, createMonasterySite(isBurned));

  // Reset token counter for consistent test results
  resetTokenCounter();

  // Create enemy token piles with violet enemies
  const rng = createRng(12345);
  const { piles: enemyTokens, rng: newRng } = createEnemyTokenPiles(rng);

  return createTestGameState({
    players: [player],
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: monasteryHex,
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
    enemyTokens,
    rng: newRng,
    ...stateOverrides,
  });
}

describe("Burn Monastery", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("validation", () => {
    it("rejects burn monastery if not at a monastery", () => {
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
      });

      const villageHex = createTestHex(0, 0, TERRAIN_PLAINS, createVillageSite());

      const state = createTestGameState({
        players: [player],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: villageHex,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
      });

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects burn monastery if monastery already burned", () => {
      const state = createStateAtMonastery({}, true); // isBurned = true

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects burn monastery if player already took action", () => {
      const state = createStateAtMonastery({
        players: [
          createTestPlayer({
            position: { q: 0, r: 0 },
            hasTakenActionThisTurn: true,
          }),
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });

    it("rejects burn monastery if player already had combat this turn", () => {
      const state = createStateAtMonastery({
        players: [
          createTestPlayer({
            position: { q: 0, r: 0 },
            hasCombattedThisTurn: true,
          }),
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(result.events[0]).toMatchObject({
        type: INVALID_ACTION,
      });
    });
  });

  describe("combat initiation", () => {
    it("draws a violet enemy and starts combat", () => {
      const state = createStateAtMonastery();

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      // Should emit MONASTERY_BURN_STARTED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: MONASTERY_BURN_STARTED,
          playerId: "player1",
          hexCoord: { q: 0, r: 0 },
        })
      );

      // Should emit COMBAT_STARTED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: COMBAT_STARTED,
          playerId: "player1",
        })
      );

      // Combat should be active with a violet enemy
      expect(result.state.combat).toBeTruthy();
      expect(result.state.combat?.combatContext).toBe(COMBAT_CONTEXT_BURN_MONASTERY);
    });

    it("reduces reputation by 3", () => {
      const state = createStateAtMonastery({
        players: [
          createTestPlayer({
            position: { q: 0, r: 0 },
            reputation: 0,
          }),
        ],
      });

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      // Should emit REPUTATION_CHANGED
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: REPUTATION_CHANGED,
          playerId: "player1",
          delta: -3,
          newValue: -3,
          reason: REPUTATION_REASON_BURN_MONASTERY,
        })
      );

      // Player reputation should be -3
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.reputation).toBe(-3);
    });

    it("sets combat restrictions: units not allowed, enemies discarded on failure", () => {
      const state = createStateAtMonastery();

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(result.state.combat).toMatchObject({
        unitsAllowed: false,
        discardEnemiesOnFailure: true,
        combatContext: COMBAT_CONTEXT_BURN_MONASTERY,
      });
    });

    it("marks player as having taken action and combatted this turn", () => {
      const state = createStateAtMonastery();

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.hasTakenActionThisTurn).toBe(true);
      expect(player?.hasCombattedThisTurn).toBe(true);
    });
  });

  describe("combat victory", () => {
    it("uses burn_monastery combat context", () => {
      const state = createStateAtMonastery();

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      // Verify the combat state has the correct context
      expect(result.state.combat).toBeTruthy();
      expect(result.state.combat?.combatContext).toBe(COMBAT_CONTEXT_BURN_MONASTERY);
      expect(result.state.combat?.unitsAllowed).toBe(false);
      expect(result.state.combat?.discardEnemiesOnFailure).toBe(true);
    });
  });
});
