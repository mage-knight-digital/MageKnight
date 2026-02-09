/**
 * Tests for Peaceful Moment (White Advanced Action)
 *
 * Basic: Influence 3. You may play this as your action for the turn:
 *        if you do, you may get Heal 1 for each 2 Influence you spend.
 *
 * Powered: Influence 6. You may play this as your action for the turn:
 *          if you do, you may get Heal 1 for each 2 Influence you spend
 *          and/or refresh a Unit by paying 2 Influence per level of the Unit.
 *
 * Key behaviors:
 * - Choice between immediate (Influence only) or action mode (conversion)
 * - Action mode: consumes turn action, enables influence-to-heal conversion
 * - Powered action mode: also enables one unit refresh
 * - Heal conversion: 2 Influence → 1 Heal (repeatable)
 * - Unit refresh: 2 Influence per unit level (max 1 unit)
 * - Can combine with other Influence sources for more conversions
 * - Action mode: no reputation bonus/penalty
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  PeacefulMomentActionEffect,
  PeacefulMomentHealEffect,
  PeacefulMomentRefreshEffect,
  ChoiceEffect,
} from "../../types/cards.js";
import {
  EFFECT_PEACEFUL_MOMENT_ACTION,
  EFFECT_PEACEFUL_MOMENT_HEAL,
  EFFECT_PEACEFUL_MOMENT_REFRESH,
  EFFECT_CHOICE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import {
  CARD_PEACEFUL_MOMENT,
  CARD_WOUND,
  CARD_MARCH,
  UNIT_STATE_READY,
  UNIT_STATE_SPENT,
  UNITS,
  type UnitId,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { PlayerUnit } from "../../types/unit.js";
import { PEACEFUL_MOMENT } from "../../data/advancedActions/white/peaceful-moment.js";
import { reverseEffect } from "../effects/reverse.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";

// ============================================================================
// HELPERS
// ============================================================================

function createStateWithInfluenceAndWounds(
  influencePoints: number = 0,
  woundsInHand: number = 0,
  units: PlayerUnit[] = [],
  hasTakenActionThisTurn: boolean = false,
): GameState {
  const hand: string[] = [];
  for (let i = 0; i < woundsInHand; i++) {
    hand.push(CARD_WOUND);
  }
  hand.push(CARD_MARCH); // Add a non-wound card
  const player = createTestPlayer({
    hand,
    influencePoints,
    units,
    hasTakenActionThisTurn,
  });
  return createTestGameState({ players: [player] });
}

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

function getUnitIdOfLevel(level: number): UnitId {
  const unitEntry = Object.entries(UNITS).find(([_, def]) => def.level === level);
  if (!unitEntry) {
    throw new Error(`No unit found with level ${level}`);
  }
  return unitEntry[0] as UnitId;
}

// ============================================================================
// 1. Card Definition Tests
// ============================================================================

describe("Peaceful Moment card definition", () => {
  it("has correct metadata", () => {
    expect(PEACEFUL_MOMENT.id).toBe(CARD_PEACEFUL_MOMENT);
    expect(PEACEFUL_MOMENT.name).toBe("Peaceful Moment");
    expect(PEACEFUL_MOMENT.poweredBy).toEqual(["white"]);
  });

  it("does NOT have CATEGORY_ACTION (action consumption is effect-level)", () => {
    expect(PEACEFUL_MOMENT.categories).not.toContain("action");
  });

  it("has basic effect as a choice between influence and action mode", () => {
    expect(PEACEFUL_MOMENT.basicEffect.type).toBe(EFFECT_CHOICE);
    const choice = PEACEFUL_MOMENT.basicEffect as ChoiceEffect;
    expect(choice.options).toHaveLength(2);
    expect(choice.options[0]!.type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(choice.options[1]!.type).toBe(EFFECT_PEACEFUL_MOMENT_ACTION);
  });

  it("basic action mode does not allow unit refresh", () => {
    const choice = PEACEFUL_MOMENT.basicEffect as ChoiceEffect;
    const actionEffect = choice.options[1] as PeacefulMomentActionEffect;
    expect(actionEffect.allowUnitRefresh).toBe(false);
    expect(actionEffect.influenceAmount).toBe(3);
  });

  it("has powered effect as a choice between influence and action mode", () => {
    expect(PEACEFUL_MOMENT.poweredEffect.type).toBe(EFFECT_CHOICE);
    const choice = PEACEFUL_MOMENT.poweredEffect as ChoiceEffect;
    expect(choice.options).toHaveLength(2);
    expect(choice.options[0]!.type).toBe(EFFECT_GAIN_INFLUENCE);
    expect(choice.options[1]!.type).toBe(EFFECT_PEACEFUL_MOMENT_ACTION);
  });

  it("powered action mode allows unit refresh", () => {
    const choice = PEACEFUL_MOMENT.poweredEffect as ChoiceEffect;
    const actionEffect = choice.options[1] as PeacefulMomentActionEffect;
    expect(actionEffect.allowUnitRefresh).toBe(true);
    expect(actionEffect.influenceAmount).toBe(6);
  });
});

// ============================================================================
// 2. Immediate Mode Tests
// ============================================================================

describe("Peaceful Moment immediate mode", () => {
  it("basic: gains Influence 3 without consuming action", () => {
    const state = createStateWithInfluenceAndWounds(0, 0);
    const effect = (PEACEFUL_MOMENT.basicEffect as ChoiceEffect).options[0]!;

    const result = resolveEffect(state, state.players[0]!.id, effect);

    expect(result.state.players[0]!.influencePoints).toBe(3);
    expect(result.state.players[0]!.hasTakenActionThisTurn).toBe(false);
  });

  it("powered: gains Influence 6 without consuming action", () => {
    const state = createStateWithInfluenceAndWounds(0, 0);
    const effect = (PEACEFUL_MOMENT.poweredEffect as ChoiceEffect).options[0]!;

    const result = resolveEffect(state, state.players[0]!.id, effect);

    expect(result.state.players[0]!.influencePoints).toBe(6);
    expect(result.state.players[0]!.hasTakenActionThisTurn).toBe(false);
  });
});

// ============================================================================
// 3. Action Mode - Entry Point Tests
// ============================================================================

describe("Peaceful Moment action mode entry (EFFECT_PEACEFUL_MOMENT_ACTION)", () => {
  const basicActionEffect: PeacefulMomentActionEffect = {
    type: EFFECT_PEACEFUL_MOMENT_ACTION,
    influenceAmount: 3,
    allowUnitRefresh: false,
  };

  const poweredActionEffect: PeacefulMomentActionEffect = {
    type: EFFECT_PEACEFUL_MOMENT_ACTION,
    influenceAmount: 6,
    allowUnitRefresh: true,
  };

  it("grants influence and consumes action", () => {
    const state = createStateWithInfluenceAndWounds(0, 2);
    const result = resolveEffect(state, state.players[0]!.id, basicActionEffect);

    expect(result.state.players[0]!.influencePoints).toBe(3);
    expect(result.state.players[0]!.hasTakenActionThisTurn).toBe(true);
  });

  it("presents conversion options when wounds are in hand", () => {
    const state = createStateWithInfluenceAndWounds(0, 2);
    const result = resolveEffect(state, state.players[0]!.id, basicActionEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();
    // Should have: heal option + done option
    expect(result.dynamicChoiceOptions!.length).toBeGreaterThanOrEqual(2);

    const healOption = result.dynamicChoiceOptions!.find(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_HEAL
    );
    expect(healOption).toBeDefined();

    const doneOption = result.dynamicChoiceOptions!.find(
      (o) => o.type === EFFECT_NOOP
    );
    expect(doneOption).toBeDefined();
  });

  it("skips conversion loop when no wounds in hand", () => {
    const state = createStateWithInfluenceAndWounds(0, 0);
    const result = resolveEffect(state, state.players[0]!.id, basicActionEffect);

    // No wounds = no conversion possible, so no choice needed
    expect(result.requiresChoice).toBeFalsy();
    expect(result.state.players[0]!.influencePoints).toBe(3);
  });

  it("skips conversion when insufficient influence for heal (less than 2)", () => {
    // This is a bit contrived since influence comes from the effect itself (3),
    // but let's test with 0 wounds and pre-existing influence < 2
    const state = createStateWithInfluenceAndWounds(0, 0);
    const tinyEffect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 1,
      allowUnitRefresh: false,
    };
    const result = resolveEffect(state, state.players[0]!.id, tinyEffect);

    // 1 influence is not enough for healing (needs 2)
    expect(result.requiresChoice).toBeFalsy();
  });

  it("powered action mode includes unit refresh options", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      0,
      1,
      [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
    );

    const result = resolveEffect(state, state.players[0]!.id, poweredActionEffect);

    expect(result.requiresChoice).toBe(true);
    const refreshOption = result.dynamicChoiceOptions!.find(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
    ) as PeacefulMomentRefreshEffect | undefined;
    expect(refreshOption).toBeDefined();
    expect(refreshOption!.unitInstanceId).toBe("u1");
    expect(refreshOption!.influenceCost).toBe(2); // L1 * 2
  });

  it("basic action mode does NOT include unit refresh options", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      0,
      1,
      [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
    );

    const result = resolveEffect(state, state.players[0]!.id, basicActionEffect);

    const refreshOption = result.dynamicChoiceOptions?.find(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
    );
    expect(refreshOption).toBeUndefined();
  });

  it("combines with pre-existing influence for conversions", () => {
    // Player already has 4 influence, gains 3 more = 7 total
    const state = createStateWithInfluenceAndWounds(4, 3);
    const result = resolveEffect(state, state.players[0]!.id, basicActionEffect);

    expect(result.state.players[0]!.influencePoints).toBe(7);
    expect(result.requiresChoice).toBe(true);
  });
});

// ============================================================================
// 4. Heal Conversion Tests
// ============================================================================

describe("Peaceful Moment heal conversion (EFFECT_PEACEFUL_MOMENT_HEAL)", () => {
  it("deducts 2 influence and heals 1 wound", () => {
    const state = createStateWithInfluenceAndWounds(4, 2);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);
    const player = result.state.players[0]!;

    expect(player.influencePoints).toBe(2); // 4 - 2
    // One wound removed from hand
    const woundsRemaining = player.hand.filter((c) => c === CARD_WOUND).length;
    expect(woundsRemaining).toBe(1);
  });

  it("chains back with more options when conversions remain", () => {
    const state = createStateWithInfluenceAndWounds(6, 3);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);

    // After healing: 4 influence, 2 wounds — more conversions possible
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions!.some(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_HEAL
    )).toBe(true);
  });

  it("completes automatically when no more conversions possible (no influence)", () => {
    const state = createStateWithInfluenceAndWounds(2, 2);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);

    // After healing: 0 influence, 1 wound — can't do more
    expect(result.requiresChoice).toBeFalsy();
    expect(result.state.players[0]!.influencePoints).toBe(0);
  });

  it("completes automatically when no more conversions possible (no wounds)", () => {
    const state = createStateWithInfluenceAndWounds(4, 1);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);

    // After healing: 2 influence, 0 wounds — can't heal more
    expect(result.requiresChoice).toBeFalsy();
    expect(result.state.players[0]!.influencePoints).toBe(2);
  });

  it("fails gracefully with insufficient influence", () => {
    const state = createStateWithInfluenceAndWounds(1, 1);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);

    // Insufficient influence — no change
    expect(result.description).toContain("Insufficient");
    expect(result.state.players[0]!.influencePoints).toBe(1);
  });
});

// ============================================================================
// 5. Unit Refresh Tests (Powered Only)
// ============================================================================

describe("Peaceful Moment unit refresh (EFFECT_PEACEFUL_MOMENT_REFRESH)", () => {
  it("deducts influence and readies unit", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      4,
      1,
      [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u1",
      unitName: "Test Unit",
      influenceCost: 2,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);
    const player = result.state.players[0]!;

    expect(player.influencePoints).toBe(2); // 4 - 2
    expect(player.units[0]!.state).toBe(UNIT_STATE_READY);
  });

  it("costs 2 per level (L2 unit costs 4 influence)", () => {
    const unitIdL2 = getUnitIdOfLevel(2);
    const state = createStateWithInfluenceAndWounds(
      6,
      0,
      [createUnit(unitIdL2, "u2", UNIT_STATE_SPENT)],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u2",
      unitName: "L2 Unit",
      influenceCost: 4,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);

    expect(result.state.players[0]!.influencePoints).toBe(2); // 6 - 4
    expect(result.state.players[0]!.units[0]!.state).toBe(UNIT_STATE_READY);
  });

  it("limits to one unit refresh (allowUnitRefresh becomes false after)", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      8,
      1,
      [
        createUnit(unitIdL1, "u1", UNIT_STATE_SPENT),
        createUnit(unitIdL1, "u2", UNIT_STATE_SPENT),
      ],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u1",
      unitName: "Unit 1",
      influenceCost: 2,
      allowUnitRefresh: false, // Already false — no more refreshes
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);

    // Should chain back but with no refresh options
    if (result.requiresChoice) {
      const refreshOptions = result.dynamicChoiceOptions!.filter(
        (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
      );
      expect(refreshOptions).toHaveLength(0);
    }
  });

  it("chains back to heal options after refresh (if wounds remain)", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      6,
      2,
      [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u1",
      unitName: "Unit 1",
      influenceCost: 2,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);

    // After refresh: 4 influence, 2 wounds — heal is still possible
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions!.some(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_HEAL
    )).toBe(true);
  });

  it("fails gracefully when unit not found", () => {
    const state = createStateWithInfluenceAndWounds(4, 0);

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "nonexistent",
      unitName: "Ghost Unit",
      influenceCost: 2,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);
    expect(result.description).toContain("not found");
  });

  it("fails gracefully when unit is not spent", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      4,
      0,
      [createUnit(unitIdL1, "u1", UNIT_STATE_READY)],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u1",
      unitName: "Ready Unit",
      influenceCost: 2,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);
    expect(result.description).toContain("not spent");
  });

  it("fails gracefully with insufficient influence", () => {
    const unitIdL2 = getUnitIdOfLevel(2);
    const state = createStateWithInfluenceAndWounds(
      3,
      0,
      [createUnit(unitIdL2, "u2", UNIT_STATE_SPENT)],
    );

    const refreshEffect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u2",
      unitName: "L2 Unit",
      influenceCost: 4,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, refreshEffect);
    expect(result.description).toContain("Insufficient");
  });
});

// ============================================================================
// 6. Resolvability Tests
// ============================================================================

describe("Peaceful Moment resolvability", () => {
  it("action mode is resolvable when player has not taken action", () => {
    const state = createStateWithInfluenceAndWounds(0, 0, [], false);
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 3,
      allowUnitRefresh: false,
    };

    expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(true);
  });

  it("action mode is NOT resolvable when player has already taken action", () => {
    const state = createStateWithInfluenceAndWounds(0, 0, [], true);
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 3,
      allowUnitRefresh: false,
    };

    expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(false);
  });

  it("immediate influence is always resolvable", () => {
    const state = createStateWithInfluenceAndWounds(0, 0, [], true);
    const effect = (PEACEFUL_MOMENT.basicEffect as ChoiceEffect).options[0]!;

    expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(true);
  });

  it("when action already taken, choice auto-resolves to immediate influence", () => {
    // When hasTakenActionThisTurn = true, the action mode is filtered out
    // Choice has only 1 resolvable option → auto-resolve to influence
    const state = createStateWithInfluenceAndWounds(0, 0, [], true);

    // The basic choice has 2 options, but action mode is filtered out
    expect(isEffectResolvable(state, state.players[0]!.id, PEACEFUL_MOMENT.basicEffect)).toBe(true);
    const choice = PEACEFUL_MOMENT.basicEffect as ChoiceEffect;
    const resolvableOptions = choice.options.filter((opt) =>
      isEffectResolvable(state, state.players[0]!.id, opt)
    );
    expect(resolvableOptions).toHaveLength(1);
    expect(resolvableOptions[0]!.type).toBe(EFFECT_GAIN_INFLUENCE);
  });
});

// ============================================================================
// 7. Effect Description Tests
// ============================================================================

describe("Peaceful Moment effect descriptions", () => {
  it("describes basic action mode", () => {
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 3,
      allowUnitRefresh: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Influence 3");
    expect(desc).toContain("action");
    expect(desc).toContain("Heal");
  });

  it("describes powered action mode with unit refresh", () => {
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 6,
      allowUnitRefresh: true,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Influence 6");
    expect(desc).toContain("refresh");
  });

  it("describes heal conversion", () => {
    const effect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Heal");
    expect(desc).toContain("2 Influence");
  });

  it("describes unit refresh", () => {
    const effect: PeacefulMomentRefreshEffect = {
      type: EFFECT_PEACEFUL_MOMENT_REFRESH,
      unitInstanceId: "u1",
      unitName: "Foresters",
      influenceCost: 2,
      allowUnitRefresh: false,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Foresters");
    expect(desc).toContain("2 Influence");
  });
});

// ============================================================================
// 8. Reverse Effect Tests
// ============================================================================

describe("Peaceful Moment effect reversal", () => {
  it("reverses action mode: restores influence and action flag", () => {
    const player = createTestPlayer({
      influencePoints: 3,
      hasTakenActionThisTurn: true,
    });

    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 3,
      allowUnitRefresh: false,
    };

    const reversed = reverseEffect(player, effect);
    expect(reversed.influencePoints).toBe(0);
    expect(reversed.hasTakenActionThisTurn).toBe(false);
  });
});

// ============================================================================
// 9. No Reputation Change Tests
// ============================================================================

describe("Peaceful Moment no reputation change", () => {
  it("action mode does not change reputation", () => {
    const state = createStateWithInfluenceAndWounds(0, 2);
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 3,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, effect);
    expect(result.state.players[0]!.reputation).toBe(state.players[0]!.reputation);
  });

  it("heal conversion does not change reputation", () => {
    const state = createStateWithInfluenceAndWounds(4, 2);
    const healEffect: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };

    const result = resolveEffect(state, state.players[0]!.id, healEffect);
    expect(result.state.players[0]!.reputation).toBe(state.players[0]!.reputation);
  });
});

// ============================================================================
// 10. Powered Mode Integration Tests
// ============================================================================

describe("Peaceful Moment powered action mode integration", () => {
  it("powered mode includes both heal and refresh options when both available", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      0,
      2,
      [createUnit(unitIdL1, "u1", UNIT_STATE_SPENT)],
    );

    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 6,
      allowUnitRefresh: true,
    };

    const result = resolveEffect(state, state.players[0]!.id, effect);

    expect(result.requiresChoice).toBe(true);

    const options = result.dynamicChoiceOptions!;
    const healOptions = options.filter((o) => o.type === EFFECT_PEACEFUL_MOMENT_HEAL);
    const refreshOptions = options.filter((o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH);
    const doneOptions = options.filter((o) => o.type === EFFECT_NOOP);

    expect(healOptions).toHaveLength(1);
    expect(refreshOptions).toHaveLength(1);
    expect(doneOptions).toHaveLength(1);
  });

  it("only shows affordable unit refresh options", () => {
    const unitIdL3 = getUnitIdOfLevel(3);
    const state = createStateWithInfluenceAndWounds(
      0,
      1,
      [createUnit(unitIdL3, "u3", UNIT_STATE_SPENT)],
    );

    // Influence 6 from effect, but L3 unit costs 6 influence
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 6,
      allowUnitRefresh: true,
    };

    const result = resolveEffect(state, state.players[0]!.id, effect);
    const refreshOptions = result.dynamicChoiceOptions!.filter(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
    );

    // L3 costs 6 influence — should be available since we have exactly 6
    expect(refreshOptions).toHaveLength(1);
    const refreshOpt = refreshOptions[0] as PeacefulMomentRefreshEffect;
    expect(refreshOpt.influenceCost).toBe(6);
  });

  it("does not show unaffordable unit refresh options", () => {
    const unitIdL4 = getUnitIdOfLevel(4);
    const state = createStateWithInfluenceAndWounds(
      0,
      1,
      [createUnit(unitIdL4, "u4", UNIT_STATE_SPENT)],
    );

    // Influence 6 from effect, but L4 unit costs 8 influence
    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 6,
      allowUnitRefresh: true,
    };

    const result = resolveEffect(state, state.players[0]!.id, effect);
    const refreshOptions = result.dynamicChoiceOptions!.filter(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
    );

    // L4 costs 8 influence — too expensive with only 6
    expect(refreshOptions).toHaveLength(0);
  });

  it("does not offer refresh for ready units", () => {
    const unitIdL1 = getUnitIdOfLevel(1);
    const state = createStateWithInfluenceAndWounds(
      0,
      1,
      [createUnit(unitIdL1, "u1", UNIT_STATE_READY)],
    );

    const effect: PeacefulMomentActionEffect = {
      type: EFFECT_PEACEFUL_MOMENT_ACTION,
      influenceAmount: 6,
      allowUnitRefresh: true,
    };

    const result = resolveEffect(state, state.players[0]!.id, effect);
    const refreshOptions = result.dynamicChoiceOptions!.filter(
      (o) => o.type === EFFECT_PEACEFUL_MOMENT_REFRESH
    );

    expect(refreshOptions).toHaveLength(0);
  });

  it("multi-step: heal then heal again", () => {
    const state = createStateWithInfluenceAndWounds(6, 3);

    // Simulate: start with 6 influence and 3 wounds
    // Heal #1: 6 → 4 influence, 3 → 2 wounds
    const heal1: PeacefulMomentHealEffect = {
      type: EFFECT_PEACEFUL_MOMENT_HEAL,
      allowUnitRefresh: false,
    };
    const result1 = resolveEffect(state, state.players[0]!.id, heal1);

    expect(result1.state.players[0]!.influencePoints).toBe(4);
    expect(result1.state.players[0]!.hand.filter((c) => c === CARD_WOUND).length).toBe(2);
    expect(result1.requiresChoice).toBe(true);

    // Heal #2: 4 → 2 influence, 2 → 1 wounds
    const result2 = resolveEffect(result1.state, result1.state.players[0]!.id, heal1);

    expect(result2.state.players[0]!.influencePoints).toBe(2);
    expect(result2.state.players[0]!.hand.filter((c) => c === CARD_WOUND).length).toBe(1);
    expect(result2.requiresChoice).toBe(true);

    // Heal #3: 2 → 0 influence, 1 → 0 wounds
    const result3 = resolveEffect(result2.state, result2.state.players[0]!.id, heal1);

    expect(result3.state.players[0]!.influencePoints).toBe(0);
    expect(result3.state.players[0]!.hand.filter((c) => c === CARD_WOUND).length).toBe(0);
    expect(result3.requiresChoice).toBeFalsy(); // No more conversions
  });
});
