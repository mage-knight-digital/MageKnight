/**
 * Polarize Mana Effect Resolution
 *
 * Handles Arythea's Polarization skill effect - converting mana to its opposite color.
 *
 * @module effects/polarizeEffects
 *
 * @remarks
 * - EFFECT_POLARIZE_MANA: Atomically removes source mana and adds converted token
 * - Source can be token, crystal, or die
 * - Conversion rules:
 *   - Basic colors: Red↔Blue, Green↔White
 *   - Day: Black → any basic color (cannot power spells)
 *   - Night: Gold → Black (can power spells)
 *
 * @example Resolution Flow
 * ```
 * Player activates Polarization skill
 *   └─► applyPolarizationEffect creates pendingChoice with POLARIZE_MANA options
 *       └─► Player selects conversion option
 *           └─► resolvePolarizeMana removes source, adds converted token
 * ```
 */

import type { GameState } from "../../state/GameState.js";
import type { Player, ManaToken } from "../../types/player.js";
import type { PolarizeManaEffect } from "../../types/cards.js";
import type { EffectResolutionResult } from "./types.js";
import type { BasicManaColor } from "@mage-knight/shared";
import { MANA_TOKEN_SOURCE_SKILL } from "@mage-knight/shared";
import { EFFECT_POLARIZE_MANA } from "../../types/effectTypes.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";

// ============================================================================
// POLARIZE MANA EFFECT RESOLUTION
// ============================================================================

/**
 * Resolve a polarize mana effect - remove source mana and add converted token.
 *
 * This handles the three source types:
 * - Token: Remove from pureMana by index, add converted token
 * - Crystal: Decrement crystal count, add converted token
 * - Die: Change die color in the source pool, add converted token
 *
 * @param state - Current game state
 * @param playerIndex - Index of the player in state.players array
 * @param player - The player object
 * @param effect - The polarize mana effect with source and target details
 * @returns Updated state with source removed and converted token added
 */
export function resolvePolarizeMana(
  state: GameState,
  playerIndex: number,
  player: Player,
  effect: PolarizeManaEffect
): EffectResolutionResult {
  let updatedPlayer = player;
  let updatedState = state;

  // Step 1: Remove the source mana based on source type
  switch (effect.sourceType) {
    case "token": {
      // Remove token from pureMana by index
      if (effect.tokenIndex === undefined) {
        return {
          state,
          description: "Token index not specified for polarization",
        };
      }
      const newPureMana = [...player.pureMana];
      if (effect.tokenIndex < 0 || effect.tokenIndex >= newPureMana.length) {
        return {
          state,
          description: `Invalid token index ${effect.tokenIndex} for polarization`,
        };
      }
      // Verify the token color matches
      const tokenToRemove = newPureMana[effect.tokenIndex];
      if (tokenToRemove?.color !== effect.sourceColor) {
        return {
          state,
          description: `Token at index ${effect.tokenIndex} is ${tokenToRemove?.color}, not ${effect.sourceColor}`,
        };
      }
      newPureMana.splice(effect.tokenIndex, 1);
      updatedPlayer = { ...updatedPlayer, pureMana: newPureMana };
      break;
    }

    case "crystal": {
      // Decrement crystal count (only basic colors have crystals)
      const crystalColor = effect.sourceColor as BasicManaColor;
      if (player.crystals[crystalColor] <= 0) {
        return {
          state,
          description: `No ${effect.sourceColor} crystal to polarize`,
        };
      }
      updatedPlayer = {
        ...updatedPlayer,
        crystals: {
          ...player.crystals,
          [crystalColor]: player.crystals[crystalColor] - 1,
        },
      };
      break;
    }

    case "die": {
      // Change die color in the source pool
      if (!effect.dieId) {
        return {
          state,
          description: "Die ID not specified for polarization",
        };
      }
      const dieIndex = state.source.dice.findIndex((d) => d.id === effect.dieId);
      if (dieIndex === -1) {
        return {
          state,
          description: `Die ${effect.dieId} not found in source`,
        };
      }
      const die = state.source.dice[dieIndex];
      if (!die) {
        return {
          state,
          description: `Die at index ${dieIndex} not found`,
        };
      }
      if (die.color !== effect.sourceColor) {
        return {
          state,
          description: `Die ${effect.dieId} is ${die.color}, not ${effect.sourceColor}`,
        };
      }
      // Update the die color and mark it as taken by the player
      const newDice = [...state.source.dice];
      newDice[dieIndex] = {
        id: die.id,
        color: effect.targetColor,
        isDepleted: die.isDepleted,
        takenByPlayerId: player.id,
      };
      updatedState = {
        ...state,
        source: { ...state.source, dice: newDice },
      };
      break;
    }
  }

  // Step 2: Add the converted mana token
  // Only set cannotPowerSpells if it's true (exact optional property types)
  const convertedToken: ManaToken = effect.cannotPowerSpells
    ? {
        color: effect.targetColor,
        source: MANA_TOKEN_SOURCE_SKILL,
        cannotPowerSpells: true,
      }
    : {
        color: effect.targetColor,
        source: MANA_TOKEN_SOURCE_SKILL,
      };

  updatedPlayer = {
    ...updatedPlayer,
    pureMana: [...updatedPlayer.pureMana, convertedToken],
  };

  // Step 3: Apply player update to state
  const players = [...updatedState.players];
  players[playerIndex] = updatedPlayer;
  updatedState = { ...updatedState, players };

  const sourceDesc =
    effect.sourceType === "die" ? `${effect.sourceColor} die` : `${effect.sourceColor} ${effect.sourceType}`;
  const restriction = effect.cannotPowerSpells ? " (cannot power spells)" : "";

  return {
    state: updatedState,
    description: `Polarized ${sourceDesc} to ${effect.targetColor}${restriction}`,
  };
}

// ============================================================================
// EFFECT REGISTRATION
// ============================================================================

/**
 * Register the polarize mana effect handler with the effect registry.
 * Called during effect system initialization.
 */
export function registerPolarizeEffects(): void {
  registerEffect(EFFECT_POLARIZE_MANA, (state, playerId, effect) => {
    const { playerIndex, player } = getPlayerContext(state, playerId);
    return resolvePolarizeMana(state, playerIndex, player, effect as PolarizeManaEffect);
  });
}
