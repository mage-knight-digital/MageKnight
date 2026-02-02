/**
 * Resolve Discard For Attack Command
 *
 * Handles player resolution of a pending discard-for-attack (Sword of Justice basic effect).
 * Player can discard 0 or more non-wound cards to gain Attack (attackPerCard × cards).
 *
 * Flow:
 * 1. Card played creates pendingDiscardForAttack state via EFFECT_DISCARD_FOR_ATTACK
 * 2. Player sends RESOLVE_DISCARD_FOR_ATTACK action with selected cardIds (can be empty)
 * 3. This command validates selection, moves cards to discard, clears pending state
 * 4. Adds attack to combat accumulator
 *
 * This command is reversible since it's part of normal card play flow.
 */

import type { Command, CommandResult } from "../commands.js";
import type { GameState } from "../../state/GameState.js";
import type { GameEvent, CardId, CombatType } from "@mage-knight/shared";
import {
  createCardDiscardedEvent,
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
import type { Player, AccumulatedAttack, ElementalAttackValues } from "../../types/player.js";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";

export const RESOLVE_DISCARD_FOR_ATTACK_COMMAND = "RESOLVE_DISCARD_FOR_ATTACK" as const;

export interface ResolveDiscardForAttackCommandParams {
  readonly playerId: string;
  /** Card IDs to discard. Can be empty array (discard 0 cards, gain 0 attack). */
  readonly cardIds: readonly CardId[];
}

export function createResolveDiscardForAttackCommand(
  params: ResolveDiscardForAttackCommandParams
): Command {
  // Store previous state for undo
  let previousPendingDiscardForAttack: Player["pendingDiscardForAttack"] = null;
  let previousHand: readonly CardId[] = [];
  let previousDiscard: readonly CardId[] = [];
  let previousAccumulatedAttack: AccumulatedAttack | null = null;

  return {
    type: RESOLVE_DISCARD_FOR_ATTACK_COMMAND,
    playerId: params.playerId,
    isReversible: true, // Part of normal card play flow

    execute(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!player.pendingDiscardForAttack) {
        throw new Error("No pending discard-for-attack to resolve");
      }

      const pendingState = player.pendingDiscardForAttack;

      // Store for undo
      previousPendingDiscardForAttack = pendingState;
      previousHand = player.hand;
      previousDiscard = player.discard;
      previousAccumulatedAttack = player.combatAccumulator.attack;

      const events: GameEvent[] = [];

      // Validate all cards are eligible (non-wound, in hand)
      const eligibleCards = getCardsEligibleForDiscardForAttack(player.hand);
      for (const cardId of params.cardIds) {
        if (!eligibleCards.includes(cardId)) {
          throw new Error(
            `Card ${cardId} is not eligible for discard-for-attack (must be non-wound and in hand)`
          );
        }
      }

      // Move cards from hand to discard pile
      const updatedHand = [...player.hand];
      const discardedCards: CardId[] = [];

      for (const cardId of params.cardIds) {
        const index = updatedHand.indexOf(cardId);
        if (index === -1) {
          throw new Error(`Card ${cardId} not found in hand`);
        }
        updatedHand.splice(index, 1);
        discardedCards.push(cardId);

        // Emit discard event for each card
        events.push(createCardDiscardedEvent(params.playerId, cardId));
      }

      const updatedDiscardPile = [...player.discard, ...discardedCards];

      // Calculate attack gained
      const attackGained = params.cardIds.length * pendingState.attackPerCard;

      // Add attack to combat accumulator based on combat type
      const updatedAttack = addAttackToAccumulator(
        player.combatAccumulator.attack,
        attackGained,
        pendingState.combatType
      );

      // Clear pending state and update player
      const updatedPlayer: Player = {
        ...player,
        hand: updatedHand,
        discard: updatedDiscardPile,
        pendingDiscardForAttack: null,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: updatedAttack,
        },
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? updatedPlayer : p
        ),
      };

      return {
        state: newState,
        events,
      };
    },

    undo(state: GameState): CommandResult {
      const playerIndex = state.players.findIndex(
        (p) => p.id === params.playerId
      );
      if (playerIndex === -1) {
        throw new Error("Player not found");
      }

      const player = state.players[playerIndex];
      if (!player) {
        throw new Error("Player not found at index");
      }

      if (!previousAccumulatedAttack) {
        throw new Error("Cannot undo: no previous accumulated attack stored");
      }

      // Restore previous state
      const restoredPlayer: Player = {
        ...player,
        hand: previousHand,
        discard: previousDiscard,
        pendingDiscardForAttack: previousPendingDiscardForAttack,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: previousAccumulatedAttack,
        },
      };

      const newState: GameState = {
        ...state,
        players: state.players.map((p, i) =>
          i === playerIndex ? restoredPlayer : p
        ),
      };

      return {
        state: newState,
        events: [],
      };
    },
  };
}

/**
 * Add attack to the accumulated attack based on combat type.
 * Attack is added as physical damage (no element).
 */
function addAttackToAccumulator(
  currentAttack: AccumulatedAttack,
  amount: number,
  combatType: CombatType
): AccumulatedAttack {
  if (amount === 0) {
    return currentAttack;
  }

  // Add to physical element of the appropriate attack type
  const addPhysical = (elements: ElementalAttackValues): ElementalAttackValues => ({
    ...elements,
    physical: elements.physical + amount,
  });

  switch (combatType) {
    case COMBAT_TYPE_MELEE:
      return {
        ...currentAttack,
        normal: currentAttack.normal + amount,
        normalElements: addPhysical(currentAttack.normalElements),
      };
    case COMBAT_TYPE_RANGED:
      return {
        ...currentAttack,
        ranged: currentAttack.ranged + amount,
        rangedElements: addPhysical(currentAttack.rangedElements),
      };
    case COMBAT_TYPE_SIEGE:
      return {
        ...currentAttack,
        siege: currentAttack.siege + amount,
        siegeElements: addPhysical(currentAttack.siegeElements),
      };
    default: {
      // Exhaustive check - TypeScript will error if new combat type added without handling
      const _exhaustive: never = combatType;
      throw new Error(`Unknown combat type: ${String(_exhaustive)}`);
    }
  }
}
