/**
 * Command Factories Module
 *
 * This module provides factory functions that translate PlayerAction objects
 * into executable Command objects. Factories are organized by domain:
 *
 * | Domain | Module | Description |
 * |--------|--------|-------------|
 * | Movement | `movement.ts` | Move, Explore |
 * | Cards | `cards.ts` | PlayCard, PlayCardSideways, ResolveChoice |
 * | Combat | `combat.ts` | EnterCombat, EndCombatPhase, DeclareBlock, DeclareAttack, AssignDamage |
 * | Units | `units.ts` | RecruitUnit, ActivateUnit |
 * | Turn | `turn.ts` | EndTurn, Rest, AnnounceEndOfRound |
 * | Sites | `sites.ts` | Interact, EnterSite, ResolveGladeWound, ResolveDeepMine, ResolveCrystalJoyReclaim |
 * | Tactics | `tactics.ts` | SelectTactic, ActivateTactic, ResolveTacticDecision, RerollSourceDice |
 * | Offers | `offers.ts` | BuySpell, LearnAdvancedAction, SelectReward |
 *
 * @module commands/factories
 */

import {
  MOVE_ACTION,
  END_TURN_ACTION,
  EXPLORE_ACTION,
  PLAY_CARD_ACTION,
  PLAY_CARD_SIDEWAYS_ACTION,
  RESOLVE_CHOICE_ACTION,
  RESOLVE_DISCARD_ACTION,
  RESOLVE_DISCARD_FOR_ATTACK_ACTION,
  RESOLVE_DISCARD_FOR_CRYSTAL_ACTION,
  RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION,
  REST_ACTION,
  DECLARE_REST_ACTION,
  COMPLETE_REST_ACTION,
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
  SELECT_TACTIC_ACTION,
  SELECT_REWARD_ACTION,
  ACTIVATE_TACTIC_ACTION,
  RESOLVE_TACTIC_DECISION_ACTION,
  REROLL_SOURCE_DICE_ACTION,
  RESOLVE_GLADE_WOUND_ACTION,
  RESOLVE_DEEP_MINE_ACTION,
  RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION,
  RESOLVE_STEADY_TEMPO_ACTION,
  BUY_SPELL_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  CHOOSE_LEVEL_UP_REWARDS_ACTION,
  DEBUG_ADD_FAME_ACTION,
  DEBUG_TRIGGER_LEVEL_UP_ACTION,
  BURN_MONASTERY_ACTION,
  PLUNDER_VILLAGE_ACTION,
  PROPOSE_COOPERATIVE_ASSAULT_ACTION,
  RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION,
  CANCEL_COOPERATIVE_PROPOSAL_ACTION,
  USE_SKILL_ACTION,
  RETURN_INTERACTIVE_SKILL_ACTION,
  SPEND_MOVE_ON_CUMBERSOME_ACTION,
  ASSIGN_BANNER_ACTION,
  PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
  CONVERT_MOVE_TO_ATTACK_ACTION,
  PAY_THUGS_DAMAGE_INFLUENCE_ACTION,
  RESOLVE_HEX_COST_REDUCTION_ACTION,
  RESOLVE_TERRAIN_COST_REDUCTION_ACTION,
  RESOLVE_UNIT_MAINTENANCE_ACTION,
} from "@mage-knight/shared";

// Re-export the CommandFactory type
export type { CommandFactory } from "./types.js";

// Movement factories
export {
  createMoveCommandFromAction,
  createExploreCommandFromAction,
} from "./movement.js";

// Card factories
export {
  createPlayCardCommandFromAction,
  createPlayCardSidewaysCommandFromAction,
  createResolveChoiceCommandFromAction,
  createResolveDiscardCommandFromAction,
  createResolveDiscardForAttackCommandFromAction,
  createResolveDiscardForCrystalCommandFromAction,
  createResolveArtifactCrystalColorCommandFromAction,
} from "./cards.js";

