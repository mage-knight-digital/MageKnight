/**
 * Card playability computation for combat
 *
 * Determines which cards in the player's hand can be played during each combat phase.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CombatState, CombatPhase } from "../../types/combat.js";
import type { CardEffect, DeedCard } from "../../types/cards.js";
import type { PlayCardOptions, PlayableCard, ManaColor, SidewaysOption } from "@mage-knight/shared";
import {
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
} from "@mage-knight/shared";
import { canPayForMana } from "./mana.js";
import {
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
} from "../../types/effectTypes.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../types/combat.js";
import { getBasicActionCard } from "../../data/basicActions.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";

/**
 * Find the first mana color from the card's poweredBy array that the player can pay for.
 * Returns undefined if the card cannot be powered or the player can't pay for any of the colors.
 */
function findPayableManaColor(
  state: GameState,
  player: Player,
  card: DeedCard
): ManaColor | undefined {
  if (card.poweredBy.length === 0) return undefined;
  return card.poweredBy.find((color) => canPayForMana(state, player, color));
}

/**
 * Get playable cards for combat based on the current phase.
 */
export function getPlayableCardsForCombat(
  state: GameState,
  player: Player,
  combat: CombatState
): PlayCardOptions {
  const cards: PlayableCard[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    // Wounds cannot be played
    if (card.cardType === DEED_CARD_TYPE_WOUND) continue;

    const playability = getCardPlayabilityForPhase(card, combat.phase);

    // Check if the card has a powered effect for this phase AND player can pay for it
    const payableManaColor = playability.canPlayPowered
      ? findPayableManaColor(state, player, card)
      : undefined;
    const canActuallyPlayPowered = payableManaColor !== undefined;

    if (playability.canPlayBasic || canActuallyPlayPowered || playability.canPlaySideways) {
      const playableCard: PlayableCard = {
        cardId,
        canPlayBasic: playability.canPlayBasic,
        canPlayPowered: canActuallyPlayPowered,
        canPlaySideways: playability.canPlaySideways,
      };

      // Only add optional properties when they have values
      if (payableManaColor && canActuallyPlayPowered) {
        (playableCard as { requiredMana?: ManaColor }).requiredMana = payableManaColor;
      }
      if (playability.sidewaysOptions && playability.sidewaysOptions.length > 0) {
        (playableCard as { sidewaysOptions?: readonly SidewaysOption[] }).sidewaysOptions = playability.sidewaysOptions;
      }

      cards.push(playableCard);
    }
  }

  return { cards };
}

interface CardPlayability {
  canPlayBasic: boolean;
  canPlayPowered: boolean;
  canPlaySideways: boolean;
  sidewaysOptions: SidewaysOption[];
}

/**
 * Determine if a card can be played in a specific combat phase.
 */
function getCardPlayabilityForPhase(
  card: DeedCard,
  phase: CombatPhase
): CardPlayability {
  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        canPlayBasic: effectHasRangedOrSiege(card.basicEffect),
        canPlayPowered: effectHasRangedOrSiege(card.poweredEffect),
        canPlaySideways: false, // Can't play sideways for ranged/siege
        sidewaysOptions: [],
      };

    case COMBAT_PHASE_BLOCK:
      return {
        canPlayBasic: effectHasBlock(card.basicEffect),
        canPlayPowered: effectHasBlock(card.poweredEffect),
        canPlaySideways: card.sidewaysValue > 0,
        sidewaysOptions: card.sidewaysValue > 0
          ? [{ as: PLAY_SIDEWAYS_AS_BLOCK, value: card.sidewaysValue }]
          : [],
      };

    case COMBAT_PHASE_ATTACK:
      return {
        canPlayBasic: effectHasAttack(card.basicEffect),
        canPlayPowered: effectHasAttack(card.poweredEffect),
        canPlaySideways: card.sidewaysValue > 0,
        sidewaysOptions: card.sidewaysValue > 0
          ? [{ as: PLAY_SIDEWAYS_AS_ATTACK, value: card.sidewaysValue }]
          : [],
      };

    default:
      // ASSIGN_DAMAGE phase - no cards played
      return {
        canPlayBasic: false,
        canPlayPowered: false,
        canPlaySideways: false,
        sidewaysOptions: [],
      };
  }
}

