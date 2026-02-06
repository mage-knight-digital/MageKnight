/**
 * Tests for Restoration / Rebirth spell
 *
 * Basic: Heal 3. If in a forest, Heal 5 instead.
 * Powered: Heal 3 (or 5 in forest) + Ready up to 3 levels of Units (5 in forest)
 */

import { describe, it, expect } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect } from "../effects/index.js";
import type {
  ReadyUnitsBudgetEffect,
  ResolveReadyUnitBudgetEffect,
  CompoundEffect,
  NoopEffect,
} from "../../types/cards.js";
import {
  EFFECT_READY_UNITS_BUDGET,
  EFFECT_RESOLVE_READY_UNIT_BUDGET,
  EFFECT_NOOP,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
} from "../../types/effectTypes.js";
import {
  CARD_WOUND,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNITS,
  TERRAIN_FOREST,
  TERRAIN_PLAINS,
  hexKey,
  type UnitId,
} from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import { RESTORATION } from "../../data/spells/green/restoration.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
} from "./testHelpers.js";
import type { GameState } from "../../state/GameState.js";

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

// Create a state with the player at a specific terrain
function createStateOnTerrain(
  terrain: typeof TERRAIN_FOREST | typeof TERRAIN_PLAINS,
  overrides: Partial<Parameters<typeof createTestPlayer>[0]> = {},
): GameState {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    ...overrides,
  });
  return createTestGameState({
    players: [player],
    map: {
      hexes: {
        [hexKey({ q: 0, r: 0 })]: createTestHex(0, 0, terrain),
      },
      tiles: [],
      tileDeck: { countryside: [], core: [] },
    },
  });
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Restoration/Rebirth card definition", () => {
  it("should have correct card metadata", () => {
    expect(RESTORATION.name).toBe("Restoration");
    expect(RESTORATION.poweredName).toBe("Rebirth");
    expect(RESTORATION.categories).toContain("healing");
    expect(RESTORATION.cardType).toBe("spell");
  });

  it("should have basic effect as terrain conditional", () => {
    expect(RESTORATION.basicEffect.type).toBe(EFFECT_CONDITIONAL);
  });

  it("should have powered effect as compound of two conditionals", () => {
    const powered = RESTORATION.poweredEffect;
    expect(powered.type).toBe(EFFECT_COMPOUND);
    const compound = powered as CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0].type).toBe(EFFECT_CONDITIONAL);
    expect(compound.effects[1].type).toBe(EFFECT_CONDITIONAL);
  });
});

// ============================================================================
// BASIC EFFECT: RESTORATION (Heal 3, or 5 in forest)
// ============================================================================

