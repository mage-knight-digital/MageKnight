/**
 * Card playability computation for normal (non-combat) turns.
 *
 * Determines which cards in the player's hand can be played during
 * movement, interaction, and other non-combat phases.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { DeedCard } from "../../../types/cards.js";
import type { PlayCardOptions, PlayableCard, ManaColor, ManaSourceInfo, SidewaysOption } from "@mage-knight/shared";
import { DEED_CARD_TYPE_WOUND, DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { describeEffect } from "../../effects/describeEffect.js";
import { isEffectResolvable } from "../../effects/index.js";
import { getCard } from "./index.js";
import { canPayForSpellBasic, findPayableManaColor, computePoweredManaOptions } from "./manaPayment.js";
import { getEffectiveSidewaysValue, isRuleActive, getModifiersForPlayer } from "../../modifiers/index.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS, EFFECT_SIDEWAYS_VALUE, SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR } from "../../../types/modifierConstants.js";
import type { SidewaysValueModifier } from "../../../types/modifiers.js";
import { getSidewaysOptionsForValue, getSidewaysContext, canPlaySideways } from "../../rules/sideways.js";
import {
  isNormalEffectAllowed,
  isTimeBendingChainPrevented,
  cardConsumesAction,
  isDiscardCostPayableAfterPlayingSource,
} from "../../rules/cardPlay.js";
import { EFFECT_CARD_BOOST } from "../../../types/effectTypes.js";
import { getEligibleBoostTargets } from "../../effects/cardBoostEffects.js";

interface CardPlayability {
  canPlayBasic: boolean;
  canPlayPowered: boolean;
  canPlaySideways: boolean;
  sidewaysOptions: SidewaysOption[];
}

/**
 * Get playable cards for normal (non-combat) turns.
 *
 * During a normal turn, cards can provide:
 * - Move points
 * - Influence points
 * - Healing
 * - Sideways: +1 Move/Influence
 */
