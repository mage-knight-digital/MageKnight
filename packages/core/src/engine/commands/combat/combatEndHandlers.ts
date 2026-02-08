/**
 * Combat end handling module
 *
 * Handles victory/defeat resolution, conquest, withdrawal, and monastery burning
 * when combat ends after the Attack phase.
 */

import type { CommandResult } from "../types.js";
import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  COMBAT_ENDED,
  hexKey,
  createPlayerWithdrewEvent,
  createMonasteryBurnedEvent,
  createShieldTokenPlacedEvent,
  artifactReward,
  spellReward,
  advancedActionReward,
  unitReward,
  isEnemyDefeatedEvent,
  getRuinsTokenDefinition,
  isEnemyToken,
  RUINS_REWARD_ARTIFACT,
  RUINS_REWARD_SPELL,
  RUINS_REWARD_ADVANCED_ACTION,
  RUINS_REWARD_UNIT,
  RUINS_REWARD_CRYSTALS_4,
} from "@mage-knight/shared";
import {
  COMBAT_CONTEXT_BURN_MONASTERY,
  type CombatState,
} from "../../../types/combat.js";
import type { Player } from "../../../types/player.js";
import type { HexState, Site } from "../../../types/map.js";
import { SiteType } from "../../../types/map.js";
import { createConquerSiteCommand } from "../conquerSiteCommand.js";
import { queueSiteReward } from "../../helpers/rewards/index.js";
import { discardRuinsToken } from "../../helpers/ruinsTokenHelpers.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";
import { gainCrystalWithOverflow } from "../../helpers/crystalHelpers.js";
import type { BasicManaColor } from "@mage-knight/shared";

import {
  resolvePendingDamage,
  clearPendingAndAssigned,
  applyFameToPlayer,
  applyReputationChange,
  type ResolvePendingDamageResult,
} from "./damageResolution.js";
import { resolveAttackDefeatFameTrackers } from "../../combat/attackFameTracking.js";
import { resolveScoutFameBonus } from "../../combat/scoutFameTracking.js";
import { resolveBowPhaseFameBonus } from "../../combat/bowPhaseFameTracking.js";
import { resolveSoulHarvesterCrystals } from "../../combat/soulHarvesterTracking.js";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Apply fame and reputation rewards from defeated enemies to a player.
 * Consolidates duplicated pattern used in both handleCombatEnd and handleRangedSiegeToBlock.
 */
export function applyDefeatedEnemyRewards(
  state: GameState,
  playerId: string,
  damageResult: ResolvePendingDamageResult
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];

  // Apply fame gained from defeated enemies to the player
  let updatedState = applyFameToPlayer(state, playerId, damageResult.fameGained);

  // Apply reputation change from defeated enemies (e.g., Heroes penalty, Thugs bonus)
  const reputationResult = applyReputationChange(
    updatedState,
    playerId,
    damageResult.reputationBonus,
    damageResult.reputationPenalty
  );
  updatedState = reputationResult.state;
  events.push(...reputationResult.events);

  const defeatedEnemyIds = damageResult.events
    .filter(isEnemyDefeatedEvent)
    .map((event) => event.enemyInstanceId);

  const playerIndex = updatedState.players.findIndex((p) => p.id === playerId);
  if (playerIndex !== -1) {
    const player = updatedState.players[playerIndex];
    if (player) {
      const fameResult = resolveAttackDefeatFameTrackers(
        player.pendingAttackDefeatFame,
        defeatedEnemyIds
      );

      if (fameResult.updatedTrackers !== player.pendingAttackDefeatFame) {
        const updatedPlayers = [...updatedState.players];
        updatedPlayers[playerIndex] = {
          ...player,
          pendingAttackDefeatFame: fameResult.updatedTrackers,
        };
        updatedState = { ...updatedState, players: updatedPlayers };
      }

      if (fameResult.fameToGain > 0) {
        updatedState = applyFameToPlayer(updatedState, playerId, fameResult.fameToGain);
      }
    }
  }

  // Resolve Scout fame bonus (from Scout peek ability).
  // Scout peek tracks enemyIds (definition IDs like "guardsmen") not instanceIds
  // (like "enemy_0"), so we extract enemyId from defeated combat enemies.
  const defeatedEnemyDefinitionIds = damageResult.enemies
    .filter((e) => e.isDefeated)
    .map((e) => e.enemyId as string);
  const scoutFameResult = resolveScoutFameBonus(updatedState, playerId, defeatedEnemyDefinitionIds);
  if (scoutFameResult.fameToGain > 0) {
    updatedState = scoutFameResult.state;
    updatedState = applyFameToPlayer(updatedState, playerId, scoutFameResult.fameToGain);
  }

  // Resolve Bow of Starsdawn phase fame bonus.
  // Awards fame per enemy defeated in this phase, then consumes the modifier.
  const bowFameResult = resolveBowPhaseFameBonus(updatedState, playerId, damageResult.enemiesDefeatedCount);
  if (bowFameResult.fameToGain > 0) {
    updatedState = bowFameResult.state;
    updatedState = applyFameToPlayer(updatedState, playerId, bowFameResult.fameToGain);
  } else if (bowFameResult.state !== updatedState) {
    updatedState = bowFameResult.state;
  }

  // Resolve Soul Harvester crystal rewards.
  // Awards crystals based on defeated enemies' resistances, then consumes the modifier.
  const newlyDefeatedEnemies = damageResult.enemies.filter((e) => e.isDefeated);
  const soulHarvesterResult = resolveSoulHarvesterCrystals(updatedState, playerId, newlyDefeatedEnemies);
  if (soulHarvesterResult.state !== updatedState) {
    updatedState = soulHarvesterResult.state;
  }

  return { state: updatedState, events };
}

