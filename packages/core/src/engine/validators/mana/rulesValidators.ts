/**
 * Mana usage rules validators
 *
 * Validates mana color matching and time-of-day restrictions.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, ManaSourceInfo } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import {
  PLAY_CARD_ACTION,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";
import { isRuleActive } from "../../modifiers/index.js";
import { RULE_BLACK_AS_ANY_COLOR } from "../../../types/modifierConstants.js";
import { getCard } from "../../validActions/cards/index.js";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import {
  MANA_COLOR_MISMATCH,
  BLACK_MANA_INVALID,
  BLACK_MANA_DAY,
  GOLD_MANA_NIGHT,
  GOLD_MANA_NOT_ALLOWED,
} from "../validationCodes.js";
import { isManaColorAllowed } from "../../rules/mana.js";

function getManaSources(action: PlayerAction): ManaSourceInfo[] {
  if (action.type !== PLAY_CARD_ACTION) {
    return [];
  }
  if (action.manaSources && action.manaSources.length > 0) {
    return [...action.manaSources];
  }
  if (action.manaSource) {
    return [action.manaSource];
  }
  return [];
}

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

  const card = getCard(action.cardId);
  if (!card) {
    return valid();
  }

  // Spells are validated separately (black + color requirement)
  if (card.cardType === DEED_CARD_TYPE_SPELL) {
    return valid();
  }

  const manaColor = action.manaSource.color;

  // Check if mana color is one of the card's accepted colors
  if (card.poweredBy.includes(manaColor)) {
    return valid();
  }

  // Gold mana can power any card that accepts basic mana colors
  if (manaColor === MANA_GOLD && card.poweredBy.length > 0) {
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
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered) return valid();

  const manaSources = getManaSources(action);
  if (manaSources.length === 0) return valid();

  for (const source of manaSources) {
    const manaColor = source.color;
    // Black mana cannot be used during day
    if (manaColor === MANA_BLACK && state.timeOfDay === TIME_OF_DAY_DAY) {
      return invalid(BLACK_MANA_DAY, "Black mana cannot be used during the day");
    }

    // Gold mana cannot be used at night
    if (manaColor === MANA_GOLD && !isManaColorAllowed(state, MANA_GOLD, playerId)) {
      return invalid(GOLD_MANA_NIGHT, "Gold mana cannot be used at night");
    }
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
  if (!action.powered) return valid();

  const manaSources = getManaSources(action);
  if (manaSources.length === 0) return valid();

  // Only applies when in combat with nightManaRules
  if (!state.combat?.nightManaRules) return valid();

  for (const source of manaSources) {
    if (source.color === MANA_GOLD) {
      return invalid(
        GOLD_MANA_NOT_ALLOWED,
        "Gold mana cannot be used in dungeon/tomb combat (night rules apply)"
      );
    }
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
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered) return valid();

  const manaSources = getManaSources(action);
  if (manaSources.length === 0) return valid();

  // In dungeon/tomb combat, night mana rules apply
  if (state.combat?.nightManaRules) {
    // Gold check is in validateManaDungeonTombRules
    // Black is always allowed in dungeons (that's the point)
    return valid();
  }

  const blackAsAnyColor = isRuleActive(state, playerId, RULE_BLACK_AS_ANY_COLOR);
  for (const source of manaSources) {
    if (source.color === MANA_BLACK && !isManaColorAllowed(state, MANA_BLACK) && !blackAsAnyColor) {
      return invalid(BLACK_MANA_DAY, "Black mana cannot be used during the day");
    }
    if (source.color === MANA_GOLD && !isManaColorAllowed(state, MANA_GOLD, playerId)) {
      return invalid(GOLD_MANA_NIGHT, "Gold mana cannot be used at night");
    }
  }

  return valid();
}
