/**
 * Mana payment helpers for card playability.
 *
 * These functions determine whether a player can pay the mana cost
 * for a card's basic or powered effect.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { DeedCard } from "../../../types/cards.js";
import type { ManaColor, ManaSourceInfo } from "@mage-knight/shared";
import { MANA_BLACK } from "@mage-knight/shared";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { canPayForMana, canPayForTwoMana, getAvailableManaSourcesForColor } from "../mana.js";

/**
 * Check if a player can pay for a spell's basic effect.
 *
 * Spells require mana of their color even for the basic effect (unlike action cards).
 * The spell's color is found in poweredBy (the non-black color).
 */
export function canPayForSpellBasic(
  state: GameState,
  player: Player,
  card: DeedCard
): boolean {
  // Find the spell's color (the non-black color in poweredBy)
  const spellColor = card.poweredBy.find((c) => c !== MANA_BLACK);
  if (!spellColor) return false;

  return canPayForMana(state, player, spellColor);
}

/**
 * Check if a player can power a card.
 *
 * For action cards: returns the first mana color from poweredBy that the player can pay for.
 * For spells: returns the spell's color ONLY if the player can pay for BOTH black AND that color.
 *
 * Returns undefined if the card cannot be powered.
 */
export function findPayableManaColor(
  state: GameState,
  player: Player,
  card: DeedCard
): ManaColor | undefined {
  if (card.poweredBy.length === 0) return undefined;

  // Spells require BOTH black mana AND the spell's color
  if (card.cardType === DEED_CARD_TYPE_SPELL) {
    // Spell's poweredBy should be [MANA_BLACK, spell_color]
    const spellColor = card.poweredBy.find((c) => c !== MANA_BLACK);
    if (!spellColor) return undefined;

    // Check if player can pay for both black AND the spell color
    if (canPayForTwoMana(state, player, MANA_BLACK, spellColor, { forSpellPowered: true })) {
      return spellColor; // Return the spell color (black is implicit)
    }
    return undefined;
  }

  // Action cards: any one of the poweredBy colors works (OR logic)
  return card.poweredBy.find((color) => canPayForMana(state, player, color));
}

/**
 * Compute pre-selected mana source(s) for a powered card play.
 *
 * - Action cards: returns [source] (single mana source for the payable color)
 * - Spells: returns [blackSource, colorSource] with non-conflicting die IDs
 *
 * Returns undefined if no valid source combination exists.
 */
export function computePoweredManaOptions(
  state: GameState,
  player: Player,
  card: DeedCard,
  payableManaColor: ManaColor
): ManaSourceInfo[] | undefined {
  if (card.cardType === DEED_CARD_TYPE_SPELL) {
    // Spells need black + color mana from non-conflicting sources
    const blackSources = getAvailableManaSourcesForColor(state, player, MANA_BLACK);
    const colorSources = getAvailableManaSourcesForColor(state, player, payableManaColor, { forSpellPowered: true });
    if (blackSources.length === 0 || colorSources.length === 0) return undefined;

    // Find first non-conflicting pair (different dieId, or at least one non-die source)
    for (const blackSrc of blackSources) {
      for (const colorSrc of colorSources) {
        const blackDie = blackSrc.dieId;
        const colorDie = colorSrc.dieId;
        if (!blackDie || !colorDie || blackDie !== colorDie) {
          return [blackSrc, colorSrc];
        }
      }
    }
    return undefined;
  }

  // Action cards: single mana source
  const sources = getAvailableManaSourcesForColor(state, player, payableManaColor);
  if (sources.length === 0) return undefined;
  return [sources[0]];
}
