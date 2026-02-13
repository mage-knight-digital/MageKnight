/**
 * Shared sideways-play rules.
 *
 * Used by both validators and ValidActions computation to prevent drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { CombatPhase } from "../../types/combat.js";
import type { CardId, SidewaysOption } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  CARD_KRANG_RUTHLESS_COERCION,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";

export type SidewaysChoice =
  | typeof PLAY_SIDEWAYS_AS_MOVE
  | typeof PLAY_SIDEWAYS_AS_INFLUENCE
  | typeof PLAY_SIDEWAYS_AS_ATTACK
  | typeof PLAY_SIDEWAYS_AS_BLOCK;

export interface SidewaysContext {
  readonly inCombat: boolean;
  readonly phase?: CombatPhase;
  readonly hasRestedThisTurn?: boolean;
  readonly hasInfluenceConsumer?: boolean;
}

/**
 * Whether the player's hand contains a card that can consume influence
 * after rest (when site interaction is blocked). Currently only
 * Ruthless Coercion qualifies (its powered effect readies units for influence).
 */
export function hasInfluenceConsumerInHand(
  hand: readonly CardId[]
): boolean {
  return hand.includes(CARD_KRANG_RUTHLESS_COERCION as CardId);
}

export function getSidewaysContext(
  state: GameState,
  hasRestedThisTurn = false,
  hand: readonly CardId[] = []
): SidewaysContext {
  if (!state.combat) {
    return {
      inCombat: false,
      hasRestedThisTurn,
      hasInfluenceConsumer: hasRestedThisTurn
        ? hasInfluenceConsumerInHand(hand)
        : undefined,
    };
  }

  return { inCombat: true, phase: state.combat.phase };
}

export function getAllowedSidewaysChoices(
  context: SidewaysContext
): readonly SidewaysChoice[] {
  if (!context.inCombat) {
    if (context.hasRestedThisTurn) {
      if (context.hasInfluenceConsumer) {
        return [PLAY_SIDEWAYS_AS_INFLUENCE];
      }
      return [];
    }
    return [
      PLAY_SIDEWAYS_AS_MOVE,
      PLAY_SIDEWAYS_AS_INFLUENCE,
    ];
  }

  switch (context.phase) {
    case COMBAT_PHASE_BLOCK:
      return [PLAY_SIDEWAYS_AS_BLOCK];
    case COMBAT_PHASE_ATTACK:
      return [PLAY_SIDEWAYS_AS_ATTACK];
    default:
      return [];
  }
}

export function getSidewaysOptionsForValue(
  sidewaysValue: number,
  context: SidewaysContext
): readonly SidewaysOption[] {
  if (sidewaysValue <= 0) {
    return [];
  }

  const choices = getAllowedSidewaysChoices(context);
  return choices.map((as) => ({ as, value: sidewaysValue }));
}

/**
 * Shared legality check for sideways play.
 *
 * While resting, sideways play is disallowed. Otherwise legality is based on
 * whether the current phase allows any sideways choice.
 */
export function canPlaySideways(
  state: GameState,
  isResting: boolean,
  hasRestedThisTurn = false,
  hand: readonly CardId[] = []
): boolean {
  if (isResting) {
    return false;
  }

  return (
    getAllowedSidewaysChoices(
      getSidewaysContext(state, hasRestedThisTurn, hand)
    ).length > 0
  );
}
