/**
 * Sword of Justice effect handlers
 *
 * Handles the unique effects used by the Sword of Justice artifact:
 * - EFFECT_DISCARD_FOR_ATTACK: Discard any number of non-wound cards for attack
 * - EFFECT_FAME_PER_ENEMY_DEFEATED: Award fame per enemy defeated this turn
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, PendingDiscardForAttack } from "../../types/player.js";
import type {
  DiscardForAttackEffect,
  FamePerEnemyDefeatedEffect,
} from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import { updatePlayer } from "./atomicHelpers.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { applyGainFame } from "./atomicProgressionEffects.js";
import {
  EFFECT_DISCARD_FOR_ATTACK,
  EFFECT_FAME_PER_ENEMY_DEFEATED,
} from "../../types/effectTypes.js";

// ============================================================================
// DISCARD FOR ATTACK EFFECT
// ============================================================================

/**
 * Get cards eligible for discard-for-attack (non-wound cards in hand).
 */
export function getCardsEligibleForDiscardForAttack(
  hand: readonly CardId[]
): CardId[] {
  return hand.filter((cardId) => cardId !== CARD_WOUND);
}

/**
 * Handle the EFFECT_DISCARD_FOR_ATTACK effect.
 *
 * Creates a pendingDiscardForAttack state on the player, blocking other actions
 * until the player resolves it via RESOLVE_DISCARD_FOR_ATTACK action.
 *
 * Unlike EFFECT_DISCARD_COST, this allows selecting 0 or more cards (variable count).
 */
export function handleDiscardForAttack(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: DiscardForAttackEffect,
  sourceCardId: CardId | null
): EffectResolutionResult {
  if (!sourceCardId) {
    throw new Error("DiscardForAttackEffect requires sourceCardId");
  }

  // Create pending discard-for-attack state
  const pending: PendingDiscardForAttack = {
    sourceCardId,
    attackPerCard: effect.attackPerCard,
    combatType: effect.combatType,
  };

  const updatedPlayer: Player = {
    ...player,
    pendingDiscardForAttack: pending,
  };

  const updatedState = updatePlayer(state, playerIndex, updatedPlayer);

  return {
    state: updatedState,
    description: `${sourceCardId} allows discarding cards for Attack ${effect.attackPerCard} each`,
    requiresChoice: true, // Blocks further resolution until player selects cards
  };
}

// ============================================================================
// FAME PER ENEMY DEFEATED EFFECT
// ============================================================================

/**
 * Handle the EFFECT_FAME_PER_ENEMY_DEFEATED effect.
 *
 * This effect awards fame based on enemies defeated this turn.
 * The player.enemiesDefeatedThisTurn counter tracks non-summoned enemies.
 *
 * Note: This effect should typically be resolved at the end of combat or turn
 * when the final count of defeated enemies is known.
 */
export function handleFamePerEnemyDefeated(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: FamePerEnemyDefeatedEffect
): EffectResolutionResult {
  // Get count of enemies defeated this turn
  // Note: excludeSummoned is handled at the tracking level (enemiesDefeatedThisTurn
  // already excludes summoned enemies)
  const enemiesDefeated = player.enemiesDefeatedThisTurn;

  if (enemiesDefeated === 0) {
    return {
      state,
      description: "No enemies defeated this turn for fame bonus",
    };
  }

  const fameToGain = enemiesDefeated * effect.famePerEnemy;

  // Apply fame gain
  return applyGainFame(state, playerIndex, player, fameToGain);
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register Sword of Justice effect handlers with the effect registry.
 * Called during effect system initialization.
 */
export function registerSwordOfJusticeEffects(): void {
  registerEffect(
    EFFECT_DISCARD_FOR_ATTACK,
    (state, playerId, effect, sourceCardId) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleDiscardForAttack(
        state,
        playerIndex,
        player,
        effect as DiscardForAttackEffect,
        (sourceCardId as CardId | undefined) ?? null
      );
    }
  );

  registerEffect(
    EFFECT_FAME_PER_ENEMY_DEFEATED,
    (state, playerId, effect) => {
      const { playerIndex, player } = getPlayerContext(state, playerId);
      return handleFamePerEnemyDefeated(
        state,
        playerIndex,
        player,
        effect as FamePerEnemyDefeatedEffect
      );
    }
  );
}
