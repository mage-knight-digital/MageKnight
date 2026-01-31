/**
 * Summoned enemy handling for combat phase transitions.
 *
 * Handles:
 * - Resolving summon abilities at the start of Block phase
 * - Drawing enemy tokens for summoners
 * - Discarding summoned enemies at the start of Attack phase
 * - Tracking hidden summoners during Block/Assign Damage phases
 */

import type { GameEvent } from "@mage-knight/shared";
import {
  ABILITY_SUMMON,
  ABILITY_SUMMON_GREEN,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GREEN,
  getEnemy,
  createEnemySummonedEvent,
  createSummonedEnemyDiscardedEvent,
} from "@mage-knight/shared";
import type { CombatState, CombatEnemy } from "../../../types/combat.js";
import type { GameState } from "../../../state/GameState.js";
import {
  drawEnemyWithFactionPriority,
  getEnemyIdFromToken,
  discardEnemy,
} from "../../helpers/enemyHelpers.js";
import { isAbilityNullified } from "../../modifiers.js";

// ============================================================================
// Summon Ability Resolution
// ============================================================================

/**
 * Get the summon ability type for an enemy (null if no summon ability)
 */
function getSummonAbilityType(
  enemy: CombatEnemy
): typeof ABILITY_SUMMON | typeof ABILITY_SUMMON_GREEN | null {
  if (enemy.definition.abilities.includes(ABILITY_SUMMON_GREEN)) {
    return ABILITY_SUMMON_GREEN;
  }
  if (enemy.definition.abilities.includes(ABILITY_SUMMON)) {
    return ABILITY_SUMMON;
  }
  return null;
}

/**
 * Check if Summon ability is active (has ability and not nullified)
 */
function isSummonActive(
  state: GameState,
  playerId: string,
  enemy: CombatEnemy
): boolean {
  const summonType = getSummonAbilityType(enemy);
  if (!summonType) return false;
  return !isAbilityNullified(state, playerId, enemy.instanceId, summonType);
}

/**
 * Result of resolving summon abilities at the start of Block phase
 */
export interface ResolveSummonsResult {
  /** Updated game state with new enemies and modified token piles */
  state: GameState;
  /** Events for summoned enemies */
  events: readonly GameEvent[];
  /** Updated combat state with summoned enemies and hidden summoners */
  combat: CombatState;
}

/**
 * Resolve all summon abilities at the start of Block phase.
 * For each enemy with Summon ability:
 * - Draw an enemy token (brown for ABILITY_SUMMON, green for ABILITY_SUMMON_GREEN)
 * - Add the summoned enemy to combat (linked to summoner)
 * - Mark the summoner as hidden during Block/Assign Damage phases
 *
 * If the token pool is empty, summoner attacks normally (no summoned enemy).
 * Faction-priority drawing is used when the summoner has a faction.
 */
export function resolveSummons(
  state: GameState,
  combat: CombatState,
  playerId: string
): ResolveSummonsResult {
  const events: GameEvent[] = [];
  const newEnemies: CombatEnemy[] = [];
  let currentState = state;
  const updatedEnemies = [...combat.enemies];

  // Find all summoners that should summon (not defeated, has active summon ability)
  const summoners = combat.enemies.filter(
    (e) => !e.isDefeated && isSummonActive(state, playerId, e)
  );

  let summonedCounter = 0;

  for (const summoner of summoners) {
    // Determine which color pool to draw from based on summon ability type
    const summonType = getSummonAbilityType(summoner);
    const summonColor =
      summonType === ABILITY_SUMMON_GREEN ? ENEMY_COLOR_GREEN : ENEMY_COLOR_BROWN;

    // Draw an enemy token with faction priority if summoner has a faction
    const drawResult = drawEnemyWithFactionPriority(
      currentState.enemyTokens,
      summonColor,
      summoner.definition.faction,
      currentState.rng
    );

    if (drawResult.tokenId === null) {
      // Token pool is empty - summoner attacks normally
      // Don't hide the summoner, don't create a summoned enemy
      continue;
    }

    // Update state with new token piles and RNG
    currentState = {
      ...currentState,
      enemyTokens: drawResult.piles,
      rng: drawResult.rng,
    };

    // Get the enemy definition for the drawn token
    const drawnEnemyId = getEnemyIdFromToken(drawResult.tokenId);
    const drawnEnemyDef = getEnemy(drawnEnemyId);

    // Create the summoned enemy instance
    const summonedInstanceId = `summoned_${summonedCounter++}_${drawResult.tokenId}`;
    const summonedEnemy: CombatEnemy = {
      instanceId: summonedInstanceId,
      enemyId: drawnEnemyId,
      definition: drawnEnemyDef,
      isBlocked: false,
      isDefeated: false,
      damageAssigned: false,
      isRequiredForConquest: false, // Summoned enemies don't count for conquest
      summonedByInstanceId: summoner.instanceId,
    };

    newEnemies.push(summonedEnemy);

    // Mark the summoner as hidden
    const summonerIndex = updatedEnemies.findIndex(
      (e) => e.instanceId === summoner.instanceId
    );
    const existingEnemy = updatedEnemies[summonerIndex];
    if (summonerIndex !== -1 && existingEnemy) {
      const hiddenSummoner: CombatEnemy = {
        instanceId: existingEnemy.instanceId,
        enemyId: existingEnemy.enemyId,
        definition: existingEnemy.definition,
        isBlocked: existingEnemy.isBlocked,
        isDefeated: existingEnemy.isDefeated,
        damageAssigned: existingEnemy.damageAssigned,
        isRequiredForConquest: existingEnemy.isRequiredForConquest,
        isSummonerHidden: true,
      };
      updatedEnemies[summonerIndex] = hiddenSummoner;
    }

    // Emit summon event
    events.push(
      createEnemySummonedEvent(
        summoner.instanceId,
        summoner.definition.name,
        summonedInstanceId,
        drawnEnemyDef.name,
        drawnEnemyDef.attack,
        drawnEnemyDef.armor
      )
    );
  }

  // Add all summoned enemies to the combat
  const allEnemies = [...updatedEnemies, ...newEnemies];

  const updatedCombat: CombatState = {
    ...combat,
    enemies: allEnemies,
  };

  return {
    state: currentState,
    events,
    combat: updatedCombat,
  };
}

