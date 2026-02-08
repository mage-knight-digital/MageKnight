/**
 * Move command - handles player movement with undo support
 *
 * Combat triggers:
 * 1. Fortified assault - moving to Keep, Mage Tower, City applies -1 reputation
 * 2. Provoking rampaging - moving from one hex adjacent to a rampaging enemy
 *    to another hex also adjacent triggers combat and ends movement
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { HexCoord, GameEvent } from "@mage-knight/shared";
import {
  createMoveUndoneEvent,
  createPlayerMovedEvent,
  createCombatTriggeredEvent,
  createReputationChangedEvent,
  createEnemiesRevealedEvent,
  createRuinsTokenRevealedEvent,
  getRuinsTokenDefinition,
  hexKey,
  getAllNeighbors,
  COMBAT_TRIGGER_FORTIFIED_ASSAULT,
  COMBAT_TRIGGER_PROVOKE_RAMPAGING,
  REPUTATION_REASON_ASSAULT,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";
import { revealRuinsToken } from "../helpers/ruinsTokenHelpers.js";
import type { Player } from "../../types/player.js";
import { MOVE_COMMAND } from "./commandTypes.js";
import { SITE_PROPERTIES } from "../../data/siteProperties.js";
import { createCombatState, type CombatEnemyInput } from "../../types/combat.js";
import { getEnemyIdFromToken } from "../helpers/enemy/index.js";
import { SiteType, type HexState, type HexEnemy } from "../../types/map.js";
import { isRuleActive } from "../modifiers/index.js";
import { RULE_IGNORE_RAMPAGING_PROVOKE } from "../../types/modifierConstants.js";

export { MOVE_COMMAND };

/**
 * Find fortified sites that are newly adjacent after a move and have unrevealed enemies.
 * Returns the hexes with enemies that should be revealed.
 */
function findNewlyAdjacentFortifiedSites(
  from: HexCoord,
  to: HexCoord,
  hexes: Record<string, HexState>
): { hex: HexState; key: string }[] {
  const fromNeighbors = new Set(getAllNeighbors(from).map(hexKey));
  const toNeighbors = getAllNeighbors(to);

  const sitesToReveal: { hex: HexState; key: string }[] = [];

  for (const neighbor of toNeighbors) {
    const key = hexKey(neighbor);
    // Skip hexes already adjacent to 'from' position
    if (fromNeighbors.has(key)) continue;

    const hex = hexes[key];
    if (!hex?.site) continue;

    // Check if it's a fortified site
    const props = SITE_PROPERTIES[hex.site.type];
    if (!props.fortified) continue;

    // Check if it has unrevealed enemies
    const hasUnrevealedEnemies = hex.enemies.some((e) => !e.isRevealed);
    if (hasUnrevealedEnemies) {
      sitesToReveal.push({ hex, key });
    }
  }

  return sitesToReveal;
}

/**
 * Find rampaging enemies that are adjacent to both the 'from' and 'to' hexes.
 * These are the enemies that would be provoked by this move.
 */
function findProvokedRampagingEnemies(
  from: HexCoord,
  to: HexCoord,
  hexes: Record<string, HexState>
): { hex: HexState; enemies: readonly HexEnemy[] }[] {
  // Get all hexes adjacent to the starting position
  const fromNeighbors = getAllNeighbors(from);
  const fromNeighborKeys = new Set(fromNeighbors.map(hexKey));

  // Get all hexes adjacent to the destination
  const toNeighbors = getAllNeighbors(to);
  const toNeighborKeys = new Set(toNeighbors.map(hexKey));

  // Find hexes that are adjacent to BOTH from and to
  const commonNeighborKeys = [...fromNeighborKeys].filter((key) =>
    toNeighborKeys.has(key)
  );

  // Check each common neighbor for rampaging enemies
  const provokedEnemies: { hex: HexState; enemies: readonly HexEnemy[] }[] = [];

  for (const key of commonNeighborKeys) {
    const hex = hexes[key];
    if (
      hex &&
      hex.rampagingEnemies.length > 0 &&
      hex.enemies.length > 0
    ) {
      provokedEnemies.push({ hex, enemies: hex.enemies });
    }
  }

  return provokedEnemies;
}

export interface MoveCommandParams {
  readonly playerId: string;
  readonly from: HexCoord;
  readonly to: HexCoord;
  readonly terrainCost: number;
  readonly hadMovedThisTurn: boolean; // capture state before this move for proper undo
  readonly wouldRevealEnemies?: boolean; // whether this move reveals hidden enemies (Day only)
}

