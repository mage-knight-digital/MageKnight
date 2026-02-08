/**
 * Combat-related modifier effective value calculations
 *
 * Functions for calculating effective enemy stats and checking combat
 * modifiers like ability nullification and resistance removal.
 */

import type { GameState } from "../../state/GameState.js";
import type {
  EnemyStatModifier,
  CombatValueModifier,
  AbilityNullifierModifier,
  HeroDamageReductionModifier,
  ActiveModifier,
} from "../../types/modifiers.js";
import type { EnemyAbility } from "../../types/enemy.js";
import type { CombatEnemy, CombatPhase } from "../../types/combat.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { ABILITY_ELUSIVE } from "@mage-knight/shared";
import { ENEMY_ABILITY_ELUSIVE } from "../../types/enemyConstants.js";
import type { DiseaseArmorModifier } from "../../types/modifiers.js";
import {
  ABILITY_ANY,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_COMBAT_VALUE,
  EFFECT_DISEASE_ARMOR,
  EFFECT_DOUBLE_PHYSICAL_ATTACKS,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_ENEMY_STAT,
  EFFECT_HERO_DAMAGE_REDUCTION,
  EFFECT_REMOVE_FIRE_RESISTANCE,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  EFFECT_DEFEAT_IF_BLOCKED,
  EFFECT_REMOVE_RESISTANCES,
  EFFECT_POSSESS_ATTACK_RESTRICTION,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  SCOPE_ALL_ENEMIES,
  SCOPE_ONE_ENEMY,
} from "../../types/modifierConstants.js";
import {
  getModifiersForPlayer,
  getModifiersForEnemy,
  hasArcaneImmunity,
} from "./queries.js";
import { isEnemyFullyBlocked } from "../combat/enemyAttackHelpers.js";
import { getTotalDefendBonus } from "../combat/defendHelpers.js";
import { getVampiricArmorBonus } from "../combat/vampiricHelpers.js";
import { getFortificationLevel } from "../validators/combatValidators/index.js";

/**
 * Get effective enemy armor after modifiers.
 * @param resistanceCount - number of resistances the enemy has (for Resistance Break)
 * @param playerId - player ID for checking fortification modifiers (Earthquake spell)
 *
 * Note: Arcane Immunity blocks armor modification effects (non-Attack/Block effect).
 */
