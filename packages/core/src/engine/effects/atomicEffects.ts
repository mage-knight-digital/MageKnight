/**
 * Atomic effect handlers - pure leaf functions that don't recurse back into resolveEffect.
 *
 * These handle direct state transformations:
 * - Gain move/influence/attack/block/healing/mana
 * - Draw cards
 * - Change reputation
 * - Gain crystals
 * - Apply modifiers
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, AccumulatedAttack, ElementalAttackValues } from "../../types/player.js";
import type { CardId, Element, BlockSource, ManaColor, BasicManaColor } from "@mage-knight/shared";
import type { GainAttackEffect, GainBlockEffect, ApplyModifierEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import { CARD_WOUND, MANA_TOKEN_SOURCE_CARD, MIN_REPUTATION, MAX_REPUTATION } from "@mage-knight/shared";
import { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE, ELEMENT_PHYSICAL } from "@mage-knight/shared";
import { COMBAT_TYPE_RANGED, COMBAT_TYPE_SIEGE } from "../../types/effectTypes.js";
import { addModifier } from "../modifiers.js";
import { SOURCE_CARD, SCOPE_SELF } from "../modifierConstants.js";

// === Shared helpers ===

export function updatePlayer(
  state: GameState,
  playerIndex: number,
  updatedPlayer: Player
): GameState {
  const players = [...state.players];
  players[playerIndex] = updatedPlayer;
  return { ...state, players };
}

/**
 * Helper to update elemental values
 */
export function updateElementalValue(
  values: ElementalAttackValues,
  element: Element | undefined,
  amount: number
): ElementalAttackValues {
  if (!element) {
    return { ...values, physical: values.physical + amount };
  }
  switch (element) {
    case ELEMENT_FIRE:
      return { ...values, fire: values.fire + amount };
    case ELEMENT_ICE:
      return { ...values, ice: values.ice + amount };
    case ELEMENT_COLD_FIRE:
      return { ...values, coldFire: values.coldFire + amount };
    default:
      return { ...values, physical: values.physical + amount };
  }
}

// Re-export for reverseEffect (imported from @mage-knight/shared)
export { MIN_REPUTATION, MAX_REPUTATION };

// === Atomic effect handlers ===

export function applyGainMove(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    movePoints: player.movePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Move`,
  };
}

export function applyGainInfluence(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const updatedPlayer: Player = {
    ...player,
    influencePoints: player.influencePoints + amount,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} Influence`,
  };
}

export function applyGainMana(
  state: GameState,
  playerIndex: number,
  player: Player,
  color: ManaColor
): EffectResolutionResult {
  const newToken = {
    color,
    source: MANA_TOKEN_SOURCE_CARD,
  };

  const updatedPlayer: Player = {
    ...player,
    pureMana: [...player.pureMana, newToken],
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${color} mana token`,
  };
}

export function applyChangeReputation(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Clamp to -7 to +7 range
  const newReputation = Math.max(
    MIN_REPUTATION,
    Math.min(MAX_REPUTATION, player.reputation + amount)
  );

  const updatedPlayer: Player = {
    ...player,
    reputation: newReputation,
  };

  const direction = amount >= 0 ? "Gained" : "Lost";
  const absAmount = Math.abs(amount);

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `${direction} ${absAmount} Reputation`,
  };
}

export function applyGainCrystal(
  state: GameState,
  playerIndex: number,
  player: Player,
  color: BasicManaColor
): EffectResolutionResult {
  const updatedCrystals = {
    ...player.crystals,
    [color]: player.crystals[color] + 1,
  };

  const updatedPlayer: Player = {
    ...player,
    crystals: updatedCrystals,
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${color} crystal`,
  };
}

