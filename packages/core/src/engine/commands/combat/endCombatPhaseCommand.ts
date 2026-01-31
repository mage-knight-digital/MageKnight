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
  createMonasteryBurnedEvent,
  createShieldTokenPlacedEvent,
  artifactReward,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  COMBAT_CONTEXT_BURN_MONASTERY,
  type CombatPhase,
  type CombatState,
} from "../../../types/combat.js";
import type { Player } from "../../../types/player.js";
import type { HexState, Site } from "../../../types/map.js";
import { createConquerSiteCommand } from "../conquerSiteCommand.js";
import { queueSiteReward } from "../../helpers/rewards/index.js";

// Import damage resolution utilities
import {
  resolvePendingDamage,
  clearPendingAndAssigned,
  clearPendingBlock,
  applyFameToPlayer,
  applyReputationChange,
} from "./damageResolution.js";

// Import summoned enemy handling utilities
import {
  resolveSummons,
  discardSummonedEnemies,
} from "./summonedEnemyHandling.js";

export const END_COMBAT_PHASE_COMMAND = "END_COMBAT_PHASE" as const;

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
        return handleCombatEnd(state, params.playerId);
      }

      // Advance to next phase
      return handlePhaseTransition(state, params.playerId, currentPhase, nextPhase);
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo END_COMBAT_PHASE");
    },
  };
}

// ============================================================================
// Combat End Handling
// ============================================================================

/**
 * Handle combat ending after the Attack phase.
 * Resolves pending damage, calculates victory, and triggers conquest if appropriate.
 */
function handleCombatEnd(state: GameState, playerId: string): CommandResult {
  if (!state.combat) {
    throw new Error("Not in combat");
  }

  // Resolve pending damage from ATTACK phase before ending combat
  const damageResult = resolvePendingDamage(state.combat, playerId);

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
    playerId
  );

  // Apply fame gained from defeated enemies to the player
  stateAfterResolution = applyFameToPlayer(
    stateAfterResolution,
    playerId,
    damageResult.fameGained
  );

  // Apply reputation change from defeated enemies (e.g., Heroes penalty, Thugs bonus)
  const reputationResult = applyReputationChange(
    stateAfterResolution,
    playerId,
    damageResult.reputationBonus,
    damageResult.reputationPenalty
  );
  stateAfterResolution = reputationResult.state;
  // Store reputation events to add after combat ended event
  const reputationEvents = reputationResult.events;

  // Use resolved combat state for victory calculation
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
  const player = state.players.find((p) => p.id === playerId);

  // Use combatHexCoord if set (for remote combat like rampaging challenge),
  // otherwise fall back to player's position
  const combatHexPosition = resolvedCombat.combatHexCoord ?? player?.position;

  if (combatHexPosition) {
    const result = handlePostCombatHexUpdates(
      newState,
      playerId,
      combatHexPosition,
      resolvedCombat,
      victory,
      enemiesDefeated,
      events,
      player
    );
    newState = result.state;
    events.push(...result.additionalEvents);
  }

  return {
    state: newState,
    events: [...events, ...reputationEvents],
  };
}

/**
 * Handle hex updates after combat ends (enemy clearing, conquest, withdrawal).
 */
function handlePostCombatHexUpdates(
  state: GameState,
  playerId: string,
  combatHexPosition: { q: number; r: number },
  resolvedCombat: CombatState,
  victory: boolean,
  enemiesDefeated: number,
  existingEvents: readonly GameEvent[],
  player: Player | undefined
): { state: GameState; additionalEvents: GameEvent[] } {
  const additionalEvents: GameEvent[] = [];
  let newState = state;
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
      const burnResult = handleBurnMonastery(newState, playerId, combatHexPosition, hex, key);
      newState = burnResult.state;
      additionalEvents.push(...burnResult.events);
    }
    // Trigger conquest if at an unconquered site (only on victory)
    // Note: conquest only happens at player's position, not at remote combat locations
    // Skip for burn monastery (already handled above)
    else if (victory && hex.site && !hex.site.isConquered && player?.position) {
      const playerHexKey = hexKey(player.position);
      // Only trigger conquest if combat was at player's position (not remote rampaging challenge)
      if (key === playerHexKey) {
        const conquestCommand = createConquerSiteCommand({
          playerId,
          hexCoord: player.position,
          enemiesDefeated,
        });
        const conquestResult = conquestCommand.execute(newState);
        newState = conquestResult.state;
        additionalEvents.push(...conquestResult.events);
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
    const withdrawResult = handleWithdrawal(newState, playerId, resolvedCombat.assaultOrigin);
    newState = withdrawResult.state;
    additionalEvents.push(...withdrawResult.events);
  } else {
    // Mark player as having combatted this turn (when not withdrawing)
    newState = markPlayerCombatted(newState, playerId);
  }

  return { state: newState, additionalEvents };
}

/**
 * Handle burning a monastery after victory.
 */
function handleBurnMonastery(
  state: GameState,
  playerId: string,
  combatHexPosition: { q: number; r: number },
  hex: HexState,
  key: string
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  if (!hex.site) {
    return { state, events };
  }

  // Mark monastery as burned and conquered
  const updatedSite: Site = {
    ...hex.site,
    isBurned: true,
    isConquered: true,
    owner: playerId,
  };

  // Add shield token
  const updatedShieldTokens = [...hex.shieldTokens, playerId];

  const burnedHex: HexState = {
    ...state.map.hexes[key] ?? hex,
    site: updatedSite,
    shieldTokens: updatedShieldTokens,
    enemies: [],
  };

  const burnedHexes = {
    ...state.map.hexes,
    [key]: burnedHex,
  };

  let newState: GameState = {
    ...state,
    map: { ...state.map, hexes: burnedHexes },
  };

  // Emit events
  events.push(createShieldTokenPlacedEvent(playerId, combatHexPosition, 1));
  events.push(createMonasteryBurnedEvent(playerId, combatHexPosition));

  // Queue artifact reward
  const { state: rewardState, events: rewardEvents } = queueSiteReward(
    newState,
    playerId,
    artifactReward(1)
  );
  newState = rewardState;
  events.push(...rewardEvents);

  return { state: newState, events };
}

