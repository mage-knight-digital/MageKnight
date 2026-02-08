/**
 * Dice Management for End Turn
 *
 * Handles rerolling used dice, returning Mana Draw dice, and Mana Steal cleanup.
 *
 * @module commands/endTurn/diceManagement
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { RngState } from "../../../utils/rng.js";
import type { SourceDieId } from "../../../types/mana.js";
import { rerollDie } from "../../mana/manaSource.js";
import type { DiceManagementResult } from "./types.js";
import { EFFECT_MANA_CLAIM_SUSTAINED, EFFECT_MANA_CURSE } from "../../../types/modifierConstants.js";
import type { ManaClaimSustainedModifier, ManaCurseModifier } from "../../../types/modifiers.js";

/**
 * Process dice at end of turn:
 * 1. Reroll dice used for powering cards
 * 2. Return Mana Draw/Pull dice without rerolling
 * 3. Handle Mana Steal stored die if used
 * 4. Clear any remaining dice taken by this player
 *
 * @param skipRerollDieIds - Die IDs to exclude from automatic reroll
 *   (e.g., Source Opening extra die that was already handled by reroll choice)
 */
export function processDiceReturn(
  state: GameState,
  player: Player,
  players: Player[],
  skipRerollDieIds?: ReadonlySet<SourceDieId>
): DiceManagementResult {
  let updatedSource = state.source;
  let currentRng = state.rng;
  const updatedPlayers = [...players];

  // Reroll dice used for powering cards (excluding any already-handled dice)
  const dieIdsToReroll = skipRerollDieIds
    ? player.usedDieIds.filter((id) => !skipRerollDieIds.has(id))
    : player.usedDieIds;
  if (dieIdsToReroll.length > 0) {
    const result = rerollUsedDice(
      updatedSource,
      dieIdsToReroll,
      state.timeOfDay,
      currentRng
    );
    updatedSource = result.source;
    currentRng = result.rng;
  }

  // Clear takenByPlayerId for skipped dice (they still need to be returned to pool)
  if (skipRerollDieIds && skipRerollDieIds.size > 0) {
    const diceWithSkippedCleared = updatedSource.dice.map((die) =>
      skipRerollDieIds.has(die.id) && die.takenByPlayerId === player.id
        ? { ...die, takenByPlayerId: null }
        : die
    );
    if (diceWithSkippedCleared.some((d, i) => d !== updatedSource.dice[i])) {
      updatedSource = { dice: diceWithSkippedCleared };
    }
  }

  // Return Mana Draw/Pull dice without rerolling
  if (player.manaDrawDieIds.length > 0) {
    updatedSource = returnManaDrawDice(updatedSource, player.manaDrawDieIds);
  }

  // Handle Mana Steal if used this turn
  if (player.tacticState.manaStealUsedThisTurn) {
    const result = handleManaStealReturn(
      updatedSource,
      player,
      updatedPlayers,
      state.timeOfDay,
      currentRng
    );
    updatedSource = result.source;
    currentRng = result.rng;
    // Update the players array with cleared tactic state
    const playerIdx = updatedPlayers.findIndex((p) => p.id === player.id);
    if (playerIdx !== -1 && result.updatedPlayer) {
      updatedPlayers[playerIdx] = result.updatedPlayer;
    }
  }

  // Clear any remaining dice taken by this player (safety net)
  // Exclude Mana Steal stored die - it persists until used or round ends
  // Exclude Mana Claim dice - they persist until end of round
  const playerAfterUpdates = updatedPlayers.find((p) => p.id === player.id);
  const storedManaStealDieId = playerAfterUpdates?.tacticState.storedManaDie?.dieId;

  // Collect Mana Claim die IDs from active modifiers
  const manaClaimDieIds = new Set<SourceDieId>();
  for (const mod of state.activeModifiers) {
    if (mod.effect.type === EFFECT_MANA_CLAIM_SUSTAINED) {
      manaClaimDieIds.add((mod.effect as ManaClaimSustainedModifier).claimedDieId);
    }
    if (mod.effect.type === EFFECT_MANA_CURSE) {
      manaClaimDieIds.add((mod.effect as ManaCurseModifier).claimedDieId);
    }
  }

  const diceWithAllCleared = updatedSource.dice.map((die) =>
    die.takenByPlayerId === player.id &&
    die.id !== storedManaStealDieId &&
    !manaClaimDieIds.has(die.id)
      ? { ...die, takenByPlayerId: null }
      : die
  );

  if (diceWithAllCleared.some((d, i) => d !== updatedSource.dice[i])) {
    updatedSource = { dice: diceWithAllCleared };
  }

  return {
    source: updatedSource,
    rng: currentRng,
    players: updatedPlayers,
  };
}

/**
 * Reroll dice that were used for powering cards.
 */
function rerollUsedDice(
  source: GameState["source"],
  usedDieIds: readonly SourceDieId[],
  timeOfDay: GameState["timeOfDay"],
  rng: RngState
): { source: GameState["source"]; rng: RngState } {
  let updatedSource = source;
  let currentRng = rng;
  const usedDieIdSet = new Set(usedDieIds);

  // Reroll each used die
  for (const dieId of usedDieIds) {
    const { source: rerolledSource, rng: newRng } = rerollDie(
      updatedSource,
      dieId,
      timeOfDay,
      currentRng
    );
    updatedSource = rerolledSource;
    currentRng = newRng;
  }

  // Clear takenByPlayerId for all used dice
  const diceWithClearedTaken = updatedSource.dice.map((die) =>
    usedDieIdSet.has(die.id) ? { ...die, takenByPlayerId: null } : die
  );
  updatedSource = { dice: diceWithClearedTaken };

  return { source: updatedSource, rng: currentRng };
}

/**
 * Return Mana Draw/Pull dice without rerolling (keep their set colors).
 */
function returnManaDrawDice(
  source: GameState["source"],
  manaDrawDieIds: readonly SourceDieId[]
): GameState["source"] {
  const manaDrawDieIdSet = new Set(manaDrawDieIds);
  const diceWithManaDrawCleared = source.dice.map((die) =>
    manaDrawDieIdSet.has(die.id) ? { ...die, takenByPlayerId: null } : die
  );
  return { dice: diceWithManaDrawCleared };
}

/**
 * Handle Mana Steal stored die - reroll and return if used this turn.
 */
function handleManaStealReturn(
  source: GameState["source"],
  player: Player,
  players: Player[],
  timeOfDay: GameState["timeOfDay"],
  rng: RngState
): { source: GameState["source"]; rng: RngState; updatedPlayer: Player | null } {
  const storedDie = player.tacticState.storedManaDie;
  if (!storedDie) {
    return { source, rng, updatedPlayer: null };
  }

  // Reroll the die and return it to source
  const { source: rerolledSource, rng: newRng } = rerollDie(
    source,
    storedDie.dieId,
    timeOfDay,
    rng
  );

  // Clear the takenByPlayerId on the die
  const diceWithStolenCleared = rerolledSource.dice.map((die) =>
    die.id === storedDie.dieId ? { ...die, takenByPlayerId: null } : die
  );

  // Clear the stored die from the player
  // Destructure to omit storedManaDie
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { storedManaDie: _, ...restTacticState } = player.tacticState;
  const updatedPlayer: Player = {
    ...player,
    tacticState: {
      ...restTacticState,
      manaStealUsedThisTurn: false,
    },
  };

  return {
    source: { dice: diceWithStolenCleared },
    rng: newRng,
    updatedPlayer,
  };
}
