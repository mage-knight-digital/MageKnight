/**
 * Mana Reset for End Round
 *
 * Resets the mana source by rerolling all dice for the new round.
 *
 * @module commands/endRound/manaReset
 */

import type { GameState } from "../../../state/GameState.js";
import type { GameEvent } from "@mage-knight/shared";
import { MANA_SOURCE_RESET } from "@mage-knight/shared";
import type { RngState } from "../../../utils/rng.js";
import { createManaSource } from "../../mana/manaSource.js";
import type { ManaResetResult } from "./types.js";

/**
 * Reset the mana source for the new round.
 * Creates a fresh mana source with rerolled dice based on player count and time of day.
 */
export function processManaReset(
  playerCount: number,
  newTime: GameState["timeOfDay"],
  rng: RngState
): ManaResetResult {
  const events: GameEvent[] = [];

  const { source: newSource, rng: rngAfterSource } = createManaSource(
    playerCount,
    newTime,
    rng
  );

  events.push({
    type: MANA_SOURCE_RESET,
    diceCount: newSource.dice.length,
  });

  return {
    source: newSource,
    rng: rngAfterSource,
    events,
  };
}
