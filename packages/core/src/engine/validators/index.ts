/**
 * Validator registry and runner
 */

import type { Validator, ValidationResult } from "./types.js";
import type { GameState } from "../../state/GameState.js";
import type { PlayerAction } from "@mage-knight/shared";
import {
  END_TURN_ACTION,
  EXPLORE_ACTION,
  MOVE_ACTION,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  UNDO_ACTION,
  RESOLVE_CHOICE_ACTION,
  REST_ACTION,
  ENTER_COMBAT_ACTION,
  CHALLENGE_RAMPAGING_ACTION,
  END_COMBAT_PHASE_ACTION,
  DECLARE_BLOCK_ACTION,
  DECLARE_ATTACK_ACTION,
  ASSIGN_DAMAGE_ACTION,
  ASSIGN_ATTACK_ACTION,
  UNASSIGN_ATTACK_ACTION,
  ASSIGN_BLOCK_ACTION,
  UNASSIGN_BLOCK_ACTION,
  RECRUIT_UNIT_ACTION,
  ACTIVATE_UNIT_ACTION,
  INTERACT_ACTION,
  ANNOUNCE_END_OF_ROUND_ACTION,
  ENTER_SITE_ACTION,
  SELECT_REWARD_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  CHOOSE_LEVEL_UP_REWARDS_ACTION,
  DEBUG_ADD_FAME_ACTION,
  DEBUG_TRIGGER_LEVEL_UP_ACTION,
  BURN_MONASTERY_ACTION,
} from "@mage-knight/shared";
import { valid } from "./types.js";

// Turn validators
import {
  validateIsPlayersTurn,
  validateRoundPhase,
  validateNotInCombat,
  validateHasNotActed,
} from "./turnValidators.js";

// Movement validators
import {
  validatePlayerOnMap,
  validateTargetAdjacent,
  validateTargetHexExists,
  validateTerrainPassable,
  validateEnoughMovePoints,
  validateNotBlockedByRampaging,
  validateCityEntryAllowed,
} from "./movementValidators.js";

// Explore validators
import {
  validatePlayerOnMapForExplore,
  validateOnEdgeHex,
  validateExploreDirection,
  validateWedgeDirection,
  validateSlotNotFilled,
  validateExploreMoveCost,
  validateTilesAvailable,
} from "./exploreValidators.js";

// Play card validators
import {
  validateCardInHand,
  validateCardExists,
  validateNotWound,
} from "./playCardValidators.js";

// Mana validators
import {
  validateManaAvailable,
  validateManaColorMatch,
  validateManaTimeOfDayWithDungeonOverride,
  validateManaDungeonTombRules,
  validateSpellManaRequirement,
  validateSpellBasicManaRequirement,
} from "./mana/index.js";

// Sideways play validators
import {
  validateSidewaysCardInHand,
  validateSidewaysNotWound,
  validateSidewaysChoice,
} from "./sidewaysValidators.js";

// Choice validators
import {
  validateHasPendingChoice,
  validateChoiceIndex,
  validateNoChoicePending,
  validateNoTacticDecisionPending,
} from "./choiceValidators.js";

// Rest validators
import {
  validateRestHasDiscard,
  validateRestCardsInHand,
  validateStandardRest,
  validateSlowRecovery,
} from "./restValidators.js";

// Combat validators
import {
  validateNotAlreadyInCombat,
  validateIsInCombat,
  validateBlockPhase,
  validateAttackPhase,
  validateAttackType,
  validateAssignDamagePhase,
  validateBlockTargetEnemy,
  validateAssignDamageTargetEnemy,
  validateAttackTargets,
  validateDamageAssignedBeforeLeaving,
  validateFortification,
  validateHasSiegeAttack,
  validateOneCombatPerTurn,
  // Incremental attack assignment validators
  validateAssignAttackInCombat,
  validateAssignAttackPhase,
  validateAssignAttackTargetEnemy,
  validateUnassignAttackTargetEnemy,
  validateHasAvailableAttack,
  validateHasAssignedToUnassign,
  validateAssignAttackTypeForPhase,
  validateAssignAttackFortification,
  // Incremental block assignment validators
  validateAssignBlockInCombat,
  validateAssignBlockPhase,
  validateAssignBlockTargetEnemy,
  validateUnassignBlockTargetEnemy,
  validateHasAvailableBlock,
  validateHasAssignedBlockToUnassign,
} from "./combatValidators/index.js";

// Unit validators
import {
  validateCommandSlots,
  validateInfluenceCost,
  validateUnitExists,
  validateUnitCanActivate,
  validateUnitCanReceiveDamage,
  validateAtRecruitmentSite,
  validateUnitTypeMatchesSite,
  validateAbilityIndex,
  validateAbilityMatchesPhase,
  validateSiegeRequirement,
  validateCombatRequiredForAbility,
  validateUnitsAllowedInCombat,
} from "./units/index.js";

// Interact validators
import {
  validateAtInhabitedSite,
  validateSiteAccessible,
  validateHealingPurchase,
} from "./interactValidators.js";

// Round validators
import {
  validateDeckEmpty,
  validateRoundEndNotAnnounced,
  validateMustAnnounceEndOfRound,
} from "./roundValidators.js";

