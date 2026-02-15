/**
 * Unified card playability evaluation.
 *
 * Single source of truth for determining whether a card can be played
 * (basic, powered, or sideways) given the current game context. Consumed
 * by both validActions (to build PlayableCard[]) and validators (to
 * accept/reject actions).
 *
 * @module validActions/cards/cardPlayability
 */

import type { GameState } from "../../../state/GameState.js";
import type { Player } from "../../../types/player.js";
import type { DeedCard } from "../../../types/cards.js";
import type { CombatPhase, CombatState } from "../../../types/combat.js";
import { COMBAT_PHASE_ASSIGN_DAMAGE } from "../../../types/combat.js";
import type { CardId, ManaColor, ManaSourceInfo, SidewaysOption } from "@mage-knight/shared";
import { DEED_CARD_TYPE_SPELL } from "../../../types/cards.js";
import {
  EFFECT_CARD_BOOST,
  EFFECT_DECOMPOSE,
  EFFECT_MAXIMAL_EFFECT,
  EFFECT_BOOK_OF_WISDOM,
  EFFECT_TRAINING,
} from "../../../types/effectTypes.js";
import {
  RULE_WOUNDS_PLAYABLE_SIDEWAYS,
  RULE_MOVE_CARDS_IN_COMBAT,
  RULE_INFLUENCE_CARDS_IN_COMBAT,
  EFFECT_SIDEWAYS_VALUE,
  SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
} from "../../../types/modifierConstants.js";
import type { SidewaysValueModifier } from "../../../types/modifiers.js";
import { getEffectiveSidewaysValue, isRuleActive, getModifiersForPlayer } from "../../modifiers/index.js";
import { isEffectResolvable } from "../../effects/index.js";
import { describeEffect } from "../../effects/describeEffect.js";
import { getEligibleBoostTargets } from "../../effects/cardBoostEffects.js";
import { getCardsEligibleForDecompose } from "../../effects/decomposeEffects.js";
import { getCardsEligibleForMaximalEffect } from "../../effects/maximalEffectEffects.js";
import { getCardsEligibleForBookOfWisdom } from "../../effects/bookOfWisdomEffects.js";
import { getCardsEligibleForTraining } from "../../effects/trainingEffects.js";
import {
  getCombatEffectContext,
  isCombatEffectAllowed,
  isNormalEffectAllowed,
  shouldExcludeMoveOnlyEffect,
  shouldExcludeInfluenceOnlyEffect,
  isRangedAttackUnusable,
  isTimeBendingChainPrevented,
  isDiscardCostPayableAfterPlayingSource,
  isWoundCardId,
  cardConsumesAction,
} from "../../rules/cardPlay.js";
import { getSidewaysOptionsForValue, getSidewaysContext, canPlaySideways } from "../../rules/sideways.js";
import type { SidewaysContext } from "../../rules/sideways.js";
import { canPayForSpellBasic, findPayableManaColor, computePoweredManaOptions } from "./manaPayment.js";
import { getCard } from "../../helpers/cardLookup.js";
import type { CardEffectKind } from "../../helpers/cardCategoryHelpers.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context for evaluating card playability.
 * Constructed from GameState + Player by buildPlayContext().
 */
export interface PlayContext {
  readonly inCombat: boolean;
  readonly combat?: CombatState;
  readonly combatPhase?: CombatPhase;
  readonly moveCardsAllowed: boolean;
  readonly influenceCardsAllowed: boolean;
  readonly hasTakenActionThisTurn: boolean;
  readonly isTimeBentTurn: boolean;
  readonly isResting: boolean;
  readonly hand: readonly CardId[];
  readonly usedManaFromSource: boolean;
  /** Pre-computed sideways context from rules/sideways.ts */
  readonly sidewaysContext: SidewaysContext;
  /** Whether sideways play is allowed at all (false while resting) */
  readonly sidewaysAllowed: boolean;
}

