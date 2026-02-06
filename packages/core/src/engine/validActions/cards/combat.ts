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
import { isEffectResolvable } from "../../effects/index.js";
import { getCard } from "./index.js";
import { canPayForSpellBasic, findPayableManaColor } from "./manaPayment.js";
import { isCombatEffectAllowed, getCombatEffectContext, shouldExcludeMoveOnlyEffect, isRangedAttackUnusable, type CombatEffectContext } from "../../rules/cardPlay.js";
import { getSidewaysOptionsForValue } from "../../rules/sideways.js";
import { getEffectiveSidewaysValue, isRuleActive } from "../../modifiers/index.js";
import { RULE_WOUNDS_PLAYABLE_SIDEWAYS, RULE_MOVE_CARDS_IN_COMBAT } from "../../../types/modifierConstants.js";

interface CardPlayability {
  canPlayBasic: boolean;
  canPlayPowered: boolean;
  canPlaySideways: boolean;
  sidewaysOptions: SidewaysOption[];
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
  const moveCardsAllowed = isRuleActive(state, player.id, RULE_MOVE_CARDS_IN_COMBAT);

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

      let sidewaysOptions: SidewaysOption[] = [];
      if (combat.phase === COMBAT_PHASE_BLOCK) {
        sidewaysOptions = [{ as: PLAY_SIDEWAYS_AS_BLOCK, value: sidewaysValue }];
      } else if (combat.phase === COMBAT_PHASE_ATTACK) {
        sidewaysOptions = [{ as: PLAY_SIDEWAYS_AS_ATTACK, value: sidewaysValue }];
      }

      if (sidewaysOptions.length === 0) {
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
        sidewaysOptions,
      });

      continue;
    }

    const basicContext = getCombatEffectContext(card, "basic");
    const poweredContext = getCombatEffectContext(card, "powered");

    // Exclude move-only effects when move isn't useful in combat
    // (but not when moveCardsAllowed, since Agility makes move useful for conversion)
    const basicMoveExcluded = !moveCardsAllowed && basicContext.effect
      ? shouldExcludeMoveOnlyEffect(basicContext.effect, state, player.id, combat)
      : false;
    const poweredMoveExcluded = !moveCardsAllowed && poweredContext.effect
      ? shouldExcludeMoveOnlyEffect(poweredContext.effect, state, player.id, combat)
      : false;

    // Exclude ranged-only effects when all enemies are fortified
    const basicRangedExcluded = basicContext.effect
      ? isRangedAttackUnusable(basicContext.effect, state, player.id, combat)
      : false;
    const poweredRangedExcluded = poweredContext.effect
      ? isRangedAttackUnusable(poweredContext.effect, state, player.id, combat)
      : false;

    const adjustedBasicContext: CombatEffectContext = (basicMoveExcluded || basicRangedExcluded)
      ? { effect: null, allowAnyPhase: false }
      : basicContext;
    const adjustedPoweredContext: CombatEffectContext = (poweredMoveExcluded || poweredRangedExcluded)
      ? { effect: null, allowAnyPhase: false }
      : poweredContext;

    const playability = getCardPlayabilityForPhase(state, player, card, combat.phase, adjustedBasicContext, adjustedPoweredContext, moveCardsAllowed);

    // Check resolvability - effect must actually be able to do something
    const basicIsResolvable = adjustedBasicContext.effect
      ? isEffectResolvable(state, player.id, adjustedBasicContext.effect)
      : false;
    const poweredIsResolvable = adjustedPoweredContext.effect
      ? isEffectResolvable(state, player.id, adjustedPoweredContext.effect)
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
  state: GameState,
  player: Player,
  card: DeedCard,
  phase: CombatPhase,
  basicContext: CombatEffectContext,
  poweredContext: CombatEffectContext,
  moveCardsAllowed: boolean = false
): CardPlayability {
  const basicEffect = basicContext.effect;
  const poweredEffect = poweredContext.effect;

  const basicAllowed = isCombatEffectAllowed(
    basicEffect,
    phase,
    basicContext.allowAnyPhase,
    moveCardsAllowed
  );
  const poweredAllowed = isCombatEffectAllowed(
    poweredEffect,
    phase,
    poweredContext.allowAnyPhase,
    moveCardsAllowed
  );

  // Calculate effective sideways value (accounts for skill modifiers)
  const effectiveSidewaysValue = getEffectiveSidewaysValue(
    state,
    player.id,
    false,
    player.usedManaFromSource,
    undefined,
    card.cardType
  );

  const sidewaysOptions: SidewaysOption[] = [
    ...getSidewaysOptionsForValue(effectiveSidewaysValue, {
      inCombat: true,
      phase,
    }),
  ];

  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return {
        // Ranged/siege phase: can play for ranged/siege attack OR utility effects
        canPlayBasic: basicAllowed,
        canPlayPowered: poweredAllowed,
        canPlaySideways: sidewaysOptions.length > 0,
        sidewaysOptions,
      };

    case COMBAT_PHASE_BLOCK:
      return {
        // Block phase: can play for block OR utility effects
        canPlayBasic: basicAllowed,
        canPlayPowered: poweredAllowed,
        canPlaySideways: sidewaysOptions.length > 0,
        sidewaysOptions,
      };

    case COMBAT_PHASE_ATTACK:
      return {
        // Attack phase: can play for attack OR utility effects
        canPlayBasic: basicAllowed,
        canPlayPowered: poweredAllowed,
        canPlaySideways: sidewaysOptions.length > 0,
        sidewaysOptions,
      };

    default:
      // ASSIGN_DAMAGE phase - no cards played
      return {
        canPlayBasic: false,
        canPlayPowered: false,
        canPlaySideways: sidewaysOptions.length > 0,
        sidewaysOptions,
      };
  }
}

// getCombatEffectContext is shared in rules/cardPlay.ts
