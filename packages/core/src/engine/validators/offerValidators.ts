/**
 * Offer-related validators for spell purchase and advanced action learning
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, ManaColor } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  MANA_GOLD,
} from "@mage-knight/shared";
import {
  SPELL_NOT_IN_OFFER,
  NOT_AT_SPELL_SITE,
  NO_MANA_FOR_SPELL,
  AA_NOT_IN_OFFER,
  NOT_AT_AA_SITE,
  AA_NOT_IN_MONASTERY_OFFER,
  NO_SITE,
  SITE_NOT_CONQUERED,
  MONASTERY_BURNED,
  PLAYER_NOT_FOUND,
} from "./validationCodes.js";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { SiteType } from "../../types/map.js";

// === Spell Purchase Validators ===

/**
 * Validate that the spell card is in the spell offer
 */
export function validateSpellInOffer(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  if (!state.offers.spells.cards.includes(action.cardId)) {
    return invalid(SPELL_NOT_IN_OFFER, "Spell is not available in the offer");
  }

  return valid();
}

/**
 * Validate player is at a site that allows spell purchases
 * Spells can be bought at Mage Towers (conquered) or Monasteries (not burned)
 */
export function validateAtSpellSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You must be at a site to buy spells");
  }

  // Check if site type allows spell purchases
  if (site.type !== SiteType.MageTower && site.type !== SiteType.Monastery) {
    return invalid(
      NOT_AT_SPELL_SITE,
      "Spells can only be bought at Mage Towers or Monasteries"
    );
  }

  // Mage Tower must be conquered
  if (site.type === SiteType.MageTower && !site.isConquered) {
    return invalid(SITE_NOT_CONQUERED, "You must conquer this Mage Tower first");
  }

  // Monastery must not be burned
  if (site.type === SiteType.Monastery && site.isBurned) {
    return invalid(MONASTERY_BURNED, "Cannot buy spells from a burned monastery");
  }

  return valid();
}

/**
 * Validate player has mana of the specified color to pay for the spell
 * Spells cost one mana of the specified color
 */
export function validateHasManaForSpell(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const color = action.manaPaid;

  // Check mana tokens
  const hasToken = player.pureMana.some((t) => t.color === color);
  if (hasToken) return valid();

  // Check crystals (basic colors only)
  const basicColors: ManaColor[] = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];
  if (basicColors.includes(color)) {
    const crystalCount = player.crystals[color as keyof typeof player.crystals];
    if (crystalCount > 0) return valid();
  }

  // Check mana dice from source
  const availableDie = state.source.dice.find(
    (d) => d.color === color && d.takenByPlayerId === null && !d.isDepleted
  );
  if (availableDie) return valid();

  // Special: gold can come from gold die
  if (color === MANA_GOLD) {
    const goldDie = state.source.dice.find(
      (d) => d.color === MANA_GOLD && d.takenByPlayerId === null && !d.isDepleted
    );
    if (goldDie) return valid();
  }

  // Special: black mana (night only normally, but dungeon overrides)
  if (color === MANA_BLACK) {
    const blackDie = state.source.dice.find(
      (d) => d.color === MANA_BLACK && d.takenByPlayerId === null && !d.isDepleted
    );
    if (blackDie) return valid();
  }

  return invalid(
    NO_MANA_FOR_SPELL,
    `You need ${color} mana to buy this spell`
  );
}

// === Advanced Action Learning Validators ===

/**
 * Validate that the advanced action card is in the correct offer
 */
export function validateAdvancedActionInOffer(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== LEARN_ADVANCED_ACTION_ACTION) return valid();

  if (action.fromMonastery) {
    // Check monastery offer
    if (!state.offers.monasteryAdvancedActions.includes(action.cardId)) {
      return invalid(
        AA_NOT_IN_MONASTERY_OFFER,
        "Advanced action is not available from monastery"
      );
    }
  } else {
    // Check regular advanced action offer
    if (!state.offers.advancedActions.cards.includes(action.cardId)) {
      return invalid(
        AA_NOT_IN_OFFER,
        "Advanced action is not available in the offer"
      );
    }
  }

  return valid();
}

/**
 * Validate player is at a site that allows learning advanced actions
 * Regular AA offer: at Mage Tower (conquered)
 * Monastery AA offer: at Monastery (not burned)
 */
export function validateAtAdvancedActionSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== LEARN_ADVANCED_ACTION_ACTION) return valid();

  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You must be at a site to learn advanced actions");
  }

  if (action.fromMonastery) {
    // Must be at a monastery for monastery advanced actions
    if (site.type !== SiteType.Monastery) {
      return invalid(
        NOT_AT_AA_SITE,
        "Monastery advanced actions can only be learned at a Monastery"
      );
    }

    if (site.isBurned) {
      return invalid(
        MONASTERY_BURNED,
        "Cannot learn advanced actions from a burned monastery"
      );
    }
  } else {
    // Regular advanced actions require being at a Mage Tower
    if (site.type !== SiteType.MageTower) {
      return invalid(
        NOT_AT_AA_SITE,
        "Advanced actions can only be learned at Mage Towers"
      );
    }

    if (!site.isConquered) {
      return invalid(
        SITE_NOT_CONQUERED,
        "You must conquer this Mage Tower first"
      );
    }
  }

  return valid();
}
