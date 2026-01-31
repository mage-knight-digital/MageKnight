/**
 * Tests for Burning Power skill (Arythea)
 *
 * Burning Power: Siege Attack 1 or Fire Siege Attack 1
 * Usage: Once per turn
 * Category: Combat
 */

import { describe, it, expect } from "vitest";
import {
  SKILLS,
  SKILL_ARYTHEA_BURNING_POWER,
  SKILL_USAGE_ONCE_PER_TURN,
} from "../index.js";
import {
  EFFECT_CHOICE,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_SIEGE,
} from "../../../types/effectTypes.js";
import { CARD_CATEGORY_COMBAT } from "../../../types/cards.js";
import { ELEMENT_FIRE } from "@mage-knight/shared";

describe("Burning Power skill", () => {
  const skill = SKILLS[SKILL_ARYTHEA_BURNING_POWER];

  describe("skill definition", () => {
    it("should have correct basic properties", () => {
      expect(skill.id).toBe(SKILL_ARYTHEA_BURNING_POWER);
      expect(skill.name).toBe("Burning Power");
      expect(skill.heroId).toBe("arythea");
      expect(skill.description).toBe("Siege Attack 1 or Fire Siege Attack 1");
      expect(skill.usageType).toBe(SKILL_USAGE_ONCE_PER_TURN);
    });

    it("should have Combat category", () => {
      expect(skill.categories).toBeDefined();
      expect(skill.categories).toContain(CARD_CATEGORY_COMBAT);
    });
  });

  describe("effect definition", () => {
    it("should have a choice effect", () => {
      expect(skill.effect).toBeDefined();
      expect(skill.effect?.type).toBe(EFFECT_CHOICE);
    });

    it("should have two options", () => {
      expect(skill.effect?.type).toBe(EFFECT_CHOICE);
      if (skill.effect?.type === EFFECT_CHOICE) {
        expect(skill.effect.options).toHaveLength(2);
      }
    });

    it("should have physical Siege Attack 1 as first option", () => {
      if (skill.effect?.type !== EFFECT_CHOICE) {
        throw new Error("Expected choice effect");
      }

      const option1 = skill.effect.options[0];
      expect(option1.type).toBe(EFFECT_GAIN_ATTACK);
      if (option1.type === EFFECT_GAIN_ATTACK) {
        expect(option1.amount).toBe(1);
        expect(option1.combatType).toBe(COMBAT_TYPE_SIEGE);
        // Physical attack has no element
        expect(option1.element).toBeUndefined();
      }
    });

    it("should have Fire Siege Attack 1 as second option", () => {
      if (skill.effect?.type !== EFFECT_CHOICE) {
        throw new Error("Expected choice effect");
      }

      const option2 = skill.effect.options[1];
      expect(option2.type).toBe(EFFECT_GAIN_ATTACK);
      if (option2.type === EFFECT_GAIN_ATTACK) {
        expect(option2.amount).toBe(1);
        expect(option2.combatType).toBe(COMBAT_TYPE_SIEGE);
        expect(option2.element).toBe(ELEMENT_FIRE);
      }
    });
  });
});
