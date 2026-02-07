/**
 * Tests for the Call to Arms / Call to Glory spell (White Spell)
 *
 * Basic (Call to Arms): Borrow a Unit ability from the Units Offer this turn.
 * - Use one ability of a Unit in the offer as if it were yours
 * - Cannot assign damage to the borrowed Unit
 * - Excludes Magic Familiars and Delphana Masters
 *
 * Powered (Call to Glory): Recruit any Unit from the offer for free.
 * - Uses existing EFFECT_FREE_RECRUIT infrastructure
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  CallToArmsEffect,
  ResolveCallToArmsUnitEffect,
  ResolveCallToArmsAbilityEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_CALL_TO_ARMS,
  EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
  EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
  EFFECT_FREE_RECRUIT,
} from "../../types/effectTypes.js";
import {
  CARD_CALL_TO_ARMS,
  MANA_BLACK,
  MANA_WHITE,
  UNIT_PEASANTS,
  UNIT_UTEM_GUARDSMEN,
  UNIT_MAGIC_FAMILIARS,
  UNIT_DELPHANA_MASTERS,
  UNIT_FORESTERS,
  UNITS,
} from "@mage-knight/shared";
import type { UnitId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { CALL_TO_ARMS } from "../../data/spells/white/callToArms.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCallToArmsState(
  unitOffer: UnitId[] = [UNIT_PEASANTS],
  playerOverrides: Partial<import("../../types/player.js").Player> = {}
): GameState {
  const player = createTestPlayer({
    id: "player1",
    ...playerOverrides,
  });

  return createTestGameState({
    players: [player],
    offers: {
      units: unitOffer,
      advancedActions: [],
      spells: [],
    },
  });
}

function getPlayer(state: GameState) {
  return state.players[0]!;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Call to Arms spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_CALL_TO_ARMS);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Call to Arms");
  });

  it("should have correct metadata", () => {
    expect(CALL_TO_ARMS.id).toBe(CARD_CALL_TO_ARMS);
    expect(CALL_TO_ARMS.name).toBe("Call to Arms");
    expect(CALL_TO_ARMS.poweredName).toBe("Call to Glory");
    expect(CALL_TO_ARMS.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(CALL_TO_ARMS.sidewaysValue).toBe(1);
  });

  it("should be powered by black + white mana", () => {
    expect(CALL_TO_ARMS.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
  });

  it("should have special category", () => {
    expect(CALL_TO_ARMS.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should have Call to Arms basic effect", () => {
    expect(CALL_TO_ARMS.basicEffect.type).toBe(EFFECT_CALL_TO_ARMS);
  });

  it("should have Free Recruit powered effect (Call to Glory)", () => {
    expect(CALL_TO_ARMS.poweredEffect.type).toBe(EFFECT_FREE_RECRUIT);
  });
});

// ============================================================================
// RESOLVABILITY TESTS
// ============================================================================

describe("EFFECT_CALL_TO_ARMS resolvability", () => {
  const effect: CallToArmsEffect = { type: EFFECT_CALL_TO_ARMS };

  it("should be resolvable when units are in the offer", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });

  it("should not be resolvable when offer is empty", () => {
    const state = createCallToArmsState([]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });

  it("should be resolvable with multiple units", () => {
    const state = createCallToArmsState([UNIT_PEASANTS, UNIT_UTEM_GUARDSMEN]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });
});

// ============================================================================
// CALL TO ARMS ENTRY POINT TESTS
// ============================================================================

describe("EFFECT_CALL_TO_ARMS", () => {
  const effect: CallToArmsEffect = { type: EFFECT_CALL_TO_ARMS };

  it("should return no-op when offer is empty", () => {
    const state = createCallToArmsState([]);

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No eligible units");
  });

  it("should auto-resolve to ability selection when only one unit in offer", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);

    const result = resolveEffect(state, "player1", effect);

    // Peasants have multiple abilities, so should present ability choices
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();

    // Should be ability selection options
    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY);
  });

  it("should present unit choices when multiple units in offer", () => {
    const state = createCallToArmsState([UNIT_PEASANTS, UNIT_UTEM_GUARDSMEN]);

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveCallToArmsUnitEffect[];
    expect(options.length).toBe(2);
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_UNIT);
    expect(options[1]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_UNIT);
  });

  it("should exclude Magic Familiars from choices", () => {
    const state = createCallToArmsState([UNIT_MAGIC_FAMILIARS, UNIT_PEASANTS]);

    const result = resolveEffect(state, "player1", effect);

    // Should auto-resolve to Peasants abilities (only eligible unit)
    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY);
  });

  it("should exclude Delphana Masters from choices", () => {
    const state = createCallToArmsState([UNIT_DELPHANA_MASTERS, UNIT_PEASANTS]);

    const result = resolveEffect(state, "player1", effect);

    // Should auto-resolve to Peasants abilities (only eligible unit)
    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY);
  });

  it("should return no-op when only excluded units in offer", () => {
    const state = createCallToArmsState([UNIT_MAGIC_FAMILIARS, UNIT_DELPHANA_MASTERS]);

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No eligible units");
  });

  it("should not modify state when presenting choices", () => {
    const state = createCallToArmsState([UNIT_PEASANTS, UNIT_UTEM_GUARDSMEN]);

    const result = resolveEffect(state, "player1", effect);

    expect(result.state).toBe(state);
  });
});

// ============================================================================
// RESOLVE UNIT SELECTION TESTS
// ============================================================================

describe("EFFECT_RESOLVE_CALL_TO_ARMS_UNIT", () => {
  it("should present ability choices for selected unit", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS];

    const effect: ResolveCallToArmsUnitEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
      unitId: UNIT_PEASANTS,
      unitName: unitDef?.name ?? "Peasants",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    expect(options.length).toBeGreaterThan(0);
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY);
    expect(options[0]?.unitId).toBe(UNIT_PEASANTS);
  });

  it("should exclude passive abilities from choices", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS];

    const effect: ResolveCallToArmsUnitEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
      unitId: UNIT_PEASANTS,
      unitName: unitDef?.name ?? "Peasants",
    };

    const result = resolveEffect(state, "player1", effect);

    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    // Peasants have Attack, Block, Influence, Move — no passive abilities
    // Each should have an abilityDescription
    for (const opt of options) {
      expect(opt.abilityDescription).toBeDefined();
      expect(opt.abilityDescription.length).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// RESOLVE ABILITY SELECTION TESTS
// ============================================================================

describe("EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY", () => {
  it("should resolve an Attack ability and gain attack points", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS]!;

    // Find the attack ability index
    const attackIndex = unitDef.abilities.findIndex(
      (a) => a.type === "attack"
    );
    expect(attackIndex).toBeGreaterThanOrEqual(0);

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: attackIndex,
      abilityDescription: `Peasants: Attack ${unitDef.abilities[attackIndex]!.value}`,
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    // Peasants' attack has ELEMENT_PHYSICAL, so it goes into normalElements.physical
    expect(player.combatAccumulator.attack.normalElements.physical).toBe(
      unitDef.abilities[attackIndex]!.value!
    );
  });

  it("should resolve a Block ability and gain block points", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS]!;

    // Find the block ability index
    const blockIndex = unitDef.abilities.findIndex(
      (a) => a.type === "block"
    );
    expect(blockIndex).toBeGreaterThanOrEqual(0);

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: blockIndex,
      abilityDescription: `Peasants: Block ${unitDef.abilities[blockIndex]!.value}`,
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    expect(player.combatAccumulator.block).toBe(
      unitDef.abilities[blockIndex]!.value!
    );
  });

  it("should resolve a Move ability and gain move points", () => {
    const state = createCallToArmsState([UNIT_PEASANTS], { movePoints: 0 });
    const unitDef = UNITS[UNIT_PEASANTS]!;

    // Find the move ability index
    const moveIndex = unitDef.abilities.findIndex(
      (a) => a.type === "move"
    );
    expect(moveIndex).toBeGreaterThanOrEqual(0);

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: moveIndex,
      abilityDescription: `Peasants: Move ${unitDef.abilities[moveIndex]!.value}`,
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    expect(player.movePoints).toBe(unitDef.abilities[moveIndex]!.value!);
  });

  it("should resolve an Influence ability and gain influence points", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS]!;

    // Find the influence ability index
    const influenceIndex = unitDef.abilities.findIndex(
      (a) => a.type === "influence"
    );
    expect(influenceIndex).toBeGreaterThanOrEqual(0);

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: influenceIndex,
      abilityDescription: `Peasants: Influence ${unitDef.abilities[influenceIndex]!.value}`,
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    expect(player.influencePoints).toBe(
      unitDef.abilities[influenceIndex]!.value!
    );
  });

  it("should return error for invalid unit ID", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: "nonexistent_unit" as UnitId,
      unitName: "Unknown",
      abilityIndex: 0,
      abilityDescription: "Unknown ability",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("not found");
  });

  it("should return error for invalid ability index", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS]!;

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: 99,
      abilityDescription: "Invalid ability",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("Invalid ability index");
  });

  it("should set resolvedEffect on the result", () => {
    const state = createCallToArmsState([UNIT_PEASANTS]);
    const unitDef = UNITS[UNIT_PEASANTS]!;

    const attackIndex = unitDef.abilities.findIndex(
      (a) => a.type === "attack"
    );

    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: unitDef.name,
      abilityIndex: attackIndex,
      abilityDescription: `Peasants: Attack ${unitDef.abilities[attackIndex]!.value}`,
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.resolvedEffect).toBeDefined();
  });
});

// ============================================================================
// FORESTERS — HAS ONLY BLOCK AND MOVE (NO PASSIVE TO FILTER)
// ============================================================================

describe("Call to Arms with Foresters", () => {
  it("should present Block and Move abilities for Foresters", () => {
    const state = createCallToArmsState([UNIT_FORESTERS]);

    const effect: CallToArmsEffect = { type: EFFECT_CALL_TO_ARMS };

    const result = resolveEffect(state, "player1", effect);

    // Foresters have Block 3 and Move 2 — both should be available
    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveCallToArmsAbilityEffect[];
    expect(options.length).toBeGreaterThanOrEqual(2);

    const descriptions = options.map((o) => o.abilityDescription);
    expect(descriptions.some((d) => d.includes("Block"))).toBe(true);
    expect(descriptions.some((d) => d.includes("Move"))).toBe(true);
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Call to Arms effects", () => {
  it("should describe EFFECT_CALL_TO_ARMS", () => {
    const effect: CallToArmsEffect = { type: EFFECT_CALL_TO_ARMS };
    const desc = describeEffect(effect);
    expect(desc).toContain("Borrow");
  });

  it("should describe EFFECT_RESOLVE_CALL_TO_ARMS_UNIT", () => {
    const effect: ResolveCallToArmsUnitEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
      unitId: UNIT_PEASANTS,
      unitName: "Peasants",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Peasants");
  });

  it("should describe EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY", () => {
    const effect: ResolveCallToArmsAbilityEffect = {
      type: EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
      unitId: UNIT_PEASANTS,
      unitName: "Peasants",
      abilityIndex: 0,
      abilityDescription: "Peasants: Attack 2",
    };
    const desc = describeEffect(effect);
    expect(desc).toBe("Peasants: Attack 2");
  });
});