export function getEffectiveEnemyArmor(
  state: GameState,
  enemyId: string,
  baseArmor: number,
  resistanceCount: number,
  playerId: string
): number {
  // Get Defend bonus (from another enemy's Defend ability)
  // Defend bonus is NOT blocked by Arcane Immunity because it's FROM another enemy,
  // not an effect targeting this enemy
  const defendBonus = getTotalDefendBonus(state, enemyId);

  // Get Vampiric bonus (from wounds this enemy has caused)
  // Vampiric is NOT blocked by Arcane Immunity because it's a self-buff
  // based on past actions, not an external effect
  const vampiricBonus = getVampiricArmorBonus(state, enemyId);

  // Arcane Immunity blocks armor reduction effects (but not Defend/Vampiric bonus)
  if (hasArcaneImmunity(state, enemyId)) {
    return baseArmor + defendBonus + vampiricBonus;
  }

  // Get enemy resistances for excludeResistance filtering (Demolish spell)
  const enemy = state.combat?.enemies.find((e) => e.instanceId === enemyId);
  const enemyResistances = enemy?.definition.resistances ?? [];

  const modifiers = getModifiersForEnemy(state, enemyId)
    .filter(
      (m) => m.effect.type === EFFECT_ENEMY_STAT && m.effect.stat === ENEMY_STAT_ARMOR
    )
    .map((m) => m.effect as EnemyStatModifier);

  let armor = baseArmor;
  let minAllowed = 1;

  for (const mod of modifiers) {
    // Skip modifier if enemy has the excluded resistance (e.g., Fire Resistant vs Demolish)
    if (mod.excludeResistance && enemyResistances.includes(mod.excludeResistance)) {
      continue;
    }
    if (mod.perResistance) {
      // Resistance Break: -1 per resistance
      armor += mod.amount * resistanceCount;
    } else if (mod.fortifiedAmount !== undefined) {
      // Earthquake: use fortifiedAmount if target is fortified, otherwise base amount
      const enemy = state.combat?.enemies.find((e) => e.instanceId === enemyId);
      if (enemy && state.combat) {
        const fortLevel = getFortificationLevel(
          enemy,
          state.combat.isAtFortifiedSite,
          state,
          playerId
        );
        armor += fortLevel > 0 ? mod.fortifiedAmount : mod.amount;
      } else {
        // Fallback to base amount if enemy not found
        armor += mod.amount;
      }
    } else {
      armor += mod.amount;
    }
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  // Check for Disease armor modifier (sets armor to fixed value)
  // Disease applies AFTER all other modifiers and bonuses per rules:
  // "White City bonus applies first, THEN Disease reduces to 1"
  const diseaseModifiers = getModifiersForEnemy(state, enemyId)
    .filter((m) => m.effect.type === EFFECT_DISEASE_ARMOR)
    .map((m) => m.effect as DiseaseArmorModifier);

  if (diseaseModifiers.length > 0) {
    // Disease overrides armor to setTo value (typically 1)
    const diseaseValue = diseaseModifiers[0]!.setTo;
    return diseaseValue;
  }

  // Apply Defend bonus AFTER modifiers (it's an external bonus, not a modifier)
  armor += defendBonus;

  // Apply Vampiric bonus AFTER modifiers (it's a self-buff, not a modifier)
  armor += vampiricBonus;

  return Math.max(minAllowed, armor);
}

/**
 * Get effective enemy attack after modifiers.
 *
 * Note: Arcane Immunity blocks attack modification effects (non-Attack/Block effect).
 */
export function getEffectiveEnemyAttack(
  state: GameState,
  enemyId: string,
  baseAttack: number
): number {
  // Arcane Immunity blocks attack modification effects
  if (hasArcaneImmunity(state, enemyId)) {
    return baseAttack;
  }

  const modifiers = getModifiersForEnemy(state, enemyId)
    .filter(
      (m) =>
        m.effect.type === EFFECT_ENEMY_STAT && m.effect.stat === ENEMY_STAT_ATTACK
    )
    .map((m) => m.effect as EnemyStatModifier);

  let attack = baseAttack;
  // Default minimum is 0 - enemies can have 0 attack (e.g., Summoners)
  // Modifiers can set a higher minimum if needed
  let minAllowed = 0;

  for (const mod of modifiers) {
    attack += mod.amount;
    minAllowed = Math.max(minAllowed, mod.minimum);
  }

  return Math.max(minAllowed, attack);
}

/**
 * Get combat value bonus from active modifiers.
 * Used to add modifier bonuses to attack/block values.
 */
export function getEffectiveCombatBonus(
  state: GameState,
  playerId: string,
  valueType: CombatValueModifier["valueType"],
  element?: CombatValueModifier["element"]
): number {
  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_COMBAT_VALUE)
    .map((m) => m.effect as CombatValueModifier);

  let bonus = 0;

  for (const mod of modifiers) {
    // Check if valueType matches
    if (mod.valueType !== valueType) continue;

    // Check if element matches (undefined on modifier means all elements)
    if (mod.element && element && mod.element !== element) continue;

    bonus += mod.amount;
  }

  return bonus;
}

/**
 * Check if an enemy ability is nullified by active modifiers.
 * Used to check if abilities like Swift, Brutal, Fortified, etc. should be ignored.
 *
 * Note: Arcane Immunity blocks ability nullification effects (non-Attack/Block effect).
 */
