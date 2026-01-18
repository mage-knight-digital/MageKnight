/**
 * Mana usage rules validators
 *
 * Validates mana color matching and time-of-day restrictions.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, BasicActionCardId } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  PLAY_CARD_ACTION,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { getBasicActionCard, BASIC_ACTION_CARDS } from "../../../data/basicActions/index.js";
import {
  MANA_COLOR_MISMATCH,
  BLACK_MANA_INVALID,
  BLACK_MANA_DAY,
  GOLD_MANA_NIGHT,
  GOLD_MANA_NOT_ALLOWED,
} from "../validationCodes.js";

/**
 * Validate mana color matches card's poweredBy colors (or is gold during day)
 */
export function validateManaColorMatch(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered || !action.manaSource) return valid();

  // Check if card exists first
  if (!(action.cardId in BASIC_ACTION_CARDS)) {
    // Let validateCardExists handle this
    return valid();
  }

  const card = getBasicActionCard(action.cardId as BasicActionCardId);
  const manaColor = action.manaSource.color;

  // Check if mana color is one of the card's accepted colors
  if (card.poweredBy.includes(manaColor)) {
    return valid();
  }

  // Gold mana during day can power any card that accepts basic mana colors
  if (manaColor === MANA_GOLD && state.timeOfDay === TIME_OF_DAY_DAY && card.poweredBy.length > 0) {
    return valid();
  }

  // Black mana cannot power action cards (only spell strong effects)
  if (manaColor === MANA_BLACK) {
    return invalid(
      BLACK_MANA_INVALID,
      "Black mana cannot power action cards"
    );
  }

  // Build error message showing accepted colors
  const acceptedColors = card.poweredBy.length > 0
    ? card.poweredBy.join(", ")
    : "none (cannot be powered)";

  return invalid(
    MANA_COLOR_MISMATCH,
    `${manaColor} mana cannot power this card. Accepted: ${acceptedColors}`
  );
}

/**
 * Validate time-of-day restrictions for mana usage
 */
export function validateManaTimeOfDay(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered || !action.manaSource) return valid();

  const manaColor = action.manaSource.color;

  // Black mana cannot be used during day
  if (manaColor === MANA_BLACK && state.timeOfDay === TIME_OF_DAY_DAY) {
    return invalid(BLACK_MANA_DAY, "Black mana cannot be used during the day");
  }

  // Gold mana cannot be used at night
  if (manaColor === MANA_GOLD && state.timeOfDay !== TIME_OF_DAY_DAY) {
    return invalid(GOLD_MANA_NIGHT, "Gold mana cannot be used at night");
  }

  return valid();
}

/**
 * Validate mana usage in dungeon/tomb combat (night mana rules)
 *
 * Dungeons and Tombs use night mana rules regardless of actual time of day:
 * - Gold mana cannot be used
 * - Black mana CAN be used (even during day normally)
 *
 * This replaces the normal time-of-day check when in dungeon/tomb combat.
 */
export function validateManaDungeonTombRules(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered || !action.manaSource) return valid();

  // Only applies when in combat with nightManaRules
  if (!state.combat?.nightManaRules) return valid();

  const manaColor = action.manaSource.color;

  // Gold mana cannot be used in dungeon/tomb (night rules)
  if (manaColor === MANA_GOLD) {
    return invalid(
      GOLD_MANA_NOT_ALLOWED,
      "Gold mana cannot be used in dungeon/tomb combat (night rules apply)"
    );
  }

  return valid();
}

/**
 * Override normal time-of-day validation in dungeon/tomb
 *
 * When in dungeon/tomb combat (nightManaRules = true), black mana IS allowed
 * even if it's actually daytime outside. This validator modifies the standard
 * time-of-day check.
 */
export function validateManaTimeOfDayWithDungeonOverride(
  state: GameState,
  _playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered || !action.manaSource) return valid();

  const manaColor = action.manaSource.color;

  // In dungeon/tomb combat, night mana rules apply
  if (state.combat?.nightManaRules) {
    // Gold check is in validateManaDungeonTombRules
    // Black is always allowed in dungeons (that's the point)
    // Other colors follow normal rules
    if (manaColor === MANA_BLACK) {
      return valid(); // Black is ALLOWED in dungeons
    }
    // Non-gold/black colors are always allowed
    return valid();
  }

  // Outside dungeon/tomb combat, use normal time-of-day rules
  // Black mana cannot be used during day
  if (manaColor === MANA_BLACK && state.timeOfDay === TIME_OF_DAY_DAY) {
    return invalid(BLACK_MANA_DAY, "Black mana cannot be used during the day");
  }

  // Gold mana cannot be used at night
  if (manaColor === MANA_GOLD && state.timeOfDay === TIME_OF_DAY_NIGHT) {
    return invalid(GOLD_MANA_NIGHT, "Gold mana cannot be used at night");
  }

  return valid();
}
