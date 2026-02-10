/**
 * Site interaction validators routing - INTERACT, ENTER_SITE, BUY_SPELL, LEARN_AA, BURN_MONASTERY, PLUNDER_VILLAGE
 */

import type { ValidatorRegistry } from "./types.js";
import {
  INTERACT_ACTION,
  ENTER_SITE_ACTION,
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  BURN_MONASTERY_ACTION,
  PLUNDER_VILLAGE_ACTION,
} from "@mage-knight/shared";

import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "../turnValidators.js";

import {
  validateNoChoicePending,
  validateNoBlockingTacticDecisionPending,
} from "../choiceValidators.js";

import {
  validateNoPendingLevelUpRewards,
} from "../levelUpValidators.js";

import {
  validateMustAnnounceEndOfRound,
} from "../roundValidators.js";

import {
  validateNotRestingForInteraction,
  validateNotRestingForEnterSite,
} from "../restValidators.js";

import {
  validateAtInhabitedSite,
  validateSiteAccessible,
  validateHealingPurchase,
} from "../interactValidators.js";

import {
  validateAtAdventureSite,
  validateSiteNotConquered,
  validateSiteHasEnemiesOrDraws,
} from "../siteValidators.js";

import {
  validateSpellInOffer,
  validateAtSpellSite,
  validateHasInfluenceForSpell,
  validateAdvancedActionInOffer,
  validateAtAdvancedActionSite,
  validateHasInfluenceForMonasteryAA,
  validateInLevelUpContext,
} from "../offerValidators.js";

import {
  validateAtMonastery,
  validateMonasteryNotBurned,
  validateNoCombatThisTurnForBurn,
} from "../burnMonasteryValidators.js";

import {
  validateAtVillage,
  validateNotAlreadyPlundered,
  validateBeforeTurnForPlunder,
} from "../plunderVillageValidators.js";

export const siteValidatorRegistry: ValidatorRegistry = {
  [INTERACT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForInteraction, // Cannot interact with sites while resting (FAQ S5)
    validateHasNotActed,
    validateAtInhabitedSite,
    validateSiteAccessible,
    validateHealingPurchase,
  ],
  [ENTER_SITE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotRestingForEnterSite, // Cannot enter sites while resting
    validateHasNotActed, // Must not have taken action this turn
    validateAtAdventureSite,
    validateSiteNotConquered,
    validateSiteHasEnemiesOrDraws,
  ],
  [BUY_SPELL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound,
    validateSpellInOffer,
    validateAtSpellSite,
    validateHasInfluenceForSpell,
  ],
  [LEARN_ADVANCED_ACTION_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound,
    validateAdvancedActionInOffer,
    validateAtAdvancedActionSite,
    validateHasInfluenceForMonasteryAA,
    validateInLevelUpContext,
  ],
  [BURN_MONASTERY_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound,
    validateHasNotActed, // Can only burn if haven't taken action
    validateNoCombatThisTurnForBurn, // Can only have one combat per turn
    validateAtMonastery,
    validateMonasteryNotBurned,
  ],
  [PLUNDER_VILLAGE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateNoBlockingTacticDecisionPending, // Must resolve pending tactic decision first
    validateMustAnnounceEndOfRound,
    validateBeforeTurnForPlunder, // Must plunder before taking any action or moving
    validateAtVillage,
    validateNotAlreadyPlundered,
  ],
};
