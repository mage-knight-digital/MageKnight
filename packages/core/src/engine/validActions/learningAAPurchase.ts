/**
 * Learning card AA purchase valid actions computation.
 *
 * Computes whether the player can use a Learning card discount modifier
 * to purchase an Advanced Action from the regular offer.
 */

import type { LearningAAPurchaseOptions } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { getActiveLearningDiscount } from "../rules/unitRecruitment.js";

/**
 * Compute Learning AA purchase options, if a Learning discount modifier is active.
 * Returns undefined if no Learning discount is available.
 */
export function getLearningAAPurchaseOptions(
  state: GameState,
  player: Player,
): LearningAAPurchaseOptions | undefined {
  const discount = getActiveLearningDiscount(state, player.id);
  if (!discount) return undefined;

  const availableCards = state.offers.advancedActions.cards;
  if (availableCards.length === 0) return undefined;

  return {
    cost: discount.cost,
    destination: discount.destination,
    canAfford: player.influencePoints >= discount.cost,
    availableCards,
  };
}
