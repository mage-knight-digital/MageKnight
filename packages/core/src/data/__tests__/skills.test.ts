/**
 * Skill definitions tests
 *
 * Tests for skill effects and categories.
 */

import { describe, it, expect } from "vitest";
import {
  SKILLS,
  SKILL_ARYTHEA_HOT_SWORDSMANSHIP,
  SKILL_TOVAK_COLD_SWORDSMANSHIP,
} from "../skills/index.js";
import {
  EFFECT_CHOICE,
  EFFECT_GAIN_ATTACK,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import { CARD_CATEGORY_COMBAT } from "../../types/cards.js";
import { ELEMENT_FIRE } from "@mage-knight/shared";
import type { ChoiceEffect, GainAttackEffect } from "../../types/cards.js";

describe("Hot Swordsmanship (Arythea)", () => {
  const skill = SKILLS[SKILL_ARYTHEA_HOT_SWORDSMANSHIP];

  it("should have the correct metadata", () => {
    expect(skill.id).toBe(SKILL_ARYTHEA_HOT_SWORDSMANSHIP);
    expect(skill.name).toBe("Hot Swordsmanship");
    expect(skill.heroId).toBe("arythea");
    expect(skill.description).toBe("Attack 2 or Fire Attack 2");
    expect(skill.usageType).toBe("once_per_turn");
  });

  it("should have Combat category", () => {
    expect(skill.categories).toBeDefined();
    expect(skill.categories).toContain(CARD_CATEGORY_COMBAT);
  });

  it("should have a choice effect", () => {
    expect(skill.effect).toBeDefined();
    expect(skill.effect?.type).toBe(EFFECT_CHOICE);
  });

  it("should offer two attack options", () => {
    const effect = skill.effect as ChoiceEffect;
    expect(effect.options).toHaveLength(2);
  });

  it("should have Attack 2 (physical melee) as first option", () => {
    const effect = skill.effect as ChoiceEffect;
    const firstOption = effect.options[0] as GainAttackEffect;

    expect(firstOption.type).toBe(EFFECT_GAIN_ATTACK);
    expect(firstOption.amount).toBe(2);
    expect(firstOption.combatType).toBe(COMBAT_TYPE_MELEE);
    expect(firstOption.element).toBeUndefined(); // Physical attack has no element
  });

  it("should have Fire Attack 2 as second option", () => {
    const effect = skill.effect as ChoiceEffect;
    const secondOption = effect.options[1] as GainAttackEffect;

    expect(secondOption.type).toBe(EFFECT_GAIN_ATTACK);
    expect(secondOption.amount).toBe(2);
    expect(secondOption.combatType).toBe(COMBAT_TYPE_MELEE);
    expect(secondOption.element).toBe(ELEMENT_FIRE);
  });
});

describe("Cold Swordsmanship (Tovak) - reference comparison", () => {
  const skill = SKILLS[SKILL_TOVAK_COLD_SWORDSMANSHIP];

  it("should have the correct metadata", () => {
    expect(skill.id).toBe(SKILL_TOVAK_COLD_SWORDSMANSHIP);
    expect(skill.name).toBe("Cold Swordsmanship");
    expect(skill.heroId).toBe("tovak");
    expect(skill.description).toBe("Attack 2 or Ice Attack 2");
    expect(skill.usageType).toBe("once_per_turn");
  });

  it("should not have effect yet (not implemented)", () => {
    // Cold Swordsmanship is the equivalent skill for Tovak
    // but has not been implemented yet - effect should be undefined
    expect(skill.effect).toBeUndefined();
  });
});
