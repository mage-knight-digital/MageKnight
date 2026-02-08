/**
 * Human-readable effect descriptions for UI display
 *
 * Uses a map-based dispatch pattern for extensibility and maintainability.
 */

import type { CardEffect } from "../../types/cards.js";
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
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_READY_UNIT,
  EFFECT_RESOLVE_READY_UNIT_TARGET,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_PAY_MANA,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_TAKE_WOUND,
  EFFECT_DISCARD_WOUNDS,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_PLACE_SKILL_IN_CENTER,
  EFFECT_DISCARD_FOR_CRYSTAL,
  EFFECT_DECOMPOSE,
  EFFECT_MAXIMAL_EFFECT,
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_READY_UNITS_FOR_INFLUENCE,
  EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
  EFFECT_READY_ALL_UNITS,
  EFFECT_HEAL_ALL_UNITS,
  EFFECT_READY_UNITS_BUDGET,
  EFFECT_RESOLVE_READY_UNIT_BUDGET,
  EFFECT_CURE,
  EFFECT_DISEASE,
  EFFECT_MANA_MELTDOWN,
  EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
  EFFECT_MANA_RADIANCE,
  EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
  EFFECT_PURE_MAGIC,
  EFFECT_APPLY_RECRUITMENT_BONUS,
  EFFECT_APPLY_INTERACTION_BONUS,
  EFFECT_FREE_RECRUIT,
  EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
  EFFECT_SACRIFICE,
  EFFECT_RESOLVE_SACRIFICE,
  EFFECT_CALL_TO_ARMS,
  EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
  EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
  EFFECT_MANA_CLAIM,
  EFFECT_RESOLVE_MANA_CLAIM_DIE,
  EFFECT_RESOLVE_MANA_CLAIM_MODE,
  EFFECT_MANA_CURSE,
  EFFECT_MANA_BOLT,
  EFFECT_MIND_READ,
  EFFECT_RESOLVE_MIND_READ_COLOR,
  EFFECT_MIND_STEAL,
  EFFECT_RESOLVE_MIND_STEAL_COLOR,
  EFFECT_RESOLVE_MIND_STEAL_SELECTION,
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import type {
  DiscardForCrystalEffect,
  DecomposeEffect,
  MaximalEffectEffect,
  RecruitDiscountEffect,
  ReadyUnitsForInfluenceEffect,
  ResolveReadyUnitForInfluenceEffect,
  ReadyUnitsBudgetEffect,
  ResolveReadyUnitBudgetEffect,
  EnergyFlowEffect,
  ResolveEnergyFlowTargetEffect,
  CureEffect,
  ResolveManaMeltdownChoiceEffect,
  ResolveManaRadianceColorEffect,
  ApplyRecruitmentBonusEffect,
  ApplyInteractionBonusEffect,
  ResolveSacrificeEffect,
  ResolveManaClaimDieEffect,
  ResolveManaClaimModeEffect,
} from "../../types/cards.js";
import type {
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  GainHealingEffect,
  GainManaEffect,
  DrawCardsEffect,
  ApplyModifierEffect,
  CompoundEffect,
  ChoiceEffect,
  CardBoostEffect,
  ResolveBoostTargetEffect,
  GainCrystalEffect,
  ChangeReputationEffect,
  ReadyUnitEffect,
  ResolveReadyUnitTargetEffect,
  ManaDrawPickDieEffect,
  ManaDrawSetColorEffect,
  PayManaEffect,
  SelectCombatEnemyEffect,
  ResolveCombatEnemyTargetEffect,
  TakeWoundEffect,
  DiscardWoundsEffect,
  TrackAttackDefeatFameEffect,
} from "../../types/effectTypes.js";
import { getCard } from "../helpers/cardLookup.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function for generating effect descriptions.
 * Each handler receives the effect and returns a human-readable string.
 */
type DescriptionHandler<T extends CardEffect = CardEffect> = (effect: T) => string;

/**
 * Effect type discriminator string
 */