/**
 * Create a move command.
 *
 * The terrainCost and hadMovedThisTurn are passed in because they were captured
 * at creation time. This ensures undo restores the exact previous state.
 */
export function createMoveCommand(params: MoveCommandParams): Command {
  // Track whether this move triggered combat (for undo to clear it)
  let triggeredCombat = false;

  return {
    type: MOVE_COMMAND,
    playerId: params.playerId,
    // Movement is reversible unless it reveals hidden enemies (like revealing a tile)
    isReversible: !params.wouldRevealEnemies,

    execute(state: GameState): CommandResult {
      // Find player and update position
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      const events: GameEvent[] = [
        createPlayerMovedEvent(params.playerId, params.from, params.to),
      ];

      // Check destination hex for fortified site
      const destinationKey = hexKey(params.to);
      const destinationHex = state.map.hexes[destinationKey];

      let updatedPlayer: Player = {
        ...player,
        position: params.to,
        movePoints: player.movePoints - params.terrainCost,
        hasMovedThisTurn: true,
        // Clear interaction tracking when moving - new site = new interaction
        unitsRecruitedThisInteraction: [],
      };

      let updatedState: GameState = state;

      // Check if moving to a fortified site triggers assault
      if (destinationHex?.site) {
        const site = destinationHex.site;
        const props = SITE_PROPERTIES[site.type];

        // Unconquered fortified sites (keeps, mage towers, cities)
        const isUnconqueredFortified = props.fortified && !site.isConquered;

        // Opponent-owned keeps also trigger assault
        const isOpponentKeep =
          site.type === SiteType.Keep &&
          site.isConquered &&
          site.owner !== params.playerId;

        if (isUnconqueredFortified || isOpponentKeep) {
          // Assault! Apply -1 reputation penalty
          const newReputation = player.reputation - 1;

          events.push(
            createReputationChangedEvent(
              params.playerId,
              -1,
              newReputation,
              REPUTATION_REASON_ASSAULT
            )
          );

          // Get enemies at hex - for opponent keeps with no garrison, draw would happen
          // TODO: Draw random gray enemy as garrison for opponent keeps (half fame)
          const hexEnemies = destinationHex.enemies;
          const enemyTokenIds = hexEnemies.map((e) => e.tokenId);

          // Emit combat triggered event
          events.push(
            createCombatTriggeredEvent(
              params.playerId,
              COMBAT_TRIGGER_FORTIFIED_ASSAULT,
              params.to,
              enemyTokenIds
            )
          );

          // Update player with reputation change and mark combat started
          updatedPlayer = {
            ...updatedPlayer,
            reputation: newReputation,
            hasCombattedThisTurn: true,
          };

          // Create combat state with assault origin (where player was before assault)
          const combatState = createCombatState(
            hexEnemies.map((e) => getEnemyIdFromToken(e.tokenId)),
            true, // isAtFortifiedSite
            { assaultOrigin: params.from }
          );

          updatedState = { ...updatedState, combat: combatState };
          triggeredCombat = true;
        }
      }

      // Check for provoking rampaging enemies (skirting around them)
      // Per rulebook: An assault can provoke rampaging enemies. You must fight both
      // the defenders and these rampaging enemies at once.
      // Underground Travel bypasses rampaging provocation entirely.
      const ignoresRampaging = isRuleActive(state, params.playerId, RULE_IGNORE_RAMPAGING_PROVOKE);
      const provokedEnemies = ignoresRampaging
        ? []
        : findProvokedRampagingEnemies(
          params.from,
          params.to,
          state.map.hexes
        );

      const firstProvoked = provokedEnemies[0];
      if (firstProvoked) {
        // Collect all enemy tokens from all provoked hexes
        const allHexEnemies = provokedEnemies.flatMap((p) => p.enemies);
        const allEnemyTokenIds = allHexEnemies.map((e) => e.tokenId);
        const rampagingHexCoord = firstProvoked.hex.coord;

        // Emit combat triggered event for the provoked enemies
        events.push(
          createCombatTriggeredEvent(
            params.playerId,
            COMBAT_TRIGGER_PROVOKE_RAMPAGING,
            rampagingHexCoord,
            allEnemyTokenIds
          )
        );

        // Mark player as having combatted this turn
        updatedPlayer = {
          ...updatedPlayer,
          hasCombattedThisTurn: true,
        };

        if (updatedState.combat) {
          // Assault already triggered combat - add provoked enemies to existing combat
          // Per rulebook: rampaging enemies are NOT fortified and you do not need to
          // defeat them to conquer the site. Mark them as isRequiredForConquest: false.
          const existingEnemyInputs: CombatEnemyInput[] = updatedState.combat.enemies.map(
            (e) => ({ enemyId: e.enemyId, isRequiredForConquest: true })
          );
          const provokedEnemyInputs: CombatEnemyInput[] = allHexEnemies.map((e) => ({
            enemyId: getEnemyIdFromToken(e.tokenId),
            isRequiredForConquest: false, // Rampaging enemies not required for conquest
          }));
          const allEnemyInputs = [...existingEnemyInputs, ...provokedEnemyInputs];

          const mergedCombatState = createCombatState(
            allEnemyInputs,
            updatedState.combat.isAtFortifiedSite,
            { assaultOrigin: updatedState.combat.assaultOrigin }
          );

          updatedState = { ...updatedState, combat: mergedCombatState };
        } else {
          // No assault - just rampaging enemy provocation
          const combatState = createCombatState(
            allHexEnemies.map((e) => getEnemyIdFromToken(e.tokenId)),
            false // isAtFortifiedSite - rampaging enemies are not fortified
          );

          updatedState = { ...updatedState, combat: combatState };
          triggeredCombat = true;
        }
      }

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      // During Day, reveal enemies at newly adjacent fortified sites
      let updatedHexes = updatedState.map.hexes;
      if (state.timeOfDay === TIME_OF_DAY_DAY) {
        const sitesToReveal = findNewlyAdjacentFortifiedSites(
          params.from,
          params.to,
          updatedHexes
        );

        for (const { hex, key } of sitesToReveal) {
          // Reveal all unrevealed enemies at this hex
          const revealedEnemies = hex.enemies.map((e) =>
            e.isRevealed ? e : { ...e, isRevealed: true }
          );
          const revealedTokenIds = hex.enemies
            .filter((e) => !e.isRevealed)
            .map((e) => String(e.tokenId));

          // Emit reveal event
          if (revealedTokenIds.length > 0) {
            events.push(
              createEnemiesRevealedEvent(params.playerId, hex.coord, revealedTokenIds)
            );
          }

          // Update the hex with revealed enemies
          updatedHexes = {
            ...updatedHexes,
            [key]: {
              ...hex,
              enemies: revealedEnemies,
            },
          };
        }
      }

      // Reveal face-down ruins token on destination hex when player enters
      if (destinationHex?.ruinsToken && !destinationHex.ruinsToken.isRevealed) {
        const revealedToken = revealRuinsToken(destinationHex.ruinsToken);
        const tokenDef = getRuinsTokenDefinition(revealedToken.tokenId);
        const updatedDestHex = {
          ...(updatedHexes[destinationKey] ?? destinationHex),
          ruinsToken: revealedToken,
        };
        updatedHexes = {
          ...updatedHexes,
          [destinationKey]: updatedDestHex,
        };
        events.push(
          createRuinsTokenRevealedEvent(
            params.playerId,
            params.to,
            revealedToken.tokenId,
            tokenDef?.type ?? "unknown"
          )
        );
      }

      // Apply hex updates to map if any reveals happened
      if (updatedHexes !== updatedState.map.hexes) {
        updatedState = {
          ...updatedState,
          map: {
            ...updatedState.map,
            hexes: updatedHexes,
          },
        };
      }

      return {
        state: { ...updatedState, players: updatedPlayers },
        events,
      };
    },

    undo(state: GameState): CommandResult {
      // Find player and restore position
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error(`Player not found at index: ${playerIndex}`);
      }

      // If this move triggered combat, also undo the combat flag
      const updatedPlayer: Player = {
        ...player,
        position: params.from,
        movePoints: player.movePoints + params.terrainCost,
        hasMovedThisTurn: params.hadMovedThisTurn,
        hasCombattedThisTurn: triggeredCombat ? false : player.hasCombattedThisTurn,
      };

      const updatedPlayers: Player[] = [...state.players];
      updatedPlayers[playerIndex] = updatedPlayer;

      // If this move triggered combat, clear combat state
      const updatedState: GameState = triggeredCombat
        ? { ...state, players: updatedPlayers, combat: null }
        : { ...state, players: updatedPlayers };

      return {
        state: updatedState,
        events: [
          createMoveUndoneEvent(params.playerId, params.to, params.from), // reversed
        ],
      };
    },
  };
}
