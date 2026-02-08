/**
 * Mind Read / Mind Steal effect handlers
 *
 * Handles the Mind Read spell (White Spell #111) which:
 *
 * Basic (Mind Read):
 * - Caster picks a basic mana color
 * - Caster gains a crystal of the chosen color
 * - Each opponent must discard a Spell or Action card of that color from hand
 * - Opponents with no matching cards reveal their hand (no discard)
 * - After end-of-round announced: does nothing to opponents
 *
 * Powered (Mind Steal):
 * - Same as basic (crystal + forced discard)
 * - Caster may steal one of the discarded Action cards (NOT Spells)
 * - Stolen card goes to caster's hand permanently
 * - Optional: caster can skip stealing
 *
 * @module effects/mindReadEffects
 *
 * @remarks Resolution Flow
 * ```
 * EFFECT_MIND_READ
 *   └─► Present 4 basic color choices
 *       └─► EFFECT_RESOLVE_MIND_READ_COLOR
 *           ├─ Gain crystal of chosen color
 *           └─ Force opponent discards (or reveal)
 *
 * EFFECT_MIND_STEAL
 *   └─► Present 4 basic color choices
 *       └─► EFFECT_RESOLVE_MIND_STEAL_COLOR
 *           ├─ Gain crystal of chosen color
 *           ├─ Force opponent discards (or reveal)
 *           └─ If Action cards discarded: present steal choices + skip
 *               └─► EFFECT_RESOLVE_MIND_STEAL_SELECTION
 *                   └─ Move card to caster's hand
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  MindReadEffect,
  ResolveMindReadColorEffect,
  MindStealEffect,
  ResolveMindStealColorEffect,
  ResolveMindStealSelectionEffect,
  CardEffect,
} from "../../types/cards.js";
import {
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor, CardId } from "@mage-knight/shared";
import { BASIC_MANA_COLORS, CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { gainCrystalWithOverflow } from "../helpers/crystalHelpers.js";
import {
  EFFECT_MIND_READ,
  EFFECT_RESOLVE_MIND_READ_COLOR,
  EFFECT_MIND_STEAL,
  EFFECT_RESOLVE_MIND_STEAL_COLOR,
  EFFECT_RESOLVE_MIND_STEAL_SELECTION,
} from "../../types/effectTypes.js";
import { isCardOfColor } from "../helpers/cardColor.js";
import type { BasicCardColor } from "../../types/effectTypes.js";
import { getCard } from "../helpers/cardLookup.js";

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Check if end-of-round has been announced (or scenario end triggered).
 */
function isEndOfRoundAnnounced(state: GameState): boolean {
  return state.endOfRoundAnnouncedBy !== null || state.scenarioEndTriggered;
}

/**
 * Convert BasicManaColor to BasicCardColor for color matching.
 */
function manaColorToCardColor(color: BasicManaColor): BasicCardColor {
  return color as BasicCardColor;
}

/**
 * Find cards in a player's hand that match a given color (Spell or Action cards).
 * Excludes wound cards and artifacts.
 */
function getMatchingCardsInHand(
  hand: readonly CardId[],
  color: BasicCardColor
): CardId[] {
  return hand.filter(
    (cardId) => cardId !== CARD_WOUND && isCardOfColor(cardId, color)
  );
}

/**
 * Check if a card is an Action card (Basic or Advanced Action).
 */
function isActionCard(cardId: CardId): boolean {
  const card = getCard(cardId);
  if (!card) return false;
  return (
    card.cardType === DEED_CARD_TYPE_BASIC_ACTION ||
    card.cardType === DEED_CARD_TYPE_ADVANCED_ACTION
  );
}

/**
 * Process forced discard from opponents.
 * Each opponent must discard one matching Spell or Action card, or reveal hand.
 *
 * Returns updated players array, descriptions, and list of discarded Action cards
 * (for potential stealing in Mind Steal).
 */
