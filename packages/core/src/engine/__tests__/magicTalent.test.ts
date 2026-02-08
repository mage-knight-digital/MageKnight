/**
 * Tests for Magic Talent advanced action card (#167)
 *
 * Basic: Discard a card of any color from hand. Play one Spell of the same
 * color from the Spells Offer as if it were in your hand. Spell stays in offer.
 *
 * Powered: Pay a mana of any color. Gain a Spell of that color from the
 * Spells Offer to your discard pile.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  MagicTalentBasicEffect,
  MagicTalentPoweredEffect,
  ResolveMagicTalentSpellEffect,
  ResolveMagicTalentGainEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import {
  EFFECT_MAGIC_TALENT_BASIC,
  EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
  EFFECT_MAGIC_TALENT_POWERED,
  EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
} from "../../types/effectTypes.js";
import {
  CARD_MAGIC_TALENT,
  CARD_RAGE,
  CARD_MARCH,
  CARD_SWIFTNESS,
  CARD_CRYSTALLIZE,
  CARD_WOUND,
  CARD_FIREBALL,
  CARD_FLAME_WALL,
  CARD_SNOWSTORM,
  CARD_RESTORATION,
  CARD_CURE,
  MANA_BLUE,
  MANA_RED,
  MANA_GREEN,
  MANA_WHITE,
  MANA_TOKEN_SOURCE_SKILL,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { MAGIC_TALENT } from "../../data/advancedActions/blue/magic-talent.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMagicTalentState(
  spellOffer: CardId[] = [],
  spellDeck: CardId[] = [],
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    id: "player1",
    hand: [CARD_MAGIC_TALENT, CARD_RAGE], // Blue AA + Red basic action
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
    decks: {
      spells: spellDeck,
      advancedActions: [],
      artifacts: [],
      units: { silver: [], gold: [] },
    },
  });
}

function getPlayer(state: GameState): Player {
  return state.players[0]!;
}

// ============================================================================
// CARD DEFINITION TESTS
// ============================================================================

describe("Magic Talent card definition", () => {
  it("should have correct metadata", () => {
    expect(MAGIC_TALENT.id).toBe(CARD_MAGIC_TALENT);
    expect(MAGIC_TALENT.name).toBe("Magic Talent");
    expect(MAGIC_TALENT.cardType).toBe(DEED_CARD_TYPE_ADVANCED_ACTION);
    expect(MAGIC_TALENT.sidewaysValue).toBe(1);
  });

  it("should be powered by blue mana", () => {
    expect(MAGIC_TALENT.poweredBy).toEqual([MANA_BLUE]);
  });

  it("should have special category", () => {
    expect(MAGIC_TALENT.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should have Magic Talent basic effect", () => {
    expect(MAGIC_TALENT.basicEffect.type).toBe(EFFECT_MAGIC_TALENT_BASIC);
  });

  it("should have Magic Talent powered effect", () => {
    expect(MAGIC_TALENT.poweredEffect.type).toBe(EFFECT_MAGIC_TALENT_POWERED);
  });
});

// ============================================================================
// RESOLVABILITY TESTS - BASIC
// ============================================================================

describe("EFFECT_MAGIC_TALENT_BASIC resolvability", () => {
  const effect: MagicTalentBasicEffect = { type: EFFECT_MAGIC_TALENT_BASIC };

  it("should be resolvable when player has colored cards and matching spells in offer", () => {
    const state = createMagicTalentState([CARD_FIREBALL]); // Red spell, CARD_RAGE is red
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });

  it("should not be resolvable when spell offer is empty", () => {
    const state = createMagicTalentState([]);
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });

  it("should not be resolvable when player has only wounds in hand", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      hand: [CARD_WOUND, CARD_WOUND],
    });
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });

  it("should be resolvable when discarding a spell card from hand", () => {
    // Player has a blue spell in hand, and blue spells are in the offer
    const state = createMagicTalentState([CARD_SNOWSTORM], [], {
      hand: [CARD_MAGIC_TALENT, CARD_SNOWSTORM], // Blue spell can be discarded
    });
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });
});

// ============================================================================
// RESOLVABILITY TESTS - POWERED
// ============================================================================

describe("EFFECT_MAGIC_TALENT_POWERED resolvability", () => {
  const effect: MagicTalentPoweredEffect = { type: EFFECT_MAGIC_TALENT_POWERED };

  it("should be resolvable when player has mana tokens and matching spells", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });
    expect(isEffectResolvable(state, "player1", effect)).toBe(true);
  });

  it("should not be resolvable when player has no mana tokens", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [],
    });
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });

  it("should not be resolvable when spell offer is empty", () => {
    const state = createMagicTalentState([], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });
    expect(isEffectResolvable(state, "player1", effect)).toBe(false);
  });
});

// ============================================================================
// BASIC EFFECT TESTS
// ============================================================================

describe("EFFECT_MAGIC_TALENT_BASIC", () => {
  const effect: MagicTalentBasicEffect = { type: EFFECT_MAGIC_TALENT_BASIC };

  it("should return no-op when no colored cards in hand", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      hand: [CARD_WOUND],
    });

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No colored cards");
  });

  it("should return no-op when no matching spells in offer", () => {
    // Player has red cards but offer has only blue spells
    const state = createMagicTalentState([CARD_SNOWSTORM], [], {
      hand: [CARD_MAGIC_TALENT, CARD_RAGE], // Rage is red, Snowstorm is blue
    });

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    // CARD_MAGIC_TALENT is blue, so it shouldn't be eligible (it's the source card)
    // CARD_RAGE is red, but CARD_SNOWSTORM is blue — no red spells in offer
    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No spells in the offer match");
  });

  it("should set pendingDiscard when there are matching colored cards and spells", () => {
    // Player has red card (Rage), offer has red spell (Fireball)
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      hand: [CARD_MAGIC_TALENT, CARD_RAGE],
    });

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard).not.toBeNull();
    expect(player.pendingDiscard?.colorMatters).toBe(true);
  });

  it("should not allow discarding the source card (Magic Talent itself)", () => {
    // Player has only Magic Talent (blue) and offer has blue spell
    const state = createMagicTalentState([CARD_SNOWSTORM], [], {
      hand: [CARD_MAGIC_TALENT], // Only this card in hand
    });

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    // Magic Talent can't discard itself — it's the only card, so no eligible cards
    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No colored cards");
  });

  it("should allow discarding different colored cards for different spells", () => {
    // Player has red (Rage) and green (March) cards
    // Offer has both red (Fireball) and green (Restoration) spells
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_RESTORATION],
      [],
      { hand: [CARD_MAGIC_TALENT, CARD_RAGE, CARD_MARCH] }
    );

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard).not.toBeNull();
    expect(player.pendingDiscard?.colorMatters).toBe(true);
    // Should have effects for both red and green
    expect(player.pendingDiscard?.thenEffectByColor).toBeDefined();
  });

  it("should not allow discarding wounds", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      hand: [CARD_MAGIC_TALENT, CARD_WOUND, CARD_RAGE],
    });

    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard?.filterWounds).toBe(true);
  });
});

// ============================================================================
// RESOLVE SPELL FROM OFFER TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MAGIC_TALENT_SPELL", () => {
  it("should resolve the spell's basic effect", () => {
    // Fireball basic = Ranged Fire Attack 5
    const state = createMagicTalentState([CARD_FIREBALL]);
    const effect: ResolveMagicTalentSpellEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    // Should gain ranged fire attack 5
    const player = getPlayer(result.state);
    expect(player.combatAccumulator.attack.rangedElements.fire).toBe(5);
    expect(result.description).toContain("Fireball");
    expect(result.description).toContain("Spell Offer");
  });

  it("should keep the spell in the offer after resolving", () => {
    const state = createMagicTalentState([CARD_FIREBALL, CARD_SNOWSTORM]);
    const effect: ResolveMagicTalentSpellEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    // Spell should still be in the offer
    expect(result.state.offers.spells.cards).toContain(CARD_FIREBALL);
    expect(result.state.offers.spells.cards).toContain(CARD_SNOWSTORM);
  });

  it("should handle spell no longer in offer gracefully", () => {
    const state = createMagicTalentState([]); // Empty offer
    const effect: ResolveMagicTalentSpellEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("no longer in the offer");
  });
});

// ============================================================================
// POWERED EFFECT TESTS
// ============================================================================

describe("EFFECT_MAGIC_TALENT_POWERED", () => {
  const effect: MagicTalentPoweredEffect = { type: EFFECT_MAGIC_TALENT_POWERED };

  it("should return no-op when player has no mana tokens", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [],
    });

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No mana tokens available");
  });

  it("should return no-op when no matching spells in offer", () => {
    // Player has red mana but offer only has blue spells
    const state = createMagicTalentState([CARD_SNOWSTORM], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No spells in the offer match");
  });

  it("should present spell choices when mana matches", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    expect(result.dynamicChoiceOptions).toBeDefined();
    const options = result.dynamicChoiceOptions as ResolveMagicTalentGainEffect[];
    expect(options.length).toBe(1);
    expect(options[0]?.type).toBe(EFFECT_RESOLVE_MAGIC_TALENT_GAIN);
    expect(options[0]?.spellCardId).toBe(CARD_FIREBALL);
  });

  it("should present multiple spell options for multiple colors", () => {
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_SNOWSTORM],
      [],
      {
        pureMana: [
          { color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL },
          { color: MANA_BLUE, source: MANA_TOKEN_SOURCE_SKILL },
        ],
      }
    );

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveMagicTalentGainEffect[];
    expect(options.length).toBe(2);
    const spellIds = options.map((o) => o.spellCardId);
    expect(spellIds).toContain(CARD_FIREBALL);
    expect(spellIds).toContain(CARD_SNOWSTORM);
  });

  it("should not present options for colors without matching spells", () => {
    // Player has green mana but offer has only red spells
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [
        { color: MANA_GREEN, source: MANA_TOKEN_SOURCE_SKILL },
        { color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL },
      ],
    });

    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveMagicTalentGainEffect[];
    // Only red spell should appear (green has no matching spells)
    expect(options.length).toBe(1);
    expect(options[0]?.spellCardId).toBe(CARD_FIREBALL);
  });
});

// ============================================================================
// RESOLVE GAIN SPELL TESTS
// ============================================================================

describe("EFFECT_RESOLVE_MAGIC_TALENT_GAIN", () => {
  it("should consume mana token and gain spell to discard pile", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      discard: [],
    });

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    // Mana token should be consumed
    expect(player.pureMana.length).toBe(0);
    // Spell should be in discard pile
    expect(player.discard).toContain(CARD_FIREBALL);
  });

  it("should remove spell from offer", () => {
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_SNOWSTORM],
      [],
      {
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      }
    );

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    // Fireball removed from offer
    expect(result.state.offers.spells.cards).not.toContain(CARD_FIREBALL);
    // Snowstorm still in offer
    expect(result.state.offers.spells.cards).toContain(CARD_SNOWSTORM);
  });

  it("should replenish offer from spell deck", () => {
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_SNOWSTORM],
      [CARD_CURE], // Spell deck has Cure to replenish
      {
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      }
    );

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    // Offer should have Snowstorm + Cure (replenished)
    expect(result.state.offers.spells.cards).toContain(CARD_SNOWSTORM);
    expect(result.state.offers.spells.cards).toContain(CARD_CURE);
    // Deck should be depleted
    expect(result.state.decks.spells.length).toBe(0);
  });

  it("should handle empty spell deck (no replenishment)", () => {
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_SNOWSTORM],
      [], // Empty spell deck
      {
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      }
    );

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    // Offer should have only Snowstorm (no replenishment)
    expect(result.state.offers.spells.cards).toEqual([CARD_SNOWSTORM]);
  });

  it("should handle spell no longer in offer gracefully", () => {
    const state = createMagicTalentState([], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
    });

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("no longer in the offer");
    // No mana should be consumed
    const player = getPlayer(result.state);
    expect(player.pureMana.length).toBe(1);
  });

  it("should handle no matching mana token available", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_BLUE, source: MANA_TOKEN_SOURCE_SKILL }], // Blue, not red
    });

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("No");
    expect(result.description).toContain("mana token available");
  });

  it("should consume only one mana token when player has multiples", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [
        { color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL },
        { color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL },
      ],
    });

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    const player = getPlayer(result.state);
    // Should still have 1 red mana token
    expect(player.pureMana.length).toBe(1);
    expect(player.pureMana[0]?.color).toBe(MANA_RED);
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Magic Talent effects", () => {
  it("should describe EFFECT_MAGIC_TALENT_BASIC", () => {
    const effect: MagicTalentBasicEffect = { type: EFFECT_MAGIC_TALENT_BASIC };
    const desc = describeEffect(effect);
    expect(desc).toContain("Discard");
    expect(desc).toContain("Spell");
  });

  it("should describe EFFECT_RESOLVE_MAGIC_TALENT_SPELL", () => {
    const effect: ResolveMagicTalentSpellEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Fireball");
  });

  it("should describe EFFECT_MAGIC_TALENT_POWERED", () => {
    const effect: MagicTalentPoweredEffect = { type: EFFECT_MAGIC_TALENT_POWERED };
    const desc = describeEffect(effect);
    expect(desc).toContain("mana");
    expect(desc).toContain("Spell");
  });

  it("should describe EFFECT_RESOLVE_MAGIC_TALENT_GAIN", () => {
    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Fireball");
    expect(desc).toContain("Spell Offer");
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe("Magic Talent edge cases", () => {
  it("basic: should allow discarding a spell from hand to match spell in offer", () => {
    // Player has Snowstorm (blue spell) in hand, offer has Snowstorm (blue spell)
    const state = createMagicTalentState([CARD_SNOWSTORM], [], {
      hand: [CARD_MAGIC_TALENT, CARD_SNOWSTORM],
    });

    const effect: MagicTalentBasicEffect = { type: EFFECT_MAGIC_TALENT_BASIC };
    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    // Should allow since Snowstorm has a color (blue) matching blue spells in offer
    expect(result.requiresChoice).toBe(true);
  });

  it("basic: should work with all four spell colors", () => {
    // Offer has one spell of each color
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_SNOWSTORM, CARD_RESTORATION, CARD_CURE],
      [],
      {
        hand: [
          CARD_MAGIC_TALENT,
          CARD_RAGE,         // Red
          CARD_CRYSTALLIZE,  // Blue
          CARD_MARCH,        // Green
          CARD_SWIFTNESS,    // White
        ],
      }
    );

    const effect: MagicTalentBasicEffect = { type: EFFECT_MAGIC_TALENT_BASIC };
    const result = resolveEffect(state, "player1", effect, CARD_MAGIC_TALENT);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    const byColor = player.pendingDiscard?.thenEffectByColor;
    expect(byColor).toBeDefined();
    // Should have entries for all 4 colors
    expect(byColor?.[MANA_RED]).toBeDefined();
    expect(byColor?.[MANA_BLUE]).toBeDefined();
    expect(byColor?.[MANA_GREEN]).toBeDefined();
    expect(byColor?.[MANA_WHITE]).toBeDefined();
  });

  it("powered: should present multiple spells of same color", () => {
    const state = createMagicTalentState(
      [CARD_FIREBALL, CARD_FLAME_WALL], // Two red spells
      [],
      {
        pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      }
    );

    const effect: MagicTalentPoweredEffect = { type: EFFECT_MAGIC_TALENT_POWERED };
    const result = resolveEffect(state, "player1", effect);

    expect(result.requiresChoice).toBe(true);
    const options = result.dynamicChoiceOptions as ResolveMagicTalentGainEffect[];
    expect(options.length).toBe(2);
    const spellIds = options.map((o) => o.spellCardId);
    expect(spellIds).toContain(CARD_FIREBALL);
    expect(spellIds).toContain(CARD_FLAME_WALL);
  });

  it("powered: gain should include description with mana color", () => {
    const state = createMagicTalentState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: MANA_TOKEN_SOURCE_SKILL }],
      discard: [],
    });

    const effect: ResolveMagicTalentGainEffect = {
      type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("Fireball");
    expect(result.description).toContain("red");
  });
});
