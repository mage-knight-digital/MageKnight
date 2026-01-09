/**
 * Unit options computation for valid actions.
 *
 * Determines which units can be recruited based on:
 * - Player's current location (must be at a recruit site)
 * - Site ownership (keeps/mage towers must be conquered by player, cities must be conquered)
 * - Unit's recruit sites vs current site type
 * - Player's influence points and reputation modifier
 * - Command token limit
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CombatState } from "../../types/combat.js";
import type { UnitOptions, RecruitableUnit, ActivatableUnit, ActivatableAbility } from "@mage-knight/shared";
import {
  UNITS,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  UNIT_STATE_READY,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
  CARD_WOUND,
  MIN_REPUTATION,
  MAX_REPUTATION,
  type RecruitSite,
  type UnitId,
  type UnitAbilityType,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

/**
 * Reputation cost modifier based on player's reputation track position.
 * Higher reputation = lower costs, lower reputation = higher costs.
 *
 * Per rulebook:
 * -7: +5 | -6: +3 | -5: +3 | -4: +2 | -3: +2 | -2: +1 | -1: +1
 *  0: 0
 * +1: -1 | +2: -1 | +3: -2 | +4: -2 | +5: -3 | +6: -3 | +7: -5
 */
function getReputationCostModifier(reputation: number): number {
  // Clamp to valid range
  const rep = Math.max(MIN_REPUTATION, Math.min(MAX_REPUTATION, reputation));

  if (rep === 0) return 0;
  if (rep === MIN_REPUTATION) return 5;
  if (rep === MAX_REPUTATION) return -5;

  // Symmetric pattern: ±1-2 = ±1, ±3-4 = ±2, ±5-6 = ±3
  const absRep = Math.abs(rep);
  let modifier: number;
  if (absRep <= 2) {
    modifier = 1;
  } else if (absRep <= 4) {
    modifier = 2;
  } else {
    modifier = 3;
  }

  return rep < 0 ? modifier : -modifier;
}

/**
 * Map site type to recruit site constant.
 * Returns null if the site type doesn't support recruitment.
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
 * Check if a site is accessible for recruitment.
 *
 * Villages are always accessible.
 * Keeps/Mage Towers must be conquered by the player.
 * Cities must be conquered (any player).
 * Monasteries must not be burned and must be conquered if fortified.
 */
function isSiteAccessibleForRecruitment(
  siteType: SiteType,
  isConquered: boolean,
  owner: string | null,
  playerId: string,
  isBurned: boolean
): boolean {
  switch (siteType) {
    case SiteType.Village:
      // Villages are always accessible
      return true;

    case SiteType.Keep:
    case SiteType.MageTower:
      // Fortified sites must be conquered by this player
      return isConquered && owner === playerId;

    case SiteType.City:
      // Cities must be conquered (by any player)
      return isConquered;

    case SiteType.Monastery:
      // Monasteries can't be burned, and must be conquered if fortified
      // (Monasteries in base game aren't fortified, but check anyway)
      return !isBurned;

    default:
      return false;
  }
}

/**
 * Get the number of command tokens used by current units.
 * Each unit costs 1 command token.
 */
function getUsedCommandTokens(player: Player): number {
  return player.units.length;
}

/**
 * Compute unit options for a player.
 *
 * Returns recruitable units from the offer that match:
 * - Current site type
 * - Site ownership requirements
 * - Cost calculation with reputation modifier
 * - Command token availability
 */
export function getUnitOptions(
  state: GameState,
  player: Player
): UnitOptions | undefined {
  // Player must be on the map
  if (!player.position) {
    return undefined;
  }

  // Get hex at player's position
  const hexKey = `${player.position.q},${player.position.r}`;
  const hex = state.map.hexes[hexKey];
  if (!hex || !hex.site) {
    return undefined;
  }

  // Check if site type supports recruitment
  const recruitSite = siteTypeToRecruitSite(hex.site.type);
  if (!recruitSite) {
    return undefined;
  }

  // Check if site is accessible for recruitment
  if (
    !isSiteAccessibleForRecruitment(
      hex.site.type,
      hex.site.isConquered,
      hex.site.owner,
      player.id,
      hex.site.isBurned
    )
  ) {
    return undefined;
  }

  // Calculate reputation modifier
  const reputationModifier = getReputationCostModifier(player.reputation);

  // Check command token availability
  const usedTokens = getUsedCommandTokens(player);
  const hasCommandTokens = usedTokens < player.commandTokens;

  // Build list of recruitable units from the offer
  const recruitable: RecruitableUnit[] = [];

  for (const unitId of state.offers.units) {
    const unit = UNITS[unitId as UnitId];
    if (!unit) continue;

    // Check if unit can be recruited at this site type
    if (!unit.recruitSites.includes(recruitSite)) {
      continue;
    }

    // Calculate cost with reputation modifier (minimum 0)
    const baseCost = unit.influence;
    const adjustedCost = Math.max(0, baseCost + reputationModifier);

    // Check if player can afford it
    const canAfford =
      hasCommandTokens && player.influencePoints >= adjustedCost;

    recruitable.push({
      unitId: unit.id,
      cost: adjustedCost,
      canAfford,
    });
  }

  // If no units are recruitable at this site, return undefined
  if (recruitable.length === 0) {
    return undefined;
  }

  return {
    recruitable,
    activatable: [], // Recruitment context - no activation here
  };
}

