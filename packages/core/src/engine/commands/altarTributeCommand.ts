/**
 * Altar Tribute command - pays mana at an Ancient Ruins altar token
 *
 * This command handles the ALTAR_TRIBUTE action:
 * - Validates the player is at ruins with a revealed altar token
 * - Consumes mana of the required color(s)
 * - Grants fame reward
 * - Conquers the site
 * - Discards the ruins token
 *
 * This is an irreversible action (mana consumed, fame gained, site conquered).
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, ManaSourceInfo } from "@mage-knight/shared";
import {
  hexKey,
  getRuinsTokenDefinition,
  isAltarToken,
  createAltarTributePaidEvent,
} from "@mage-knight/shared";
import type { Player } from "../../types/player.js";
import type { HexState } from "../../types/map.js";
import { ALTAR_TRIBUTE_COMMAND } from "./commandTypes.js";
import { consumeMultipleMana } from "./helpers/manaConsumptionHelpers.js";
import { grantFameReward } from "../helpers/rewards/handlers.js";
import { createConquerSiteCommand } from "./conquerSiteCommand.js";
import { discardRuinsToken } from "../helpers/ruinsTokenHelpers.js";

export { ALTAR_TRIBUTE_COMMAND };

export interface AltarTributeCommandParams {
  readonly playerId: string;
  readonly manaSources: readonly ManaSourceInfo[];
}

export function createAltarTributeCommand(
  params: AltarTributeCommandParams
): Command {
  return {
    type: ALTAR_TRIBUTE_COMMAND,
    playerId: params.playerId,
    isReversible: false,

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error(`Player not found: ${params.playerId}`);
      }

      const player = state.players[playerIndex] as Player;
      if (!player.position) {
        throw new Error("Player has no position");
      }

      const key = hexKey(player.position);
      const hex = state.map.hexes[key];
      if (!hex?.site) {
        throw new Error("No site at player position");
      }

      if (!hex.ruinsToken) {
        throw new Error("No ruins token at this hex");
      }

      const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
      if (!tokenDef || !isAltarToken(tokenDef)) {
        throw new Error("Token is not an altar token");
      }

      const events: GameEvent[] = [];
      let updatedState = state;

      // 1. Consume mana
      const manaResult = consumeMultipleMana(
        player,
        state.source,
        params.manaSources,
        params.playerId
      );
      let updatedPlayer = manaResult.player;
      const updatedSource = manaResult.source;

      // 2. Mark action taken
      updatedPlayer = {
        ...updatedPlayer,
        hasTakenActionThisTurn: true,
        hasCombattedThisTurn: true,
      };

      // Update player and source in state
      const updatedPlayers = [...updatedState.players];
      updatedPlayers[playerIndex] = updatedPlayer;
      updatedState = {
        ...updatedState,
        players: updatedPlayers,
        source: updatedSource,
      };

      // 3. Grant fame reward
      const fameResult = grantFameReward(
        updatedState,
        params.playerId,
        tokenDef.fameReward
      );
      updatedState = fameResult.state;
      events.push(...fameResult.events);

      // 4. Emit altar tribute event
      events.push(
        createAltarTributePaidEvent(
          params.playerId,
          tokenDef.manaColor,
          tokenDef.manaCost,
          tokenDef.fameReward
        )
      );

      // 5. Conquer site (no additional reward for altars — fame was the reward)
      const conquestResult = createConquerSiteCommand({
        playerId: params.playerId,
        hexCoord: player.position,
      }).execute(updatedState);
      updatedState = conquestResult.state;
      events.push(...conquestResult.events);

      // 6. Discard ruins token from hex and add to discard pile
      const updatedRuinsTokens = discardRuinsToken(
        updatedState.ruinsTokens,
        hex.ruinsToken.tokenId
      );

      const conqueredHex = updatedState.map.hexes[key];
      if (conqueredHex) {
        const updatedHex: HexState = {
          ...conqueredHex,
          ruinsToken: null,
        };
        updatedState = {
          ...updatedState,
          ruinsTokens: updatedRuinsTokens,
          map: {
            ...updatedState.map,
            hexes: {
              ...updatedState.map.hexes,
              [key]: updatedHex,
            },
          },
        };
      }

      return {
        state: updatedState,
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo ALTAR_TRIBUTE");
    },
  };
}