/**
 * Result for one mode (basic or powered) of playing a card.
 */
export interface EffectPlayability {
  /** Whether the combat phase or normal turn context allows this effect type */
  readonly allowed: boolean;
  /** Whether the effect can actually produce a meaningful result */
  readonly resolvable: boolean;
  /** Whether discard costs are payable after removing source card from hand */
  readonly costPayable: boolean;
  /** Whether the player can pay mana (for spells basic or powered) */
  readonly manaAvailable: boolean;
  /** Which mana color to pay with (for powered effects) */
  readonly manaColor?: ManaColor;
  /** Whether ranged-only attack was excluded (all enemies fortified) */
  readonly excludedByRanged: boolean;
  /** All checks pass */
  readonly playable: boolean;
}

/**
 * Full playability result for a single card.
 */
export interface CardPlayabilityResult {
  readonly cardId: CardId;
  readonly card: DeedCard;
  readonly isWound: boolean;
  readonly isActionCard: boolean;
  /** Action card and player has already taken an action this turn */
  readonly actionBlocked: boolean;
  readonly basic: EffectPlayability;
  readonly powered: EffectPlayability;
  readonly sideways: {
    readonly canPlay: boolean;
    readonly options: readonly SidewaysOption[];
  };
  readonly poweredManaOptions?: readonly ManaSourceInfo[];
  readonly basicEffectDescription: string;
  readonly poweredEffectDescription: string;
}

// Shared "not playable" constant for effect modes
const NOT_PLAYABLE: EffectPlayability = {
  allowed: false,
  resolvable: false,
  costPayable: true,
  manaAvailable: false,
  excludedByRanged: false,
  playable: false,
};

// ============================================================================
// CONTEXT BUILDERS
// ============================================================================

/**
 * Build a PlayContext from the current game state and player.
 * Works for both combat and normal turn contexts.
 */
export function buildPlayContext(
  state: GameState,
  player: Player
): PlayContext {
  const inCombat = state.combat != null;
  const sidewaysCtx = getSidewaysContext(state, player);
  const sidewaysOk = canPlaySideways(state, player);

  return {
    inCombat,
    combat: state.combat ?? undefined,
    combatPhase: state.combat?.phase,
    moveCardsAllowed: isRuleActive(state, player.id, RULE_MOVE_CARDS_IN_COMBAT),
    influenceCardsAllowed: isRuleActive(state, player.id, RULE_INFLUENCE_CARDS_IN_COMBAT),
    hasTakenActionThisTurn: player.hasTakenActionThisTurn,
    isTimeBentTurn: player.isTimeBentTurn,
    isResting: player.isResting,
    hand: player.hand,
    usedManaFromSource: player.usedManaFromSource,
    sidewaysContext: sidewaysCtx,
    sidewaysAllowed: sidewaysOk,
  };
}

/**
 * Build a PlayContext for combat, with an explicit CombatState.
 *
 * Used by getPlayableCardsForCombat where combat state is passed as
 * a separate argument (it may differ from state.combat in tests).
 */
export function buildCombatPlayContext(
  state: GameState,
  player: Player,
  combat: CombatState
): PlayContext {
  // Inject combat into state for resolvability checks when state.combat is null (test helper)
  const stateWithCombat: GameState =
    state.combat != null ? state : ({ ...state, combat } as GameState);

  return {
    inCombat: true,
    combat,
    combatPhase: combat.phase,
    moveCardsAllowed: isRuleActive(state, player.id, RULE_MOVE_CARDS_IN_COMBAT),
    influenceCardsAllowed: isRuleActive(state, player.id, RULE_INFLUENCE_CARDS_IN_COMBAT),
    hasTakenActionThisTurn: player.hasTakenActionThisTurn,
    isTimeBentTurn: player.isTimeBentTurn,
    isResting: player.isResting,
    hand: player.hand,
    usedManaFromSource: player.usedManaFromSource,
    sidewaysContext: { inCombat: true, phase: combat.phase },
    sidewaysAllowed: true, // In combat, sideways is always structurally allowed (phase gating handled by options)
    // Store the combat-injected state reference for resolvability
    _stateForResolvability: stateWithCombat,
  } as PlayContext;
}

