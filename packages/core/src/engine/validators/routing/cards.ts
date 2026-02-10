/**
 * Card play validators routing - PLAY_CARD, PLAY_CARD_SIDEWAYS, RESOLVE_CHOICE
 */

import type { ValidatorRegistry } from "./types.js";
import {
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  RESOLVE_CHOICE_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
} from "../turnValidators.js";

import {
  validateCardInHand,
  validateCardExists,
  validateNotWound,
} from "../playCardValidators.js";

import {
  validateManaAvailable,
  validateManaColorMatch,
  validateManaTimeOfDayWithDungeonOverride,
  validateManaDungeonTombRules,
  validateSpellManaRequirement,
  validateSpellBasicManaRequirement,
} from "../mana/index.js";

import {
  validateSidewaysCardInHand,
  validateSidewaysNotWound,
  validateSidewaysChoice,
} from "../sidewaysValidators.js";

import {
  validateHasPendingChoice,
  validateChoiceIndex,
  validateNoChoicePending,
  validateNoBlockingTacticDecisionPending,
} from "../choiceValidators.js";

import {
  validateNoPendingLevelUpRewards,
} from "../levelUpValidators.js";

import {
  validateMustAnnounceEndOfRound,
} from "../roundValidators.js";

export const cardValidatorRegistry: ValidatorRegistry = {
  [PLAY_CARD_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    // Note: Playing cards is allowed during combat and doesn't count as the "action"
    validateCardInHand,
    validateCardExists,
    validateNotWound,
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
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateSidewaysCardInHand,
    validateSidewaysNotWound, // Any non-wound card is valid for sideways play
    validateSidewaysChoice,
  ],
  [RESOLVE_CHOICE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingChoice,
    validateChoiceIndex,
  ],
};
