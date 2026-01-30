/**
 * Combat state types for Mage Knight
 *
 * Phase 1: Single enemy, no abilities, hero only, physical damage
 */

import type { EnemyId, EnemyDefinition, HexCoord, FactionLeaderDefinition, FactionLeaderLevelStats, Element } from "@mage-knight/shared";
import { getEnemy, isFactionLeaderDefinition, getFactionLeaderLevelStats } from "@mage-knight/shared";
import type { CombatType } from "@mage-knight/shared";
import type { CombatPhase } from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
} from "@mage-knight/shared";

// Re-export shared combat phases so engine code can continue importing from core.
export {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
};
export type { CombatPhase };

// Combat attack type (method) - reuses shared CombatType
export type CombatAttackType = CombatType;

// Combat context - identifies special combat scenarios
export const COMBAT_CONTEXT_STANDARD = "standard" as const;
export const COMBAT_CONTEXT_BURN_MONASTERY = "burn_monastery" as const;

export type CombatContext =
  | typeof COMBAT_CONTEXT_STANDARD
  | typeof COMBAT_CONTEXT_BURN_MONASTERY;

// Elemental damage values for pending damage assignment
export interface PendingElementalDamage {
  readonly physical: number;
  readonly fire: number;
  readonly ice: number;
  readonly coldFire: number;
}

// Pending damage assigned to enemies (before resolution)
export type PendingDamageMap = {
  readonly [enemyInstanceId: string]: PendingElementalDamage;
};

// Pending block assigned to enemies (before resolution)
// Reuses PendingElementalDamage since block also has elemental types
export type PendingBlockMap = {
  readonly [enemyInstanceId: string]: PendingElementalDamage;
};

// Helper to create empty pending elemental damage
export function createEmptyPendingDamage(): PendingElementalDamage {
  return {
    physical: 0,
    fire: 0,
    ice: 0,
    coldFire: 0,
  };
}

// Enemy instance in combat (tracks state during fight)
export interface CombatEnemy {
  readonly instanceId: string; // Unique ID for this combat instance
  readonly enemyId: EnemyId;
  readonly definition: EnemyDefinition | FactionLeaderDefinition;
  readonly isBlocked: boolean;
  readonly isDefeated: boolean;
  readonly damageAssigned: boolean; // Track if damage was processed in Assign Damage phase
  readonly isRequiredForConquest: boolean; // True for site defenders, false for provoked rampaging enemies
  readonly summonedByInstanceId?: string; // For summoned enemies: links to the summoner's instanceId
  readonly isSummonerHidden?: boolean; // For summoners: true during Block/Assign Damage phases when hidden by summoned enemy
  readonly currentLevel?: number; // For faction leaders: current level (1-4), determines stats
}

// =============================================================================
// FACTION LEADER HELPERS
// =============================================================================

/**
 * Check if a combat enemy is a faction leader.
 */
export function isCombatFactionLeader(enemy: CombatEnemy): boolean {
  return isFactionLeaderDefinition(enemy.definition);
}

/**
 * Get the current stats for a faction leader in combat.
 * Returns null if the enemy is not a faction leader.
 *
 * @param enemy - The combat enemy to get stats for
 * @returns The level-based stats, or null if not a faction leader
 */
export function getCombatFactionLeaderStats(
  enemy: CombatEnemy
): FactionLeaderLevelStats | null {
  if (!isFactionLeaderDefinition(enemy.definition)) {
    return null;
  }
  const level = enemy.currentLevel ?? 1;
  return getFactionLeaderLevelStats(enemy.definition, level);
}

/**
 * Get the effective armor for a combat enemy.
 * For faction leaders, uses level-based armor.
 * For regular enemies, uses the base armor from definition.
 *
 * @param enemy - The combat enemy
 * @returns The base armor value (before modifiers)
 */
export function getCombatEnemyBaseArmor(enemy: CombatEnemy): number {
  const stats = getCombatFactionLeaderStats(enemy);
  if (stats) {
    return stats.armor;
  }
  return enemy.definition.armor;
}

/**
 * Get the effective attack value for a combat enemy.
 * For faction leaders, uses level-based attack (first attack if multiple).
 * For regular enemies, uses the base attack from definition.
 *
 * @param enemy - The combat enemy
 * @returns The base attack value (before modifiers)
 */
export function getCombatEnemyBaseAttack(enemy: CombatEnemy): number {
  const stats = getCombatFactionLeaderStats(enemy);
  if (stats && stats.attacks.length > 0) {
    // For now, use the first attack value
    // TODO: Support multiple attacks per turn when combat phase is refactored
    const firstAttack = stats.attacks[0];
    if (firstAttack) {
      return firstAttack.value;
    }
  }
  return enemy.definition.attack;
}

