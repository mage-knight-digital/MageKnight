/**
 * Spell Forge Card Tests
 *
 * Tests for the Spell Forge advanced action card:
 *
 * Basic: Choose one spell card from the Spells Offer, gain a crystal of that spell's color.
 * Powered: Choose two different spell cards from the Spells Offer, gain a crystal for each.
 *
 * "Two different Spell cards" means distinct cards, not necessarily different colors.
 * If there are two blue spells, both can be picked.
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer } from "./testHelpers.js";
import { isEffectResolvable } from "../effects/resolvability.js";
import {
  EFFECT_SPELL_FORGE_BASIC,
  EFFECT_SPELL_FORGE_POWERED,
  EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
} from "../../types/effectTypes.js";
import type {
  SpellForgeBasicEffect,
  SpellForgePoweredEffect,
  ResolveSpellForgeCrystalEffect,
} from "../../types/cards.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { resolveEffect } from "../effects/index.js";
import {
  CARD_SPELL_FORGE,
  CARD_FIREBALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_CHILL,
  CARD_CURE,
} from "@mage-knight/shared";

const basicEffect: SpellForgeBasicEffect = { type: EFFECT_SPELL_FORGE_BASIC };
const poweredEffect: SpellForgePoweredEffect = { type: EFFECT_SPELL_FORGE_POWERED };

function createSpellForgeState(
  spellOffer: string[],
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    hand: [CARD_SPELL_FORGE],
    crystals: { red: 0, blue: 0, green: 0, white: 0 },
    ...playerOverrides,
  });

  return createTestGameState({
    players: [player],
    offers: {
      units: [],
      advancedActions: { cards: [] },
      spells: { cards: spellOffer },
      commonSkills: [],
      monasteryAdvancedActions: [],
      bondsOfLoyaltyBonusUnits: [],
    },
  });
}

// ============================================================================
// BASIC EFFECT: CHOOSE ONE SPELL, GAIN CRYSTAL
// ============================================================================

describe("Spell Forge Basic Effect", () => {
  it("should present choice of spells from offer", () => {
    // Red (Fireball) and Blue (Snowstorm) spells in offer
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM]);

    const result = resolveEffect(state, "player1", basicEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const options = result.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
    const colors = options.map((o) => o.color);
    expect(colors).toContain("red");
    expect(colors).toContain("blue");
  });

  it("should auto-resolve when only one spell in offer", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    const result = resolveEffect(state, "player1", basicEffect);

    expect(result.requiresChoice).toBeUndefined();
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);
    expect(result.resolvedEffect).toBeDefined();
  });

  it("should gain crystal of chosen spell's color", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    const result = resolveEffect(state, "player1", basicEffect);

    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);
    expect(updatedPlayer.crystals.blue).toBe(0);
    expect(updatedPlayer.crystals.green).toBe(0);
    expect(updatedPlayer.crystals.white).toBe(0);
  });

  it("should handle green spells", () => {
    const state = createSpellForgeState([CARD_RESTORATION]);

    const result = resolveEffect(state, "player1", basicEffect);

    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.green).toBe(1);
  });

  it("should handle white spells", () => {
    const state = createSpellForgeState([CARD_CURE]);

    const result = resolveEffect(state, "player1", basicEffect);

    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.white).toBe(1);
  });

  it("should handle blue spells", () => {
    const state = createSpellForgeState([CARD_CHILL]);

    const result = resolveEffect(state, "player1", basicEffect);

    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.blue).toBe(1);
  });

  it("should handle three spells in offer", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM, CARD_CURE]);

    const result = resolveEffect(state, "player1", basicEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(3);

    const options = result.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
    const colors = options.map((o) => o.color);
    expect(colors).toContain("red");
    expect(colors).toContain("blue");
    expect(colors).toContain("white");
  });

  it("should return no-op when spell offer is empty", () => {
    const state = createSpellForgeState([]);

    const result = resolveEffect(state, "player1", basicEffect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No spells");
  });

  it("should include spell names in options", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    const result = resolveEffect(state, "player1", basicEffect);

    // Auto-resolved since single option — check description mentions spell
    expect(result.description).toContain("red");
  });

  it("should handle duplicate color spells as separate options", () => {
    // Two blue spells — should show as two distinct options
    const state = createSpellForgeState([CARD_SNOWSTORM, CARD_CHILL]);

    const result = resolveEffect(state, "player1", basicEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const options = result.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
    // Both are blue
    expect(options[0]!.color).toBe("blue");
    expect(options[1]!.color).toBe("blue");
    // But different offer indices
    expect(options[0]!.offerIndex).toBe(0);
    expect(options[1]!.offerIndex).toBe(1);
  });
});

// ============================================================================
// POWERED EFFECT: CHOOSE TWO DIFFERENT SPELLS, GAIN CRYSTALS
// ============================================================================

describe("Spell Forge Powered Effect", () => {
  it("should present choice for first spell", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM, CARD_CURE]);

    const result = resolveEffect(state, "player1", poweredEffect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(3);
  });

  it("should chain to second choice after first crystal is gained", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM, CARD_CURE]);

    // Simulate choosing the first spell (red Fireball at index 0)
    const firstChoice: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "red",
      spellName: "Fireball",
      offerIndex: 0,
      chainSecondChoice: true,
    };

    const result = resolveEffect(state, "player1", firstChoice);

    // Should have gained red crystal
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);

    // Should present second choice (excluding Fireball at index 0)
    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toHaveLength(2);

    const options = result.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
    const indices = options.map((o) => o.offerIndex);
    expect(indices).not.toContain(0); // Fireball excluded
    expect(indices).toContain(1); // Snowstorm
    expect(indices).toContain(2); // Cure
  });

  it("should gain two crystals of different colors", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM]);

    // First choice: red (Fireball at index 0, chaining)
    const firstChoice: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "red",
      spellName: "Fireball",
      offerIndex: 0,
      chainSecondChoice: true,
    };

    const afterFirst = resolveEffect(state, "player1", firstChoice);

    // After first: red crystal gained, second choice auto-resolved (only Snowstorm left)
    const updatedPlayer = afterFirst.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);
    expect(updatedPlayer.crystals.blue).toBe(1);
  });

  it("should allow two crystals of same color from different spell cards", () => {
    // Two blue spells — "different cards" not "different colors"
    const state = createSpellForgeState([CARD_SNOWSTORM, CARD_CHILL]);

    // First choice: blue (Snowstorm at index 0, chaining)
    const firstChoice: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "blue",
      spellName: "Snowstorm",
      offerIndex: 0,
      chainSecondChoice: true,
    };

    const afterFirst = resolveEffect(state, "player1", firstChoice);

    // After first: one blue crystal, second auto-resolved (only Chill left) → two blue crystals
    const updatedPlayer = afterFirst.state.players[0]!;
    expect(updatedPlayer.crystals.blue).toBe(2);
  });

  it("should only gain one crystal when offer has single spell", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    const result = resolveEffect(state, "player1", poweredEffect);

    // Auto-resolved since only one spell
    expect(result.requiresChoice).toBeUndefined();
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);
  });

  it("should handle empty offer gracefully", () => {
    const state = createSpellForgeState([]);

    const result = resolveEffect(state, "player1", poweredEffect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No spells");
  });

  it("should not repeat same spell in second choice", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM]);

    const firstChoice: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "red",
      spellName: "Fireball",
      offerIndex: 0,
      chainSecondChoice: true,
    };

    const afterFirst = resolveEffect(state, "player1", firstChoice);

    // With 2 spells and 1 picked, second should auto-resolve (only 1 option left)
    // If it returned a choice, verify the first spell is excluded
    if (afterFirst.requiresChoice && afterFirst.dynamicChoiceOptions) {
      const options = afterFirst.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
      expect(options.every((o) => o.offerIndex !== 0)).toBe(true);
    }

    // Either way, player should have both crystals
    const updatedPlayer = afterFirst.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(1);
    expect(updatedPlayer.crystals.blue).toBe(1);
  });

  it("should present second choice when three spells in offer", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM, CARD_CURE]);

    // Pick Snowstorm (index 1)
    const firstChoice: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "blue",
      spellName: "Snowstorm",
      offerIndex: 1,
      chainSecondChoice: true,
    };

    const afterFirst = resolveEffect(state, "player1", firstChoice);

    // Blue crystal gained
    expect(afterFirst.state.players[0]!.crystals.blue).toBe(1);

    // Should present choice of remaining spells
    expect(afterFirst.requiresChoice).toBe(true);
    expect(afterFirst.dynamicChoiceOptions).toHaveLength(2);

    const options = afterFirst.dynamicChoiceOptions as ResolveSpellForgeCrystalEffect[];
    const colors = options.map((o) => o.color);
    expect(colors).toContain("red"); // Fireball
    expect(colors).toContain("white"); // Cure

    // None should chain further
    expect(options.every((o) => o.chainSecondChoice === false)).toBe(true);
  });
});

// ============================================================================
// RESOLVE CRYSTAL EFFECT
// ============================================================================

describe("Resolve Spell Forge Crystal Effect", () => {
  it("should gain crystal of specified color", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    const effect: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "green",
      spellName: "Whirlwind",
      offerIndex: 0,
      chainSecondChoice: false,
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.state.players[0]!.crystals.green).toBe(1);
  });

  it("should handle crystal overflow (max 3 per color)", () => {
    const state = createSpellForgeState([CARD_FIREBALL], {
      crystals: { red: 3, blue: 0, green: 0, white: 0 },
    });

    const effect: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "red",
      spellName: "Fireball",
      offerIndex: 0,
      chainSecondChoice: false,
    };

    const result = resolveEffect(state, "player1", effect);

    // At max — should overflow to mana token
    const updatedPlayer = result.state.players[0]!;
    expect(updatedPlayer.crystals.red).toBe(3);
    expect(updatedPlayer.pureMana.some((t) => t.color === "red")).toBe(true);
  });
});

// ============================================================================
// RESOLVABILITY
// ============================================================================

describe("Spell Forge Resolvability", () => {
  it("basic should be resolvable when spells are in offer", () => {
    const state = createSpellForgeState([CARD_FIREBALL]);

    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
  });

  it("basic should not be resolvable when offer is empty", () => {
    const state = createSpellForgeState([]);

    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
  });

  it("powered should be resolvable when spells are in offer", () => {
    const state = createSpellForgeState([CARD_FIREBALL, CARD_SNOWSTORM]);

    expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(true);
  });

  it("powered should not be resolvable when offer is empty", () => {
    const state = createSpellForgeState([]);

    expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
  });

  it("resolve crystal should always be resolvable", () => {
    const state = createSpellForgeState([]);

    const effect: ResolveSpellForgeCrystalEffect = {
      type: EFFECT_RESOLVE_SPELL_FORGE_CRYSTAL,
      color: "red",
      spellName: "Fireball",
      offerIndex: 0,
      chainSecondChoice: false,
    };

    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });
});