export function isAbilityNullified(
  state: GameState,
  playerId: string,
  enemyId: string,
  abilityType: EnemyAbility["type"]
): boolean {
  // Arcane Immunity blocks ability nullification effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }

  const modifiers = getModifiersForPlayer(state, playerId)
    .filter((m) => m.effect.type === EFFECT_ABILITY_NULLIFIER)
    .map((m) => ({
      scope: m.scope,
      effect: m.effect as AbilityNullifierModifier,
    }));

  for (const mod of modifiers) {
    // Check scope targets this enemy
    if (mod.scope.type === SCOPE_ONE_ENEMY && mod.scope.enemyId !== enemyId)
      continue;
    if (mod.scope.type !== SCOPE_ONE_ENEMY && mod.scope.type !== SCOPE_ALL_ENEMIES)
      continue;

    // Check ability match
    if (mod.effect.ability === ABILITY_ANY || mod.effect.ability === abilityType) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an enemy attacks this combat.
 * Returns false if the enemy has the EFFECT_ENEMY_SKIP_ATTACK modifier.
 * Used by Chill, Whirlwind spells to prevent enemies from dealing damage.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
export function doesEnemyAttackThisCombat(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks skip-attack effects
  if (hasArcaneImmunity(state, enemyId)) {
    return true;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return !modifiers.some((m) => m.effect.type === EFFECT_ENEMY_SKIP_ATTACK);
}

/**
 * Check if an enemy's resistances have been removed by active modifiers.
 * Returns true if any EFFECT_REMOVE_RESISTANCES modifier targets this enemy.
 * Used by Expose spell to remove enemy resistances.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
export function areResistancesRemoved(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks resistance removal effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return modifiers.some((m) => m.effect.type === EFFECT_REMOVE_RESISTANCES);
}

/**
 * Check if an enemy's physical resistance has been specifically removed.
 * Returns true if any EFFECT_REMOVE_PHYSICAL_RESISTANCE modifier targets this enemy.
 * Used by Sword of Justice powered effect.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
/**
 * Check if an enemy has the defeat-if-blocked modifier active.
 * Returns true if EFFECT_DEFEAT_IF_BLOCKED modifier targets this enemy.
 * Used by Delphana Masters' red mana ability.
 *
 * Note: Arcane Immunity blocks this at application time, so no check needed here.
 */
export function hasDefeatIfBlocked(
  state: GameState,
  enemyId: string
): boolean {
  const modifiers = getModifiersForEnemy(state, enemyId);
  return modifiers.some((m) => m.effect.type === EFFECT_DEFEAT_IF_BLOCKED);
}

export function isPhysicalResistanceRemoved(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks resistance removal effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return modifiers.some((m) => m.effect.type === EFFECT_REMOVE_PHYSICAL_RESISTANCE);
}

/**
 * Check if an enemy's fire resistance has been specifically removed.
 * Returns true if any EFFECT_REMOVE_FIRE_RESISTANCE modifier targets this enemy.
 * Used by Chill spell basic effect.
 *
 * Note: Arcane Immunity blocks this effect (non-Attack/Block effect).
 */
export function isFireResistanceRemoved(
  state: GameState,
  enemyId: string
): boolean {
  // Arcane Immunity blocks resistance removal effects
  if (hasArcaneImmunity(state, enemyId)) {
    return false;
  }
  const modifiers = getModifiersForEnemy(state, enemyId);
  return modifiers.some((m) => m.effect.type === EFFECT_REMOVE_FIRE_RESISTANCE);
}

/**
 * Check if physical attacks should be doubled for a player.
 * Returns true if EFFECT_DOUBLE_PHYSICAL_ATTACKS modifier is active.
 * Used by Sword of Justice powered effect - applies during Attack Phase only.
 *
 * Note: This is a player buff, not targeting enemies, so Arcane Immunity does not block it.
 */
export function isPhysicalAttackDoubled(
  state: GameState,
  playerId: string
): boolean {
  const modifiers = getModifiersForPlayer(state, playerId);
  return modifiers.some((m) => m.effect.type === EFFECT_DOUBLE_PHYSICAL_ATTACKS);
}

/**
 * Get the base armor for an enemy, considering Elusive ability and combat phase.
 *
 * Elusive ability rules:
 * - RANGED_SIEGE phase: always uses armorElusive (higher value)
 * - ATTACK phase: uses armor (lower value) if ALL attacks were blocked,
 *   otherwise uses armorElusive (higher value)
 * - Other phases (BLOCK, ASSIGN_DAMAGE): uses armorElusive (higher value)
 *
 * Per rulebook: "If you do not block it (let it deal damage or prevent it from
 * attacking), it keeps using the higher value for the rest of the combat."
 *
 * @param enemy - Combat enemy instance
 * @param phase - Current combat phase
 * @param state - Game state (for ability nullification check)
 * @param playerId - Player ID (for ability nullification check)
 * @returns Base armor value to use (before modifiers)
 */
export function getBaseArmorForPhase(
  enemy: CombatEnemy,
  phase: CombatPhase,
  state: GameState,
  playerId: string
): number {
  const definition = enemy.definition;

  // If no elusive armor defined, or enemy doesn't have Elusive ability, use base armor
  if (
    definition.armorElusive === undefined ||
    !definition.abilities.includes(ABILITY_ELUSIVE)
  ) {
    return definition.armor;
  }

  // Check if Elusive is nullified (Elusive is defensive, doesn't affect attacks/blocks directly)
  // Note: Arcane Immunity blocks ability nullification, but Elusive itself isn't
  // blocked by Arcane Immunity (it's not a "non-Attack/Block effect targeting enemy")
  if (isAbilityNullified(state, playerId, enemy.instanceId, ENEMY_ABILITY_ELUSIVE)) {
    return definition.armor;
  }

  // RANGED_SIEGE phase: always use elusive (higher) armor
  if (phase === COMBAT_PHASE_RANGED_SIEGE) {
    return definition.armorElusive;
  }

  // ATTACK phase: use base (lower) armor only if ALL attacks were blocked
  if (phase === COMBAT_PHASE_ATTACK) {
    const fullyBlocked = isEnemyFullyBlocked(enemy);
    return fullyBlocked ? definition.armor : definition.armorElusive;
  }

  // BLOCK and ASSIGN_DAMAGE phases: use elusive (higher) armor
  // This ensures UI shows the elusive armor during these phases
  return definition.armorElusive;
}

/**
 * Get the total attack amount gained via Possess that cannot target the specified enemy.
 * Returns the sum of possess attack restriction amounts for the given enemy.
 * Returns 0 if no possess restriction exists for this enemy.
 *
 * Used by valid actions to limit attack assignment against possessed enemies.
 * The gained attack from possess can only target OTHER enemies.
 */
export function getPossessAttackRestriction(
  state: GameState,
  playerId: string,
  enemyId: string
): number {
  const modifiers = getModifiersForPlayer(state, playerId);
  let totalRestricted = 0;
  for (const mod of modifiers) {
    if (
      mod.effect.type === EFFECT_POSSESS_ATTACK_RESTRICTION &&
      mod.effect.possessedEnemyId === enemyId
    ) {
      totalRestricted += mod.effect.attackAmount;
    }
  }
  return totalRestricted;
}

/**
 * Get the hero damage reduction modifier matching the given attack element.
 * Returns the matching modifier and its ActiveModifier wrapper (for removal after use),
 * or null if no matching modifier is active.
 *
 * The modifier only applies if the attack element is in the modifier's elements list.
 * Used by Elemental Resistance (Fire/Ice = 2, Physical/ColdFire = 1)
 * and Battle Hardened (Physical = 2, Fire/Ice/ColdFire = 1).
 */
export function getHeroDamageReduction(
  state: GameState,
  playerId: string,
  attackElement: import("@mage-knight/shared").Element
): { modifier: HeroDamageReductionModifier; activeModifier: ActiveModifier } | null {
  const modifiers = getModifiersForPlayer(state, playerId);

  for (const mod of modifiers) {
    if (mod.effect.type !== EFFECT_HERO_DAMAGE_REDUCTION) continue;

    const effect = mod.effect as HeroDamageReductionModifier;
    if (effect.elements.includes(attackElement)) {
      return { modifier: effect, activeModifier: mod };
    }
  }

  return null;
}
