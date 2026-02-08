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
import { reverseEffect } from "../effects/reverse.js";
import { grantCrystalRollReward } from "../helpers/rewards/handlers.js";
import type { CrystallizeColorEffect, GainCrystalEffect } from "../../types/cards.js";
import { EFFECT_CRYSTALLIZE_COLOR, EFFECT_GAIN_CRYSTAL } from "../../types/effectTypes.js";
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

  describe("reverseEffect with EFFECT_GAIN_CRYSTAL", () => {
    it("should remove overflow token when crystals at max", () => {
      // Simulate state after forward pass: crystals at max, overflow token present
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [{ color: "red", source: MANA_TOKEN_SOURCE_CARD }],
      });

      const effect: GainCrystalEffect = {
        type: EFFECT_GAIN_CRYSTAL,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(3); // Still at max
      expect(reversed.pureMana).toHaveLength(0); // Overflow token removed
    });

    it("should return unchanged when overflow token already spent", () => {
      // Simulate state where overflow token was already used
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [], // Token was spent
      });

      const effect: GainCrystalEffect = {
        type: EFFECT_GAIN_CRYSTAL,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(3);
      expect(reversed.pureMana).toHaveLength(0);
    });

    it("should decrement crystal normally when below max", () => {
      const player = createTestPlayer({
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const effect: GainCrystalEffect = {
        type: EFFECT_GAIN_CRYSTAL,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(1);
    });
  });

  describe("reverseEffect with EFFECT_CRYSTALLIZE_COLOR", () => {
    it("should decrement crystal and restore token at max", () => {
      // Forward pass at max: token consumed, no crystal gained
      // Reverse: decrements crystal (since crystals > 0 && <= MAX) and restores token
      const player = createTestPlayer({
        crystals: { red: 3, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const effect: CrystallizeColorEffect = {
        type: EFFECT_CRYSTALLIZE_COLOR,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(2);
      expect(reversed.pureMana).toHaveLength(1);
      expect(reversed.pureMana[0]!.color).toBe("red");
    });

    it("should not decrement crystal when at zero and restore token", () => {
      // Edge case: crystals at 0 means crystalWasGained is false
      const player = createTestPlayer({
        crystals: { red: 0, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const effect: CrystallizeColorEffect = {
        type: EFFECT_CRYSTALLIZE_COLOR,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(0); // No crystal to remove
      expect(reversed.pureMana).toHaveLength(1); // Token restored
      expect(reversed.pureMana[0]!.color).toBe("red");
    });

    it("should decrement crystal and restore token when below max", () => {
      const player = createTestPlayer({
        crystals: { red: 2, blue: 0, green: 0, white: 0 },
        pureMana: [],
      });

      const effect: CrystallizeColorEffect = {
        type: EFFECT_CRYSTALLIZE_COLOR,
        color: "red",
      };

      const reversed = reverseEffect(player, effect);

      expect(reversed.crystals.red).toBe(1);
      expect(reversed.pureMana).toHaveLength(1);
      expect(reversed.pureMana[0]!.color).toBe("red");
    });
  });

  describe("grantCrystalRollReward with overflow", () => {
    it("should overflow crystal rolls when all colors at max", () => {
      const player = createTestPlayer({
        crystals: { red: 3, blue: 3, green: 3, white: 3 },
        pureMana: [],
      });
      const state = createTestGameState({ players: [player] });

      // Roll 6 dice — all at max, so basic color rolls overflow,
      // gold rolls overflow (auto-picks green which is at max),
      // black rolls give fame
      const result = grantCrystalRollReward(state, "player1", 6);

      const updatedPlayer = result.state.players[0]!;
      // All crystals should stay at max
      expect(updatedPlayer.crystals.red).toBe(3);
      expect(updatedPlayer.crystals.blue).toBe(3);
      expect(updatedPlayer.crystals.green).toBe(3);
      expect(updatedPlayer.crystals.white).toBe(3);

      // Should have some combination of overflow tokens and fame
      // (exact split depends on RNG, but total should be 6)
      const tokenCount = updatedPlayer.pureMana.length;
      const fameGained = updatedPlayer.fame - player.fame;
      expect(tokenCount + fameGained).toBe(6);
    });
  });
});
