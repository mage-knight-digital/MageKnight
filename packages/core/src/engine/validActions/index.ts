/**
 * Valid actions computation.
 *
 * This module is the single source of truth for what actions a player can take.
 * It computes ValidActions server-side and sends them to clients.
 *
 * Split into focused modules:
 * - helpers: Basic state checks (canAct, isInCombat, etc.)
 * - turn: Turn-related options (end turn, undo, rest)
 * - movement: Movement target computation
 * - exploration: Explore direction options
 * - combat: Combat phase options
 * - cards/: Card play options
 * - mana: Mana source options
 * - units/: Unit recruitment and activation
 * - sites: Site interaction options
 * - tactics: Tactics selection and effects
 * - pending: Pending state resolution (glade, deep mine)
 */

import type { GameState } from "../../state/GameState.js";
import type { ValidActions } from "@mage-knight/shared";
import {
  checkCanAct,
  isInCombat,
  hasPendingChoice,
  isTacticsPhase,
} from "./helpers.js";
import { getTurnOptions } from "./turn.js";
import { getValidMoveTargets } from "./movement.js";
import { getValidExploreOptions } from "./exploration.js";
import { getCombatOptions } from "./combat.js";
import { getPlayableCardsForCombat, getPlayableCardsForNormalTurn } from "./cards/index.js";
import { getManaOptions } from "./mana.js";
import { getUnitOptionsForCombat, getFullUnitOptions } from "./units/index.js";
import { getSiteOptions } from "./sites.js";
import { getTacticsOptions, getTacticEffectsOptions, getPendingTacticDecision } from "./tactics.js";
import { doesPendingTacticDecisionBlockActions } from "../rules/tactics.js";
import {
  getGladeWoundOptions,
  getDeepMineOptions,
  getDiscardCostOptions,
  getDiscardForAttackOptions,
  getDiscardForBonusOptions,
  getDiscardForCrystalOptions,
  getDecomposeOptions,
  getMaximalEffectOptions,
  getBookOfWisdomOptions,
  getTrainingOptions,
  getArtifactCrystalColorOptions,
  getCrystalJoyReclaimOptions,
  getSteadyTempoOptions,
  getBannerProtectionOptions,
  getUnitMaintenanceOptions,
  getMeditationOptions,
} from "./pending.js";
import { getChallengeOptions } from "./challenge.js";
import { getCooperativeAssaultOptions } from "./cooperativeAssault.js";
import { getSkillOptions } from "./skills.js";
import {
  getHexCostReductionValidActions,
  getTerrainCostReductionValidActions,
} from "./terrainCostReduction.js";
import { getBannerOptions } from "./banners.js";
import { getReturnableSkillOptions } from "./returnableSkills.js";
import { getLearningAAPurchaseOptions } from "./learningAAPurchase.js";

// Re-export helpers for use in other modules
export {
  checkCanAct,
  isInCombat,
  hasPendingChoice,
  isTacticsPhase,
  isPlayerTurnsPhase,
  isOnMap,
  getCurrentPlayerId,
} from "./helpers.js";

// Re-export turn options
export { getTurnOptions } from "./turn.js";

// Re-export movement, exploration, combat, challenge, and units
export { getValidMoveTargets } from "./movement.js";
export { getValidExploreOptions } from "./exploration.js";
export { getCombatOptions } from "./combat.js";
export { getChallengeOptions } from "./challenge.js";
export { getUnitOptions, getUnitOptionsForCombat, getActivatableUnits, getFullUnitOptions } from "./units/index.js";

/**
 * Compute all valid actions for a player.
 *
 * This is the main entry point called by toClientState().
 */
