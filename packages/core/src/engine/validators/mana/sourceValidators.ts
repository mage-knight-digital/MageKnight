/**
 * Mana source availability validators
 *
 * Validates that mana sources (die, crystal, token) are available and valid.
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction, BasicManaColor, ManaSourceInfo } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import type { Player } from "../../../types/player.js";
import { valid, invalid } from "../types.js";
import {
  PLAY_CARD_ACTION,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  MANA_GOLD,
  MANA_BLACK,
} from "@mage-knight/shared";
import { isRuleActive } from "../../modifiers.js";
import { RULE_EXTRA_SOURCE_DIE, RULE_BLACK_AS_ANY_COLOR } from "../../../types/modifierConstants.js";
import {
  DIE_ALREADY_USED,
  DIE_NOT_FOUND,
  DIE_DEPLETED,
  DIE_COLOR_MISMATCH,
  DIE_TAKEN,
  NO_CRYSTAL,
  NO_MANA_TOKEN,
  INVALID_MANA_SOURCE,
  POWERED_WITHOUT_MANA,
  PLAYER_NOT_FOUND,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

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

  const player = getPlayerById(state, playerId);
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
 * Helper to validate a single mana source is available.
 * Used by spell validators for multi-source validation.
 */
export function validateSingleManaSource(
  state: GameState,
  player: Player,
  source: ManaSourceInfo,
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