// Site validators
import {
  validateAtAdventureSite,
  validateSiteNotConquered,
  validateSiteHasEnemiesOrDraws,
} from "./siteValidators.js";

// Reward validators
import {
  validateHasPendingRewards,
  validateRewardIndex,
  validateCardInOffer,
  validateNoPendingRewards,
} from "./rewardValidators.js";

// Glade validators
import {
  validateHasPendingGladeChoice,
  validateGladeWoundChoice,
} from "./gladeValidators.js";

// Deep mine validators
import {
  validateHasPendingDeepMineChoice,
  validateDeepMineColorChoice,
} from "./deepMineValidators.js";

// Offer validators (spell purchase, advanced action learning)
import {
  validateSpellInOffer,
  validateAtSpellSite,
  validateHasInfluenceForSpell,
  validateAdvancedActionInOffer,
  validateAtAdvancedActionSite,
  validateHasInfluenceForMonasteryAA,
  validateInLevelUpContext,
} from "./offerValidators.js";

// Level up reward validators
import {
  validateHasPendingLevelUpRewards,
  validateLevelInPendingRewards,
  validateSkillAvailable,
  validateSkillNotAlreadyOwned,
  validateAAInLevelUpOffer,
  validateNoPendingLevelUpRewards,
} from "./levelUpValidators.js";

// Challenge rampaging validators
import {
  validateChallengePlayerOnMap,
  validateNotInCombat as validateChallengeNotInCombat,
  validateNoCombatThisTurn,
  validateAdjacentToTarget,
  validateTargetHasRampagingEnemies,
} from "./challengeValidators.js";

// Debug validators
import {
  validateDevModeOnly,
  validateHasPendingLevelUps,
} from "./debugValidators.js";

// Burn monastery validators
import {
  validateAtMonastery,
  validateMonasteryNotBurned,
  validateNoCombatThisTurnForBurn,
} from "./burnMonasteryValidators.js";

// TODO: RULES LIMITATION - Immediate Choice Resolution
// =====================================================
// Current behavior: Players must resolve card choices (e.g., "Attack 2 OR Block 2")
// immediately before playing more cards or taking other actions.
//
// Actual Mage Knight rules: Players can stack multiple cards with unresolved choices,
// then decide when applying effects to combat. Example:
//   1. Play Rage (Attack OR Block - don't choose yet)
//   2. Play March (Move 2)
//   3. Play another card
//   4. Enter combat
//   5. NOW decide what Rage provides based on combat situation
//
// To fix this properly:
//   1. Change pendingChoice to pendingChoices: PendingChoice[] (array)
//   2. Remove validateNoChoicePending from PLAY_CARD_ACTION
//   3. Keep it on END_TURN, EXPLORE (must resolve before irreversible actions)
//   4. Add combat phase resolution that prompts for all pending choices
//   5. Update UI to show multiple pending choices
//
// For now, we force immediate resolution as a simplification.
// =====================================================

// Re-export types
export * from "./types.js";

