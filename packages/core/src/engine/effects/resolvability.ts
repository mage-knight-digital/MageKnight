/**
 * Effect Resolvability Checks
 *
 * Functions to determine if an effect can produce a meaningful result
 * given the current game state. Used to filter out no-op choice options.
 *
 * Uses a map-based dispatch pattern for extensibility and maintainability.
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
  ABILITY_ARCANE_IMMUNITY,
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  UNIT_STATE_SPENT,
  UNITS,
} from "@mage-knight/shared";
import { getFortificationLevel } from "../rules/combatTargeting.js";
import { getCard } from "../helpers/cardLookup.js";
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
  EFFECT_RESOLVE_READY_UNIT_TARGET,
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
  EFFECT_DISCARD_FOR_CRYSTAL,
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_READY_UNITS_FOR_INFLUENCE,
  EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
  EFFECT_READY_ALL_UNITS,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
} from "../../types/effectTypes.js";
import type {
  DrawCardsEffect,
  GainHealingEffect,
  CompoundEffect,
  ChoiceEffect,
  ScalingEffect,
  ApplyModifierEffect,
  PayManaEffect,
  DiscardWoundsEffect,
  ReadyUnitEffect,
  ResolveReadyUnitTargetEffect,
  ManaDrawPoweredEffect,
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
} from "../../types/effectTypes.js";
import type {
  ReadyUnitsForInfluenceEffect,
  ResolveReadyUnitForInfluenceEffect,
  ResolveEnergyFlowTargetEffect,
} from "../../types/cards.js";
import {
  EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE,
} from "../../types/modifierConstants.js";
import { isRuleActive } from "../modifiers/index.js";
import { getSpentUnitsAtOrBelowLevel } from "./unitEffects.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function for checking effect resolvability.
 * Each handler receives the state, player, and effect, returns whether it's resolvable.
 */
type ResolvabilityHandler<T extends CardEffect = CardEffect> = (
  state: GameState,
  player: Player,
  effect: T
) => boolean;

/**
 * Effect type discriminator string
 */
type EffectType = CardEffect["type"];

// ============================================================================
// RESOLVABILITY HANDLERS
// ============================================================================

/**
 * Resolvability handlers registry.
 * Maps effect types to their resolvability check functions.
 */
