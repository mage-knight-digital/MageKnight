/**
 * Tests for Tome of All Spells artifact (#235)
 *
 * Basic: Discard a card of any color. Use the basic effect of a Spell of the
 * same color from the Spells Offer without paying its mana cost.
 * Spell stays in the offer.
 *
 * Powered: Discard a card of any color. Use the stronger effect of a Spell of
 * the same color from the Spells Offer without paying its mana cost.
 * Works even during Day. Artifact is destroyed after powered use.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  TomeOfAllSpellsEffect,
  ResolveTomeSpellEffect,
} from "../../types/cards.js";
import {
  CATEGORY_SPECIAL,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_TOME_OF_ALL_SPELLS,
  EFFECT_RESOLVE_TOME_SPELL,
} from "../../types/effectTypes.js";
import {
  CARD_TOME_OF_ALL_SPELLS,
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
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { TOME_OF_ALL_SPELLS } from "../../data/artifacts/tomeOfAllSpells.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createTomeState(
  spellOffer: CardId[] = [],
  spellDeck: CardId[] = [],
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    id: "player1",
    hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE], // Artifact + Red basic action
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

describe("Tome of All Spells card definition", () => {
  it("should have correct metadata", () => {
    expect(TOME_OF_ALL_SPELLS.id).toBe(CARD_TOME_OF_ALL_SPELLS);
    expect(TOME_OF_ALL_SPELLS.name).toBe("Tome of All Spells");
    expect(TOME_OF_ALL_SPELLS.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
    expect(TOME_OF_ALL_SPELLS.sidewaysValue).toBe(1);
  });

  it("should be powered by any basic mana color", () => {
    expect(TOME_OF_ALL_SPELLS.poweredBy).toEqual([MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE]);
  });

  it("should have special category", () => {
    expect(TOME_OF_ALL_SPELLS.categories).toEqual([CATEGORY_SPECIAL]);
  });

  it("should be destroyed after powered use", () => {
    expect(TOME_OF_ALL_SPELLS.destroyOnPowered).toBe(true);
  });

  it("should have Tome of All Spells basic effect", () => {
    expect(TOME_OF_ALL_SPELLS.basicEffect.type).toBe(EFFECT_TOME_OF_ALL_SPELLS);
    expect((TOME_OF_ALL_SPELLS.basicEffect as TomeOfAllSpellsEffect).mode).toBe("basic");
  });

  it("should have Tome of All Spells powered effect", () => {
    expect(TOME_OF_ALL_SPELLS.poweredEffect.type).toBe(EFFECT_TOME_OF_ALL_SPELLS);
    expect((TOME_OF_ALL_SPELLS.poweredEffect as TomeOfAllSpellsEffect).mode).toBe("powered");
  });
});

// ============================================================================
// RESOLVABILITY TESTS
// ============================================================================

describe("EFFECT_TOME_OF_ALL_SPELLS resolvability", () => {
  const basicEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };
  const poweredEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "powered" };

  it("should be resolvable when player has colored cards and matching spells in offer", () => {
    const state = createTomeState([CARD_FIREBALL]); // Red spell, CARD_RAGE is red
    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
  });

  it("should not be resolvable when spell offer is empty", () => {
    const state = createTomeState([]);
    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
  });

  it("should not be resolvable when player has only wounds in hand", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_WOUND, CARD_WOUND],
    });
    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
  });

  it("should not be resolvable when player has only the Tome (no other cards)", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS],
    });
    // Tome is an artifact with no color, so it cannot be discarded
    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
  });

  it("should be resolvable for powered mode with same conditions as basic", () => {
    const state = createTomeState([CARD_FIREBALL]);
    expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(true);
  });

  it("should be resolvable when discarding a spell card from hand", () => {
    const state = createTomeState([CARD_SNOWSTORM], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_SNOWSTORM],
    });
    expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
  });
});

// ============================================================================
// BASIC EFFECT TESTS
// ============================================================================

describe("EFFECT_TOME_OF_ALL_SPELLS basic", () => {
  const basicEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };

  it("should return no-op when no colored cards in hand", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_WOUND],
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No colored cards");
  });

  it("should return no-op when no matching spells in offer", () => {
    // Player has red cards but offer has only blue spells
    const state = createTomeState([CARD_SNOWSTORM], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No spells in the offer match");
  });

  it("should set pendingDiscard when there are matching colored cards and spells", () => {
    // Player has red card (Rage), offer has red spell (Fireball)
    // No mana needed for Tome (unlike Magic Talent)
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
      pureMana: [], // No mana, but that's fine for Tome
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard).not.toBeNull();
    expect(player.pendingDiscard?.colorMatters).toBe(true);
  });

  it("should NOT require mana (unlike Magic Talent)", () => {
    // Player has red card (Rage), offer has red spell (Fireball), but NO mana
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
      pureMana: [],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    // Should succeed even without mana (Tome casts for free)
    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard).not.toBeNull();
    expect(player.pendingDiscard?.thenEffectByColor?.[MANA_RED]).toBeDefined();
  });

  it("should not allow discarding the source card (Tome itself)", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS],
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    // Tome is an artifact (no color), so it can't be discarded for color match
    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No colored cards");
  });

  it("should allow discarding different colored cards for different spells", () => {
    const state = createTomeState(
      [CARD_FIREBALL, CARD_RESTORATION],
      [],
      {
        hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE, CARD_MARCH], // Red + Green
      }
    );

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    const byColor = player.pendingDiscard?.thenEffectByColor;
    expect(byColor).toBeDefined();
    expect(byColor?.[MANA_RED]).toBeDefined();
    expect(byColor?.[MANA_GREEN]).toBeDefined();
  });

  it("should not allow discarding wounds", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_WOUND, CARD_RAGE],
    });

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    expect(player.pendingDiscard?.filterWounds).toBe(true);
  });

  it("should work with all four spell colors", () => {
    const state = createTomeState(
      [CARD_FIREBALL, CARD_SNOWSTORM, CARD_RESTORATION, CARD_CURE],
      [],
      {
        hand: [
          CARD_TOME_OF_ALL_SPELLS,
          CARD_RAGE,         // Red
          CARD_CRYSTALLIZE,  // Blue
          CARD_MARCH,        // Green
          CARD_SWIFTNESS,    // White
        ],
      }
    );

    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    const byColor = player.pendingDiscard?.thenEffectByColor;
    expect(byColor?.[MANA_RED]).toBeDefined();
    expect(byColor?.[MANA_BLUE]).toBeDefined();
    expect(byColor?.[MANA_GREEN]).toBeDefined();
    expect(byColor?.[MANA_WHITE]).toBeDefined();
  });
});

// ============================================================================
// RESOLVE TOME SPELL BASIC TESTS
// ============================================================================

describe("EFFECT_RESOLVE_TOME_SPELL basic", () => {
  it("should resolve the spell's basic effect without mana cost", () => {
    // Fireball basic = Ranged Fire Attack 5
    const state = createTomeState([CARD_FIREBALL], [], {
      pureMana: [], // No mana needed
    });
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };

    const result = resolveEffect(state, "player1", effect);

    // Should gain ranged fire attack 5 without any mana consumed
    const player = getPlayer(result.state);
    expect(player.combatAccumulator.attack.rangedElements.fire).toBe(5);
    expect(player.pureMana.length).toBe(0); // No mana was consumed
    expect(result.description).toContain("Fireball");
    expect(result.description).toContain("Spell Offer");
    expect(result.description).toContain("no mana cost");
  });

  it("should keep the spell in the offer after resolving", () => {
    const state = createTomeState([CARD_FIREBALL, CARD_SNOWSTORM]);
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };

    const result = resolveEffect(state, "player1", effect);

    // Spell should still be in the offer (not removed)
    expect(result.state.offers.spells.cards).toContain(CARD_FIREBALL);
    expect(result.state.offers.spells.cards).toContain(CARD_SNOWSTORM);
  });

  it("should not consume any mana", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: "skill" as const }],
      crystals: { red: 1, blue: 0, green: 0, white: 0 },
    });
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };

    const result = resolveEffect(state, "player1", effect);

    // Mana and crystals should be untouched
    const player = getPlayer(result.state);
    expect(player.pureMana.length).toBe(1);
    expect(player.crystals.red).toBe(1);
  });

  it("should handle spell no longer in offer gracefully", () => {
    const state = createTomeState([]); // Empty offer
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };

    const result = resolveEffect(state, "player1", effect);

    expect(result.description).toContain("no longer in the offer");
  });
});

// ============================================================================
// RESOLVE TOME SPELL POWERED TESTS
// ============================================================================

describe("EFFECT_RESOLVE_TOME_SPELL powered", () => {
  it("should resolve the spell's powered effect without mana cost", () => {
    // Fireball powered = Take Wound + Siege Fire Attack 8
    const state = createTomeState([CARD_FIREBALL], [], {
      pureMana: [],
    });
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "powered",
    };

    const result = resolveEffect(state, "player1", effect);

    // Should gain siege fire attack 8 (Firestorm powered effect)
    const player = getPlayer(result.state);
    expect(player.combatAccumulator.attack.siegeElements.fire).toBe(8);
    // Should have taken a wound (Fireball powered takes wound)
    expect(player.hand).toContain(CARD_WOUND);
    expect(result.description).toContain("Fireball");
    expect(result.description).toContain("powered");
  });

  it("should keep the spell in the offer after powered use", () => {
    const state = createTomeState([CARD_FIREBALL, CARD_SNOWSTORM]);
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "powered",
    };

    const result = resolveEffect(state, "player1", effect);

    // Spell stays in offer
    expect(result.state.offers.spells.cards).toContain(CARD_FIREBALL);
    expect(result.state.offers.spells.cards).toContain(CARD_SNOWSTORM);
  });

  it("should not consume any mana for powered effect", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      pureMana: [{ color: MANA_RED, source: "skill" as const }],
    });
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "powered",
    };

    const result = resolveEffect(state, "player1", effect);

    // No mana consumed (neither basic color nor black mana)
    const player = getPlayer(result.state);
    expect(player.pureMana.length).toBe(1);
  });
});

// ============================================================================
// POWERED EFFECT MODE TESTS
// ============================================================================

describe("Tome powered mode entry point", () => {
  const poweredEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "powered" };

  it("should set up discard with powered mode in thenEffectByColor", () => {
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
    });

    const result = resolveEffect(state, "player1", poweredEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    const byColor = player.pendingDiscard?.thenEffectByColor;
    expect(byColor?.[MANA_RED]).toBeDefined();

    // Verify the effect carries powered mode
    const redEffect = byColor?.[MANA_RED];
    if (redEffect && redEffect.type === EFFECT_RESOLVE_TOME_SPELL) {
      expect(redEffect.mode).toBe("powered");
    }
  });

  it("should present multiple spells of same color as choice for powered mode", () => {
    const state = createTomeState(
      [CARD_FIREBALL, CARD_FLAME_WALL], // Two red spells
      [],
      {
        hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
      }
    );

    const result = resolveEffect(state, "player1", poweredEffect, CARD_TOME_OF_ALL_SPELLS);

    expect(result.requiresChoice).toBe(true);
    const player = getPlayer(result.state);
    const redEffect = player.pendingDiscard?.thenEffectByColor?.[MANA_RED];
    // Should be a choice with multiple options
    expect(redEffect?.type).toBe("choice");
    if (redEffect?.type === "choice") {
      expect(redEffect.options.length).toBe(2);
    }
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Tome of All Spells effects", () => {
  it("should describe EFFECT_TOME_OF_ALL_SPELLS basic", () => {
    const effect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };
    const desc = describeEffect(effect);
    expect(desc).toContain("Discard");
    expect(desc).toContain("Spell");
    expect(desc).toContain("basic");
  });

  it("should describe EFFECT_TOME_OF_ALL_SPELLS powered", () => {
    const effect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "powered" };
    const desc = describeEffect(effect);
    expect(desc).toContain("Discard");
    expect(desc).toContain("Spell");
    expect(desc).toContain("powered");
  });

  it("should describe EFFECT_RESOLVE_TOME_SPELL", () => {
    const effect: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Fireball");
    expect(desc).toContain("Spell Offer");
  });
});

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

describe("Tome of All Spells edge cases", () => {
  it("artifacts (no color) cannot be discarded for Tome", () => {
    // Player's only non-Tome card is another artifact (no color)
    // Artifacts have no color, so they can't match any spell
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS], // Only the Tome itself
    });

    const basicEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };
    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    // Tome can't discard itself (it's the source) and has no color anyway
    expect(result.requiresChoice).toBeUndefined();
    expect(result.description).toContain("No colored cards");
  });

  it("should allow discarding a spell from hand to match spell in offer", () => {
    // Player has Snowstorm (blue spell) in hand, offer has blue spell
    const state = createTomeState([CARD_SNOWSTORM], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_SNOWSTORM],
    });

    const basicEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };
    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    // Should allow since Snowstorm has a color (blue) matching blue spells in offer
    expect(result.requiresChoice).toBe(true);
  });

  it("basic and powered should produce different effects for same spell", () => {
    // Verify basic resolves spell's basic effect
    const stateBasic = createTomeState([CARD_FIREBALL]);
    const basicResolve: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "basic",
    };
    const resultBasic = resolveEffect(stateBasic, "player1", basicResolve);
    const playerBasic = getPlayer(resultBasic.state);
    // Fireball basic = Ranged Fire Attack 5
    expect(playerBasic.combatAccumulator.attack.rangedElements.fire).toBe(5);
    expect(playerBasic.combatAccumulator.attack.siegeElements.fire).toBe(0);

    // Verify powered resolves spell's powered effect
    const statePowered = createTomeState([CARD_FIREBALL]);
    const poweredResolve: ResolveTomeSpellEffect = {
      type: EFFECT_RESOLVE_TOME_SPELL,
      spellCardId: CARD_FIREBALL,
      spellName: "Fireball",
      mode: "powered",
    };
    const resultPowered = resolveEffect(statePowered, "player1", poweredResolve);
    const playerPowered = getPlayer(resultPowered.state);
    // Fireball powered = Siege Fire Attack 8 (+ wound)
    expect(playerPowered.combatAccumulator.attack.siegeElements.fire).toBe(8);
  });

  it("should work even without any mana at all", () => {
    // Core mechanic: Tome doesn't require mana
    const state = createTomeState([CARD_FIREBALL], [], {
      hand: [CARD_TOME_OF_ALL_SPELLS, CARD_RAGE],
      pureMana: [],
      crystals: { red: 0, blue: 0, green: 0, white: 0 },
    });

    const basicEffect: TomeOfAllSpellsEffect = { type: EFFECT_TOME_OF_ALL_SPELLS, mode: "basic" };
    const result = resolveEffect(state, "player1", basicEffect, CARD_TOME_OF_ALL_SPELLS);

    // Should work with zero mana
    expect(result.requiresChoice).toBe(true);
  });
});
