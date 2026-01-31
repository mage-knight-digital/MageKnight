/**
 * Time Transition for End Round
 *
 * Handles day/night toggle and dawn effects (revealing ruins tokens).
 *
 * @module commands/endRound/timeTransition
 */

import type { GameState } from "../../../state/GameState.js";
import type { HexState } from "../../../types/map.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  TIME_OF_DAY_CHANGED,
} from "@mage-knight/shared";
import { revealRuinsToken } from "../../helpers/ruinsTokenHelpers.js";
import type { TimeTransitionResult } from "./types.js";

/**
 * Toggle time of day and handle dawn effects.
 * At dawn (Night → Day), reveal any face-down ruins tokens.
 */
export function processTimeTransition(state: GameState): TimeTransitionResult {
  const events: GameEvent[] = [];

  // Toggle day/night
  const oldTime = state.timeOfDay;
  const newTime = oldTime === TIME_OF_DAY_DAY ? TIME_OF_DAY_NIGHT : TIME_OF_DAY_DAY;

  events.push({
    type: TIME_OF_DAY_CHANGED,
    from: oldTime,
    to: newTime,
  });

  // Reveal face-down ruins tokens at dawn (Night → Day)
  let updatedHexes = state.map.hexes;
  if (newTime === TIME_OF_DAY_DAY) {
    updatedHexes = revealRuinsTokensAtDawn(state.map.hexes);
  }

  return {
    newTime,
    updatedHexes,
    events,
  };
}

/**
 * Reveal any face-down ruins tokens at dawn.
 */
function revealRuinsTokensAtDawn(
  hexes: Record<string, HexState>
): Record<string, HexState> {
  const hexEntries = Object.entries(hexes);
  let hasUnrevealedRuins = false;

  // Check if there are any unrevealed ruins tokens
  for (const [, hex] of hexEntries) {
    if (hex.ruinsToken && !hex.ruinsToken.isRevealed) {
      hasUnrevealedRuins = true;
      break;
    }
  }

  // If no unrevealed ruins, return original hexes
  if (!hasUnrevealedRuins) {
    return hexes;
  }

  // Create updated hexes with revealed ruins tokens
  const updatedHexes: Record<string, HexState> = {};
  for (const [key, hex] of hexEntries) {
    if (hex.ruinsToken && !hex.ruinsToken.isRevealed) {
      updatedHexes[key] = {
        ...hex,
        ruinsToken: revealRuinsToken(hex.ruinsToken),
      } as HexState;
    } else {
      updatedHexes[key] = hex;
    }
  }

  return updatedHexes;
}