// =============================================================================
// UNIT ABILITY ACTIVATION
// =============================================================================

/**
 * Passive abilities that cannot be manually activated.
 * These apply automatically when the unit attacks.
 */
const PASSIVE_ABILITIES: readonly UnitAbilityType[] = [
  UNIT_ABILITY_SWIFT,
  UNIT_ABILITY_BRUTAL,
  UNIT_ABILITY_POISON,
  UNIT_ABILITY_PARALYZE,
];

/**
 * Combat abilities that require being in combat.
 */
const COMBAT_ABILITIES: readonly UnitAbilityType[] = [
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
];

/**
 * Format ability type for display.
 */
function formatAbilityType(type: UnitAbilityType): string {
  switch (type) {
    case UNIT_ABILITY_ATTACK:
      return "Attack";
    case UNIT_ABILITY_BLOCK:
      return "Block";
    case UNIT_ABILITY_RANGED_ATTACK:
      return "Ranged Attack";
    case UNIT_ABILITY_SIEGE_ATTACK:
      return "Siege Attack";
    case UNIT_ABILITY_MOVE:
      return "Move";
    case UNIT_ABILITY_INFLUENCE:
      return "Influence";
    case UNIT_ABILITY_HEAL:
      return "Heal";
    default:
      return type.replace(/_/g, " ");
  }
}

/**
 * Check if an ability is usable in the current combat phase.
 */
function isAbilityValidForPhase(
  abilityType: UnitAbilityType,
  combat: CombatState | null
): { valid: boolean; reason?: string } {
  // Non-combat abilities don't require being in combat
  if (!COMBAT_ABILITIES.includes(abilityType)) {
    return { valid: true };
  }

  // Combat abilities require active combat
  if (!combat) {
    return { valid: false, reason: "Combat abilities require active combat" };
  }

  const phase = combat.phase;

  switch (abilityType) {
    case UNIT_ABILITY_RANGED_ATTACK:
    case UNIT_ABILITY_SIEGE_ATTACK:
      if (phase !== COMBAT_PHASE_RANGED_SIEGE && phase !== COMBAT_PHASE_ATTACK) {
        return { valid: false, reason: "Only usable in Ranged & Siege or Attack phase" };
      }
      break;

    case UNIT_ABILITY_BLOCK:
      if (phase !== COMBAT_PHASE_BLOCK) {
        return { valid: false, reason: "Only usable in Block phase" };
      }
      break;

    case UNIT_ABILITY_ATTACK:
      if (phase !== COMBAT_PHASE_ATTACK) {
        return { valid: false, reason: "Only usable in Attack phase" };
      }
      break;
  }

  return { valid: true };
}

/**
 * Check if a heal ability would have any effect.
 * Similar to isEffectResolvable for card healing.
 */
function isHealAbilityUseful(player: Player): boolean {
  // Check for wound cards in hand
  const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
  // Check for wounded units
  const hasWoundedUnits = player.units.some((u) => u.wounded);
  return hasWoundsInHand || hasWoundedUnits;
}

/**
 * Check if a move ability would be useful.
 * Always useful outside combat (can always use move points).
 */
function isMoveAbilityUseful(combat: CombatState | null): boolean {
  // Can't use move in combat
  return combat === null;
}

/**
 * Check if an influence ability would be useful.
 * Always useful outside combat (can always use influence points).
 */
function isInfluenceAbilityUseful(combat: CombatState | null): boolean {
  // Can't use influence in combat
  return combat === null;
}

/**
 * Check if siege is required but unit only has ranged.
 */
function checkSiegeRequirement(
  abilityType: UnitAbilityType,
  combat: CombatState | null
): { blocked: boolean; reason?: string } {
  if (!combat) return { blocked: false };

  // In Ranged & Siege phase at fortified site, only Siege attacks work
  if (
    combat.phase === COMBAT_PHASE_RANGED_SIEGE &&
    combat.isAtFortifiedSite &&
    abilityType === UNIT_ABILITY_RANGED_ATTACK
  ) {
    return { blocked: true, reason: "Siege required against fortified enemies" };
  }

  return { blocked: false };
}

