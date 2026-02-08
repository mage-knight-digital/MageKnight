/**
 * Crystal Mastery Card Tests
 *
 * Tests for the Crystal Mastery advanced action card:
 *
 * Basic: Gain a crystal of a color you already own.
 *   - Presents choice of owned crystal colors below max (3).
 *   - Auto-resolves when only one color is eligible.
 *   - No-ops when player has no crystals or all owned colors are maxed.
 *
 * Powered: At end of turn, spent crystals this turn are returned to inventory.
 *   - Tracks crystal spending via MANA_SOURCE_CRYSTAL.
 *   - Returns all spent crystals at end of turn (capped at 3 per color).
 *   - Does NOT track crystal conversions (Sacrifice, Polarize).
 *
 * Crystal spending tracking:
 *   - spentCrystalsThisTurn is incremented when crystals are used as mana.
 *   - Undo correctly decrements the tracking.
 *   - Reset at end of turn via playerReset.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import {
  handleCrystalMasteryBasic,
  handleCrystalMasteryPowered,
  returnSpentCrystals,
} from "../effects/crystalMasteryEffects.js";
import { isEffectResolvable } from "../effects/resolvability.js";
import {
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
  EFFECT_GAIN_CRYSTAL,
} from "../../types/effectTypes.js";
import type {
  CrystalMasteryBasicEffect,
  CrystalMasteryPoweredEffect,
  GainCrystalEffect,
} from "../../types/cards.js";

const basicEffect: CrystalMasteryBasicEffect = { type: EFFECT_CRYSTAL_MASTERY_BASIC };
const poweredEffect: CrystalMasteryPoweredEffect = { type: EFFECT_CRYSTAL_MASTERY_POWERED };

// ============================================================================
// BASIC EFFECT: GAIN CRYSTAL OF COLOR YOU OWN
// ============================================================================

describe("Crystal Mastery Basic Effect", () => {
  it("should present choice of owned crystal colors", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 2, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const options = result.dynamicChoiceOptions as GainCrystalEffect[];
    const colors = options.map((o) => o.color);
    expect(colors).toContain("red");
    expect(colors).toContain("blue");
  });

  it("should auto-resolve when only one color is eligible", () => {
    const player = createTestPlayer({
      crystals: { red: 2, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    expect(result.requiresChoice).toBeUndefined();
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(3);
    expect(result.resolvedEffect).toEqual({ type: EFFECT_GAIN_CRYSTAL, color: "red" });
  });

  it("should return no-op when player has no crystals", () => {
    const player = createTestPlayer({
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No eligible");
  });

  it("should exclude colors already at max (3)", () => {
    const player = createTestPlayer({
      crystals: { red: 3, blue: 1, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    // Red is at max, only blue should be an option → auto-resolves
    expect(result.requiresChoice).toBeUndefined();
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.blue).toBe(2);
  });

  it("should return no-op when all owned colors are at max", () => {
    const player = createTestPlayer({
      crystals: { red: 3, blue: 3, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No eligible");
  });

  it("should present all four colors when all are owned and below max", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 1, green: 1, white: 1 },
    });
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryBasic(state, player.id, basicEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(4);
  });
});

// ============================================================================
// POWERED EFFECT: RETURN SPENT CRYSTALS AT END OF TURN
// ============================================================================

describe("Crystal Mastery Powered Effect", () => {
  it("should set crystalMasteryPoweredActive flag", () => {
    const player = createTestPlayer();
    const state = createTestGameState({ players: [player] });

    const result = handleCrystalMasteryPowered(state, player.id, poweredEffect);

    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystalMasteryPoweredActive).toBe(true);
  });
});

// ============================================================================
// CRYSTAL RETURN AT END OF TURN
// ============================================================================

describe("returnSpentCrystals", () => {
  it("should return spent crystals when powered is active", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 0, green: 2, white: 0 },
      spentCrystalsThisTurn: { red: 2, blue: 0, green: 1, white: 0 },
      crystalMasteryPoweredActive: true,
    });

    const result = returnSpentCrystals(player);

    expect(result.crystals.red).toBe(3); // 1 + 2 = 3
    expect(result.crystals.green).toBe(3); // 2 + 1 = 3
    expect(result.crystals.blue).toBe(0); // unchanged
    expect(result.crystals.white).toBe(0); // unchanged
  });

  it("should cap returned crystals at max 3 per color", () => {
    const player = createTestPlayer({
      crystals: { red: 2, blue: 0, green: 0, white: 0 },
      spentCrystalsThisTurn: { red: 3, blue: 0, green: 0, white: 0 },
      crystalMasteryPoweredActive: true,
    });

    const result = returnSpentCrystals(player);

    // 2 + 3 = 5, but capped at 3
    expect(result.crystals.red).toBe(3);
  });

  it("should not return crystals when powered is not active", () => {
    const player = createTestPlayer({
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
      spentCrystalsThisTurn: { red: 2, blue: 0, green: 0, white: 0 },
      crystalMasteryPoweredActive: false,
    });

    const result = returnSpentCrystals(player);

    expect(result.crystals.red).toBe(0); // not returned
  });

  it("should handle no spent crystals gracefully", () => {
    const player = createTestPlayer({
      crystals: { red: 2, blue: 1, green: 0, white: 0 },
      spentCrystalsThisTurn: { red: 0, blue: 0, green: 0, white: 0 },
      crystalMasteryPoweredActive: true,
    });

    const result = returnSpentCrystals(player);

    expect(result.crystals).toEqual(player.crystals);
  });

  it("should return all four colors of spent crystals", () => {
    const player = createTestPlayer({
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
      spentCrystalsThisTurn: { red: 1, blue: 2, green: 1, white: 3 },
      crystalMasteryPoweredActive: true,
    });

    const result = returnSpentCrystals(player);

    expect(result.crystals.red).toBe(1);
    expect(result.crystals.blue).toBe(2);
    expect(result.crystals.green).toBe(1);
    expect(result.crystals.white).toBe(3);
  });
});

// ============================================================================
// RESOLVABILITY
// ============================================================================

describe("Crystal Mastery Resolvability", () => {
  it("should be resolvable when player owns a crystal below max", () => {
    const player = createTestPlayer({
      crystals: { red: 1, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    expect(isEffectResolvable(state, player.id, basicEffect)).toBe(true);
  });

  it("should not be resolvable when player has no crystals", () => {
    const player = createTestPlayer({
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    expect(isEffectResolvable(state, player.id, basicEffect)).toBe(false);
  });

  it("should not be resolvable when all owned colors are at max", () => {
    const player = createTestPlayer({
      crystals: { red: 3, blue: 0, green: 3, white: 0 },
    });
    const state = createTestGameState({ players: [player] });

    expect(isEffectResolvable(state, player.id, basicEffect)).toBe(false);
  });

  it("powered effect should always be resolvable", () => {
    const player = createTestPlayer();
    const state = createTestGameState({ players: [player] });

    expect(isEffectResolvable(state, player.id, poweredEffect)).toBe(true);
  });
});

// ============================================================================
// CRYSTAL SPENDING TRACKING
// ============================================================================

describe("Crystal Spending Tracking", () => {
  it("should initialize spentCrystalsThisTurn to zeros", () => {
    const player = createTestPlayer();

    expect(player.spentCrystalsThisTurn).toEqual({
      red: 0,
      blue: 0,
      green: 0,
      white: 0,
    });
  });

  it("should initialize crystalMasteryPoweredActive to false", () => {
    const player = createTestPlayer();

    expect(player.crystalMasteryPoweredActive).toBe(false);
  });
});