// Internal: the combat context builder stores a state reference for resolvability checks
interface PlayContextInternal extends PlayContext {
  readonly _stateForResolvability?: GameState;
}

// ============================================================================
// CORE EVALUATION
// ============================================================================

/**
 * Evaluate playability for a single card across all modes (basic, powered, sideways).
 */
export function evaluateCardPlayability(
  state: GameState,
  player: Player,
  card: DeedCard,
  cardId: CardId,
  ctx: PlayContext
): CardPlayabilityResult {
  const ctxInternal = ctx as PlayContextInternal;
  const resolvabilityState = ctxInternal._stateForResolvability ?? state;

  const isWound = isWoundCardId(cardId, card);
  const isActionCard = cardConsumesAction(card);
  const actionBlocked = isActionCard && ctx.hasTakenActionThisTurn;

  // Wound cards: only sideways (when rule allows)
  if (isWound) {
    return buildWoundResult(state, player, cardId, card, ctx);
  }

  // Action cards that are blocked: skip entirely (not even sideways in normal turn)
  // In combat, action cards don't have this restriction
  if (actionBlocked && !ctx.inCombat) {
    return buildSkippedResult(cardId, card, isActionCard);
  }

  // --- Evaluate basic effect ---
  const basic = evaluateEffectMode(
    state, resolvabilityState, player, card, cardId, "basic", ctx
  );

  // --- Evaluate powered effect ---
  const powered = evaluateEffectMode(
    state, resolvabilityState, player, card, cardId, "powered", ctx
  );

  // --- Evaluate sideways ---
  const sideways = evaluateSideways(state, player, card, ctx);

  // Compute powered mana options if powered is playable
  let poweredManaOptions: readonly ManaSourceInfo[] | undefined;
  if (powered.playable && powered.manaColor) {
    const opts = computePoweredManaOptions(state, player, card, powered.manaColor);
    if (opts) {
      poweredManaOptions = opts;
    }
  }

  // In combat, describe the combat-filtered effect (with healing stripped)
  // so the player sees what the card does in combat context.
  // In normal turn, describe the raw effect.
  let basicDescEffect = card.basicEffect;
  let poweredDescEffect = card.poweredEffect;
  if (ctx.inCombat) {
    const basicCtx = getCombatEffectContext(card, "basic");
    const poweredCtx = getCombatEffectContext(card, "powered");
    basicDescEffect = basicCtx.effect ?? card.basicEffect;
    poweredDescEffect = poweredCtx.effect ?? card.poweredEffect;
  }

  return {
    cardId,
    card,
    isWound: false,
    isActionCard,
    actionBlocked,
    basic,
    powered,
    sideways,
    poweredManaOptions,
    basicEffectDescription: describeEffect(basicDescEffect),
    poweredEffectDescription: describeEffect(poweredDescEffect),
  };
}

// ============================================================================
// EFFECT MODE EVALUATION (basic or powered)
// ============================================================================

function evaluateEffectMode(
  state: GameState,
  resolvabilityState: GameState,
  player: Player,
  card: DeedCard,
  cardId: CardId,
  effectKind: CardEffectKind,
  ctx: PlayContext
): EffectPlayability {
  if (ctx.inCombat) {
    return evaluateCombatEffectMode(
      state, resolvabilityState, player, card, cardId, effectKind, ctx
    );
  }
  return evaluateNormalEffectMode(
    state, resolvabilityState, player, card, cardId, effectKind, ctx
  );
}

