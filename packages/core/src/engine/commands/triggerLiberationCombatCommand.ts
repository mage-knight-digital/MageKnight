/**
 * Trigger liberation combat command - initiates combat to liberate a location
 *
 * In Shades of Tezla scenarios, some locations have guarding enemies that must
 * be defeated before the location's effects become available.
 *
 * This command:
 * - Initiates combat against the guarding enemies on the hex
 * - Sets combatContext to LIBERATE_LOCATION for special handling on victory
 * - Marks hasTakenActionThisTurn = true
 * - Does NOT draw new enemies (uses existing guarding enemies)
 *
 * On victory (handled by endCombatPhaseCommand):
 * - Site is marked as liberated
 * - Liberation rewards are granted (artifact/spell + reputation)
 * - Shield token is placed
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  SITE_ENTERED,
  COMBAT_STARTED,
  hexKey,
  COMBAT_TRIGGER_LIBERATE_LOCATION,
} from "@mage-knight/shared";
import { createCombatTriggeredEvent } from "@mage-knight/shared";
import { getEnemyIdFromToken } from "../helpers/enemyHelpers.js";
import { createCombatState, COMBAT_CONTEXT_LIBERATE_LOCATION } from "../../types/combat.js";
import type { Player } from "../../types/player.js";
import { TRIGGER_LIBERATION_COMBAT_COMMAND } from "./commandTypes.js";

export { TRIGGER_LIBERATION_COMBAT_COMMAND };

export interface TriggerLiberationCombatCommandParams {
  readonly playerId: string;
}

export function createTriggerLiberationCombatCommand(
  params: TriggerLiberationCombatCommandParams
): Command {
  return {
    type: TRIGGER_LIBERATION_COMBAT_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Combat cannot be undone

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

      const site = hex.site;
      if (!site.requiresLiberation) {
        throw new Error("Site does not require liberation");
      }

      if (site.isLiberated) {
        throw new Error("Site is already liberated");
      }

      // Must have guarding enemies
      if (hex.enemies.length === 0) {
        throw new Error("No guarding enemies at this location");
      }

      const events: GameEvent[] = [];
      let updatedState = state;

      // Emit SITE_ENTERED event
      events.push({
        type: SITE_ENTERED,
        playerId: params.playerId,
        siteType: site.type,
        hexCoord: player.position,
      });

      // Convert HexEnemy[] to enemy IDs for combat
      const enemyIds = hex.enemies.map((e) => getEnemyIdFromToken(e.tokenId));
      const tokenIds = hex.enemies.map((e) => e.tokenId);

      // Emit COMBAT_TRIGGERED event
      events.push(
        createCombatTriggeredEvent(
          params.playerId,
          COMBAT_TRIGGER_LIBERATE_LOCATION,
          player.position,
          tokenIds
        )
      );

      // Mark action and combat taken
      const playerIndex = updatedState.players.findIndex(
        (p) => p.id === params.playerId
      );
      const currentPlayer = updatedState.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const updatedPlayer: Player = {
        ...currentPlayer,
        hasTakenActionThisTurn: true,
        hasCombattedThisTurn: true,
      };

      const updatedPlayers = [...updatedState.players];
      updatedPlayers[playerIndex] = updatedPlayer;
      updatedState = { ...updatedState, players: updatedPlayers };

      // Create combat state with liberation context
      // Liberation combat uses normal rules (units allowed, normal mana)
      const combatState = createCombatState(
        enemyIds,
        false, // Liberation sites (Magical Glade, etc.) are not fortified
        {
          unitsAllowed: true,
          nightManaRules: false,
          discardEnemiesOnFailure: false, // Enemies stay if player fails
          combatHexCoord: player.position,
          combatContext: COMBAT_CONTEXT_LIBERATE_LOCATION,
        }
      );

      // Add COMBAT_STARTED event
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
      throw new Error("Cannot undo TRIGGER_LIBERATION_COMBAT — combat has started");
    },
  };
}
