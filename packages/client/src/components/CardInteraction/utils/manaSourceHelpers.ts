/**
 * Mana Source Helpers
 *
 * Utilities for computing available mana sources from game state.
 */

import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  type ManaColor,
  type ManaSourceInfo,
  type ClientGameState,
  type ClientPlayer,
} from "@mage-knight/shared";

/**
 * Get all available mana sources that can pay for a specific color.
 * Returns an array of options the player can choose from.
 */
export function getAvailableManaSources(
  state: ClientGameState,
  player: ClientPlayer,
  requiredColor: ManaColor
): ManaSourceInfo[] {
  const sources: ManaSourceInfo[] = [];

  // 1. Check crystals (player's inventory)
  if (player.crystals[requiredColor as keyof typeof player.crystals] > 0) {
    sources.push({ type: MANA_SOURCE_CRYSTAL, color: requiredColor });
  }

  // 2. Check pure mana tokens (already in play area)
  // Track which token colors we've already added (tokens of same color are fungible)
  const addedTokenColors = new Set<string>();

  for (const token of player.pureMana) {
    // Exact color match
    if (token.color === requiredColor && !addedTokenColors.has(token.color)) {
      sources.push({ type: MANA_SOURCE_TOKEN, color: token.color });
      addedTokenColors.add(token.color);
    }
    // Gold tokens can substitute for basic colors (red, blue, green, white)
    // Note: Black mana is NOT wild - it's only used specifically for powering spells
    const isBasic =
      requiredColor === MANA_RED ||
      requiredColor === MANA_BLUE ||
      requiredColor === MANA_GREEN ||
      requiredColor === MANA_WHITE;
    if (token.color === MANA_GOLD && isBasic && !addedTokenColors.has(MANA_GOLD)) {
      sources.push({ type: MANA_SOURCE_TOKEN, color: MANA_GOLD });
      addedTokenColors.add(MANA_GOLD);
    }
  }

  // 3. Check available dice from the source
  const manaOptions = state.validActions.mana;
  if (manaOptions) {
    // Matching color dice
    const matchingDice = manaOptions.availableDice.filter(
      (d) => d.color === requiredColor
    );
    for (const die of matchingDice) {
      sources.push({
        type: MANA_SOURCE_DIE,
        color: requiredColor,
        dieId: die.dieId,
      });
    }

    // Gold dice (wildcard for basic colors ONLY - not for black or gold)
    // Basic colors are: red, blue, green, white
    const isBasicColor =
      requiredColor === MANA_RED ||
      requiredColor === MANA_BLUE ||
      requiredColor === MANA_GREEN ||
      requiredColor === MANA_WHITE;
    if (isBasicColor) {
      const goldDice = manaOptions.availableDice.filter((d) => d.color === "gold");
      for (const die of goldDice) {
        sources.push({
          type: MANA_SOURCE_DIE,
          color: "gold",
          dieId: die.dieId,
        });
      }
    }
  }

  return sources;
}