export function getPlayableCardsForNormalTurn(
  state: GameState,
  player: Player
): PlayCardOptions {
  const cards: PlayableCard[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    // Wounds are only playable sideways when a rule override allows it
    if (card.cardType === DEED_CARD_TYPE_WOUND) {
      if (!isRuleActive(state, player.id, RULE_WOUNDS_PLAYABLE_SIDEWAYS)) {
        continue;
      }

      if (!canPlaySideways(state, player.isResting, player.hasRestedThisTurn)) {
        continue;
      }

      const sidewaysValue = getEffectiveSidewaysValue(
        state,
        player.id,
        true,
        player.usedManaFromSource
      );

      if (sidewaysValue <= 0) {
        continue;
      }

      const woundSidewaysOptions = getSidewaysOptionsForValue(
        sidewaysValue,
        getSidewaysContext(state, player.hasRestedThisTurn)
      );

      if (woundSidewaysOptions.length === 0) {
        continue;
      }

      cards.push({
        cardId,
        name: card.name,
        canPlayBasic: false,
        canPlayPowered: false,
        canPlaySideways: true,
        basicEffectDescription: describeEffect(card.basicEffect),
        poweredEffectDescription: describeEffect(card.poweredEffect),
        sidewaysOptions: [...woundSidewaysOptions],
      });

      continue;
    }

    // CATEGORY_ACTION cards cannot be played when action already taken
    const isActionCard = cardConsumesAction(card);
    if (isActionCard && player.hasTakenActionThisTurn) {
      continue;
    }

    const playability = getCardPlayabilityForNormalTurn(state, player, card);

    // For spells, basic effect also requires mana (the spell's color)
    const spellBasicManaAvailable = card.cardType === DEED_CARD_TYPE_SPELL
      ? canPayForSpellBasic(state, player, card)
      : true;
    const canActuallyPlayBasic = playability.canPlayBasic && spellBasicManaAvailable;

    // Check if the card has a powered effect AND player can pay for it
    // Also check Time Bending chain prevention (cannot play Space Bending powered during Time Bent turn)
    const chainPrevented = isTimeBendingChainPrevented(cardId, true, player.isTimeBentTurn);
    const payableManaColor = playability.canPlayPowered && !chainPrevented
      ? findPayableManaColor(state, player, card)
      : undefined;
    const canActuallyPlayPowered = payableManaColor !== undefined;
    const canPlayByEffect = canActuallyPlayBasic || canActuallyPlayPowered;

    // While resting, only surface cards that can be played for an actual effect.
    // Sideways-only suggestions create false positives for cards that can't be
    // meaningfully used during rest (e.g., combat-only spells).
    const canPlaySidewaysInContext =
      playability.canPlaySideways && canPlaySideways(state, player.isResting, player.hasRestedThisTurn);

    if (canPlayByEffect || canPlaySidewaysInContext) {
      const playableCard: PlayableCard = {
        cardId,
        name: card.name,
        canPlayBasic: canActuallyPlayBasic,
        canPlayPowered: canActuallyPlayPowered,
        canPlaySideways: canPlaySidewaysInContext,
        basicEffectDescription: describeEffect(card.basicEffect),
        poweredEffectDescription: describeEffect(card.poweredEffect),
      };

      // Only add optional properties when they have values
      if (payableManaColor && canActuallyPlayPowered) {
        (playableCard as { requiredMana?: ManaColor }).requiredMana = payableManaColor;
        const manaOpts = computePoweredManaOptions(state, player, card, payableManaColor);
        if (manaOpts) {
          (playableCard as { poweredManaOptions?: readonly ManaSourceInfo[] }).poweredManaOptions = manaOpts;
        }
      }
      if (card.cardType === DEED_CARD_TYPE_SPELL) {
        (playableCard as { isSpell?: boolean }).isSpell = true;
      }
      if (
        canPlaySidewaysInContext &&
        playability.sidewaysOptions &&
        playability.sidewaysOptions.length > 0
      ) {
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
  player: Player,
  card: DeedCard
): CardPlayability {
  const basicHasUsefulEffect = isNormalEffectAllowed(card.basicEffect, "basic");
  const basicDiscardCostPayable = isDiscardCostPayableAfterPlayingSource(
    card.basicEffect,
    player.hand,
    card.id
  );

  const basicIsResolvable = isEffectResolvable(state, player.id, card.basicEffect);

  // Check if powered effect has a useful effect type AND is resolvable
  const poweredHasUsefulEffect = isNormalEffectAllowed(
    card.poweredEffect,
    "powered"
  );
  const poweredDiscardCostPayable = isDiscardCostPayableAfterPlayingSource(
    card.poweredEffect,
    player.hand,
    card.id
  );

  let poweredIsResolvable = isEffectResolvable(state, player.id, card.poweredEffect);

  // For card boost effects (Concentration/Will Focus), additionally check that
  // at least one target card's powered effect can actually be resolved after both
  // the source and target leave the hand (e.g., discard costs are payable).
  if (poweredIsResolvable && card.poweredEffect.type === EFFECT_CARD_BOOST) {
    poweredIsResolvable = getEligibleBoostTargets(player, card.id).length > 0;
  }

  // Determine if Universal Power mana color matches this card's color
  let manaColorMatchesCard: boolean | undefined;
  const playerMods = getModifiersForPlayer(state, player.id);
  const colorMatchMod = playerMods.find(
    (m) =>
      m.effect.type === EFFECT_SIDEWAYS_VALUE &&
      (m.effect as SidewaysValueModifier).condition === SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR &&
      (m.effect as SidewaysValueModifier).manaColor != null
  );
  if (colorMatchMod) {
    const mod = colorMatchMod.effect as SidewaysValueModifier;
    manaColorMatchesCard = card.poweredBy?.includes(mod.manaColor!) ?? false;
  }

  // Calculate effective sideways value (accounts for skill modifiers like I Don't Give a Damn)
  const effectiveSidewaysValue = getEffectiveSidewaysValue(
    state,
    player.id,
    false,
    player.usedManaFromSource,
    manaColorMatchesCard,
    card.cardType
  );

  // Sideways options for normal turn: move and/or influence (move excluded after rest)
  const sidewaysOptions: SidewaysOption[] = [
    ...getSidewaysOptionsForValue(
      effectiveSidewaysValue,
      getSidewaysContext(state, player.hasRestedThisTurn)
    ),
  ];

  return {
    canPlayBasic: basicHasUsefulEffect && basicDiscardCostPayable && basicIsResolvable,
    canPlayPowered: poweredHasUsefulEffect && poweredDiscardCostPayable && poweredIsResolvable,
    canPlaySideways: sidewaysOptions.length > 0,
    sidewaysOptions,
  };
}
