/**
 * Enter site command - handles entering adventure sites for combat
 *
 * Adventure sites include:
 * - Dungeon: Draws 2 brown enemies when entered
 * - Tomb: Draws 2 red enemies when entered
 * - Monster Den: Fight existing green enemy from tile reveal
 * - Spawning Grounds: Fight existing green enemies from tile reveal
 * - Ancient Ruins: Fight brown enemy at night, or auto-conquest at day if empty
 *
 * This is an irreversible action that:
 * - Draws enemies (for dungeon/tomb)
 * - Initiates combat (if enemies present)
 * - Marks hasTakenActionThisTurn = true
 * - Triggers instant conquest for day ruins with no enemies
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  SITE_ENTERED,
  ENEMIES_DRAWN_FOR_SITE,
  COMBAT_STARTED,
  hexKey,
  COMBAT_TRIGGER_VOLUNTARY_EXPLORE,
} from "@mage-knight/shared";
import { createCombatTriggeredEvent } from "@mage-knight/shared";
import { getAdventureSiteEnemies, drawEnemy, getEnemyIdFromToken } from "../helpers/enemyHelpers.js";
import type { HexState, HexEnemy } from "../../types/map.js";
import { SiteType } from "../../types/map.js";
import type { EnemyTokenId, EnemyColor } from "../../types/enemy.js";
import { createCombatState } from "../../types/combat.js";
import { createConquerSiteCommand } from "./conquerSiteCommand.js";
import { ENTER_SITE_COMMAND } from "./commandTypes.js";

export { ENTER_SITE_COMMAND };

export interface EnterSiteCommandParams {
  readonly playerId: string;
}

export function createEnterSiteCommand(params: EnterSiteCommandParams): Command {
  return {
    type: ENTER_SITE_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Entering site is commitment (enemies drawn, combat started)

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
      const events: GameEvent[] = [];
      let updatedState = state;

      // Emit SITE_ENTERED event
      events.push({
        type: SITE_ENTERED,
        playerId: params.playerId,
        siteType: site.type,
        hexCoord: player.position,
      });

      // Get enemies — either from hex or draw new ones
      // hex.enemies is now HexEnemy[], copy them
      const hexEnemies: HexEnemy[] = [...hex.enemies];

      // Dungeons and tombs draw enemies now
      const adventureEnemies = getAdventureSiteEnemies(site.type);
      if (adventureEnemies) {
        let currentPiles = updatedState.enemyTokens;
        let currentRng = updatedState.rng;

        for (let i = 0; i < adventureEnemies.count; i++) {
          const result = drawEnemy(currentPiles, adventureEnemies.color, currentRng);
          currentPiles = result.piles;
          currentRng = result.rng;
          if (result.tokenId) {
            // Enemies drawn on site entry are revealed (face-up)
            hexEnemies.push({
              tokenId: result.tokenId,
              color: adventureEnemies.color,
              isRevealed: true,
            });
          }
        }

        // Update hex with drawn enemies
        const updatedHex: HexState = {
          ...hex,
          enemies: hexEnemies,
        };

        const updatedHexes = {
          ...updatedState.map.hexes,
          [key]: updatedHex,
        };

        updatedState = {
          ...updatedState,
          map: { ...updatedState.map, hexes: updatedHexes },
          enemyTokens: currentPiles,
          rng: currentRng,
        };

        events.push({
          type: ENEMIES_DRAWN_FOR_SITE,
          playerId: params.playerId,
          siteType: site.type,
          enemyCount: adventureEnemies.count,
        });
      }

      // Mark action taken
      const playerIndex = updatedState.players.findIndex((p) => p.id === params.playerId);
      const currentPlayer = updatedState.players[playerIndex];
      if (!currentPlayer) {
        throw new Error(`Player not found: ${params.playerId}`);
      }
      const updatedPlayers = [...updatedState.players];
      updatedPlayers[playerIndex] = {
        ...currentPlayer,
        hasTakenActionThisTurn: true,
        hasCombattedThisTurn: true,
      };
      updatedState = { ...updatedState, players: updatedPlayers };

      // Special case: Ruins at day with no enemies = instant conquest
      if (hexEnemies.length === 0) {
        // No enemies — instant conquest
        const conquestResult = createConquerSiteCommand({
          playerId: params.playerId,
          hexCoord: player.position,
        }).execute(updatedState);

        return {
          state: conquestResult.state,
          events: [...events, ...conquestResult.events],
        };
      }

      // Convert HexEnemy[] to enemy IDs for combat
      const enemyIds = hexEnemies.map((e) => getEnemyIdFromToken(e.tokenId));
      const tokenIds = hexEnemies.map((e) => e.tokenId);

      // Emit COMBAT_TRIGGERED event
      events.push(
        createCombatTriggeredEvent(
          params.playerId,
          COMBAT_TRIGGER_VOLUNTARY_EXPLORE,
          player.position,
          tokenIds
        )
      );

      // Determine combat restrictions based on site type
      // Dungeons and Tombs: no units allowed, night mana rules apply
      const isDungeonOrTomb = site.type === SiteType.Dungeon || site.type === SiteType.Tomb;

      // Enter combat
      const combatState = createCombatState(
        enemyIds,
        false, // Adventure sites are NOT fortified
        {
          unitsAllowed: !isDungeonOrTomb,
          nightManaRules: isDungeonOrTomb,
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
      throw new Error("Cannot undo ENTER_SITE — enemies have been drawn");
    },
  };
}
