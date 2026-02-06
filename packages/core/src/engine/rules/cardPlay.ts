/**
 * Shared card play rules.
 *
 * Used by validators, validActions, and commands to prevent rule drift.
 */

import type { CardId } from "@mage-knight/shared";
import { CARD_WOUND } from "@mage-knight/shared";
import type { CardEffect, DeedCard } from "../../types/cards.js";
import { DEED_CARD_TYPE_WOUND } from "../../types/cards.js";
import { getBasicActionCard, BASIC_ACTION_CARDS } from "../../data/basicActions/index.js";
import { filterHealingEffectsForCombat } from "../effects/index.js";
import { EFFECT_NOOP } from "../../types/effectTypes.js";
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
import { RULE_MOVE_CARDS_IN_COMBAT } from "../../types/modifierConstants.js";
import { getFortificationLevel } from "./combatTargeting.js";

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
  moveCardsAllowed: boolean = false
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

  switch (phase) {
    case COMBAT_PHASE_RANGED_SIEGE:
      return effectHasRangedOrSiege(effect) || effectIsUtility(effect) || moveAllowed;
    case COMBAT_PHASE_BLOCK:
      return effectHasBlock(effect) || effectIsUtility(effect) || moveAllowed;
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
  if (!effectIsMoveOnly(effect)) return false;
  return !isMoveUsefulInCombat(state, playerId, combat);
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