// Validator registry - which validators run for which action
const validatorRegistry: Record<string, Validator[]> = {
  [MOVE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed, // Must move BEFORE taking action
    validatePlayerOnMap,
    validateTargetAdjacent,
    validateTargetHexExists,
    validateTerrainPassable,
    validateNotBlockedByRampaging, // Can't enter hex with rampaging enemies
    validateCityEntryAllowed, // Scenario rules for city entry
    validateEnoughMovePoints,
  ],
  [UNDO_ACTION]: [
    validateIsPlayersTurn,
    // Undo has special handling, minimal validation
  ],
  [END_TURN_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoTacticDecisionPending, // Must resolve pending tactic decision first
    validateNoPendingRewards, // Must select rewards before ending turn
    validateNoPendingLevelUpRewards, // Must select level up rewards before ending turn
  ],
  [EXPLORE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending, // Must resolve pending choice first
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed,
    validatePlayerOnMapForExplore,
    validateOnEdgeHex,
    validateExploreMoveCost, // Check cost before direction (direction check uses getValidExploreOptions which needs these)
    validateTilesAvailable,
    validateExploreDirection, // Uses getValidExploreOptions which checks all tiles and adjacency
    validateWedgeDirection, // Wedge maps only allow NE/E directions
    validateSlotNotFilled, // Now handled by validateExploreDirection
  ],
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
  [RESOLVE_CHOICE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingChoice,
    validateChoiceIndex,
  ],
  [REST_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed, // Can only rest if you haven't taken an action
    validateRestHasDiscard,
    validateRestCardsInHand,
    validateStandardRest, // Checks standard rest rules (exactly one non-wound)
    validateSlowRecovery, // Checks slow recovery rules (all wounds in hand)
  ],
  // Combat actions
  [ENTER_COMBAT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateNotAlreadyInCombat,
    validateOneCombatPerTurn, // Can only have one combat per turn
  ],
  [CHALLENGE_RAMPAGING_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateChallengePlayerOnMap,
    validateChallengeNotInCombat, // Can't challenge while in combat
    validateNoCombatThisTurn, // One combat per turn rule
    validateAdjacentToTarget,
    validateTargetHasRampagingEnemies,
  ],
  [END_COMBAT_PHASE_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateDamageAssignedBeforeLeaving,
  ],
  [DECLARE_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateBlockPhase,
    validateBlockTargetEnemy,
  ],
  [DECLARE_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateAttackPhase,
    validateAttackType,
    validateFortification,
    validateHasSiegeAttack, // Must have siege attack accumulated to use siege type
    validateAttackTargets,
  ],
  [ASSIGN_DAMAGE_ACTION]: [
    validateIsPlayersTurn,
    validateIsInCombat,
    validateAssignDamagePhase,
    validateAssignDamageTargetEnemy,
    validateUnitCanReceiveDamage,
  ],
  // Incremental attack assignment actions
  [ASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateAssignAttackTargetEnemy,
    validateHasAvailableAttack,
    validateAssignAttackTypeForPhase,
    validateAssignAttackFortification,
  ],
  [UNASSIGN_ATTACK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignAttackInCombat,
    validateAssignAttackPhase,
    validateUnassignAttackTargetEnemy,
    validateHasAssignedToUnassign,
  ],
  // Incremental block assignment actions
  [ASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateAssignBlockTargetEnemy,
    validateHasAvailableBlock,
  ],
  [UNASSIGN_BLOCK_ACTION]: [
    validateIsPlayersTurn,
    validateAssignBlockInCombat,
    validateAssignBlockPhase,
    validateUnassignBlockTargetEnemy,
    validateHasAssignedBlockToUnassign,
  ],
  [RECRUIT_UNIT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateCommandSlots,
    validateInfluenceCost,
    validateAtRecruitmentSite,
    validateUnitTypeMatchesSite,
  ],
  [INTERACT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateNoPendingLevelUpRewards, // Must select level up rewards first
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed,
    validateAtInhabitedSite,
    validateSiteAccessible,
    validateHealingPurchase,
  ],
  [ACTIVATE_UNIT_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateUnitExists,
    validateUnitCanActivate,
    validateAbilityIndex,
    validateCombatRequiredForAbility, // Combat abilities require being in combat
    validateUnitsAllowedInCombat, // Dungeon/Tomb: units cannot be used
    validateAbilityMatchesPhase, // Ability type must match combat phase
    validateSiegeRequirement, // Ranged can't hit fortified in ranged phase
  ],
  [ANNOUNCE_END_OF_ROUND_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateDeckEmpty,
    validateRoundEndNotAnnounced,
  ],
  [ENTER_SITE_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound, // Must announce if deck+hand empty
    validateHasNotActed, // Must not have taken action this turn
    validateAtAdventureSite,
    validateSiteNotConquered,
    validateSiteHasEnemiesOrDraws,
  ],
  [SELECT_REWARD_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateHasPendingRewards,
    validateRewardIndex,
    validateCardInOffer,
  ],
  [RESOLVE_GLADE_WOUND_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingGladeChoice,
    validateGladeWoundChoice,
  ],
  [RESOLVE_DEEP_MINE_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingDeepMineChoice,
    validateDeepMineColorChoice,
  ],
  [BUY_SPELL_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
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
    validateMustAnnounceEndOfRound,
    validateAdvancedActionInOffer,
    validateAtAdvancedActionSite,
    validateHasInfluenceForMonasteryAA,
    validateInLevelUpContext,
  ],
  [CHOOSE_LEVEL_UP_REWARDS_ACTION]: [
    validateIsPlayersTurn,
    validateHasPendingLevelUpRewards,
    validateLevelInPendingRewards,
    validateSkillAvailable,
    validateSkillNotAlreadyOwned,
    validateAAInLevelUpOffer,
  ],
  // Debug actions
  [DEBUG_ADD_FAME_ACTION]: [
    validateDevModeOnly,
    validateIsPlayersTurn,
  ],
  [DEBUG_TRIGGER_LEVEL_UP_ACTION]: [
    validateDevModeOnly,
    validateIsPlayersTurn,
    validateHasPendingLevelUps,
  ],
  [BURN_MONASTERY_ACTION]: [
    validateIsPlayersTurn,
    validateRoundPhase,
    validateNotInCombat,
    validateNoChoicePending,
    validateMustAnnounceEndOfRound,
    validateHasNotActed, // Can only burn if haven't taken action
    validateNoCombatThisTurnForBurn, // Can only have one combat per turn
    validateAtMonastery,
    validateMonasteryNotBurned,
  ],
};

// Run all validators for an action type
export function validateAction(
  state: GameState,
  playerId: string,
  action: PlayerAction
): ValidationResult {
  const validators = validatorRegistry[action.type];

  if (!validators) {
    // Unknown action type - could be not implemented yet
    return valid(); // Or return invalid if you want strict checking
  }

  for (const validator of validators) {
    const result = validator(state, playerId, action);
    if (!result.valid) {
      return result;
    }
  }

  return valid();
}

// Get validators for testing/introspection
export function getValidatorsForAction(actionType: string): Validator[] {
  return validatorRegistry[actionType] ?? [];
}
