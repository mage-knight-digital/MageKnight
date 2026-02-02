/**
 * Combat state types for Mage Knight
 *
 * Phase 1: Single enemy, no abilities, hero only, physical damage
 */

import type { EnemyId, EnemyDefinition, HexCoord } from "@mage-knight/shared";
import { getEnemy } from "@mage-knight/shared";
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
export const COMBAT_CONTEXT_COOPERATIVE_ASSAULT = "cooperative_assault" as const;

export type CombatContext =
  | typeof COMBAT_CONTEXT_STANDARD
  | typeof COMBAT_CONTEXT_BURN_MONASTERY
  | typeof COMBAT_CONTEXT_COOPERATIVE_ASSAULT;

/**
 * Map of player IDs to the enemy instance IDs assigned to them.
 * Used in cooperative city assaults where enemies are distributed among players.
 * Each player can only see/target their assigned enemies.
 */
export type EnemyAssignments = {
  readonly [playerId: string]: readonly string[];
};

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
  readonly definition: EnemyDefinition;
  /**
   * Legacy blocked flag - true when ALL attacks are blocked.
   * For single-attack enemies, equivalent to attacksBlocked[0].
   * For multi-attack enemies, only true when ALL attacks are blocked.
   */
  readonly isBlocked: boolean;
  readonly isDefeated: boolean;
  /**
   * Legacy damage assigned flag - true when ALL attacks have damage assigned.
   * For single-attack enemies, equivalent to attacksDamageAssigned[0].
   * For multi-attack enemies, only true when ALL unblocked attacks have damage assigned.
   */
  readonly damageAssigned: boolean;
  readonly isRequiredForConquest: boolean; // True for site defenders, false for provoked rampaging enemies
  readonly summonedByInstanceId?: string; // For summoned enemies: links to the summoner's instanceId
  readonly isSummonerHidden?: boolean; // For summoners: true during Block/Assign Damage phases when hidden by summoned enemy
  /**
   * Per-attack blocked state for multi-attack enemies.
   * Array length matches the number of attacks the enemy has.
   * attacksBlocked[i] = true means attack i has been successfully blocked.
   * Only present for enemies with multiple attacks.
   */
  readonly attacksBlocked?: readonly boolean[];
  /**
   * Per-attack damage assigned state for multi-attack enemies.
   * Array length matches the number of attacks the enemy has.
   * attacksDamageAssigned[i] = true means attack i has had its damage assigned.
   * Only present for enemies with multiple attacks.
   */
  readonly attacksDamageAssigned?: readonly boolean[];
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
  /**
   * For cooperative city assaults: maps player IDs to their assigned enemy instance IDs.
   * When present, each player can only see/target enemies assigned to them.
   * Undefined for standard single-player combat.
   */
  readonly enemyAssignments?: EnemyAssignments;
  /**
   * Move points spent on Cumbersome enemies to reduce their attack values.
   * Maps enemy instance ID to the number of move points spent.
   * Each move point reduces attack by 1 for the rest of the turn.
   * Reduction applies BEFORE Swift doubling and persists through Assign Damage phase.
   */
  readonly cumbersomeReductions: CumbersomeReductionMap;
  /**
   * Tracks which Defend enemies have used their ability this combat.
   * Maps defender enemy instance ID → target enemy instance ID being defended.
   * Each Defend enemy can only use ability once per combat.
   */
  readonly usedDefend: DefendUsageMap;
  /**
   * Defend bonuses applied to enemies being attacked.
   * Maps target enemy instance ID → total Defend bonus armor.
   * Persists even after defender dies.
   */
  readonly defendBonuses: DefendBonusMap;
}

/**
 * Map of enemy instance IDs to move points spent on them via Cumbersome ability.
 * Each move point reduces the enemy's attack by 1.
 */
export type CumbersomeReductionMap = {
  readonly [enemyInstanceId: string]: number;
}

/**
 * Map of defender enemy instance IDs to target enemy instance IDs.
 * Tracks which Defend enemies have used their ability and on which target.
 * Each Defend enemy can only use ability once per combat.
 * Key: defender's instance ID, Value: target's instance ID being defended.
 */
export type DefendUsageMap = {
  readonly [defenderInstanceId: string]: string;
};

/**
 * Map of target enemy instance IDs to their total Defend bonus armor.
 * Persists even after the defending enemy is defeated.
 * Key: target's instance ID, Value: Defend bonus armor value.
 */
export type DefendBonusMap = {
  readonly [targetInstanceId: string]: number;
};

// Options for special combat rules
export interface CombatStateOptions {
  readonly unitsAllowed?: boolean;
  readonly nightManaRules?: boolean;
  readonly assaultOrigin?: HexCoord | null;
  readonly combatHexCoord?: HexCoord | null;
  readonly discardEnemiesOnFailure?: boolean;
  readonly combatContext?: CombatContext;
  /** For cooperative assaults: maps player IDs to enemy instance IDs */
  readonly enemyAssignments?: EnemyAssignments;
}

// Input for creating a combat enemy - allows specifying if required for conquest
export interface CombatEnemyInput {
  readonly enemyId: EnemyId;
  readonly isRequiredForConquest?: boolean; // Default true (site defenders)
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

      return {
        instanceId: `enemy_${index}`,
        enemyId,
        definition: getEnemy(enemyId),
        isBlocked: false,
        isDefeated: false,
        damageAssigned: false,
        isRequiredForConquest,
      };
    });

  const baseState = {
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
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
  };

  // Only include enemyAssignments if provided (avoids exactOptionalPropertyTypes issues)
  if (options?.enemyAssignments) {
    return {
      ...baseState,
      enemyAssignments: options.enemyAssignments,
    };
  }

  return baseState;
}