// ============================================================================
// Combat End Handling
// ============================================================================

/**
 * Handle the end of combat after the Attack phase.
 * Resolves final damage, determines victory, handles conquest and withdrawal.
 */
export function handleCombatEnd(
  state: GameState,
  playerId: string
): CommandResult {
  if (!state.combat) {
    throw new Error("Not in combat");
  }

  // Resolve pending damage from ATTACK phase before ending combat
  const damageResult = resolvePendingDamage(state.combat, playerId, state);

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

  // Apply fame and reputation rewards using consolidated helper
  const rewardsResult = applyDefeatedEnemyRewards(
    stateAfterResolution,
    playerId,
    damageResult
  );
  stateAfterResolution = rewardsResult.state;
  // Store reputation events to add after combat ended event
  const reputationEvents = rewardsResult.events;

  // Update player's enemiesDefeatedThisTurn counter (for Sword of Justice fame bonus)
  if (damageResult.enemiesDefeatedCount > 0) {
    const playerIndex = stateAfterResolution.players.findIndex((p) => p.id === playerId);
    if (playerIndex !== -1) {
      const player = stateAfterResolution.players[playerIndex];
      if (player) {
        const updatedPlayers = [...stateAfterResolution.players];
        updatedPlayers[playerIndex] = {
          ...player,
          enemiesDefeatedThisTurn: player.enemiesDefeatedThisTurn + damageResult.enemiesDefeatedCount,
        };
        stateAfterResolution = { ...stateAfterResolution, players: updatedPlayers };
      }
    }
  }

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
  const player = state.players.find((p) => p.id === playerId);

  // Use combatHexCoord if set (for remote combat like rampaging challenge),
  // otherwise fall back to player's position
  const combatHexPosition = resolvedCombat.combatHexCoord ?? player?.position;

  if (combatHexPosition) {
    const result = handleCombatHexCleanup(
      newState,
      resolvedCombat,
      playerId,
      combatHexPosition,
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
 * Handle hex cleanup after combat ends (clear enemies, conquest, withdrawal).
 */
export function handleCombatHexCleanup(
  state: GameState,
  resolvedCombat: CombatState,
  playerId: string,
  combatHexPosition: { q: number; r: number },
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
      const burnResult = handleBurnMonastery(newState, hex, playerId, combatHexPosition);
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

        // Handle ruins token-specific rewards after conquest
        if (hex.site.type === SiteType.AncientRuins && hex.ruinsToken) {
          const ruinsResult = handleRuinsTokenRewards(
            newState,
            playerId,
            hex.ruinsToken.tokenId,
            key
          );
          newState = ruinsResult.state;
          additionalEvents.push(...ruinsResult.events);
        }
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
 * Handle burning a monastery after combat victory.
 */
export function handleBurnMonastery(
  state: GameState,
  hex: HexState,
  playerId: string,
  combatHexPosition: { q: number; r: number }
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;
  const key = hexKey(combatHexPosition);

  if (!hex.site) {
    return { state: newState, events };
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
 * Handle ruins token-specific rewards after combat victory.
 * Grants rewards based on the enemy token definition and discards the token.
 */
function handleRuinsTokenRewards(
  state: GameState,
  playerId: string,
  tokenId: string,
  hexKey_: string
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  const tokenDef = getRuinsTokenDefinition(tokenId as import("@mage-knight/shared").RuinsTokenId);
  if (!tokenDef || !isEnemyToken(tokenDef)) {
    return { state: newState, events };
  }

  // Grant each reward from the token
  for (const rewardType of tokenDef.rewards) {
    switch (rewardType) {
      case RUINS_REWARD_ARTIFACT: {
        const result = queueSiteReward(newState, playerId, artifactReward(1));
        newState = result.state;
        events.push(...result.events);
        break;
      }
      case RUINS_REWARD_SPELL: {
        const result = queueSiteReward(newState, playerId, spellReward(1));
        newState = result.state;
        events.push(...result.events);
        break;
      }
      case RUINS_REWARD_ADVANCED_ACTION: {
        const result = queueSiteReward(newState, playerId, advancedActionReward(1));
        newState = result.state;
        events.push(...result.events);
        break;
      }
      case RUINS_REWARD_UNIT: {
        const result = queueSiteReward(newState, playerId, unitReward());
        newState = result.state;
        events.push(...result.events);
        break;
      }
      case RUINS_REWARD_CRYSTALS_4: {
        // Grant +1 crystal of each basic color (with overflow protection)
        let crystalPlayer = getPlayerById(newState, playerId);
        if (crystalPlayer) {
          const colors: BasicManaColor[] = ["red", "blue", "green", "white"];
          for (const color of colors) {
            const { player: p } = gainCrystalWithOverflow(crystalPlayer, color);
            crystalPlayer = p;
          }
          newState = {
            ...newState,
            players: newState.players.map((p) =>
              p.id === playerId ? crystalPlayer! : p
            ),
          };
        }
        break;
      }
    }
  }

  // Discard ruins token from hex and add to discard pile
  const updatedRuinsTokens = discardRuinsToken(
    newState.ruinsTokens,
    tokenId as import("@mage-knight/shared").RuinsTokenId
  );

  const currentHex = newState.map.hexes[hexKey_];
  if (currentHex) {
    const updatedHex: HexState = {
      ...currentHex,
      ruinsToken: null,
    };
    newState = {
      ...newState,
      ruinsTokens: updatedRuinsTokens,
      map: {
        ...newState.map,
        hexes: {
          ...newState.map.hexes,
          [hexKey_]: updatedHex,
        },
      },
    };
  }

  return { state: newState, events };
}

/**
 * Handle player withdrawal after failed assault.
 */
export function handleWithdrawal(
  state: GameState,
  playerId: string,
  assaultOrigin: { q: number; r: number }
): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let newState = state;

  const playerIndex = newState.players.findIndex((p) => p.id === playerId);
  const currentPlayer = newState.players[playerIndex];

  if (playerIndex !== -1 && currentPlayer?.position) {
    const updatedPlayer: Player = {
      ...currentPlayer,
      position: assaultOrigin,
      hasCombattedThisTurn: true,
      hasTakenActionThisTurn: true,
    };
    const updatedPlayers: Player[] = [...newState.players];
    updatedPlayers[playerIndex] = updatedPlayer;
    newState = { ...newState, players: updatedPlayers };

    events.push(
      createPlayerWithdrewEvent(
        playerId,
        currentPlayer.position,
        assaultOrigin
      )
    );
  }

  return { state: newState, events };
}

/**
 * Mark a player as having combatted this turn.
 */
export function markPlayerCombatted(state: GameState, playerId: string): GameState {
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
