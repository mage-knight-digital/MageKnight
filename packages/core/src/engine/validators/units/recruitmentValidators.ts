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
import { RECRUIT_UNIT_ACTION, getUnit, CITY_COLOR_WHITE, MIN_REPUTATION } from "@mage-knight/shared";
import {
  INSUFFICIENT_INFLUENCE,
  PLAYER_NOT_FOUND,
  NO_SITE,
  CANNOT_RECRUIT_HERE,
  SITE_NOT_CONQUERED,
  UNIT_TYPE_MISMATCH,
  HEROES_THUGS_EXCLUSION,
  REPUTATION_TOO_LOW_TO_RECRUIT,
  RECRUIT_REQUIRES_MANA,
  RECRUIT_REQUIRES_MANA_TOKEN_COLOR,
  DISBAND_REQUIRED,
  DISBAND_UNIT_NOT_FOUND,
  CANNOT_DISBAND_BONDS_UNIT,
} from "../validationCodes.js";
import { validateSingleManaSource } from "../mana/sourceValidators.js";
import { canPayForMana } from "../../validActions/mana.js";
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
  isGladeRecruitment,
  shouldIgnoreReputationEffects,
} from "../../rules/unitRecruitment.js";
import { getEffectiveCommandTokens, isBondsSlotEmpty, isBondsUnit, BONDS_INFLUENCE_DISCOUNT } from "../../rules/bondsOfLoyalty.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

/**
 * Check player reputation is not at "X" (MIN_REPUTATION = -7).
 * At "X" reputation, inhabitants refuse to interact with the player entirely.
 */
export function validateReputationNotX(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  // Magical Glade recruitment ignores reputation entirely
  const site = getPlayerSite(state, playerId);
  if (site && isGladeRecruitment(site.type)) return valid();
  if (shouldIgnoreReputationEffects(state, playerId)) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  if (player.reputation <= MIN_REPUTATION) {
    return invalid(
      REPUTATION_TOO_LOW_TO_RECRUIT,
      "At X reputation, inhabitants refuse to interact with you"
    );
  }

  return valid();
}

/**
 * Check player has enough command slots to recruit.
 * If at the limit, the player may still recruit by disbanding an existing unit.
 */
export function validateCommandSlots(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const effectiveTokens = getEffectiveCommandTokens(player);
  const atLimit = player.units.length >= effectiveTokens;

  if (atLimit && !action.disbandUnitInstanceId) {
    return invalid(
      DISBAND_REQUIRED,
      `No command slots available (${player.units.length}/${effectiveTokens}) — disband a unit to recruit`
    );
  }

  return valid();
}

/**
 * Validate the disband target when recruiting at the command limit.
 * The disbandUnitInstanceId must reference an existing unit owned by the player.
 */
export function validateDisbandTarget(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();
  if (!action.disbandUnitInstanceId) return valid();

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  const unit = player.units.find(
    (u) => u.instanceId === action.disbandUnitInstanceId
  );

  if (!unit) {
    return invalid(
      DISBAND_UNIT_NOT_FOUND,
      "Unit to disband not found in your command"
    );
  }

  // Cannot disband the Bonds of Loyalty unit
  if (isBondsUnit(player, action.disbandUnitInstanceId)) {
    return invalid(
      CANNOT_DISBAND_BONDS_UNIT,
      "Cannot disband the Bonds of Loyalty unit"
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
  // Magical Glade recruitment ignores reputation modifier
  if (!site || !isGladeRecruitment(site.type)) {
    const heroAlreadyRecruited = hasRecruitedHeroThisInteraction(
      player.unitsRecruitedThisInteraction
    );
    const reputationModifier = getReputationCostModifier(
      player.reputation,
      action.unitId,
      heroAlreadyRecruited,
      shouldIgnoreReputationEffects(state, playerId)
    );
    requiredCost = Math.max(0, requiredCost + reputationModifier);
  }

  // Apply recruit discount if available (Ruthless Coercion)
  const discountMod = getActiveRecruitDiscount(state, playerId);
  if (discountMod) {
    requiredCost = Math.max(0, requiredCost - discountMod.discount);
  }

  // Apply Bonds of Loyalty discount if the Bonds slot is empty
  // (the next unit recruited fills the Bonds slot and gets -5 Influence)
  if (isBondsSlotEmpty(player)) {
    requiredCost = Math.max(0, requiredCost - BONDS_INFLUENCE_DISCOUNT);
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
  // Magical Glade allows recruitment despite not being inhabited
  if (!props.inhabited && !isGladeRecruitment(site.type)) {
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

/**
 * Validate mana payment for Magic Familiars recruitment.
 * Units with restrictedFromFreeRecruit require a mana payment and
 * a basic color selection for the mana token.
 */
export function validateRecruitManaPayment(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const unitDef = getUnit(action.unitId);

  // Only Magic Familiars (restrictedFromFreeRecruit) require mana payment
  if (!unitDef.restrictedFromFreeRecruit) return valid();

  // Must provide a mana source
  if (!action.manaSource) {
    return invalid(
      RECRUIT_REQUIRES_MANA,
      "Recruiting Magic Familiars requires paying 1 basic mana"
    );
  }

  // Must specify which basic color the token becomes
  if (!action.manaTokenColor) {
    return invalid(
      RECRUIT_REQUIRES_MANA_TOKEN_COLOR,
      "Must specify which basic color for the mana token"
    );
  }

  const player = getPlayerById(state, playerId);
  if (!player) return invalid(PLAYER_NOT_FOUND, "Player not found");

  // Check player can pay for the specified mana color
  if (!canPayForMana(state, player, action.manaSource.color)) {
    return invalid(
      RECRUIT_REQUIRES_MANA,
      "No mana available to pay for Magic Familiars recruitment"
    );
  }

  // Validate the specific mana source
  return validateSingleManaSource(state, player, action.manaSource, playerId);
}