// Combat factories
export {
  createEnterCombatCommandFromAction,
  createChallengeRampagingCommandFromAction,
  createEndCombatPhaseCommandFromAction,
  createDeclareBlockCommandFromAction,
  createDeclareAttackCommandFromAction,
  createAssignDamageCommandFromAction,
  createAssignAttackCommandFromAction,
  createUnassignAttackCommandFromAction,
  createAssignBlockCommandFromAction,
  createUnassignBlockCommandFromAction,
  createSpendMoveOnCumbersomeCommandFromAction,
  createPayHeroesAssaultInfluenceCommandFromAction,
  createConvertMoveToAttackCommandFromAction,
  createPayThugsDamageInfluenceCommandFromAction,
} from "./combat.js";

// Unit factories
export {
  createRecruitUnitCommandFromAction,
  createActivateUnitCommandFromAction,
  createResolveUnitMaintenanceCommandFromAction,
} from "./units.js";

// Turn factories
export {
  createEndTurnCommandFromAction,
  createRestCommandFromAction,
  createDeclareRestCommandFromAction,
  createCompleteRestCommandFromAction,
  createAnnounceEndOfRoundCommandFromAction,
} from "./turn.js";

// Site factories
export {
  createInteractCommandFromAction,
  createEnterSiteCommandFromAction,
  createResolveGladeWoundCommandFromAction,
  createResolveDeepMineCommandFromAction,
  createBurnMonasteryCommandFromAction,
  createPlunderVillageCommandFromAction,
  createResolveCrystalJoyReclaimCommandFromAction,
  createResolveSteadyTempoCommandFromAction,
} from "./sites.js";

// Tactics factories
export {
  createSelectTacticCommandFromAction,
  createActivateTacticCommandFromAction,
  createResolveTacticDecisionCommandFromAction,
  createRerollSourceDiceCommandFromAction,
} from "./tactics.js";

// Offers factories
export {
  createBuySpellCommandFromAction,
  createLearnAdvancedActionCommandFromAction,
  createSelectRewardCommandFromAction,
  createChooseLevelUpRewardsCommandFromAction,
} from "./offers.js";

// Debug factories
export {
  createDebugAddFameCommandFromAction,
  createDebugTriggerLevelUpCommandFromAction,
} from "./debug.js";

// Cooperative assault factories
export {
  createProposeCooperativeAssaultCommandFromAction,
  createRespondToProposalCommandFromAction,
  createCancelProposalCommandFromAction,
} from "./cooperativeAssault.js";

// Skill factories
export {
  createUseSkillCommandFromAction,
  createReturnInteractiveSkillCommandFromAction,
} from "./skills.js";

// Terrain cost reduction factories
export {
  createResolveHexCostReductionCommandFromAction,
  createResolveTerrainCostReductionCommandFromAction,
} from "./terrainCostReduction.js";

// Banner factories
export { createAssignBannerCommandFromAction } from "./banners.js";

// Import all factories for the registry
import {
  createMoveCommandFromAction,
  createExploreCommandFromAction,
} from "./movement.js";

import {
  createPlayCardCommandFromAction,
  createPlayCardSidewaysCommandFromAction,
  createResolveChoiceCommandFromAction,
  createResolveDiscardCommandFromAction,
  createResolveDiscardForAttackCommandFromAction,
  createResolveDiscardForCrystalCommandFromAction,
  createResolveArtifactCrystalColorCommandFromAction,
} from "./cards.js";

import {
  createEnterCombatCommandFromAction,
  createChallengeRampagingCommandFromAction,
  createEndCombatPhaseCommandFromAction,
  createDeclareBlockCommandFromAction,
  createDeclareAttackCommandFromAction,
  createAssignDamageCommandFromAction,
  createAssignAttackCommandFromAction,
  createUnassignAttackCommandFromAction,
  createAssignBlockCommandFromAction,
  createUnassignBlockCommandFromAction,
  createSpendMoveOnCumbersomeCommandFromAction,
  createPayHeroesAssaultInfluenceCommandFromAction,
  createConvertMoveToAttackCommandFromAction,
  createPayThugsDamageInfluenceCommandFromAction,
} from "./combat.js";

import {
  createRecruitUnitCommandFromAction,
  createActivateUnitCommandFromAction,
  createResolveUnitMaintenanceCommandFromAction,
} from "./units.js";