/**
 * Check if an effect provides ranged or siege attack.
 */
function effectHasRangedOrSiege(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
      return effect.combatType === COMBAT_TYPE_RANGED || effect.combatType === COMBAT_TYPE_SIEGE;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasRangedOrSiege(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasRangedOrSiege(eff));

    case EFFECT_CONDITIONAL:
      return effectHasRangedOrSiege(effect.thenEffect) ||
        (effect.elseEffect ? effectHasRangedOrSiege(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasRangedOrSiege(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides block.
 */
function effectHasBlock(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_BLOCK:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasBlock(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasBlock(eff));

    case EFFECT_CONDITIONAL:
      return effectHasBlock(effect.thenEffect) ||
        (effect.elseEffect ? effectHasBlock(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasBlock(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides any attack (melee, ranged, or siege).
 */
function effectHasAttack(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_ATTACK:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasAttack(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasAttack(eff));

    case EFFECT_CONDITIONAL:
      return effectHasAttack(effect.thenEffect) ||
        (effect.elseEffect ? effectHasAttack(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasAttack(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Get a card definition by ID.
 * Currently only supports basic action cards.
 */
function getCard(cardId: string): DeedCard | null {
  try {
    // Try basic action cards first
    return getBasicActionCard(cardId as Parameters<typeof getBasicActionCard>[0]);
  } catch {
    // Card not found - might be advanced action, spell, etc.
    // TODO: Add support for other card types
    return null;
  }
}

// ============================================================================
// Normal Turn Card Playability (non-combat)
// ============================================================================

import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
} from "@mage-knight/shared";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
} from "../../types/effectTypes.js";
import { isEffectResolvable } from "../effects/resolveEffect.js";

/**
 * Get playable cards for normal (non-combat) turns.
 *
 * During a normal turn, cards can provide:
 * - Move points
 * - Influence points
 * - Healing
 * - Sideways: +1 Move or +1 Influence
 */
export function getPlayableCardsForNormalTurn(
  state: GameState,
  player: Player
): PlayCardOptions {
  const cards: PlayableCard[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    // Wounds cannot be played
    if (card.cardType === DEED_CARD_TYPE_WOUND) continue;

    const playability = getCardPlayabilityForNormalTurn(state, player.id, card);

    // Check if the card has a powered effect AND player can pay for it
    const payableManaColor = playability.canPlayPowered
      ? findPayableManaColor(state, player, card)
      : undefined;
    const canActuallyPlayPowered = payableManaColor !== undefined;

    if (playability.canPlayBasic || canActuallyPlayPowered || playability.canPlaySideways) {
      const playableCard: PlayableCard = {
        cardId,
        canPlayBasic: playability.canPlayBasic,
        canPlayPowered: canActuallyPlayPowered,
        canPlaySideways: playability.canPlaySideways,
      };

      // Only add optional properties when they have values
      if (payableManaColor && canActuallyPlayPowered) {
        (playableCard as { requiredMana?: ManaColor }).requiredMana = payableManaColor;
      }
      if (playability.sidewaysOptions && playability.sidewaysOptions.length > 0) {
        (playableCard as { sidewaysOptions?: readonly SidewaysOption[] }).sidewaysOptions = playability.sidewaysOptions;
      }

      cards.push(playableCard);
    }
  }

  return { cards };
}

/**
 * Determine if a card can be played during normal (non-combat) turn.
 *
 * An effect is playable if:
 * 1. It has a useful effect type (move, influence, heal, draw)
 * 2. The effect is actually resolvable given current game state
 *    (e.g., draw requires cards in deck, heal requires wounds)
 */
function getCardPlayabilityForNormalTurn(
  state: GameState,
  playerId: string,
  card: DeedCard
): CardPlayability {
  // Check if basic effect has move, influence, heal, draw, mana gain, or modifier AND is resolvable
  const basicHasUsefulEffect =
    effectHasMove(card.basicEffect) ||
    effectHasInfluence(card.basicEffect) ||
    effectHasHeal(card.basicEffect) ||
    effectHasDraw(card.basicEffect) ||
    effectHasManaGain(card.basicEffect) ||
    effectHasModifier(card.basicEffect);

  const basicIsResolvable = isEffectResolvable(state, playerId, card.basicEffect);

  // Check if powered effect has move, influence, heal, draw, mana gain, or modifier AND is resolvable
  const poweredHasUsefulEffect =
    effectHasMove(card.poweredEffect) ||
    effectHasInfluence(card.poweredEffect) ||
    effectHasHeal(card.poweredEffect) ||
    effectHasDraw(card.poweredEffect) ||
    effectHasManaGain(card.poweredEffect) ||
    effectHasModifier(card.poweredEffect);

  const poweredIsResolvable = isEffectResolvable(state, playerId, card.poweredEffect);

  // Sideways options for normal turn: move or influence (always available)
  const sidewaysOptions: SidewaysOption[] = [];
  if (card.sidewaysValue > 0) {
    sidewaysOptions.push({ as: PLAY_SIDEWAYS_AS_MOVE, value: card.sidewaysValue });
    sidewaysOptions.push({ as: PLAY_SIDEWAYS_AS_INFLUENCE, value: card.sidewaysValue });
  }

  return {
    canPlayBasic: basicHasUsefulEffect && basicIsResolvable,
    canPlayPowered: poweredHasUsefulEffect && poweredIsResolvable,
    canPlaySideways: card.sidewaysValue > 0,
    sidewaysOptions,
  };
}

/**
 * Check if an effect provides move points.
 */
function effectHasMove(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasMove(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasMove(eff));

    case EFFECT_CONDITIONAL:
      return effectHasMove(effect.thenEffect) ||
        (effect.elseEffect ? effectHasMove(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasMove(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides influence points.
 */
function effectHasInfluence(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_INFLUENCE:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasInfluence(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasInfluence(eff));

    case EFFECT_CONDITIONAL:
      return effectHasInfluence(effect.thenEffect) ||
        (effect.elseEffect ? effectHasInfluence(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasInfluence(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect provides healing.
 */
function effectHasHeal(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_HEALING:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasHeal(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasHeal(eff));

    case EFFECT_CONDITIONAL:
      return effectHasHeal(effect.thenEffect) ||
        (effect.elseEffect ? effectHasHeal(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasHeal(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect draws cards.
 */
function effectHasDraw(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_DRAW_CARDS:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasDraw(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasDraw(eff));

    case EFFECT_CONDITIONAL:
      return effectHasDraw(effect.thenEffect) ||
        (effect.elseEffect ? effectHasDraw(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasDraw(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect applies a modifier (e.g., Mana Draw's extra source die).
 * These are "special" effects that don't fit the standard move/influence/heal/draw categories.
 */
function effectHasModifier(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_APPLY_MODIFIER:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasModifier(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasModifier(eff));

    case EFFECT_CONDITIONAL:
      return effectHasModifier(effect.thenEffect) ||
        (effect.elseEffect ? effectHasModifier(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasModifier(effect.baseEffect);

    default:
      return false;
  }
}

/**
 * Check if an effect gains mana tokens (e.g., Concentration).
 */
function effectHasManaGain(effect: CardEffect): boolean {
  switch (effect.type) {
    case EFFECT_GAIN_MANA:
      return true;

    case EFFECT_CHOICE:
      return effect.options.some(opt => effectHasManaGain(opt));

    case EFFECT_COMPOUND:
      return effect.effects.some(eff => effectHasManaGain(eff));

    case EFFECT_CONDITIONAL:
      return effectHasManaGain(effect.thenEffect) ||
        (effect.elseEffect ? effectHasManaGain(effect.elseEffect) : false);

    case EFFECT_SCALING:
      return effectHasManaGain(effect.baseEffect);

    default:
      return false;
  }
}
