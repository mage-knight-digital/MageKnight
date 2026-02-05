/**
 * Tests for Banner of Courage artifact
 *
 * Basic: Assign to a Unit. Once per Round (except combat), flip to Ready Unit.
 *        (Requires banner system from #211 - basic effect is NOOP placeholder)
 * Powered: Ready all Units you control (anytime except combat). Destroy artifact.
 *
 * FAQ S1: You can use this Banner to ready the Unit even while it is wounded.
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import type { ReadyAllUnitsEffect } from "../../types/cards.js";
import { EFFECT_READY_ALL_UNITS } from "../../types/effectTypes.js";
import { BANNER_OF_COURAGE_CARDS } from "../../data/artifacts/bannerOfCourage.js";
import {
  CARD_BANNER_OF_COURAGE,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import type { UnitId } from "@mage-knight/shared";
import { UNITS } from "@mage-knight/shared";
import { DEED_CARD_TYPE_ARTIFACT, CATEGORY_HEALING } from "../../types/cards.js";
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

describe("Banner of Courage", () => {
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = BANNER_OF_COURAGE_CARDS[CARD_BANNER_OF_COURAGE];
      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_BANNER_OF_COURAGE);
      expect(card.name).toBe("Banner of Courage");
      expect(card.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
      expect(card.categories).toEqual([CATEGORY_HEALING]);
      expect(card.sidewaysValue).toBe(1);
    });

    it("should be powered by any basic mana color", () => {
      const card = BANNER_OF_COURAGE_CARDS[CARD_BANNER_OF_COURAGE];
      expect(card.poweredBy).toContain(MANA_RED);
      expect(card.poweredBy).toContain(MANA_BLUE);
      expect(card.poweredBy).toContain(MANA_GREEN);
      expect(card.poweredBy).toContain(MANA_WHITE);
    });

    it("should be destroyed after powered effect", () => {
      const card = BANNER_OF_COURAGE_CARDS[CARD_BANNER_OF_COURAGE];
      expect(card.destroyOnPowered).toBe(true);
    });

    it("should have ready all units as powered effect", () => {
      const card = BANNER_OF_COURAGE_CARDS[CARD_BANNER_OF_COURAGE];
      expect(card.poweredEffect.type).toBe(EFFECT_READY_ALL_UNITS);
    });
  });

  describe("Powered Effect - EFFECT_READY_ALL_UNITS", () => {
    const effect: ReadyAllUnitsEffect = { type: EFFECT_READY_ALL_UNITS };

    describe("isEffectResolvable", () => {
      it("should return false when player has no units", () => {
        const state = createTestStateWithUnits([]);
        expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
      });

      it("should return false when all units are already ready", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
          createUnit(unitId, "unit-2", UNIT_STATE_READY, true),
        ]);
        expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
      });

      it("should return true when player has spent units", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        ]);
        expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
      });

      it("should return true when player has spent wounded units", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
        ]);
        expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
      });
    });

    describe("resolveEffect", () => {
      it("should ready all spent units", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
          createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
      });

      it("should ready units of any level", () => {
        const unitIdLevel1 = getUnitIdOfLevel(1);
        const unitIdLevel2 = getUnitIdOfLevel(2);
        const unitIdLevel3 = getUnitIdOfLevel(3);
        const state = createTestStateWithUnits([
          createUnit(unitIdLevel1, "unit-1", UNIT_STATE_SPENT, false),
          createUnit(unitIdLevel2, "unit-2", UNIT_STATE_SPENT, false),
          createUnit(unitIdLevel3, "unit-3", UNIT_STATE_SPENT, false),
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[2].state).toBe(UNIT_STATE_READY);
      });

      it("should work on wounded units (FAQ S1)", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
          createUnit(unitId, "unit-2", UNIT_STATE_SPENT, true),
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        // Both should be readied
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
        // But wounds should remain
        expect(result.state.players[0].units[0].wounded).toBe(true);
        expect(result.state.players[0].units[1].wounded).toBe(true);
      });

      it("should not change ready units", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
          createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
      });

      it("should return no-op when no spent units exist", () => {
        const state = createTestStateWithUnits([]);

        const result = resolveEffect(state, state.players[0].id, effect);

        expect(result.description).toContain("No spent units");
      });

      it("should include count in description", () => {
        const unitId = getUnitIdOfLevel(1);
        const state = createTestStateWithUnits([
          createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
          createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
          createUnit(unitId, "unit-3", UNIT_STATE_SPENT, true),
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        expect(result.description).toContain("3");
      });

      it("should handle mixed ready/spent/wounded states", () => {
        const unitIdLevel1 = getUnitIdOfLevel(1);
        const unitIdLevel2 = getUnitIdOfLevel(2);
        const state = createTestStateWithUnits([
          createUnit(unitIdLevel1, "unit-1", UNIT_STATE_READY, false), // ready, not wounded
          createUnit(unitIdLevel1, "unit-2", UNIT_STATE_SPENT, false), // spent, not wounded
          createUnit(unitIdLevel2, "unit-3", UNIT_STATE_SPENT, true), // spent, wounded
          createUnit(unitIdLevel1, "unit-4", UNIT_STATE_READY, true), // ready, wounded
        ]);

        const result = resolveEffect(state, state.players[0].id, effect);

        // Ready units stay ready
        expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[0].wounded).toBe(false);

        // Spent units become ready
        expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[1].wounded).toBe(false);

        // Spent+wounded becomes ready+wounded
        expect(result.state.players[0].units[2].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[2].wounded).toBe(true);

        // Ready+wounded stays ready+wounded
        expect(result.state.players[0].units[3].state).toBe(UNIT_STATE_READY);
        expect(result.state.players[0].units[3].wounded).toBe(true);
      });
    });

    describe("describeEffect", () => {
      it("should describe as 'Ready all Units'", () => {
        expect(describeEffect(effect)).toBe("Ready all Units");
      });
    });
  });
});
