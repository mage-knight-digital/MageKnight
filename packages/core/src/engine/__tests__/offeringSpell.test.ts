/**
 * Tests for the Offering / Sacrifice spell (Red Spell #46)
 *
 * Basic (Offering): Gain a red crystal. You may discard up to 3 non-Wound cards
 * from your hand. For each discarded card, gain a crystal of matching color.
 * For artifacts, you choose any basic color.
 *
 * Powered (Sacrifice): Choose green OR white, then choose red OR blue.
 * Count crystal pairs of chosen colors:
 * - green+red → Siege Fire Attack 4 per pair
 * - green+blue → Siege Ice Attack 4 per pair
 * - white+red → Ranged Fire Attack 6 per pair
 * - white+blue → Ranged Ice Attack 6 per pair
 * Then convert ALL complete crystal pairs to mana tokens (immediately usable).
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  SacrificeEffect,
  ResolveSacrificeEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_DISCARD_FOR_CRYSTAL,
  EFFECT_SACRIFICE,
  EFFECT_RESOLVE_SACRIFICE,
} from "../../types/effectTypes.js";
import {
  CARD_OFFERING,
  MANA_BLACK,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_CARD,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import { OFFERING } from "../../data/spells/red/offering.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createSacrificeState(
  crystals = { red: 0, blue: 0, green: 0, white: 0 }
): GameState {
  const player = createTestPlayer({
    id: "player1",
    crystals,
  });

  return createTestGameState({
    players: [player],
  });
}

function getPlayer(state: GameState) {
  return state.players[0]!;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Offering spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_OFFERING);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Offering");
  });

  it("should have correct metadata", () => {
    expect(OFFERING.id).toBe(CARD_OFFERING);
    expect(OFFERING.name).toBe("Offering");
    expect(OFFERING.poweredName).toBe("Sacrifice");
    expect(OFFERING.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(OFFERING.sidewaysValue).toBe(1);
  });

  it("should be powered by black + red mana", () => {
    expect(OFFERING.poweredBy).toEqual([MANA_BLACK, MANA_RED]);
  });

  it("should have special category for basic effect", () => {
    expect(OFFERING.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should have combat category for powered effect", () => {
    expect(OFFERING.poweredEffectCategories).toEqual([CATEGORY_COMBAT]);
  });

  it("should have compound basic effect with red crystal and 3 optional discards", () => {
    expect(OFFERING.basicEffect.type).toBe(EFFECT_COMPOUND);
    const compound = OFFERING.basicEffect as { effects: readonly { type: string; color?: string; optional?: boolean }[] };
    expect(compound.effects).toHaveLength(4);

    // First: gain red crystal
    expect(compound.effects[0]!.type).toBe(EFFECT_GAIN_CRYSTAL);
    expect(compound.effects[0]!.color).toBe(MANA_RED);

    // Next 3: optional discard for crystal
    for (let i = 1; i <= 3; i++) {
      expect(compound.effects[i]!.type).toBe(EFFECT_DISCARD_FOR_CRYSTAL);
      expect(compound.effects[i]!.optional).toBe(true);
    }
  });

  it("should have sacrifice powered effect", () => {
    expect(OFFERING.poweredEffect.type).toBe(EFFECT_SACRIFICE);
  });
});

// ============================================================================
// SACRIFICE ENTRY POINT TESTS
// ============================================================================

describe("EFFECT_SACRIFICE", () => {
  const sacrificeEffect: SacrificeEffect = {
    type: EFFECT_SACRIFICE,
  };

  describe("isEffectResolvable", () => {
    it("should be resolvable when player has at least one pair", () => {
      const state = createSacrificeState({ red: 1, blue: 0, green: 1, white: 0 });
      expect(isEffectResolvable(state, "player1", sacrificeEffect)).toBe(true);
    });

    it("should be resolvable with white + blue pair", () => {
      const state = createSacrificeState({ red: 0, blue: 1, green: 0, white: 1 });
      expect(isEffectResolvable(state, "player1", sacrificeEffect)).toBe(true);
    });

    it("should not be resolvable with only attack colors (green/white)", () => {
      const state = createSacrificeState({ red: 0, blue: 0, green: 2, white: 2 });
      expect(isEffectResolvable(state, "player1", sacrificeEffect)).toBe(false);
    });

    it("should not be resolvable with only element colors (red/blue)", () => {
      const state = createSacrificeState({ red: 2, blue: 2, green: 0, white: 0 });
      expect(isEffectResolvable(state, "player1", sacrificeEffect)).toBe(false);
    });

    it("should not be resolvable with no crystals", () => {
      const state = createSacrificeState();
      expect(isEffectResolvable(state, "player1", sacrificeEffect)).toBe(false);
    });
  });

  describe("color choice presentation", () => {
    it("should present 4 combination options", () => {
      const state = createSacrificeState({ red: 1, blue: 1, green: 1, white: 1 });

      const result = resolveEffect(state, "player1", sacrificeEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(4);
    });

    it("should present all 4 crystal pair combinations", () => {
      const state = createSacrificeState({ red: 1, blue: 1, green: 1, white: 1 });

      const result = resolveEffect(state, "player1", sacrificeEffect);

      const options = result.dynamicChoiceOptions as ResolveSacrificeEffect[];

      // green+red → Siege Fire
      expect(options).toContainEqual({
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      });

      // green+blue → Siege Ice
      expect(options).toContainEqual({
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_BLUE,
      });

      // white+red → Ranged Fire
      expect(options).toContainEqual({
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_RED,
      });

      // white+blue → Ranged Ice
      expect(options).toContainEqual({
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_BLUE,
      });
    });

    it("should not modify state when presenting choices", () => {
      const state = createSacrificeState({ red: 1, blue: 1, green: 1, white: 1 });

      const result = resolveEffect(state, "player1", sacrificeEffect);

      expect(result.state).toBe(state);
    });
  });
});

// ============================================================================
// RESOLVE SACRIFICE TESTS
// ============================================================================

describe("EFFECT_RESOLVE_SACRIFICE", () => {
  describe("green+red pair (Siege Fire Attack 4)", () => {
    it("should grant Siege Fire Attack 4 for 1 pair", () => {
      const state = createSacrificeState({ red: 1, blue: 0, green: 1, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.combatAccumulator.attack.siegeElements.fire).toBe(4);
    });

    it("should scale attack with multiple pairs", () => {
      const state = createSacrificeState({ red: 3, blue: 0, green: 2, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // 2 pairs (min of 3 red, 2 green) → Siege Fire 8
      expect(player.combatAccumulator.attack.siegeElements.fire).toBe(8);
    });
  });

  describe("green+blue pair (Siege Ice Attack 4)", () => {
    it("should grant Siege Ice Attack 4 for 1 pair", () => {
      const state = createSacrificeState({ red: 0, blue: 1, green: 1, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_BLUE,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.combatAccumulator.attack.siegeElements.ice).toBe(4);
    });
  });

  describe("white+red pair (Ranged Fire Attack 6)", () => {
    it("should grant Ranged Fire Attack 6 for 1 pair", () => {
      const state = createSacrificeState({ red: 1, blue: 0, green: 0, white: 1 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.combatAccumulator.attack.rangedElements.fire).toBe(6);
    });

    it("should scale attack with multiple pairs", () => {
      const state = createSacrificeState({ red: 2, blue: 0, green: 0, white: 3 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // 2 pairs (min of 2 red, 3 white) → Ranged Fire 12
      expect(player.combatAccumulator.attack.rangedElements.fire).toBe(12);
    });
  });

  describe("white+blue pair (Ranged Ice Attack 6)", () => {
    it("should grant Ranged Ice Attack 6 for 1 pair", () => {
      const state = createSacrificeState({ red: 0, blue: 1, green: 0, white: 1 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_BLUE,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.combatAccumulator.attack.rangedElements.ice).toBe(6);
    });
  });

  describe("crystal conversion to mana tokens", () => {
    it("should remove crystals for complete pairs", () => {
      const state = createSacrificeState({ red: 2, blue: 0, green: 3, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // 2 pairs consumed: 2 green, 2 red removed
      expect(player.crystals.green).toBe(1); // 3 - 2
      expect(player.crystals.red).toBe(0); // 2 - 2
    });

    it("should create mana tokens from converted crystals", () => {
      const state = createSacrificeState({ red: 1, blue: 0, green: 1, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // 1 pair → 2 mana tokens (1 green + 1 red)
      expect(player.pureMana).toHaveLength(2);
      expect(player.pureMana).toContainEqual({
        color: MANA_GREEN,
        source: MANA_TOKEN_SOURCE_CARD,
      });
      expect(player.pureMana).toContainEqual({
        color: MANA_RED,
        source: MANA_TOKEN_SOURCE_CARD,
      });
    });

    it("should create 2 tokens per pair", () => {
      const state = createSacrificeState({ red: 0, blue: 2, green: 0, white: 3 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_WHITE,
        elementColor: MANA_BLUE,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // 2 pairs → 4 mana tokens (2 white + 2 blue)
      expect(player.pureMana).toHaveLength(4);

      const whiteTokens = player.pureMana.filter((t) => t.color === MANA_WHITE);
      const blueTokens = player.pureMana.filter((t) => t.color === MANA_BLUE);
      expect(whiteTokens).toHaveLength(2);
      expect(blueTokens).toHaveLength(2);
    });

    it("should not affect other crystal colors", () => {
      const state = createSacrificeState({ red: 1, blue: 2, green: 1, white: 3 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // Only green and red affected
      expect(player.crystals.blue).toBe(2);
      expect(player.crystals.white).toBe(3);
    });
  });

  describe("zero pairs edge case", () => {
    it("should do nothing when no pairs available", () => {
      const state = createSacrificeState({ red: 0, blue: 0, green: 1, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // No pairs → no attack, no conversion
      expect(player.combatAccumulator.attack.siege).toBe(0);
      expect(player.crystals.green).toBe(1); // unchanged
      expect(player.pureMana).toHaveLength(0);
    });
  });

  describe("pair count is min of two crystal counts", () => {
    it("should use minimum when attack color is limiting", () => {
      const state = createSacrificeState({ red: 3, blue: 0, green: 1, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // min(1 green, 3 red) = 1 pair
      expect(player.combatAccumulator.attack.siegeElements.fire).toBe(4);
      expect(player.crystals.green).toBe(0);
      expect(player.crystals.red).toBe(2);
    });

    it("should use minimum when element color is limiting", () => {
      const state = createSacrificeState({ red: 1, blue: 0, green: 3, white: 0 });

      const effect: ResolveSacrificeEffect = {
        type: EFFECT_RESOLVE_SACRIFICE,
        attackColor: MANA_GREEN,
        elementColor: MANA_RED,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      // min(3 green, 1 red) = 1 pair
      expect(player.combatAccumulator.attack.siegeElements.fire).toBe(4);
      expect(player.crystals.green).toBe(2);
      expect(player.crystals.red).toBe(0);
    });
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Sacrifice effects", () => {
  it("should describe EFFECT_SACRIFICE", () => {
    const effect: SacrificeEffect = { type: EFFECT_SACRIFICE };
    const desc = describeEffect(effect);
    expect(desc).toContain("Sacrifice");
  });

  it("should describe green+red resolve sacrifice", () => {
    const effect: ResolveSacrificeEffect = {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_GREEN,
      elementColor: MANA_RED,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Siege");
    expect(desc).toContain("Fire");
    expect(desc).toContain("4");
  });

  it("should describe white+blue resolve sacrifice", () => {
    const effect: ResolveSacrificeEffect = {
      type: EFFECT_RESOLVE_SACRIFICE,
      attackColor: MANA_WHITE,
      elementColor: MANA_BLUE,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Ranged");
    expect(desc).toContain("Ice");
    expect(desc).toContain("6");
  });
});
