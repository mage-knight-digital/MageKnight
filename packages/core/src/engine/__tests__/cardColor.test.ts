/**
 * Tests for card color helpers - specifically getSpellColor
 */

import { describe, it, expect } from "vitest";
import { getSpellColor } from "../helpers/cardColor.js";
import type { CardId } from "@mage-knight/shared";
import {
  CARD_FIREBALL,
  CARD_BURNING_SHIELD,
  CARD_SNOWSTORM,
  CARD_CHILL,
  CARD_RESTORATION,
  CARD_WHIRLWIND,
  CARD_RAGE,
  CARD_MARCH,
  CARD_CRYSTALLIZE,
} from "@mage-knight/shared";
import {
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
} from "../../types/effectTypes.js";

describe("getSpellColor", () => {
  it("should return red for red spells", () => {
    expect(getSpellColor(CARD_FIREBALL)).toBe(CARD_COLOR_RED);
    expect(getSpellColor(CARD_BURNING_SHIELD)).toBe(CARD_COLOR_RED);
  });

  it("should return blue for blue spells", () => {
    expect(getSpellColor(CARD_SNOWSTORM)).toBe(CARD_COLOR_BLUE);
    expect(getSpellColor(CARD_CHILL)).toBe(CARD_COLOR_BLUE);
  });

  it("should return green for green spells", () => {
    expect(getSpellColor(CARD_RESTORATION)).toBe(CARD_COLOR_GREEN);
  });

  it("should return white for white spells", () => {
    expect(getSpellColor(CARD_WHIRLWIND)).toBe(CARD_COLOR_WHITE);
  });

  it("should return null for non-spell cards", () => {
    expect(getSpellColor(CARD_RAGE)).toBeNull();
    expect(getSpellColor(CARD_MARCH)).toBeNull();
    expect(getSpellColor(CARD_CRYSTALLIZE)).toBeNull();
  });

  it("should return null for unknown card IDs", () => {
    expect(getSpellColor("nonexistent_card" as CardId)).toBeNull();
  });
});