describe("Restoration basic effect (heal with forest conditional)", () => {
  it("should heal 3 when not in a forest", () => {
    const state = createStateOnTerrain(TERRAIN_PLAINS, {
      hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.basicEffect);

    // 4 wounds - 3 healed = 1 wound left
    const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(1);
  });

  it("should heal 5 when in a forest", () => {
    const state = createStateOnTerrain(TERRAIN_FOREST, {
      hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.basicEffect);

    // 6 wounds - 5 healed = 1 wound left
    const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(1);
  });

  it("should only heal available wounds (not overcounting)", () => {
    const state = createStateOnTerrain(TERRAIN_FOREST, {
      hand: [CARD_WOUND, CARD_WOUND],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.basicEffect);

    // Only 2 wounds to heal, heals 2 even though heal 5 offered
    const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(0);
  });
});

// ============================================================================
// POWERED EFFECT: REBIRTH (Heal + Ready units)
// ============================================================================

describe("Rebirth powered effect (heal + ready units)", () => {
  it("should heal 3 when not in a forest (powered)", () => {
    const state = createStateOnTerrain(TERRAIN_PLAINS, {
      hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    // 4 wounds - 3 healed = 1 wound remaining
    const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(1);
  });

  it("should heal 5 when in a forest (powered)", () => {
    const state = createStateOnTerrain(TERRAIN_FOREST, {
      hand: [CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND, CARD_WOUND],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    // 6 wounds - 5 healed = 1 wound remaining
    const woundsRemaining = result.state.players[0].hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(1);
  });

  it("should offer unit readying choices when player has spent units (not in forest)", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateOnTerrain(TERRAIN_PLAINS, {
      hand: [],
      units: [
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    // Should require a choice for unit readying
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();
    // 1 unit option + Done
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
    expect(unitOption.type).toBe(EFFECT_RESOLVE_READY_UNIT_BUDGET);
    expect(unitOption.unitInstanceId).toBe("u1");

    const doneOption = result.dynamicChoiceOptions![1] as NoopEffect;
    expect(doneOption.type).toBe(EFFECT_NOOP);
  });

  it("should have 5 level budget for unit readying in forest", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateOnTerrain(TERRAIN_FOREST, {
      hand: [],
      units: [
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    expect(result.requiresChoice).toBe(true);
    const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
    // In forest, total budget is 5. L1 unit costs 1, so remaining is 4
    expect(unitOption.remainingBudget).toBe(4);
  });

  it("should have 3 level budget for unit readying outside forest", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateOnTerrain(TERRAIN_PLAINS, {
      hand: [],
      units: [
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
      ],
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    expect(result.requiresChoice).toBe(true);
    const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
    // Not in forest, total budget is 3. L1 unit costs 1, so remaining is 2
    expect(unitOption.remainingBudget).toBe(2);
  });

  it("should skip unit readying when no spent units", () => {
    const state = createStateOnTerrain(TERRAIN_PLAINS, {
      hand: [CARD_WOUND],
      units: [], // No units at all
    });
    const result = resolveEffect(state, state.players[0].id, RESTORATION.poweredEffect);

    // Should not require choice (healing resolves immediately, no units to ready)
    expect(result.requiresChoice).toBeFalsy();
  });
});

// ============================================================================
// READY UNITS BUDGET EFFECT
// ============================================================================

describe("EFFECT_READY_UNITS_BUDGET", () => {
  const effect: ReadyUnitsBudgetEffect = {
    type: EFFECT_READY_UNITS_BUDGET,
    totalLevels: 3,
  };

  describe("resolveEffect", () => {
    it("should return no-op when no eligible units", () => {
      const state = createStateOnTerrain(TERRAIN_PLAINS, { units: [] });
      const result = resolveEffect(state, state.players[0].id, effect);
      expect(result.description).toContain("No spent units");
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should present choice options including Done", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
      });
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2); // 1 unit + Done
      expect(result.dynamicChoiceOptions![0].type).toBe(EFFECT_RESOLVE_READY_UNIT_BUDGET);
      expect(result.dynamicChoiceOptions![1].type).toBe(EFFECT_NOOP);
    });

    it("should exclude units that exceed budget", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const unitIdL4 = getUnitIdOfLevel(4);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL4, "u2", UNIT_STATE_SPENT), // L4 > budget of 3
        ],
      });
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // Only L1 unit + Done (L4 exceeds budget of 3)
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
      expect(unitOption.unitInstanceId).toBe("u1");
    });

    it("should include multiple eligible units", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u3", UNIT_STATE_SPENT),
        ],
      });
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // 3 unit options + Done
      expect(result.dynamicChoiceOptions).toHaveLength(4);
    });

    it("should skip already-ready units", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_READY),
          createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
        ],
      });
      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.requiresChoice).toBe(true);
      // Only u2 (spent) + Done
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const unitOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
      expect(unitOption.unitInstanceId).toBe("u2");
    });
  });

  describe("isEffectResolvable", () => {
    it("should return false when no units", () => {
      const state = createStateOnTerrain(TERRAIN_PLAINS, { units: [] });
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when all units are ready", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_READY)],
      });
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false when spent units exceed budget", () => {
      const unitIdL4 = getUnitIdOfLevel(4);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL4, "u1", UNIT_STATE_SPENT)],
      });
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return true when eligible spent unit exists", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
      });
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });
  });

  describe("describeEffect", () => {
    it("should describe the budget", () => {
      const desc = describeEffect(effect);
      expect(desc).toContain("3");
      expect(desc).toContain("levels");
    });
  });
});

// ============================================================================
// RESOLVE READY UNIT BUDGET EFFECT
// ============================================================================

