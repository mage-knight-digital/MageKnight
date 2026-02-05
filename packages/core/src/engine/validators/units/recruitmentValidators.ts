/**
 * Unit recruitment validators
 *
 * Validates unit recruitment at sites:
 * - Command slot availability
 * - Influence cost requirements
 * - Site type and accessibility
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { RECRUIT_UNIT_ACTION, getUnit, CITY_COLOR_WHITE } from "@mage-knight/shared";
import {
  NO_COMMAND_SLOTS,
  INSUFFICIENT_INFLUENCE,
  PLAYER_NOT_FOUND,
  NO_SITE,
  CANNOT_RECRUIT_HERE,
  SITE_NOT_CONQUERED,
  UNIT_TYPE_MISMATCH,
  HEROES_THUGS_EXCLUSION,
} from "../validationCodes.js";
import { getPlayerSite } from "../../helpers/siteHelpers.js";
import { SITE_PROPERTIES } from "../../../data/siteProperties.js";
import { SiteType } from "../../../types/map.js";
import {
  getRefugeeCampCostModifier,
  getReputationCostModifier,
  siteTypeToRecruitSite,
  violatesHeroesThugsExclusion,
  hasRecruitedHeroThisInteraction,
  getActiveRecruitDiscount,
} from "../../rules/unitRecruitment.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Check player has enough command slots to recruit
 */
export function validateCommandSlots(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.units.length >= player.commandTokens) {
    return invalid(
      NO_COMMAND_SLOTS,
      `No command slots available (${player.units.length}/${player.commandTokens})`
    );
  }

  return valid();
}

/**
 * Check influence cost is met.
 * At Refugee Camp, the tiered cost modifier is added to the base cost.
 * Reputation modifier also affects the final cost.
 * Heroes get a doubled reputation modifier (once per interaction).
 */
export function validateInfluenceCost(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unitDef = getUnit(action.unitId);
  let requiredCost = unitDef.influence;

  // Add Refugee Camp tiered cost modifier if applicable
  const site = getPlayerSite(state, playerId);
  if (site?.type === SiteType.RefugeeCamp) {
    requiredCost += getRefugeeCampCostModifier(unitDef);
  }

  // Add reputation modifier (positive rep = cheaper, negative = more expensive)
  // Heroes get doubled modifier (once per interaction)
  const heroAlreadyRecruited = hasRecruitedHeroThisInteraction(
    player.unitsRecruitedThisInteraction
  );
  const reputationModifier = getReputationCostModifier(
    player.reputation,
    action.unitId,
    heroAlreadyRecruited
  );
  requiredCost = Math.max(0, requiredCost + reputationModifier);

  // Apply recruit discount if available (Ruthless Coercion)
  const discountMod = getActiveRecruitDiscount(state, playerId);
  if (discountMod) {
    requiredCost = Math.max(0, requiredCost - discountMod.discount);
  }

  if (action.influenceSpent < requiredCost) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Unit costs ${requiredCost} influence, only ${action.influenceSpent} provided`
    );
  }

  return valid();
}

/**
 * Validate player is at a site that allows recruitment
 */
export function validateAtRecruitmentSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const site = getPlayerSite(state, playerId);

  if (!site) {
    return invalid(NO_SITE, "You must be at a site to recruit");
  }

  const props = SITE_PROPERTIES[site.type];
  if (!props.inhabited) {
    return invalid(CANNOT_RECRUIT_HERE, "This site does not allow recruitment");
  }

  // Fortified sites must be conquered
  if (props.fortified && !site.isConquered) {
    return invalid(SITE_NOT_CONQUERED, "You must conquer this site first");
  }

  return valid();
}

/**
 * Validate unit type matches the site's recruitment options
 */
export function validateUnitTypeMatchesSite(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const site = getPlayerSite(state, playerId);
  if (!site) return valid(); // Other validator handles

  const unitDef = getUnit(action.unitId);

  // White cities allow all unit types
  if (site.type === SiteType.City && site.cityColor === CITY_COLOR_WHITE) {
    return valid();
  }

  // Refugee Camp allows all unit types (with tiered costs, handled elsewhere)
  if (site.type === SiteType.RefugeeCamp) {
    return valid();
  }

  // Map site type to recruit site constant
  const recruitSite = siteTypeToRecruitSite(site.type);
  if (recruitSite === null) {
    return invalid(CANNOT_RECRUIT_HERE, "Cannot recruit units at this site");
  }

  // Check if unit's site types include this site
  if (!unitDef.recruitSites.includes(recruitSite)) {
    return invalid(
      UNIT_TYPE_MISMATCH,
      `${unitDef.name} cannot be recruited at this site`
    );
  }

  return valid();
}

/**
 * Validate Heroes/Thugs exclusion rule.
 * Cannot recruit Heroes and Thugs during the same interaction (site visit).
 */
export function validateHeroesThugsExclusion(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (
    violatesHeroesThugsExclusion(
      action.unitId,
      player.unitsRecruitedThisInteraction
    )
  ) {
    return invalid(
      HEROES_THUGS_EXCLUSION,
      "Cannot recruit Heroes and Thugs during the same interaction"
    );
  }

  return valid();
}
