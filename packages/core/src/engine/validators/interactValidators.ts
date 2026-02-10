/**
 * Validators for site interaction actions
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { INTERACT_ACTION, BUY_HEALING_ACTION, CARD_WOUND } from "@mage-knight/shared";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { SiteType } from "../../types/map.js";
import {
  NO_SITE,
  NOT_INHABITED,
  SITE_NOT_CONQUERED,
  NOT_YOUR_KEEP,
  MONASTERY_BURNED,
  NO_HEALING_HERE,
  INSUFFICIENT_INFLUENCE,
} from "./validationCodes.js";
import {
  canInteractWithSite,
  isSiteAccessibleForInteraction,
  canHealAtSite,
} from "../rules/siteInteraction.js";
import { getHealingCost } from "../../data/siteProperties.js";

/**
 * Must be at an inhabited site to interact
 */
export function validateAtInhabitedSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== INTERACT_ACTION) return valid();

  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You are not at a site");
  }

  if (!canInteractWithSite(site)) {
    return invalid(NOT_INHABITED, "This site does not allow interaction");
  }

  return valid();
}

/**
 * Fortified sites must be conquered before interaction.
 * Keeps specifically require ownership (not just conquest).
 */
export function validateSiteAccessible(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== INTERACT_ACTION) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) return valid(); // Other validator handles this

  if (!isSiteAccessibleForInteraction(site, playerId)) {
    // Determine specific error message
    const props = SITE_PROPERTIES[site.type];
    if (props.fortified && !site.isConquered) {
      return invalid(
        SITE_NOT_CONQUERED,
        "You must conquer this site before interacting"
      );
    }

    if (site.type === SiteType.Keep && site.owner !== playerId) {
      return invalid(
        NOT_YOUR_KEEP,
        "You can only interact with keeps you own"
      );
    }

    if (site.type === SiteType.Monastery && site.isBurned) {
      return invalid(MONASTERY_BURNED, "This monastery has been burned");
    }
  }

  return valid();
}

/**
 * Validate healing purchase if specified
 */
export function validateHealingPurchase(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== INTERACT_ACTION && action.type !== BUY_HEALING_ACTION) {
    return valid();
  }

  const requestedHealing =
    action.type === BUY_HEALING_ACTION ? action.amount : (action.healing ?? 0);
  if (requestedHealing <= 0) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) return valid(); // Other validator handles this

  if (!canHealAtSite(site.type, site.isBurned)) {
    return invalid(NO_HEALING_HERE, "This site does not offer healing");
  }

  const player = getPlayerById(state, playerId);
  if (!player) return valid();

  const healingCost = getHealingCost(site.type);
  if (healingCost === null) {
    return invalid(NO_HEALING_HERE, "This site does not offer healing");
  }

  const woundsInHand = player.hand.filter((cardId) => cardId === CARD_WOUND).length;
  const actualHealingPoints = Math.min(requestedHealing, woundsInHand);
  const totalCost = actualHealingPoints * healingCost;

  if (totalCost > player.influencePoints) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Need ${totalCost} influence to buy ${actualHealingPoints} healing`
    );
  }

  return valid();
}
