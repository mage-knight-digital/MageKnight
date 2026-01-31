/**
 * End combat phase command
 *
 * When combat ends with victory at a site:
 * - Triggers automatic conquest
 * - Clears enemies from hex
 *
 * Also resolves pending damage when transitioning out of RANGED_SIEGE or ATTACK phases.
 */

import type { Command, CommandResult } from "../../commands.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  COMBAT_PHASE_CHANGED,
  COMBAT_ENDED,
  hexKey,
  createPlayerWithdrewEvent,
  createEnemyDefeatedEvent,
  getLevelsCrossed,
  createMonasteryBurnedEvent,
  createShieldTokenPlacedEvent,
  artifactReward,
  ABILITY_SUMMON,
  ABILITY_SUMMON_GREEN,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GREEN,
  getEnemy,
  createEnemySummonedEvent,
  createSummonedEnemyDiscardedEvent,
  createReputationChangedEvent,
  REPUTATION_REASON_DEFEAT_ENEMY,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_BURN_MONASTERY,
  type CombatPhase,
  type CombatEnemy,
  type CombatState,
  type PendingElementalDamage,
} from "../../../types/combat.js";
import type { Player, CombatAccumulator } from "../../../types/player.js";
import {
  createEmptyAccumulatedAttack,
  createEmptyElementalValues,
} from "../../../types/player.js";
import type { HexState, Site } from "../../../types/map.js";
import { createConquerSiteCommand } from "../conquerSiteCommand.js";
import { queueSiteReward } from "../../helpers/rewards/index.js";
import { isAttackResisted, type Resistances } from "../../combat/elementalCalc.js";
import {
  drawEnemyWithFactionPriority,
  getEnemyIdFromToken,
  discardEnemy,
} from "../../helpers/enemyHelpers.js";
import { isAbilityNullified } from "../../modifiers.js";

export const END_COMBAT_PHASE_COMMAND = "END_COMBAT_PHASE" as const;

// ============================================================================
// Pending Damage Resolution
// ============================================================================

/**
 * Get enemy resistances from their definition.
 */
function getEnemyResistances(enemy: CombatEnemy): Resistances {
  return enemy.definition.resistances;
}

/**
 * Calculate effective damage after applying resistances.
 */
function calculateEffectiveDamage(
  pending: PendingElementalDamage,
  resistances: Resistances
): number {
  let total = 0;

  // Physical damage
  if (pending.physical > 0) {
    total += isAttackResisted("physical", resistances)
      ? Math.floor(pending.physical / 2)
      : pending.physical;
  }

  // Fire damage
  if (pending.fire > 0) {
    total += isAttackResisted("fire", resistances)
      ? Math.floor(pending.fire / 2)
      : pending.fire;
  }

  // Ice damage
  if (pending.ice > 0) {
    total += isAttackResisted("ice", resistances)
      ? Math.floor(pending.ice / 2)
      : pending.ice;
  }

  // Cold Fire damage
  if (pending.coldFire > 0) {
    total += isAttackResisted("cold_fire", resistances)
      ? Math.floor(pending.coldFire / 2)
      : pending.coldFire;
  }

  return total;
}

/**
 * Result of resolving pending damage for combat.
 */
interface ResolvePendingDamageResult {
  /** Updated enemies with isDefeated flags set */
  enemies: readonly CombatEnemy[];
  /** Total fame gained from defeating enemies */
  fameGained: number;
  /** Total reputation penalty from defeating enemies with reputationPenalty */
  reputationPenalty: number;
  /** Events for defeated enemies */
  events: readonly GameEvent[];
}

/**
 * Resolve all pending damage against enemies.
 * Returns updated enemy list with defeated enemies marked.
 */
