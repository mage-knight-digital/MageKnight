/**
 * Unit Disbanding on Recruitment tests
 *
 * Tests for disbanding a unit when recruiting at the command limit.
 * Per the rulebook, players can recruit when at their command limit
 * by disbanding an existing unit to make room.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createVillageSite,
} from "./testHelpers.js";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_RECRUITED,
  UNIT_DISBANDED,
  INVALID_ACTION,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  UNDO_ACTION,
  TERRAIN_PLAINS,
  hexKey,
} from "@mage-knight/shared";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import { getUnitOptions } from "../validActions/units/recruitment.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";

/**
 * Create a state at a village with units in the unit offer.
 * Standard createStateWithVillage doesn't populate the offers.
 */
function createVillageStateWithOffer(
  playerOverrides: Partial<Player> = {},
  offerUnits = [UNIT_PEASANTS, UNIT_FORESTERS, UNIT_PEASANTS]
): GameState {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    ...playerOverrides,
  });

  const hexWithVillage = createTestHex(0, 0, TERRAIN_PLAINS, createVillageSite());

  const state = createTestGameState({
    players: [player],
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: hexWithVillage,
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });

  // Add units to the offer
  return {
    ...state,
    offers: {
      ...state.offers,
      units: offerUnits,
    },
  };
}

describe("Unit Disbanding on Recruitment", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("recruiting at command limit with disband", () => {
    it("should allow recruitment when disbanding a unit at command limit", () => {
      const existingUnit = createPlayerUnit(UNIT_FORESTERS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1, // 1 slot, already full
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
        disbandUnitInstanceId: "existing_1",
      });

      // Should have 1 unit: the newly recruited one (old one was disbanded)
      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);

      // Check disband event was emitted before recruit event
      const disbandEvent = result.events.find(
        (e) => e.type === UNIT_DISBANDED
      );
      expect(disbandEvent).toBeDefined();
      if (disbandEvent && disbandEvent.type === UNIT_DISBANDED) {
        expect(disbandEvent.unitInstanceId).toBe("existing_1");
      }

      // Check recruit event was emitted
      const recruitEvent = result.events.find(
        (e) => e.type === UNIT_RECRUITED
      );
      expect(recruitEvent).toBeDefined();
    });

    it("should reject recruitment at command limit without disband", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // Should still have only the original unit
      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].instanceId).toBe("existing_1");

      // Check for invalid action event
      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("disband");
      }
    });

    it("should reject disband of a unit not owned by the player", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
        disbandUnitInstanceId: "nonexistent_unit",
      });

      // Should still have only the original unit
      expect(result.state.players[0].units).toHaveLength(1);

      const invalidEvent = result.events.find(
        (e) => e.type === INVALID_ACTION
      );
      expect(invalidEvent).toBeDefined();
    });

    it("should not require disband when command slots are available", () => {
      const state = createVillageStateWithOffer({
        units: [],
        commandTokens: 1,
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // Should recruit normally without needing disband
      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);
    });
  });

  describe("disbanded unit is permanently removed", () => {
    it("should remove disbanded unit from player completely", () => {
      const unit1 = createPlayerUnit(UNIT_PEASANTS, "unit_a");
      const unit2 = createPlayerUnit(UNIT_FORESTERS, "unit_b");
      const state = createVillageStateWithOffer({
        units: [unit1, unit2],
        commandTokens: 2, // Both slots full
      });

      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
        disbandUnitInstanceId: "unit_a",
      });

      // Should have 2 units: unit_b (kept) + newly recruited
      expect(result.state.players[0].units).toHaveLength(2);
      expect(
        result.state.players[0].units.find((u) => u.instanceId === "unit_a")
      ).toBeUndefined();
      expect(
        result.state.players[0].units.find((u) => u.instanceId === "unit_b")
      ).toBeDefined();
    });
  });

  describe("valid actions show requiresDisband", () => {
    it("should set requiresDisband when at command limit", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1,
        influencePoints: 10,
      });

      const options = getUnitOptions(state, state.players[0]);
      expect(options).toBeDefined();
      if (options) {
        for (const unit of options.recruitable) {
          expect(unit.requiresDisband).toBe(true);
          expect(unit.canAfford).toBe(true);
        }
      }
    });

    it("should not set requiresDisband when slots are available", () => {
      const state = createVillageStateWithOffer({
        units: [],
        commandTokens: 1,
        influencePoints: 10,
      });

      const options = getUnitOptions(state, state.players[0]);
      expect(options).toBeDefined();
      if (options) {
        for (const unit of options.recruitable) {
          expect(unit.requiresDisband).toBe(false);
        }
      }
    });

    it("should show canAfford=true at command limit when player has enough influence", () => {
      const existingUnit = createPlayerUnit(UNIT_PEASANTS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1,
        influencePoints: 10,
      });

      const options = getUnitOptions(state, state.players[0]);
      expect(options).toBeDefined();
      if (options) {
        const peasantOption = options.recruitable.find(
          (u) => u.unitId === UNIT_PEASANTS
        );
        expect(peasantOption).toBeDefined();
        if (peasantOption) {
          expect(peasantOption.canAfford).toBe(true);
          expect(peasantOption.requiresDisband).toBe(true);
        }
      }
    });
  });

  describe("undo support", () => {
    it("should restore disbanded unit on undo", () => {
      const existingUnit = createPlayerUnit(UNIT_FORESTERS, "existing_1");
      const state = createVillageStateWithOffer({
        units: [existingUnit],
        commandTokens: 1,
      });

      // Recruit with disband
      const result = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
        disbandUnitInstanceId: "existing_1",
      });

      expect(result.state.players[0].units).toHaveLength(1);
      expect(result.state.players[0].units[0].unitId).toBe(UNIT_PEASANTS);

      // Undo by sending UNDO action
      const undoResult = engine.processAction(result.state, "player1", {
        type: UNDO_ACTION,
      });

      // Original unit should be restored
      expect(undoResult.state.players[0].units).toHaveLength(1);
      expect(
        undoResult.state.players[0].units.find(
          (u) => u.instanceId === "existing_1"
        )
      ).toBeDefined();
      expect(undoResult.state.players[0].units[0].unitId).toBe(UNIT_FORESTERS);
    });
  });
});
