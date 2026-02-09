/**
 * Tests for Circlet of Proficiency artifact (#234)
 */

import { describe, expect, it } from "vitest";
import { resolveEffect } from "../effects/index.js";
import { getSkillOptions } from "../validActions/skills.js";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { CIRCLET_OF_PROFICIENCY } from "../../data/artifacts/circletOfProficiency.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
  type CardEffect,
} from "../../types/cards.js";
import {
  EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
  EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
  EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
  EFFECT_RESOLVE_CIRCLET_POWERED_SKILL,
  EFFECT_COMPOUND,
} from "../../types/effectTypes.js";
import {
  CARD_CIRCLET_OF_PROFICIENCY,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import {
  SKILL_ARYTHEA_DARK_PATHS,
  SKILL_NOROWAS_INSPIRATION,
  SKILL_NOROWAS_PRAYER_OF_WEATHER,
  SKILL_WOLFHAWK_ON_HER_OWN,
} from "../../data/skills/index.js";
import { SKILL_NOROWAS_BONDS_OF_LOYALTY } from "../../data/skills/norowas/bondsOfLoyalty.js";

function getPlayer(state: ReturnType<typeof createTestGameState>) {
  return state.players[0]!;
}

function getCircletBasicOptions(result: ReturnType<typeof resolveEffect>): readonly CardEffect[] {
  expect(result.requiresChoice).toBe(true);
  expect(result.dynamicChoiceOptions).toBeDefined();
  return result.dynamicChoiceOptions!;
}

describe("Circlet of Proficiency card definition", () => {
  it("has correct metadata", () => {
    expect(CIRCLET_OF_PROFICIENCY.id).toBe(CARD_CIRCLET_OF_PROFICIENCY);
    expect(CIRCLET_OF_PROFICIENCY.name).toBe("Circlet of Proficiency");
    expect(CIRCLET_OF_PROFICIENCY.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
    expect(CIRCLET_OF_PROFICIENCY.categories).toEqual([CATEGORY_SPECIAL]);
    expect(CIRCLET_OF_PROFICIENCY.poweredBy).toEqual([
      MANA_RED,
      MANA_BLUE,
      MANA_GREEN,
      MANA_WHITE,
    ]);
    expect(CIRCLET_OF_PROFICIENCY.destroyOnPowered).toBe(true);
  });

  it("uses circlet effect entries for both modes", () => {
    expect(CIRCLET_OF_PROFICIENCY.basicEffect).toEqual({
      type: EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
    });
    expect(CIRCLET_OF_PROFICIENCY.poweredEffect).toEqual({
      type: EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
    });
  });
});

describe("EFFECT_CIRCLET_OF_PROFICIENCY_BASIC", () => {
  it("offers only non-interactive activatable skills", () => {
    const player = createTestPlayer({
      hand: [CARD_CIRCLET_OF_PROFICIENCY],
      skills: [],
    });
    const state = createTestGameState({
      players: [player],
      offers: {
        ...createTestGameState().offers,
        commonSkills: [
          SKILL_ARYTHEA_DARK_PATHS,
          SKILL_NOROWAS_PRAYER_OF_WEATHER,
          SKILL_NOROWAS_BONDS_OF_LOYALTY,
        ],
      },
    });

    const result = resolveEffect(state, "player1", {
      type: EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
    });

    const options = getCircletBasicOptions(result);
    expect(options).toHaveLength(1);

    const onlyOption = options[0]!;
    expect(onlyOption.type).toBe(EFFECT_COMPOUND);

    const compound = onlyOption as import("../../types/cards.js").CompoundEffect;
    expect(compound.effects).toHaveLength(2);
    expect(compound.effects[0]).toEqual(
      expect.objectContaining({
        type: EFFECT_RESOLVE_CIRCLET_BASIC_SKILL,
        skillId: SKILL_ARYTHEA_DARK_PATHS,
      })
    );
  });

  it("uses once-per-turn skills twice", () => {
    const player = createTestPlayer({
      hand: [CARD_CIRCLET_OF_PROFICIENCY],
      skills: [],
      influencePoints: 0,
    });
    const state = createTestGameState({
      players: [player],
      offers: {
        ...createTestGameState().offers,
        commonSkills: [SKILL_WOLFHAWK_ON_HER_OWN],
      },
    });

    const basicResult = resolveEffect(state, "player1", {
      type: EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
    });
    const options = getCircletBasicOptions(basicResult);

    const chosen = options[0]!;
    const resolved = resolveEffect(state, "player1", chosen);

    expect(getPlayer(resolved.state).influencePoints).toBe(6);
  });

  it("uses once-per-round skills once", () => {
    const player = createTestPlayer({
      hand: [CARD_CIRCLET_OF_PROFICIENCY],
      skills: [],
    });
    const state = createTestGameState({
      players: [player],
      offers: {
        ...createTestGameState().offers,
        commonSkills: [SKILL_NOROWAS_INSPIRATION],
      },
    });

    const result = resolveEffect(state, "player1", {
      type: EFFECT_CIRCLET_OF_PROFICIENCY_BASIC,
    });

    const options = getCircletBasicOptions(result);
    expect(options).toHaveLength(1);
    expect(options[0]!.type).toBe(EFFECT_RESOLVE_CIRCLET_BASIC_SKILL);
  });
});

describe("EFFECT_CIRCLET_OF_PROFICIENCY_POWERED", () => {
  it("acquires selected skill and removes it from common offer", () => {
    const player = createTestPlayer({
      hand: [CARD_CIRCLET_OF_PROFICIENCY],
      skills: [],
    });
    const state = createTestGameState({
      players: [player],
      offers: {
        ...createTestGameState().offers,
        commonSkills: [SKILL_ARYTHEA_DARK_PATHS],
      },
    });

    const entryResult = resolveEffect(state, "player1", {
      type: EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
    });

    expect(entryResult.requiresChoice).toBe(true);
    const options = entryResult.dynamicChoiceOptions!;
    expect(options).toHaveLength(1);
    expect(options[0]!.type).toBe(EFFECT_RESOLVE_CIRCLET_POWERED_SKILL);

    const resolveResult = resolveEffect(state, "player1", options[0]!);
    const updatedPlayer = getPlayer(resolveResult.state);

    expect(updatedPlayer.skills).toContain(SKILL_ARYTHEA_DARK_PATHS);
    expect(resolveResult.state.offers.commonSkills).not.toContain(
      SKILL_ARYTHEA_DARK_PATHS
    );
  });

  it("makes the acquired skill immediately activatable", () => {
    const player = createTestPlayer({
      hand: [CARD_CIRCLET_OF_PROFICIENCY],
      skills: [],
    });
    const state = createTestGameState({
      players: [player],
      offers: {
        ...createTestGameState().offers,
        commonSkills: [SKILL_ARYTHEA_DARK_PATHS],
      },
    });

    const entryResult = resolveEffect(state, "player1", {
      type: EFFECT_CIRCLET_OF_PROFICIENCY_POWERED,
    });
    const resolveResult = resolveEffect(
      state,
      "player1",
      entryResult.dynamicChoiceOptions![0]!
    );

    const updatedPlayer = getPlayer(resolveResult.state);
    const skillOptions = getSkillOptions(resolveResult.state, updatedPlayer);
    const activatableSkillIds = new Set(
      (skillOptions?.activatable ?? []).map((skill) => skill.skillId)
    );

    expect(activatableSkillIds.has(SKILL_ARYTHEA_DARK_PATHS)).toBe(true);
  });
});