function resolvePendingDamage(
  combat: CombatState,
  _playerId: string
): ResolvePendingDamageResult {
  const events: GameEvent[] = [];
  let fameGained = 0;
  let reputationPenalty = 0;

  const updatedEnemies = combat.enemies.map((enemy) => {
    // Skip already defeated enemies
    if (enemy.isDefeated) return enemy;

    // Get pending damage for this enemy
    const pending = combat.pendingDamage[enemy.instanceId];
    if (!pending) return enemy;

    // Calculate effective damage
    const resistances = getEnemyResistances(enemy);
    const effectiveDamage = calculateEffectiveDamage(pending, resistances);

    // Check if enemy is defeated
    if (effectiveDamage >= enemy.definition.armor) {
      const fame = enemy.definition.fame;
      fameGained += fame;
      events.push(createEnemyDefeatedEvent(enemy.instanceId, enemy.definition.name, fame));

      // Track reputation penalty if enemy has one (e.g., Heroes)
      if (enemy.definition.reputationPenalty) {
        reputationPenalty += enemy.definition.reputationPenalty;
      }

      return {
        ...enemy,
        isDefeated: true,
      };
    }

    return enemy;
  });

  return {
    enemies: updatedEnemies,
    fameGained,
    reputationPenalty,
    events,
  };
}

/**
 * Clear pending damage and assigned attack from combat and player state.
 */
function clearPendingAndAssigned(
  state: GameState,
  playerId: string
): GameState {
  // Clear combat pending damage
  const updatedCombat = state.combat
    ? {
        ...state.combat,
        pendingDamage: {},
      }
    : null;

  // Clear player's assigned attack
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { ...state, combat: updatedCombat };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { ...state, combat: updatedCombat };
  }

  const updatedAccumulator: CombatAccumulator = {
    ...player.combatAccumulator,
    assignedAttack: createEmptyAccumulatedAttack(),
  };

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: updatedAccumulator,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    combat: updatedCombat,
    players: updatedPlayers,
  };
}

/**
 * Clear pending block and assigned block from combat and player state.
 * Called when transitioning from BLOCK phase - any uncommitted block is lost.
 */
function clearPendingBlock(state: GameState, playerId: string): GameState {
  // Clear combat pending block
  const updatedCombat = state.combat
    ? {
        ...state.combat,
        pendingBlock: {},
      }
    : null;

  // Clear player's assigned block tracking
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { ...state, combat: updatedCombat };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { ...state, combat: updatedCombat };
  }

  const updatedAccumulator: CombatAccumulator = {
    ...player.combatAccumulator,
    assignedBlock: 0,
    assignedBlockElements: createEmptyElementalValues(),
  };

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: updatedAccumulator,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    combat: updatedCombat,
    players: updatedPlayers,
  };
}

/**
 * Apply fame gained from defeated enemies to a player.
 * Also handles level-up tracking when fame thresholds are crossed.
 */
