/**
 * Offer-related validators for spell purchase and advanced action learning
 *
 * RULES:
 * - Spells: Bought at conquered Mage Towers for 7 influence
 * - Monastery AAs: Bought at non-burned Monasteries for 6 influence
 * - Regular AAs: Only gained through level-up rewards (not purchased)
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  SITE_REWARD_ADVANCED_ACTION,
} from "@mage-knight/shared";
import {
  SPELL_NOT_IN_OFFER,
  NOT_AT_SPELL_SITE,
  INSUFFICIENT_INFLUENCE_FOR_SPELL,
  AA_NOT_IN_OFFER,
  NOT_AT_AA_SITE,
  AA_NOT_IN_MONASTERY_OFFER,
  INSUFFICIENT_INFLUENCE_FOR_AA,
  NOT_IN_LEVEL_UP_CONTEXT,
  NO_SITE,
  SITE_NOT_CONQUERED,
  MONASTERY_BURNED,
  PLAYER_NOT_FOUND,
  ALREADY_ACTED,
  NO_LEARNING_DISCOUNT_ACTIVE,
} from "./validationCodes.js";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { SiteType } from "../../types/map.js";
import {
  SPELL_PURCHASE_COST,
  MONASTERY_AA_PURCHASE_COST,
} from "../../data/siteProperties.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { getActiveLearningDiscount } from "../rules/unitRecruitment.js";

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
 * Validate player is at a conquered Mage Tower.
 * Spells can ONLY be bought at Mage Towers (not Monasteries).
 */
export function validateAtSpellSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You must be at a Mage Tower to buy spells");
  }

  // Spells can ONLY be bought at Mage Towers
  if (site.type !== SiteType.MageTower) {
    return invalid(
      NOT_AT_SPELL_SITE,
      "Spells can only be bought at Mage Towers"
    );
  }

  // Mage Tower must be conquered
  if (!site.isConquered) {
    return invalid(SITE_NOT_CONQUERED, "You must conquer this Mage Tower first");
  }

  return valid();
}

/**
 * Validate player has enough influence to buy a spell (costs 7 influence)
 */
export function validateHasInfluenceForSpell(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.influencePoints < SPELL_PURCHASE_COST) {
    return invalid(
      INSUFFICIENT_INFLUENCE_FOR_SPELL,
      `You need ${SPELL_PURCHASE_COST} influence to buy a spell (have ${player.influencePoints})`
    );
  }

  return valid();
}

/**
 * Validate player has not already fought combat this turn.
 * Buying spells is part of site interaction — players can buy any number
 * of things (recruit, buy spells, etc.) during a single interaction.
 * Only combat blocks further interaction purchases on the same turn.
 */
export function validateNotAlreadyActedForSpell(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== BUY_SPELL_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (player.hasCombattedThisTurn) {
    return invalid(
      ALREADY_ACTED,
      "Cannot buy spells after combat this turn"
    );
  }

  return valid();
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
 * Validate player is at a valid site for learning advanced actions.
 * - Monastery AAs: Must be at a non-burned Monastery
 * - Learning AAs: No site requirement (uses Learning card modifier)
 * - Regular AAs: No site requirement (gained through level-up)
 */
export function validateAtAdvancedActionSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== LEARN_ADVANCED_ACTION_ACTION) return valid();

  // Regular AAs (from level-up) and Learning card don't require being at a specific site
  if (!action.fromMonastery) {
    return valid();
  }

  // Monastery AAs require being at a monastery
  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You must be at a Monastery to buy advanced actions");
  }

  if (site.type !== SiteType.Monastery) {
    return invalid(
      NOT_AT_AA_SITE,
      "Monastery advanced actions can only be bought at a Monastery"
    );
  }

  if (site.isBurned) {
    return invalid(
      MONASTERY_BURNED,
      "Cannot buy advanced actions from a burned monastery"
    );
  }

  return valid();
}

/**
 * Validate player has enough influence for AA purchase.
 * - Monastery: costs 6 influence
 * - Learning: costs from modifier (6 basic / 9 powered)
 * - Level-up: no cost
 */
export function validateHasInfluenceForMonasteryAA(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== LEARN_ADVANCED_ACTION_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  if (action.fromMonastery) {
    if (player.influencePoints < MONASTERY_AA_PURCHASE_COST) {
      return invalid(
        INSUFFICIENT_INFLUENCE_FOR_AA,
        `You need ${MONASTERY_AA_PURCHASE_COST} influence to buy an advanced action (have ${player.influencePoints})`
      );
    }
    return valid();
  }

  if (action.fromLearning) {
    const discount = getActiveLearningDiscount(state, playerId);
    if (!discount) {
      return invalid(
        NO_LEARNING_DISCOUNT_ACTIVE,
        "No Learning discount active"
      );
    }
    if (player.influencePoints < discount.cost) {
      return invalid(
        INSUFFICIENT_INFLUENCE_FOR_AA,
        `You need ${discount.cost} influence to buy an advanced action via Learning (have ${player.influencePoints})`
      );
    }
    return valid();
  }

  // Level-up: no influence cost
  return valid();
}

/**
 * Validate that regular AA selection is part of a level-up reward or Learning card.
 * Regular AAs from the offer can only be taken as level-up rewards or via Learning card, not purchased directly.
 */
export function validateInLevelUpContext(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== LEARN_ADVANCED_ACTION_ACTION) return valid();

  // Monastery AAs are purchased, not level-up rewards
  if (action.fromMonastery) {
    return valid();
  }

  // Learning card path: requires active learning discount modifier
  if (action.fromLearning) {
    const discount = getActiveLearningDiscount(state, playerId);
    if (!discount) {
      return invalid(
        NO_LEARNING_DISCOUNT_ACTIVE,
        "No Learning discount active — play Learning card first"
      );
    }
    return valid();
  }

  // Regular AAs require a pending level-up reward that offers AA selection
  const player = getPlayerById(state, playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const hasAAReward = player.pendingRewards.some(
    (reward) => reward.type === SITE_REWARD_ADVANCED_ACTION
  );

  if (!hasAAReward) {
    return invalid(
      NOT_IN_LEVEL_UP_CONTEXT,
      "Advanced actions can only be selected as level-up rewards"
    );
  }

  return valid();
}
