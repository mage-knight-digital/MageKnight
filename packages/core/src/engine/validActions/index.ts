/**
 * Valid actions computation.
 *
 * This module is the single source of truth for what actions a player can take.
 * It computes ValidActions server-side and sends them to clients.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ValidActions, TacticsOptions, TacticEffectsOptions, GladeWoundOptions, DeepMineOptions, BasicManaColor } from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import {
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_RETHINK,
  TACTIC_MANA_SEARCH,
  TACTIC_SPARING_POWER,
  TACTIC_MANA_STEAL,
  TACTIC_PREPARATION,
  MANA_GOLD,
  BASIC_MANA_COLORS,
  CARD_WOUND,
  hexKey,
} from "@mage-knight/shared";
import { SiteType } from "../../types/map.js";
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
import { getUnitOptionsForCombat, getFullUnitOptions } from "./units.js";
import { getSiteOptions } from "./sites.js";

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

// Re-export movement, exploration, combat, and units
export { getValidMoveTargets } from "./movement.js";
export { getValidExploreOptions } from "./exploration.js";
export { getCombatOptions } from "./combat.js";
export { getUnitOptions, getUnitOptionsForCombat, getActivatableUnits, getFullUnitOptions } from "./units.js";

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
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
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
        tacticEffects: { pendingDecision },
        gladeWound: undefined,
      deepMine: undefined,
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
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
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
      },
      tactics: undefined,
      enterCombat: undefined,
      tacticEffects: undefined,
      gladeWound: gladeWoundOptions,
      deepMine: undefined,
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
      },
      tactics: undefined,
      enterCombat: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: deepMineOptions,
    };
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
      },
      tactics: undefined,
      enterCombat: undefined,
      tacticEffects: undefined,
      gladeWound: undefined,
      deepMine: undefined,
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
        },
        tactics: undefined,
        enterCombat: undefined,
        tacticEffects: undefined,
        gladeWound: undefined,
      deepMine: undefined,
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
    tacticEffects: getTacticEffectsOptions(state, player),
    gladeWound: undefined,
      deepMine: undefined,
  };
}

/**
 * Get tactics selection options during tactics phase.
 */
function getTacticsOptions(
  state: GameState,
  playerId: string
): TacticsOptions {
  return {
    availableTactics: state.availableTactics,
    isYourTurn: state.currentTacticSelector === playerId,
  };
}

/**
 * Get tactic effects options during player turns.
 * Returns undefined if no tactic effects are available.
 */
function getTacticEffectsOptions(
  state: GameState,
  player: Player
): TacticEffectsOptions | undefined {
  const tactic = player.selectedTactic;
  if (!tactic) {
    return undefined;
  }

  // Check for pending tactic decisions first (these take priority)
  const pendingDecision = getPendingTacticDecision(state, player);

  // Check for activatable tactics
  const canActivate = getActivatableTactics(state, player);

  // Check for Mana Search reroll
  const canRerollSourceDice = getManaSearchOptions(state, player);

  // TODO: Check for before-turn requirements

  // Return undefined if nothing is available
  if (!canActivate && !pendingDecision && !canRerollSourceDice) {
    return undefined;
  }

  const result: TacticEffectsOptions = {};
  if (canActivate) {
    (result as { canActivate: typeof canActivate }).canActivate = canActivate;
  }
  if (pendingDecision) {
    (result as { pendingDecision: typeof pendingDecision }).pendingDecision = pendingDecision;
  }
  if (canRerollSourceDice) {
    (result as { canRerollSourceDice: typeof canRerollSourceDice }).canRerollSourceDice = canRerollSourceDice;
  }

  return result;
}

/**
 * Get pending tactic decision info for the player.
 */
