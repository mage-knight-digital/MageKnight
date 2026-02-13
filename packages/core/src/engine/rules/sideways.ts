/**
 * Shared sideways-play rules.
 *
 * Used by both validators and ValidActions computation to prevent drift.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CombatPhase } from "../../types/combat.js";
import type { SidewaysOption } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { isInfluenceUseful } from "./influenceUsefulness.js";

export type SidewaysChoice =
  | typeof PLAY_SIDEWAYS_AS_MOVE
  | typeof PLAY_SIDEWAYS_AS_INFLUENCE
  | typeof PLAY_SIDEWAYS_AS_ATTACK
  | typeof PLAY_SIDEWAYS_AS_BLOCK;

export interface SidewaysContext {
  readonly inCombat: boolean;
  readonly phase?: CombatPhase;
  readonly hasRestedThisTurn?: boolean;
  readonly influenceUseful?: boolean;
}

export function getSidewaysContext(
  state: GameState,
  player: Player
): SidewaysContext {
  if (!state.combat) {
    const useful = isInfluenceUseful(state, player);
    return {
      inCombat: false,
      hasRestedThisTurn: player.hasRestedThisTurn,
      influenceUseful: useful,
    };
  }

  return { inCombat: true, phase: state.combat.phase };
}

export function getAllowedSidewaysChoices(
  context: SidewaysContext
): readonly SidewaysChoice[] {
  if (!context.inCombat) {
    if (context.hasRestedThisTurn) {
      if (context.influenceUseful) {
        return [PLAY_SIDEWAYS_AS_INFLUENCE];
      }
      return [];
    }
    const choices: SidewaysChoice[] = [PLAY_SIDEWAYS_AS_MOVE];
    if (context.influenceUseful) {
      choices.push(PLAY_SIDEWAYS_AS_INFLUENCE);
    }
    return choices;
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
  player: Player
): boolean {
  if (player.isResting) {
    return false;
  }

  return (
    getAllowedSidewaysChoices(getSidewaysContext(state, player)).length > 0
  );
}
