/**
 * Shared card play rules.
 *
 * Used by validators, validActions, and commands to prevent rule drift.
 */

import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND, CARD_SPACE_BENDING } from "@mage-knight/shared";
import type { CardEffect, DeedCard } from "../../types/cards.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import { getBasicActionCard, BASIC_ACTION_CARDS } from "../../data/basicActions/index.js";
import { filterHealingEffectsForCombat } from "../effects/index.js";
import {
  EFFECT_NOOP,
  EFFECT_CHOICE,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_DISCARD_COST,
  EFFECT_POWER_OF_CRYSTALS_POWERED,
} from "../../types/effectTypes.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
} from "../../types/combat.js";
import {
  getEffectCategories,
  hasHealingCategory,
  isHealingOnlyCategories,
  hasActionCategory,
  type CardEffectKind,
} from "../helpers/cardCategoryHelpers.js";
import type { CombatState } from "../../types/combat.js";
import {
  effectHasRangedOrSiege,
  effectIsRangedOnlyAttack,
  effectHasBlock,
  effectHasAttack,
  effectHasMove,
  effectIsMoveOnly,
  effectHasInfluence,
  effectIsInfluenceOnly,
  effectHasHeal,
  effectHasDraw,
  effectHasModifier,
  effectHasManaGain,
  effectHasManaDrawPowered,
  effectHasCrystal,
  effectHasCardBoost,
  effectIsUtility,
} from "./effectDetection/index.js";
import { isCumbersomeActive } from "../combat/cumbersomeHelpers.js";
import type { GameState } from "../../state/GameState.js";
import { isRuleActive } from "../modifiers/index.js";
import { RULE_MOVE_CARDS_IN_COMBAT, RULE_INFLUENCE_CARDS_IN_COMBAT } from "../../types/modifierConstants.js";
import { getFortificationLevel } from "./combatTargeting.js";
import { CONDITION_IN_COMBAT } from "../../types/conditions.js";

export interface CombatEffectContext {
  readonly effect: CardEffect | null;
  readonly allowAnyPhase: boolean;
}

export function isWoundCardId(
  cardId: CardId,
  card: DeedCard | null
): boolean {
  if (card?.cardType === DEED_CARD_TYPE_WOUND) {
    return true;
  }

  if (cardId === CARD_WOUND) {
    return true;
  }

  if (cardId in BASIC_ACTION_CARDS) {
    const basicCard = getBasicActionCard(cardId);
    return basicCard.cardType === DEED_CARD_TYPE_WOUND;
  }

  return false;
}

export function isHealingOnlyInCombat(
  card: DeedCard,
  effectKind: CardEffectKind
): boolean {
  const categories = getEffectCategories(card, effectKind);
  return isHealingOnlyCategories(categories);
}

export function getCombatEffectContext(
  card: DeedCard,
  effectKind: CardEffectKind
): CombatEffectContext {
  const categories = getEffectCategories(card, effectKind);
  const healingOnly = isHealingOnlyCategories(categories);
  const hasHealing = hasHealingCategory(categories);
  const allowAnyPhase = hasHealing && !healingOnly;

  const baseEffect = effectKind === "basic" ? card.basicEffect : card.poweredEffect;

  if (!hasHealing) {
    return { effect: baseEffect, allowAnyPhase: false };
  }

  if (healingOnly) {
    return { effect: null, allowAnyPhase: false };
  }

  const filteredEffect = filterHealingEffectsForCombat(baseEffect);
  return { effect: filteredEffect, allowAnyPhase };
}

export function getCombatFilteredEffect(
  card: DeedCard,
  effectKind: CardEffectKind,
  inCombat: boolean
): CardEffect {
  if (!inCombat) {
    return effectKind === "basic" ? card.basicEffect : card.poweredEffect;
  }

  const context = getCombatEffectContext(card, effectKind);
  return context.effect ?? { type: EFFECT_NOOP };
}

export function isCombatEffectAllowed(
  effect: CardEffect | null,
  phase: CombatPhase,
  allowAnyPhase: boolean,
  moveCardsAllowed: boolean = false,
  influenceCardsAllowed: boolean = false
): boolean {
  if (!effect) {
    return false;
  }

  if (allowAnyPhase) {
    return true;
  }

  // When Agility (or similar) is active, movement effects are allowed
  // during ranged/siege, block, and attack phases
  const moveAllowed = moveCardsAllowed && effectHasMove(effect);

  // When Diplomacy (or similar) is active, influence effects are allowed
  // during block phase (influence converts to block)
  const influenceAllowed = influenceCardsAllowed && effectHasInfluence(effect);

  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return effectHasRangedOrSiege(effect) || effectIsUtility(effect) || moveAllowed;
    case COMBAT_PHASE_BLOCK:
      return effectHasBlock(effect) || effectIsUtility(effect) || moveAllowed || influenceAllowed;
    case COMBAT_PHASE_ATTACK:
      return effectHasAttack(effect) || effectIsUtility(effect) || moveAllowed;
    default:
      return false;
  }
}

export function isNormalEffectAllowed(
  effect: CardEffect,
  effectKind: CardEffectKind
): boolean {
  const baseAllowed =
    effectHasMove(effect) ||
    effectHasInfluence(effect) ||
    effectHasHeal(effect) ||
    effectHasDraw(effect) ||
    effectHasManaGain(effect) ||
    effectHasModifier(effect) ||
    effectHasCrystal(effect);

  if (effectKind === "basic") {
    return baseAllowed;
  }

  return (
    baseAllowed ||
    effectHasManaDrawPowered(effect) ||
    effectHasCardBoost(effect)
  );
}

