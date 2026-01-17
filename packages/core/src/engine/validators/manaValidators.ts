/**
 * Validators for mana powering of cards
 *
 * Validates that:
 * - Mana source is available (die, crystal, or token)
 * - Mana color matches card color (or gold during day)
 * - Time of day restrictions are respected
 */

import type { GameState } from "../../state/GameState.js";
import type { PlayerAction, BasicActionCardId, BasicManaColor } from "@mage-knight/shared";
import type { ValidationResult } from "./types.js";
import { valid, invalid } from "./types.js";
import {
  PLAY_CARD_ACTION,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import { getBasicActionCard, BASIC_ACTION_CARDS } from "../../data/basicActions/index.js";
import { getCard } from "../validActions/cards.js";
import { getAvailableManaSourcesForColor } from "../validActions/mana.js";
import { DEED_CARD_TYPE_SPELL } from "../../types/cards.js";
import { isRuleActive } from "../modifiers.js";
import { RULE_EXTRA_SOURCE_DIE, RULE_BLACK_AS_ANY_COLOR } from "../../types/modifierConstants.js";
import {
  DIE_ALREADY_USED,
  DIE_NOT_FOUND,
  DIE_DEPLETED,
  DIE_COLOR_MISMATCH,
  DIE_TAKEN,
  NO_CRYSTAL,
  NO_MANA_TOKEN,
  INVALID_MANA_SOURCE,
  MANA_COLOR_MISMATCH,
  BLACK_MANA_INVALID,
  BLACK_MANA_DAY,
  GOLD_MANA_NIGHT,
  POWERED_WITHOUT_MANA,
  PLAYER_NOT_FOUND,
  GOLD_MANA_NOT_ALLOWED,
  SPELL_REQUIRES_TWO_MANA,
  SPELL_BASIC_REQUIRES_MANA,
} from "./validationCodes.js";

/**
 * Validate that mana source is available and valid
 */
export function validateManaAvailable(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();

  // If not powered, no mana needed
  if (!action.powered) return valid();

  // If powered but no mana source specified, that's an error
  // Spells use manaSources (plural), action cards use manaSource (singular)
  if (!action.manaSource && !action.manaSources) {
    return invalid(POWERED_WITHOUT_MANA, "Powered play requires a mana source");
  }

  // If spell with manaSources, let validateSpellManaRequirement handle it
  if (action.manaSources) {
    return valid();
  }

  // At this point, manaSource must exist (checked above)
  if (!action.manaSource) {
    return valid(); // Shouldn't happen, but satisfy TypeScript
  }

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  const { type: sourceType, color, dieId } = action.manaSource;

  switch (sourceType) {
    case MANA_SOURCE_DIE: {
      // Check if this is the Mana Steal stored die
      const storedDie = player.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === dieId) {
        // Validate Mana Steal die
        if (player.tacticState.manaStealUsedThisTurn) {
          return invalid(
            DIE_ALREADY_USED,
            "You have already used the stolen mana die this turn"
          );
        }
        // Check color match for the stolen die
        if (storedDie.color !== color) {
          return invalid(
            DIE_COLOR_MISMATCH,
            `Stolen die shows ${storedDie.color}, not ${color}`
          );
        }
        return valid();
      }

      // Check player hasn't used a die this turn (unless they have extra source die modifier)
      const hasExtraSourceDie = isRuleActive(state, playerId, RULE_EXTRA_SOURCE_DIE);
      if (player.usedManaFromSource && !hasExtraSourceDie) {
        return invalid(
          DIE_ALREADY_USED,
          "You can only use one mana die from the Source per turn"
        );
      }

      // Check die exists and isn't depleted
      const die = state.source.dice.find((d) => d.id === dieId);
      if (!die) {
        return invalid(DIE_NOT_FOUND, "Mana die not found in Source");
      }
      if (die.isDepleted) {
        return invalid(DIE_DEPLETED, "That mana die is depleted");
      }
      // Check die isn't taken by another player
      if (die.takenByPlayerId !== null && die.takenByPlayerId !== playerId) {
        return invalid(
          DIE_TAKEN,
          "That mana die is already taken by another player"
        );
      }
      // Check die color match
      // Special case: If black die and RULE_BLACK_AS_ANY_COLOR is active,
      // the black die can produce mana of ANY color (from Mana Pull)
      if (die.color !== color) {
        const blackAsAnyColor = isRuleActive(state, playerId, RULE_BLACK_AS_ANY_COLOR);

        if (die.color === MANA_BLACK && blackAsAnyColor) {
          // Black die can be used as ANY color with Mana Pull (including gold!)
          return valid();
        }

        return invalid(
          DIE_COLOR_MISMATCH,
          `Die shows ${die.color}, not ${color}`
        );
      }
      return valid();
    }

    case MANA_SOURCE_CRYSTAL: {
      // Crystals can only be basic colors
      if (color === MANA_GOLD || color === MANA_BLACK) {
        return invalid(NO_CRYSTAL, `${color} crystals do not exist`);
      }

      // Check player has crystal of that color
      const basicColor = color as BasicManaColor;
      const crystalCount = player.crystals[basicColor];
      if (crystalCount === undefined || crystalCount <= 0) {
        return invalid(NO_CRYSTAL, `You have no ${color} crystals`);
      }
      return valid();
    }

    case MANA_SOURCE_TOKEN: {
      // Check player has mana token of that color in play area
      const hasToken = player.pureMana.some((t) => t.color === color);
      if (!hasToken) {
        return invalid(NO_MANA_TOKEN, `You have no ${color} mana token`);
      }
      return valid();
    }

    default:
      return invalid(INVALID_MANA_SOURCE, "Invalid mana source type");
  }
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

/**
 * Validate that spells provide both mana sources (black + color) when powered.
 *
 * Spells require TWO mana to power:
 * - Black mana (available at night or in dungeons/tombs)
 * - The spell's color mana (red, blue, green, or white)
 *
 * Action cards only need ONE mana, so this only applies to spells.
 */
export function validateSpellManaRequirement(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();
  if (!action.powered) return valid();

  // Get the card to check if it's a spell
  const card = getCard(action.cardId);
  if (!card) return valid(); // Let other validators handle missing card

  // Only spells require two mana sources
  if (card.cardType !== DEED_CARD_TYPE_SPELL) return valid();

  // Spells require manaSources array with both black and color mana
  // If using single manaSource, reject for spells
  if (action.manaSource && !action.manaSources) {
    return invalid(
      SPELL_REQUIRES_TWO_MANA,
      "Spells require two mana sources: black mana + the spell's color"
    );
  }

  // Spells MUST have manaSources
  if (!action.manaSources) {
    return invalid(
      SPELL_REQUIRES_TWO_MANA,
      "Spells require two mana sources: black mana + the spell's color"
    );
  }

  // Validate exactly 2 sources
  if (action.manaSources.length !== 2) {
    return invalid(
      SPELL_REQUIRES_TWO_MANA,
      "Spells require exactly two mana sources: black mana + the spell's color"
    );
  }

  // Validate one is black and one matches the spell's color
  const hasBlack = action.manaSources.some((s) => s.color === MANA_BLACK);
  const spellColor = card.poweredBy.find((c) => c !== MANA_BLACK);
  const hasSpellColor = spellColor && action.manaSources.some((s) => s.color === spellColor);

  if (!hasBlack) {
    return invalid(
      SPELL_REQUIRES_TWO_MANA,
      "Spells require black mana as one of the two mana sources"
    );
  }

  if (!hasSpellColor) {
    return invalid(
      SPELL_REQUIRES_TWO_MANA,
      `This spell requires ${spellColor} mana as one of the two mana sources`
    );
  }

  // Now validate each mana source is available
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  for (const source of action.manaSources) {
    const result = validateSingleManaSource(state, player, source, playerId);
    if (!result.valid) {
      return result;
    }
  }

  return valid();
}

/**
 * Helper to validate a single mana source is available
 */
function validateSingleManaSource(
  state: GameState,
  player: import("../../types/player.js").Player,
  source: import("@mage-knight/shared").ManaSourceInfo,
  playerId: string
): ValidationResult {
  const { type: sourceType, color, dieId } = source;

  switch (sourceType) {
    case MANA_SOURCE_DIE: {
      // Check if this is the Mana Steal stored die
      const storedDie = player.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === dieId) {
        if (player.tacticState.manaStealUsedThisTurn) {
          return invalid(
            DIE_ALREADY_USED,
            "You have already used the stolen mana die this turn"
          );
        }
        if (storedDie.color !== color) {
          return invalid(
            DIE_COLOR_MISMATCH,
            `Stolen die shows ${storedDie.color}, not ${color}`
          );
        }
        return valid();
      }

      // Check player hasn't used a die this turn (unless they have extra source die modifier)
      const hasExtraSourceDie = isRuleActive(state, playerId, RULE_EXTRA_SOURCE_DIE);
      if (player.usedManaFromSource && !hasExtraSourceDie) {
        return invalid(
          DIE_ALREADY_USED,
          "You can only use one mana die from the Source per turn"
        );
      }

      // Check die exists and isn't depleted
      const die = state.source.dice.find((d) => d.id === dieId);
      if (!die) {
        return invalid(DIE_NOT_FOUND, "Mana die not found in Source");
      }
      if (die.isDepleted) {
        return invalid(DIE_DEPLETED, "That mana die is depleted");
      }
      if (die.takenByPlayerId !== null && die.takenByPlayerId !== playerId) {
        return invalid(
          DIE_TAKEN,
          "That mana die is already taken by another player"
        );
      }
      if (die.color !== color) {
        const blackAsAnyColor = isRuleActive(state, playerId, RULE_BLACK_AS_ANY_COLOR);
        if (die.color === MANA_BLACK && blackAsAnyColor) {
          return valid();
        }
        return invalid(
          DIE_COLOR_MISMATCH,
          `Die shows ${die.color}, not ${color}`
        );
      }
      return valid();
    }

    case MANA_SOURCE_CRYSTAL: {
      if (color === MANA_GOLD || color === MANA_BLACK) {
        return invalid(NO_CRYSTAL, `${color} crystals do not exist`);
      }
      const basicColor = color as BasicManaColor;
      const crystalCount = player.crystals[basicColor];
      if (crystalCount === undefined || crystalCount <= 0) {
        return invalid(NO_CRYSTAL, `You have no ${color} crystals`);
      }
      return valid();
    }

    case MANA_SOURCE_TOKEN: {
      const hasToken = player.pureMana.some((t) => t.color === color);
      if (!hasToken) {
        return invalid(NO_MANA_TOKEN, `You have no ${color} mana token`);
      }
      return valid();
    }

    default:
      return invalid(INVALID_MANA_SOURCE, "Invalid mana source type");
  }
}

