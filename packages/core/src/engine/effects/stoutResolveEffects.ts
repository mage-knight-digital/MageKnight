/**
 * Stout Resolve effect handlers
 *
 * Handles the EFFECT_DISCARD_FOR_BONUS effect:
 * - Basic: Choose Move/Influence/Attack/Block 2. Optionally discard 1 wound for +1.
 * - Powered: Choose Move/Influence/Attack/Block 3. Optionally discard any number of cards (max 1 wound) for +2 each.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingDiscardForBonus } from "../../types/player.js";
import type { DiscardForBonusEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { EFFECT_DISCARD_FOR_BONUS } from "../../types/effectTypes.js";

// ============================================================================
// DISCARD FOR BONUS EFFECT
// ============================================================================

/**
 * Get cards eligible for discard-for-bonus based on the filter type.
 *
 * - "wound_only": Only wound cards in hand
 * - "any_max_one_wound": All cards in hand (wound limit enforced at validation)
 */
export function getCardsEligibleForDiscardForBonus(
  hand: readonly CardId[],
  discardFilter: "wound_only" | "any_max_one_wound"
): CardId[] {
  if (discardFilter === "wound_only") {
    return hand.filter((cardId) => cardId === CARD_WOUND);
  }
  // "any_max_one_wound": all cards are eligible (wound count checked during validation)
  return [...hand];
}

/**
 * Handle the EFFECT_DISCARD_FOR_BONUS effect.
 *
 * Creates a pendingDiscardForBonus state on the player, blocking other actions
 * until the player resolves it via RESOLVE_DISCARD_FOR_BONUS action.
 */
export function handleDiscardForBonus(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DiscardForBonusEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("DiscardForBonusEffect requires sourceCardId");
  }

  // Create pending discard-for-bonus state
  const pending: PendingDiscardForBonus = {
    sourceCardId,
    choiceOptions: effect.choiceOptions,
    bonusPerCard: effect.bonusPerCard,
    maxDiscards: effect.maxDiscards,
    discardFilter: effect.discardFilter,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingDiscardForBonus: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `${sourceCardId} allows discarding cards for +${effect.bonusPerCard} bonus each`,
    requiresChoice: true,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Stout Resolve effect handlers with the effect registry.
 */
export function registerStoutResolveEffects(): void {
  registerEffect(
    EFFECT_DISCARD_FOR_BONUS,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleDiscardForBonus(
        state,
        playerIndex,
        player,
        effect as DiscardForBonusEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );
}
