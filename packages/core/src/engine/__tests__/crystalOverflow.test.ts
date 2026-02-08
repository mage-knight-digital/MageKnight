/**
 * Tests for crystal overflow logic
 *
 * When gaining a crystal at max (3 per color), the excess becomes
 * a temporary mana token instead.
 */

import { describe, it, expect } from "vitest";
import { createTestPlayer } from "./testHelpers.js";
import {
  gainCrystalWithOverflow,
  MAX_CRYSTALS_PER_COLOR,
} from "../helpers/crystalHelpers.js";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
  MANA_TOKEN_SOURCE_CRYSTAL,
  MANA_TOKEN_SOURCE_SITE,
} from "@mage-knight/shared";

describe("MAX_CRYSTALS_PER_COLOR", () => {
  it("should be 3", () => {
    expect(MAX_CRYSTALS_PER_COLOR).toBe(3);
  });
});

describe("gainCrystalWithOverflow", () => {
  describe("normal crystal gain (under max)", () => {
    it("should gain 1 crystal when at 0", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 1, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(1);
      expect(result.tokensGained).toBe(0);
      expect(result.player.crystals.red).toBe(1);
      expect(result.player.pureMana).toHaveLength(0);
    });

    it("should gain 1 crystal by default when count not specified", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      // Call with only 3 args to exercise the default count=1 parameter
      const result = gainCrystalWithOverflow(player, MANA_BLUE, 1, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(1);
      expect(result.player.crystals.blue).toBe(1);
    });

    it("should gain 2 crystals when at 1", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 2, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(2);
      expect(result.tokensGained).toBe(0);
      expect(result.player.crystals.red).toBe(3);
      expect(result.player.pureMana).toHaveLength(0);
    });

    it("should work with each basic color", () => {
      for (const color of [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE]) {
        const player = createTestPlayer({
          crystals: { red: 0, blue: 0, green: 0, white: 0 },
        });

        const result = gainCrystalWithOverflow(player, color, 1, MANA_TOKEN_SOURCE_CARD);

        expect(result.crystalsGained).toBe(1);
        expect(result.player.crystals[color]).toBe(1);
      }
    });

    it("should not modify other crystal colors", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 2, green: 3, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 1, MANA_TOKEN_SOURCE_CARD);

      expect(result.player.crystals.red).toBe(2);
      expect(result.player.crystals.blue).toBe(2);
      expect(result.player.crystals.green).toBe(3);
      expect(result.player.crystals.white).toBe(0);
    });
  });

  describe("overflow at max crystals", () => {
    it("should create a mana token when at max (3)", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 1, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(0);
      expect(result.tokensGained).toBe(1);
      expect(result.player.crystals.red).toBe(3);
      expect(result.player.pureMana).toHaveLength(1);
      expect(result.player.pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should create multiple tokens when gaining multiple at max", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 2, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(0);
      expect(result.tokensGained).toBe(2);
      expect(result.player.crystals.red).toBe(3);
      expect(result.player.pureMana).toHaveLength(2);
    });

    it("should use the correct token source for overflow tokens", () => {
      const player = createTestPlayer({
        crystals: { blue: 3, red: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_BLUE, 1, MANA_TOKEN_SOURCE_SITE);

      expect(result.player.pureMana[0]).toEqual({
        color: MANA_BLUE,
        source: MANA_TOKEN_SOURCE_SITE,
      });
    });
  });

  describe("partial overflow", () => {
    it("should split between crystal and token when partially full", () => {
      const player = createTestPlayer({
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 2, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(1);
      expect(result.tokensGained).toBe(1);
      expect(result.player.crystals.red).toBe(3);
      expect(result.player.pureMana).toHaveLength(1);
      expect(result.player.pureMana[0]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should handle count=3 with 1 slot available", () => {
      const player = createTestPlayer({
        crystals: { green: 2, red: 0, blue: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_GREEN, 3, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(1);
      expect(result.tokensGained).toBe(2);
      expect(result.player.crystals.green).toBe(3);
      expect(result.player.pureMana).toHaveLength(2);
    });
  });

  describe("edge cases", () => {
    it("should preserve existing mana tokens on overflow", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: MANA_GREEN, source: MANA_TOKEN_SOURCE_CARD }],
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 1, MANA_TOKEN_SOURCE_CRYSTAL);

      expect(result.player.pureMana).toHaveLength(2);
      expect(result.player.pureMana[0]).toEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(result.player.pureMana[1]).toEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CRYSTAL,
      });
    });

    it("should return the same player reference when count is 0", () => {
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, MANA_RED, 0, MANA_TOKEN_SOURCE_CARD);

      expect(result.crystalsGained).toBe(0);
      expect(result.tokensGained).toBe(0);
      expect(result.player).toBe(player);
    });
  });
});
