/**
 * Shared mana rule helpers.
 *
 * Centralizes time-of-day and dungeon/tomb overrides so validActions and
 * validators stay aligned.
 */

import type { GameState } from "../../state/GameState.js";
import type { ManaColor } from "@mage-knight/shared";
import {
  MANA_BLACK,
  MANA_GOLD,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

export interface ManaTimeRules {
  readonly blackAllowed: boolean;
  readonly goldAllowed: boolean;
}

export function getManaTimeRules(state: GameState): ManaTimeRules {
  if (state.combat?.nightManaRules) {
    // Dungeon/tomb combat: night rules regardless of time of day
    return { blackAllowed: true, goldAllowed: false };
  }

  if (state.timeOfDay === TIME_OF_DAY_DAY) {
    return { blackAllowed: false, goldAllowed: true };
  }

  return { blackAllowed: true, goldAllowed: false };
}

export function isManaColorAllowed(state: GameState, color: ManaColor): boolean {
  const rules = getManaTimeRules(state);
  if (color === MANA_BLACK) {
    return rules.blackAllowed;
  }
  if (color === MANA_GOLD) {
    return rules.goldAllowed;
  }
  return true;
}

export function canUseGoldAsWild(state: GameState): boolean {
  return getManaTimeRules(state).goldAllowed;
}
