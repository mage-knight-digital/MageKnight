/**
 * Unit recruitment validators
 *
 * Validates unit recruitment at sites:
 * - Command slot availability
 * - Influence cost requirements
 * - Site type and accessibility
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, RecruitSite } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  RECRUIT_UNIT_ACTION,
  getUnit,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
} from "@mage-knight/shared";
import {
  NO_COMMAND_SLOTS,
  INSUFFICIENT_INFLUENCE,
  PLAYER_NOT_FOUND,
  NO_SITE,
  CANNOT_RECRUIT_HERE,
  SITE_NOT_CONQUERED,
  UNIT_TYPE_MISMATCH,
} from "../validationCodes.js";
import { getPlayerSite } from "../../helpers/siteHelpers.js";
import { SITE_PROPERTIES } from "../../../data/siteProperties.js";
import { SiteType } from "../../../types/map.js";

/**
 * Map site types to recruit site constants
 */
function siteTypeToRecruitSite(siteType: SiteType): RecruitSite | null {
  switch (siteType) {
    case SiteType.Village:
      return RECRUIT_SITE_VILLAGE;
    case SiteType.Keep:
      return RECRUIT_SITE_KEEP;
    case SiteType.MageTower:
      return RECRUIT_SITE_MAGE_TOWER;
    case SiteType.Monastery:
      return RECRUIT_SITE_MONASTERY;
    case SiteType.City:
      return RECRUIT_SITE_CITY;
    default:
      return null;
  }
}

/**
 * Check player has enough command slots to recruit
 */
export function validateCommandSlots(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const player = state.players.find((p) => p.id === playerId);
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
 * Check influence cost is met
 */
export function validateInfluenceCost(
  _state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== RECRUIT_UNIT_ACTION) return valid();

  const unitDef = getUnit(action.unitId);
  if (action.influenceSpent < unitDef.influence) {
    return invalid(
      INSUFFICIENT_INFLUENCE,
      `Unit costs ${unitDef.influence} influence, only ${action.influenceSpent} provided`
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
  if (site.type === SiteType.City && site.cityColor === "white") {
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
