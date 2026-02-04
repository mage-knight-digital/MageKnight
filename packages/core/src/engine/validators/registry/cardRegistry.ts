/**
 * Card action validator registry
 * Handles PLAY_CARD_ACTION and PLAY_CARD_SIDEWAYS_ACTION
 */

import type { Validator } from "../types.js";
import { PLAY_CARD_ACTION, PLAY_CARD_SIDEWAYS_ACTION } from "@mage-knight/shared";

// Turn validators
import { validateIsPlayersTurn, validateRoundPhase } from "../turnValidators.js";

// Play card validators
import {
  validateCardInHand,
  validateCardExists,
  validateNotWound,
  validateNoHealingCardInCombat,
  validateCardPlayableInContext,
} from "../playCardValidators.js";

// Mana validators
import {
  validateManaAvailable,
  validateManaColorMatch,
  validateManaTimeOfDayWithDungeonOverride,
  validateManaDungeonTombRules,
  validateSpellManaRequirement,
  validateSpellBasicManaRequirement,
} from "../mana/index.js";

// Sideways play validators
import {
  validateSidewaysCardInHand,
  validateSidewaysNotWound,
  validateSidewaysChoice,
} from "../sidewaysValidators.js";

// Choice validators
import { validateNoChoicePending } from "../choiceValidators.js";

// Round validators
import { validateMustAnnounceEndOfRound } from "../roundValidators.js";

// Level up validators
import { validateNoPendingLevelUpRewards } from "../levelUpValidators.js";

export const cardRegistry: Record<string, Validator[]> = {
  [PLAY_CARD_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    // Note: Playing cards is allowed during combat and doesn't count as the "action"
    validateCardInHand,
    validateCardExists,
    validateNotWound,
    validateNoHealingCardInCombat,
    validateCardPlayableInContext,
    // Mana validators - spell checks first, then dungeon/tomb rules, then time check, then availability, then color match
    validateSpellBasicManaRequirement, // Spells require mana even for basic effect
    validateSpellManaRequirement, // Spells require two mana sources for powered (black + color)
    validateManaDungeonTombRules, // Dungeon/tomb: no gold mana
    validateManaTimeOfDayWithDungeonOverride, // Time rules (with dungeon override for black)
    validateManaAvailable,
    validateManaColorMatch,
  ],
  [PLAY_CARD_SIDEWAYS_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateSidewaysCardInHand,
    validateSidewaysNotWound, // Any non-wound card is valid for sideways play
    validateSidewaysChoice,
  ],
};
