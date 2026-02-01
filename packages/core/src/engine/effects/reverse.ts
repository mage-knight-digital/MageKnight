/**
 * Effect Reversal for Undo
 *
 * Provides reverseEffect function to undo the player-level state changes
 * from a previously resolved effect. Used by the command undo system.
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
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_DRAW_CARDS,
  EFFECT_TAKE_WOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "../../types/effectTypes.js";
import { getLevelsCrossed } from "@mage-knight/shared";
import { MIN_REPUTATION, MAX_REPUTATION, elementToPropertyKey } from "./atomicEffects.js";

// ============================================================================
// REVERSE EFFECT
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

    case EFFECT_GAIN_BLOCK: {
      // Reverse block: always update both block total and blockElements
      // (matches applyGainBlock which updates both for all block types)
      const blockElements = { ...player.combatAccumulator.blockElements };
      const elementKey = elementToPropertyKey(effect.element);
      blockElements[elementKey] = Math.max(0, blockElements[elementKey] - effect.amount);

      return {
        ...player,
        combatAccumulator: {
          ...player.combatAccumulator,
          block: Math.max(0, player.combatAccumulator.block - effect.amount),
          blockElements,
        },
      };
    }

    case EFFECT_CHANGE_REPUTATION:
      // Reverse reputation change (clamp to bounds)
      return {
        ...player,
        reputation: Math.max(
          MIN_REPUTATION,
          Math.min(MAX_REPUTATION, player.reputation - effect.amount)
        ),
      };

    case EFFECT_GAIN_FAME:
      // Reverse fame gain and remove any pending level ups that would have resulted
      // Note: This is a simplified reversal - we subtract fame and recalculate pending level ups
      // based on the new (lower) fame value. This works correctly because level thresholds are fixed.
      return {
        ...player,
        fame: Math.max(0, player.fame - effect.amount),
        // Remove the most recently added pending level ups (equal to the number we would have gained)
        pendingLevelUps: player.pendingLevelUps.slice(0, -getLevelsCrossed(player.fame - effect.amount, player.fame).length),
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

    case EFFECT_TAKE_WOUND:
      // Taking wounds can't be reliably reversed - we'd need to remove the
      // wound from hand and return it to the wound pile, but the player
      // might have interacted with the wound in the meantime.
      // Commands containing take wound effects should be non-reversible.
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