export function getValidActions(
  state: GameState,
  playerId: string
): ValidActions {
  const canActResult = checkCanAct(state, playerId);

  if (!canActResult.canAct) {
    return {
      mode: "cannot_act",
      reason: canActResult.reason ?? "Unknown reason",
    };
  }

  const player = canActResult.player;

  // === Unit Maintenance (before tactics selection) ===
  if (player.pendingUnitMaintenance && player.pendingUnitMaintenance.length > 0) {
    const unitMaintenance = getUnitMaintenanceOptions(player);
    if (unitMaintenance) {
      return {
        mode: "pending_unit_maintenance",
        unitMaintenance,
      };
    }
  }

  // === Tactics Phase ===
  if (isTacticsPhase(state)) {
    const pendingDecision = getPendingTacticDecision(state, player);
    if (pendingDecision) {
      return {
        mode: "pending_tactic_decision",
        tacticDecision: pendingDecision,
      };
    }
    return {
      mode: "tactics_selection",
      tactics: getTacticsOptions(state, playerId),
    };
  }

  // === Before-Turn Tactic Decisions (must resolve before other actions) ===
  // Some tactic decisions (e.g., Sparing Power) must be resolved at the start
  // of the turn before any other actions are allowed.
  if (doesPendingTacticDecisionBlockActions(player)) {
    const pendingDecision = getPendingTacticDecision(state, player);
    if (pendingDecision) {
      return {
        mode: "pending_tactic_decision",
        tacticDecision: pendingDecision,
      };
    }
  }

  // === Pending States (must resolve before other actions) ===
  if (player.pendingGladeWoundChoice) {
    return {
      mode: "pending_glade_wound",
      turn: { canUndo: false },
      gladeWound: getGladeWoundOptions(state, player),
    };
  }
  if (player.pendingDeepMineChoice) {
    return {
      mode: "pending_deep_mine",
      turn: { canUndo: false },
      deepMine: getDeepMineOptions(state, player),
    };
  }
  if (player.pendingDiscard) {
    return {
      mode: "pending_discard_cost",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      discardCost: getDiscardCostOptions(state, player),
    };
  }
  if (player.pendingDiscardForAttack) {
    return {
      mode: "pending_discard_for_attack",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      discardForAttack: getDiscardForAttackOptions(state, player),
    };
  }
  if (player.pendingDiscardForBonus) {
    return {
      mode: "pending_discard_for_bonus",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      discardForBonus: getDiscardForBonusOptions(state, player),
    };
  }
  if (player.pendingDiscardForCrystal) {
    if (player.pendingDiscardForCrystal.awaitingColorChoice) {
      return {
        mode: "pending_artifact_crystal_color",
        turn: { canUndo: getTurnOptions(state, player).canUndo },
        artifactCrystalColor: getArtifactCrystalColorOptions(state, player),
      };
    }
    return {
      mode: "pending_discard_for_crystal",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      discardForCrystal: getDiscardForCrystalOptions(state, player),
    };
  }
  if (player.pendingDecompose) {
    return {
      mode: "pending_decompose",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      decompose: getDecomposeOptions(state, player),
    };
  }
  if (player.pendingMaximalEffect) {
    return {
      mode: "pending_maximal_effect",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      maximalEffect: getMaximalEffectOptions(state, player),
    };
  }
  if (player.pendingBookOfWisdom) {
    return {
      mode: "pending_book_of_wisdom",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      bookOfWisdom: getBookOfWisdomOptions(state, player),
    };
  }
  if (player.pendingTraining) {
    return {
      mode: "pending_training",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
      training: getTrainingOptions(state, player),
    };
  }
  if (player.pendingLevelUpRewards.length > 0) {
    const firstPending = player.pendingLevelUpRewards[0]!;
    return {
      mode: "pending_level_up",
      turn: { canUndo: false },
      levelUpRewards: {
        level: firstPending.level,
        drawnSkills: firstPending.drawnSkills,
        commonPoolSkills: state.offers.commonSkills,
        availableAAs: state.offers.advancedActions.cards,
      },
    };
  }
  if (player.pendingCrystalJoyReclaim) {
    return {
      mode: "pending_crystal_joy_reclaim",
      turn: { canUndo: false },
      crystalJoyReclaim: getCrystalJoyReclaimOptions(state, player),
    };
  }
  if (player.pendingSteadyTempoDeckPlacement) {
    return {
      mode: "pending_steady_tempo",
      turn: { canUndo: false },
      steadyTempo: getSteadyTempoOptions(state, player),
    };
  }
  if (player.pendingMeditation) {
    return {
      mode: "pending_meditation",
      turn: { canUndo: false },
      meditation: getMeditationOptions(state, player),
    };
  }
  if (player.pendingBannerProtectionChoice) {
    return {
      mode: "pending_banner_protection",
      turn: { canUndo: false },
      bannerProtection: getBannerProtectionOptions(player),
    };
  }
  if (player.pendingSourceOpeningRerollChoice) {
    return {
      mode: "pending_source_opening_reroll",
      turn: { canUndo: false },
    };
  }
  if (hasPendingChoice(player)) {
    return {
      mode: "pending_choice",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
    };
  }
  if (player.pendingTerrainCostReduction) {
    if (player.pendingTerrainCostReduction.mode === "hex") {
      const hexCostReduction = getHexCostReductionValidActions(state, player);
      if (hexCostReduction) {
        return {
          mode: "pending_hex_cost_reduction",
          turn: { canUndo: getTurnOptions(state, player).canUndo },
          hexCostReduction,
        };
      }
    } else {
      const terrainCostReduction = getTerrainCostReductionValidActions(
        state,
        player
      );
      if (terrainCostReduction) {
        return {
          mode: "pending_terrain_cost_reduction",
          turn: { canUndo: getTurnOptions(state, player).canUndo },
          terrainCostReduction,
        };
      }
    }
  }

  // === Combat ===
  if (isInCombat(state) && state.combat) {
    const combatOptions = getCombatOptions(state);
    if (combatOptions) {
      const playCardOptions = getPlayableCardsForCombat(
        state,
        player,
        state.combat
      );
      return {
        mode: "combat",
        turn: { canUndo: getTurnOptions(state, player).canUndo },
        combat: combatOptions,
        playCard:
          playCardOptions.cards.length > 0 ? playCardOptions : undefined,
        mana: getManaOptions(state, player),
        units: getUnitOptionsForCombat(state, player, state.combat),
        skills: getSkillOptions(state, player),
      };
    }
  }

  // === Normal Turn ===
  const playCardOptions = getPlayableCardsForNormalTurn(state, player);
  return {
    mode: "normal_turn",
    turn: getTurnOptions(state, player),
    move: getValidMoveTargets(state, player),
    explore: getValidExploreOptions(state, player),
    playCard: playCardOptions.cards.length > 0 ? playCardOptions : undefined,
    units: getFullUnitOptions(state, player),
    sites: getSiteOptions(state, player),
    mana: getManaOptions(state, player),
    challenge: getChallengeOptions(state, player),
    tacticEffects: getTacticEffectsOptions(state, player),
    cooperativeAssault: getCooperativeAssaultOptions(state, player),
    skills: getSkillOptions(state, player),
    banners: getBannerOptions(state, player),
    returnableSkills: getReturnableSkillOptions(state, player),
    learningAAPurchase: getLearningAAPurchaseOptions(state, player),
  };
}
