/**
 * Tests for the EFFECT_READY_UNIT effect
 *
 * Per card text (e.g., Rejuvenate): "ready a level I or II Unit"
 * - Readying targets Spent units only (can't ready an already-ready unit)
 * - Wound status is irrelevant - you can ready a unit whether wounded or not
 * - After readying, the unit becomes Ready (wound status unchanged)
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable } from "../effects/resolveEffect.js";
import { describeEffect } from "../effects/describeEffect.js";
import type { ReadyUnitEffect } from "../../types/cards.js";
import { EFFECT_READY_UNIT } from "../../types/effectTypes.js";
import { UNIT_STATE_READY, UNIT_STATE_SPENT, UNITS, type UnitId } from "@mage-knight/shared";
import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";

// Helper to create test game state with units
function createTestStateWithUnits(units: PlayerUnit[]): GameState {
  const state = createInitialGameState({ playerCount: 1 });
  return {
    ...state,
    players: [
      {
        ...state.players[0],
        units,
      },
    ],
  };
}

// Helper to create a unit with specific state
function createUnit(
  unitId: UnitId,
  instanceId: string,
  state: typeof UNIT_STATE_READY | typeof UNIT_STATE_SPENT,
  wounded: boolean
): PlayerUnit {
  return {
    instanceId,
    unitId,
    state,
    wounded,
    usedResistanceThisCombat: false,
  };
}

// Get unit IDs of different levels for testing
function getUnitIdOfLevel(level: number): UnitId {
  const unitEntry = Object.entries(UNITS).find(([_, def]) => def.level === level);
  if (!unitEntry) {
    throw new Error(`No unit found with level ${level}`);
  }
  return unitEntry[0] as UnitId;
}

describe("EFFECT_READY_UNIT", () => {
  describe("isEffectResolvable", () => {
    it("should return false when player has no units", () => {
      const state = createTestStateWithUnits([]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when all units are Ready (regardless of wound status)", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
        createUnit(unitId, "unit-2", UNIT_STATE_READY, true), // wounded but ready
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return true when player has Spent units (unwounded)", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return true when player has Spent units (wounded)", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should respect maxLevel restriction - level 2 unit not eligible for maxLevel 1", () => {
      const unitIdLevel2 = getUnitIdOfLevel(2);
      const state = createTestStateWithUnits([
        createUnit(unitIdLevel2, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 1 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should respect maxLevel restriction - level 2 unit eligible for maxLevel 2", () => {
      const unitIdLevel2 = getUnitIdOfLevel(2);
      const state = createTestStateWithUnits([
        createUnit(unitIdLevel2, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 2 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should respect maxLevel restriction - level 1 unit eligible for maxLevel 2", () => {
      const unitIdLevel1 = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitIdLevel1, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 2 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return true when at least one Spent unit exists among many Ready units", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
        createUnit(unitId, "unit-2", UNIT_STATE_READY, true),
        createUnit(unitId, "unit-3", UNIT_STATE_SPENT, false), // ELIGIBLE
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });
  });

  describe("resolveEffect", () => {
    it("should ready a Spent unit - changes Spent → Ready", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      const result = resolveEffect(state, state.players[0].id, effect);

      const updatedUnit = result.state.players[0].units[0];
      expect(updatedUnit.state).toBe(UNIT_STATE_READY);
      expect(updatedUnit.wounded).toBe(false);
      expect(result.description).toContain("Readied");
    });

    it("should ready a Spent+Wounded unit - stays wounded after readying", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      const result = resolveEffect(state, state.players[0].id, effect);

      const updatedUnit = result.state.players[0].units[0];
      expect(updatedUnit.state).toBe(UNIT_STATE_READY);
      expect(updatedUnit.wounded).toBe(true); // Wound status unchanged
    });

    it("should auto-resolve when only one Spent unit is available", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_READY, false), // Not spent, not eligible
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });

    it("should require choice when multiple Spent units are available", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, true),
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.description).toContain("Choose");
    });

    it("should return no-op when no eligible units exist", () => {
      const state = createTestStateWithUnits([]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.description).toContain("No spent units");
    });

    it("should not ready units above maxLevel", () => {
      const unitIdLevel1 = getUnitIdOfLevel(1);
      const unitIdLevel3 = getUnitIdOfLevel(3);
      const state = createTestStateWithUnits([
        createUnit(unitIdLevel3, "unit-1", UNIT_STATE_SPENT, false), // Level 3, not eligible for maxLevel 2
        createUnit(unitIdLevel1, "unit-2", UNIT_STATE_SPENT, false), // Level 1, eligible
      ]);
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 2 };

      const result = resolveEffect(state, state.players[0].id, effect);

      // Should auto-resolve to the level 1 unit only
      expect(result.requiresChoice).toBeFalsy();
      expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY); // unit-2 readied
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT); // unit-1 still spent
    });
  });

  describe("describeEffect", () => {
    it("should describe maxLevel 1 as Level I", () => {
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 1 };
      expect(describeEffect(effect)).toBe("Ready a Level I Unit");
    });

    it("should describe maxLevel 2 as Level I/II", () => {
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 2 };
      expect(describeEffect(effect)).toBe("Ready a Level I/II Unit");
    });

    it("should describe maxLevel 3 as Level I/II/III", () => {
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 3 };
      expect(describeEffect(effect)).toBe("Ready a Level I/II/III Unit");
    });

    it("should describe maxLevel 4 as Level I/II/III/IV", () => {
      const effect: ReadyUnitEffect = { type: EFFECT_READY_UNIT, maxLevel: 4 };
      expect(describeEffect(effect)).toBe("Ready a Level I/II/III/IV Unit");
    });
  });
});
