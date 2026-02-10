/**
 * Reroll Source Dice command - handles Mana Search tactic effect
 *
 * Mana Search (Night 3) allows rerolling up to 2 source dice once per turn.
 * Restrictions:
 * - Must have Mana Search tactic selected
 * - Can only use once per turn
 * - Cannot use after taking mana from source this turn
 * - Must pick gold/depleted dice first if available
 */

import type { Command, CommandResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  INVALID_ACTION,
  SOURCE_DICE_REROLLED,
} from "@mage-knight/shared";
import { rerollDie } from "../mana/manaSource.js";
import { REROLL_SOURCE_DICE_COMMAND } from "./commandTypes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  canUseManaSearch,
  getManaSearchRequiredFirstDiceIds,
} from "../rules/tactics.js";

export { REROLL_SOURCE_DICE_COMMAND };

export interface RerollSourceDiceCommandArgs {
  readonly playerId: string;
  readonly dieIds: readonly string[];
}

/**
 * Validate the reroll action
 */
function validateReroll(
  state: GameState,
  playerId: string,
  dieIds: readonly string[]
): string | null {
  const player = getPlayerById(state, playerId);
  if (!player) {
    return "Player not found";
  }

  if (!canUseManaSearch(state, player)) {
    return "Mana Search cannot be used right now";
  }

  // Must select 1-2 dice
  if (dieIds.length === 0) {
    return "Must select at least one die to reroll";
  }
  if (dieIds.length > 2) {
    return "Cannot reroll more than 2 dice";
  }

  // All selected dice must exist and not be taken by another player
  for (const dieId of dieIds) {
    const die = state.source.dice.find((d) => d.id === dieId);
    if (!die) {
      return `Die ${dieId} not found in source`;
    }
    if (die.takenByPlayerId !== null && die.takenByPlayerId !== playerId) {
      return `Die ${dieId} is taken by another player`;
    }
  }

  // Must pick required-first dice (gold/depleted) first when present
  const requiredFirstDiceIds = getManaSearchRequiredFirstDiceIds(state, player);

  if (requiredFirstDiceIds.length > 0 && dieIds.length < requiredFirstDiceIds.length) {
    const allSelectedAreRestricted = dieIds.every((id) =>
      requiredFirstDiceIds.includes(id)
    );
    if (!allSelectedAreRestricted) {
      return "Must reroll gold or depleted dice first";
    }
  }

  return null;
}

export function createRerollSourceDiceCommand(
  args: RerollSourceDiceCommandArgs
): Command {
  const { playerId, dieIds } = args;

  return {
    type: REROLL_SOURCE_DICE_COMMAND,
    playerId,
    isReversible: false, // Cannot undo dice rerolls (random outcome)

    execute(state: GameState): CommandResult {
      const events: GameEvent[] = [];

      // Validate
      const error = validateReroll(state, playerId, dieIds);
      if (error) {
        events.push({
          type: INVALID_ACTION,
          playerId,
          actionType: REROLL_SOURCE_DICE_COMMAND,
          reason: error,
        });
        return { state, events };
      }

      // Find the player
      const player = getPlayerById(state, playerId);
      if (!player) {
        return { state, events };
      }

      // Reroll each selected die
      let updatedSource = state.source;
      let currentRng = state.rng;

      for (const dieId of dieIds) {
        const { source: rerolledSource, rng: newRng } = rerollDie(
          updatedSource,
          dieId as SourceDieId,
          state.timeOfDay,
          currentRng
        );
        updatedSource = rerolledSource;
        currentRng = newRng;
      }

      // Mark Mana Search as used this turn
      const updatedPlayers = state.players.map((p) =>
        p.id === playerId
          ? ({
              ...p,
              tacticState: {
                ...p.tacticState,
                manaSearchUsedThisTurn: true,
              },
            } as Player)
          : p
      );

      // Emit reroll event
      events.push({
        type: SOURCE_DICE_REROLLED,
        playerId,
        dieIds,
      });

      return {
        state: {
          ...state,
          source: updatedSource,
          players: updatedPlayers,
          rng: currentRng,
        },
        events,
      };
    },

    undo(_state: GameState): CommandResult {
      throw new Error("Cannot undo REROLL_SOURCE_DICE");
    },
  };
}
