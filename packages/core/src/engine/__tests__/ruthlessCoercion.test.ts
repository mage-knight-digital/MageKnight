/**
 * Tests for Krang's Ruthless Coercion card
 *
 * Basic: Influence 2. You may get a discount of 2 towards the cost of
 *   recruiting one Unit. If you recruit that unit this turn, Reputation -1.
 *
 * Powered (Red): Influence 6. Reputation -1. You may ready Level I and II
 *   Units you control by paying 2 Influence per level of Unit.
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import type {
  RecruitDiscountEffect,
  ReadyUnitsForInfluenceEffect,
  ResolveReadyUnitForInfluenceEffect,
  CompoundEffect,
  NoopEffect,
} from "../../types/cards.js";
import {
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_READY_UNITS_FOR_INFLUENCE,
  EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
  EFFECT_NOOP,
  EFFECT_COMPOUND,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_CHANGE_REPUTATION,
} from "../../types/effectTypes.js";
import {
  EFFECT_RECRUIT_DISCOUNT,
} from "../../types/modifierConstants.js";
import type { RecruitDiscountModifier } from "../../types/modifiers.js";
import {
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNITS,
  type UnitId,
} from "@mage-knight/shared";
import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";
import { KRANG_RUTHLESS_COERCION } from "../../data/basicActions/red/krang-ruthless-coercion.js";
import {
  createRecruitUnitCommand,
  resetUnitInstanceCounter,
} from "../commands/units/recruitUnitCommand.js";
import { getActiveRecruitDiscount } from "../rules/unitRecruitment.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

// Helper to create test game state with units and influence
function createTestState(
  units: PlayerUnit[] = [],
  influencePoints: number = 0,
): GameState {
  const state = createInitialGameState({ playerCount: 1 });
  return {
    ...state,
    players: [
      {
        ...state.players[0],
        units,
        influencePoints,
      },
    ],
  };
}

// Helper to create a unit with specific state
function createUnit(
  unitId: UnitId,
  instanceId: string,
  unitState: typeof UNIT_STATE_READY | typeof UNIT_STATE_SPENT,
  wounded: boolean = false,
): PlayerUnit {
  return {
    instanceId,
    unitId,
    state: unitState,
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

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Ruthless Coercion card definition", () => {
  it("should have correct categories (influence + healing for powered)", () => {
    expect(KRANG_RUTHLESS_COERCION.categories).toContain("influence");
    expect(KRANG_RUTHLESS_COERCION.poweredEffectCategories).toContain("influence");
    expect(KRANG_RUTHLESS_COERCION.poweredEffectCategories).toContain("healing");
  });

  it("should have basic effect as compound of influence(2) + recruit discount", () => {
    const basic = KRANG_RUTHLESS_COERCION.basicEffect;
    expect(basic.type).toBe(EFFECT_COMPOUND);
    const compound = basic as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_APPLY_RECRUIT_DISCOUNT);
  });

  it("should have powered effect as compound of influence(6) + rep(-1) + ready", () => {
    const powered = KRANG_RUTHLESS_COERCION.poweredEffect;
    expect(powered.type).toBe(EFFECT_COMPOUND);
    const compound = powered as CompoundEffect;
    expect(compound.effects).toHaveLength(3);
    expect(compound.effects[0].type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(compound.effects[1].type).toBe(EFFECT_CHANGE_REPUTATION);
    expect(compound.effects[2].type).toBe(EFFECT_READY_UNITS_FOR_INFLUENCE);
  });
});

// ============================================================================
// RECRUIT DISCOUNT EFFECT TESTS
// ============================================================================

describe("EFFECT_APPLY_RECRUIT_DISCOUNT", () => {
  const effect: RecruitDiscountEffect = {
    type: EFFECT_APPLY_RECRUIT_DISCOUNT,
    discount: 2,
    reputationChange: -1,
  };

  describe("resolveEffect", () => {
    it("should add a recruit discount modifier to active modifiers", () => {
      const state = createTestState();
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.activeModifiers).toHaveLength(1);
      const modifier = result.state.activeModifiers[0];
      expect(modifier.effect.type).toBe(EFFECT_RECRUIT_DISCOUNT);
      const discountEffect = modifier.effect as RecruitDiscountModifier;
      expect(discountEffect.discount).toBe(2);
      expect(discountEffect.reputationChange).toBe(-1);
    });

    it("should set modifier duration to turn", () => {
      const state = createTestState();
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.activeModifiers[0].duration).toBe("turn");
    });

    it("should include description mentioning discount and rep change", () => {
      const state = createTestState();
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.description).toContain("2");
      expect(result.description).toContain("-1");
    });
  });

  describe("isEffectResolvable", () => {
    it("should always be resolvable", () => {
      const state = createTestState();
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });
  });

  describe("describeEffect", () => {
    it("should describe the discount and reputation change", () => {
      const desc = describeEffect(effect);
      expect(desc).toContain("2");
      expect(desc).toContain("-1");
    });
  });
});

// ============================================================================
// READY UNITS FOR INFLUENCE EFFECT TESTS
// ============================================================================

describe("EFFECT_READY_UNITS_FOR_INFLUENCE", () => {
  const effect: ReadyUnitsForInfluenceEffect = {
    type: EFFECT_READY_UNITS_FOR_INFLUENCE,
    maxLevel: 2,
    costPerLevel: 2,
  };

  describe("isEffectResolvable", () => {
    it("should return false when no units", () => {
      const state = createTestState([], 10);
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when all units are ready", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitId, "u1", UNIT_STATE_READY),
      ], 10);
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when spent units are above maxLevel", () => {
      const unitIdL3 = getUnitIdOfLevel(3);
      const state = createTestState([
        createUnit(unitIdL3, "u1", UNIT_STATE_SPENT),
      ], 10);
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when insufficient influence", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitId, "u1", UNIT_STATE_SPENT),
      ], 1); // L1 costs 2 influence, only have 1
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return true when L1 spent unit and enough influence", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitId, "u1", UNIT_STATE_SPENT),
      ], 2);
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return true when L2 spent unit and enough influence", () => {
      const unitId = getUnitIdOfLevel(2);
      const state = createTestState([
        createUnit(unitId, "u1", UNIT_STATE_SPENT),
      ], 4); // L2 costs 2*2=4 influence
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });
  });

  describe("resolveEffect", () => {
    it("should return no-op when no eligible units", () => {
      const state = createTestState([], 10);
      const result = resolveEffect(state, state.players[0].id, effect);
      expect(result.description).toContain("No spent units");
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should present choice options including Done", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitId, "u1", UNIT_STATE_SPENT),
      ], 10);
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toBeDefined();
      // Should have 1 unit option + 1 Done option
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitForInfluenceEffect;
      expect(unitOption.type).toBe(EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE);
      expect(unitOption.unitInstanceId).toBe("u1");
      expect(unitOption.influenceCost).toBe(2); // L1 * 2 cost/level

      const doneOption = result.dynamicChoiceOptions![1] as NoopEffect;
      expect(doneOption.type).toBe(EFFECT_NOOP);
    });

    it("should show multiple unit options when multiple spent units", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const unitIdL2 = getUnitIdOfLevel(2);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL2, "u2", UNIT_STATE_SPENT),
      ], 10);
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // 2 unit options + Done
      expect(result.dynamicChoiceOptions).toHaveLength(3);
    });

    it("should filter out units player cannot afford", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const unitIdL2 = getUnitIdOfLevel(2);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL2, "u2", UNIT_STATE_SPENT), // Costs 4, can't afford
      ], 3); // Only 3 influence: can afford L1 (2) but not L2 (4)
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // Only L1 unit + Done
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitForInfluenceEffect;
      expect(unitOption.unitInstanceId).toBe("u1");
    });

    it("should filter out L3+ units even with enough influence", () => {
      const unitIdL3 = getUnitIdOfLevel(3);
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL3, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
      ], 20);
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // Only L1 unit + Done (L3 filtered by maxLevel)
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitForInfluenceEffect;
      expect(unitOption.unitInstanceId).toBe("u2");
    });
  });

  describe("describeEffect", () => {
    it("should describe the ready effect with levels and cost", () => {
      const desc = describeEffect(effect);
      expect(desc).toContain("I/II");
      expect(desc).toContain("2");
    });
  });
});

// ============================================================================
// RESOLVE READY UNIT FOR INFLUENCE TESTS
// ============================================================================

describe("EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE", () => {
  describe("resolveEffect", () => {
    it("should ready the unit and deduct influence", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ], 10);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      // Unit should be readied
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Influence should be deducted
      expect(result.state.players[0].influencePoints).toBe(8);
      expect(result.description).toContain("Readied");
    });

    it("should chain back with remaining options when more units available", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
      ], 10);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      // Unit readied
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Should offer remaining unit + Done
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const nextOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitForInfluenceEffect;
      expect(nextOption.unitInstanceId).toBe("u2");
    });

    it("should not chain when no more affordable units remain", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
      ], 3); // Only enough to ready one L1 unit (cost 2, leaving 1)
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      // Unit readied
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Influence = 3 - 2 = 1, not enough for another L1 unit (cost 2)
      expect(result.state.players[0].influencePoints).toBe(1);
      // Should NOT chain (no affordable units)
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should preserve wound status when readying", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT, true), // wounded
      ], 10);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });
  });

  describe("isEffectResolvable", () => {
    it("should return true for spent unit with enough influence", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ], 10);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return false for already-ready unit", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_READY),
      ], 10);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when insufficient influence", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createTestState([
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ], 1);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });
  });

  describe("describeEffect", () => {
    it("should describe the unit and cost", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const effect: ResolveReadyUnitForInfluenceEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        influenceCost: 2,
        maxLevel: 2,
        costPerLevel: 2,
      };
      const desc = describeEffect(effect);
      expect(desc).toContain(UNITS[unitIdL1].name);
      expect(desc).toContain("2");
    });
  });
});

// ============================================================================
// INTEGRATION: RECRUIT DISCOUNT + RECRUITMENT COMMAND
// ============================================================================

describe("Recruit discount integration with recruitUnitCommand", () => {
  // Helper to create a proper state with a unit in the offer and optional discount
  function createRecruitState(discountAmount?: number, reputationChange?: number): GameState {
    resetUnitInstanceCounter();
    const unitId = getUnitIdOfLevel(1);
    const player = createTestPlayer({ influencePoints: 10 });
    const state = createTestGameState({
      players: [player],
      offers: {
        units: [unitId],
        advancedActions: [],
        spells: [],
      } as GameState["offers"],
    });

    if (discountAmount != null && reputationChange != null) {
      // Apply the recruit discount effect
      const discountEffect: RecruitDiscountEffect = {
        type: EFFECT_APPLY_RECRUIT_DISCOUNT,
        discount: discountAmount,
        reputationChange,
      };
      return resolveEffect(state, player.id, discountEffect).state;
    }

    return state;
  }

  it("should consume the discount modifier when recruiting a unit", () => {
    const state = createRecruitState(2, -1);
    const playerId = state.players[0].id;
    const unitId = state.offers.units[0];

    // Verify discount modifier exists
    expect(getActiveRecruitDiscount(state, playerId)).not.toBeNull();

    // Execute recruit command
    const unitDef = UNITS[unitId];
    const discountedCost = Math.max(0, unitDef.influence - 2);
    const command = createRecruitUnitCommand({
      playerId,
      unitId,
      influenceSpent: discountedCost,
    });
    const result = command.execute(state);

    // Discount modifier should be consumed
    expect(getActiveRecruitDiscount(result.state, playerId)).toBeNull();
  });

  it("should apply reputation change when discount is consumed", () => {
    const state = createRecruitState(2, -1);
    const playerId = state.players[0].id;
    const unitId = state.offers.units[0];
    const initialReputation = state.players[0].reputation;

    const unitDef = UNITS[unitId];
    const discountedCost = Math.max(0, unitDef.influence - 2);
    const command = createRecruitUnitCommand({
      playerId,
      unitId,
      influenceSpent: discountedCost,
    });
    const result = command.execute(state);

    // Reputation should decrease by 1
    expect(result.state.players[0].reputation).toBe(initialReputation - 1);
  });

  it("should restore modifier and reputation on undo", () => {
    const state = createRecruitState(2, -1);
    const playerId = state.players[0].id;
    const unitId = state.offers.units[0];
    const initialReputation = state.players[0].reputation;

    const unitDef = UNITS[unitId];
    const discountedCost = Math.max(0, unitDef.influence - 2);
    const command = createRecruitUnitCommand({
      playerId,
      unitId,
      influenceSpent: discountedCost,
    });
    const executed = command.execute(state);

    // Verify discount consumed and reputation changed
    expect(getActiveRecruitDiscount(executed.state, playerId)).toBeNull();
    expect(executed.state.players[0].reputation).toBe(initialReputation - 1);

    // Undo the command
    const undone = command.undo(executed.state);

    // Modifier should be restored
    expect(getActiveRecruitDiscount(undone.state, playerId)).not.toBeNull();
    // Reputation should be restored
    expect(undone.state.players[0].reputation).toBe(initialReputation);
  });

  it("should not affect reputation when recruiting without discount", () => {
    const state = createRecruitState(); // No discount
    const playerId = state.players[0].id;
    const unitId = state.offers.units[0];
    const initialReputation = state.players[0].reputation;

    const unitDef = UNITS[unitId];
    const command = createRecruitUnitCommand({
      playerId,
      unitId,
      influenceSpent: unitDef.influence,
    });
    const result = command.execute(state);

    // No discount modifier, so reputation unchanged
    expect(result.state.players[0].reputation).toBe(initialReputation);
  });
});
