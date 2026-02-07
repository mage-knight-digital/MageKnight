/**
 * Unit activation options computation.
 *
 * Determines which units can be activated and which abilities are available
 * based on:
 * - Unit state (ready, not wounded)
 * - Combat phase restrictions
 * - Dungeon/tomb restrictions
 * - Ability usefulness checks
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CombatState } from "../../../types/combat.js";
import type { UnitOptions, ActivatableUnit, ActivatableAbility } from "@mage-knight/shared";
import {
  UNITS,
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
  UNIT_ABILITY_EFFECT,
  CARD_WOUND,
  type UnitAbilityType,
  type ManaColor,
} from "@mage-knight/shared";
import { canPayForMana } from "../mana.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../../types/combat.js";
import { getUnitOptions } from "./recruitment.js";
import { getUnitAbilityEffect } from "../../../data/unitAbilityEffects.js";
import { EFFECT_GAIN_BLOCK } from "../../../types/effectTypes.js";
import { isEffectResolvable } from "../../effects/index.js";
import { mustAnnounceEndOfRound } from "../helpers.js";
import { isBondsUnit } from "../../rules/bondsOfLoyalty.js";

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
 * Note: UNIT_ABILITY_EFFECT is treated as combat (since Sorcerers' effects target enemies)
 * but checked separately via effect resolvability.
 */
const COMBAT_ABILITIES: readonly UnitAbilityType[] = [
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_EFFECT,
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
 * For UNIT_ABILITY_EFFECT, pass the full ability so block-only effects can be allowed in Block phase.
 */
function isAbilityValidForPhase(
  abilityType: UnitAbilityType,
  combat: CombatState | null,
  ability?: { type: UnitAbilityType; effectId?: string }
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

    case UNIT_ABILITY_EFFECT: {
      // Block-only effects (e.g. Hero Blue Cold Fire Block 8) are valid in Block phase
      const effect = ability?.effectId
        ? getUnitAbilityEffect(ability.effectId)
        : undefined;
      const isBlockOnlyEffect = effect?.type === EFFECT_GAIN_BLOCK;
      if (isBlockOnlyEffect) {
        if (phase !== COMBAT_PHASE_BLOCK) {
          return { valid: false, reason: "Only usable in Block phase" };
        }
      } else if (
        phase !== COMBAT_PHASE_RANGED_SIEGE &&
        phase !== COMBAT_PHASE_ATTACK
      ) {
        return { valid: false, reason: "Only usable in Ranged & Siege or Attack phase" };
      }
      break;
    }

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

  // Must announce end of round before taking other actions
  if (mustAnnounceEndOfRound(state, player)) {
    return activatable;
  }

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

      // Check if unit is ready (multi-ability units track individual abilities)
      if (unitDef.multiAbility) {
        const usedIndices = unit.usedAbilityIndices ?? [];
        if (usedIndices.includes(i)) {
          canActivate = false;
          reason = "Ability already used this turn";
        }
      } else if (unit.state !== UNIT_STATE_READY) {
        canActivate = false;
        reason = "Unit is exhausted";
      }
      // Check if unit is wounded
      else if (unit.wounded) {
        canActivate = false;
        reason = "Wounded units cannot be activated";
      }
      // Check dungeon/tomb restriction for combat abilities (Bonds unit is exempt)
      else if (!unitsAllowed && COMBAT_ABILITIES.includes(ability.type) && !isBondsUnit(player, unit.instanceId)) {
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
        // Effect-based abilities with requiresCombat: false skip combat phase checks
        const skipPhaseCheck =
          ability.type === UNIT_ABILITY_EFFECT && ability.requiresCombat === false;
        const phaseCheck = skipPhaseCheck
          ? { valid: true }
          : isAbilityValidForPhase(ability.type, combat, ability);
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
          } else if (ability.type === UNIT_ABILITY_EFFECT && ability.effectId) {
            // Check if the effect is resolvable (e.g., has valid targets)
            const effect = getUnitAbilityEffect(ability.effectId);
            if (effect && !isEffectResolvable(state, player.id, effect)) {
              canActivate = false;
              reason = "Effect cannot be resolved (no valid targets)";
            }
          }
          // Check mana cost availability (if ability has mana cost)
          if (canActivate && ability.manaCost) {
            if (!canPayForMana(state, player, ability.manaCost)) {
              canActivate = false;
              reason = `Requires ${ability.manaCost} mana (unavailable)`;
            }
          }
        }
      }

      // Build the activatable ability with optional mana cost
      // For effect-based abilities, use displayName if available
      const abilityName =
        ability.type === UNIT_ABILITY_EFFECT && ability.displayName
          ? ability.displayName
          : formatAbilityType(ability.type);

      const activatableAbility: ActivatableAbility = {
        index: i,
        name: abilityName,
        canActivate,
      };

      // Add mana cost if present
      if (ability.manaCost) {
        (activatableAbility as { manaCost?: ManaColor }).manaCost = ability.manaCost;
      }

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