describe("EFFECT_RESOLVE_READY_UNIT_BUDGET", () => {
  describe("resolveEffect", () => {
    it("should ready the selected unit", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
      });
      const resolveEffect_ = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      } as ResolveReadyUnitBudgetEffect;

      const result = resolveEffect(state, state.players[0].id, resolveEffect_);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.description).toContain("Readied");
    });

    it("should preserve wound status when readying", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT, true)],
      });
      const resolveEffect_ = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      } as ResolveReadyUnitBudgetEffect;

      const result = resolveEffect(state, state.players[0].id, resolveEffect_);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });

    it("should chain with remaining options when budget remains", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
        ],
      });
      const resolveEffect_ = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2, // After readying u1, 2 levels left
      } as ResolveReadyUnitBudgetEffect;

      const result = resolveEffect(state, state.players[0].id, resolveEffect_);

      // u1 readied
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Should offer u2 + Done
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);
      const nextOption = result.dynamicChoiceOptions![0] as ResolveReadyUnitBudgetEffect;
      expect(nextOption.unitInstanceId).toBe("u2");
      expect(nextOption.remainingBudget).toBe(1); // 2 - 1 (L1 unit)
    });

    it("should not chain when budget is exhausted", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
        ],
      });
      const resolveEffect_ = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 0, // No budget left after this
      } as ResolveReadyUnitBudgetEffect;

      const result = resolveEffect(state, state.players[0].id, resolveEffect_);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Should NOT chain
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should not chain when remaining units exceed remaining budget", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const unitIdL3 = getUnitIdOfLevel(3);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL3, "u2", UNIT_STATE_SPENT), // L3, won't fit in budget of 1
        ],
      });
      const resolveEffect_ = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 1, // Only 1 level left, L3 won't fit
      } as ResolveReadyUnitBudgetEffect;

      const result = resolveEffect(state, state.players[0].id, resolveEffect_);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      // Should NOT chain (L3 unit can't fit in remaining budget of 1)
      expect(result.requiresChoice).toBeFalsy();
    });

    it("should allow readying multiple units up to 3 levels total", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [
          createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u3", UNIT_STATE_SPENT),
          createUnit(unitIdL1, "u4", UNIT_STATE_SPENT),
        ],
      });

      // Ready first unit (budget 3 -> 2)
      const effect1: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      };
      const result1 = resolveEffect(state, state.players[0].id, effect1);
      expect(result1.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result1.requiresChoice).toBe(true);

      // Ready second unit (budget 2 -> 1)
      const effect2: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u2",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 1,
      };
      const result2 = resolveEffect(result1.state, result1.state.players[0].id, effect2);
      expect(result2.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
      expect(result2.requiresChoice).toBe(true);

      // Ready third unit (budget 1 -> 0)
      const effect3: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u3",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 0,
      };
      const result3 = resolveEffect(result2.state, result2.state.players[0].id, effect3);
      expect(result3.state.players[0].units[2].state).toBe(UNIT_STATE_READY);
      // Budget exhausted, no more chaining
      expect(result3.requiresChoice).toBeFalsy();

      // u4 should still be spent
      expect(result3.state.players[0].units[3].state).toBe(UNIT_STATE_SPENT);
    });
  });

  describe("isEffectResolvable", () => {
    it("should return true for spent unit", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
      });
      const effect: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      };
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return false for already-ready unit", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const state = createStateOnTerrain(TERRAIN_PLAINS, {
        units: [createUnit(unitIdL1, "u1", UNIT_STATE_READY)],
      });
      const effect: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      };
      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });
  });

  describe("describeEffect", () => {
    it("should describe the unit being readied", () => {
      const unitIdL1 = getUnitIdOfLevel(1);
      const effect: ResolveReadyUnitBudgetEffect = {
        type: EFFECT_RESOLVE_READY_UNIT_BUDGET,
        unitInstanceId: "u1",
        unitName: UNITS[unitIdL1].name,
        unitLevel: 1,
        remainingBudget: 2,
      };
      const desc = describeEffect(effect);
      expect(desc).toContain(UNITS[unitIdL1].name);
    });
  });
});