function processOpponentDiscards(
  state: GameState,
  playerId: string,
  cardColor: BasicCardColor
): {
  updatedPlayers: Player[];
  descriptions: string[];
  discardedActionCards: Array<{ cardId: CardId; cardName: string; fromPlayerId: string }>;
} {
  const updatedPlayers = [...state.players];
  const descriptions: string[] = [];
  const discardedActionCards: Array<{
    cardId: CardId;
    cardName: string;
    fromPlayerId: string;
  }> = [];

  const opponents = state.players.filter((p) => p.id !== playerId);

  for (const opponent of opponents) {
    const opponentIndex = updatedPlayers.findIndex(
      (p) => p.id === opponent.id
    );
    if (opponentIndex === -1) continue;

    const currentOpponent = updatedPlayers[opponentIndex]!;
    const matchingCards = getMatchingCardsInHand(
      currentOpponent.hand,
      cardColor
    );

    if (matchingCards.length === 0) {
      // No matching cards — opponent reveals hand
      descriptions.push(`${currentOpponent.id} revealed hand (no matching cards)`);
    } else {
      // Discard the first matching card found
      // (In the board game, the opponent chooses which to discard. Since this is
      // an automated resolution, we discard the first match. For full multiplayer,
      // this would need an opponent choice step.)
      const discardedCardId = matchingCards[0]!;
      const card = getCard(discardedCardId);
      const cardName = card?.name ?? String(discardedCardId);

      const updatedHand = [...currentOpponent.hand];
      const handIndex = updatedHand.indexOf(discardedCardId);
      if (handIndex !== -1) {
        updatedHand.splice(handIndex, 1);
      }

      updatedPlayers[opponentIndex] = {
        ...currentOpponent,
        hand: updatedHand,
        discard: [...currentOpponent.discard, discardedCardId],
      };

      descriptions.push(`${currentOpponent.id} discarded ${cardName}`);

      // Track if this was an Action card (for potential stealing)
      if (isActionCard(discardedCardId)) {
        discardedActionCards.push({
          cardId: discardedCardId,
          cardName,
          fromPlayerId: currentOpponent.id,
        });
      }
    }
  }

  return { updatedPlayers, descriptions, discardedActionCards };
}

// ============================================================================
// MIND READ (BASIC)
// ============================================================================

/**
 * Handle EFFECT_MIND_READ entry point.
 * Presents the caster with a choice of basic mana color.
 */
export function handleMindRead(
  state: GameState,
  _playerId: string,
  _effect: MindReadEffect
): EffectResolutionResult {
  const colorOptions: ResolveMindReadColorEffect[] = BASIC_MANA_COLORS.map(
    (color) => ({
      type: EFFECT_RESOLVE_MIND_READ_COLOR,
      color,
    })
  );

  return {
    state,
    description: "Choose a basic mana color for Mind Read",
    requiresChoice: true,
    dynamicChoiceOptions: colorOptions,
  };
}

/**
 * Resolve after caster picks a basic mana color for Mind Read.
 * - Gain crystal of chosen color
 * - Force each opponent to discard a matching card (or reveal hand)
 */