type EffectType = CardEffect["type"];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert a number to Roman numeral (1-4 range)
 */
function toRomanNumeral(n: number): string {
  const numerals: Record<number, string> = {
    1: "I",
    2: "II",
    3: "III",
    4: "IV",
  };
  return numerals[n] ?? String(n);
}

/**
 * Format attack type based on combat type
 */
function formatAttackType(combatType?: string): string {
  if (combatType === COMBAT_TYPE_RANGED) return "Ranged Attack";
  if (combatType === COMBAT_TYPE_SIEGE) return "Siege Attack";
  return "Attack";
}

// ============================================================================
// DESCRIPTION HANDLERS
// ============================================================================

/**
 * Description handlers registry.
 * Maps effect types to their description generator functions.
 */
const descriptionHandlers: Partial<Record<EffectType, DescriptionHandler>> = {
  [EFFECT_GAIN_MOVE]: (effect) => {
    const e = effect as GainMoveEffect;
    return `Move ${e.amount}`;
  },

  [EFFECT_GAIN_INFLUENCE]: (effect) => {
    const e = effect as GainInfluenceEffect;
    return `Influence ${e.amount}`;
  },

  [EFFECT_GAIN_ATTACK]: (effect) => {
    const e = effect as GainAttackEffect;
    return `${formatAttackType(e.combatType)} ${e.amount}`;
  },

  [EFFECT_GAIN_BLOCK]: (effect) => {
    const e = effect as GainBlockEffect;
    if (e.element) {
      const elementName = e.element.charAt(0).toUpperCase() + e.element.slice(1);
      return `${elementName} Block ${e.amount}`;
    }
    return `Block ${e.amount}`;
  },

  [EFFECT_GAIN_HEALING]: (effect) => {
    const e = effect as GainHealingEffect;
    return `Healing ${e.amount}`;
  },

  [EFFECT_GAIN_MANA]: (effect) => {
    const e = effect as GainManaEffect;
    return `Gain ${e.color} mana`;
  },

  [EFFECT_DRAW_CARDS]: (effect) => {
    const e = effect as DrawCardsEffect;
    return e.amount === 1 ? "Draw 1 card" : `Draw ${e.amount} cards`;
  },

  [EFFECT_NOOP]: () => "No additional effect",

  [EFFECT_APPLY_MODIFIER]: (effect) => {
    const e = effect as ApplyModifierEffect;
    return e.description ?? "Apply modifier";
  },

  [EFFECT_COMPOUND]: (effect) => {
    const e = effect as CompoundEffect;
    return e.effects.map(describeEffect).join(", ");
  },

  [EFFECT_CHOICE]: (effect) => {
    const e = effect as ChoiceEffect;
    return e.options.map(describeEffect).join(" OR ");
  },

  [EFFECT_CARD_BOOST]: (effect) => {
    const e = effect as CardBoostEffect;
    return `Boost another Action card (+${e.bonus})`;
  },

  [EFFECT_RESOLVE_BOOST_TARGET]: (effect) => {
    const e = effect as ResolveBoostTargetEffect;
    const targetCard = getCard(e.targetCardId);
    const cardName = targetCard?.name ?? e.targetCardId;
    return `Boost ${cardName} (+${e.bonus})`;
  },

  [EFFECT_GAIN_CRYSTAL]: (effect) => {
    const e = effect as GainCrystalEffect;
    return `Gain ${e.color} crystal`;
  },

  [EFFECT_CONVERT_MANA_TO_CRYSTAL]: () => "Convert mana to crystal",

  [EFFECT_CHANGE_REPUTATION]: (effect) => {
    const e = effect as ChangeReputationEffect;
    return e.amount >= 0 ? `Reputation +${e.amount}` : `Reputation ${e.amount}`;
  },

  [EFFECT_READY_UNIT]: (effect) => {
    const e = effect as ReadyUnitEffect;
    const levels = Array.from({ length: e.maxLevel }, (_, i) => toRomanNumeral(i + 1)).join("/");
    return `Ready a Level ${levels} Unit`;
  },

  [EFFECT_RESOLVE_READY_UNIT_TARGET]: (effect) => {
    const e = effect as ResolveReadyUnitTargetEffect;
    return `Ready ${e.unitName}`;
  },

  [EFFECT_MANA_DRAW_POWERED]: () => "Take a die, set its color, gain 2 mana",

  [EFFECT_MANA_DRAW_PICK_DIE]: (effect) => {
    const e = effect as ManaDrawPickDieEffect;
    return `Take ${e.dieColor} die`;
  },

  [EFFECT_MANA_DRAW_SET_COLOR]: (effect) => {
    const e = effect as ManaDrawSetColorEffect;
    return `Set die to ${e.color}, gain 2 ${e.color} mana`;
  },

  [EFFECT_PAY_MANA]: (effect) => {
    const e = effect as PayManaEffect;
    const colorLabel = e.colors.length === 1 ? e.colors[0] : e.colors.join("/");
    return `Pay ${e.amount} ${colorLabel} mana`;
  },

  [EFFECT_SELECT_COMBAT_ENEMY]: (effect) => {
    const e = effect as SelectCombatEnemyEffect;
    return e.template.defeat ? "Defeat target enemy" : "Target an enemy";
  },

  [EFFECT_RESOLVE_COMBAT_ENEMY_TARGET]: (effect) => {
    const e = effect as ResolveCombatEnemyTargetEffect;
    if (e.template.defeat) {
      return `Defeat ${e.enemyName}`;
    }
    const modDescriptions = e.template.modifiers
      ?.map((m) => m.description)
      .filter((desc): desc is string => Boolean(desc))
      .map((desc) => desc.replace(/[Tt]arget enemy/g, e.enemyName))
      .join(", ");
    return modDescriptions || `Target ${e.enemyName}`;
  },

  [EFFECT_TERRAIN_BASED_BLOCK]: () => "Block (terrain cost, Fire/Ice)",

  [EFFECT_TAKE_WOUND]: (effect) => {
    const e = effect as TakeWoundEffect;
    return e.amount === 1 ? "Take 1 wound" : `Take ${e.amount} wounds`;
  },

  [EFFECT_DISCARD_WOUNDS]: (effect) => {
    const e = effect as DiscardWoundsEffect;
    return e.count === 1 ? "Discard 1 Wound" : `Discard ${e.count} Wounds`;
  },

  [EFFECT_PLACE_SKILL_IN_CENTER]: () => "Place skill in center",

  [EFFECT_TRACK_ATTACK_DEFEAT_FAME]: (effect) => {
    const e = effect as TrackAttackDefeatFameEffect;
    return `Fame +${e.fame} if this ${formatAttackType(e.combatType)} defeats an enemy`;
  },

  [EFFECT_DISCARD_FOR_CRYSTAL]: (effect) => {
    const e = effect as DiscardForCrystalEffect;
    return e.optional
      ? "Optionally discard a card to gain a crystal"
      : "Discard a card to gain a crystal";
  },

  [EFFECT_DECOMPOSE]: (effect) => {
    const e = effect as DecomposeEffect;
    return e.mode === "basic"
      ? "Throw away an action card to gain 2 crystals of matching color"
      : "Throw away an action card to gain 1 crystal of each non-matching color";
  },

  [EFFECT_MAXIMAL_EFFECT]: (effect) => {
    const e = effect as MaximalEffectEffect;
    return e.effectKind === "basic"
      ? `Throw away an action card to use its basic effect ${e.multiplier} times`
      : `Throw away an action card to use its stronger effect ${e.multiplier} times`;
  },

  [EFFECT_CRYSTAL_MASTERY_BASIC]: () => {
    return "Gain a crystal of a color you already own";
  },

  [EFFECT_CRYSTAL_MASTERY_POWERED]: () => {
    return "Crystals spent this turn are returned at end of turn";
  },

  [EFFECT_APPLY_RECRUIT_DISCOUNT]: (effect) => {
    const e = effect as RecruitDiscountEffect;
    return `Recruit discount of ${e.discount} (Reputation ${e.reputationChange} if used)`;
  },

  [EFFECT_READY_UNITS_FOR_INFLUENCE]: (effect) => {
    const e = effect as ReadyUnitsForInfluenceEffect;
    const levels = Array.from({ length: e.maxLevel }, (_, i) => toRomanNumeral(i + 1)).join("/");
    return `Ready Level ${levels} Units for ${e.costPerLevel} Influence per level`;
  },

  [EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE]: (effect) => {
    const e = effect as ResolveReadyUnitForInfluenceEffect;
    return `Ready ${e.unitName} (${e.influenceCost} Influence)`;
  },

  [EFFECT_ENERGY_FLOW]: (effect) => {
    const e = effect as EnergyFlowEffect;
    return e.healReadiedUnit ? "Ready and heal a Unit" : "Ready a Unit";
  },

  [EFFECT_RESOLVE_ENERGY_FLOW_TARGET]: (effect) => {
    const e = effect as ResolveEnergyFlowTargetEffect;
    return e.healReadiedUnit ? `Ready and heal ${e.unitName}` : `Ready ${e.unitName}`;
  },

  [EFFECT_READY_ALL_UNITS]: () => "Ready all Units",

  [EFFECT_HEAL_ALL_UNITS]: () => "Heal all Units completely",

  [EFFECT_READY_UNITS_BUDGET]: (effect) => {
    const e = effect as ReadyUnitsBudgetEffect;
    return `Ready Units (up to ${e.totalLevels} levels)`;
  },

  [EFFECT_RESOLVE_READY_UNIT_BUDGET]: (effect) => {
    const e = effect as ResolveReadyUnitBudgetEffect;
    return `Ready ${e.unitName}`;
  },

  [EFFECT_CURE]: (effect) => {
    const e = effect as CureEffect;
    return `Heal ${e.amount}, draw per wound healed, ready healed units`;
  },

  [EFFECT_DISEASE]: () => "Reduce fully-blocked enemies' armor to 1",

  [EFFECT_MANA_MELTDOWN]: () => "Each opponent loses a random crystal (or takes a wound)",

  [EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE]: (effect) => {
    const e = effect as ResolveManaMeltdownChoiceEffect;
    return `Gain ${e.color} crystal`;
  },

  [EFFECT_MANA_RADIANCE]: () => "Choose a color: wounds per crystal, gain 2 crystals",

  [EFFECT_RESOLVE_MANA_RADIANCE_COLOR]: (effect) => {
    const e = effect as ResolveManaRadianceColorEffect;
    return `All players: wound per ${e.color} crystal, gain 2 ${e.color} crystals`;
  },

  [EFFECT_PURE_MAGIC]: (effect) => {
    const e = effect as import("../../types/cards.js").PureMagicEffect;
    return `Pay mana: Green=Move ${e.value}, White=Influence ${e.value}, Blue=Block ${e.value}, Red=Attack ${e.value}`;
  },

  [EFFECT_MANA_BOLT]: (effect) => {
    const e = effect as import("../../types/cards.js").ManaBoltEffect;
    const b = e.baseValue;
    return `Pay mana: Blue=Ice Attack ${b}, Red=ColdFire Attack ${b - 1}, White=Ranged Ice Attack ${b - 2}, Green=Siege Ice Attack ${b - 3}`;
  },

  [EFFECT_APPLY_RECRUITMENT_BONUS]: (effect) => {
    const e = effect as ApplyRecruitmentBonusEffect;
    const parts: string[] = [];
    if (e.reputationPerRecruit !== 0) {
      parts.push(`Reputation +${e.reputationPerRecruit}`);
    }
    if (e.famePerRecruit > 0) {
      parts.push(`Fame +${e.famePerRecruit}`);
    }
    return `${parts.join(" and ")} per unit recruited this turn`;
  },

  [EFFECT_APPLY_INTERACTION_BONUS]: (effect) => {
    const e = effect as ApplyInteractionBonusEffect;
    const parts: string[] = [];
    if (e.fame > 0) {
      parts.push(`Fame +${e.fame}`);
    }
    if (e.reputation > 0) {
      parts.push(`Reputation +${e.reputation}`);
    }
    return `${parts.join(" and ")} on next interaction this turn`;
  },

  [EFFECT_FREE_RECRUIT]: () => "Recruit any Unit for free",

  [EFFECT_RESOLVE_FREE_RECRUIT_TARGET]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveFreeRecruitTargetEffect;
    return `Recruit ${e.unitName} for free`;
  },

  [EFFECT_SACRIFICE]: () => "Choose crystal colors for Sacrifice attack",

  [EFFECT_RESOLVE_SACRIFICE]: (effect) => {
    const e = effect as ResolveSacrificeEffect;
    const attackType = e.attackColor === "white" ? "Ranged" : "Siege";
    const element = e.elementColor === "red" ? "Fire" : "Ice";
    const perPair = e.attackColor === "white" ? 6 : 4;
    return `${attackType} ${element} Attack ${perPair} per ${e.attackColor}/${e.elementColor} crystal pair`;
  },

  [EFFECT_CALL_TO_ARMS]: () => "Borrow a Unit ability from the Offer",

  [EFFECT_RESOLVE_CALL_TO_ARMS_UNIT]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveCallToArmsUnitEffect;
    return `Select ability from ${e.unitName}`;
  },

  [EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveCallToArmsAbilityEffect;
    return e.abilityDescription;
  },

  [EFFECT_MANA_CLAIM]: () => "Claim a basic color die from the Source",

  [EFFECT_RESOLVE_MANA_CLAIM_DIE]: (effect) => {
    const e = effect as ResolveManaClaimDieEffect;
    return `Claim ${e.dieColor} die`;
  },

  [EFFECT_RESOLVE_MANA_CLAIM_MODE]: (effect) => {
    const e = effect as ResolveManaClaimModeEffect;
    if (e.mode === "burst") {
      return `Gain 3 ${e.color} mana now`;
    }
    return `Gain 1 ${e.color} mana each turn`;
  },

  [EFFECT_MANA_CURSE]: () => "Claim a die and curse its color",

  [EFFECT_MIND_READ]: () =>
    "Choose a color: gain crystal, opponents discard matching card",

  [EFFECT_RESOLVE_MIND_READ_COLOR]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveMindReadColorEffect;
    return `Gain ${e.color} crystal, opponents discard ${e.color} card`;
  },

  [EFFECT_MIND_STEAL]: () =>
    "Choose a color: gain crystal, opponents discard, steal an Action card",

  [EFFECT_RESOLVE_MIND_STEAL_COLOR]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveMindStealColorEffect;
    return `Gain ${e.color} crystal, opponents discard ${e.color} card, steal option`;
  },

  [EFFECT_RESOLVE_MIND_STEAL_SELECTION]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveMindStealSelectionEffect;
    return `Steal ${e.cardName} from ${e.fromPlayerId}`;
  },

  [EFFECT_WINGS_OF_NIGHT]: () => "Target enemies to skip their attacks",

  [EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET]: (effect) => {
    const e = effect as import("../../types/cards.js").ResolveWingsOfNightTargetEffect;
    const costStr = e.moveCost > 0 ? ` (${e.moveCost} Move)` : "";
    return `${e.enemyName} does not attack${costStr}`;
  },
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Convert a card effect to a human-readable description.
 *
 * Used for:
 * - CHOICE_REQUIRED event options
 * - CHOICE_RESOLVED event effect description
 * - General effect logging
 */
export function describeEffect(effect: CardEffect): string {
  const handler = descriptionHandlers[effect.type];
  if (handler) {
    return handler(effect);
  }
  return "Unknown effect";
}
