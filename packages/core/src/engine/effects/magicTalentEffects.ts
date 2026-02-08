/**
 * Magic Talent Effect Handlers
 *
 * Handles the Magic Talent advanced action card:
 *
 * Basic: Discard a card of any color from hand. You may play one Spell card
 * of the same color from the Spells Offer as if it were in your hand.
 * That card remains in the Spells Offer. Must still pay mana to cast.
 *
 * Powered: Pay a mana of any color. Gain a Spell card of that color from
 * the Spells Offer and put it in your discard pile.
 *
 * Flow (Basic):
 * 1. EFFECT_MAGIC_TALENT_BASIC → discard a colored card from hand
 * 2. Based on discarded card's color, present matching spells from offer
 * 3. EFFECT_RESOLVE_MAGIC_TALENT_SPELL → resolve the spell's basic effect
 *    (spell stays in offer)
 *
 * Flow (Powered):
 * 1. EFFECT_MAGIC_TALENT_POWERED → present available mana token colors
 * 2. After color choice, present matching spells from offer
 * 3. EFFECT_RESOLVE_MAGIC_TALENT_GAIN → move spell from offer to discard pile
 *
 * @module effects/magicTalentEffects
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  ResolveMagicTalentSpellEffect,
  ResolveMagicTalentGainEffect,
  ResolveMagicTalentSpellManaEffect,
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
  EFFECT_MAGIC_TALENT_BASIC,
  EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
  EFFECT_MAGIC_TALENT_POWERED,
  EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
  EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA,
} from "../../types/effectTypes.js";
import { getActionCardColor, getSpellColor } from "../helpers/cardColor.js";
import { getCard } from "../helpers/cardLookup.js";
import { DEED_CARD_TYPE_SPELL } from "../../types/cards.js";
import { canPayForMana, getAvailableManaSourcesForColor } from "../validActions/mana.js";
import { consumeMana } from "../commands/helpers/manaConsumptionHelpers.js";

// All basic mana colors
const ALL_BASIC_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

// ============================================================================
// BASIC EFFECT: Discard a colored card, play spell from offer
// ============================================================================

/**
 * Get cards eligible for discard (action cards with color, no wounds/artifacts).
 * Spells are also eligible since they have colors.
 */
function getCardsEligibleForMagicTalentDiscard(
  hand: readonly CardId[],
  sourceCardId: CardId
): CardId[] {
  return hand.filter((cardId) => {
    if (cardId === CARD_WOUND) return false;
    if (cardId === sourceCardId) return false;
    // Must have a color (action cards or spells)
    const actionColor = getActionCardColor(cardId);
    if (actionColor !== null) return true;
    const spellColor = getSpellColor(cardId);
    return spellColor !== null;
  });
}

/**
 * Get the color of any card (action or spell).
 */
function getCardColor(cardId: CardId): BasicManaColor | null {
  const actionColor = getActionCardColor(cardId);
  if (actionColor !== null) {
    return cardColorToManaColor(actionColor);
  }
  const spellColor = getSpellColor(cardId);
  if (spellColor !== null) {
    return cardColorToManaColor(spellColor);
  }
  return null;
}

/**
 * Get spells in the offer matching a given color.
 */