/**
 * Handle player withdrawal after failed assault.
 */
function handleWithdrawal(
  state: GameState,
  playerId: string,
  assaultOrigin: { q: number; r: number }
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const currentPlayer = state.players[playerIndex];

  if (playerIndex !== -1 && currentPlayer?.position) {
    const updatedPlayer: Player = {
      ...currentPlayer,
      position: assaultOrigin,
      hasCombattedThisTurn: true,
      hasTakenActionThisTurn: true,
    };
    const updatedPlayers: Player[] = [...state.players];
    updatedPlayers[playerIndex] = updatedPlayer;
    const newState = { ...state, players: updatedPlayers };

    events.push(
      createPlayerWithdrewEvent(
        playerId,
        currentPlayer.position,
        assaultOrigin
      )
    );

    return { state: newState, events };
  }

  return { state, events };
}

/**
 * Mark a player as having combatted this turn.
 */
function markPlayerCombatted(state: GameState, playerId: string): GameState {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  const currentPlayer = state.players[playerIndex];
  if (playerIndex !== -1 && currentPlayer) {
    const updatedPlayer: Player = {
      ...currentPlayer,
      hasCombattedThisTurn: true,
      hasTakenActionThisTurn: true,
    };
    const updatedPlayers: Player[] = [...state.players];
    updatedPlayers[playerIndex] = updatedPlayer;
    return { ...state, players: updatedPlayers };
  }
  return state;
}

// ============================================================================
// Phase Transition Handling
// ============================================================================

/**
 * Handle transitioning from one combat phase to the next.
 */
function handlePhaseTransition(
  state: GameState,
  playerId: string,
  currentPhase: CombatPhase,
  nextPhase: CombatPhase
): CommandResult {
  if (!state.combat) {
    throw new Error("Not in combat");
  }

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
    const result = handleRangedSiegeToBlock(updatedState, updatedCombat, playerId);
    updatedState = result.state;
    updatedCombat = result.combat;
    phaseEvents.push(...result.events);
  }

  // When transitioning from BLOCK to ASSIGN_DAMAGE:
  // - Clear any uncommitted pending block (it's lost if not used)
  // - Calculate if all damage was blocked (for conditional effects like Burning Shield)
  if (
    currentPhase === COMBAT_PHASE_BLOCK &&
    nextPhase === COMBAT_PHASE_ASSIGN_DAMAGE
  ) {
    const result = handleBlockToAssignDamage(updatedState, updatedCombat, playerId);
    updatedState = result.state;
    updatedCombat = result.combat;
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
}

/**
 * Handle transition from RANGED_SIEGE to BLOCK phase.
 * Resolves pending damage, applies fame/reputation, and triggers summons.
 */
function handleRangedSiegeToBlock(
  state: GameState,
  combat: CombatState,
  playerId: string
): { state: GameState; combat: CombatState; events: GameEvent[] } {
  if (!state.combat) {
    throw new Error("Not in combat");
  }

  const events: GameEvent[] = [];
  const damageResult = resolvePendingDamage(state.combat, playerId);
  events.push(...damageResult.events);

  let updatedCombat: CombatState = {
    ...combat,
    enemies: damageResult.enemies,
    fameGained: state.combat.fameGained + damageResult.fameGained,
    pendingDamage: {},
  };

  // Clear assigned attack from player
  let updatedState = clearPendingAndAssigned(
    { ...state, combat: updatedCombat },
    playerId
  );
  if (!updatedState.combat) {
    throw new Error("Combat state unexpectedly cleared");
  }
  updatedCombat = updatedState.combat;

  // Apply fame gained from defeated enemies to the player
  updatedState = applyFameToPlayer(
    updatedState,
    playerId,
    damageResult.fameGained
  );

  // Apply reputation change from defeated enemies (e.g., Heroes penalty, Thugs bonus)
  const reputationResult = applyReputationChange(
    updatedState,
    playerId,
    damageResult.reputationBonus,
    damageResult.reputationPenalty
  );
  updatedState = reputationResult.state;
  events.push(...reputationResult.events);

  // Resolve summon abilities - draw brown enemies for summoners
  const summonResult = resolveSummons(
    updatedState,
    updatedCombat,
    playerId
  );
  updatedState = summonResult.state;
  updatedCombat = summonResult.combat;
  events.push(...summonResult.events);

  return { state: updatedState, combat: updatedCombat, events };
}

/**
 * Handle transition from BLOCK to ASSIGN_DAMAGE phase.
 * Clears uncommitted block and calculates if all damage was blocked.
 */
function handleBlockToAssignDamage(
  state: GameState,
  combat: CombatState,
  playerId: string
): { state: GameState; combat: CombatState } {
  // Clear uncommitted pending block
  const updatedState = clearPendingBlock(
    { ...state, combat },
    playerId
  );
  if (!updatedState.combat) {
    throw new Error("Combat state unexpectedly cleared");
  }
  let updatedCombat = updatedState.combat;

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

  return { state: updatedState, combat: updatedCombat };
}
