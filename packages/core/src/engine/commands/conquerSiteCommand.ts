/**
 * Conquer site command - marks a site as conquered and places shield tokens
 *
 * This command is irreversible (conquest cannot be undone) and:
 * - Marks the site as conquered with owner
 * - Adds shield token(s) to the hex
 * - For cities: adds shields to city state and determines leader
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, HexCoord } from "@mage-knight/shared";
import { SITE_CONQUERED, SHIELD_TOKEN_PLACED, hexKey } from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
import type { Site, HexState } from "../../types/map.js";
import type { CityShield, CityState } from "../../types/city.js";
import { determineCityLeader } from "../../types/city.js";
import { CONQUER_SITE_COMMAND } from "./commandTypes.js";

export { CONQUER_SITE_COMMAND };

export interface ConquerSiteCommandParams {
  readonly playerId: string;
  readonly hexCoord: HexCoord;
  readonly enemiesDefeated?: number; // For cities: shields = enemies defeated
}

export function createConquerSiteCommand(
  params: ConquerSiteCommandParams
): Command {
  return {
    type: CONQUER_SITE_COMMAND,
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

      // Update site state
      const updatedSite: Site = {
        ...site,
        isConquered: true,
        owner: params.playerId,
      };

      // Add shield token to hex
      const updatedShieldTokens = [...hex.shieldTokens, params.playerId];

      // Handle city conquest specially
      if (site.type === SiteType.City && site.cityColor) {
        const cityState = state.cities[site.cityColor];
        if (cityState) {
          const enemiesDefeated = params.enemiesDefeated ?? 1;
          const newShields: CityShield[] = Array(enemiesDefeated)
            .fill(null)
            .map((_, i) => ({
              playerId: params.playerId,
              order: (cityState.shields?.length ?? 0) + i,
            }));

          const allShields = [...(cityState.shields ?? []), ...newShields];

          // Update city state
          const updatedCityState: CityState = {
            ...cityState,
            isConquered: true,
            shields: allShields,
            leaderId: determineCityLeader(allShields),
          };

          // Update cities in state
          const updatedCities = {
            ...state.cities,
            [site.cityColor]: updatedCityState,
          };

          events.push({
            type: SHIELD_TOKEN_PLACED,
            playerId: params.playerId,
            hexCoord: params.hexCoord,
            totalShields: enemiesDefeated,
          });

          events.push({
            type: SITE_CONQUERED,
            playerId: params.playerId,
            siteType: site.type,
            hexCoord: params.hexCoord,
          });

          // Update hex
          const updatedHex: HexState = {
            ...hex,
            site: updatedSite,
            shieldTokens: updatedShieldTokens,
          };

          const updatedHexes = {
            ...state.map.hexes,
            [key]: updatedHex,
          };

          return {
            state: {
              ...state,
              map: { ...state.map, hexes: updatedHexes },
              cities: updatedCities,
            },
            events,
          };
        }
      }

      // Non-city sites: single shield
      events.push({
        type: SHIELD_TOKEN_PLACED,
        playerId: params.playerId,
        hexCoord: params.hexCoord,
        totalShields: 1,
      });

      events.push({
        type: SITE_CONQUERED,
        playerId: params.playerId,
        siteType: site.type,
        hexCoord: params.hexCoord,
      });

      // Update hex
      const updatedHex: HexState = {
        ...hex,
        site: updatedSite,
        shieldTokens: updatedShieldTokens,
      };

      const updatedHexes = {
        ...state.map.hexes,
        [key]: updatedHex,
      };

      return {
        state: {
          ...state,
          map: { ...state.map, hexes: updatedHexes },
        },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo CONQUER_SITE");
    },
  };
}
