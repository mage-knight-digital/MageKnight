/**
 * Tests for crystal overflow behavior
 *
 * When a player gains a crystal but is already at max (3 per color),
 * the overflow should be converted to a mana token instead of being
 * silently dropped.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  gainCrystalWithOverflow,
  MAX_CRYSTALS_PER_COLOR,
} from "../helpers/crystalHelpers.js";
import { applyGainCrystal } from "../effects/atomicResourceEffects.js";
import { resolveCrystallizeColor } from "../effects/crystallize.js";
import type { CrystallizeColorEffect } from "../../types/cards.js";
import { EFFECT_CRYSTALLIZE_COLOR } from "../../types/effectTypes.js";
import { MANA_TOKEN_SOURCE_CARD } from "@mage-knight/shared";

describe("Crystal Overflow Helper", () => {
  describe("gainCrystalWithOverflow", () => {
    it("should gain a crystal normally when below max", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
      });

      const result = gainCrystalWithOverflow(player, "red");

      expect(result.player.crystals.red).toBe(2);
      expect(result.crystalsGained).toBe(1);
      expect(result.tokensGained).toBe(0);
      expect(result.player.pureMana).toEqual(player.pureMana);
    });

    it("should overflow to mana token when at max crystals", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const result = gainCrystalWithOverflow(player, "red");

      expect(result.player.crystals.red).toBe(3); // Unchanged
      expect(result.crystalsGained).toBe(0);
      expect(result.tokensGained).toBe(1);
      expect(result.player.pureMana).toHaveLength(1);
      expect(result.player.pureMana[0]!.color).toBe("red");
      expect(result.player.pureMana[0]!.source).toBe(MANA_TOKEN_SOURCE_CARD);
    });

    it("should handle partial overflow (count=2 with 1 slot)", () => {
      const player = createTestPlayer({
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const result = gainCrystalWithOverflow(player, "red", 2);

      expect(result.player.crystals.red).toBe(3); // Gained 1 crystal
      expect(result.crystalsGained).toBe(1);
      expect(result.tokensGained).toBe(1);
      expect(result.player.pureMana).toHaveLength(1);
      expect(result.player.pureMana[0]!.color).toBe("red");
    });

    it("should handle full overflow (count=2 at max)", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const result = gainCrystalWithOverflow(player, "red", 2);

      expect(result.player.crystals.red).toBe(3); // Unchanged
      expect(result.crystalsGained).toBe(0);
      expect(result.tokensGained).toBe(2);
      expect(result.player.pureMana).toHaveLength(2);
    });

    it("should use custom token source when provided", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const result = gainCrystalWithOverflow(player, "red", 1, "skill");

      expect(result.player.pureMana[0]!.source).toBe("skill");
    });

    it("should preserve existing pureMana when overflowing", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: "blue", source: MANA_TOKEN_SOURCE_CARD }],
      });

      const result = gainCrystalWithOverflow(player, "red");

      expect(result.player.pureMana).toHaveLength(2);
      expect(result.player.pureMana[0]!.color).toBe("blue");
      expect(result.player.pureMana[1]!.color).toBe("red");
    });
  });

  describe("MAX_CRYSTALS_PER_COLOR", () => {
    it("should be 3", () => {
      expect(MAX_CRYSTALS_PER_COLOR).toBe(3);
    });
  });
});

describe("Crystal Overflow Integration", () => {
  describe("applyGainCrystal", () => {
    it("should overflow to token when at max crystals", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = applyGainCrystal(state, 0, player, "red");

      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.crystals.red).toBe(3);
      expect(updatedPlayer.pureMana).toHaveLength(1);
      expect(updatedPlayer.pureMana[0]!.color).toBe("red");
      expect(result.description).toContain("mana token instead");
    });

    it("should gain crystal normally when below max", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      const result = applyGainCrystal(state, 0, player, "red");

      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.crystals.red).toBe(2);
      expect(updatedPlayer.pureMana).toHaveLength(0);
    });
  });

  describe("resolveCrystallizeColor at max crystals", () => {
    it("should consume token but not gain crystal when at max", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: "red", source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: CrystallizeColorEffect = {
        type: EFFECT_CRYSTALLIZE_COLOR,
        color: "red",
      };

      const result = resolveCrystallizeColor(state, 0, player, effect);

      const updatedPlayer = result.state.players[0]!;
      // Crystal count should remain at max
      expect(updatedPlayer.crystals.red).toBe(3);
      // Token should be consumed
      expect(updatedPlayer.pureMana).toHaveLength(0);
      expect(result.description).toContain("already at max");
    });

    it("should convert token to crystal normally when below max", () => {
      const player = createTestPlayer({
        crystals: { red: 1, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: "red", source: MANA_TOKEN_SOURCE_CARD }],
      });
      const state = createTestGameState({ players: [player] });

      const effect: CrystallizeColorEffect = {
        type: EFFECT_CRYSTALLIZE_COLOR,
        color: "red",
      };

      const result = resolveCrystallizeColor(state, 0, player, effect);

      const updatedPlayer = result.state.players[0]!;
      expect(updatedPlayer.crystals.red).toBe(2);
      expect(updatedPlayer.pureMana).toHaveLength(0);
    });
  });
});