function evaluateCombatEffectMode(
  state: GameState,
  resolvabilityState: GameState,
  player: Player,
  card: DeedCard,
  cardId: CardId,
  effectKind: CardEffectKind,
  ctx: PlayContext
): EffectPlayability {
  const combat = ctx.combat!;
  const phase = ctx.combatPhase!;

  // ASSIGN_DAMAGE phase: no card plays allowed (only sideways is possible)
  if (phase === COMBAT_PHASE_ASSIGN_DAMAGE) {
    return NOT_PLAYABLE;
  }

  // Get combat-filtered effect (strips healing)
  const context = getCombatEffectContext(card, effectKind);

  // Apply combat-specific exclusions
  const effect = context.effect;
  if (!effect) {
    return NOT_PLAYABLE;
  }

  // Exclude move-only effects when move isn't useful
  const moveExcluded = !ctx.moveCardsAllowed &&
    shouldExcludeMoveOnlyEffect(effect, state, player.id, combat);
  if (moveExcluded) {
    return NOT_PLAYABLE;
  }

  // Exclude influence-only effects when influence isn't useful
  const influenceExcluded = !ctx.influenceCardsAllowed &&
    shouldExcludeInfluenceOnlyEffect(effect, state, player.id);
  if (influenceExcluded) {
    return NOT_PLAYABLE;
  }

  // Exclude ranged-only effects when all enemies are fortified
  const rangedExcluded = isRangedAttackUnusable(effect, state, player.id, combat);
  if (rangedExcluded) {
    return {
      allowed: false,
      resolvable: false,
      costPayable: true,
      manaAvailable: false,
      excludedByRanged: true,
      playable: false,
    };
  }

  // Check card-level combat phase restriction
  const phaseRestrictionMet = !card.combatPhaseRestriction ||
    card.combatPhaseRestriction.includes(phase);

  // Check phase allowance
  const allowed = phaseRestrictionMet && isCombatEffectAllowed(
    effect, phase, context.allowAnyPhase, ctx.moveCardsAllowed, ctx.influenceCardsAllowed
  );

  // Check resolvability
  let resolvable = isEffectResolvable(resolvabilityState, player.id, effect);

  // Card boost special case: must have eligible targets
  if (resolvable && effectKind === "powered" && card.poweredEffect.type === EFFECT_CARD_BOOST) {
    resolvable = getEligibleBoostTargets(player, cardId).length > 0;
  }

  // "Throw away action card" effects: must have eligible targets after source leaves hand
  if (resolvable) {
    resolvable = checkThrowAwayResolvable(effect, ctx.hand, cardId, resolvable);
  }

  // Check discard cost
  const costPayable = isDiscardCostPayableAfterPlayingSource(effect, ctx.hand, cardId);

  // Check mana — skip expensive lookup if already known to be unplayable (for powered)
  const manaResult = (effectKind === "powered" && (!allowed || !resolvable || !costPayable))
    ? { available: false } as ManaResult
    : evaluateMana(state, player, card, cardId, effectKind, ctx);

  const playable = allowed && resolvable && costPayable && manaResult.available;

  return {
    allowed,
    resolvable,
    costPayable,
    manaAvailable: manaResult.available,
    manaColor: manaResult.color,
    excludedByRanged: false,
    playable,
  };
}

