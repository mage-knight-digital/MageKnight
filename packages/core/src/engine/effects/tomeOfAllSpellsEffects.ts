/**
 * Tome of All Spells Effect Handlers
 *
 * Handles the Tome of All Spells artifact:
 *
 * Basic: Discard a card of any color from hand. Use the basic effect of a
 * Spell of the same color from the Spells Offer without paying its mana cost.
 * Spell stays in the offer.
 *
 * Powered: Discard a card of any color from hand. Use the stronger effect of
 * a Spell of the same color from the Spells Offer without paying its mana cost.
 * Works even during Day (bypasses black mana restriction). Spell stays in offer.
 *
 * Key differences from Magic Talent:
 * - No mana cost required to cast the spell
 * - Powered uses the spell's powered effect (not basic)
 * - Powered works during Day (normal powered spells need black mana, day-restricted)
 *
 * Flow:
 * 1. EFFECT_TOME_OF_ALL_SPELLS → discard a colored card from hand
 * 2. Based on discarded card's color, present matching spells from offer
 * 3. EFFECT_RESOLVE_TOME_SPELL → resolve the spell's basic/powered effect
 *    (spell stays in offer, no mana cost)
 *
 * @module effects/tomeOfAllSpellsEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  TomeOfAllSpellsEffect,
  ResolveTomeSpellEffect,
  CardEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import type { CardId, BasicManaColor } from "@mage-knight/shared";
import {
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import {
  EFFECT_TOME_OF_ALL_SPELLS,
  EFFECT_RESOLVE_TOME_SPELL,
} from "../../types/effectTypes.js";
import { getActionCardColor, getSpellColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";
import { DEED_CARD_TYPE_SPELL } from "../../types/cards.js";

// All basic mana colors
const ALL_BASIC_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get cards eligible for Tome discard (any card with a color — action cards
 * and spell cards, but not wounds or artifacts which have no color).
 */
function getCardsEligibleForTomeDiscard(
  hand: readonly CardId[],
  sourceCardId: CardId
): CardId[] {
  return hand.filter((cardId) => {
    if (cardId === CARD_WOUND) return false;
    if (cardId === sourceCardId) return false;
    // Must have a color (action cards or spell cards)
    const actionColor = getActionCardColor(cardId);
    if (actionColor !== null) return true;
    const spellColor = getSpellColor(cardId);
    return spellColor !== null;
  });
}

/**
 * Get the mana color of any card (action or spell).
 */
function getCardManaColor(cardId: CardId): BasicManaColor | null {
  const actionColor = getActionCardColor(cardId);
  if (actionColor !== null) {
    return cardColorToManaColor(actionColor);
  }
  const sc = getSpellColor(cardId);
  if (sc !== null) {
    return cardColorToManaColor(sc);
  }
  return null;
}

/**
 * Get spells in the offer matching a given mana color.
 */
function getMatchingSpellsInOffer(
  state: GameState,
  color: BasicManaColor
): { cardId: CardId; name: string }[] {
  const results: { cardId: CardId; name: string }[] = [];
  for (const cardId of state.offers.spells.cards) {
    const sc = getSpellColor(cardId);
    if (sc !== null && cardColorToManaColor(sc) === color) {
      const card = getCard(cardId);
      results.push({ cardId, name: card?.name ?? cardId });
    }
  }
  return results;
}

/**
 * Convert card color string to mana color.
 */
function cardColorToManaColor(color: string): BasicManaColor {
  switch (color) {
    case "red": return MANA_RED;
    case "blue": return MANA_BLUE;
    case "green": return MANA_GREEN;
    case "white": return MANA_WHITE;
    default: throw new Error(`Unknown card color: ${color}`);
  }
}

// ============================================================================
// ENTRY POINT EFFECT
// ============================================================================

/**
 * Handle EFFECT_TOME_OF_ALL_SPELLS entry point.
 *
 * Sets pendingDiscard with colorMatters so the discarded card's color
 * determines which spells from the offer are presented as choices.
 * Unlike Magic Talent, no mana payment is required to cast.
 */
