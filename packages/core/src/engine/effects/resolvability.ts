/**
 * Effect Resolvability Checks
 *
 * Functions to determine if an effect can produce a meaningful result
 * given the current game state. Used to filter out no-op choice options.
 *
 * @module effects/resolvability
 *
 * @remarks Resolvability Overview
 * - `isEffectResolvable` checks if an effect can actually do something
 * - Used to filter choice options (e.g., "draw card" when deck is empty)
 * - Prevents players from selecting effects that would be no-ops
 * - Handles recursive checking for compound/choice/conditional effects
 *
 * @example Usage
 * ```typescript
 * const options = effect.options.filter(opt =>
 *   isEffectResolvable(state, playerId, opt)
 * );
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { CardEffect } from "../../types/cards.js";
import { DEED_CARD_TYPE_BASIC_ACTION, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../types/cards.js";
import {
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
} from "@mage-knight/shared";
import { getCard } from "../validActions/cards/index.js";
import { getPlayerById } from "../helpers/playerHelpers.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_NOOP,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_TAKE_WOUND,
  EFFECT_DISCARD_WOUNDS,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_PAY_MANA,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_PLACE_SKILL_IN_CENTER,
} from "../../types/effectTypes.js";
import {
  EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE,
} from "../modifierConstants.js";
import { isRuleActive } from "../modifiers/index.js";
import { getSpentUnitsAtOrBelowLevel } from "./unitEffects.js";

// ============================================================================
// IS EFFECT RESOLVABLE
// ============================================================================

/**
 * Check if an effect can actually produce a result given the current game state.
 *
 * Used to filter out choice options that would be no-ops. For example:
 * - "Draw card" when deck is empty
 * - "Heal wound" when no wounds in hand
 * - "Ready unit" when no spent units
 *
 * @param state - Current game state
 * @param playerId - ID of the player resolving the effect
 * @param effect - The effect to check
 * @returns True if the effect can produce a meaningful result
 *
 * @example
 * ```typescript
 * // Filter resolvable options
 * const validOptions = choiceEffect.options.filter(opt =>
 *   isEffectResolvable(state, playerId, opt)
 * );
 * ```
 */
