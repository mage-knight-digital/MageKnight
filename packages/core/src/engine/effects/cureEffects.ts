/**
 * Cure / Disease spell effect handlers
 *
 * Cure (Basic):
 * - Heal `amount` wounds from hand
 * - Draw a card for each wound healed from hand this turn (including just now)
 * - Ready each unit healed this turn
 * - Set a turn-scoped modifier so future healing triggers draws/readies
 *
 * Disease (Powered):
 * - All enemies with ALL attacks blocked get armor reduced to 1
 * - Applied as a combat-scoped modifier on each fully-blocked enemy
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CureEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND, UNITS, UNIT_STATE_READY } from "@mage-knight/shared";
import { updatePlayer } from "./atomicEffects.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { addModifier } from "../modifiers/index.js";
import { EFFECT_CURE, EFFECT_DISEASE } from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  DURATION_TURN,
  EFFECT_CURE_ACTIVE,
  EFFECT_DISEASE_ARMOR,
  SCOPE_ONE_ENEMY,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { CARD_CURE } from "@mage-knight/shared";
import { isEnemyFullyBlocked } from "../combat/enemyAttackHelpers.js";

// ============================================================================
// CURE EFFECT
// ============================================================================

/**
 * Handle the Cure basic effect.
 *
 * 1. Heal `amount` wounds from hand (and track in woundsHealedFromHandThisTurn)
 * 2. Draw cards = woundsHealedFromHandThisTurn (total, including just healed)
 * 3. Ready all units in unitsHealedThisTurn
 * 4. Add CURE_ACTIVE modifier for future healing triggers
 */
export function handleCureEffect(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: CureEffect
): EffectResolutionResult {
  const amount = effect.amount;
  const descriptions: string[] = [];

  // Step 1: Heal wounds from hand
  const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;
  const woundsToHeal = Math.min(amount, woundsInHand);

  let currentPlayer = player;

  if (woundsToHeal > 0) {
    const newHand = [...currentPlayer.hand];
    for (let i = 0; i < woundsToHeal; i++) {
      const woundIndex = newHand.indexOf(CARD_WOUND);
      if (woundIndex !== -1) {
        newHand.splice(woundIndex, 1);
      }
    }

    currentPlayer = {
      ...currentPlayer,
      hand: newHand,
      woundsHealedFromHandThisTurn: currentPlayer.woundsHealedFromHandThisTurn + woundsToHeal,
    };

    descriptions.push(
      woundsToHeal === 1 ? "Healed 1 wound" : `Healed ${woundsToHeal} wounds`
    );
  }

  // Return wounds to the wound pile
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + woundsToHeal;

  let currentState: GameState = {
    ...updatePlayer(state, playerIndex, currentPlayer),
    woundPileCount: newWoundPileCount,
  };

  // Re-read player from state after update
  currentPlayer = currentState.players[playerIndex]!;

  // Step 2: Draw cards for wounds healed from hand this turn
  const totalWoundsHealed = currentPlayer.woundsHealedFromHandThisTurn;
  if (totalWoundsHealed > 0) {
    const availableInDeck = currentPlayer.deck.length;
    const cardsToDraw = Math.min(totalWoundsHealed, availableInDeck);

    if (cardsToDraw > 0) {
      const drawnCards = currentPlayer.deck.slice(0, cardsToDraw);
      const newDeck = currentPlayer.deck.slice(cardsToDraw);
      const newHand = [...currentPlayer.hand, ...drawnCards];

      currentPlayer = {
        ...currentPlayer,
        hand: newHand,
        deck: newDeck,
      };

      currentState = updatePlayer(currentState, playerIndex, currentPlayer);

      descriptions.push(
        cardsToDraw === 1
          ? "Drew 1 card (Cure)"
          : `Drew ${cardsToDraw} cards (Cure)`
      );
    }
  }

  // Step 3: Ready all units healed this turn
  const unitsToReady = currentPlayer.unitsHealedThisTurn;
  if (unitsToReady.length > 0) {
    const updatedUnits = currentPlayer.units.map((unit) => {
      if (
        unitsToReady.includes(unit.instanceId) &&
        unit.state !== UNIT_STATE_READY
      ) {
        return { ...unit, state: UNIT_STATE_READY as const };
      }
      return unit;
    });

    const readiedCount = currentPlayer.units.filter(
      (unit) =>
        unitsToReady.includes(unit.instanceId) &&
        unit.state !== UNIT_STATE_READY
    ).length;

    if (readiedCount > 0) {
      currentPlayer = { ...currentPlayer, units: updatedUnits };
      currentState = updatePlayer(currentState, playerIndex, currentPlayer);

      const readiedNames = currentPlayer.units
        .filter((u) => unitsToReady.includes(u.instanceId))
        .map((u) => UNITS[u.unitId]?.name ?? u.unitId);

      descriptions.push(`Readied ${readiedNames.join(", ")}`);
    }
  }

  // Step 4: Add CURE_ACTIVE modifier for future healing triggers
  currentState = addModifier(currentState, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_CURE,
      playerId: currentState.players[playerIndex]!.id,
    },
    duration: DURATION_TURN,
    scope: { type: SCOPE_SELF },
    effect: { type: EFFECT_CURE_ACTIVE },
    createdAtRound: currentState.round,
    createdByPlayerId: currentState.players[playerIndex]!.id,
  });

  return {
    state: currentState,
    description: descriptions.length > 0
      ? descriptions.join(". ")
      : "No wounds to heal",
  };
}

// ============================================================================
// DISEASE EFFECT
// ============================================================================

/**
 * Handle the Disease powered effect.
 *
 * All enemies that have ALL their attacks blocked get armor reduced to 1.
 * Applied as a combat-scoped DiseaseArmor modifier on each qualifying enemy.
 */
export function handleDiseaseEffect(
  state: GameState,
  playerId: string
): EffectResolutionResult {
  if (!state.combat) {
    return {
      state,
      description: "Not in combat",
    };
  }

  const descriptions: string[] = [];
  let currentState = state;

  for (const enemy of state.combat.enemies) {
    // Skip defeated enemies
    if (enemy.isDefeated) continue;

    // Check if ALL attacks are blocked
    if (!isEnemyFullyBlocked(enemy)) continue;

    // Apply Disease armor modifier: set armor to 1
    currentState = addModifier(currentState, {
      source: {
        type: SOURCE_CARD,
        cardId: CARD_CURE,
        playerId,
      },
      duration: DURATION_COMBAT,
      scope: { type: SCOPE_ONE_ENEMY, enemyId: enemy.instanceId },
      effect: { type: EFFECT_DISEASE_ARMOR, setTo: 1 },
      createdAtRound: currentState.round,
      createdByPlayerId: playerId,
    });

    descriptions.push(`${enemy.definition.name} armor reduced to 1`);
  }

  return {
    state: currentState,
    description: descriptions.length > 0
      ? descriptions.join(", ")
      : "No fully-blocked enemies",
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

export function registerCureEffects(): void {
  registerEffect(EFFECT_CURE, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return handleCureEffect(state, playerIndex, player, effect as CureEffect);
  });

  registerEffect(EFFECT_DISEASE, (state, playerId) => {
    return handleDiseaseEffect(state, playerId);
  });
}