function applyFameToPlayer(
  state: GameState,
  playerId: string,
  fameGained: number
): GameState {
  if (fameGained <= 0) {
    return state;
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return state;
  }

  const player = state.players[playerIndex];
  if (!player) {
    return state;
  }

  // Check for level ups when fame changes
  const oldFame = player.fame;
  const newFame = oldFame + fameGained;
  const levelsCrossed = getLevelsCrossed(oldFame, newFame);

  const updatedPlayer: Player = {
    ...player,
    fame: newFame,
    pendingLevelUps: [...player.pendingLevelUps, ...levelsCrossed],
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  return {
    ...state,
    players: updatedPlayers,
  };
}

/** Minimum reputation value (floor) */
const MIN_REPUTATION = -7;

/**
 * Result of applying reputation penalty to a player.
 */
interface ApplyReputationPenaltyResult {
  /** Updated game state */
  state: GameState;
  /** Events for reputation change */
  events: readonly GameEvent[];
}

/**
 * Apply reputation penalty from defeated enemies to a player.
 * The penalty is subtracted from reputation (clamped to -7 minimum).
 */
function applyReputationPenalty(
  state: GameState,
  playerId: string,
  penalty: number
): ApplyReputationPenaltyResult {
  if (penalty <= 0) {
    return { state, events: [] };
  }

  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    return { state, events: [] };
  }

  const player = state.players[playerIndex];
  if (!player) {
    return { state, events: [] };
  }

  const oldReputation = player.reputation;
  const newReputation = Math.max(MIN_REPUTATION, oldReputation - penalty);

  // Don't emit event if reputation didn't actually change
  if (newReputation === oldReputation) {
    return { state, events: [] };
  }

  const updatedPlayer: Player = {
    ...player,
    reputation: newReputation,
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[playerIndex] = updatedPlayer;

  const events: GameEvent[] = [
    createReputationChangedEvent(
      playerId,
      -penalty, // delta is negative (reputation lost)
      newReputation,
      REPUTATION_REASON_DEFEAT_ENEMY
    ),
  ];

  return {
    state: {
      ...state,
      players: updatedPlayers,
    },
    events,
  };
}

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
interface ResolveSummonsResult {
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
function resolveSummons(
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
interface DiscardSummonsResult {
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
function discardSummonedEnemies(
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

// ============================================================================
// Phase Transitions
// ============================================================================

function getNextPhase(current: CombatPhase): CombatPhase | null {
  switch (current) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return COMBAT_PHASE_BLOCK;
    case COMBAT_PHASE_BLOCK:
      return COMBAT_PHASE_ASSIGN_DAMAGE;
    case COMBAT_PHASE_ASSIGN_DAMAGE:
      return COMBAT_PHASE_ATTACK;
    case COMBAT_PHASE_ATTACK:
      return null; // Combat ends
  }
}

export interface EndCombatPhaseCommandParams {
  readonly playerId: string;
}

export function createEndCombatPhaseCommand(
  params: EndCombatPhaseCommandParams
): Command {
  return {
    type: END_COMBAT_PHASE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      if (!state.combat) {
        throw new Error("Not in combat");
      }

      const currentPhase = state.combat.phase;
      const nextPhase = getNextPhase(currentPhase);

      // Combat ends after Attack phase
      if (nextPhase === null) {
        // Resolve pending damage from ATTACK phase before ending combat
        const damageResult = resolvePendingDamage(state.combat, params.playerId);

        // Update combat state with defeated enemies and fame
        const combatAfterResolution: CombatState = {
          ...state.combat,
          enemies: damageResult.enemies,
          fameGained: state.combat.fameGained + damageResult.fameGained,
          pendingDamage: {},
        };

        // Clear assigned attack from player
        let stateAfterResolution = clearPendingAndAssigned(
          { ...state, combat: combatAfterResolution },
          params.playerId
        );

        // Apply fame gained from defeated enemies to the player
        stateAfterResolution = applyFameToPlayer(
          stateAfterResolution,
          params.playerId,
          damageResult.fameGained
        );

        // Apply reputation penalty from defeated enemies (e.g., Heroes)
        const reputationResult = applyReputationPenalty(
          stateAfterResolution,
          params.playerId,
          damageResult.reputationPenalty
        );
        stateAfterResolution = reputationResult.state;
        // Store reputation events to add after combat ended event
        const reputationEvents = reputationResult.events;

        // Use resolved combat state for victory calculation
        // Combat exists because we just created it above
        if (!stateAfterResolution.combat) {
          throw new Error("Combat state unexpectedly cleared");
        }
        const resolvedCombat = stateAfterResolution.combat;
        const enemiesDefeated = resolvedCombat.enemies.filter(
          (e) => e.isDefeated
        ).length;
        const enemiesSurvived = resolvedCombat.enemies.filter(
          (e) => !e.isDefeated
        ).length;
        // Victory (conquest) requires defeating all enemies that are required for conquest
        // Provoked rampaging enemies are NOT required - you can conquer even if they survive
        const requiredEnemiesSurvived = resolvedCombat.enemies.filter(
          (e) => !e.isDefeated && e.isRequiredForConquest
        ).length;
        const victory = requiredEnemiesSurvived === 0;

        // Include enemy defeated events from damage resolution
        const events: GameEvent[] = [
          ...damageResult.events,
          {
            type: COMBAT_ENDED,
            victory,
            totalFameGained: resolvedCombat.fameGained,
            enemiesDefeated,
            enemiesSurvived,
          },
        ];

        let newState: GameState = { ...stateAfterResolution, combat: null };

        // Find the player to get their position
        const player = state.players.find((p) => p.id === params.playerId);

        // Use combatHexCoord if set (for remote combat like rampaging challenge),
        // otherwise fall back to player's position
        const combatHexPosition = resolvedCombat.combatHexCoord ?? player?.position;

        if (combatHexPosition) {
          const key = hexKey(combatHexPosition);
          const hex = state.map.hexes[key];

          // Clear enemies from hex on victory, or for dungeon/tomb (enemies always discarded)
          const shouldClearEnemies = victory || resolvedCombat.discardEnemiesOnFailure;
          if (shouldClearEnemies && hex) {
            const updatedHex: HexState = {
              ...hex,
              enemies: [],
              // Also clear rampagingEnemies if this was a rampaging hex
              rampagingEnemies: hex.rampagingEnemies.length > 0 ? [] : hex.rampagingEnemies,
            };
            const updatedHexes = {
              ...newState.map.hexes,
              [key]: updatedHex,
            };
            newState = {
              ...newState,
              map: { ...newState.map, hexes: updatedHexes },
            };

            // Handle burn monastery victory
            if (victory && resolvedCombat.combatContext === COMBAT_CONTEXT_BURN_MONASTERY && hex.site) {
              // Mark monastery as burned and conquered
              const updatedSite: Site = {
                ...hex.site,
                isBurned: true,
                isConquered: true,
                owner: params.playerId,
              };

              // Add shield token
              const updatedShieldTokens = [...hex.shieldTokens, params.playerId];

              const burnedHex: HexState = {
                ...newState.map.hexes[key] ?? hex,
                site: updatedSite,
                shieldTokens: updatedShieldTokens,
                enemies: [],
              };

              const burnedHexes = {
                ...newState.map.hexes,
                [key]: burnedHex,
              };

              newState = {
                ...newState,
                map: { ...newState.map, hexes: burnedHexes },
              };

              // Emit events
              events.push(createShieldTokenPlacedEvent(params.playerId, combatHexPosition, 1));
              events.push(createMonasteryBurnedEvent(params.playerId, combatHexPosition));

              // Queue artifact reward
              const { state: rewardState, events: rewardEvents } = queueSiteReward(
                newState,
                params.playerId,
                artifactReward(1)
              );
              newState = rewardState;
              events.push(...rewardEvents);
            }
            // Trigger conquest if at an unconquered site (only on victory)
            // Note: conquest only happens at player's position, not at remote combat locations
            // Skip for burn monastery (already handled above)
            else if (victory && hex.site && !hex.site.isConquered && player?.position) {
              const playerHexKey = hexKey(player.position);
              // Only trigger conquest if combat was at player's position (not remote rampaging challenge)
              if (key === playerHexKey) {
                const conquestCommand = createConquerSiteCommand({
                  playerId: params.playerId,
                  hexCoord: player.position,
                  enemiesDefeated,
                });
                const conquestResult = conquestCommand.execute(newState);
                newState = conquestResult.state;
                events.push(...conquestResult.events);
              }
            }
          }

          // Failed assault at fortified site — must withdraw
          // TODO: Per rulebook, if assaultOrigin is not a "safe space", Forced Withdrawal
          // rules apply (backtrack until safe, adding a Wound per space). This is an edge
          // case if player used special movement to reach an unsafe space before assaulting.
          if (
            !victory &&
            resolvedCombat.isAtFortifiedSite &&
            resolvedCombat.assaultOrigin
          ) {
            const playerIndex = newState.players.findIndex(
              (p) => p.id === params.playerId
            );
            const currentPlayer = newState.players[playerIndex];

            if (playerIndex !== -1 && currentPlayer?.position) {
              const updatedPlayer: Player = {
                ...currentPlayer,
                position: resolvedCombat.assaultOrigin,
                hasCombattedThisTurn: true,
                hasTakenActionThisTurn: true,
              };
              const updatedPlayers: Player[] = [...newState.players];
              updatedPlayers[playerIndex] = updatedPlayer;
              newState = { ...newState, players: updatedPlayers };

              events.push(
                createPlayerWithdrewEvent(
                  params.playerId,
                  currentPlayer.position,
                  resolvedCombat.assaultOrigin
                )
              );
            }
          } else {
            // Mark player as having combatted this turn (when not withdrawing)
            const playerIndex = newState.players.findIndex(
              (p) => p.id === params.playerId
            );
            const currentPlayer = newState.players[playerIndex];
            if (playerIndex !== -1 && currentPlayer) {
              const updatedPlayer: Player = {
                ...currentPlayer,
                hasCombattedThisTurn: true,
                hasTakenActionThisTurn: true,
              };
              const updatedPlayers: Player[] = [...newState.players];
              updatedPlayers[playerIndex] = updatedPlayer;
              newState = { ...newState, players: updatedPlayers };
            }
          }
        }

        return {
          state: newState,
          events: [...events, ...reputationEvents],
        };
      }

      // Advance to next phase
      let updatedCombat: CombatState = {
        ...state.combat,
        phase: nextPhase,
        attacksThisPhase: 0,
      };
      let updatedState = state;
      const phaseEvents: GameEvent[] = [];

      // When transitioning from RANGED_SIEGE to BLOCK, resolve pending damage and summons
      if (
        currentPhase === COMBAT_PHASE_RANGED_SIEGE &&
        nextPhase === COMBAT_PHASE_BLOCK
      ) {
        const damageResult = resolvePendingDamage(state.combat, params.playerId);
        phaseEvents.push(...damageResult.events);

        updatedCombat = {
          ...updatedCombat,
          enemies: damageResult.enemies,
          fameGained: state.combat.fameGained + damageResult.fameGained,
          pendingDamage: {},
        };

        // Clear assigned attack from player
        updatedState = clearPendingAndAssigned(
          { ...state, combat: updatedCombat },
          params.playerId
        );
        // Combat exists because we just passed it in
        if (!updatedState.combat) {
          throw new Error("Combat state unexpectedly cleared");
        }
        updatedCombat = updatedState.combat;

        // Apply fame gained from defeated enemies to the player
        updatedState = applyFameToPlayer(
          updatedState,
          params.playerId,
          damageResult.fameGained
        );

        // Apply reputation penalty from defeated enemies (e.g., Heroes)
        const reputationResult = applyReputationPenalty(
          updatedState,
          params.playerId,
          damageResult.reputationPenalty
        );
        updatedState = reputationResult.state;
        phaseEvents.push(...reputationResult.events);

        // Resolve summon abilities - draw brown enemies for summoners
        const summonResult = resolveSummons(
          updatedState,
          updatedCombat,
          params.playerId
        );
        updatedState = summonResult.state;
        updatedCombat = summonResult.combat;
        phaseEvents.push(...summonResult.events);
      }

      // When transitioning from BLOCK to ASSIGN_DAMAGE:
      // - Clear any uncommitted pending block (it's lost if not used)
      // - Calculate if all damage was blocked (for conditional effects like Burning Shield)
      if (
        currentPhase === COMBAT_PHASE_BLOCK &&
        nextPhase === COMBAT_PHASE_ASSIGN_DAMAGE
      ) {
        // Clear uncommitted pending block
        updatedState = clearPendingBlock(
          { ...updatedState, combat: updatedCombat },
          params.playerId
        );
        if (!updatedState.combat) {
          throw new Error("Combat state unexpectedly cleared");
        }
        updatedCombat = updatedState.combat;

        // All damage is blocked if every undefeated enemy is blocked
        const undefeatedEnemies = updatedCombat.enemies.filter(
          (e) => !e.isDefeated
        );
        const allBlocked =
          undefeatedEnemies.length === 0 ||
          undefeatedEnemies.every((e) => e.isBlocked);

        updatedCombat = {
          ...updatedCombat,
          allDamageBlockedThisPhase: allBlocked,
        };
      }

      // When transitioning from ASSIGN_DAMAGE to ATTACK:
      // - Discard all summoned enemies (they grant no fame)
      // - Restore original summoners (unhide them)
      if (
        currentPhase === COMBAT_PHASE_ASSIGN_DAMAGE &&
        nextPhase === COMBAT_PHASE_ATTACK
      ) {
        const discardResult = discardSummonedEnemies(updatedState, updatedCombat);
        updatedState = discardResult.state;
        updatedCombat = discardResult.combat;
        phaseEvents.push(...discardResult.events);
      }

      return {
        state: { ...updatedState, combat: updatedCombat },
        events: [
          ...phaseEvents,
          {
            type: COMBAT_PHASE_CHANGED,
            previousPhase: currentPhase,
            newPhase: nextPhase,
          },
        ],
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_COMBAT_PHASE");
    },
  };
}