/**
 * Get the effective attack element for a combat enemy.
 * For faction leaders, uses level-based attack element (first attack if multiple).
 * For regular enemies, uses the base attack element from definition.
 *
 * @param enemy - The combat enemy
 * @returns The attack element
 */
export function getCombatEnemyAttackElement(enemy: CombatEnemy): Element {
  const stats = getCombatFactionLeaderStats(enemy);
  if (stats && stats.attacks.length > 0) {
    // For now, use the first attack's element
    // TODO: Support multiple attacks per turn when combat phase is refactored
    const firstAttack = stats.attacks[0];
    if (firstAttack) {
      return firstAttack.element;
    }
  }
  return enemy.definition.attackElement;
}

// Combat state
export interface CombatState {
  readonly phase: CombatPhase;
  readonly enemies: readonly CombatEnemy[];
  readonly woundsThisCombat: number; // Track for knockout
  readonly attacksThisPhase: number; // Track attacks made
  readonly fameGained: number; // Accumulated fame from defeated enemies
  readonly isAtFortifiedSite: boolean; // Site fortification (Keeps, Mage Towers, Cities)
  readonly unitsAllowed: boolean; // false for dungeon/tomb combat
  readonly nightManaRules: boolean; // true for dungeon/tomb (no gold, yes black)
  readonly assaultOrigin: HexCoord | null; // Where player was before assault (null if not assault)
  readonly combatHexCoord: HexCoord | null; // Hex where combat is occurring (for remote combat like rampaging challenge)
  readonly allDamageBlockedThisPhase: boolean; // True if all enemy damage was blocked in block phase
  readonly discardEnemiesOnFailure: boolean; // true for dungeon/tomb (enemies discarded even on failed combat)
  readonly pendingDamage: PendingDamageMap; // Damage assigned to enemies before resolution
  readonly pendingBlock: PendingBlockMap; // Block assigned to enemies before resolution
  readonly combatContext: CombatContext; // Identifies special combat scenarios (standard, burn_monastery)
}

// Options for special combat rules
export interface CombatStateOptions {
  readonly unitsAllowed?: boolean;
  readonly nightManaRules?: boolean;
  readonly assaultOrigin?: HexCoord | null;
  readonly combatHexCoord?: HexCoord | null;
  readonly discardEnemiesOnFailure?: boolean;
  readonly combatContext?: CombatContext;
}

// Input for creating a combat enemy - allows specifying if required for conquest
export interface CombatEnemyInput {
  readonly enemyId: EnemyId;
  readonly isRequiredForConquest?: boolean; // Default true (site defenders)
  readonly level?: number; // For faction leaders: initial level (1-4)
}

// Create initial combat state
export function createCombatState(
  enemyInputs: readonly (EnemyId | CombatEnemyInput)[],
  isAtFortifiedSite: boolean = false,
  options?: CombatStateOptions
): CombatState {
  const enemies: CombatEnemy[] = enemyInputs
    .filter((input): input is EnemyId | CombatEnemyInput => input !== undefined && input !== null)
    .map((input, index) => {
      // Support both simple EnemyId and full CombatEnemyInput
      const enemyId = typeof input === "string" ? input : input.enemyId;
      const isRequiredForConquest =
        typeof input === "string" ? true : (input.isRequiredForConquest ?? true);
      const level = typeof input === "string" ? undefined : input.level;

      const definition = getEnemy(enemyId);
      const combatEnemy: CombatEnemy = {
        instanceId: `enemy_${index}`,
        enemyId,
        definition,
        isBlocked: false,
        isDefeated: false,
        damageAssigned: false,
        isRequiredForConquest,
      };

      // Set level for faction leaders
      if (isFactionLeaderDefinition(definition)) {
        return {
          ...combatEnemy,
          currentLevel: level ?? 1, // Default to level 1 if not specified
        };
      }

      return combatEnemy;
    });

  return {
    phase: COMBAT_PHASE_RANGED_SIEGE,
    enemies,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite,
    unitsAllowed: options?.unitsAllowed ?? true,
    nightManaRules: options?.nightManaRules ?? false,
    assaultOrigin: options?.assaultOrigin ?? null,
    combatHexCoord: options?.combatHexCoord ?? null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: options?.discardEnemiesOnFailure ?? false,
    pendingDamage: {},
    pendingBlock: {},
    combatContext: options?.combatContext ?? COMBAT_CONTEXT_STANDARD,
  };
}