function evaluateNormalEffectMode(
  state: GameState,
  resolvabilityState: GameState,
  player: Player,
  card: DeedCard,
  cardId: CardId,
  effectKind: CardEffectKind,
  ctx: PlayContext
): EffectPlayability {
  const effect = effectKind === "basic" ? card.basicEffect : card.poweredEffect;

  // Check if effect type is allowed on normal turn
  const allowed = isNormalEffectAllowed(effect, effectKind);

  // Check resolvability
  let resolvable = isEffectResolvable(resolvabilityState, player.id, effect);

  // Card boost special case: must have eligible targets
  if (resolvable && effectKind === "powered" && card.poweredEffect.type === EFFECT_CARD_BOOST) {
    resolvable = getEligibleBoostTargets(player, cardId).length > 0;
  }

  // "Throw away action card" effects: must have eligible targets after source leaves hand
  if (resolvable) {
    resolvable = checkThrowAwayResolvable(effect, ctx.hand, cardId, resolvable);
  }

  // Check discard cost
  const costPayable = isDiscardCostPayableAfterPlayingSource(effect, ctx.hand, cardId);

  // Check mana — skip expensive lookup if already known to be unplayable (for powered)
  const manaResult = (effectKind === "powered" && (!allowed || !resolvable || !costPayable))
    ? { available: false } as ManaResult
    : evaluateMana(state, player, card, cardId, effectKind, ctx);

  const playable = allowed && resolvable && costPayable && manaResult.available;

  return {
    allowed,
    resolvable,
    costPayable,
    manaAvailable: manaResult.available,
    manaColor: manaResult.color,
    excludedByRanged: false,
    playable,
  };
}

// ============================================================================
// MANA EVALUATION
// ============================================================================

interface ManaResult {
  readonly available: boolean;
  readonly color?: ManaColor;
}

function evaluateMana(
  state: GameState,
  player: Player,
  card: DeedCard,
  cardId: CardId,
  effectKind: CardEffectKind,
  ctx: PlayContext
): ManaResult {
  if (effectKind === "basic") {
    // For spells, basic effect requires the spell's color mana
    if (card.cardType === DEED_CARD_TYPE_SPELL) {
      return { available: canPayForSpellBasic(state, player, card) };
    }
    // Action cards don't need mana for basic effect
    return { available: true };
  }

  // Powered: check time bending chain first
  if (isTimeBendingChainPrevented(cardId, true, ctx.isTimeBentTurn)) {
    return { available: false };
  }

  // Find a payable mana color
  const color = findPayableManaColor(state, player, card);
  return { available: color !== undefined, color };
}

// ============================================================================
// SIDEWAYS EVALUATION
// ============================================================================

function evaluateSideways(
  state: GameState,
  player: Player,
  card: DeedCard,
  ctx: PlayContext
): { canPlay: boolean; options: readonly SidewaysOption[] } {
  // Compute mana color match for Universal Power modifier
  const manaColorMatchesCard = getManaColorMatchesCard(state, player, card);

  const effectiveSidewaysValue = getEffectiveSidewaysValue(
    state,
    player.id,
    false,
    ctx.usedManaFromSource,
    manaColorMatchesCard,
    card.cardType
  );

  const options = getSidewaysOptionsForValue(effectiveSidewaysValue, ctx.sidewaysContext);

  if (options.length === 0) {
    return { canPlay: false, options: [] };
  }

  // In normal turn: gate by canPlaySideways (resting check)
  if (!ctx.inCombat && !ctx.sidewaysAllowed) {
    return { canPlay: false, options: [...options] };
  }

  return { canPlay: true, options: [...options] };
}

// ============================================================================
// WOUND CARD RESULT
// ============================================================================

function buildWoundResult(
  state: GameState,
  player: Player,
  cardId: CardId,
  card: DeedCard,
  ctx: PlayContext
): CardPlayabilityResult {
  const woundsPlayable = isRuleActive(state, player.id, RULE_WOUNDS_PLAYABLE_SIDEWAYS);

  if (!woundsPlayable) {
    return buildSkippedWoundResult(cardId, card);
  }

  const sidewaysValue = getEffectiveSidewaysValue(
    state,
    player.id,
    true,
    ctx.usedManaFromSource
  );

  if (sidewaysValue <= 0) {
    return buildSkippedWoundResult(cardId, card);
  }

  const options = getSidewaysOptionsForValue(sidewaysValue, ctx.sidewaysContext);

  if (options.length === 0) {
    return buildSkippedWoundResult(cardId, card);
  }

  return {
    cardId,
    card,
    isWound: true,
    isActionCard: false,
    actionBlocked: false,
    basic: NOT_PLAYABLE,
    powered: NOT_PLAYABLE,
    sideways: { canPlay: true, options: [...options] },
    basicEffectDescription: describeEffect(card.basicEffect),
    poweredEffectDescription: describeEffect(card.poweredEffect),
  };
}