/**
 * Get activatable units for a player.
 *
 * Returns units that can be activated with their abilities and activation status.
 * Uses same pattern as isEffectResolvable - abilities are only shown as activatable
 * if they would actually be useful (e.g., heal only if there are wounds).
 */
export function getActivatableUnits(
  state: GameState,
  player: Player,
  combat: CombatState | null
): ActivatableUnit[] {
  const activatable: ActivatableUnit[] = [];

  // Check dungeon/tomb restriction
  const unitsAllowed = combat === null || combat.unitsAllowed;

  for (const unit of player.units) {
    const unitDef = UNITS[unit.unitId];
    if (!unitDef) continue;

    // Skip units with no abilities
    if (unitDef.abilities.length === 0) continue;

    const abilities: ActivatableAbility[] = [];

    for (let i = 0; i < unitDef.abilities.length; i++) {
      const ability = unitDef.abilities[i];
      if (!ability) continue; // Satisfy TypeScript strict mode

      let canActivate = true;
      let reason: string | undefined;

      // Check if unit is ready
      if (unit.state !== UNIT_STATE_READY) {
        canActivate = false;
        reason = "Unit is exhausted";
      }
      // Check if unit is wounded
      else if (unit.wounded) {
        canActivate = false;
        reason = "Wounded units cannot be activated";
      }
      // Check dungeon/tomb restriction for combat abilities
      else if (!unitsAllowed && COMBAT_ABILITIES.includes(ability.type)) {
        canActivate = false;
        reason = "Units cannot be used in this combat (dungeon/tomb)";
      }
      // Check passive abilities
      else if (PASSIVE_ABILITIES.includes(ability.type)) {
        canActivate = false;
        reason = "Passive ability (applies automatically)";
      }
      // Check phase restrictions for combat abilities
      else {
        const phaseCheck = isAbilityValidForPhase(ability.type, combat);
        if (!phaseCheck.valid) {
          canActivate = false;
          reason = phaseCheck.reason;
        }
        // Check siege requirement
        else {
          const siegeCheck = checkSiegeRequirement(ability.type, combat);
          if (siegeCheck.blocked) {
            canActivate = false;
            reason = siegeCheck.reason;
          }
          // Check if non-combat abilities are useful
          else if (ability.type === UNIT_ABILITY_HEAL) {
            if (!isHealAbilityUseful(player)) {
              canActivate = false;
              reason = "No wounds to heal";
            }
          } else if (ability.type === UNIT_ABILITY_MOVE) {
            if (!isMoveAbilityUseful(combat)) {
              canActivate = false;
              reason = "Cannot use move in combat";
            }
          } else if (ability.type === UNIT_ABILITY_INFLUENCE) {
            if (!isInfluenceAbilityUseful(combat)) {
              canActivate = false;
              reason = "Cannot use influence in combat";
            }
          }
        }
      }

      const activatableAbility: ActivatableAbility = {
        index: i,
        name: formatAbilityType(ability.type),
        canActivate,
      };

      // Only add reason if can't activate
      if (!canActivate && reason) {
        (activatableAbility as { reason?: string }).reason = reason;
      }

      abilities.push(activatableAbility);
    }

    // Only include unit if it has at least one ability (even if none are activatable)
    // This allows UI to show greyed-out abilities with reasons
    if (abilities.length > 0) {
      activatable.push({
        unitInstanceId: unit.instanceId,
        unitId: unit.unitId,
        abilities,
      });
    }
  }

  return activatable;
}

/**
 * Get unit options for combat (activation only, no recruitment).
 */
export function getUnitOptionsForCombat(
  state: GameState,
  player: Player,
  combat: CombatState
): UnitOptions | undefined {
  const activatable = getActivatableUnits(state, player, combat);

  // Only return if there are units to show
  if (activatable.length === 0) {
    return undefined;
  }

  return {
    recruitable: [], // No recruitment in combat
    activatable,
  };
}

/**
 * Get full unit options for normal turn (recruitment + activation).
 * Combines recruitment options (if at a site) with activation options.
 */
export function getFullUnitOptions(
  state: GameState,
  player: Player
): UnitOptions | undefined {
  // Get recruitment options (may be undefined if not at a site)
  const recruitOptions = getUnitOptions(state, player);

  // Get activatable units for non-combat context
  const activatable = getActivatableUnits(state, player, null);

  // If neither recruitment nor activation is available, return undefined
  if (!recruitOptions && activatable.length === 0) {
    return undefined;
  }

  return {
    recruitable: recruitOptions?.recruitable ?? [],
    activatable,
  };
}
