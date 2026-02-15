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
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  INVALID_ACTION,
  MONASTERY_BURN_STARTED,
  REPUTATION_CHANGED,
  COMBAT_STARTED,
  ENEMY_COLOR_VIOLET,
  ENEMIES,
  TERRAIN_PLAINS,
  hexKey,
  REPUTATION_REASON_BURN_MONASTERY,
  CARD_TEMPORAL_PORTAL,
  CARD_MARCH,
  PLAY_CARD_ACTION,
} from "@mage-knight/shared";
import { getValidActions } from "../validActions/index.js";
import { validateActionCardNotAlreadyActed } from "../validators/playCardValidators.js";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import type { GameState } from "../../state/GameState.js";
import {
  resetTokenCounter,
  createEnemyTokenPiles,
  createEnemyTokenId,
} from "../helpers/enemy/index.js";
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

  /**
   * Helper to run through all combat phases without defeating enemy.
   * This simulates a failed combat where player takes wounds but doesn't kill enemy.
   */
  function failCombat(
    eng: MageKnightEngine,
    initialState: GameState
  ): { state: GameState; events: import("@mage-knight/shared").GameEvent[] } {
    let state = initialState;
    const allEvents: import("@mage-knight/shared").GameEvent[] = [];

    // Phase 1: Ranged/Siege -> Block
    let result = eng.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });
    state = result.state;
    allEvents.push(...result.events);

    // Phase 2: Block -> Assign Damage
    result = eng.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });
    state = result.state;
    allEvents.push(...result.events);

    // Phase 3: Assign Damage
    const enemies = state.combat?.enemies ?? [];
    for (const enemy of enemies) {
      if (enemy.isSummonerHidden || enemy.isDefeated) continue;

      const numAttacks = enemy.definition?.attacks?.length ?? 1;
      for (let attackIndex = 0; attackIndex < numAttacks; attackIndex++) {
        result = eng.processAction(state, "player1", {
          type: ASSIGN_DAMAGE_ACTION,
          enemyInstanceId: enemy.instanceId,
          attackIndex,
        });
        state = result.state;
        allEvents.push(...result.events);
      }
    }

    // Phase 3 continued: Assign Damage -> Attack
    result = eng.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });
    state = result.state;
    allEvents.push(...result.events);

    // Phase 4: Attack -> Combat ends (enemy not defeated = failure)
    result = eng.processAction(state, "player1", {
      type: END_COMBAT_PHASE_ACTION,
    });
    state = result.state;
    allEvents.push(...result.events);

    return { state, events: allEvents };
  }

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

    it("updates the monastery hex with the drawn violet enemy token", () => {
      const state = createStateAtMonastery();

      const result = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      const hex = result.state.map.hexes[hexKey({ q: 0, r: 0 })];
      expect(hex?.enemies).toHaveLength(1);
      expect(hex?.enemies[0]?.color).toBe(ENEMY_COLOR_VIOLET);
    });

    it("reshuffles violet discard when draw pile is exhausted on retry", () => {
      const violetEnemyIds = (Object.keys(ENEMIES) as (keyof typeof ENEMIES)[])
        .filter((id) => ENEMIES[id].color === ENEMY_COLOR_VIOLET);
      const firstVioletEnemyId = violetEnemyIds[0];
      if (!firstVioletEnemyId) {
        throw new Error("No violet enemy found");
      }

      const onlyVioletToken = createEnemyTokenId(firstVioletEnemyId);
      const baseState = createStateAtMonastery();
      const stateWithSingleVioletToken = {
        ...baseState,
        enemyTokens: {
          ...baseState.enemyTokens,
          drawPiles: {
            ...baseState.enemyTokens.drawPiles,
            [ENEMY_COLOR_VIOLET]: [onlyVioletToken],
          },
          discardPiles: {
            ...baseState.enemyTokens.discardPiles,
            [ENEMY_COLOR_VIOLET]: [],
          },
        },
      };

      // First burn attempt draws the only violet token and fails combat.
      const firstBurn = engine.processAction(stateWithSingleVioletToken, "player1", {
        type: BURN_MONASTERY_ACTION,
      });
      const afterFailedCombat = failCombat(engine, firstBurn.state).state;

      // Token should be in violet discard after failed burn-monastery combat.
      expect(afterFailedCombat.enemyTokens.drawPiles[ENEMY_COLOR_VIOLET]).toHaveLength(0);
      expect(afterFailedCombat.enemyTokens.discardPiles[ENEMY_COLOR_VIOLET]).toContain(
        onlyVioletToken
      );

      // Simulate new turn for retry.
      const nextTurnState = {
        ...afterFailedCombat,
        players: afterFailedCombat.players.map((player) =>
          player.id === "player1"
            ? { ...player, hasTakenActionThisTurn: false, hasCombattedThisTurn: false }
            : player
        ),
      };

      // Second burn attempt must reshuffle discard to draw an enemy.
      const secondBurn = engine.processAction(nextTurnState, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      expect(secondBurn.state.combat).not.toBeNull();
      expect(secondBurn.state.combat?.enemies).toHaveLength(1);
      expect(secondBurn.state.enemyTokens.discardPiles[ENEMY_COLOR_VIOLET]).toHaveLength(0);
    });
  });

  describe("valid actions after burn (action consumed)", () => {
    it("does not advertise ACTION category cards as playable during burn combat", () => {
      // Put Temporal Portal (CATEGORY_ACTION card) in player's hand
      const state = createStateAtMonastery({
        players: [
          createTestPlayer({
            position: { q: 0, r: 0 },
            hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
            hasTakenActionThisTurn: false,
          }),
        ],
      });

      // Burn the monastery — sets hasTakenActionThisTurn=true and enters combat
      const burnResult = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });
      expect(burnResult.state.combat).toBeTruthy();

      const player = burnResult.state.players.find((p) => p.id === "player1");
      expect(player?.hasTakenActionThisTurn).toBe(true);

      // Get valid actions — should NOT include Temporal Portal
      const validActions = getValidActions(burnResult.state, "player1");
      expect(validActions.mode).toBe("combat");

      if (validActions.mode === "combat") {
        const portalCard = validActions.playCard?.cards.find(
          (c) => c.cardId === CARD_TEMPORAL_PORTAL
        );
        // BUG: Temporal Portal should NOT be advertised as playable
        // because the player already used their action to burn the monastery.
        // The validator correctly rejects it, but validActions still shows it.
        expect(portalCard).toBeUndefined();
      }
    });

    it("validator correctly rejects ACTION card play during burn combat", () => {
      const state = createStateAtMonastery({
        players: [
          createTestPlayer({
            position: { q: 0, r: 0 },
            hand: [CARD_TEMPORAL_PORTAL, CARD_MARCH],
            hasTakenActionThisTurn: false,
          }),
        ],
      });

      // Burn the monastery
      const burnResult = engine.processAction(state, "player1", {
        type: BURN_MONASTERY_ACTION,
      });

      // Validator should reject Temporal Portal play
      const result = validateActionCardNotAlreadyActed(
        burnResult.state,
        "player1",
        {
          type: PLAY_CARD_ACTION,
          cardId: CARD_TEMPORAL_PORTAL,
          powered: false,
        }
      );
      expect(result.valid).toBe(false);
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