import {
  createEndTurnCommandFromAction,
  createRestCommandFromAction,
  createDeclareRestCommandFromAction,
  createCompleteRestCommandFromAction,
  createAnnounceEndOfRoundCommandFromAction,
} from "./turn.js";

import {
  createInteractCommandFromAction,
  createEnterSiteCommandFromAction,
  createResolveGladeWoundCommandFromAction,
  createResolveDeepMineCommandFromAction,
  createBurnMonasteryCommandFromAction,
  createPlunderVillageCommandFromAction,
  createResolveCrystalJoyReclaimCommandFromAction,
  createResolveSteadyTempoCommandFromAction,
} from "./sites.js";

import {
  createSelectTacticCommandFromAction,
  createActivateTacticCommandFromAction,
  createResolveTacticDecisionCommandFromAction,
  createRerollSourceDiceCommandFromAction,
} from "./tactics.js";

import {
  createBuySpellCommandFromAction,
  createLearnAdvancedActionCommandFromAction,
  createSelectRewardCommandFromAction,
  createChooseLevelUpRewardsCommandFromAction,
} from "./offers.js";

import {
  createDebugAddFameCommandFromAction,
  createDebugTriggerLevelUpCommandFromAction,
} from "./debug.js";

import {
  createProposeCooperativeAssaultCommandFromAction,
  createRespondToProposalCommandFromAction,
  createCancelProposalCommandFromAction,
} from "./cooperativeAssault.js";

import {
  createUseSkillCommandFromAction,
  createReturnInteractiveSkillCommandFromAction,
} from "./skills.js";

import {
  createResolveHexCostReductionCommandFromAction,
  createResolveTerrainCostReductionCommandFromAction,
} from "./terrainCostReduction.js";

import { createAssignBannerCommandFromAction } from "./banners.js";

import type { CommandFactory } from "./types.js";

/**
 * Registry mapping action types to their factory functions.
 *
 * Used by `createCommandForAction` to dispatch to the correct factory
 * based on the action type.
 */
