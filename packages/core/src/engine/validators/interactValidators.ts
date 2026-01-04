/**
 * Validators for site interaction actions
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import { INTERACT_ACTION } from "@mage-knight/shared";
import { getPlayerSite } from "../helpers/siteHelpers.js";
import { SITE_PROPERTIES, getHealingCost } from "../../data/siteProperties.js";
import { SiteType } from "../../types/map.js";
import {
  NO_SITE,
  NOT_INHABITED,
  SITE_NOT_CONQUERED,
  NOT_YOUR_KEEP,
  MONASTERY_BURNED,
  NO_HEALING_HERE,
} from "./validationCodes.js";

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

  const props = SITE_PROPERTIES[site.type];
  if (!props.inhabited) {
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

  const props = SITE_PROPERTIES[site.type];

  // Fortified sites require conquest
  if (props.fortified && !site.isConquered) {
    return invalid(
      SITE_NOT_CONQUERED,
      "You must conquer this site before interacting"
    );
  }

  // Keeps specifically require ownership (not just conquest)
  if (site.type === SiteType.Keep && site.owner !== playerId) {
    return invalid(
      NOT_YOUR_KEEP,
      "You can only interact with keeps you own"
    );
  }

  // Burned monasteries can't be interacted with
  if (site.type === SiteType.Monastery && site.isBurned) {
    return invalid(MONASTERY_BURNED, "This monastery has been burned");
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
  if (action.type !== INTERACT_ACTION) return valid();
  if (!action.healing || action.healing <= 0) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) return valid(); // Other validator handles this

  const healingCost = getHealingCost(site.type);
  if (healingCost === null) {
    return invalid(NO_HEALING_HERE, "This site does not offer healing");
  }

  // Note: Influence validation happens in the command
  // since we need to calculate total influence from cards played

  return valid();
}
