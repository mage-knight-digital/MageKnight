/**
 * Knockout Tests
 *
 * Tests for:
 * - Knockout triggers when wounds >= hand limit
 * - Discards all non-wound cards from hand on knockout
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  END_COMBAT_PHASE_ACTION,
  ASSIGN_DAMAGE_ACTION,
  PLAYER_KNOCKED_OUT,
  ENEMY_GUARDSMEN,
} from "@mage-knight/shared";
import { resetTokenCounter } from "../helpers/enemy/index.js";

describe("Knockout", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
    resetTokenCounter();
  });

  describe("Knockout - discards non-wound cards from hand", () => {
    /**
     * Per rulebook: "If the number of Wound cards added to your hand during a combat
     * equals or exceeds your unmodified Hand limit, you are knocked out – immediately
     * discard all non-Wound cards from your hand."
     *
     * This test verifies:
     * 1. When wounds received in a single combat >= hand limit, knock out triggers
     * 2. All non-wound cards are discarded from hand immediately
     * 3. Only wound cards remain in hand after knock out
     */
    it("should discard all non-wound cards when knocked out", () => {
      let state = createTestGameState();

      // Player with 5 cards in hand, hand limit 5, armor 2
      // Need to take 5+ wounds to knock out
      // An enemy with attack 10 vs armor 2 = 5 wounds
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hand: ["march", "rage", "stamina", "swiftness", "promise"], // 5 cards
        deck: ["concentration"],
        handLimit: 5,
        armor: 2,
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat with an enemy that deals enough damage for knock out
      // We'll use two Guardsmen (attack 3 each = 6 total)
      // But since we're testing a single damage assignment, we need a high-attack enemy
      // Let's create a combat with an enemy we know the stats for
      // Guardsmen has attack 3, armor 4
      // 3 damage / armor 2 = 2 wounds per Guardsmen
      // Need 3 Guardsmen or a stronger enemy...

      // Actually, let's enter combat manually with multiple enemies
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN, ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Skip ranged phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Skip block phase (don't block - take all damage)
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage from first enemy (attack 3 / armor 2 = 2 wounds)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });
      state = result.state;

      // Check wounds so far (should be 2)
      expect(state.combat?.woundsThisCombat).toBe(2);
      expect(state.players[0].knockedOut).toBe(false); // Not knocked out yet

      // Assign damage from second enemy (attack 3 / armor 2 = 2 more wounds = 4 total)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
      });
      state = result.state;

      // Still not knocked out (4 < 5)
      expect(state.combat?.woundsThisCombat).toBe(4);
      expect(state.players[0].knockedOut).toBe(false);

      // Hand should still have the original 5 cards + 4 wounds = 9 cards
      expect(state.players[0].hand.length).toBe(9);
      expect(state.players[0].hand.filter((c) => c === "wound").length).toBe(4);
    });

    it("should trigger knock out when wounds this combat reach hand limit", () => {
      let state = createTestGameState();

      // Use a player with hand limit 3 to make knock out easier to trigger
      const player = createTestPlayer({
        id: "player1",
        position: { q: 0, r: 0 },
        hand: ["march", "rage", "stamina"], // 3 cards
        deck: ["concentration"],
        handLimit: 3,
        armor: 1, // Low armor so each attack causes more wounds
      });
      state = {
        ...state,
        players: [player],
        turnOrder: ["player1"],
      };

      // Enter combat with Guardsmen (attack 3)
      // 3 damage / armor 1 = 3 wounds = knock out threshold
      let result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_GUARDSMEN],
      });
      state = result.state;

      // Skip to damage phase
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;
      result = engine.processAction(state, "player1", {
        type: END_COMBAT_PHASE_ACTION,
      });
      state = result.state;

      // Assign damage (3 wounds will trigger knock out)
      result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_0",
      });

      const finalPlayer = result.state.players[0];

      // Should be knocked out
      expect(finalPlayer.knockedOut).toBe(true);
      expect(result.state.combat?.woundsThisCombat).toBe(3);

      // KEY ASSERTION: Hand should contain ONLY wounds (3 wounds)
      // All original cards (march, rage, stamina) should be discarded
      expect(finalPlayer.hand.length).toBe(3);
      expect(finalPlayer.hand.every((c) => c === "wound")).toBe(true);

      // Original cards should be in discard pile
      expect(finalPlayer.discard).toContain("march");
      expect(finalPlayer.discard).toContain("rage");
      expect(finalPlayer.discard).toContain("stamina");

      // Should emit PLAYER_KNOCKED_OUT event
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: PLAYER_KNOCKED_OUT,
          playerId: "player1",
          woundsThisCombat: 3,
        })
      );
    });
  });
});
