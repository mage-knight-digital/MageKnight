/**
 * Tests for the card boost effect (Concentration's powered effect)
 *
 * Card text: "When you play this, play another Action card with it.
 * Get the stronger effect of that card for free.
 * If that effect gives you Move, Influence, Block, or any type of Attack, get that amount plus 2."
 */

import { describe, it, expect } from "vitest";
import { addBonusToEffect } from "../effects/resolveEffect.js";
import type { CardEffect, ChoiceEffect, CompoundEffect, ConditionalEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_DRAW_CARDS,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { CONDITION_TIME_IS_DAY } from "../../types/conditions.js";
import { ELEMENT_FIRE, ELEMENT_ICE } from "@mage-knight/shared";

describe("addBonusToEffect", () => {
  describe("simple effects", () => {
    it("should add bonus to Move effect", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_MOVE, amount: 4 };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_MOVE);
      expect((boosted as typeof effect).amount).toBe(6);
    });

    it("should add bonus to Influence effect", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_INFLUENCE, amount: 4 };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_INFLUENCE);
      expect((boosted as typeof effect).amount).toBe(6);
    });

    it("should add bonus to Block effect", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_BLOCK, amount: 5 };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_BLOCK);
      expect((boosted as typeof effect).amount).toBe(7);
    });

    it("should add bonus to melee Attack effect", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 4,
        combatType: COMBAT_TYPE_MELEE,
      };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_ATTACK);
      expect((boosted as typeof effect).amount).toBe(6);
      expect((boosted as typeof effect).combatType).toBe(COMBAT_TYPE_MELEE);
    });

    it("should add bonus to ranged Attack effect", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_RANGED,
      };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_ATTACK);
      expect((boosted as typeof effect).amount).toBe(5);
      expect((boosted as typeof effect).combatType).toBe(COMBAT_TYPE_RANGED);
    });

    it("should add bonus to siege Attack effect", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 2,
        combatType: COMBAT_TYPE_SIEGE,
      };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_ATTACK);
      expect((boosted as typeof effect).amount).toBe(4);
      expect((boosted as typeof effect).combatType).toBe(COMBAT_TYPE_SIEGE);
    });

    it("should add bonus to Fire Attack effect", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_ATTACK,
        amount: 3,
        combatType: COMBAT_TYPE_MELEE,
        element: ELEMENT_FIRE,
      };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_ATTACK);
      expect((boosted as typeof effect).amount).toBe(5);
      expect((boosted as typeof effect).element).toBe(ELEMENT_FIRE);
    });

    it("should add bonus to Ice Block effect", () => {
      const effect: CardEffect = {
        type: EFFECT_GAIN_BLOCK,
        amount: 5,
        element: ELEMENT_ICE,
      };
      const boosted = addBonusToEffect(effect, 2);

      expect(boosted.type).toBe(EFFECT_GAIN_BLOCK);
      expect((boosted as typeof effect).amount).toBe(7);
      expect((boosted as typeof effect).element).toBe(ELEMENT_ICE);
    });

    it("should NOT modify Healing effect (per card rules)", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_HEALING, amount: 2 };
      const boosted = addBonusToEffect(effect, 2);

      // Healing is not in the list (Move, Influence, Block, Attack)
      expect(boosted).toEqual(effect);
    });

    it("should NOT modify Draw Cards effect", () => {
      const effect: CardEffect = { type: EFFECT_DRAW_CARDS, amount: 2 };
      const boosted = addBonusToEffect(effect, 2);

      // Draw is not in the list
      expect(boosted).toEqual(effect);
    });
  });

  describe("choice effects", () => {
    it("should add bonus to all options in a choice effect", () => {
      const effect: ChoiceEffect = {
        type: EFFECT_CHOICE,
        options: [
          { type: EFFECT_GAIN_MOVE, amount: 4 },
          { type: EFFECT_GAIN_ATTACK, amount: 4, combatType: COMBAT_TYPE_MELEE },
        ],
      };
      const boosted = addBonusToEffect(effect, 2) as ChoiceEffect;

      expect(boosted.type).toBe(EFFECT_CHOICE);
      expect(boosted.options).toHaveLength(2);
      expect((boosted.options[0] as { amount: number }).amount).toBe(6);
      expect((boosted.options[1] as { amount: number }).amount).toBe(6);
    });

    it("should only modify applicable options (Move/Influence/Block/Attack)", () => {
      const effect: ChoiceEffect = {
        type: EFFECT_CHOICE,
        options: [
          { type: EFFECT_GAIN_HEALING, amount: 2 },
          { type: EFFECT_DRAW_CARDS, amount: 2 },
          { type: EFFECT_GAIN_MOVE, amount: 4 },
        ],
      };
      const boosted = addBonusToEffect(effect, 2) as ChoiceEffect;

      expect((boosted.options[0] as { amount: number }).amount).toBe(2); // Heal unchanged
      expect((boosted.options[1] as { amount: number }).amount).toBe(2); // Draw unchanged
      expect((boosted.options[2] as { amount: number }).amount).toBe(6); // Move boosted
    });
  });

  describe("compound effects", () => {
    it("should add bonus to all applicable sub-effects", () => {
      const effect: CompoundEffect = {
        type: EFFECT_COMPOUND,
        effects: [
          { type: EFFECT_GAIN_INFLUENCE, amount: 5 },
          { type: EFFECT_GAIN_HEALING, amount: 1 },
        ],
      };
      const boosted = addBonusToEffect(effect, 2) as CompoundEffect;

      expect(boosted.type).toBe(EFFECT_COMPOUND);
      expect((boosted.effects[0] as { amount: number }).amount).toBe(7); // Influence boosted
      expect((boosted.effects[1] as { amount: number }).amount).toBe(1); // Heal unchanged
    });
  });

  describe("conditional effects", () => {
    it("should add bonus to both branches of conditional effect", () => {
      const effect: ConditionalEffect = {
        type: EFFECT_CONDITIONAL,
        condition: { type: CONDITION_TIME_IS_DAY },
        thenEffect: { type: EFFECT_GAIN_ATTACK, amount: 4, combatType: COMBAT_TYPE_MELEE },
        elseEffect: { type: EFFECT_GAIN_BLOCK, amount: 3 },
      };
      const boosted = addBonusToEffect(effect, 2) as ConditionalEffect;

      expect(boosted.type).toBe(EFFECT_CONDITIONAL);
      expect((boosted.thenEffect as { amount: number }).amount).toBe(6);
      expect((boosted.elseEffect as { amount: number }).amount).toBe(5);
    });

    it("should handle conditional without else branch", () => {
      const effect: ConditionalEffect = {
        type: EFFECT_CONDITIONAL,
        condition: { type: CONDITION_TIME_IS_DAY },
        thenEffect: { type: EFFECT_GAIN_MOVE, amount: 2 },
      };
      const boosted = addBonusToEffect(effect, 2) as ConditionalEffect;

      expect(boosted.type).toBe(EFFECT_CONDITIONAL);
      expect((boosted.thenEffect as { amount: number }).amount).toBe(4);
      expect(boosted.elseEffect).toBeUndefined();
    });
  });

  describe("Will Focus (+3 bonus)", () => {
    it("should support higher bonus values", () => {
      const effect: CardEffect = { type: EFFECT_GAIN_ATTACK, amount: 4, combatType: COMBAT_TYPE_MELEE };
      const boosted = addBonusToEffect(effect, 3);

      expect((boosted as typeof effect).amount).toBe(7);
    });
  });
});