export const commandFactoryRegistry: Record<string, CommandFactory> = {
  [MOVE_ACTION]: createMoveCommandFromAction,
  [END_TURN_ACTION]: createEndTurnCommandFromAction,
  [EXPLORE_ACTION]: createExploreCommandFromAction,
  [PLAY_CARD_ACTION]: createPlayCardCommandFromAction,
  [PLAY_CARD_SIDEWAYS_ACTION]: createPlayCardSidewaysCommandFromAction,
  [RESOLVE_CHOICE_ACTION]: createResolveChoiceCommandFromAction,
  [RESOLVE_DISCARD_ACTION]: createResolveDiscardCommandFromAction,
  [RESOLVE_DISCARD_FOR_ATTACK_ACTION]: createResolveDiscardForAttackCommandFromAction,
  [RESOLVE_DISCARD_FOR_CRYSTAL_ACTION]: createResolveDiscardForCrystalCommandFromAction,
  [RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION]: createResolveArtifactCrystalColorCommandFromAction,
  [REST_ACTION]: createRestCommandFromAction,
  [DECLARE_REST_ACTION]: createDeclareRestCommandFromAction,
  [COMPLETE_REST_ACTION]: createCompleteRestCommandFromAction,
  [ENTER_COMBAT_ACTION]: createEnterCombatCommandFromAction,
  [CHALLENGE_RAMPAGING_ACTION]: createChallengeRampagingCommandFromAction,
  [END_COMBAT_PHASE_ACTION]: createEndCombatPhaseCommandFromAction,
  [DECLARE_BLOCK_ACTION]: createDeclareBlockCommandFromAction,
  [DECLARE_ATTACK_ACTION]: createDeclareAttackCommandFromAction,
  [ASSIGN_DAMAGE_ACTION]: createAssignDamageCommandFromAction,
  [ASSIGN_ATTACK_ACTION]: createAssignAttackCommandFromAction,
  [UNASSIGN_ATTACK_ACTION]: createUnassignAttackCommandFromAction,
  [ASSIGN_BLOCK_ACTION]: createAssignBlockCommandFromAction,
  [UNASSIGN_BLOCK_ACTION]: createUnassignBlockCommandFromAction,
  [RECRUIT_UNIT_ACTION]: createRecruitUnitCommandFromAction,
  [ACTIVATE_UNIT_ACTION]: createActivateUnitCommandFromAction,
  [INTERACT_ACTION]: createInteractCommandFromAction,
  [ANNOUNCE_END_OF_ROUND_ACTION]: createAnnounceEndOfRoundCommandFromAction,
  [ENTER_SITE_ACTION]: createEnterSiteCommandFromAction,
  [SELECT_TACTIC_ACTION]: createSelectTacticCommandFromAction,
  [SELECT_REWARD_ACTION]: createSelectRewardCommandFromAction,
  [ACTIVATE_TACTIC_ACTION]: createActivateTacticCommandFromAction,
  [RESOLVE_TACTIC_DECISION_ACTION]: createResolveTacticDecisionCommandFromAction,
  [REROLL_SOURCE_DICE_ACTION]: createRerollSourceDiceCommandFromAction,
  [RESOLVE_GLADE_WOUND_ACTION]: createResolveGladeWoundCommandFromAction,
  [RESOLVE_DEEP_MINE_ACTION]: createResolveDeepMineCommandFromAction,
  [RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION]: createResolveCrystalJoyReclaimCommandFromAction,
  [RESOLVE_STEADY_TEMPO_ACTION]: createResolveSteadyTempoCommandFromAction,
  [BUY_SPELL_ACTION]: createBuySpellCommandFromAction,
  [LEARN_ADVANCED_ACTION_ACTION]: createLearnAdvancedActionCommandFromAction,
  [CHOOSE_LEVEL_UP_REWARDS_ACTION]: createChooseLevelUpRewardsCommandFromAction,
  // Debug actions
  [DEBUG_ADD_FAME_ACTION]: createDebugAddFameCommandFromAction,
  [DEBUG_TRIGGER_LEVEL_UP_ACTION]: createDebugTriggerLevelUpCommandFromAction,
  [BURN_MONASTERY_ACTION]: createBurnMonasteryCommandFromAction,
  [PLUNDER_VILLAGE_ACTION]: createPlunderVillageCommandFromAction,
  // Cooperative assault actions
  [PROPOSE_COOPERATIVE_ASSAULT_ACTION]: createProposeCooperativeAssaultCommandFromAction,
  [RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION]: createRespondToProposalCommandFromAction,
  [CANCEL_COOPERATIVE_PROPOSAL_ACTION]: createCancelProposalCommandFromAction,
  // Skill actions
  [USE_SKILL_ACTION]: createUseSkillCommandFromAction,
  [RETURN_INTERACTIVE_SKILL_ACTION]: createReturnInteractiveSkillCommandFromAction,
  // Cumbersome ability actions
  [SPEND_MOVE_ON_CUMBERSOME_ACTION]: createSpendMoveOnCumbersomeCommandFromAction,
  // Heroes assault influence payment action
  [PAY_HEROES_ASSAULT_INFLUENCE_ACTION]: createPayHeroesAssaultInfluenceCommandFromAction,
  // Move-to-attack conversion (Agility card)
  [CONVERT_MOVE_TO_ATTACK_ACTION]: createConvertMoveToAttackCommandFromAction,
  // Thugs damage influence payment action
  [PAY_THUGS_DAMAGE_INFLUENCE_ACTION]: createPayThugsDamageInfluenceCommandFromAction,
  // Terrain cost reduction actions (Druidic Paths)
  [RESOLVE_HEX_COST_REDUCTION_ACTION]: createResolveHexCostReductionCommandFromAction,
  [RESOLVE_TERRAIN_COST_REDUCTION_ACTION]: createResolveTerrainCostReductionCommandFromAction,
  // Banner actions
  [ASSIGN_BANNER_ACTION]: createAssignBannerCommandFromAction,
  // Unit maintenance actions (Magic Familiars round-start)
  [RESOLVE_UNIT_MAINTENANCE_ACTION]: createResolveUnitMaintenanceCommandFromAction,
};