const resolvabilityHandlers: Partial<Record<EffectType, ResolvabilityHandler>> = {
  [EFFECT_DRAW_CARDS]: (state, player, effect) => {
    const e = effect as DrawCardsEffect;
    // Can only draw if there are cards in deck
    void e; // effect not needed for this check
    return player.deck.length > 0;
  },

  [EFFECT_GAIN_HEALING]: (state, player, effect) => {
    const e = effect as GainHealingEffect;
    void e; // effect not needed for this check
    // Healing is only useful if there are wounds to heal:
    // - Wound cards in hand
    // - Wounded units
    const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
    const hasWoundedUnits = player.units.some((u) => u.wounded);
    return hasWoundsInHand || hasWoundedUnits;
  },

  [EFFECT_COMPOUND]: (state, player, effect) => {
    const e = effect as CompoundEffect;
    // If a compound includes mana payments, they must be payable
    if (e.effects.some((sub) => sub.type === EFFECT_PAY_MANA)) {
      const payable = e.effects
        .filter((sub) => sub.type === EFFECT_PAY_MANA)
        .every((sub) => isEffectResolvable(state, player.id, sub));
      if (!payable) {
        return false;
      }
    }
    // Compound is resolvable if at least one sub-effect is resolvable
    return e.effects.some((sub) => isEffectResolvable(state, player.id, sub));
  },

  [EFFECT_CHOICE]: (state, player, effect) => {
    const e = effect as ChoiceEffect;
    // Choice is resolvable if at least one option is resolvable
    return e.options.some((opt) => isEffectResolvable(state, player.id, opt));
  },

  [EFFECT_CONDITIONAL]: () => {
    // Conditional is always resolvable (the condition determines which branch)
    return true;
  },

  [EFFECT_SCALING]: (state, player, effect) => {
    const e = effect as ScalingEffect;
    // Scaling wraps a base effect, check that
    return isEffectResolvable(state, player.id, e.baseEffect);
  },

  // These effects are always resolvable
  [EFFECT_GAIN_MOVE]: () => true,
  [EFFECT_GAIN_INFLUENCE]: () => true,
  [EFFECT_GAIN_ATTACK]: () => true,
  [EFFECT_GAIN_BLOCK]: () => true,
  [EFFECT_GAIN_MANA]: () => true,
  [EFFECT_TAKE_WOUND]: () => true,
  [EFFECT_TRACK_ATTACK_DEFEAT_FAME]: () => true,
  [EFFECT_NOOP]: () => true,
  [EFFECT_PLACE_SKILL_IN_CENTER]: () => true,
  [EFFECT_RESOLVE_BOOST_TARGET]: () => true,
  [EFFECT_MANA_DRAW_PICK_DIE]: () => true,
  [EFFECT_MANA_DRAW_SET_COLOR]: () => true,
  [EFFECT_CRYSTALLIZE_COLOR]: () => true,

  [EFFECT_DISCARD_FOR_CRYSTAL]: (state, player) => {
    // Discard for crystal is resolvable if optional (can always skip) or if player has non-wound cards
    const hasNonWoundCards = player.hand.some((c) => c !== CARD_WOUND);
    return hasNonWoundCards;
  },

  [EFFECT_DISCARD_WOUNDS]: (state, player, effect) => {
    const e = effect as DiscardWoundsEffect;
    if (e.count <= 0) return true;
    const woundCount = player.hand.filter((c) => c === CARD_WOUND).length;
    return woundCount >= e.count;
  },

  [EFFECT_APPLY_MODIFIER]: (state, player, effect) => {
    const e = effect as ApplyModifierEffect;
    // Most modifiers are always resolvable, but some have conditions
    if (
      e.modifier.type === EFFECT_RULE_OVERRIDE &&
      e.modifier.rule === RULE_EXTRA_SOURCE_DIE
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
  },

  [EFFECT_PAY_MANA]: (state, player, effect) => {
    const e = effect as PayManaEffect;
    const required = e.amount;
    if (required <= 0) {
      return false;
    }
    const counts = new Map(e.colors.map((color) => [color, 0]));
    for (const token of player.pureMana) {
      if (counts.has(token.color)) {
        counts.set(token.color, (counts.get(token.color) ?? 0) + 1);
      }
    }
    return Array.from(counts.values()).some((count) => count >= required);
  },

  [EFFECT_CONVERT_MANA_TO_CRYSTAL]: (state, player) => {
    // Can convert mana to crystal if player can obtain basic color mana.
    // Note: Black mana CAN'T become a crystal directly (no black crystals exist),
    // but it can be used as wild when paying for powered effects.
    // For Crystallize, we need actual basic color mana sources:
    // 1. Basic color mana tokens (red/blue/green/white)
    // 2. Gold mana tokens (wild, can become any basic color)
    // 3. Available basic color or gold dice from source (if not used yet)
    // 4. Crystals can be converted to tokens then to new crystals
    return canObtainBasicColorMana(state, player);
  },

  [EFFECT_CARD_BOOST]: (state, player) => {
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
  },

  [EFFECT_READY_UNIT]: (state, player, effect) => {
    const e = effect as ReadyUnitEffect;
    // Ready unit is only resolvable if player has spent units at or below maxLevel
    const eligibleUnits = getSpentUnitsAtOrBelowLevel(player.units, e.maxLevel);
    return eligibleUnits.length > 0;
  },

  [EFFECT_RESOLVE_READY_UNIT_TARGET]: (state, player, effect) => {
    const e = effect as ResolveReadyUnitTargetEffect;
    // The target unit just needs to exist and be spent
    const unit = player.units.find((u) => u.instanceId === e.unitInstanceId);
    return unit !== undefined && unit.state === UNIT_STATE_SPENT;
  },

  [EFFECT_MANA_DRAW_POWERED]: (state, player, effect) => {
    const e = effect as ManaDrawPoweredEffect;
    void e; // effect not needed for this check
    // Mana Draw powered is only resolvable if there are available dice in the source
    const availableDice = state.source.dice.filter(
      (d) => d.takenByPlayerId === null
    );
    return availableDice.length > 0;
  },

  [EFFECT_SELECT_COMBAT_ENEMY]: (state, player, effect) => {
    const e = effect as SelectCombatEnemyEffect;
    // Only resolvable during combat with at least one eligible enemy
    if (!state.combat) return false;
    // Check phase restriction (e.g., Tornado can only be used in Attack phase)
    if (e.requiredPhase && state.combat.phase !== e.requiredPhase) {
      return false;
    }
    const combat = state.combat;
    const eligibleEnemies = combat.enemies.filter((enemy) => {
      if (!e.includeDefeated && enemy.isDefeated) return false;
      // Filter out fortified enemies if the effect requires unfortified targets
      if (e.excludeFortified) {
        const fortLevel = getFortificationLevel(
          enemy,
          combat.isAtFortifiedSite,
          state,
          player.id
        );
        if (fortLevel > 0) return false;
      }
      // Filter out Arcane Immune enemies if the effect is blocked by it
      if (e.excludeArcaneImmune) {
        if (enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;
      }
      // Filter out enemies with a specific resistance type
      if (e.excludeResistance) {
        if (enemy.definition.resistances.includes(e.excludeResistance)) return false;
      }
      return true;
    });
    return eligibleEnemies.length > 0;
  },

  [EFFECT_RESOLVE_COMBAT_ENEMY_TARGET]: (state, player, effect) => {
    const e = effect as ResolveCombatEnemyTargetEffect;
    // Only resolvable if in combat and the enemy exists
    if (!state.combat) return false;
    const enemy = state.combat.enemies.find(
      (en) => en.instanceId === e.enemyInstanceId
    );
    // For defeat template, enemy just needs to exist
    // For modifier template, enemy shouldn't be defeated yet
    if (!enemy) return false;
    if (e.template.defeat) return true;
    return !enemy.isDefeated;
  },

  // Recruit discount is always resolvable (adds a modifier)
  [EFFECT_APPLY_RECRUIT_DISCOUNT]: () => true,

  // Terrain cost reduction selection is always resolvable (sets pending state)
  [EFFECT_SELECT_HEX_FOR_COST_REDUCTION]: () => true,
  [EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION]: () => true,

  [EFFECT_READY_UNITS_FOR_INFLUENCE]: (state, player, effect) => {
    const e = effect as ReadyUnitsForInfluenceEffect;
    // Resolvable if player has spent units at or below maxLevel with enough influence
    return player.units.some((unit) => {
      if (unit.state !== UNIT_STATE_SPENT) return false;
      const unitDef = UNITS[unit.unitId];
      if (!unitDef || unitDef.level > e.maxLevel) return false;
      const cost = unitDef.level * e.costPerLevel;
      return player.influencePoints >= cost;
    });
  },

  [EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE]: (state, player, effect) => {
    const e = effect as ResolveReadyUnitForInfluenceEffect;
    // Resolvable if the unit exists, is spent, and player has enough influence
    const unit = player.units.find((u) => u.instanceId === e.unitInstanceId);
    if (!unit || unit.state !== UNIT_STATE_SPENT) return false;
    return player.influencePoints >= e.influenceCost;
  },

  [EFFECT_ENERGY_FLOW]: (state, player) => {
    // Resolvable if player has any spent units (ready any level)
    return player.units.some((unit) => unit.state === UNIT_STATE_SPENT);
  },

  [EFFECT_RESOLVE_ENERGY_FLOW_TARGET]: (state, player, effect) => {
    const e = effect as ResolveEnergyFlowTargetEffect;
    const unit = player.units.find((u) => u.instanceId === e.unitInstanceId);
    return unit !== undefined && unit.state === UNIT_STATE_SPENT;
  },

  [EFFECT_READY_ALL_UNITS]: (state, player) => {
    // Resolvable if player has at least one spent unit
    return player.units.some((u) => u.state === UNIT_STATE_SPENT);
  },
};

// ============================================================================
// MAIN FUNCTION
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

  const handler = resolvabilityHandlers[effect.type];
  if (handler) {
    return handler(state, player, effect);
  }
  // Unknown effect types are considered resolvable (fail-safe)
  return true;
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
