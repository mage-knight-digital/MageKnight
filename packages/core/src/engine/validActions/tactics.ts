/**
 * Tactics options computation.
 *
 * Handles tactics-related valid actions:
 * - Tactics selection during tactics phase
 * - Tactic effect activation during player turns
 * - Pending tactic decisions (Rethink, Sparing Power, etc.)
 * - Mana Search reroll options
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TacticsOptions, TacticEffectsOptions } from "@mage-knight/shared";
import {
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_RETHINK,
  TACTIC_SPARING_POWER,
  TACTIC_MANA_STEAL,
  TACTIC_PREPARATION,
  BASIC_MANA_COLORS,
} from "@mage-knight/shared";
import {
  getTacticActivationFailureReason,
  isPendingTacticDecisionStillValid,
  canUseManaSearch,
  getManaSearchAvailableDice,
  getManaSearchRequiredFirstDiceIds,
} from "../rules/tactics.js";

/**
 * Get tactics selection options during tactics phase.
 */
export function getTacticsOptions(
  state: GameState,
  playerId: string
): TacticsOptions {
  return {
    availableTactics: state.availableTactics,
    isYourTurn: state.currentTacticSelector === playerId,
  };
}

/**
 * Get tactic effects options during player turns.
 * Returns undefined if no tactic effects are available.
 */
export function getTacticEffectsOptions(
  state: GameState,
  player: Player
): TacticEffectsOptions | undefined {
  const tactic = player.selectedTactic;
  if (!tactic) {
    return undefined;
  }

  // Check for pending tactic decisions first (these take priority)
  const pendingDecision = getPendingTacticDecision(state, player);

  // Check for activatable tactics
  const canActivate = getActivatableTactics(state, player);

  // Check for Mana Search reroll
  const canRerollSourceDice = getManaSearchOptions(state, player);

  // Return undefined if nothing is available
  if (!canActivate && !pendingDecision && !canRerollSourceDice) {
    return undefined;
  }

  const result: TacticEffectsOptions = {};
  if (canActivate) {
    (result as { canActivate: typeof canActivate }).canActivate = canActivate;
  }
  if (pendingDecision) {
    (result as { pendingDecision: typeof pendingDecision }).pendingDecision = pendingDecision;
  }
  if (canRerollSourceDice) {
    (result as { canRerollSourceDice: typeof canRerollSourceDice }).canRerollSourceDice = canRerollSourceDice;
  }

  return result;
}

/**
 * Get pending tactic decision info for the player.
 */
export function getPendingTacticDecision(
  state: GameState,
  player: Player
): TacticEffectsOptions["pendingDecision"] {
  const pending = player.pendingTacticDecision;
  if (!pending) {
    return undefined;
  }

  if (!isPendingTacticDecisionStillValid(state, player)) {
    return undefined;
  }

  // Convert to PendingTacticDecisionInfo format
  if (pending.type === TACTIC_RETHINK) {
    return {
      type: pending.type,
      maxCards: pending.maxCards,
      availableCardIds: player.hand,
    };
  }

  // Sparing Power: before-turn choice (stash or take)
  if (pending.type === TACTIC_SPARING_POWER) {
    return {
      type: pending.type,
      // Include info about whether stash is available (deck not empty)
      canStash: player.deck.length > 0,
      storedCount: player.tacticState.sparingPowerStored?.length ?? 0,
    };
  }

  // Mana Steal: choose a basic color die from source
  if (pending.type === TACTIC_MANA_STEAL) {
    const availableBasicDice = state.source.dice.filter(
      (d) =>
        d.takenByPlayerId === null &&
        !d.isDepleted &&
        BASIC_MANA_COLORS.includes(d.color as typeof BASIC_MANA_COLORS[number])
    );
    return {
      type: pending.type,
      availableDiceIds: availableBasicDice.map((d) => d.id),
    };
  }

  // Preparation: choose a card from deck
  if (pending.type === TACTIC_PREPARATION) {
    // The deckSnapshot is stored in the pending decision - this is secret info
    // Only sent to the owning player via toClientState filtering
    return {
      type: pending.type,
      deckSnapshot: pending.deckSnapshot,
    };
  }

  // Midnight Meditation: choose cards to shuffle into deck (then draw same amount)
  if (pending.type === TACTIC_MIDNIGHT_MEDITATION) {
    return {
      type: pending.type,
      maxCards: pending.maxCards,
      availableCardIds: player.hand,
    };
  }

  return undefined;
}

/**
 * Get activatable tactics that the player can use this turn.
 */
export function getActivatableTactics(
  state: GameState,
  player: Player
): TacticEffectsOptions["canActivate"] {
  const tactic = player.selectedTactic;
  if (!tactic || player.tacticFlipped) {
    return undefined;
  }

  if (getTacticActivationFailureReason(state, player, tactic) !== null) {
    return undefined;
  }

  // The Right Moment (Day 6) - can use during turn, not on last turn of round
  if (tactic === TACTIC_THE_RIGHT_MOMENT) {
    return { theRightMoment: true };
  }

  // Long Night (Night 2) - can use when deck is empty
  if (tactic === TACTIC_LONG_NIGHT) {
    return { longNight: true };
  }

  // Midnight Meditation (Night 4) - can use before taking any action
  if (tactic === TACTIC_MIDNIGHT_MEDITATION) {
    return { midnightMeditation: true };
  }

  return undefined;
}

/**
 * Get Mana Search reroll options for the player.
 * Returns undefined if Mana Search is not available.
 */
export function getManaSearchOptions(
  state: GameState,
  player: Player
): TacticEffectsOptions["canRerollSourceDice"] {
  if (!canUseManaSearch(state, player)) {
    return undefined;
  }

  const availableDice = getManaSearchAvailableDice(state, player);
  if (availableDice.length === 0) {
    return undefined;
  }

  const requiredFirstDiceIds = getManaSearchRequiredFirstDiceIds(state, player);

  return {
    maxDice: 2,
    mustPickDepletedFirst: requiredFirstDiceIds.length > 0,
    requiredFirstDiceIds,
    availableDiceIds: availableDice.map((d) => d.id),
  };
}
