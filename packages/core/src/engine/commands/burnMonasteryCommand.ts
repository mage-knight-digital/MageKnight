/**
 * Burn monastery command - initiates combat to burn a monastery
 *
 * When a player burns a monastery:
 * 1. Immediately loses 3 reputation
 * 2. A violet enemy is drawn for combat
 * 3. Units cannot participate (like dungeon/tomb)
 * 4. Enemy is always discarded after combat (win or lose)
 * 5. On victory: monastery marked burned, artifact reward queued
 * 6. On defeat: monastery NOT burned (can retry later)
 *
 * This is an irreversible action (RNG used to draw enemy).
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  hexKey,
  COMBAT_STARTED,
  REPUTATION_REASON_BURN_MONASTERY,
  ENEMY_COLOR_VIOLET,
} from "@mage-knight/shared";
import {
  createMonasteryBurnStartedEvent,
  createReputationChangedEvent,
} from "@mage-knight/shared";
import { createCombatState, COMBAT_CONTEXT_BURN_MONASTERY } from "../../types/combat.js";
import { drawEnemy, getEnemyIdFromToken } from "../helpers/enemyHelpers.js";
import type { Player } from "../../types/player.js";
import { BURN_MONASTERY_COMMAND } from "./commandTypes.js";

export { BURN_MONASTERY_COMMAND };

/** Reputation penalty for burning a monastery */
const BURN_REPUTATION_PENALTY = -3;

export interface BurnMonasteryCommandParams {
  readonly playerId: string;
}

export function createBurnMonasteryCommand(
  params: BurnMonasteryCommandParams
): Command {
  return {
    type: BURN_MONASTERY_COMMAND,
    playerId: params.playerId,
    isReversible: false, // RNG used to draw enemy

    execute(state: GameState): CommandResult {
      const player = state.players.find((p) => p.id === params.playerId);
      if (!player?.position) {
        throw new Error("Player has no position");
      }

      const key = hexKey(player.position);
      const hex = state.map.hexes[key];
      if (!hex?.site) {
        throw new Error("No site at player position");
      }

      const events: GameEvent[] = [];
      let updatedState = state;

      // Emit MONASTERY_BURN_STARTED event
      events.push(createMonasteryBurnStartedEvent(params.playerId, player.position));

      // Draw a violet enemy
      const enemyResult = drawEnemy(
        updatedState.enemyTokens,
        ENEMY_COLOR_VIOLET,
        updatedState.rng
      );

      if (!enemyResult.tokenId) {
        throw new Error("No violet enemies available to draw");
      }

      updatedState = {
        ...updatedState,
        enemyTokens: enemyResult.piles,
        rng: enemyResult.rng,
      };

      const enemyId = getEnemyIdFromToken(enemyResult.tokenId);

      // Apply reputation penalty
      const playerIndex = updatedState.players.findIndex((p) => p.id === params.playerId);
      const currentPlayer = updatedState.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const newReputation = currentPlayer.reputation + BURN_REPUTATION_PENALTY;
      const updatedPlayer: Player = {
        ...currentPlayer,
        reputation: newReputation,
        hasTakenActionThisTurn: true,
        hasCombattedThisTurn: true,
      };

      const updatedPlayers = [...updatedState.players];
      updatedPlayers[playerIndex] = updatedPlayer;
      updatedState = { ...updatedState, players: updatedPlayers };

      events.push(
        createReputationChangedEvent(
          params.playerId,
          BURN_REPUTATION_PENALTY,
          newReputation,
          REPUTATION_REASON_BURN_MONASTERY
        )
      );

      // Create combat state with burn monastery context
      const combatState = createCombatState(
        [enemyId],
        false, // Not fortified
        {
          unitsAllowed: false, // Units cannot participate
          nightManaRules: false, // Normal mana rules apply
          discardEnemiesOnFailure: true, // Enemy always discarded
          combatHexCoord: player.position,
          combatContext: COMBAT_CONTEXT_BURN_MONASTERY,
        }
      );

      // Emit COMBAT_STARTED event
      events.push({
        type: COMBAT_STARTED,
        playerId: params.playerId,
        enemies: combatState.enemies.map((e) => ({
          instanceId: e.instanceId,
          name: e.definition.name,
          attack: e.definition.attack,
          armor: e.definition.armor,
        })),
      });

      updatedState = {
        ...updatedState,
        combat: combatState,
      };

      return {
        state: updatedState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo BURN_MONASTERY — enemy has been drawn");
    },
  };
}
