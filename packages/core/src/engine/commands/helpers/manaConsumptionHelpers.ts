/**
 * Mana consumption helpers - shared by card plays and unit activations
 *
 * Handles consuming and restoring mana from various sources
 * (dice, crystals, tokens) when playing cards or activating abilities.
 */

import type { ManaSourceInfo, BasicManaColor } from "@mage-knight/shared";
import {
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  MANA_SOURCE_ENDLESS,
} from "@mage-knight/shared";
import type { Player, Crystals } from "../../../types/player.js";
import type { SourceDieId, ManaSource } from "../../../types/mana.js";

/**
 * Result of consuming mana for an ability or card play
 */
export interface ManaConsumptionResult {
  readonly player: Player;
  readonly source: ManaSource;
}

/**
 * Consume mana from the specified source to pay for a card or ability.
 * Updates player state and source die pool as needed.
 */
export function consumeMana(
  player: Player,
  source: ManaSource,
  manaSourceInfo: ManaSourceInfo,
  playerId: string
): ManaConsumptionResult {
  const { type: sourceType, color } = manaSourceInfo;
  let updatedPlayer = player;
  let updatedSource = source;

  // Track mana usage for conditional effects
  updatedPlayer = {
    ...updatedPlayer,
    manaUsedThisTurn: [...updatedPlayer.manaUsedThisTurn, color],
  };

  switch (sourceType) {
    case MANA_SOURCE_DIE: {
      const dieId = manaSourceInfo.dieId as SourceDieId;
      if (!dieId) {
        throw new Error("Die ID required when using mana from source");
      }

      // Check if this is the Mana Steal stored die
      const storedDie = updatedPlayer.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === dieId) {
        // Using the stolen Mana Steal die
        updatedPlayer = {
          ...updatedPlayer,
          tacticState: {
            ...updatedPlayer.tacticState,
            manaStealUsedThisTurn: true,
          },
        };
      } else {
        // Using a normal source die
        const alreadyUsed = updatedPlayer.usedDieIds.includes(dieId);
        updatedPlayer = {
          ...updatedPlayer,
          usedManaFromSource: true,
          usedDieIds: alreadyUsed
            ? updatedPlayer.usedDieIds
            : [...updatedPlayer.usedDieIds, dieId],
        };
        // Mark the die as taken in the source
        const updatedDice = source.dice.map((die) =>
          die.id === dieId ? { ...die, takenByPlayerId: playerId } : die
        );
        updatedSource = { dice: updatedDice };
      }
      break;
    }

    case MANA_SOURCE_CRYSTAL: {
      const basicColor = color as BasicManaColor;
      const newCrystals: Crystals = {
        ...updatedPlayer.crystals,
        [basicColor]: updatedPlayer.crystals[basicColor] - 1,
      };
      updatedPlayer = { ...updatedPlayer, crystals: newCrystals };
      break;
    }

    case MANA_SOURCE_TOKEN: {
      const tokenIndex = updatedPlayer.pureMana.findIndex(
        (t) => t.color === color
      );
      if (tokenIndex !== -1) {
        const newPureMana = [...updatedPlayer.pureMana];
        newPureMana.splice(tokenIndex, 1);
        updatedPlayer = { ...updatedPlayer, pureMana: newPureMana };
      }
      break;
    }

    case MANA_SOURCE_ENDLESS: {
      // Endless mana supply from Ring artifacts - no actual consumption needed.
      // Mana usage is already tracked above in manaUsedThisTurn.
      break;
    }
  }

  return { player: updatedPlayer, source: updatedSource };
}

/**
 * Consume multiple mana sources (e.g., for spells requiring black + color).
 */
export function consumeMultipleMana(
  player: Player,
  source: ManaSource,
  manaSources: readonly ManaSourceInfo[],
  playerId: string
): ManaConsumptionResult {
  let updatedPlayer = player;
  let updatedSource = source;

  for (const manaSourceInfo of manaSources) {
    const result = consumeMana(updatedPlayer, updatedSource, manaSourceInfo, playerId);
    updatedPlayer = result.player;
    updatedSource = result.source;
  }

  return { player: updatedPlayer, source: updatedSource };
}

/**
 * Restore mana that was consumed (for undo).
 * Reverses the effects of consumeMana.
 */
export function restoreMana(
  player: Player,
  source: ManaSource,
  manaSourceInfo: ManaSourceInfo
): ManaConsumptionResult {
  const { type: sourceType, color } = manaSourceInfo;
  let updatedPlayer = player;
  let updatedSource = source;

  // Remove the mana color from manaUsedThisTurn
  const colorIndex = updatedPlayer.manaUsedThisTurn.lastIndexOf(color);
  if (colorIndex !== -1) {
    const newManaUsed = [...updatedPlayer.manaUsedThisTurn];
    newManaUsed.splice(colorIndex, 1);
    updatedPlayer = { ...updatedPlayer, manaUsedThisTurn: newManaUsed };
  }

  switch (sourceType) {
    case MANA_SOURCE_DIE: {
      const dieId = manaSourceInfo.dieId as SourceDieId;

      // Check if this was the Mana Steal stored die
      const storedDie = updatedPlayer.tacticState.storedManaDie;
      if (storedDie && storedDie.dieId === dieId) {
        // Restore Mana Steal die usage
        updatedPlayer = {
          ...updatedPlayer,
          tacticState: {
            ...updatedPlayer.tacticState,
            manaStealUsedThisTurn: false,
          },
        };
      } else {
        // Restore normal source die
        // Remove from usedDieIds
        const newUsedDieIds = updatedPlayer.usedDieIds.filter(
          (id) => id !== dieId
        );
        updatedPlayer = {
          ...updatedPlayer,
          usedManaFromSource: newUsedDieIds.length > 0,
          usedDieIds: newUsedDieIds,
        };
        // Unmark the die as taken
        const updatedDice = source.dice.map((die) =>
          die.id === dieId ? { ...die, takenByPlayerId: null } : die
        );
        updatedSource = { dice: updatedDice };
      }
      break;
    }

    case MANA_SOURCE_CRYSTAL: {
      const basicColor = color as BasicManaColor;
      const newCrystals: Crystals = {
        ...updatedPlayer.crystals,
        [basicColor]: updatedPlayer.crystals[basicColor] + 1,
      };
      updatedPlayer = { ...updatedPlayer, crystals: newCrystals };
      break;
    }

    case MANA_SOURCE_TOKEN: {
      // Restore the mana token
      const restoredToken = {
        color,
        source: "card" as const, // Simplified - actual source unknown
      };
      updatedPlayer = {
        ...updatedPlayer,
        pureMana: [...updatedPlayer.pureMana, restoredToken],
      };
      break;
    }

    case MANA_SOURCE_ENDLESS: {
      // Endless mana supply - nothing to restore, it's infinite.
      // Mana usage tracking is already restored above.
      break;
    }
  }

  return { player: updatedPlayer, source: updatedSource };
}