/**
 * Validate that spell basic effects also require mana.
 *
 * Unlike action cards where basic effects are free, spells ALWAYS require mana:
 * - Basic effect: requires the spell's color mana (one mana)
 * - Powered effect: requires black + the spell's color (two mana)
 *
 * This validator checks that non-powered spell plays provide a mana source.
 */
export function validateSpellBasicManaRequirement(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  if (action.type !== PLAY_CARD_ACTION) return valid();

  // Only applies to non-powered plays
  if (action.powered) return valid();

  // Get the card to check if it's a spell
  const card = getCard(action.cardId);
  if (!card) return valid(); // Let other validators handle missing card

  // Only spells require mana for basic effect
  if (card.cardType !== DEED_CARD_TYPE_SPELL) return valid();

  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return invalid(PLAYER_NOT_FOUND, "Player not found");
  }

  // If mana source is provided, validate it
  if (action.manaSource) {
    return validateSingleManaSource(state, player, action.manaSource, playerId);
  }

  // No mana source provided - check if auto-inference is possible
  // Find the spell's color (non-black color in poweredBy)
  const spellColor = card.poweredBy.find((c) => c !== MANA_BLACK);
  if (!spellColor) {
    return invalid(
      SPELL_BASIC_REQUIRES_MANA,
      "Spells require mana of their color to cast even the basic effect"
    );
  }

  // Get available sources for this color
  const availableSources = getAvailableManaSourcesForColor(state, player, spellColor);

  // If there's at least one source, allow it (command factory will auto-infer)
  if (availableSources.length > 0) {
    return valid();
  }

  // No sources available
  return invalid(
    SPELL_BASIC_REQUIRES_MANA,
    "Spells require mana of their color to cast even the basic effect"
  );
}