function getPendingTacticDecision(
  state: GameState,
  player: Player
): TacticEffectsOptions["pendingDecision"] {
  const pending = player.pendingTacticDecision;
  if (!pending) {
    return undefined;
  }

  // Convert to PendingTacticDecisionInfo format
  if (pending.type === TACTIC_RETHINK) {
    return {
      type: pending.type,
      maxCards: pending.maxCards,
    };
  }

  // Sparing Power: before-turn choice (stash or take)
  if (pending.type === TACTIC_SPARING_POWER) {
    return {
      type: pending.type,
      // Include info about whether stash is available (deck not empty)
      canStash: player.deck.length > 0,
      storedCount: player.tacticState.sparingPowerStored?.length ?? 0,
    };
  }

  // Mana Steal: choose a basic color die from source
  if (pending.type === TACTIC_MANA_STEAL) {
    const availableBasicDice = state.source.dice.filter(
      (d) =>
        d.takenByPlayerId === null &&
        !d.isDepleted &&
        BASIC_MANA_COLORS.includes(d.color as typeof BASIC_MANA_COLORS[number])
    );
    return {
      type: pending.type,
      availableDiceIds: availableBasicDice.map((d) => d.id),
    };
  }

  // Preparation: choose a card from deck
  if (pending.type === TACTIC_PREPARATION) {
    // The deckSnapshot is stored in the pending decision - this is secret info
    // Only sent to the owning player via toClientState filtering
    return {
      type: pending.type,
      deckSnapshot: pending.deckSnapshot,
    };
  }

  // Midnight Meditation: choose cards to shuffle into deck (then draw same amount)
  if (pending.type === TACTIC_MIDNIGHT_MEDITATION) {
    return {
      type: pending.type,
      maxCards: pending.maxCards,
    };
  }

  return undefined;
}

/**
 * Get activatable tactics that the player can use this turn.
 */
function getActivatableTactics(
  state: GameState,
  player: Player
): TacticEffectsOptions["canActivate"] {
  const tactic = player.selectedTactic;
  if (!tactic || player.tacticFlipped) {
    return undefined;
  }

  // The Right Moment (Day 6) - can use during turn, not on last turn of round
  if (tactic === TACTIC_THE_RIGHT_MOMENT) {
    const isLastTurnOfRound = state.endOfRoundAnnouncedBy !== null || state.scenarioEndTriggered;
    if (!isLastTurnOfRound) {
      return { theRightMoment: true };
    }
  }

  // Long Night (Night 2) - can use when deck is empty
  if (tactic === TACTIC_LONG_NIGHT) {
    if (player.deck.length === 0 && player.discard.length > 0) {
      return { longNight: true };
    }
  }

  // Midnight Meditation (Night 4) - can use before taking any action
  if (tactic === TACTIC_MIDNIGHT_MEDITATION) {
    if (!player.hasTakenActionThisTurn) {
      return { midnightMeditation: true };
    }
  }

  return undefined;
}

/**
 * Get Mana Search reroll options for the player.
 * Returns undefined if Mana Search is not available.
 */
function getManaSearchOptions(
  state: GameState,
  player: Player
): TacticEffectsOptions["canRerollSourceDice"] {
  // Must have Mana Search tactic
  if (player.selectedTactic !== TACTIC_MANA_SEARCH) {
    return undefined;
  }

  // Cannot use if already used this turn
  if (player.tacticState?.manaSearchUsedThisTurn) {
    return undefined;
  }

  // Cannot use after taking mana from source
  if (player.usedManaFromSource) {
    return undefined;
  }

  // Get available dice (not taken by other players)
  const availableDice = state.source.dice.filter(
    (d) => d.takenByPlayerId === null || d.takenByPlayerId === player.id
  );

  if (availableDice.length === 0) {
    return undefined;
  }

  // Check if there are gold/depleted dice that must be picked first
  const restrictedDice = availableDice.filter(
    (d) => d.isDepleted || d.color === MANA_GOLD
  );

  return {
    maxDice: 2,
    mustPickDepletedFirst: restrictedDice.length > 0,
    availableDiceIds: availableDice.map((d) => d.id),
  };
}

/**
 * Get Magical Glade wound discard options for the player.
 * Returns options if player is on a glade and has wounds.
 */
function getGladeWoundOptions(
  state: GameState,
  player: Player
): GladeWoundOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Check if on a Magical Glade
  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site || hex.site.type !== SiteType.MagicalGlade) {
    return undefined;
  }

  // Check for wounds in hand and discard
  const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
  const hasWoundsInDiscard = player.discard.some((c) => c === CARD_WOUND);

  // If no wounds anywhere, no options needed
  if (!hasWoundsInHand && !hasWoundsInDiscard) {
    return undefined;
  }

  return {
    hasWoundsInHand,
    hasWoundsInDiscard,
  };
}

/**
 * Get Deep Mine crystal color choice options for the player.
 * Returns options if player has a pending deep mine choice.
 */
function getDeepMineOptions(
  _state: GameState,
  player: Player
): DeepMineOptions | undefined {
  // Check if player has a pending deep mine choice
  if (!player.pendingDeepMineChoice || player.pendingDeepMineChoice.length === 0) {
    return undefined;
  }

  // Convert mine colors to basic mana colors
  const availableColors: BasicManaColor[] = player.pendingDeepMineChoice.map(
    mineColorToBasicManaColor
  );

  return {
    availableColors,
  };
}

