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
import { isRuleActive } from "../modifiers/index.js";
import { RULE_ALLOW_GOLD_AT_NIGHT, RULE_ALLOW_BLACK_AT_DAY } from "../../types/modifierConstants.js";

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

export function isManaColorAllowed(state: GameState, color: ManaColor, playerId?: string): boolean {
  const rules = getManaTimeRules(state);
  if (color === MANA_BLACK) {
    if (rules.blackAllowed) return true;
    // Amulet of Darkness: allow black mana usage at day for this player
    if (playerId && isRuleActive(state, playerId, RULE_ALLOW_BLACK_AT_DAY)) {
      return true;
    }
    return false;
  }
  if (color === MANA_GOLD) {
    if (rules.goldAllowed) return true;
    // Amulet of the Sun: allow gold mana usage at night for this player
    if (playerId && isRuleActive(state, playerId, RULE_ALLOW_GOLD_AT_NIGHT)) {
      return true;
    }
    return false;
  }
  return true;
}

export function canUseGoldAsWild(state: GameState, playerId?: string): boolean {
  const goldAllowed = getManaTimeRules(state).goldAllowed;
  if (goldAllowed) return true;
  // Amulet of the Sun: allow gold mana as wild at night for this player
  if (playerId && isRuleActive(state, playerId, RULE_ALLOW_GOLD_AT_NIGHT)) {
    return true;
  }
  return false;
}