export function applyGainAttack(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainAttackEffect
): EffectResolutionResult {
  const { amount, combatType, element } = effect;
  const currentAttack = player.combatAccumulator.attack;
  let updatedAttack: AccumulatedAttack;
  let attackTypeName: string;

  // If there's an element, track it in the elemental values
  // Otherwise, track in the main value
  switch (combatType) {
    case COMBAT_TYPE_RANGED:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          rangedElements: updateElementalValue(currentAttack.rangedElements, element, amount),
        };
        attackTypeName = `${element} Ranged Attack`;
      } else {
        updatedAttack = { ...currentAttack, ranged: currentAttack.ranged + amount };
        attackTypeName = "Ranged Attack";
      }
      break;
    case COMBAT_TYPE_SIEGE:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          siegeElements: updateElementalValue(currentAttack.siegeElements, element, amount),
        };
        attackTypeName = `${element} Siege Attack`;
      } else {
        updatedAttack = { ...currentAttack, siege: currentAttack.siege + amount };
        attackTypeName = "Siege Attack";
      }
      break;
    default:
      if (element) {
        updatedAttack = {
          ...currentAttack,
          normalElements: updateElementalValue(currentAttack.normalElements, element, amount),
        };
        attackTypeName = `${element} Attack`;
      } else {
        updatedAttack = { ...currentAttack, normal: currentAttack.normal + amount };
        attackTypeName = "Attack";
      }
      break;
  }

  const updatedPlayer: Player = {
    ...player,
    combatAccumulator: {
      ...player.combatAccumulator,
      attack: updatedAttack,
    },
  };

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} ${attackTypeName}`,
  };
}

export function applyGainBlock(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: GainBlockEffect
): EffectResolutionResult {
  const { amount, element } = effect;
  let updatedPlayer: Player;
  let blockTypeName: string;

  // Create a block source for tracking (for elemental efficiency calculations)
  const blockSource: BlockSource = {
    element: element ?? ELEMENT_PHYSICAL,
    value: amount,
  };

  if (element) {
    // Track elemental block
    updatedPlayer = {
      ...player,
      combatAccumulator: {
        ...player.combatAccumulator,
        blockElements: updateElementalValue(player.combatAccumulator.blockElements, element, amount),
        blockSources: [...player.combatAccumulator.blockSources, blockSource],
      },
    };
    blockTypeName = `${element} Block`;
  } else {
    // Track physical block
    updatedPlayer = {
      ...player,
      combatAccumulator: {
        ...player.combatAccumulator,
        block: player.combatAccumulator.block + amount,
        blockSources: [...player.combatAccumulator.blockSources, blockSource],
      },
    };
    blockTypeName = "Block";
  }

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Gained ${amount} ${blockTypeName}`,
  };
}

export function applyGainHealing(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Count wounds in hand
  const woundsInHand = player.hand.filter((c) => c === CARD_WOUND).length;

  if (woundsInHand === 0) {
    // No wounds to heal (shouldn't normally happen since isEffectResolvable checks this)
    return { state, description: "No wounds to heal" };
  }

  // Heal up to 'amount' wounds (each healing point removes one wound)
  const woundsToHeal = Math.min(amount, woundsInHand);

  // Remove wound cards from hand
  const newHand = [...player.hand];
  for (let i = 0; i < woundsToHeal; i++) {
    const woundIndex = newHand.indexOf(CARD_WOUND);
    if (woundIndex !== -1) {
      newHand.splice(woundIndex, 1);
    }
  }

  const updatedPlayer: Player = {
    ...player,
    hand: newHand,
  };

  // Return wounds to the wound pile (unlimited => stay null)
  const newWoundPileCount =
    state.woundPileCount === null ? null : state.woundPileCount + woundsToHeal;

  const updatedState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };

  const description =
    woundsToHeal === 1
      ? "Healed 1 wound"
      : `Healed ${woundsToHeal} wounds`;

  return {
    state: updatedState,
    description,
  };
}

export function applyDrawCards(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  const availableInDeck = player.deck.length;
  const actualDraw = Math.min(amount, availableInDeck);

  if (actualDraw === 0) {
    return { state, description: "No cards to draw" };
  }

  // Draw from top of deck to hand (no mid-round reshuffle per rulebook)
  const drawnCards = player.deck.slice(0, actualDraw);
  const newDeck = player.deck.slice(actualDraw);
  const newHand = [...player.hand, ...drawnCards];

  const updatedPlayer: Player = {
    ...player,
    deck: newDeck,
    hand: newHand,
  };

  const description =
    actualDraw === 1 ? "Drew 1 card" : `Drew ${actualDraw} cards`;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description,
  };
}

/**
 * Apply "take wound" effect - adds wound cards directly to hand.
 * This is a COST, not combat damage - it bypasses armor.
 * Used by Fireball powered, Snowstorm powered, etc.
 */
export function applyTakeWound(
  state: GameState,
  playerIndex: number,
  player: Player,
  amount: number
): EffectResolutionResult {
  // Create wound cards to add to hand
  const woundsToAdd: CardId[] = Array(amount).fill(CARD_WOUND);

  const updatedPlayer: Player = {
    ...player,
    hand: [...player.hand, ...woundsToAdd],
  };

  // Decrement wound pile (if tracked)
  const newWoundPileCount =
    state.woundPileCount === null ? null : Math.max(0, state.woundPileCount - amount);

  const updatedState = {
    ...updatePlayer(state, playerIndex, updatedPlayer),
    woundPileCount: newWoundPileCount,
  };

  const description =
    amount === 1 ? "Took 1 wound" : `Took ${amount} wounds`;

  return {
    state: updatedState,
    description,
  };
}

export function applyModifierEffect(
  state: GameState,
  playerId: string,
  effect: ApplyModifierEffect,
  sourceCardId?: string
): EffectResolutionResult {
  // Use scope from effect if provided, otherwise default to SCOPE_SELF
  const scope = effect.scope ?? { type: SCOPE_SELF };

  const newState = addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: (sourceCardId ?? "unknown") as CardId,
      playerId,
    },
    duration: effect.duration,
    scope,
    effect: effect.modifier,
    createdAtRound: state.round,
    createdByPlayerId: playerId,
  });

  return {
    state: newState,
    description: effect.description ?? "Applied modifier",
  };
}
