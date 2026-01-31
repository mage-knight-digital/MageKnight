/**
 * Condition evaluator for conditional card effects
 *
 * Evaluates EffectCondition against the current game state to determine
 * which branch of a ConditionalEffect should be executed.
 */

import type { GameState } from "../../state/GameState.js";
import type { EffectCondition } from "../../types/conditions.js";
import {
  CONDITION_IN_PHASE,
  CONDITION_TIME_OF_DAY,
  CONDITION_ON_TERRAIN,
  CONDITION_IN_COMBAT,
  CONDITION_BLOCKED_SUCCESSFULLY,
  CONDITION_ENEMY_DEFEATED_THIS_COMBAT,
  CONDITION_MANA_USED_THIS_TURN,
  CONDITION_HAS_WOUNDS_IN_HAND,
  CONDITION_NO_UNIT_RECRUITED_THIS_TURN,
  CONDITION_LOWEST_FAME,
  CONDITION_IS_NIGHT_OR_UNDERGROUND,
} from "../../types/conditions.js";
import { CARD_WOUND, hexKey, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { getPlayerById } from "../helpers/playerHelpers.js";

/**
 * Evaluates a condition against the current game state for a specific player.
 *
 * @param state - The current game state
 * @param playerId - The player to evaluate the condition for
 * @param condition - The condition to evaluate
 * @returns true if the condition is met, false otherwise
 */
export function evaluateCondition(
  state: GameState,
  playerId: string,
  condition: EffectCondition
): boolean {
  const player = getPlayerById(state, playerId);
  if (!player) return false;

  switch (condition.type) {
    case CONDITION_TIME_OF_DAY:
      return state.timeOfDay === condition.time;

    case CONDITION_IN_COMBAT:
      return state.combat !== null;

    case CONDITION_IN_PHASE:
      if (!state.combat) return false;
      return condition.phases.includes(state.combat.phase);

    case CONDITION_ON_TERRAIN: {
      if (!player.position) return false;
      const hex = state.map.hexes[hexKey(player.position)];
      if (!hex) return false;
      // Support both single terrain and array of terrains (OR logic)
      if (Array.isArray(condition.terrain)) {
        return condition.terrain.includes(hex.terrain);
      }
      return hex.terrain === condition.terrain;
    }

    case CONDITION_BLOCKED_SUCCESSFULLY:
      return state.combat?.allDamageBlockedThisPhase ?? false;

    case CONDITION_ENEMY_DEFEATED_THIS_COMBAT:
      if (!state.combat) return false;
      return state.combat.enemies.some((e) => e.isDefeated);

    case CONDITION_MANA_USED_THIS_TURN:
      if (condition.color) {
        return player.manaUsedThisTurn?.includes(condition.color) ?? false;
      }
      return (player.manaUsedThisTurn?.length ?? 0) > 0;

    case CONDITION_HAS_WOUNDS_IN_HAND:
      return player.hand.some((c) => c === CARD_WOUND);

    case CONDITION_NO_UNIT_RECRUITED_THIS_TURN:
      return !player.hasRecruitedUnitThisTurn;

    case CONDITION_LOWEST_FAME: {
      // Check if this player has the lowest (or tied for lowest) fame
      const playerFame = player.fame;
      const minFame = Math.min(...state.players.map((p) => p.fame));
      return playerFame <= minFame;
    }

    case CONDITION_IS_NIGHT_OR_UNDERGROUND:
      // True if it's night OR in dungeon/tomb combat (nightManaRules applies)
      // Per FAQ S1: Dungeons and Tombs count as "night" for this condition
      return state.timeOfDay === TIME_OF_DAY_NIGHT || (state.combat?.nightManaRules ?? false);

    default:
      // Exhaustive check - TypeScript ensures all cases are handled
      return false;
  }
}
