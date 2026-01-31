/**
 * Spell mana requirement validators
 *
 * Validates that spells have proper mana sources:
 * - Basic effect: requires one mana of the spell's color
 * - Powered effect: requires black mana + the spell's color (two sources)
 */

import type { GameState } from "../../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import type { ValidationResult } from "../types.js";
import { valid, invalid } from "../types.js";
import { PLAY_CARD_ACTION, MANA_BLACK } from "@mage-knight/shared";
import { getCard } from "../../validActions/cards/index.js";
import { getAvailableManaSourcesForColor } from "../../validActions/mana.js";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { validateSingleManaSource } from "./sourceValidators.js";
import {
  PLAYER_NOT_FOUND,
  SPELL_REQUIRES_TWO_MANA,
  SPELL_BASIC_REQUIRES_MANA,
} from "../validationCodes.js";
import { getPlayerById } from "../../helpers/playerHelpers.js";

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
  const player = getPlayerById(state, playerId);
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

  const player = getPlayerById(state, playerId);
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
