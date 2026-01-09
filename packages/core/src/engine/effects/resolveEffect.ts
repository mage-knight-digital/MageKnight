/**
 * Effect resolver - applies card effects to game state
 *
 * Phase 1: Basic effects only (no mana powering)
 * - GainMove: add move points
 * - GainInfluence: add influence points
 * - GainAttack: accumulate attack value for combat
 * - GainBlock: accumulate block value for combat
 * - GainHealing: heal wounds from hand (removes wound cards)
 * - Compound: resolve all sub-effects
 * - Choice: requires player selection (Phase 2)
 */

import type { GameState } from "../../state/GameState.js";
import type {
  CardEffect,
  ScalableBaseEffect,
  ResolveBoostTargetEffect,
  DeedCard,
} from "../../types/cards.js";
import {
  DEED_CARD_TYPE_BASIC_ACTION,
  DEED_CARD_TYPE_ADVANCED_ACTION,
} from "../../types/cards.js";
import type { Player } from "../../types/player.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { CARD_WOUND, MANA_TOKEN_SOURCE_CARD, UNITS, UNIT_STATE_READY, UNIT_STATE_SPENT, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import { getCard } from "../validActions/cards.js";
import type { PlayerUnit } from "../../types/unit.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { evaluateScalingFactor } from "./scalingEvaluator.js";
import { EFFECT_RULE_OVERRIDE, RULE_EXTRA_SOURCE_DIE } from "../modifierConstants.js";
import type { ManaDrawPickDieEffect, ManaDrawSetColorEffect } from "../../types/cards.js";
import { evaluateCondition } from "./conditionEvaluator.js";
import {
  updatePlayer,
  applyGainMove,
  applyGainInfluence,
  applyGainMana,
  applyGainAttack,
  applyGainBlock,
  applyGainHealing,
  applyDrawCards,
  applyChangeReputation,
  applyGainCrystal,
  applyModifierEffect,
  MIN_REPUTATION,
  MAX_REPUTATION,
} from "./atomicEffects.js";

export interface EffectResolutionResult {
  readonly state: GameState;
  readonly description: string;
  readonly requiresChoice?: boolean;
  /** True if a conditional effect was resolved — affects undo (command should be non-reversible) */
  readonly containsConditional?: boolean;
  /** True if a scaling effect was resolved — affects undo (command should be non-reversible) */
  readonly containsScaling?: boolean;
  /** Dynamically generated choice options (used by CardBoostEffect to list eligible cards) */
  readonly dynamicChoiceOptions?: readonly CardEffect[];
}

/**
 * Check if an effect can actually produce a result given the current game state.
 * Used to filter out choice options that would be no-ops (e.g., "draw card" when deck is empty).
 */
export function isEffectResolvable(
  state: GameState,
  playerId: string,
  effect: CardEffect
): boolean {
  const player = state.players.find((p) => p.id === playerId);
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

    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
      // Can only convert mana to crystal if player has mana tokens
      // Only basic colors (red, blue, green, white) can become crystals
      return player.pureMana.some((token) =>
        ["red", "blue", "green", "white"].includes(token.color)
      );

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
      // Internal effects, always resolvable if being called
      return true;

    default:
      // Unknown effect types are considered resolvable (fail-safe)
      return true;
  }
}

/**
 * Apply a bonus to an effect's amount (for Move, Influence, Attack, Block).
 * Recursively applies to compound/choice/conditional/scaling effects.
 * Other effect types (heal, draw, mana) are returned unchanged.
 */
export function addBonusToEffect(effect: CardEffect, bonus: number): CardEffect {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
    case EFFECT_GAIN_INFLUENCE:
      return { ...effect, amount: effect.amount + bonus };

    case EFFECT_GAIN_ATTACK:
    case EFFECT_GAIN_BLOCK:
      return { ...effect, amount: effect.amount + bonus };

    case EFFECT_CHOICE:
      return {
        ...effect,
        options: effect.options.map((e) => addBonusToEffect(e, bonus)),
      };

    case EFFECT_COMPOUND:
      return {
        ...effect,
        effects: effect.effects.map((e) => addBonusToEffect(e, bonus)),
      };

    case EFFECT_CONDITIONAL: {
      const result = {
        ...effect,
        thenEffect: addBonusToEffect(effect.thenEffect, bonus),
      };
      if (effect.elseEffect) {
        return { ...result, elseEffect: addBonusToEffect(effect.elseEffect, bonus) };
      }
      return result;
    }

    case EFFECT_SCALING:
      // Apply bonus to the base effect of a scaling effect
      return {
        ...effect,
        baseEffect: addBonusToEffect(effect.baseEffect, bonus) as ScalableBaseEffect,
      };

    // Other effects (heal, draw, mana, etc.) are unchanged
    default:
      return effect;
  }
}

