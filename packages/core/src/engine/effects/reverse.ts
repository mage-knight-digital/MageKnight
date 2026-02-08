/**
 * Effect Reversal for Undo
 *
 * Provides reverseEffect function to undo the player-level state changes
 * from a previously resolved effect. Used by the command undo system.
 *
 * Uses a map-based dispatch pattern for extensibility and maintainability.
 *
 * @module effects/reverse
 *
 * @remarks Reversal Overview
 * - Not all effects are reversible (see non-reversible list below)
 * - Reversible effects restore player state to pre-effect values
 * - Commands track whether they contain non-reversible effects
 * - Non-reversible effects set undo checkpoints instead
 *
 * @remarks Non-Reversible Effects
 * The following effects cannot be reliably reversed:
 * - EFFECT_CONDITIONAL: Condition may evaluate differently
 * - EFFECT_SCALING: Scaling count may have changed
 * - EFFECT_DRAW_CARDS: Reveals hidden information (deck contents)
 * - EFFECT_TAKE_WOUND: Wound may have been interacted with
 * - EFFECT_RESOLVE_COMBAT_ENEMY_TARGET: Modifies combat state
 *
 * @example Usage
 * ```typescript
 * // In command undo logic
 * const originalPlayer = state.players[playerIndex];
 * const restoredPlayer = reverseEffect(originalPlayer, effect);
 * // restoredPlayer has effect's changes undone
 * ```
 */

import type { Player } from "../../types/player.js";
import type { CardEffect } from "../../types/cards.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_COMPOUND,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_FAME,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_GAIN_MANA,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_PAY_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_TAKE_WOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_READY_ALL_UNITS,
  EFFECT_HEAL_ALL_UNITS,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
  EFFECT_WOUND_ACTIVATING_UNIT,
  EFFECT_APPLY_INTERACTION_BONUS,
  EFFECT_SACRIFICE,
  EFFECT_RESOLVE_SACRIFICE,
  EFFECT_CALL_TO_ARMS,
  EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
  EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
  EFFECT_GAIN_ATTACK_BOW_RESOLVED,
  EFFECT_HAND_LIMIT_BONUS,
} from "../../types/effectTypes.js";
import type {
  GainMoveEffect,
  GainInfluenceEffect,
  GainAttackEffect,
  GainBlockEffect,
  CompoundEffect,
  ChangeReputationEffect,
  GainFameEffect,
  GainCrystalEffect,
  GainManaEffect,
  CrystallizeColorEffect,
  PayManaEffect,
  TrackAttackDefeatFameEffect,
} from "../../types/effectTypes.js";
import type { GainAttackBowResolvedEffect, WoundActivatingUnitEffect, HandLimitBonusEffect } from "../../types/cards.js";
import { getLevelsCrossed, MANA_TOKEN_SOURCE_CARD } from "@mage-knight/shared";
import { MIN_REPUTATION, MAX_REPUTATION, elementToPropertyKey } from "./atomicEffects.js";
import { MAX_CRYSTALS_PER_COLOR } from "../helpers/crystalHelpers.js";
import { toAttackElement, toAttackType } from "../combat/attackFameTracking.js";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Handler function for reversing an effect.
 * Each handler receives the player and effect, returns the player with effect reversed.
 */
type ReverseHandler<T extends CardEffect = CardEffect> = (player: Player, effect: T) => Player;

/**
 * Effect type discriminator string
 */
type EffectType = CardEffect["type"];

// ============================================================================
// REVERSE HANDLERS
// ============================================================================

/**
 * Reverse handlers registry.
 * Maps effect types to their reversal functions.
 */
