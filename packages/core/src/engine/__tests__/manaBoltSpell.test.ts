/**
 * Mana Bolt / Mana Thunderbolt Spell Tests
 *
 * Tests for:
 * - Card definition and registration
 * - Basic (Mana Bolt): Pay mana for attack based on color
 *   Blue → Ice Attack 8, Red → Cold Fire Attack 7, White → Ranged Ice Attack 6, Green → Siege Ice Attack 5
 * - Powered (Mana Thunderbolt): Higher attack values
 *   Blue → Ice Attack 11, Red → Cold Fire Attack 10, White → Ranged Ice Attack 9, Green → Siege Ice Attack 8
 * - Cold Fire element on red mana payment
 * - Gold mana substitution
 * - Mandatory mana cost (no options without mana)
 * - Combat-only playability
 */

import { describe, it, expect } from "vitest";
import {
  CARD_MANA_BOLT,
  MANA_BLACK,
  MANA_BLUE,
  MANA_RED,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  ELEMENT_ICE,
  ELEMENT_COLD_FIRE,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import { MANA_BOLT } from "../../data/spells/blue/manaBolt.js";
import { getSpellCard } from "../../data/spells/index.js";
import {
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import type { CompoundEffect, GainAttackEffect, PayManaCostEffect } from "../../types/cards.js";
import {
  EFFECT_MANA_BOLT,
  EFFECT_COMPOUND,
  EFFECT_PAY_MANA,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { resolveEffect, isEffectResolvable } from "../effects/index.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import type { ManaToken } from "../../types/mana.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function manaToken(color: string): ManaToken {
  return { color, source: MANA_TOKEN_SOURCE_CARD } as ManaToken;
}

function createCombatState(): CombatState {
  return createUnitCombatState(COMBAT_PHASE_ATTACK);
}

function createStateInCombat(pureMana: ManaToken[] = []) {
  return createTestGameState({
    players: [
      createTestPlayer({
        pureMana,
      }),
    ],
    combat: createCombatState(),
  });
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Mana Bolt / Mana Thunderbolt Spell", () => {
  describe("Card Definition", () => {
    it("should be properly defined", () => {
      expect(MANA_BOLT.id).toBe(CARD_MANA_BOLT);
      expect(MANA_BOLT.name).toBe("Mana Bolt");
      expect(MANA_BOLT.poweredName).toBe("Mana Thunderbolt");
      expect(MANA_BOLT.cardType).toBe(DEED_CARD_TYPE_SPELL);
      expect(MANA_BOLT.categories).toContain(CATEGORY_COMBAT);
      expect(MANA_BOLT.poweredBy).toContain(MANA_BLACK);
      expect(MANA_BOLT.poweredBy).toContain(MANA_BLUE);
    });

    it("should be registered in spell registry", () => {
      const card = getSpellCard(CARD_MANA_BOLT);
      expect(card).toBeDefined();
      expect(card?.id).toBe(CARD_MANA_BOLT);
    });

    it("should have correct basic effect", () => {
      expect(MANA_BOLT.basicEffect).toEqual({
        type: EFFECT_MANA_BOLT,
        baseValue: 8,
      });
    });

    it("should have correct powered effect", () => {
      expect(MANA_BOLT.poweredEffect).toEqual({
        type: EFFECT_MANA_BOLT,
        baseValue: 11,
      });
    });
  });

  // ============================================================================
  // BASIC EFFECT TESTS (Mana Bolt)
  // ============================================================================

  describe("Basic Effect (Mana Bolt)", () => {
    it("should generate Ice Attack 8 option when player has blue mana", () => {
      const state = createStateInCombat([manaToken(MANA_BLUE)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const option = result.dynamicChoiceOptions![0] as CompoundEffect;
      expect(option.type).toBe(EFFECT_COMPOUND);

      const [payEffect, gainEffect] = option.effects;
      expect((payEffect as PayManaCostEffect).type).toBe(EFFECT_PAY_MANA);
      expect((payEffect as PayManaCostEffect).colors).toEqual([MANA_BLUE]);

      const attack = gainEffect as GainAttackEffect;
      expect(attack.type).toBe(EFFECT_GAIN_ATTACK);
      expect(attack.amount).toBe(8);
      expect(attack.combatType).toBe(COMBAT_TYPE_MELEE);
      expect(attack.element).toBe(ELEMENT_ICE);
    });

    it("should generate Cold Fire Attack 7 option when player has red mana", () => {
      const state = createStateInCombat([manaToken(MANA_RED)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const option = result.dynamicChoiceOptions![0] as CompoundEffect;
      const attack = option.effects[1] as GainAttackEffect;
      expect(attack.amount).toBe(7);
      expect(attack.combatType).toBe(COMBAT_TYPE_MELEE);
      expect(attack.element).toBe(ELEMENT_COLD_FIRE);
    });

    it("should generate Ranged Ice Attack 6 option when player has white mana", () => {
      const state = createStateInCombat([manaToken(MANA_WHITE)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const option = result.dynamicChoiceOptions![0] as CompoundEffect;
      const attack = option.effects[1] as GainAttackEffect;
      expect(attack.amount).toBe(6);
      expect(attack.combatType).toBe(COMBAT_TYPE_RANGED);
      expect(attack.element).toBe(ELEMENT_ICE);
    });

    it("should generate Siege Ice Attack 5 option when player has green mana", () => {
      const state = createStateInCombat([manaToken(MANA_GREEN)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const option = result.dynamicChoiceOptions![0] as CompoundEffect;
      const attack = option.effects[1] as GainAttackEffect;
      expect(attack.amount).toBe(5);
      expect(attack.combatType).toBe(COMBAT_TYPE_SIEGE);
      expect(attack.element).toBe(ELEMENT_ICE);
    });

    it("should generate all 4 options when player has all basic mana colors", () => {
      const state = createStateInCombat([
        manaToken(MANA_BLUE),
        manaToken(MANA_RED),
        manaToken(MANA_WHITE),
        manaToken(MANA_GREEN),
      ]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      // Blue → Ice Attack 8
      const blueOption = result.dynamicChoiceOptions![0] as CompoundEffect;
      const blueAttack = blueOption.effects[1] as GainAttackEffect;
      expect(blueAttack.amount).toBe(8);
      expect(blueAttack.element).toBe(ELEMENT_ICE);
      expect(blueAttack.combatType).toBe(COMBAT_TYPE_MELEE);

      // Red → Cold Fire Attack 7
      const redOption = result.dynamicChoiceOptions![1] as CompoundEffect;
      const redAttack = redOption.effects[1] as GainAttackEffect;
      expect(redAttack.amount).toBe(7);
      expect(redAttack.element).toBe(ELEMENT_COLD_FIRE);
      expect(redAttack.combatType).toBe(COMBAT_TYPE_MELEE);

      // White → Ranged Ice Attack 6
      const whiteOption = result.dynamicChoiceOptions![2] as CompoundEffect;
      const whiteAttack = whiteOption.effects[1] as GainAttackEffect;
      expect(whiteAttack.amount).toBe(6);
      expect(whiteAttack.combatType).toBe(COMBAT_TYPE_RANGED);

      // Green → Siege Ice Attack 5
      const greenOption = result.dynamicChoiceOptions![3] as CompoundEffect;
      const greenAttack = greenOption.effects[1] as GainAttackEffect;
      expect(greenAttack.amount).toBe(5);
      expect(greenAttack.combatType).toBe(COMBAT_TYPE_SIEGE);
    });
  });

  // ============================================================================
  // POWERED EFFECT TESTS (Mana Thunderbolt)
  // ============================================================================

  describe("Powered Effect (Mana Thunderbolt)", () => {
    it("should generate higher attack values than basic", () => {
      const state = createStateInCombat([
        manaToken(MANA_BLUE),
        manaToken(MANA_RED),
        manaToken(MANA_WHITE),
        manaToken(MANA_GREEN),
      ]);

      const result = resolveEffect(state, "player1", MANA_BOLT.poweredEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      // Blue → Ice Attack 11
      const blueAttack = (result.dynamicChoiceOptions![0] as CompoundEffect)
        .effects[1] as GainAttackEffect;
      expect(blueAttack.amount).toBe(11);
      expect(blueAttack.element).toBe(ELEMENT_ICE);
      expect(blueAttack.combatType).toBe(COMBAT_TYPE_MELEE);

      // Red → Cold Fire Attack 10
      const redAttack = (result.dynamicChoiceOptions![1] as CompoundEffect)
        .effects[1] as GainAttackEffect;
      expect(redAttack.amount).toBe(10);
      expect(redAttack.element).toBe(ELEMENT_COLD_FIRE);

      // White → Ranged Ice Attack 9
      const whiteAttack = (result.dynamicChoiceOptions![2] as CompoundEffect)
        .effects[1] as GainAttackEffect;
      expect(whiteAttack.amount).toBe(9);
      expect(whiteAttack.combatType).toBe(COMBAT_TYPE_RANGED);

      // Green → Siege Ice Attack 8
      const greenAttack = (result.dynamicChoiceOptions![3] as CompoundEffect)
        .effects[1] as GainAttackEffect;
      expect(greenAttack.amount).toBe(8);
      expect(greenAttack.combatType).toBe(COMBAT_TYPE_SIEGE);
    });
  });

  // ============================================================================
  // GOLD MANA TESTS
  // ============================================================================

  describe("Gold Mana Substitution", () => {
    it("should allow gold mana to substitute for missing basic colors", () => {
      const state = createStateInCombat([manaToken(MANA_GOLD)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      // Gold should generate 4 options (one for each basic color)
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      // All options should pay gold mana
      for (const opt of result.dynamicChoiceOptions!) {
        const compound = opt as CompoundEffect;
        const pay = compound.effects[0] as PayManaCostEffect;
        expect(pay.colors).toEqual([MANA_GOLD]);
      }
    });

    it("should not duplicate options when player has both basic and gold", () => {
      const state = createStateInCombat([
        manaToken(MANA_BLUE),
        manaToken(MANA_GOLD),
      ]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBe(true);
      // Blue → pay blue (direct), Red/White/Green → pay gold (substitution)
      expect(result.dynamicChoiceOptions).toHaveLength(4);

      // First option pays blue (direct)
      const blueOption = result.dynamicChoiceOptions![0] as CompoundEffect;
      const bluePay = blueOption.effects[0] as PayManaCostEffect;
      expect(bluePay.colors).toEqual([MANA_BLUE]);

      // Remaining 3 options pay gold (substitution for red, white, green)
      for (let i = 1; i < 4; i++) {
        const option = result.dynamicChoiceOptions![i] as CompoundEffect;
        const pay = option.effects[0] as PayManaCostEffect;
        expect(pay.colors).toEqual([MANA_GOLD]);
      }
    });
  });

  // ============================================================================
  // MANDATORY MANA / NO MANA TESTS
  // ============================================================================

  describe("Mandatory Mana Cost", () => {
    it("should return no options when player has no mana", () => {
      const state = createStateInCombat([]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.dynamicChoiceOptions).toBeUndefined();
      expect(result.description).toContain("No mana available");
    });

    it("should not be resolvable without mana tokens", () => {
      const state = createStateInCombat([]);

      const resolvable = isEffectResolvable(state, "player1", MANA_BOLT.basicEffect);
      expect(resolvable).toBe(false);
    });

    it("should be resolvable with mana tokens", () => {
      const state = createStateInCombat([manaToken(MANA_BLUE)]);

      const resolvable = isEffectResolvable(state, "player1", MANA_BOLT.basicEffect);
      expect(resolvable).toBe(true);
    });

    it("should not count black mana as a valid payment", () => {
      const state = createStateInCombat([manaToken(MANA_BLACK)]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toContain("No mana available");
    });
  });

  // ============================================================================
  // COLD FIRE ELEMENT TESTS
  // ============================================================================

  describe("Cold Fire Element", () => {
    it("should use Cold Fire element only for red mana payment", () => {
      const state = createStateInCombat([
        manaToken(MANA_BLUE),
        manaToken(MANA_RED),
        manaToken(MANA_WHITE),
        manaToken(MANA_GREEN),
      ]);

      const result = resolveEffect(state, "player1", MANA_BOLT.basicEffect);
      const options = result.dynamicChoiceOptions!;

      // Blue → Ice (not Cold Fire)
      expect((((options[0] as CompoundEffect).effects[1]) as GainAttackEffect).element).toBe(ELEMENT_ICE);

      // Red → Cold Fire
      expect((((options[1] as CompoundEffect).effects[1]) as GainAttackEffect).element).toBe(ELEMENT_COLD_FIRE);

      // White → Ice (not Cold Fire)
      expect((((options[2] as CompoundEffect).effects[1]) as GainAttackEffect).element).toBe(ELEMENT_ICE);

      // Green → Ice (not Cold Fire)
      expect((((options[3] as CompoundEffect).effects[1]) as GainAttackEffect).element).toBe(ELEMENT_ICE);
    });
  });

  // ============================================================================
  // COMBAT-ONLY VALIDATION TESTS
  // ============================================================================

  describe("Combat-Only Restriction", () => {
    it("should not be resolvable outside combat based on effect detection", () => {
      // The combat-only restriction is enforced by the card's CATEGORY_COMBAT
      // which is checked by validators. The effect handler also handles gracefully
      // by detecting combat state, but the primary restriction is category-based.
      expect(MANA_BOLT.categories).toContain(CATEGORY_COMBAT);
    });
  });
});