function getMatchingSpellsInOffer(
  state: GameState,
  color: BasicManaColor
): { cardId: CardId; name: string }[] {
  const results: { cardId: CardId; name: string }[] = [];
  for (const cardId of state.offers.spells.cards) {
    const spellColor = getSpellColor(cardId);
    if (spellColor !== null && cardColorToManaColor(spellColor) === color) {
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

/**
 * Handle EFFECT_MAGIC_TALENT_BASIC entry point.
 *
 * Sets pendingDiscard with colorMatters so the discarded card's color
 * determines which spells from the offer are presented as choices.
 */
function handleMagicTalentBasic(
  state: GameState,
  playerIndex: number,
  player: Player,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("MagicTalentBasicEffect requires sourceCardId");
  }

  const eligibleCards = getCardsEligibleForMagicTalentDiscard(
    player.hand,
    sourceCardId
  );

  if (eligibleCards.length === 0) {
    return {
      state,
      description: "No colored cards in hand to discard for Magic Talent",
    };
  }

  // Check which cards actually have matching spells in the offer
  const cardsWithMatchingSpells = eligibleCards.filter((cardId) => {
    const color = getCardColor(cardId);
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
  // Only include colors the player can pay mana for (spell casting requires mana)
  const thenEffectByColor: Partial<Record<BasicManaColor, CardEffect>> = {};

  for (const color of ALL_BASIC_COLORS) {
    // Must be able to pay mana of this color to cast the spell
    if (!canPayForMana(state, player, color)) continue;

    const matchingSpells = getMatchingSpellsInOffer(state, color);
    if (matchingSpells.length === 0) continue;

    if (matchingSpells.length === 1) {
      // Single match: resolve directly
      const spell = matchingSpells[0]!;
      thenEffectByColor[color] = {
        type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
        spellCardId: spell.cardId,
        spellName: spell.name,
      } as ResolveMagicTalentSpellEffect;
    } else {
      // Multiple matches: present as choice
      const options: ResolveMagicTalentSpellEffect[] = matchingSpells.map(
        (spell) => ({
          type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
          spellCardId: spell.cardId,
          spellName: spell.name,
        })
      );
      thenEffectByColor[color] = {
        type: "choice" as const,
        options,
      };
    }
  }

  // If no colors survived the mana affordability check, can't cast any spell
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
    description: "Magic Talent: discard a colored card to play a spell from the offer",
    requiresChoice: true,
  };
}

/**
 * Resolve the selected spell from the offer.
 * Requires mana payment of the spell's color before resolving its basic effect.
 *
 * - 0 mana sources → cannot cast (graceful failure)
 * - 1 mana source → auto-consume and resolve spell
 * - 2+ mana sources → present mana source choice via EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA
 */
function resolveMagicTalentSpell(
  state: GameState,
  playerId: string,
  effect: ResolveMagicTalentSpellEffect,
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

  // Determine spell's mana color
  const spellColorStr = getSpellColor(effect.spellCardId);
  if (!spellColorStr) {
    return {
      state,
      description: `Spell ${effect.spellName} has no color`,
    };
  }
  const spellManaColor = cardColorToManaColor(spellColorStr);

  // Get available mana sources for this color
  const { playerIndex, player } = getPlayerContext(state, playerId);
  const manaSources = getAvailableManaSourcesForColor(state, player, spellManaColor);

  if (manaSources.length === 0) {
    return {
      state,
      description: `No ${spellManaColor} mana available to cast ${effect.spellName}`,
    };
  }

  if (manaSources.length === 1) {
    // Auto-consume the only available mana source
    const manaSource = manaSources[0]!;
    const { player: updatedPlayer, source: updatedSource } = consumeMana(
      player,
      state.source,
      manaSource,
      playerId
    );

    let updatedState = updatePlayer(state, playerIndex, updatedPlayer);
    updatedState = { ...updatedState, source: updatedSource };

    // Resolve the spell's basic effect (spell stays in offer)
    const result = resolveEffect(
      updatedState,
      playerId,
      spellCard.basicEffect,
      effect.spellCardId
    );

    return {
      ...result,
      description: `Magic Talent: played ${effect.spellName} from the Spell Offer (paid ${spellManaColor} mana)`,
    };
  }

  // Multiple mana sources — present choice
  const manaOptions: ResolveMagicTalentSpellManaEffect[] = manaSources.map(
    (manaSource) => ({
      type: EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA,
      spellCardId: effect.spellCardId,
      spellName: effect.spellName,
      manaSource,
    })
  );

  return {
    state,
    description: `Magic Talent: choose mana source to cast ${effect.spellName}`,
    requiresChoice: true,
    dynamicChoiceOptions: manaOptions,
  };
}

/**
 * Resolve mana payment and spell effect for Magic Talent basic.
 * Called when player selects a specific mana source from multiple options.
 */
function resolveMagicTalentSpellMana(
  state: GameState,
  playerId: string,
  effect: ResolveMagicTalentSpellManaEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

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

  // Consume the specified mana source
  const { player: updatedPlayer, source: updatedSource } = consumeMana(
    player,
    state.source,
    effect.manaSource,
    playerId
  );

  let updatedState = updatePlayer(state, playerIndex, updatedPlayer);
  updatedState = { ...updatedState, source: updatedSource };

  // Resolve the spell's basic effect (spell stays in offer)
  const result = resolveEffect(
    updatedState,
    playerId,
    spellCard.basicEffect,
    effect.spellCardId
  );

  return {
    ...result,
    description: `Magic Talent: played ${effect.spellName} from the Spell Offer (paid ${effect.manaSource.color} mana)`,
  };
}

// ============================================================================
// POWERED EFFECT: Pay mana, gain spell from offer to discard pile
// ============================================================================

/**
 * Handle EFFECT_MAGIC_TALENT_POWERED entry point.
 *
 * Present available mana token colors as choices. After paying mana,
 * present matching spells from offer. Selected spell goes to discard pile.
 */
function handleMagicTalentPowered(
  state: GameState,
  _playerIndex: number,
  player: Player
): EffectResolutionResult {
  // Find available mana token colors
  const availableColors = new Set<BasicManaColor>();
  for (const token of player.pureMana) {
    if (
      token.color === MANA_RED ||
      token.color === MANA_BLUE ||
      token.color === MANA_GREEN ||
      token.color === MANA_WHITE
    ) {
      availableColors.add(token.color);
    }
  }

  if (availableColors.size === 0) {
    return {
      state,
      description: "No mana tokens available to pay for Magic Talent powered",
    };
  }

  // Filter to colors that have matching spells in the offer
  const colorsWithSpells: BasicManaColor[] = [];
  for (const color of availableColors) {
    if (getMatchingSpellsInOffer(state, color).length > 0) {
      colorsWithSpells.push(color);
    }
  }

  if (colorsWithSpells.length === 0) {
    return {
      state,
      description: "No spells in the offer match any available mana color",
    };
  }

  // Build flat list of all (color, spell) combinations as gain effects
  const allOptions: ResolveMagicTalentGainEffect[] = [];
  for (const color of colorsWithSpells) {
    const matchingSpells = getMatchingSpellsInOffer(state, color);
    for (const spell of matchingSpells) {
      allOptions.push({
        type: EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
        spellCardId: spell.cardId,
        spellName: spell.name,
      });
    }
  }

  if (allOptions.length === 0) {
    return {
      state,
      description: "No matching spells available in the offer",
    };
  }

  return {
    state,
    description: "Magic Talent: choose a spell to gain from the offer",
    requiresChoice: true,
    dynamicChoiceOptions: allOptions,
  };
}

/**
 * Handle EFFECT_RESOLVE_MAGIC_TALENT_GAIN.
 *
 * Pay the mana token matching the spell's color, remove spell from offer,
 * add to player's discard pile, replenish offer from deck.
 */
function resolveMagicTalentGain(
  state: GameState,
  playerId: string,
  effect: ResolveMagicTalentGainEffect
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);

  // Verify spell is still in the offer
  if (!state.offers.spells.cards.includes(effect.spellCardId)) {
    return {
      state,
      description: `Spell ${effect.spellName} is no longer in the offer`,
    };
  }

  // Get the spell's color
  const spellColorStr = getSpellColor(effect.spellCardId);
  if (!spellColorStr) {
    throw new Error(`Spell ${effect.spellCardId} has no color`);
  }
  const spellColor = cardColorToManaColor(spellColorStr);

  // Find and consume a mana token of that color
  const tokenIndex = player.pureMana.findIndex(
    (t) => t.color === spellColor
  );
  if (tokenIndex === -1) {
    return {
      state,
      description: `No ${spellColor} mana token available to pay for spell`,
    };
  }

  const updatedPureMana = [...player.pureMana];
  updatedPureMana.splice(tokenIndex, 1);

  // Add spell to player's discard pile
  const updatedDiscard = [...player.discard, effect.spellCardId];

  const updatedPlayer: Player = {
    ...player,
    pureMana: updatedPureMana,
    discard: updatedDiscard,
  };

  let updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  // Remove spell from offer and replenish from deck
  const newOfferCards = state.offers.spells.cards.filter(
    (id) => id !== effect.spellCardId
  );
  const spellDeck = [...state.decks.spells];
  const newCard = spellDeck[0];

  if (newCard !== undefined) {
    const remainingDeck = spellDeck.slice(1);
    updatedState = {
      ...updatedState,
      offers: {
        ...updatedState.offers,
        spells: { cards: [...newOfferCards, newCard] },
      },
      decks: {
        ...updatedState.decks,
        spells: remainingDeck,
      },
    };
  } else {
    updatedState = {
      ...updatedState,
      offers: {
        ...updatedState.offers,
        spells: { cards: newOfferCards },
      },
    };
  }

  return {
    state: updatedState,
    description: `Magic Talent: gained ${effect.spellName} to discard pile (paid ${spellColor} mana)`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Magic Talent effect handlers with the effect registry.
 */
export function registerMagicTalentEffects(resolver: EffectResolver): void {
  registerEffect(
    EFFECT_MAGIC_TALENT_BASIC,
    (state, playerId, _effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleMagicTalentBasic(
        state,
        playerIndex,
        player,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
    (state, playerId, effect) => {
      return resolveMagicTalentSpell(
        state,
        playerId,
        effect as ResolveMagicTalentSpellEffect,
        resolver
      );
    }
  );

  registerEffect(
    EFFECT_MAGIC_TALENT_POWERED,
    (state, playerId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleMagicTalentPowered(state, playerIndex, player);
    }
  );

  registerEffect(
    EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
    (state, playerId, effect) => {
      return resolveMagicTalentGain(
        state,
        playerId,
        effect as ResolveMagicTalentGainEffect
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA,
    (state, playerId, effect) => {
      return resolveMagicTalentSpellMana(
        state,
        playerId,
        effect as ResolveMagicTalentSpellManaEffect,
        resolver
      );
    }
  );
}
