/**
 * Liberate site command - marks a site as liberated and grants rewards
 *
 * This command is irreversible and is used in Shades of Tezla scenarios when
 * a player defeats all guarding enemies at a location that requires liberation.
 *
 * Liberation:
 * - Marks the site as liberated with liberatedBy field
 * - Adds shield token to the hex
 * - Grants +1 reputation
 * - Queues site-specific liberation reward (artifact for Magical Glade, spell for Graveyard)
 * - Emits SITE_LIBERATED event
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, HexCoord } from "@mage-knight/shared";
import {
  hexKey,
  SHIELD_TOKEN_PLACED,
  REPUTATION_REASON_LIBERATE_LOCATION,
} from "@mage-knight/shared";
import {
  createSiteLiberatedEvent,
  createReputationChangedEvent,
} from "@mage-knight/shared";
import type { Site, HexState } from "../../types/map.js";
import type { Player } from "../../types/player.js";
import { LIBERATE_SITE_COMMAND } from "./commandTypes.js";
import {
  getLiberationReward,
  LIBERATION_REPUTATION_REWARD,
} from "../../data/siteProperties.js";
import { queueSiteReward } from "../helpers/rewards/index.js";

export { LIBERATE_SITE_COMMAND };

export interface LiberateSiteCommandParams {
  readonly playerId: string;
  readonly hexCoord: HexCoord;
}

export function createLiberateSiteCommand(
  params: LiberateSiteCommandParams
): Command {
  return {
    type: LIBERATE_SITE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      const key = hexKey(params.hexCoord);
      const hex = state.map.hexes[key];

      if (!hex?.site) {
        throw new Error("No site at this location");
      }

      const site = hex.site;
      const events: GameEvent[] = [];

      // Update site state to mark as liberated
      const updatedSite: Site = {
        ...site,
        isLiberated: true,
        liberatedBy: params.playerId,
      };

      // Add shield token to hex
      const updatedShieldTokens = [...hex.shieldTokens, params.playerId];

      // Update hex
      const updatedHex: HexState = {
        ...hex,
        site: updatedSite,
        shieldTokens: updatedShieldTokens,
        // Clear guarding enemies (they were defeated)
        enemies: [],
      };

      const updatedHexes = {
        ...state.map.hexes,
        [key]: updatedHex,
      };

      let finalState: GameState = {
        ...state,
        map: { ...state.map, hexes: updatedHexes },
      };

      // Grant reputation bonus
      const playerIndex = finalState.players.findIndex(
        (p) => p.id === params.playerId
      );
      const currentPlayer = finalState.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const newReputation =
        currentPlayer.reputation + LIBERATION_REPUTATION_REWARD;
      const updatedPlayer: Player = {
        ...currentPlayer,
        reputation: newReputation,
      };

      const updatedPlayers = [...finalState.players];
      updatedPlayers[playerIndex] = updatedPlayer;
      finalState = { ...finalState, players: updatedPlayers };

      events.push(
        createReputationChangedEvent(
          params.playerId,
          LIBERATION_REPUTATION_REWARD,
          newReputation,
          REPUTATION_REASON_LIBERATE_LOCATION
        )
      );

      // Shield token event
      events.push({
        type: SHIELD_TOKEN_PLACED,
        playerId: params.playerId,
        hexCoord: params.hexCoord,
        totalShields: 1,
      });

      // Site liberated event
      events.push(
        createSiteLiberatedEvent(params.playerId, site.type, params.hexCoord)
      );

      // Queue liberation reward if site has one
      const reward = getLiberationReward(site.type);
      if (reward) {
        const { state: rewardState, events: rewardEvents } = queueSiteReward(
          finalState,
          params.playerId,
          reward
        );
        finalState = rewardState;
        events.push(...rewardEvents);
      }

      return {
        state: finalState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo LIBERATE_SITE");
    },
  };
}