export function isEffectResolvable(
  state: GameState,
  playerId: string,
  effect: CardEffect
): boolean {
  const player = getPlayerById(state, playerId);
  if (!player) return false;

  switch (effect.type) {
    case EFFECT_DRAW_CARDS:
      // Can only draw if there are cards in deck
      return player.deck.length > 0;

    case EFFECT_GAIN_HEALING: {
      // Healing is only useful if there are wounds to heal:
      // - Wound cards in hand
      // - Wounded units
      const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
      const hasWoundedUnits = player.units.some((u) => u.wounded);
      return hasWoundsInHand || hasWoundedUnits;
    }

    case EFFECT_COMPOUND:
      // If a compound includes mana payments, they must be payable
      if (effect.effects.some((e) => e.type === EFFECT_PAY_MANA)) {
        const payable = effect.effects
          .filter((e) => e.type === EFFECT_PAY_MANA)
          .every((e) => isEffectResolvable(state, playerId, e));
        if (!payable) {
          return false;
        }
      }

      // Compound is resolvable if at least one sub-effect is resolvable
      return effect.effects.some((e) => isEffectResolvable(state, playerId, e));

    case EFFECT_CHOICE:
      // Choice is resolvable if at least one option is resolvable
      return effect.options.some((e) => isEffectResolvable(state, playerId, e));

    case EFFECT_CONDITIONAL:
      // Conditional is always resolvable (the condition determines which branch)
      return true;

    case EFFECT_SCALING:
      // Scaling wraps a base effect, check that
      return isEffectResolvable(state, playerId, effect.baseEffect);

    // These effects are always resolvable
    case EFFECT_GAIN_MOVE:
    case EFFECT_GAIN_INFLUENCE:
    case EFFECT_GAIN_ATTACK:
    case EFFECT_GAIN_BLOCK:
    case EFFECT_GAIN_MANA:
    case EFFECT_TAKE_WOUND:
    case EFFECT_TRACK_ATTACK_DEFEAT_FAME:
      return true;

    case EFFECT_DISCARD_WOUNDS: {
      if (effect.count <= 0) return true;
      const woundCount = player.hand.filter((c) => c === CARD_WOUND).length;
      return woundCount >= effect.count;
    }

    case EFFECT_PLACE_SKILL_IN_CENTER:
      return true;

    case EFFECT_APPLY_MODIFIER: {
      // Most modifiers are always resolvable, but some have conditions
      if (
        effect.modifier.type === EFFECT_RULE_OVERRIDE &&
        effect.modifier.rule === RULE_EXTRA_SOURCE_DIE
      ) {
        // "Extra source die" is only useful if there are dice available
        // that the player couldn't otherwise access:
        // - If already used source: need at least 1 die available
        // - If haven't used source: need at least 2 dice (so the "extra" matters)
        const availableDice = state.source.dice.filter(
          (d) => d.takenByPlayerId === null && !d.isDepleted
        );
        if (player.usedManaFromSource) {
          return availableDice.length > 0;
        } else {
          return availableDice.length >= 2;
        }
      }
      return true;
    }

    case EFFECT_PAY_MANA: {
      const required = effect.amount;
      if (required <= 0) {
        return false;
      }
      const counts = new Map(effect.colors.map((color) => [color, 0]));
      for (const token of player.pureMana) {
        if (counts.has(token.color)) {
          counts.set(token.color, (counts.get(token.color) ?? 0) + 1);
        }
      }
      return Array.from(counts.values()).some((count) => count >= required);
    }

    case EFFECT_NOOP:
      return true;

    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
      // Can convert mana to crystal if player can obtain basic color mana.
      // Note: Black mana CAN'T become a crystal directly (no black crystals exist),
      // but it can be used as wild when paying for powered effects.
      // For Crystallize, we need actual basic color mana sources:
      // 1. Basic color mana tokens (red/blue/green/white)
      // 2. Gold mana tokens (wild, can become any basic color)
      // 3. Available basic color or gold dice from source (if not used yet)
      // 4. Crystals can be converted to tokens then to new crystals
      return canObtainBasicColorMana(state, player);

    case EFFECT_CARD_BOOST:
      // Card boost is resolvable only if player has eligible Action cards in hand
      // (Basic or Advanced Action cards, not wounds/spells/artifacts)
      return player.hand.some((cardId) => {
        if (cardId === CARD_WOUND) return false;
        const card = getCard(cardId);
        return (
          card &&
          (card.cardType === DEED_CARD_TYPE_BASIC_ACTION ||
            card.cardType === DEED_CARD_TYPE_ADVANCED_ACTION)
        );
      });

    case EFFECT_RESOLVE_BOOST_TARGET:
      // Internal effect, always resolvable if it's being called
      return true;

    case EFFECT_READY_UNIT: {
      // Ready unit is only resolvable if player has spent units at or below maxLevel
      const eligibleUnits = getSpentUnitsAtOrBelowLevel(player.units, effect.maxLevel);
      return eligibleUnits.length > 0;
    }

    case EFFECT_MANA_DRAW_POWERED: {
      // Mana Draw powered is only resolvable if there are available dice in the source
      const availableDice = state.source.dice.filter(
        (d) => d.takenByPlayerId === null
      );
      return availableDice.length > 0;
    }

    case EFFECT_MANA_DRAW_PICK_DIE:
    case EFFECT_MANA_DRAW_SET_COLOR:
    case EFFECT_CRYSTALLIZE_COLOR:
      // Internal effects, always resolvable if being called
      return true;

    case EFFECT_SELECT_COMBAT_ENEMY: {
      // Only resolvable during combat with at least one eligible enemy
      if (!state.combat) return false;
      // Check phase restriction (e.g., Tornado can only be used in Attack phase)
      if (effect.requiredPhase && state.combat.phase !== effect.requiredPhase) {
        return false;
      }
      const eligibleEnemies = state.combat.enemies.filter(
        (e) => effect.includeDefeated || !e.isDefeated
      );
      return eligibleEnemies.length > 0;
    }

    case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: {
      // Only resolvable if in combat and the enemy exists
      if (!state.combat) return false;
      const enemy = state.combat.enemies.find(
        (e) => e.instanceId === effect.enemyInstanceId
      );
      // For defeat template, enemy just needs to exist
      // For modifier template, enemy shouldn't be defeated yet
      if (!enemy) return false;
      if (effect.template.defeat) return true;
      return !enemy.isDefeated;
    }

    default:
      // Unknown effect types are considered resolvable (fail-safe)
      return true;
  }
}

// ============================================================================
// HELPER: CAN OBTAIN BASIC COLOR MANA
// ============================================================================

/**
 * Check if a player can obtain basic color mana (red/blue/green/white) for Crystallize.
 *
 * Black mana cannot become a crystal (no black crystals exist), so we specifically
 * check for basic colors and gold (which is wild).
 *
 * Sources checked:
 * - Basic color mana tokens in pureMana
 * - Gold mana tokens (can be treated as any basic color)
 * - Available dice from source (if player can use source)
 * - Crystals (can be converted back to tokens)
 * - Mana Steal stored die
 *
 * @param state - Current game state
 * @param player - The player to check
 * @returns True if the player can obtain at least one basic color mana
 */
export function canObtainBasicColorMana(state: GameState, player: Player): boolean {
  const basicColors = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE];

  // Check mana tokens - basic colors or gold
  for (const token of player.pureMana) {
    if (basicColors.includes(token.color as typeof MANA_RED) || token.color === "gold") {
      return true;
    }
  }

  // Check crystals - can be converted to tokens
  if (
    player.crystals.red > 0 ||
    player.crystals.blue > 0 ||
    player.crystals.green > 0 ||
    player.crystals.white > 0
  ) {
    return true;
  }

  // Check mana source dice (if player can use source)
  const hasExtraSourceDie = isRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
  const canUseSource = !player.usedManaFromSource || hasExtraSourceDie;

  if (canUseSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        // Basic color dice or gold dice (gold is wild)
        if (basicColors.includes(die.color as typeof MANA_RED) || die.color === "gold") {
          return true;
        }
      }
    }
  }

  // Check Mana Steal stored die
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && !player.tacticState.manaStealUsedThisTurn) {
    if (basicColors.includes(storedDie.color as typeof MANA_RED) || storedDie.color === "gold") {
      return true;
    }
  }

  return false;
}
