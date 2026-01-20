/**
 * Combat Position Validation Tests
 *
 * These tests verify that combat entry is properly validated based on player and enemy positions.
 *
 * CURRENT STATE (as of this writing):
 * - There is NO validation that enemies are at the player's location when entering combat
 * - A malicious client could theoretically enter combat with any enemy anywhere on the map
 * - The tests in this file demonstrate this gap and serve as a specification for the fix
 *
 * RAMPAGING ENEMY CHALLENGE FEATURE:
 * When implementing the ability to challenge rampaging enemies from adjacent hexes,
 * we need to be careful about the distinction between:
 *
 * 1. "Rampaging enemies" - enemies on hexes marked with rampagingEnemies[] array
 *    These CAN be challenged from an adjacent hex
 *
 * 2. "Enemies that happen to be rampaging creature types" - e.g., Orc Marauders drawn
 *    at Ancient Ruins. These are just regular enemies and CANNOT be challenged from adjacent.
 *    They must be fought by entering the site.
 *
 * The key distinction is:
 * - rampagingEnemies[] on the hex = can challenge from adjacent
 * - enemies[] on the hex without rampagingEnemies[] = must be on same hex to fight
 *
 * ANCIENT RUINS EDGE CASE:
 * Ancient Ruins can spawn enemies that would normally be "rampaging" creature types
 * (like Orc Marauders), but when drawn for Ancient Ruins:
 * - They are placed in the hex's enemies[] array
 * - The hex does NOT have entries in rampagingEnemies[]
 * - They are NOT considered rampaging for challenge purposes
 * - Player must enter the site to fight them, not challenge from adjacent
 *
 * This is per the rulebook: rampaging is a property of HOW an enemy arrived on a hex,
 * not WHAT type of enemy it is.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer, createTestHex, createHexEnemy } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  INVALID_ACTION,
  TERRAIN_PLAINS,
  hexKey,
  ENEMY_PROWLERS,
  ENEMY_GUARDSMEN,
  ENEMY_ORC_SUMMONERS,
} from "@mage-knight/shared";
import { RampagingEnemyType, SiteType } from "../../types/map.js";
import type { HexState } from "../../types/map.js";
import { createEnemyTokenId, resetTokenCounter } from "../helpers/enemyHelpers.js";

describe("Combat Position Validation", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("BUG: Current lack of enemy position validation", () => {
    /**
     * This test demonstrates the current bug where a player can enter combat
     * with enemies that are NOT at their location.
     *
     * Expected behavior: This should be INVALID
     * Current behavior: This SUCCEEDS (bug)
     *
     * When we fix this, change `.skip` to `.only` and verify it passes.
     */
    it.skip("should REJECT combat with enemies not at player location", () => {
      // Player at (0,0), enemy at (2,0) - not the same hex
      const enemyToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      // Create hex with enemy at (2,0)
      const enemyHex: HexState = {
        ...createTestHex(2, 0, TERRAIN_PLAINS),
        enemies: [createHexEnemy(enemyToken)],
      };

      // Player is at (0,0)
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 2, r: 0 })]: enemyHex,
          },
        },
      };

      // Try to enter combat with enemy that is NOT at player's location
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      });

      // THIS SHOULD FAIL - enemy is not at player's location
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
          // Suggested error code: ENEMY_NOT_AT_LOCATION or CANNOT_REACH_ENEMY
        })
      );

      // Combat should NOT have started
      expect(result.state.combat).toBeNull();
    });

    /**
     * This test shows the current buggy behavior - combat succeeds despite
     * the enemy being on a completely different hex.
     *
     * DELETE THIS TEST when the bug is fixed.
     */
    it("CURRENT BUGGY BEHAVIOR: allows combat with enemies anywhere on map", () => {
      // Player at (0,0), enemy at (2,0) - not the same hex
      const enemyToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      // Create hex with enemy at (2,0) - two hexes away from player
      const enemyHex: HexState = {
        ...createTestHex(2, 0, TERRAIN_PLAINS),
        enemies: [createHexEnemy(enemyToken)],
      };

      // Player is at (0,0)
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 2, r: 0 })]: enemyHex,
          },
        },
      };

      // Enter combat with enemy that is NOT at player's location
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      });

      // BUG: This currently SUCCEEDS when it should fail
      // The enemy is 2 hexes away but combat starts anyway
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);

      // This is the bug - we should not be able to fight enemies from across the map
    });
  });

  describe("Expected behavior after fix", () => {
    /**
     * Combat with enemies at player's location should always be allowed.
     */
    it.skip("should ALLOW combat with enemies at player location", () => {
      const enemyToken = createEnemyTokenId(ENEMY_PROWLERS);

      let state = createTestGameState();

      // Create hex with enemy at player's location (0,0)
      const playerHex: HexState = {
        ...createTestHex(0, 0, TERRAIN_PLAINS),
        enemies: [createHexEnemy(enemyToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 0, r: 0 })]: playerHex,
          },
        },
      };

      // Enter combat with enemy at same location
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_PROWLERS],
      });

      // Should succeed
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
    });
  });

  describe("Rampaging Enemy Challenge from Adjacent Hex", () => {
    /**
     * Rampaging enemies can be challenged from an adjacent hex.
     * This is a core Mage Knight rule - you don't have to move INTO the
     * rampaging enemy's hex to fight them.
     *
     * NOTE: This requires a new action type or a flag on ENTER_COMBAT_ACTION
     * to distinguish "challenge from adjacent" from "fight at my location".
     */
    it.skip("should ALLOW challenging rampaging enemy from adjacent hex", () => {
      const rampagingToken = createEnemyTokenId(ENEMY_ORC_SUMMONERS);

      let state = createTestGameState();

      // Create hex with rampaging enemy at (1,0) - adjacent to player
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingToken)],
      };

      // Player is at (0,0) - adjacent to rampaging hex
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Challenge the rampaging enemy from adjacent hex
      // NOTE: This may need a different action type like CHALLENGE_RAMPAGING_ACTION
      // or a flag like { type: ENTER_COMBAT_ACTION, enemyIds: [...], challengeFromAdjacent: true }
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
        // TODO: Add challenge flag or use new action type
      });

      // Should succeed - rampaging enemies can be challenged from adjacent
      expect(result.state.combat).not.toBeNull();
      expect(result.state.combat?.enemies).toHaveLength(1);
    });

    /**
     * Non-rampaging enemies on adjacent hexes CANNOT be challenged.
     * You must move to their hex to fight them.
     */
    it.skip("should REJECT challenging non-rampaging enemy from adjacent hex", () => {
      const enemyToken = createEnemyTokenId(ENEMY_GUARDSMEN);

      let state = createTestGameState();

      // Create hex with site defenders (not rampaging) at (1,0)
      const siteHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        site: {
          type: SiteType.Keep,
          owner: null,
          isConquered: false,
          isBurned: false,
        },
        rampagingEnemies: [], // NOT rampaging - these are site defenders
        enemies: [createHexEnemy(enemyToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: siteHex,
          },
        },
      };

      // Try to challenge from adjacent - should fail because they're not rampaging
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
        // Even with challenge flag, should fail for non-rampaging
      });

      // Should fail - can't challenge non-rampaging enemies from adjacent
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
      expect(result.state.combat).toBeNull();
    });

    /**
     * Rampaging enemies that are NOT adjacent cannot be challenged.
     * The player must be adjacent (1 hex away) to challenge.
     */
    it.skip("should REJECT challenging rampaging enemy from non-adjacent hex", () => {
      const rampagingToken = createEnemyTokenId(ENEMY_ORC_SUMMONERS);

      let state = createTestGameState();

      // Create hex with rampaging enemy at (3,0) - NOT adjacent to player at (0,0)
      const rampagingHex: HexState = {
        ...createTestHex(3, 0, TERRAIN_PLAINS),
        rampagingEnemies: [RampagingEnemyType.OrcMarauder],
        enemies: [createHexEnemy(rampagingToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 3, r: 0 })]: rampagingHex,
          },
        },
      };

      // Try to challenge from 3 hexes away - should fail
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      });

      // Should fail - too far away even for rampaging challenge
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
      expect(result.state.combat).toBeNull();
    });
  });

  describe("Ancient Ruins Edge Case - Non-rampaging creature types", () => {
    /**
     * IMPORTANT EDGE CASE:
     *
     * Ancient Ruins can spawn creatures that would normally be "rampaging types"
     * (like Orc Marauders), but when drawn for Ancient Ruins:
     * - They are placed in enemies[] but NOT in rampagingEnemies[]
     * - They are NOT considered rampaging for challenge purposes
     * - Player cannot challenge them from adjacent - must enter the site
     *
     * This is because "rampaging" is about HOW an enemy arrived on the map,
     * not WHAT type of creature it is.
     */
    it.skip("should REJECT challenging Ancient Ruins enemies even if they are rampaging creature types", () => {
      // Use an Orc Summoner - a creature that is normally rampaging
      // But when drawn for Ancient Ruins, it's NOT rampaging
      const orcToken = createEnemyTokenId(ENEMY_ORC_SUMMONERS);

      let state = createTestGameState();

      // Create Ancient Ruins hex with orc enemies - note NO rampagingEnemies!
      // This simulates enemies drawn when entering Ancient Ruins at night
      const ruinsHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        site: {
          type: SiteType.AncientRuins,
          owner: null,
          isConquered: false,
          isBurned: false,
        },
        rampagingEnemies: [], // CRITICAL: Empty even though enemy is "orc type"
        enemies: [createHexEnemy(orcToken)], // Enemy is here but NOT rampaging
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: ruinsHex,
          },
        },
      };

      // Try to challenge from adjacent - should FAIL
      // Even though the creature TYPE is "orc", it's not RAMPAGING
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      });

      // Should fail - these are site enemies, not rampaging enemies
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: INVALID_ACTION,
        })
      );
      expect(result.state.combat).toBeNull();

      // Player must use ENTER_SITE_ACTION to fight these enemies
    });

    /**
     * Contrast with actual rampaging orcs on an adjacent hex.
     */
    it.skip("should ALLOW challenging actual rampaging orcs from adjacent hex", () => {
      const orcToken = createEnemyTokenId(ENEMY_ORC_SUMMONERS);

      let state = createTestGameState();

      // Create hex with ACTUAL rampaging orcs - note rampagingEnemies is populated!
      const rampagingHex: HexState = {
        ...createTestHex(1, 0, TERRAIN_PLAINS),
        site: null, // No site - these are roaming rampaging enemies
        rampagingEnemies: [RampagingEnemyType.OrcMarauder], // CRITICAL: This makes them rampaging
        enemies: [createHexEnemy(orcToken)],
      };

      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
      });

      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
        map: {
          ...state.map,
          hexes: {
            ...state.map.hexes,
            [hexKey({ q: 1, r: 0 })]: rampagingHex,
          },
        },
      };

      // Challenge from adjacent - should SUCCEED
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC_SUMMONERS],
      });

      // Should succeed - these ARE rampaging enemies
      expect(result.state.combat).not.toBeNull();
    });
  });

  describe("Validation implementation notes", () => {
    /**
     * When implementing the fix, the validator should check:
     *
     * 1. For standard ENTER_COMBAT_ACTION (no challenge flag):
     *    - All enemyIds must correspond to enemies on the player's current hex
     *    - Reject if any enemy is not at player's location
     *
     * 2. For challenge action (new action or flag):
     *    - Target hex must be adjacent to player
     *    - Target hex must have rampagingEnemies[] populated
     *    - enemyIds must be from that hex's enemies[]
     *
     * Suggested validation codes:
     * - ENEMY_NOT_AT_LOCATION: "Enemy is not at your location"
     * - CANNOT_CHALLENGE_NON_RAMPAGING: "Can only challenge rampaging enemies from adjacent"
     * - TARGET_NOT_ADJACENT: "Target hex is not adjacent"
     * - NO_RAMPAGING_ENEMIES: "No rampaging enemies at target location"
     */
    it("documents the validation requirements", () => {
      // This test exists just to document the requirements
      // The actual validation will be implemented separately
      expect(true).toBe(true);
    });
  });
});
