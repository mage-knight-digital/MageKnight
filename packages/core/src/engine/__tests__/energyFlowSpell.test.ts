/**
 * Tests for the Energy Flow / Energy Steal spell (Green Spell #12)
 *
 * Basic (Energy Flow): Ready a Unit. If you do, you may spend one Unit
 * of level 2 or less in each other player's Unit area.
 *
 * Powered (Energy Steal): Ready a Unit. If you do, that Unit also gets
 * healed, and you may spend one Unit of level 3 or less in each other
 * player's Unit area.
 *
 * Key rules:
 * - Healing category: cannot be played during combat
 * - Interactive: removed in friendly game mode
 * - Ready targets any level unit (the level restriction is for opponent spending)
 * - Powered effect heals the readied unit (removes wound)
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  EnergyFlowEffect,
  ResolveEnergyFlowTargetEffect,
} from "../../types/cards.js";
import {
  CATEGORY_HEALING,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
} from "../../types/effectTypes.js";
import {
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNITS,
  CARD_ENERGY_FLOW,
  MANA_BLACK,
  MANA_GREEN,
  type UnitId,
} from "@mage-knight/shared";
import { createInitialGameState } from "../../state/GameState.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";
import { ENERGY_FLOW } from "../../data/spells/green/energyFlow.js";
import { getSpellCard } from "../../data/spells/index.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

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

function createUnit(
  unitId: UnitId,
  instanceId: string,
  unitState: typeof UNIT_STATE_READY | typeof UNIT_STATE_SPENT,
  wounded: boolean
): PlayerUnit {
  return {
    instanceId,
    unitId,
    state: unitState,
    wounded,
    usedResistanceThisCombat: false,
  };
}

function getUnitIdOfLevel(level: number): UnitId {
  const unitEntry = Object.entries(UNITS).find(([_, def]) => def.level === level);
  if (!unitEntry) {
    throw new Error(`No unit found with level ${level}`);
  }
  return unitEntry[0] as UnitId;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Energy Flow spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_ENERGY_FLOW);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Energy Flow");
  });

  it("should have correct metadata", () => {
    expect(ENERGY_FLOW.id).toBe(CARD_ENERGY_FLOW);
    expect(ENERGY_FLOW.name).toBe("Energy Flow");
    expect(ENERGY_FLOW.poweredName).toBe("Energy Steal");
    expect(ENERGY_FLOW.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(ENERGY_FLOW.sidewaysValue).toBe(1);
  });

  it("should be powered by black + green mana", () => {
    expect(ENERGY_FLOW.poweredBy).toEqual([MANA_BLACK, MANA_GREEN]);
  });

  it("should have healing category", () => {
    expect(ENERGY_FLOW.categories).toEqual([CATEGORY_HEALING]);
  });

  it("should be marked as interactive", () => {
    expect(ENERGY_FLOW.interactive).toBe(true);
  });

  it("should have basic effect with spendMaxLevel 2 and no heal", () => {
    const effect = ENERGY_FLOW.basicEffect as EnergyFlowEffect;
    expect(effect.type).toBe(EFFECT_ENERGY_FLOW);
    expect(effect.spendMaxLevel).toBe(2);
    expect(effect.healReadiedUnit).toBe(false);
  });

  it("should have powered effect with spendMaxLevel 3 and heal", () => {
    const effect = ENERGY_FLOW.poweredEffect as EnergyFlowEffect;
    expect(effect.type).toBe(EFFECT_ENERGY_FLOW);
    expect(effect.spendMaxLevel).toBe(3);
    expect(effect.healReadiedUnit).toBe(true);
  });
});

// ============================================================================
// BASIC EFFECT (ENERGY FLOW) TESTS
// ============================================================================

describe("EFFECT_ENERGY_FLOW (basic - no heal)", () => {
  const basicEffect: EnergyFlowEffect = {
    type: EFFECT_ENERGY_FLOW,
    spendMaxLevel: 2,
    healReadiedUnit: false,
  };

  describe("isEffectResolvable", () => {
    it("should return false when player has no units", () => {
      const state = createTestStateWithUnits([]);
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(false);
    });

    it("should return false when all units are ready", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
      ]);
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(false);
    });

    it("should return true when player has a spent unit", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(true);
    });

    it("should return true for spent wounded units", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);
      expect(isEffectResolvable(state, state.players[0].id, basicEffect)).toBe(true);
    });
  });

  describe("resolveEffect", () => {
    it("should ready a spent unit (auto-resolve with single unit)", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.requiresChoice).toBeFalsy();
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.description).toContain("Readied");
    });

    it("should NOT heal a wounded unit in basic mode", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });

    it("should return no-op when no spent units exist", () => {
      const state = createTestStateWithUnits([]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.description).toContain("No spent units");
    });

    it("should require choice when multiple spent units exist", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);
    });

    it("should provide RESOLVE_ENERGY_FLOW_TARGET choice options", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);
      const options = result.dynamicChoiceOptions as ResolveEnergyFlowTargetEffect[];

      expect(options[0].type).toBe(EFFECT_RESOLVE_ENERGY_FLOW_TARGET);
      expect(options[0].unitInstanceId).toBe("unit-1");
      expect(options[0].healReadiedUnit).toBe(false);
      expect(options[1].type).toBe(EFFECT_RESOLVE_ENERGY_FLOW_TARGET);
      expect(options[1].unitInstanceId).toBe("unit-2");
      expect(options[1].healReadiedUnit).toBe(false);
    });

    it("should ready any level unit (not restricted by spendMaxLevel)", () => {
      const unitIdLevel3 = getUnitIdOfLevel(3);
      const state = createTestStateWithUnits([
        createUnit(unitIdLevel3, "unit-1", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, basicEffect);

      // Level 3 unit should be readied even though spendMaxLevel is 2
      // (spendMaxLevel only limits opponent unit spending, not your own ready)
      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
    });
  });
});

// ============================================================================
// POWERED EFFECT (ENERGY STEAL) TESTS
// ============================================================================

describe("EFFECT_ENERGY_FLOW (powered - with heal)", () => {
  const poweredEffect: EnergyFlowEffect = {
    type: EFFECT_ENERGY_FLOW,
    spendMaxLevel: 3,
    healReadiedUnit: true,
  };

  describe("resolveEffect", () => {
    it("should ready AND heal a spent wounded unit", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);

      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      const unit = result.state.players[0].units[0];
      expect(unit.state).toBe(UNIT_STATE_READY);
      expect(unit.wounded).toBe(false); // Healed!
      expect(result.description).toContain("Readied");
      expect(result.description).toContain("healed");
    });

    it("should ready a spent unwounded unit (heal has no effect)", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      const unit = result.state.players[0].units[0];
      expect(unit.state).toBe(UNIT_STATE_READY);
      expect(unit.wounded).toBe(false);
      // Should not mention "healed" if unit wasn't wounded
      expect(result.description).not.toContain("healed");
    });

    it("should provide choice options with healReadiedUnit=true", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.requiresChoice).toBe(true);
      const options = result.dynamicChoiceOptions as ResolveEnergyFlowTargetEffect[];
      expect(options[0].healReadiedUnit).toBe(true);
      expect(options[1].healReadiedUnit).toBe(true);
    });

    it("should describe as select unit to ready and heal", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
      ]);

      const result = resolveEffect(state, state.players[0].id, poweredEffect);

      expect(result.description).toContain("ready and heal");
    });
  });
});

// ============================================================================
// RESOLVE TARGET EFFECT TESTS
// ============================================================================

describe("EFFECT_RESOLVE_ENERGY_FLOW_TARGET", () => {
  describe("resolveEffect", () => {
    it("should ready the specific unit (basic - no heal)", () => {
      const unitId = getUnitIdOfLevel(1);
      const unitName = UNITS[unitId].name;
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
        createUnit(unitId, "unit-2", UNIT_STATE_SPENT, false),
      ]);

      const effect: ResolveEnergyFlowTargetEffect = {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: "unit-2",
        unitName,
        healReadiedUnit: false,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_SPENT);
      expect(result.state.players[0].units[1].state).toBe(UNIT_STATE_READY);
    });

    it("should ready and heal the specific unit (powered)", () => {
      const unitId = getUnitIdOfLevel(1);
      const unitName = UNITS[unitId].name;
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, true),
      ]);

      const effect: ResolveEnergyFlowTargetEffect = {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: "unit-1",
        unitName,
        healReadiedUnit: true,
      };

      const result = resolveEffect(state, state.players[0].id, effect);

      expect(result.state.players[0].units[0].state).toBe(UNIT_STATE_READY);
      expect(result.state.players[0].units[0].wounded).toBe(false);
    });
  });

  describe("isEffectResolvable", () => {
    it("should return true for a spent unit", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_SPENT, false),
      ]);

      const effect: ResolveEnergyFlowTargetEffect = {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: "unit-1",
        unitName: "Test Unit",
        healReadiedUnit: false,
      };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(true);
    });

    it("should return false for an already-ready unit", () => {
      const unitId = getUnitIdOfLevel(1);
      const state = createTestStateWithUnits([
        createUnit(unitId, "unit-1", UNIT_STATE_READY, false),
      ]);

      const effect: ResolveEnergyFlowTargetEffect = {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: "unit-1",
        unitName: "Test Unit",
        healReadiedUnit: false,
      };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });

    it("should return false for a non-existent unit", () => {
      const state = createTestStateWithUnits([]);

      const effect: ResolveEnergyFlowTargetEffect = {
        type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
        unitInstanceId: "non-existent",
        unitName: "Test Unit",
        healReadiedUnit: false,
      };

      expect(isEffectResolvable(state, state.players[0].id, effect)).toBe(false);
    });
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Energy Flow", () => {
  it("should describe basic effect as 'Ready a Unit'", () => {
    const effect: EnergyFlowEffect = {
      type: EFFECT_ENERGY_FLOW,
      spendMaxLevel: 2,
      healReadiedUnit: false,
    };
    expect(describeEffect(effect)).toBe("Ready a Unit");
  });

  it("should describe powered effect as 'Ready and heal a Unit'", () => {
    const effect: EnergyFlowEffect = {
      type: EFFECT_ENERGY_FLOW,
      spendMaxLevel: 3,
      healReadiedUnit: true,
    };
    expect(describeEffect(effect)).toBe("Ready and heal a Unit");
  });

  it("should describe resolve target (basic) with unit name", () => {
    const effect: ResolveEnergyFlowTargetEffect = {
      type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
      unitInstanceId: "unit-1",
      unitName: "Peasants",
      healReadiedUnit: false,
    };
    expect(describeEffect(effect)).toBe("Ready Peasants");
  });

  it("should describe resolve target (powered) with heal", () => {
    const effect: ResolveEnergyFlowTargetEffect = {
      type: EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
      unitInstanceId: "unit-1",
      unitName: "Peasants",
      healReadiedUnit: true,
    };
    expect(describeEffect(effect)).toBe("Ready and heal Peasants");
  });
});
