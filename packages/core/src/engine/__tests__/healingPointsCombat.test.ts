/**
 * Healing Points Combat Entry Tests
 *
 * Per rulebook line 929: "Any unspent Healing points disappear when entering combat."
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine, MageKnightEngine } from "../MageKnightEngine.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  ENTER_COMBAT_ACTION,
  ENEMY_ORC,
  UNDO_ACTION,
} from "@mage-knight/shared";

describe("Healing Points Combat Entry", () => {
  let engine: MageKnightEngine;

  beforeEach(() => {
    engine = createEngine();
  });

  describe("clearing healing points on combat entry", () => {
    it("should clear healing points when entering combat", () => {
      // Arrange: player has accumulated healing points
      const player = createTestPlayer({
        healingPoints: 3,
      });

      const state = createTestGameState({
        players: [player],
      });

      // Sanity check: player has healing points before combat
      expect(state.players[0].healingPoints).toBe(3);

      // Act: enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      });

      // Assert: healing points should be cleared
      expect(result.state.players[0].healingPoints).toBe(0);
    });

    it("should not affect player with zero healing points", () => {
      // Arrange: player has no healing points
      const player = createTestPlayer({
        healingPoints: 0,
      });

      const state = createTestGameState({
        players: [player],
      });

      // Act: enter combat
      const result = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      });

      // Assert: healing points should still be 0
      expect(result.state.players[0].healingPoints).toBe(0);
    });

    it("should restore healing points on combat undo", () => {
      // Arrange: player has accumulated healing points
      const player = createTestPlayer({
        healingPoints: 5,
      });

      const state = createTestGameState({
        players: [player],
      });

      // Act: enter combat, then undo
      const combatResult = engine.processAction(state, "player1", {
        type: ENTER_COMBAT_ACTION,
        enemyIds: [ENEMY_ORC],
      });

      // Verify healing points are cleared
      expect(combatResult.state.players[0].healingPoints).toBe(0);

      // Undo the combat entry
      const undoResult = engine.processAction(
        combatResult.state,
        "player1",
        { type: UNDO_ACTION }
      );

      // Assert: healing points should be restored
      expect(undoResult.state.players[0].healingPoints).toBe(5);
    });
  });
});
