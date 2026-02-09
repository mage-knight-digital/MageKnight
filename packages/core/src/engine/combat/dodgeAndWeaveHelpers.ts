/**
 * Dodge and Weave conditional attack bonus handling.
 *
 * When transitioning to Attack phase, checks for active Dodge and Weave
 * modifiers and grants physical attack bonus if no wounds were added
 * to the hero's hand during this combat.
 *
 * The modifier is consumed (removed) after evaluation regardless of
 * whether the bonus was granted.
 */

import type { GameState } from "../../state/GameState.js";
import type { DodgeAndWeaveAttackBonusModifier } from "../../types/modifiers.js";
import { EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS, ELEMENT_PHYSICAL } from "../../types/modifierConstants.js";
import { getModifiersForPlayer } from "../modifiers/queries.js";
import { removeModifier } from "../modifiers/lifecycle.js";

/**
 * Apply Dodge and Weave conditional attack bonuses when entering Attack phase.
 *
 * For each active Dodge and Weave modifier:
 * - If no wounds were added to hand this combat: grant physical attack
 * - Remove the modifier (consumed regardless)
 *
 * @param state - Current game state (during phase transition to Attack)
 * @param playerId - Player who played Dodge and Weave
 * @returns Updated state with attack bonus applied (if applicable)
 */
export function applyDodgeAndWeaveAttackBonus(
  state: GameState,
  playerId: string
): GameState {
  if (!state.combat) return state;

  const modifiers = getModifiersForPlayer(state, playerId);
  const dodgeAndWeaveMods = modifiers.filter(
    (m) => m.effect.type === EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS
  );

  if (dodgeAndWeaveMods.length === 0) return state;

  let currentState = state;

  for (const mod of dodgeAndWeaveMods) {
    const effect = mod.effect as DodgeAndWeaveAttackBonusModifier;

    // Remove the modifier (consumed after evaluation)
    currentState = removeModifier(currentState, mod.id);

    // Only grant bonus if no wounds were added to hand this combat
    if (currentState.combat && !currentState.combat.woundsAddedToHandThisCombat) {
      const playerIndex = currentState.players.findIndex((p) => p.id === playerId);
      if (playerIndex === -1) continue;

      const player = currentState.players[playerIndex]!;
      const updatedPlayers = [...currentState.players];
      updatedPlayers[playerIndex] = {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          attack: {
            ...player.combatAccumulator.attack,
            normal: player.combatAccumulator.attack.normal + effect.amount,
            normalElements: {
              ...player.combatAccumulator.attack.normalElements,
              [ELEMENT_PHYSICAL]:
                player.combatAccumulator.attack.normalElements.physical + effect.amount,
            },
          },
        },
      };

      currentState = { ...currentState, players: updatedPlayers };
    }
  }

  return currentState;
}