function buildSkippedWoundResult(cardId: CardId, card: DeedCard): CardPlayabilityResult {
  return {
    cardId,
    card,
    isWound: true,
    isActionCard: false,
    actionBlocked: false,
    basic: NOT_PLAYABLE,
    powered: NOT_PLAYABLE,
    sideways: { canPlay: false, options: [] },
    basicEffectDescription: describeEffect(card.basicEffect),
    poweredEffectDescription: describeEffect(card.poweredEffect),
  };
}

// ============================================================================
// SKIPPED CARD RESULT (action blocked, etc.)
// ============================================================================

function buildSkippedResult(
  cardId: CardId,
  card: DeedCard,
  isActionCard: boolean
): CardPlayabilityResult {
  return {
    cardId,
    card,
    isWound: false,
    isActionCard,
    actionBlocked: true,
    basic: NOT_PLAYABLE,
    powered: NOT_PLAYABLE,
    sideways: { canPlay: false, options: [] },
    basicEffectDescription: describeEffect(card.basicEffect),
    poweredEffectDescription: describeEffect(card.poweredEffect),
  };
}

// ============================================================================
// BATCH EVALUATION
// ============================================================================

/**
 * Evaluate playability for all cards in a player's hand.
 */
export function evaluateHandPlayability(
  state: GameState,
  player: Player,
  ctx: PlayContext
): CardPlayabilityResult[] {
  const results: CardPlayabilityResult[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    const result = evaluateCardPlayability(state, player, card, cardId, ctx);

    // Only include cards that have at least one playable option
    if (result.basic.playable || result.powered.playable || result.sideways.canPlay) {
      results.push(result);
    }
  }

  return results;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Override resolvability for effects that require throwing away an action card.
 *
 * The generic `isEffectResolvable()` can't exclude the source card because it
 * doesn't receive `sourceCardId`. This helper calls each effect's own
 * eligibility function which correctly filters out the source card.
 */
function checkThrowAwayResolvable(
  effect: import("../../../types/cards.js").CardEffect,
  hand: readonly CardId[],
  sourceCardId: CardId,
  currentResolvable: boolean
): boolean {
  switch (effect.type) {
    case EFFECT_DECOMPOSE:
      return getCardsEligibleForDecompose(hand, sourceCardId).length > 0;
    case EFFECT_MAXIMAL_EFFECT:
      return getCardsEligibleForMaximalEffect(hand, sourceCardId).length > 0;
    case EFFECT_BOOK_OF_WISDOM:
      return getCardsEligibleForBookOfWisdom(hand, sourceCardId).length > 0;
    case EFFECT_TRAINING:
      return getCardsEligibleForTraining(hand, sourceCardId).length > 0;
    default:
      return currentResolvable;
  }
}

/**
 * Check if the Universal Power mana color matches the card's color.
 * Used for the sideways value bonus.
 */
function getManaColorMatchesCard(
  state: GameState,
  player: Player,
  card: DeedCard
): boolean | undefined {
  const playerMods = getModifiersForPlayer(state, player.id);
  const colorMatchMod = playerMods.find(
    (m) =>
      m.effect.type === EFFECT_SIDEWAYS_VALUE &&
      (m.effect as SidewaysValueModifier).condition === SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR &&
      (m.effect as SidewaysValueModifier).manaColor != null
  );

  if (!colorMatchMod) {
    return undefined;
  }

  const mod = colorMatchMod.effect as SidewaysValueModifier;
  return card.poweredBy?.includes(mod.manaColor!) ?? false;
}
