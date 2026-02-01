/**
 * Non-combat ability helpers for unit ability activation
 *
 * Handles application of heal, move, and influence abilities
 * that don't contribute to the combat accumulator.
 */

import type { UnitAbilityType } from "@mage-knight/shared";
import {
  UNIT_ABILITY_HEAL,
  UNIT_ABILITY_MOVE,
  UNIT_ABILITY_INFLUENCE,
  CARD_WOUND,
} from "@mage-knight/shared";
import type { Player } from "../../../../types/player.js";

/**
 * Result of applying a non-combat ability
 */
export interface NonCombatAbilityResult {
  readonly player: Player;
  readonly woundPileCountDelta: number;
}

/**
 * Apply non-combat ability effects (move, influence, heal)
 * Returns updated player and state changes
 */
export function applyNonCombatAbility(
  player: Player,
  abilityType: UnitAbilityType,
  value: number
): NonCombatAbilityResult {
  switch (abilityType) {
    case UNIT_ABILITY_HEAL: {
      // Count wounds in hand
      const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;
      const woundsToHeal = Math.min(value, woundsInHand);

      if (woundsToHeal === 0) {
        return { player, woundPileCountDelta: 0 };
      }

      // Remove wound cards from hand
      const newHand = [...player.hand];
      for (let i = 0; i < woundsToHeal; i++) {
        const woundIndex = newHand.indexOf(CARD_WOUND);
        if (woundIndex !== -1) {
          newHand.splice(woundIndex, 1);
        }
      }

      return {
        player: { ...player, hand: newHand },
        woundPileCountDelta: woundsToHeal, // Return healed wounds to pile
      };
    }

    case UNIT_ABILITY_MOVE: {
      // Add move points
      return {
        player: {
          ...player,
          movePoints: player.movePoints + value,
        },
        woundPileCountDelta: 0,
      };
    }

    case UNIT_ABILITY_INFLUENCE: {
      // Add influence points
      return {
        player: {
          ...player,
          influencePoints: player.influencePoints + value,
        },
        woundPileCountDelta: 0,
      };
    }

    default:
      // Combat abilities handled elsewhere
      return { player, woundPileCountDelta: 0 };
  }
}