/**
 * Get cards from player's hand that are eligible for boosting.
 * Eligible: Basic Action and Advanced Action cards (not wounds, spells, artifacts).
 */
function getEligibleBoostTargets(player: Player): DeedCard[] {
  const eligibleCards: DeedCard[] = [];

  for (const cardId of player.hand) {
    const card = getCard(cardId);
    if (!card) continue;

    // Only action cards can be boosted (not spells, artifacts, or wounds)
    if (
      card.cardType === DEED_CARD_TYPE_BASIC_ACTION ||
      card.cardType === DEED_CARD_TYPE_ADVANCED_ACTION
    ) {
      // Wounds have cardType basic_action but id is CARD_WOUND
      if (cardId !== CARD_WOUND) {
        eligibleCards.push(card);
      }
    }
  }

  return eligibleCards;
}

/**
 * Get spent units that are at or below a given level.
 * Used by ReadyUnitEffect to find eligible targets.
 *
 * Ready effects target Spent units only (you can't "ready" something already ready).
 * Wound status is irrelevant - a unit can be readied whether wounded or not.
 */
function getSpentUnitsAtOrBelowLevel(
  units: readonly PlayerUnit[],
  maxLevel: 1 | 2 | 3 | 4
): PlayerUnit[] {
  return units.filter((unit) => {
    // Must be spent (can't ready an already-ready unit)
    if (unit.state !== UNIT_STATE_SPENT) return false;
    const unitDef = UNITS[unit.unitId];
    return unitDef && unitDef.level <= maxLevel;
  });
}

