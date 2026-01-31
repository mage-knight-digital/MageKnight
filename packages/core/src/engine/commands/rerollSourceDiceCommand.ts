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

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { SourceDieId } from "../../types/mana.js";
import type { GameEvent } from "@mage-knight/shared";
import {
  INVALID_ACTION,
  SOURCE_DICE_REROLLED,
  TACTIC_MANA_SEARCH,
  MANA_GOLD,
} from "@mage-knight/shared";
import { rerollDie } from "../mana/manaSource.js";
import { REROLL_SOURCE_DICE_COMMAND } from "./commandTypes.js";
import { getPlayerById } from "../helpers/playerHelpers.js";

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

  // Must have Mana Search tactic
  if (player.selectedTactic !== TACTIC_MANA_SEARCH) {
    return "Must have Mana Search tactic to reroll source dice";
  }

  // Cannot use if already used this turn
  if (player.tacticState?.manaSearchUsedThisTurn) {
    return "Mana Search already used this turn";
  }

  // Cannot use after taking mana from source
  if (player.usedManaFromSource) {
    return "Cannot use Mana Search after taking mana from source";
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

  // Must pick gold/depleted dice first if available
  const restrictedDice = state.source.dice.filter(
    (d) =>
      (d.isDepleted || d.color === MANA_GOLD) &&
      (d.takenByPlayerId === null || d.takenByPlayerId === playerId)
  );

  if (restrictedDice.length > 0 && dieIds.length < restrictedDice.length) {
    // If there are restricted dice and we're selecting fewer than all of them,
    // all selected must be from the restricted set
    const allSelectedAreRestricted = dieIds.every((id) =>
      restrictedDice.some((d) => d.id === id)
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
