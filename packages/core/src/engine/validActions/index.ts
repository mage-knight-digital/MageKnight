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
import {
  getGladeWoundOptions,
  getDeepMineOptions,
  getDiscardCostOptions,
  getDiscardForAttackOptions,
  getDiscardForCrystalOptions,
  getArtifactCrystalColorOptions,
  getCrystalJoyReclaimOptions,
} from "./pending.js";
import { getChallengeOptions } from "./challenge.js";
import { getCooperativeAssaultOptions } from "./cooperativeAssault.js";
import { getSkillOptions } from "./skills.js";

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
  if (hasPendingChoice(player)) {
    return {
      mode: "pending_choice",
      turn: { canUndo: getTurnOptions(state, player).canUndo },
    };
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
  };
}