/**
 * Check if move points are useful in the current combat context.
 *
 * Move points during combat are useful when:
 * - Facing Cumbersome enemies (move reduces their attack)
 * - Move-to-attack conversion is active (Agility card)
 */
export function isMoveUsefulInCombat(
  state: GameState,
  playerId: string,
  combat: CombatState
): boolean {
  // Cumbersome enemies: move points reduce their attack during Block phase
  const hasCumbersomeEnemy = combat.enemies.some(enemy =>
    !enemy.isDefeated && isCumbersomeActive(state, playerId, enemy)
  );
  if (hasCumbersomeEnemy) return true;

  // Move-to-attack conversion (Agility card): move converts to attack
  if (isRuleActive(state, playerId, RULE_MOVE_CARDS_IN_COMBAT)) return true;

  return false;
}

/**
 * Check if a combat-filtered effect should be excluded because it's move-only
 * and move isn't useful in the current combat context.
 */
export function shouldExcludeMoveOnlyEffect(
  effect: CardEffect,
  state: GameState,
  playerId: string,
  combat: CombatState
): boolean {
  if (!effectIsMoveOnlyForCurrentCombatState(effect, state.combat !== null)) return false;
  return !isMoveUsefulInCombat(state, playerId, combat);
}

/**
 * Like effectIsMoveOnly, but it evaluates "in_combat" conditionals against the
 * current state so out-of-combat branches don't affect combat playability checks.
 */
function effectIsMoveOnlyForCurrentCombatState(effect: CardEffect, inCombat: boolean): boolean {
  switch (effect.type) {
    case EFFECT_POWER_OF_CRYSTALS_POWERED:
      return true;

    case EFFECT_CHOICE:
      return effect.options.every((option) =>
        effectIsMoveOnlyForCurrentCombatState(option, inCombat)
      );

    case EFFECT_COMPOUND:
      return effect.effects.every((subEffect) =>
        effectIsMoveOnlyForCurrentCombatState(subEffect, inCombat)
      );

    case EFFECT_CONDITIONAL: {
      if (effect.condition.type === CONDITION_IN_COMBAT) {
        if (inCombat) {
          return effectIsMoveOnlyForCurrentCombatState(effect.thenEffect, inCombat);
        }
        return effect.elseEffect
          ? effectIsMoveOnlyForCurrentCombatState(effect.elseEffect, inCombat)
          : effectIsMoveOnly({ type: EFFECT_NOOP });
      }

      return effectIsMoveOnlyForCurrentCombatState(effect.thenEffect, inCombat) &&
        (!effect.elseEffect || effectIsMoveOnlyForCurrentCombatState(effect.elseEffect, inCombat));
    }

    case EFFECT_SCALING:
      return effectIsMoveOnlyForCurrentCombatState(effect.baseEffect, inCombat);

    case EFFECT_DISCARD_COST:
      return effect.colorMatters && effect.thenEffectByColor
        ? Object.values(effect.thenEffectByColor).every((next) =>
            !!next && effectIsMoveOnlyForCurrentCombatState(next, inCombat)
          )
        : effectIsMoveOnlyForCurrentCombatState(effect.thenEffect, inCombat);

    default:
      return effectIsMoveOnly(effect);
  }
}

/**
 * Check if influence points are useful in the current combat context.
 *
 * Influence points during combat are useful when:
 * - Influence-to-block conversion is active (Diplomacy card)
 */
export function isInfluenceUsefulInCombat(
  state: GameState,
  playerId: string
): boolean {
  return isRuleActive(state, playerId, RULE_INFLUENCE_CARDS_IN_COMBAT);
}

/**
 * Check if a combat-filtered effect should be excluded because it's influence-only
 * and influence isn't useful in the current combat context.
 */
export function shouldExcludeInfluenceOnlyEffect(
  effect: CardEffect,
  state: GameState,
  playerId: string
): boolean {
  if (!effectIsInfluenceOnly(effect)) return false;
  return !isInfluenceUsefulInCombat(state, playerId);
}

/**
 * Check if a ranged-only attack effect is unusable because all living enemies are fortified.
 * In Ranged/Siege phase, ranged attacks cannot target fortified enemies — only siege can.
 * If ALL enemies are fortified, a ranged-only card has no valid targets and cannot be played.
 */
export function isRangedAttackUnusable(
  effect: CardEffect,
  state: GameState,
  playerId: string,
  combat: CombatState
): boolean {
  if (combat.phase !== COMBAT_PHASE_RANGED_SIEGE) return false;
  if (!effectIsRangedOnlyAttack(effect)) return false;

  const livingEnemies = combat.enemies.filter(e => !e.isDefeated);
  if (livingEnemies.length === 0) return false;

  return livingEnemies.every(enemy =>
    getFortificationLevel(enemy, combat.isAtFortifiedSite, state, playerId) > 0
  );
}

/**
 * Check if a card cannot be played powered due to Time Bending chain prevention.
 * Space Bending cannot be played powered during a Time Bent turn (no infinite turns).
 */
/**
 * Check if a card consumes the player's action when played.
 * Cards with CATEGORY_ACTION set hasTakenActionThisTurn = true.
 * Used by Temporal Portal.
 */
export function cardConsumesAction(card: DeedCard): boolean {
  return hasActionCategory(card);
}

export function isTimeBendingChainPrevented(
  cardId: CardId,
  powered: boolean,
  isTimeBentTurn: boolean
): boolean {
  return powered && cardId === CARD_SPACE_BENDING && isTimeBentTurn;
}