export function resolveMindReadColor(
  state: GameState,
  playerId: string,
  effect: ResolveMindReadColorEffect
): EffectResolutionResult {
  const { playerIndex: casterIndex, player: caster } = getPlayerContext(
    state,
    playerId
  );
  const chosenColor = effect.color;
  const cardColor = manaColorToCardColor(chosenColor);
  const descriptions: string[] = [];

  // Gain crystal of chosen color (with overflow protection)
  const { player: updatedCaster, tokensGained } = gainCrystalWithOverflow(caster, chosenColor);
  descriptions.push(
    tokensGained > 0
      ? `${chosenColor} crystal at max — gained ${chosenColor} mana token instead`
      : `Gained ${chosenColor} crystal`
  );

  let currentState = updatePlayer(state, casterIndex, updatedCaster);

  // After end-of-round: opponents are not affected
  if (isEndOfRoundAnnounced(state)) {
    descriptions.push("No effect on opponents (end of round)");
    return {
      state: currentState,
      description: descriptions.join(". "),
    };
  }

  // Process opponent discards
  const opponents = currentState.players.filter((p) => p.id !== playerId);
  if (opponents.length === 0) {
    descriptions.push("No opponents to affect");
    return {
      state: currentState,
      description: descriptions.join(". "),
    };
  }

  const { updatedPlayers, descriptions: discardDescriptions } =
    processOpponentDiscards(currentState, playerId, cardColor);

  currentState = {
    ...currentState,
    players: updatedPlayers,
  };

  descriptions.push(...discardDescriptions);

  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// MIND STEAL (POWERED)
// ============================================================================

/**
 * Handle EFFECT_MIND_STEAL entry point.
 * Presents the caster with a choice of basic mana color.
 */
export function handleMindSteal(
  state: GameState,
  _playerId: string,
  _effect: MindStealEffect
): EffectResolutionResult {
  const colorOptions: ResolveMindStealColorEffect[] = BASIC_MANA_COLORS.map(
    (color) => ({
      type: EFFECT_RESOLVE_MIND_STEAL_COLOR,
      color,
    })
  );

  return {
    state,
    description: "Choose a basic mana color for Mind Steal",
    requiresChoice: true,
    dynamicChoiceOptions: colorOptions,
  };
}

/**
 * Resolve after caster picks a basic mana color for Mind Steal.
 * - Same as Mind Read (crystal + forced discard)
 * - If any Action cards were discarded, present steal options
 */
export function resolveMindStealColor(
  state: GameState,
  playerId: string,
  effect: ResolveMindStealColorEffect
): EffectResolutionResult {
  const { playerIndex: casterIndex, player: caster } = getPlayerContext(
    state,
    playerId
  );
  const chosenColor = effect.color;
  const cardColor = manaColorToCardColor(chosenColor);
  const descriptions: string[] = [];

  // Gain crystal of chosen color (with overflow protection)
  const { player: updatedCaster, tokensGained } = gainCrystalWithOverflow(caster, chosenColor);
  descriptions.push(
    tokensGained > 0
      ? `${chosenColor} crystal at max — gained ${chosenColor} mana token instead`
      : `Gained ${chosenColor} crystal`
  );

  let currentState = updatePlayer(state, casterIndex, updatedCaster);

  // After end-of-round: opponents are not affected
  if (isEndOfRoundAnnounced(state)) {
    descriptions.push("No effect on opponents (end of round)");
    return {
      state: currentState,
      description: descriptions.join(". "),
    };
  }

  // Process opponent discards
  const opponents = currentState.players.filter((p) => p.id !== playerId);
  if (opponents.length === 0) {
    descriptions.push("No opponents to affect");
    return {
      state: currentState,
      description: descriptions.join(". "),
    };
  }

  const {
    updatedPlayers,
    descriptions: discardDescriptions,
    discardedActionCards,
  } = processOpponentDiscards(currentState, playerId, cardColor);

  currentState = {
    ...currentState,
    players: updatedPlayers,
  };

  descriptions.push(...discardDescriptions);

  // If Action cards were discarded, offer steal options
  if (discardedActionCards.length > 0) {
    const stealOptions: CardEffect[] = discardedActionCards.map((card) => ({
      type: EFFECT_RESOLVE_MIND_STEAL_SELECTION,
      cardId: card.cardId,
      cardName: card.cardName,
      fromPlayerId: card.fromPlayerId,
    }));

    return {
      state: currentState,
      description: descriptions.join(". ") + ". Choose an Action card to steal",
      requiresChoice: true,
      dynamicChoiceOptions: stealOptions,
    };
  }

  // No Action cards to steal
  return {
    state: currentState,
    description: descriptions.join(". "),
  };
}

// ============================================================================
// RESOLVE MIND STEAL SELECTION
// ============================================================================

/**
 * Resolve after caster selects an Action card to steal.
 * Moves the card from the opponent's discard pile to the caster's hand.
 */
export function resolveMindStealSelection(
  state: GameState,
  playerId: string,
  effect: ResolveMindStealSelectionEffect
): EffectResolutionResult {
  const { playerIndex: casterIndex, player: caster } = getPlayerContext(
    state,
    playerId
  );

  // Find the opponent who had the card
  const fromPlayerIndex = state.players.findIndex(
    (p) => p.id === effect.fromPlayerId
  );
  if (fromPlayerIndex === -1) {
    return {
      state,
      description: `Could not find player ${effect.fromPlayerId}`,
    };
  }

  const fromPlayer = state.players[fromPlayerIndex]!;

  // Remove from opponent's discard pile
  const updatedDiscard = [...fromPlayer.discard];
  const discardIndex = updatedDiscard.indexOf(effect.cardId);
  if (discardIndex === -1) {
    return {
      state,
      description: `Card ${effect.cardName} not found in ${effect.fromPlayerId}'s discard`,
    };
  }
  updatedDiscard.splice(discardIndex, 1);

  const updatedFromPlayer: Player = {
    ...fromPlayer,
    discard: updatedDiscard,
  };

  // Add to caster's hand
  const updatedCaster: Player = {
    ...caster,
    hand: [...caster.hand, effect.cardId],
  };

  const updatedPlayers = [...state.players];
  updatedPlayers[fromPlayerIndex] = updatedFromPlayer;
  updatedPlayers[casterIndex] = updatedCaster;

  return {
    state: { ...state, players: updatedPlayers },
    description: `Stole ${effect.cardName} from ${effect.fromPlayerId}`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Mind Read / Mind Steal effect handlers with the effect registry.
 */
export function registerMindReadEffects(): void {
  registerEffect(EFFECT_MIND_READ, (state, playerId, effect) => {
    return handleMindRead(state, playerId, effect as MindReadEffect);
  });

  registerEffect(EFFECT_RESOLVE_MIND_READ_COLOR, (state, playerId, effect) => {
    return resolveMindReadColor(
      state,
      playerId,
      effect as ResolveMindReadColorEffect
    );
  });

  registerEffect(EFFECT_MIND_STEAL, (state, playerId, effect) => {
    return handleMindSteal(state, playerId, effect as MindStealEffect);
  });

  registerEffect(
    EFFECT_RESOLVE_MIND_STEAL_COLOR,
    (state, playerId, effect) => {
      return resolveMindStealColor(
        state,
        playerId,
        effect as ResolveMindStealColorEffect
      );
    }
  );

  registerEffect(
    EFFECT_RESOLVE_MIND_STEAL_SELECTION,
    (state, playerId, effect) => {
      return resolveMindStealSelection(
        state,
        playerId,
        effect as ResolveMindStealSelectionEffect
      );
    }
  );
}