/**
 * Result of discarding summoned enemies at the start of Attack phase
 */
export interface DiscardSummonsResult {
  /** Updated game state with modified token piles */
  state: GameState;
  /** Events for discarded summoned enemies */
  events: readonly GameEvent[];
  /** Updated combat state with summoned enemies removed and summoners unhidden */
  combat: CombatState;
}

/**
 * Discard all summoned enemies at the start of Attack phase.
 * - Remove summoned enemies from combat (they grant no fame)
 * - Return their tokens to the brown discard pile
 * - Restore (unhide) the original summoners
 */
export function discardSummonedEnemies(
  state: GameState,
  combat: CombatState
): DiscardSummonsResult {
  const events: GameEvent[] = [];
  let currentState = state;

  // Find all summoned enemies (not already defeated)
  const summonedEnemies = combat.enemies.filter(
    (e) => e.summonedByInstanceId !== undefined && !e.isDefeated
  );

  // Create a map of summoners that need to be unhidden
  const summonersToUnhide = new Set<string>();

  for (const summoned of summonedEnemies) {
    if (summoned.summonedByInstanceId) {
      summonersToUnhide.add(summoned.summonedByInstanceId);

      // Get the summoner for the event
      const summoner = combat.enemies.find(
        (e) => e.instanceId === summoned.summonedByInstanceId
      );

      // Emit discard event
      events.push(
        createSummonedEnemyDiscardedEvent(
          summoned.instanceId,
          summoned.definition.name,
          summoned.summonedByInstanceId,
          summoner?.definition.name ?? "Unknown"
        )
      );

      // Discard the token back to the brown pile
      // Extract the original token ID from the instance ID format: summoned_X_<tokenId>
      const tokenIdMatch = summoned.instanceId.match(/^summoned_\d+_(.+)$/);
      if (tokenIdMatch && tokenIdMatch[1]) {
        const originalTokenId = tokenIdMatch[1] as import("../../../types/enemy.js").EnemyTokenId;
        currentState = {
          ...currentState,
          enemyTokens: discardEnemy(currentState.enemyTokens, originalTokenId),
        };
      }
    }
  }

  // Update enemies: remove summoned, unhide summoners
  const updatedEnemies = combat.enemies
    // Remove summoned enemies
    .filter((e) => e.summonedByInstanceId === undefined)
    // Unhide summoners
    .map((e): CombatEnemy => {
      if (summonersToUnhide.has(e.instanceId) && e.isSummonerHidden) {
        return {
          instanceId: e.instanceId,
          enemyId: e.enemyId,
          definition: e.definition,
          isBlocked: e.isBlocked,
          isDefeated: e.isDefeated,
          damageAssigned: e.damageAssigned,
          isRequiredForConquest: e.isRequiredForConquest,
          isSummonerHidden: false,
        };
      }
      return e;
    });

  const updatedCombat: CombatState = {
    ...combat,
    enemies: updatedEnemies,
  };

  return {
    state: currentState,
    events,
    combat: updatedCombat,
  };
}
