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
import type { CardEffect, ScalableBaseEffect } from "../../types/cards.js";
import { DEED_CARD_TYPE_BASIC_ACTION, DEED_CARD_TYPE_ADVANCED_ACTION } from "../../types/cards.js";
import type { Player } from "../../types/player.js";
import { CARD_WOUND } from "@mage-knight/shared";
import { getCard } from "../validActions/cards.js";
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
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  MANA_ANY,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { evaluateScalingFactor } from "./scalingEvaluator.js";
import {
  DURATION_COMBAT,
  EFFECT_RULE_OVERRIDE,
  RULE_EXTRA_SOURCE_DIE,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../modifierConstants.js";
import { evaluateCondition } from "./conditionEvaluator.js";
import { addModifier } from "../modifiers.js";
import type { ResolveCombatEnemyTargetEffect } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";
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
import {
  handleManaDrawPowered,
  handleManaDrawPickDie,
  applyManaDrawSetColor,
} from "./manaDrawEffects.js";
import { handleReadyUnit, getSpentUnitsAtOrBelowLevel } from "./unitEffects.js";
import {
  getEligibleBoostTargets,
  generateBoostChoiceOptions,
  addBonusToEffect,
} from "./cardBoostEffects.js";

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
  /**
   * The effect that was actually resolved and modified state.
   *
   * CRITICAL FOR UNDO: When an entry effect (like EFFECT_CONVERT_MANA_TO_CRYSTAL)
   * internally chains to a different effect (like EFFECT_CRYSTALLIZE_COLOR), this
   * field captures what actually ran. The command layer needs this to call the
   * correct reverseEffect().
   *
   * If not set, the command assumes the original effect was what resolved.
   */
  readonly resolvedEffect?: CardEffect;
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

// addBonusToEffect is re-exported from cardBoostEffects.ts
export { addBonusToEffect } from "./cardBoostEffects.js";


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
      if (effect.color === MANA_ANY) {
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

    case EFFECT_CONVERT_MANA_TO_CRYSTAL: {
      // Player must choose which mana token to convert to crystal
      // Only basic colors (red, blue, green, white) can become crystals
      const basicColors = ["red", "blue", "green", "white"] as const;
      const availableColors = new Set(
        player.pureMana
          .filter((token) => basicColors.includes(token.color as (typeof basicColors)[number]))
          .map((token) => token.color)
      );

      if (availableColors.size === 0) {
        // No valid tokens to convert - shouldn't happen if isEffectResolvable was checked
        return {
          state,
          description: "No mana tokens available to convert",
        };
      }

      if (availableColors.size === 1) {
        // Auto-resolve: only one color available, no meaningful choice
        const color = [...availableColors][0] as "red" | "blue" | "green" | "white";
        const crystallizeEffect = {
          type: EFFECT_CRYSTALLIZE_COLOR as typeof EFFECT_CRYSTALLIZE_COLOR,
          color,
        };
        const result = resolveEffect(state, playerId, crystallizeEffect, sourceCardId);
        // CRITICAL: Return resolvedEffect so command layer knows what to undo
        return {
          ...result,
          resolvedEffect: crystallizeEffect,
        };
      }

      // Multiple colors available - generate choice options
      const choiceOptions = [...availableColors].map((color) => ({
        type: EFFECT_CRYSTALLIZE_COLOR as typeof EFFECT_CRYSTALLIZE_COLOR,
        color: color as "red" | "blue" | "green" | "white",
      }));

      return {
        state,
        description: "Choose mana token to convert to crystal",
        requiresChoice: true,
        dynamicChoiceOptions: choiceOptions,
      };
    }

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
        return {
          state,
          description: "No eligible Action cards in hand to boost",
        };
      }

      return {
        state,
        description: "Choose an Action card to boost",
        requiresChoice: true,
        dynamicChoiceOptions: generateBoostChoiceOptions(eligibleCards, effect.bonus),
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

    case EFFECT_READY_UNIT:
      return handleReadyUnit(state, playerIndex, player, effect);

    case EFFECT_MANA_DRAW_POWERED:
      return handleManaDrawPowered(state, effect);

    case EFFECT_MANA_DRAW_PICK_DIE:
      return handleManaDrawPickDie(state, effect);

    case EFFECT_MANA_DRAW_SET_COLOR:
      return applyManaDrawSetColor(state, playerIndex, player, effect);

    case EFFECT_CRYSTALLIZE_COLOR: {
      // Consume one mana token of the specified color and gain a crystal of that color
      const tokenIndex = player.pureMana.findIndex((t) => t.color === effect.color);
      if (tokenIndex === -1) {
        return {
          state,
          description: `No ${effect.color} mana token to convert`,
        };
      }

      // Remove the mana token
      const newPureMana = [...player.pureMana];
      newPureMana.splice(tokenIndex, 1);

      // Gain the crystal
      const updatedPlayer: Player = {
        ...player,
        pureMana: newPureMana,
        crystals: {
          ...player.crystals,
          [effect.color]: player.crystals[effect.color] + 1,
        },
      };

      return {
        state: updatePlayer(state, playerIndex, updatedPlayer),
        description: `Converted ${effect.color} mana to ${effect.color} crystal`,
      };
    }

    case EFFECT_SELECT_COMBAT_ENEMY: {
      // Entry effect for selecting an enemy in combat
      if (!state.combat) {
        return {
          state,
          description: "Not in combat",
        };
      }

      // Get eligible enemies
      const eligibleEnemies = state.combat.enemies.filter(
        (e) => effect.includeDefeated || !e.isDefeated
      );

      if (eligibleEnemies.length === 0) {
        return {
          state,
          description: "No valid enemy targets",
        };
      }

      // Generate choice options - one per eligible enemy
      const choiceOptions: ResolveCombatEnemyTargetEffect[] = eligibleEnemies.map(
        (enemy) => ({
          type: EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
          enemyInstanceId: enemy.instanceId,
          enemyName: enemy.definition.name,
          template: effect.template,
        })
      );

      return {
        state,
        description: "Select an enemy to target",
        requiresChoice: true,
        dynamicChoiceOptions: choiceOptions,
      };
    }

    case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: {
      // Apply the template to the targeted enemy
      if (!state.combat) {
        return {
          state,
          description: "Not in combat",
        };
      }

      const enemyIndex = state.combat.enemies.findIndex(
        (e) => e.instanceId === effect.enemyInstanceId
      );
      if (enemyIndex === -1) {
        return {
          state,
          description: "Enemy not found",
        };
      }

      const enemy = state.combat.enemies[enemyIndex];
      if (!enemy) {
        return {
          state,
          description: "Enemy not found at index",
        };
      }

      let currentState = state;
      const descriptions: string[] = [];

      // Apply modifiers from template
      if (effect.template.modifiers) {
        for (const mod of effect.template.modifiers) {
          currentState = addModifier(currentState, {
            source: {
              type: SOURCE_CARD,
              cardId: (sourceCardId ?? "unknown") as CardId,
              playerId,
            },
            duration: mod.duration ?? DURATION_COMBAT,
            scope: { type: SCOPE_ONE_ENEMY, enemyId: effect.enemyInstanceId },
            effect: mod.modifier,
            createdAtRound: currentState.round,
            createdByPlayerId: playerId,
          });
          if (mod.description) {
            descriptions.push(mod.description);
          }
        }
      }

      // Handle defeat
      if (effect.template.defeat && currentState.combat) {
        // Mark enemy defeated, award fame
        const updatedEnemies = currentState.combat.enemies.map((e, i) =>
          i === enemyIndex ? { ...e, isDefeated: true } : e
        );

        const fameValue = enemy.definition.fame;
        const currentPlayer = currentState.players.find((p) => p.id === playerId);
        const newFame = currentPlayer ? currentPlayer.fame + fameValue : fameValue;

        currentState = {
          ...currentState,
          combat: {
            ...currentState.combat,
            enemies: updatedEnemies,
            fameGained: currentState.combat.fameGained + fameValue,
          },
          players: currentState.players.map((p) =>
            p.id === playerId ? { ...p, fame: newFame } : p
          ),
        };
        descriptions.push(`Defeated ${effect.enemyName} (+${fameValue} fame)`);
      }

      return {
        state: currentState,
        description: descriptions.join("; ") || `Targeted ${effect.enemyName}`,
      };
    }

    default:
      // Unknown effect type — log and continue
      return {
        state,
        description: "Unhandled effect type",
      };
  }
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

    case EFFECT_CRYSTALLIZE_COLOR:
      // Reverse crystallize: remove the crystal and restore the mana token
      return {
        ...player,
        crystals: {
          ...player.crystals,
          [effect.color]: Math.max(0, player.crystals[effect.color] - 1),
        },
        pureMana: [...player.pureMana, { color: effect.color, source: "card" as const }],
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

    case EFFECT_SELECT_COMBAT_ENEMY:
      // This just generates choice options, doesn't modify player state
      return player;

    case EFFECT_RESOLVE_COMBAT_ENEMY_TARGET:
      // Enemy targeting effects modify combat state and modifiers, not player state directly.
      // The modifier removal would need to happen at GameState level, not player level.
      // For now, these effects should be considered non-reversible in practice.
      return player;

    default:
      return player;
  }
}