const reverseHandlers: Partial<Record<EffectType, ReverseHandler>> = {
  [EFFECT_GAIN_MOVE]: (player, effect) => {
    const e = effect as GainMoveEffect;
    return { ...player, movePoints: player.movePoints - e.amount };
  },

  [EFFECT_GAIN_INFLUENCE]: (player, effect) => {
    const e = effect as GainInfluenceEffect;
    return { ...player, influencePoints: player.influencePoints - e.amount };
  },

  [EFFECT_GAIN_ATTACK]: (player, effect) => {
    const e = effect as GainAttackEffect;
    const attack = { ...player.combatAccumulator.attack };
    if (e.combatType === COMBAT_TYPE_RANGED) {
      attack.ranged -= e.amount;
    } else if (e.combatType === COMBAT_TYPE_SIEGE) {
      attack.siege -= e.amount;
    } else {
      attack.normal -= e.amount;
    }
    return {
      ...player,
      combatAccumulator: { ...player.combatAccumulator, attack },
    };
  },

  [EFFECT_GAIN_ATTACK_BOW_RESOLVED]: (player, effect) => {
    const e = effect as GainAttackBowResolvedEffect;
    const attack = { ...player.combatAccumulator.attack };
    if (e.combatType === COMBAT_TYPE_RANGED) {
      attack.ranged -= e.amount;
    } else if (e.combatType === COMBAT_TYPE_SIEGE) {
      attack.siege -= e.amount;
    } else {
      attack.normal -= e.amount;
    }
    return {
      ...player,
      combatAccumulator: { ...player.combatAccumulator, attack },
    };
  },

  [EFFECT_GAIN_BLOCK]: (player, effect) => {
    const e = effect as GainBlockEffect;
    // Reverse block: always update both block total and blockElements
    // (matches applyGainBlock which updates both for all block types)
    const blockElements = { ...player.combatAccumulator.blockElements };
    const elementKey = elementToPropertyKey(e.element);
    blockElements[elementKey] = Math.max(0, blockElements[elementKey] - e.amount);

    return {
      ...player,
      combatAccumulator: {
        ...player.combatAccumulator,
        block: Math.max(0, player.combatAccumulator.block - e.amount),
        blockElements,
      },
    };
  },

  [EFFECT_CHANGE_REPUTATION]: (player, effect) => {
    const e = effect as ChangeReputationEffect;
    // Reverse reputation change (clamp to bounds)
    return {
      ...player,
      reputation: Math.max(
        MIN_REPUTATION,
        Math.min(MAX_REPUTATION, player.reputation - e.amount)
      ),
    };
  },

  [EFFECT_GAIN_FAME]: (player, effect) => {
    const e = effect as GainFameEffect;
    // Reverse fame gain and remove any pending level ups that would have resulted
    // Note: This is a simplified reversal - we subtract fame and recalculate pending level ups
    // based on the new (lower) fame value. This works correctly because level thresholds are fixed.
    return {
      ...player,
      fame: Math.max(0, player.fame - e.amount),
      // Remove the most recently added pending level ups (equal to the number we would have gained)
      pendingLevelUps: player.pendingLevelUps.slice(
        0,
        -getLevelsCrossed(player.fame - e.amount, player.fame).length
      ),
    };
  },

  [EFFECT_GAIN_CRYSTAL]: (player, effect) => {
    const e = effect as GainCrystalEffect;
    // If crystals are at max, the forward pass overflowed to a mana token.
    // Reverse by removing an overflow token instead of decrementing crystals.
    if (player.crystals[e.color] >= MAX_CRYSTALS_PER_COLOR) {
      const tokenIndex = player.pureMana.findIndex((t) => t.color === e.color);
      if (tokenIndex !== -1) {
        const newPureMana = [...player.pureMana];
        newPureMana.splice(tokenIndex, 1);
        return { ...player, pureMana: newPureMana };
      }
      // Token already spent — can't reverse perfectly, return unchanged
      return player;
    }
    // Normal case: decrement crystal
    return {
      ...player,
      crystals: {
        ...player.crystals,
        [e.color]: Math.max(0, player.crystals[e.color] - 1),
      },
    };
  },

  [EFFECT_GAIN_MANA]: (player, effect) => {
    const e = effect as GainManaEffect;
    // Reverse mana token gain by removing a matching token from pureMana
    const tokenIndex = player.pureMana.findIndex((t) => t.color === e.color);
    if (tokenIndex === -1) {
      // Token not found - can't reverse (might have been spent)
      return player;
    }
    const newPureMana = [...player.pureMana];
    newPureMana.splice(tokenIndex, 1);
    return { ...player, pureMana: newPureMana };
  },

  [EFFECT_PAY_MANA]: (player, effect) => {
    const e = effect as PayManaEffect;
    if (e.colors.length !== 1 || e.amount <= 0) {
      return player;
    }
    const color = e.colors[0];
    if (!color) {
      return player;
    }
    const restoredTokens = Array.from({ length: e.amount }, () => ({
      color,
      source: MANA_TOKEN_SOURCE_CARD,
    }));
    return {
      ...player,
      pureMana: [...player.pureMana, ...restoredTokens],
    };
  },

  [EFFECT_CRYSTALLIZE_COLOR]: (player, effect) => {
    const e = effect as CrystallizeColorEffect;
    // Reverse crystallize: remove the crystal and restore the mana token.
    // If at max crystals during forward pass, no crystal was gained (token was
    // just consumed), so we only restore the token without decrementing crystals.
    const crystalWasGained = player.crystals[e.color] > 0 &&
      player.crystals[e.color] <= MAX_CRYSTALS_PER_COLOR;
    return {
      ...player,
      crystals: crystalWasGained
        ? { ...player.crystals, [e.color]: player.crystals[e.color] - 1 }
        : player.crystals,
      pureMana: [
        ...player.pureMana,
        { color: e.color, source: MANA_TOKEN_SOURCE_CARD },
      ],
    };
  },

  [EFFECT_COMPOUND]: (player, effect) => {
    const e = effect as CompoundEffect;
    let result = player;
    for (const subEffect of e.effects) {
      result = reverseEffect(result, subEffect);
    }
    return result;
  },

  // Non-reversible effects - return player unchanged
  [EFFECT_CONDITIONAL]: (player) => {
    // Cannot reliably reverse conditional effects — the condition may have
    // changed since the effect was applied, so we don't know which branch
    // was actually executed. Commands containing conditional effects should
    // be marked as non-reversible (isReversible: false).
    return player;
  },

  [EFFECT_SCALING]: (player) => {
    // Cannot reliably reverse scaling effects — the scaling count may have
    // changed since the effect was applied (enemies defeated, wounds played).
    // Commands containing scaling effects should be marked as non-reversible.
    return player;
  },

  [EFFECT_DRAW_CARDS]: (player) => {
    // Drawing cards reveals hidden information (deck contents), so this
    // effect should be non-reversible. Commands containing draw effects
    // should create an undo checkpoint (CHECKPOINT_REASON_CARD_DRAWN).
    return player;
  },

  [EFFECT_TAKE_WOUND]: (player) => {
    // Taking wounds can't be reliably reversed - we'd need to remove the
    // wound from hand and return it to the wound pile, but the player
    // might have interacted with the wound in the meantime.
    // Commands containing take wound effects should be non-reversible.
    return player;
  },

  [EFFECT_SELECT_COMBAT_ENEMY]: (player) => {
    // This just generates choice options, doesn't modify player state
    return player;
  },

  [EFFECT_RESOLVE_COMBAT_ENEMY_TARGET]: (player) => {
    // Enemy targeting effects modify combat state and modifiers, not player state directly.
    // The modifier removal would need to happen at GameState level, not player level.
    // For now, these effects should be considered non-reversible in practice.
    return player;
  },

  [EFFECT_READY_ALL_UNITS]: (player) => {
    // Cannot reliably reverse — we don't track which units were originally spent.
    // Commands containing this effect should be non-reversible.
    return player;
  },

  [EFFECT_HEAL_ALL_UNITS]: (player) => {
    // Cannot reliably reverse — we don't track which units were originally wounded.
    // Commands containing this effect should be non-reversible.
    return player;
  },

  // Terrain cost reduction selection sets pending state — clear it on reverse
  [EFFECT_SELECT_HEX_FOR_COST_REDUCTION]: (player) => {
    return { ...player, pendingTerrainCostReduction: null };
  },
  [EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION]: (player) => {
    return { ...player, pendingTerrainCostReduction: null };
  },

  [EFFECT_WOUND_ACTIVATING_UNIT]: (player, effect) => {
    const e = effect as WoundActivatingUnitEffect;
    // Reverse self-wound: find the unit and set wounded back to false
    const unitIndex = player.units.findIndex(
      (u) => u.instanceId === e.unitInstanceId
    );
    if (unitIndex === -1) {
      return player;
    }
    const updatedUnits = [...player.units];
    const unit = updatedUnits[unitIndex]!;
    updatedUnits[unitIndex] = { ...unit, wounded: false };
    return { ...player, units: updatedUnits };
  },

  // Interaction bonus adds a modifier — modifier cleanup handled by snapshot restore.
  // No player-level state to reverse.
  [EFFECT_APPLY_INTERACTION_BONUS]: (player) => player,

  // Sacrifice just presents choices — no player state change
  [EFFECT_SACRIFICE]: (player) => player,

  // Resolve Sacrifice modifies crystals, pureMana, and combat accumulator.
  // Too complex to reverse reliably — should be non-reversible.
  [EFFECT_RESOLVE_SACRIFICE]: (player) => player,

  // Call to Arms effects just present choices — no direct player state change.
  // The actual state change is on the resolved sub-effect (GainAttack, GainBlock, etc.).
  [EFFECT_CALL_TO_ARMS]: (player) => player,
  [EFFECT_RESOLVE_CALL_TO_ARMS_UNIT]: (player) => player,
  [EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY]: (player) => player,

  // Wings of Night just presents choices — no direct player state change
  [EFFECT_WINGS_OF_NIGHT]: (player) => player,

  // Resolve Wings of Night target modifies combat state (modifiers) and deducts move points.
  // Move point deduction is player-level but modifier cleanup is GameState-level.
  // Commands containing this should be non-reversible.
  [EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET]: (player) => player,

  // Crystal Mastery basic presents choices — no direct player state change.
  // Actual state change is via GainCrystal (already handled above).
  [EFFECT_CRYSTAL_MASTERY_BASIC]: (player) => player,

  // Crystal Mastery powered sets a flag — reverse by clearing it.
  [EFFECT_CRYSTAL_MASTERY_POWERED]: (player) => ({
    ...player,
    crystalMasteryPoweredActive: false,
  }),

  [EFFECT_HAND_LIMIT_BONUS]: (player, effect) => {
    const e = effect as HandLimitBonusEffect;
    return {
      ...player,
      meditationHandLimitBonus: Math.max(0, player.meditationHandLimitBonus - e.bonus),
    };
  },

  [EFFECT_TRACK_ATTACK_DEFEAT_FAME]: (player, effect) => {
    const e = effect as TrackAttackDefeatFameEffect;
    const attackType = toAttackType(e.combatType);
    const element = toAttackElement(e.element);
    const sourceCardId = e.sourceCardId ?? null;

    let removeIndex = -1;
    for (let i = player.pendingAttackDefeatFame.length - 1; i >= 0; i--) {
      const tracker = player.pendingAttackDefeatFame[i];
      if (!tracker) continue;
      if (tracker.attackType !== attackType || tracker.element !== element) {
        continue;
      }
      if (tracker.amount !== e.amount || tracker.fame !== e.fame) {
        continue;
      }
      if (sourceCardId && tracker.sourceCardId !== sourceCardId) {
        continue;
      }
      removeIndex = i;
      break;
    }

    if (removeIndex === -1) {
      return player;
    }

    const newTrackers = player.pendingAttackDefeatFame.filter((_, i) => i !== removeIndex);
    return { ...player, pendingAttackDefeatFame: newTrackers };
  },
};

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Reverse an effect's changes to player state (for undo).
 *
 * Given a player state and an effect that was previously applied,
 * returns a new player state with the effect's changes undone.
 *
 * @param player - Current player state (after effect was applied)
 * @param effect - The effect to reverse
 * @returns Player state with effect reversed (or unchanged for non-reversible effects)
 *
 * @remarks Important Limitations
 * - Only reverses player-level state (not game-level like combat/modifiers)
 * - Non-reversible effects return the player unchanged
 * - Commands containing non-reversible effects should be marked accordingly
 *
 * @example Reversing GainMove
 * ```typescript
 * const effect = { type: EFFECT_GAIN_MOVE, amount: 3 };
 * // After effect: player.movePoints = 5
 * const reversed = reverseEffect(player, effect);
 * // reversed.movePoints = 2
 * ```
 */
export function reverseEffect(player: Player, effect: CardEffect): Player {
  const handler = reverseHandlers[effect.type];
  if (handler) {
    return handler(player, effect);
  }
  // Unknown effect types - return player unchanged
  return player;
}
