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
  // Check if player can act at all
  const canActResult = checkCanAct(state, playerId);

  if (!canActResult.canAct) {
    return {
      canAct: false,
      reason: canActResult.reason,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: undefined,
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  const player = canActResult.player;

  // Handle tactics selection phase
  if (isTacticsPhase(state)) {
    // Check if player has a pending tactic decision to resolve
    const pendingDecision = getPendingTacticDecision(state, player);
    if (pendingDecision) {
      return {
        canAct: true,
        reason: undefined,
        move: undefined,
        explore: undefined,
        playCard: undefined,
        combat: undefined,
        units: undefined,
        sites: undefined,
        mana: undefined,
        turn: undefined,
        tactics: undefined, // No more tactic selection - must resolve first
        enterCombat: undefined,
        challenge: undefined,
        tacticEffects: { pendingDecision },
        gladeWound: undefined,
        deepMine: undefined,
        discardCost: undefined,
        discardForAttack: undefined,
        discardForCrystal: undefined,
        artifactCrystalColor: undefined,
        levelUpRewards: undefined,
        cooperativeAssault: undefined,
        skills: undefined,
      };
    }

    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: undefined,
      tactics: getTacticsOptions(state, playerId),
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending glade wound choice - must resolve before other actions
  if (player.pendingGladeWoundChoice) {
    const gladeWoundOptions = getGladeWoundOptions(state, player);
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: false, // Can't undo during glade choice
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: false,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: gladeWoundOptions,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending deep mine choice - must resolve before other actions
  if (player.pendingDeepMineChoice) {
    const deepMineOptions = getDeepMineOptions(state, player);
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: false, // Can't undo during deep mine choice
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: false,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: deepMineOptions,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending discard cost - must resolve before other actions
  if (player.pendingDiscard) {
    const discardCostOptions = getDiscardCostOptions(state, player);
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo, // Can undo card play that caused this
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: false,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: discardCostOptions,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending discard-for-attack (Sword of Justice) - must resolve before other actions
  if (player.pendingDiscardForAttack) {
    const discardForAttackOptions = getDiscardForAttackOptions(state, player);
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo, // Can undo card play that caused this
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: false,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: discardForAttackOptions,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending discard-for-crystal (Savage Harvesting) - must resolve before other actions
  if (player.pendingDiscardForCrystal) {
    // Check if awaiting color choice (second step - artifact was discarded)
    if (player.pendingDiscardForCrystal.awaitingColorChoice) {
      const artifactColorOptions = getArtifactCrystalColorOptions(state, player);
      return {
        canAct: true,
        reason: undefined,
        move: undefined,
        explore: undefined,
        playCard: undefined,
        combat: undefined,
        units: undefined,
        sites: undefined,
        mana: undefined,
        turn: {
          canEndTurn: false,
          canAnnounceEndOfRound: false,
          canUndo: getTurnOptions(state, player).canUndo,
          canRest: false,
          restTypes: undefined,
          canDeclareRest: false,
          canCompleteRest: false,
          isResting: false,
        },
        tactics: undefined,
        enterCombat: undefined,
        challenge: undefined,
        tacticEffects: undefined,
        gladeWound: undefined,
        deepMine: undefined,
        discardCost: undefined,
        discardForAttack: undefined,
        discardForCrystal: undefined,
        artifactCrystalColor: artifactColorOptions,
        levelUpRewards: undefined,
        cooperativeAssault: undefined,
        skills: undefined,
      };
    }

    // First step - select card to discard
    const discardForCrystalOptions = getDiscardForCrystalOptions(state, player);
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo,
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: false,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: discardForCrystalOptions,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle pending level up rewards - must resolve before other actions
  if (player.pendingLevelUpRewards.length > 0) {
    const firstPending = player.pendingLevelUpRewards[0];
    if (firstPending) {
      return {
        canAct: true,
        reason: undefined,
        move: undefined,
        explore: undefined,
        playCard: undefined,
        combat: undefined,
        units: undefined,
        sites: undefined,
        mana: undefined,
        turn: {
          canEndTurn: false,
          canAnnounceEndOfRound: false,
          canUndo: false, // Can't undo during level up selection
          canRest: false,
          restTypes: undefined,
          canDeclareRest: false,
          canCompleteRest: false,
          isResting: false,
        },
        tactics: undefined,
        enterCombat: undefined,
        challenge: undefined,
        tacticEffects: undefined,
        gladeWound: undefined,
        deepMine: undefined,
        discardCost: undefined,
        discardForAttack: undefined,
        levelUpRewards: {
          level: firstPending.level,
          drawnSkills: firstPending.drawnSkills,
          commonPoolSkills: state.offers.commonSkills,
          availableAAs: state.offers.advancedActions.cards,
        },
        cooperativeAssault: undefined,
        skills: undefined,
      };
    }
  }

  // Handle pending choice - must resolve before other actions
  if (hasPendingChoice(player)) {
    return {
      canAct: true,
      reason: undefined,
      move: undefined,
      explore: undefined,
      playCard: undefined,
      combat: undefined,
      units: undefined,
      sites: undefined,
      mana: undefined,
      // Only turn options (undo) available during pending choice
      turn: {
        canEndTurn: false,
        canAnnounceEndOfRound: false,
        canUndo: getTurnOptions(state, player).canUndo,
        canRest: false,
        restTypes: undefined,
        canDeclareRest: false,
        canCompleteRest: false,
        isResting: player.isResting,
      },
      tactics: undefined,
      enterCombat: undefined,
      challenge: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
      discardCost: undefined,
      discardForAttack: undefined,
      discardForCrystal: undefined,
      artifactCrystalColor: undefined,
      levelUpRewards: undefined,
      cooperativeAssault: undefined,
      skills: undefined,
    };
  }

  // Handle combat
  if (isInCombat(state) && state.combat) {
    const combatOptions = getCombatOptions(state);
    if (combatOptions) {
      const playCardOptions = getPlayableCardsForCombat(state, player, state.combat);
      const manaOptions = getManaOptions(state, player);
      const unitOptions = getUnitOptionsForCombat(state, player, state.combat);
      return {
        canAct: true,
        reason: undefined,
        move: undefined,
        explore: undefined,
        playCard: playCardOptions.cards.length > 0 ? playCardOptions : undefined,
        combat: combatOptions,
        units: unitOptions,
        sites: undefined,
        mana: manaOptions,
        turn: {
          canEndTurn: false,
          canAnnounceEndOfRound: false,
          canUndo: getTurnOptions(state, player).canUndo,
          canRest: false,
          restTypes: undefined,
          canDeclareRest: false,
          canCompleteRest: false,
          isResting: player.isResting,
        },
        tactics: undefined,
        enterCombat: undefined,
        challenge: undefined,
        tacticEffects: undefined,
        gladeWound: undefined,
        deepMine: undefined,
        discardCost: undefined,
        discardForAttack: undefined,
        discardForCrystal: undefined,
        artifactCrystalColor: undefined,
        levelUpRewards: undefined,
        cooperativeAssault: undefined,
        skills: getSkillOptions(state, player),
      };
    }
  }

  // Normal turn - compute all options
  const playCardOptions = getPlayableCardsForNormalTurn(state, player);
  const manaOptions = getManaOptions(state, player);

  return {
    canAct: true,
    reason: undefined,
    move: getValidMoveTargets(state, player),
    explore: getValidExploreOptions(state, player),
    playCard: playCardOptions.cards.length > 0 ? playCardOptions : undefined,
    combat: undefined,
    units: getFullUnitOptions(state, player),
    sites: getSiteOptions(state, player),
    mana: manaOptions,
    turn: getTurnOptions(state, player),
    tactics: undefined,
    enterCombat: undefined, // TODO: getEnterCombatOptions(state, player)
    challenge: getChallengeOptions(state, player),
    tacticEffects: getTacticEffectsOptions(state, player),
    gladeWound: undefined,
    deepMine: undefined,
    discardCost: undefined,
    discardForAttack: undefined,
    discardForCrystal: undefined,
    artifactCrystalColor: undefined,
    levelUpRewards: undefined,
    cooperativeAssault: getCooperativeAssaultOptions(state, player),
    skills: getSkillOptions(state, player),
  };
}
