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

// Enemy instance in combat (tracks state during fight)
export interface CombatEnemy {
  readonly instanceId: string; // Unique ID for this combat instance
  readonly enemyId: EnemyId;
  readonly definition: EnemyDefinition;
  readonly isBlocked: boolean;
  readonly isDefeated: boolean;
  readonly damageAssigned: boolean; // Track if damage was processed in Assign Damage phase
  readonly isRequiredForConquest: boolean; // True for site defenders, false for provoked rampaging enemies
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
  readonly allDamageBlockedThisPhase: boolean; // True if all enemy damage was blocked in block phase
  readonly discardEnemiesOnFailure: boolean; // true for dungeon/tomb (enemies discarded even on failed combat)
}

// Options for special combat rules
export interface CombatStateOptions {
  readonly unitsAllowed?: boolean;
  readonly nightManaRules?: boolean;
  readonly assaultOrigin?: HexCoord | null;
  readonly discardEnemiesOnFailure?: boolean;
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
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: options?.discardEnemiesOnFailure ?? false,
  };
}