function handleTomeOfAllSpells(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: TomeOfAllSpellsEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("TomeOfAllSpellsEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForTomeDiscard(
    player.hand,
    sourceCardId
  );

  if (eligibleCards.length === 0) {
    return {
      state,
      description: "No colored cards in hand to discard for Tome of All Spells",
    };
  }

  // Check which cards actually have matching spells in the offer
  const cardsWithMatchingSpells = eligibleCards.filter((cardId) => {
    const color = getCardManaColor(cardId);
    if (!color) return false;
    return getMatchingSpellsInOffer(state, color).length > 0;
  });

  if (cardsWithMatchingSpells.length === 0) {
    return {
      state,
      description: "No spells in the offer match any discardable card color",
    };
  }

  // Build thenEffectByColor: maps each discarded color to spell selection
  // No mana check needed — Tome casts for free
  const thenEffectByColor: Partial<Record<BasicManaColor, CardEffect>> = {};

  for (const color of ALL_BASIC_COLORS) {
    const matchingSpells = getMatchingSpellsInOffer(state, color);
    if (matchingSpells.length === 0) continue;

    if (matchingSpells.length === 1) {
      // Single match: resolve directly
      const spell = matchingSpells[0]!;
      thenEffectByColor[color] = {
        type: EFFECT_RESOLVE_TOME_SPELL,
        spellCardId: spell.cardId,
        spellName: spell.name,
        mode: effect.mode,
      } as ResolveTomeSpellEffect;
    } else {
      // Multiple matches: present as choice
      const options: ResolveTomeSpellEffect[] = matchingSpells.map(
        (spell) => ({
          type: EFFECT_RESOLVE_TOME_SPELL,
          spellCardId: spell.cardId,
          spellName: spell.name,
          mode: effect.mode,
        })
      );
      thenEffectByColor[color] = {
        type: "choice" as const,
        options,
      };
    }
  }

  if (Object.keys(thenEffectByColor).length === 0) {
    return {
      state,
      description: "No spells in the offer match any discardable card color",
    };
  }

  // Create pendingDiscard state
  const updatedPlayer: Player = {
    ...player,
    pendingDiscard: {
      sourceCardId,
      count: 1,
      optional: false,
      thenEffect: { type: "noop" as const }, // Unused when colorMatters is true
      colorMatters: true,
      thenEffectByColor,
      filterWounds: true,
    },
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `Tome of All Spells (${effect.mode}): discard a colored card to use a spell from the offer`,
    requiresChoice: true,
  };
}

// ============================================================================
// RESOLVE SPELL EFFECT
// ============================================================================

/**
 * Resolve the selected spell from the offer.
 * No mana payment needed. Resolves the spell's basic or powered effect.
 * Spell stays in the offer.
 */
function resolveTomeSpell(
  state: GameState,
  playerId: string,
  effect: ResolveTomeSpellEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  // Verify spell is still in the offer
  if (!state.offers.spells.cards.includes(effect.spellCardId)) {
    return {
      state,
      description: `Spell ${effect.spellName} is no longer in the offer`,
    };
  }

  // Get the spell card definition
  const spellCard = getCard(effect.spellCardId);
  if (!spellCard || spellCard.cardType !== DEED_CARD_TYPE_SPELL) {
    return {
      state,
      description: `${effect.spellCardId} is not a valid spell`,
    };
  }

  // Resolve the spell's effect (no mana cost required)
  const spellEffect = effect.mode === "basic"
    ? spellCard.basicEffect
    : spellCard.poweredEffect;

  const result = resolveEffect(
    state,
    playerId,
    spellEffect,
    effect.spellCardId
  );

  const modeLabel = effect.mode === "basic" ? "basic" : "powered";
  return {
    ...result,
    description: `Tome of All Spells: used ${modeLabel} effect of ${effect.spellName} from the Spell Offer (no mana cost)`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Tome of All Spells effect handlers with the effect registry.
 */
export function registerTomeOfAllSpellsEffects(resolver: EffectResolver): void {
  registerEffect(
    EFFECT_TOME_OF_ALL_SPELLS,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleTomeOfAllSpells(
        state,
        playerIndex,
        player,
        effect as TomeOfAllSpellsEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_TOME_SPELL,
    (state, playerId, effect) => {
      return resolveTomeSpell(
        state,
        playerId,
        effect as ResolveTomeSpellEffect,
        resolver
      );
    }
  );
}
