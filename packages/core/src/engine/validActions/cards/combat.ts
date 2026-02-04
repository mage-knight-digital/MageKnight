/**
 * Card playability computation for combat.
 *
 * Determines which cards in the player's hand can be played during each combat phase.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { CombatState, CombatPhase } from "../../../types/combat.js";
import type { DeedCard } from "../../../types/cards.js";
import type { PlayCardOptions, PlayableCard, ManaColor, SidewaysOption } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
} from "@mage-knight/shared";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
} from "../../../types/combat.js";
import { DEED_CARD_TYPE_WOUND, DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { describeEffect } from "../../effects/describeEffect.js";
import { filterHealingEffectsForCombat, isEffectResolvable } from "../../effects/index.js";
import { getCard } from "./index.js";
import { canPayForSpellBasic, findPayableManaColor } from "./manaPayment.js";
import {
  effectHasRangedOrSiege,
  effectHasBlock,
  effectHasAttack,
  effectIsUtility,
} from "./effectDetection/index.js";
import {
  getEffectCategories,
  hasHealingCategory,
  isHealingOnlyCategories,
  type CardEffectKind,
} from "../../helpers/cardCategoryHelpers.js";
import type { CardEffect } from "../../../types/cards.js";

interface CardPlayability {
  canPlayBasic: boolean;
  canPlayPowered: boolean;
  canPlaySideways: boolean;
  sidewaysOptions: SidewaysOption[];
}

interface CombatEffectContext {
  readonly effect: CardEffect | null;
  readonly allowAnyPhase: boolean;
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

    const basicContext = getCombatEffectContext(card, "basic");
    const poweredContext = getCombatEffectContext(card, "powered");
    const playability = getCardPlayabilityForPhase(card, combat.phase, basicContext, poweredContext);

    // Check resolvability - effect must actually be able to do something
    const basicIsResolvable = basicContext.effect
      ? isEffectResolvable(state, player.id, basicContext.effect)
      : false;
    const poweredIsResolvable = poweredContext.effect
      ? isEffectResolvable(state, player.id, poweredContext.effect)
      : false;

    // For spells, basic effect also requires mana (the spell's color)
    // Get the spell's color from poweredBy (excluding black)
    const spellBasicManaAvailable = card.cardType === DEED_CARD_TYPE_SPELL
      ? canPayForSpellBasic(state, player, card)
      : true; // Action cards don't need mana for basic effect

    // Can only play basic if the phase allows it AND the effect is resolvable
    // AND for spells, the player has the spell's color mana
    const canActuallyPlayBasic = playability.canPlayBasic && basicIsResolvable && spellBasicManaAvailable;

    // Check if the card has a powered effect for this phase AND player can pay for it AND it's resolvable
    const payableManaColor = (playability.canPlayPowered && poweredIsResolvable)
      ? findPayableManaColor(state, player, card)
      : undefined;
    const canActuallyPlayPowered = payableManaColor !== undefined;

    if (canActuallyPlayBasic || canActuallyPlayPowered || playability.canPlaySideways) {
      const playableCard: PlayableCard = {
        cardId,
        name: card.name,
        canPlayBasic: canActuallyPlayBasic,
        canPlayPowered: canActuallyPlayPowered,
        canPlaySideways: playability.canPlaySideways,
        basicEffectDescription: describeEffect(basicContext.effect ?? card.basicEffect),
        poweredEffectDescription: describeEffect(poweredContext.effect ?? card.poweredEffect),
      };

      // Only add optional properties when they have values
      if (payableManaColor && canActuallyPlayPowered) {
        (playableCard as { requiredMana?: ManaColor }).requiredMana = payableManaColor;
      }
      if (card.cardType === DEED_CARD_TYPE_SPELL) {
        (playableCard as { isSpell?: boolean }).isSpell = true;
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
 * Determine if a card can be played in a specific combat phase.
 */
function getCardPlayabilityForPhase(
  card: DeedCard,
  phase: CombatPhase,
  basicContext: CombatEffectContext,
  poweredContext: CombatEffectContext
): CardPlayability {
  const basicEffect = basicContext.effect;
  const poweredEffect = poweredContext.effect;

  const basicUtility =
    basicEffect !== null &&
    (effectHasRangedOrSiege(basicEffect) ||
      effectIsUtility(basicEffect) ||
      basicContext.allowAnyPhase);

  const poweredUtility =
    poweredEffect !== null &&
    (effectHasRangedOrSiege(poweredEffect) ||
      effectIsUtility(poweredEffect) ||
      poweredContext.allowAnyPhase);

  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        // Ranged/siege phase: can play for ranged/siege attack OR utility effects
        canPlayBasic: basicUtility,
        canPlayPowered: poweredUtility,
        canPlaySideways: false, // Can't play sideways for ranged/siege
        sidewaysOptions: [],
      };

    case COMBAT_PHASE_BLOCK:
      return {
        // Block phase: can play for block OR utility effects
        canPlayBasic:
          basicEffect !== null &&
          (effectHasBlock(basicEffect) || effectIsUtility(basicEffect) || basicContext.allowAnyPhase),
        canPlayPowered:
          poweredEffect !== null &&
          (effectHasBlock(poweredEffect) || effectIsUtility(poweredEffect) || poweredContext.allowAnyPhase),
        canPlaySideways: card.sidewaysValue > 0,
        sidewaysOptions: card.sidewaysValue > 0
          ? [{ as: PLAY_SIDEWAYS_AS_BLOCK, value: card.sidewaysValue }]
          : [],
      };

    case COMBAT_PHASE_ATTACK:
      return {
        // Attack phase: can play for attack OR utility effects
        canPlayBasic:
          basicEffect !== null &&
          (effectHasAttack(basicEffect) || effectIsUtility(basicEffect) || basicContext.allowAnyPhase),
        canPlayPowered:
          poweredEffect !== null &&
          (effectHasAttack(poweredEffect) || effectIsUtility(poweredEffect) || poweredContext.allowAnyPhase),
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

function getCombatEffectContext(
  card: DeedCard,
  effectKind: CardEffectKind
): CombatEffectContext {
  const categories = getEffectCategories(card, effectKind);
  const isHealingOnly = isHealingOnlyCategories(categories);
  const hasHealing = hasHealingCategory(categories);
  const allowAnyPhase = hasHealing && !isHealingOnly;

  const baseEffect = effectKind === "basic" ? card.basicEffect : card.poweredEffect;

  if (!hasHealing) {
    return { effect: baseEffect, allowAnyPhase: false };
  }

  if (isHealingOnly) {
    return { effect: null, allowAnyPhase: false };
  }

  const filteredEffect = filterHealingEffectsForCombat(baseEffect);
  return { effect: filteredEffect, allowAnyPhase };
}
