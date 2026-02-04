/**
 * Card playability computation for normal (non-combat) turns.
 *
 * Determines which cards in the player's hand can be played during
 * movement, interaction, and other non-combat phases.
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { DeedCard } from "../../../types/cards.js";
import type { PlayCardOptions, PlayableCard, ManaColor, SidewaysOption } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
} from "@mage-knight/shared";
import { DEED_CARD_TYPE_WOUND, DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import { describeEffect } from "../../effects/describeEffect.js";
import { isEffectResolvable } from "../../effects/index.js";
import { getCard } from "./index.js";
import { canPayForSpellBasic, findPayableManaColor } from "./manaPayment.js";
import { getEffectiveSidewaysValue, isRuleActive } from "../../modifiers/index.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS } from "../../modifierConstants.js";
import {
  effectHasMove,
  effectHasInfluence,
  effectHasHeal,
  effectHasDraw,
  effectHasManaGain,
  effectHasModifier,
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
} from "./effectDetection/index.js";

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

    // Wounds are only playable sideways when a rule override allows it
    if (card.cardType === DEED_CARD_TYPE_WOUND) {
      if (!isRuleActive(state, player.id, RULE_WOUNDS_PLAYABLE_SIDEWAYS)) {
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

      cards.push({
        cardId,
        name: card.name,
        canPlayBasic: false,
        canPlayPowered: false,
        canPlaySideways: true,
        basicEffectDescription: describeEffect(card.basicEffect),
        poweredEffectDescription: describeEffect(card.poweredEffect),
        sidewaysOptions: [
          { as: PLAY_SIDEWAYS_AS_MOVE, value: sidewaysValue },
          { as: PLAY_SIDEWAYS_AS_INFLUENCE, value: sidewaysValue },
        ],
      });

      continue;
    }

    const playability = getCardPlayabilityForNormalTurn(state, player.id, card);

    // For spells, basic effect also requires mana (the spell's color)
    const spellBasicManaAvailable = card.cardType === DEED_CARD_TYPE_SPELL
      ? canPayForSpellBasic(state, player, card)
      : true;
    const canActuallyPlayBasic = playability.canPlayBasic && spellBasicManaAvailable;

    // Check if the card has a powered effect AND player can pay for it
    const payableManaColor = playability.canPlayPowered
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
        basicEffectDescription: describeEffect(card.basicEffect),
        poweredEffectDescription: describeEffect(card.poweredEffect),
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
  // Check if basic effect has a useful effect type AND is resolvable
  const basicHasUsefulEffect =
    effectHasMove(card.basicEffect) ||
    effectHasInfluence(card.basicEffect) ||
    effectHasHeal(card.basicEffect) ||
    effectHasDraw(card.basicEffect) ||
    effectHasManaGain(card.basicEffect) ||
    effectHasModifier(card.basicEffect) ||
    effectHasCrystal(card.basicEffect);

  const basicIsResolvable = isEffectResolvable(state, playerId, card.basicEffect);

  // Check if powered effect has a useful effect type AND is resolvable
  const poweredHasUsefulEffect =
    effectHasMove(card.poweredEffect) ||
    effectHasInfluence(card.poweredEffect) ||
    effectHasHeal(card.poweredEffect) ||
    effectHasDraw(card.poweredEffect) ||
    effectHasManaGain(card.poweredEffect) ||
    effectHasModifier(card.poweredEffect) ||
    effectHasManaDrawPowered(card.poweredEffect) ||
    effectHasCrystal(card.poweredEffect) ||
    effectHasCardBoost(card.poweredEffect);

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