export function resolveEffect(
  state: GameState,
  playerId: string,
  effect: CardEffect,
  sourceCardId?: string
): EffectResolutionResult {
  const playerIndex = state.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error(`Player not found: ${playerId}`);
  }

  const player = state.players[playerIndex];
  if (!player) {
    throw new Error(`Player not found at index: ${playerIndex}`);
  }

  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return applyGainMove(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_INFLUENCE:
      return applyGainInfluence(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_ATTACK:
      return applyGainAttack(state, playerIndex, player, effect);

    case EFFECT_GAIN_BLOCK:
      return applyGainBlock(state, playerIndex, player, effect);

    case EFFECT_GAIN_HEALING:
      return applyGainHealing(state, playerIndex, player, effect.amount);

    case EFFECT_DRAW_CARDS:
      return applyDrawCards(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_MANA: {
      if (effect.color === "any") {
        // MANA_ANY should be resolved via player choice, not passed directly
        return {
          state,
          description: "Mana color choice required",
          requiresChoice: true,
        };
      }
      return applyGainMana(state, playerIndex, player, effect.color);
    }

    case EFFECT_CHANGE_REPUTATION:
      return applyChangeReputation(state, playerIndex, player, effect.amount);

    case EFFECT_GAIN_CRYSTAL:
      return applyGainCrystal(state, playerIndex, player, effect.color);

    case EFFECT_CONVERT_MANA_TO_CRYSTAL:
      // Player must choose which mana token to convert
      // This will be handled via the choice system
      return {
        state,
        description: "Choose mana token to convert to crystal",
        requiresChoice: true,
      };

    case EFFECT_APPLY_MODIFIER:
      return applyModifierEffect(state, playerId, effect, sourceCardId);

    case EFFECT_COMPOUND:
      return resolveCompoundEffect(state, playerId, effect.effects, sourceCardId);

    case EFFECT_CHOICE:
      // Phase 1: Return that choice is required
      // Phase 2: Use choiceIndex from action to pick option
      return {
        state,
        description: "Choice required",
        requiresChoice: true,
      };

    case EFFECT_CONDITIONAL: {
      const conditionMet = evaluateCondition(state, playerId, effect.condition);

      const effectToApply = conditionMet ? effect.thenEffect : effect.elseEffect;

      if (!effectToApply) {
        // Condition not met and no else — no-op
        return {
          state,
          description: "Condition not met (no else branch)",
          containsConditional: true,
        };
      }

      const result = resolveEffect(state, playerId, effectToApply, sourceCardId);

      // Mark that a conditional was resolved — affects undo
      return {
        ...result,
        containsConditional: true,
      };
    }

    case EFFECT_SCALING: {
      const scalingCount = evaluateScalingFactor(state, playerId, effect.scalingFactor);
      const scalingBonus = scalingCount * effect.amountPerUnit;

      // Apply minimum/maximum
      let totalBonus = scalingBonus;
      if (effect.minimum !== undefined) {
        totalBonus = Math.max(effect.minimum, totalBonus);
      }
      if (effect.maximum !== undefined) {
        totalBonus = Math.min(effect.maximum, totalBonus);
      }

      // Create modified base effect with increased amount
      const scaledEffect: ScalableBaseEffect = {
        ...effect.baseEffect,
        amount: effect.baseEffect.amount + totalBonus,
      };

      // Resolve the scaled effect
      const result = resolveEffect(state, playerId, scaledEffect, sourceCardId);

      // Mark that a scaling effect was resolved — affects undo
      return {
        ...result,
        description: `${result.description} (scaled by ${scalingCount})`,
        containsScaling: true,
      };
    }

    case EFFECT_CARD_BOOST: {
      // Card boost: player must choose an Action card from hand to play with boosted powered effect
      const eligibleCards = getEligibleBoostTargets(player);

      if (eligibleCards.length === 0) {
        // No eligible cards to boost
        return {
          state,
          description: "No eligible Action cards in hand to boost",
        };
      }

      // Generate dynamic choice options - one ResolveBoostTargetEffect per eligible card
      const dynamicOptions: ResolveBoostTargetEffect[] = eligibleCards.map((card) => ({
        type: EFFECT_RESOLVE_BOOST_TARGET,
        targetCardId: card.id,
        bonus: effect.bonus,
      }));

      return {
        state,
        description: "Choose an Action card to boost",
        requiresChoice: true,
        dynamicChoiceOptions: dynamicOptions,
      };
    }

    case EFFECT_RESOLVE_BOOST_TARGET: {
      // Resolve the boosted card's powered effect with the bonus applied
      const targetCard = getCard(effect.targetCardId);
      if (!targetCard) {
        return {
          state,
          description: `Card not found: ${effect.targetCardId}`,
        };
      }

      // Move the target card from hand to play area
      const cardIndex = player.hand.indexOf(effect.targetCardId);
      if (cardIndex === -1) {
        return {
          state,
          description: `Card not in hand: ${effect.targetCardId}`,
        };
      }

      const newHand = [...player.hand];
      newHand.splice(cardIndex, 1);
      const updatedPlayer: Player = {
        ...player,
        hand: newHand,
        playArea: [...player.playArea, effect.targetCardId],
      };
      const stateWithCardPlayed = updatePlayer(state, playerIndex, updatedPlayer);

      // Apply bonus to the powered effect and resolve it
      const boostedEffect = addBonusToEffect(targetCard.poweredEffect, effect.bonus);
      const result = resolveEffect(stateWithCardPlayed, playerId, boostedEffect, effect.targetCardId);

      return {
        ...result,
        description: `Boosted ${targetCard.name}: ${result.description}`,
      };
    }

    case EFFECT_READY_UNIT: {
      // Find spent units at or below the max level
      // "Ready a unit" targets Spent units only (can't ready an already-ready unit)
      // Wound status is irrelevant - units can be readied whether wounded or not
      const eligibleUnits = getSpentUnitsAtOrBelowLevel(player.units, effect.maxLevel);

      if (eligibleUnits.length === 0) {
        return {
          state,
          description: "No spent units to ready",
        };
      }

      // If only one eligible unit, auto-resolve
      if (eligibleUnits.length === 1) {
        const targetUnit = eligibleUnits[0];
        if (!targetUnit) {
          throw new Error("Expected single eligible unit");
        }
        return applyReadyUnit(state, playerIndex, player, targetUnit.instanceId);
      }

      // Multiple eligible units — player must choose
      // This will be handled via pendingChoice similar to other choice effects
      return {
        state,
        description: "Choose a wounded unit to ready",
        requiresChoice: true,
      };
    }

    case EFFECT_MANA_DRAW_POWERED: {
      // Mana Draw/Mana Pull powered: Take dice, set colors, gain mana tokens
      // Parameterized: diceCount (1 or 2), tokensPerDie (1 or 2)
      const { diceCount, tokensPerDie } = effect;

      // Step 1: Select which die to take (filter out already-taken dice)
      const availableDice = state.source.dice.filter(
        (d) => d.takenByPlayerId === null
      );

      if (availableDice.length === 0) {
        return {
          state,
          description: "No dice available in the Source",
        };
      }

      // Check if we have enough dice for the effect
      if (availableDice.length < diceCount) {
        // Not enough dice - partial effect (take what's available)
        // For now, proceed with what's available
      }

      const remainingDiceToSelect = diceCount - 1; // After picking this die
      const alreadySelectedDieIds: readonly string[] = [];

      // Auto-select if there's no meaningful choice:
      // - Only one die available
      // - Need one die (diceCount=1)
      // - Available dice exactly matches what we need (e.g., need 2 and have 2)
      if (availableDice.length <= diceCount) {
        const die = availableDice[0];
        if (!die) {
          throw new Error("Expected at least one available die");
        }
        // Generate color choice options directly
        const colorOptions: ManaDrawSetColorEffect[] = [
          { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_RED, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
          { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_BLUE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
          { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_GREEN, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
          { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_WHITE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
        ];
        return {
          state,
          description: `Choose color for the ${die.color} die`,
          requiresChoice: true,
          dynamicChoiceOptions: colorOptions,
        };
      }

      // Multiple dice available and need to pick — player must first choose which die
      const dieOptions: ManaDrawPickDieEffect[] = availableDice.map((die) => ({
        type: EFFECT_MANA_DRAW_PICK_DIE,
        dieId: die.id,
        remainingDiceToSelect,
        tokensPerDie,
        alreadySelectedDieIds,
      }));

      return {
        state,
        description: "Choose a die from the Source",
        requiresChoice: true,
        dynamicChoiceOptions: dieOptions,
      };
    }

    case EFFECT_MANA_DRAW_PICK_DIE: {
      // Player selected a die, now they choose a color
      const { dieId, remainingDiceToSelect, tokensPerDie, alreadySelectedDieIds } = effect;

      const colorOptions: ManaDrawSetColorEffect[] = [
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_RED, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_BLUE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_GREEN, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId, color: MANA_WHITE, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds },
      ];

      // Find the die to show its current color in description
      const selectedDie = state.source.dice.find((d) => d.id === dieId);
      const dieColor = selectedDie?.color ?? "unknown";

      return {
        state,
        description: `Choose color for the ${dieColor} die`,
        requiresChoice: true,
        dynamicChoiceOptions: colorOptions,
      };
    }

    case EFFECT_MANA_DRAW_SET_COLOR: {
      // Resolve this die: set color and gain tokens
      const { dieId, color, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds } = effect;
      return applyManaDrawSetColor(state, playerIndex, player, dieId, color, tokensPerDie, remainingDiceToSelect, alreadySelectedDieIds);
    }

    default:
      // Unknown effect type — log and continue
      return {
        state,
        description: "Unhandled effect type",
      };
  }
}

function applyReadyUnit(
  state: GameState,
  playerIndex: number,
  player: Player,
  unitInstanceId: string
): EffectResolutionResult {
  const unitIndex = player.units.findIndex((u) => u.instanceId === unitInstanceId);
  if (unitIndex === -1) {
    return {
      state,
      description: `Unit not found: ${unitInstanceId}`,
    };
  }

  const unit = player.units[unitIndex];
  if (!unit) {
    return {
      state,
      description: `Unit not found: ${unitInstanceId}`,
    };
  }

  // Validate unit is spent
  if (unit.state !== UNIT_STATE_SPENT) {
    return {
      state,
      description: "Unit is already ready",
    };
  }

  // Ready the unit: Spent → Ready
  // Wound status is unchanged (if wounded, stays wounded)
  const updatedUnits = [...player.units];
  updatedUnits[unitIndex] = {
    ...unit,
    state: UNIT_STATE_READY,
  };

  const updatedPlayer: Player = {
    ...player,
    units: updatedUnits,
  };

  const unitDef = UNITS[unit.unitId];
  const unitName = unitDef?.name ?? unit.unitId;

  return {
    state: updatePlayer(state, playerIndex, updatedPlayer),
    description: `Readied ${unitName}`,
  };
}

/**
 * Apply Mana Draw/Mana Pull powered resolution for one die:
 * - Set the die color to the chosen color
 * - Mark die as taken by player (unavailable to others until turn ends)
 * - Gain mana tokens of the chosen color (tokensPerDie count)
 * - If more dice to select, chain to next die selection
 *
 * Note: At end of turn, dice are returned WITHOUT rerolling.
 * This is tracked via player.manaDrawDieIds array. The endTurnCommand will
 * clear takenByPlayerId without rerolling for these dice.
 */
function applyManaDrawSetColor(
  state: GameState,
  playerIndex: number,
  player: Player,
  dieId: string,
  color: BasicManaColor,
  tokensPerDie: 1 | 2,
  remainingDiceToSelect: number,
  alreadySelectedDieIds: readonly string[]
): EffectResolutionResult {
  // Find and update the die
  const dieIndex = state.source.dice.findIndex((d) => d.id === dieId);
  const originalDie = state.source.dice[dieIndex];
  if (dieIndex === -1 || !originalDie) {
    return {
      state,
      description: `Die not found: ${dieId}`,
    };
  }

  // Update the die: set color, mark as taken by player
  // isDepleted = false since basic colors are never depleted
  const updatedDice = [...state.source.dice];
  updatedDice[dieIndex] = {
    ...originalDie,
    color,
    isDepleted: false,
    takenByPlayerId: player.id, // Taken until turn ends
  };

  const stateWithUpdatedDie: GameState = {
    ...state,
    source: {
      ...state.source,
      dice: updatedDice,
    },
  };

  // Gain mana tokens of the chosen color (1 or 2 depending on card)
  const newTokens = Array.from({ length: tokensPerDie }, () => ({
    color,
    source: MANA_TOKEN_SOURCE_CARD,
  }));

  // Track this die for no-reroll at turn end
  const updatedManaDrawDieIds = [...player.manaDrawDieIds, dieId];

  const updatedPlayer: Player = {
    ...player,
    pureMana: [...player.pureMana, ...newTokens],
    manaDrawDieIds: updatedManaDrawDieIds,
  };

  const stateAfterTokens = updatePlayer(stateWithUpdatedDie, playerIndex, updatedPlayer);
  const tokenText = tokensPerDie === 1 ? `1 ${color} mana` : `2 ${color} mana`;

  // If more dice to select (Mana Pull), chain to next die selection
  if (remainingDiceToSelect > 0) {
    const newAlreadySelected = [...alreadySelectedDieIds, dieId];

    // Find available dice (not taken, not already selected in this chain)
    const availableDice = stateAfterTokens.source.dice.filter(
      (d) => d.takenByPlayerId === null && !newAlreadySelected.includes(d.id)
    );

    if (availableDice.length === 0) {
      // No more dice available, end here
      return {
        state: stateAfterTokens,
        description: `Set die to ${color}, gained ${tokenText} (no more dice available)`,
      };
    }

    const nextRemainingDice = remainingDiceToSelect - 1;

    // If only one die left or this is the last die needed, auto-select and go to color
    if (availableDice.length === 1) {
      const die = availableDice[0];
      if (!die) {
        throw new Error("Expected at least one available die");
      }
      const colorOptions: ManaDrawSetColorEffect[] = [
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_RED, tokensPerDie, remainingDiceToSelect: nextRemainingDice, alreadySelectedDieIds: newAlreadySelected },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_BLUE, tokensPerDie, remainingDiceToSelect: nextRemainingDice, alreadySelectedDieIds: newAlreadySelected },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_GREEN, tokensPerDie, remainingDiceToSelect: nextRemainingDice, alreadySelectedDieIds: newAlreadySelected },
        { type: EFFECT_MANA_DRAW_SET_COLOR, dieId: die.id, color: MANA_WHITE, tokensPerDie, remainingDiceToSelect: nextRemainingDice, alreadySelectedDieIds: newAlreadySelected },
      ];
      return {
        state: stateAfterTokens,
        description: `Set die to ${color}, gained ${tokenText}. Choose color for next die (${die.color})`,
        requiresChoice: true,
        dynamicChoiceOptions: colorOptions,
      };
    }

    // Multiple dice available, let player choose
    const dieOptions: ManaDrawPickDieEffect[] = availableDice.map((die) => ({
      type: EFFECT_MANA_DRAW_PICK_DIE,
      dieId: die.id,
      remainingDiceToSelect: nextRemainingDice,
      tokensPerDie,
      alreadySelectedDieIds: newAlreadySelected,
    }));

    return {
      state: stateAfterTokens,
      description: `Set die to ${color}, gained ${tokenText}. Choose another die`,
      requiresChoice: true,
      dynamicChoiceOptions: dieOptions,
    };
  }

  // No more dice to select, we're done
  return {
    state: stateAfterTokens,
    description: `Set die to ${color}, gained ${tokenText}`,
  };
}

function resolveCompoundEffect(
  state: GameState,
  playerId: string,
  effects: readonly CardEffect[],
  sourceCardId?: string
): EffectResolutionResult {
  let currentState = state;
  const descriptions: string[] = [];

  for (const effect of effects) {
    const result = resolveEffect(currentState, playerId, effect, sourceCardId);
    if (result.requiresChoice) {
      return result; // Stop at first choice
    }
    currentState = result.state;
    descriptions.push(result.description);
  }

  return {
    state: currentState,
    description: descriptions.join(", "),
  };
}

// Reverse an effect (for undo)
export function reverseEffect(player: Player, effect: CardEffect): Player {
  switch (effect.type) {
    case EFFECT_GAIN_MOVE:
      return { ...player, movePoints: player.movePoints - effect.amount };

    case EFFECT_GAIN_INFLUENCE:
      return {
        ...player,
        influencePoints: player.influencePoints - effect.amount,
      };

    case EFFECT_GAIN_ATTACK: {
      const attack = { ...player.combatAccumulator.attack };
      switch (effect.combatType) {
        case COMBAT_TYPE_RANGED:
          attack.ranged -= effect.amount;
          break;
        case COMBAT_TYPE_SIEGE:
          attack.siege -= effect.amount;
          break;
        default:
          attack.normal -= effect.amount;
      }
      return {
        ...player,
        combatAccumulator: { ...player.combatAccumulator, attack },
      };
    }

    case EFFECT_GAIN_BLOCK:
      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block: player.combatAccumulator.block - effect.amount,
        },
      };

    case EFFECT_CHANGE_REPUTATION:
      // Reverse reputation change (clamp to bounds)
      return {
        ...player,
        reputation: Math.max(
          MIN_REPUTATION,
          Math.min(MAX_REPUTATION, player.reputation - effect.amount)
        ),
      };

    case EFFECT_GAIN_CRYSTAL:
      // Reverse crystal gain (don't go below 0)
      return {
        ...player,
        crystals: {
          ...player.crystals,
          [effect.color]: Math.max(0, player.crystals[effect.color] - 1),
        },
      };

    case EFFECT_COMPOUND: {
      let result = player;
      for (const subEffect of effect.effects) {
        result = reverseEffect(result, subEffect);
      }
      return result;
    }

    case EFFECT_CONDITIONAL:
      // Cannot reliably reverse conditional effects — the condition may have
      // changed since the effect was applied, so we don't know which branch
      // was actually executed. Commands containing conditional effects should
      // be marked as non-reversible (isReversible: false).
      return player;

    case EFFECT_SCALING:
      // Cannot reliably reverse scaling effects — the scaling count may have
      // changed since the effect was applied (enemies defeated, wounds played).
      // Commands containing scaling effects should be marked as non-reversible.
      return player;

    case EFFECT_DRAW_CARDS:
      // Drawing cards reveals hidden information (deck contents), so this
      // effect should be non-reversible. Commands containing draw effects
      // should create an undo checkpoint (CHECKPOINT_REASON_CARD_DRAWN).
      return player;

    default:
      return player;
  }
}
