/**
 * Mana availability computation
 *
 * Determines what mana sources are available to a player.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { ManaOptions, AvailableDie, BasicManaColor, ManaColor } from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  MANA_GOLD,
  MANA_SOURCE_ENDLESS,
} from "@mage-knight/shared";
import { isRuleActive, hasEndlessMana } from "../modifiers/index.js";
import { RULE_BLACK_AS_ANY_COLOR, RULE_EXTRA_SOURCE_DIE, RULE_SOURCE_BLOCKED } from "../../types/modifierConstants.js";
import { canUseGoldAsWild, isManaColorAllowed } from "../rules/mana.js";

/**
 * Get available mana options for a player.
 *
 * Returns:
 * - Available dice from the mana source (not taken, not depleted)
 * - Whether the player can convert crystals
 * - Which crystal colors are available
 */
export function getManaOptions(
  state: GameState,
  player: Player
): ManaOptions {
  const availableDice: AvailableDie[] = [];
  const seenDice = new Set<string>();
  const blackAsAnyColor = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);

  const addAvailableDie = (dieId: string, color: ManaColor) => {
    const colorAllowed =
      isManaColorAllowed(state, color) || (color === MANA_BLACK && blackAsAnyColor);
    if (!colorAllowed) {
      return;
    }
    const key = `${dieId}:${color}`;
    if (seenDice.has(key)) return;
    seenDice.add(key);
    availableDice.push({ dieId, color });
  };

  // Check Mana Steal stored die first (can be used in addition to source)
  // The stolen die doesn't count against the "one die from source per turn" limit
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && !player.tacticState.manaStealUsedThisTurn) {
    addAvailableDie(storedDie.dieId, storedDie.color);
  }

  // Check if player can use the mana source:
  // - If they haven't used it yet this turn, OR
  // - If they have used it once but have the "extra source die" rule active (Mana Draw)
  // - AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const hasExtraSourceDie = isRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
  const isSourceBlocked = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  const canUseSource = !isSourceBlocked && (!player.usedManaFromSource || hasExtraSourceDie);

  if (canUseSource) {
    for (const die of state.source.dice) {
      // Die must not be taken and not depleted
      if (die.takenByPlayerId === null && !die.isDepleted) {
        addAvailableDie(die.id, die.color);

        // Mana Pull basic: black dice can be used as any color this turn
        if (blackAsAnyColor && die.color === MANA_BLACK) {
          addAvailableDie(die.id, MANA_RED);
          addAvailableDie(die.id, MANA_BLUE);
          addAvailableDie(die.id, MANA_GREEN);
          addAvailableDie(die.id, MANA_WHITE);
          addAvailableDie(die.id, MANA_GOLD);
        }
      }
    }
  }

  // Check crystal conversion
  const convertibleColors: BasicManaColor[] = [];

  if (player.crystals.red > 0) {
    convertibleColors.push(MANA_RED);
  }
  if (player.crystals.blue > 0) {
    convertibleColors.push(MANA_BLUE);
  }
  if (player.crystals.green > 0) {
    convertibleColors.push(MANA_GREEN);
  }
  if (player.crystals.white > 0) {
    convertibleColors.push(MANA_WHITE);
  }

  return {
    availableDice,
    canConvertCrystal: convertibleColors.length > 0,
    convertibleColors,
  };
}

/**
 * Check if a player has access to a specific mana color.
 *
 * A player can access a mana color if:
 * 1. There's a die of that color available in the source (and player hasn't used source)
 * 2. The player has a crystal of that color to convert
 * 3. The player has a "pure" mana token of that color in their play area
 * 4. Gold mana can substitute for basic colors (day only - gold depleted at night)
 * 5. The player has a stolen Mana Steal die available
 *
 * NOTE: Black mana is NOT wild - it can only be used to power spells (match exact MANA_BLACK).
 * At night, black dice become available but they don't substitute for basic colors.
 */
export function canPayForMana(
  state: GameState,
  player: Player,
  requiredColor: ManaColor
): boolean {
  const blackAsAnyColor = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);
  if (!isManaColorAllowed(state, requiredColor) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
    return false;
  }

  // Check for endless mana supply first (from Ring artifacts)
  if (hasEndlessMana(state, player.id, requiredColor)) {
    return true;
  }

  // Check Mana Steal stored die (doesn't count against source usage)
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && !player.tacticState.manaStealUsedThisTurn) {
    if (storedDie.color === requiredColor) {
      return true;
    }
    if (storedDie.color === MANA_BLACK && blackAsAnyColor) {
      return true;
    }
  }

  // Check pure mana tokens in play area (from cards like Mana Draw)
  for (const token of player.pureMana) {
    if (token.color === requiredColor) {
      return true;
    }
    // Gold mana is wild (can be any basic color)
    if (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state)) {
      return true;
    }
    // Note: Black mana is NOT wild - it can only power spells (match exact color MANA_BLACK)
  }

  // Check crystals - crystals can be converted to their color
  if (isBasicMana(requiredColor)) {
    const crystalCount = getCrystalCount(player, requiredColor);
    if (crystalCount > 0) {
      return true;
    }
  }

  // Check mana source dice
  // Player can use source if they haven't used it yet, OR if they have the extra source die rule
  // AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const hasExtraSourceDie = isRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
  const isSourceBlocked = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  const canUseSource = !isSourceBlocked && (!player.usedManaFromSource || hasExtraSourceDie);

  if (canUseSource) {
    const blackAsAnyColor = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (die.color === requiredColor) {
          return true;
        }
        if (die.color === MANA_BLACK && blackAsAnyColor) {
          return true;
        }
        // Gold dice are wild (can substitute for basic colors)
        if (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state)) {
          return true;
        }
        // Mana Pull basic: black dice can be used as any color this turn
        if (blackAsAnyColor && die.color === MANA_BLACK) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if a mana color is a basic color (not gold/black)
 */
function isBasicMana(color: ManaColor): boolean {
  return (
    color === MANA_RED ||
    color === MANA_BLUE ||
    color === MANA_GREEN ||
    color === MANA_WHITE
  );
}

/**
 * Get the crystal count for a basic mana color
 */
function getCrystalCount(player: Player, color: ManaColor): number {
  switch (color) {
    case MANA_RED:
      return player.crystals.red;
    case MANA_BLUE:
      return player.crystals.blue;
    case MANA_GREEN:
      return player.crystals.green;
    case MANA_WHITE:
      return player.crystals.white;
    default:
      return 0;
  }
}

/**
 * Check if a player can pay for TWO mana colors (for spells).
 *
 * Spells require both black mana AND a color mana. This is more restrictive
 * than action cards which only need one. We need to verify the player has
 * TWO distinct mana sources available.
 *
 * This is a simplified check - it counts available mana sources and ensures
 * there are at least 2 that match the required colors.
 *
 * With endless mana: If a color has endless supply, it counts as infinite sources
 * for that color. However, the same endless source can only pay for one color
 * if both colors are the same and both have endless supply.
 */
export function canPayForTwoMana(
  state: GameState,
  player: Player,
  color1: ManaColor,
  color2: ManaColor,
  options?: { forSpellPowered?: boolean }
): boolean {
  const hasEndless1 = hasEndlessMana(state, player.id, color1);
  const forSpellPowered = options?.forSpellPowered ?? false;

  // Same-color requirement: need two sources unless endless supply is available
  if (color1 === color2) {
    if (hasEndless1) {
      return true;
    }
    const sourcesSame = countManaSourcesForColor(state, player, color1, {
      forSpellPowered,
    });
    return sourcesSame >= 2;
  }

  // Different colors: require two distinct sources (cannot reuse the same die)
  const sources1 = getAvailableManaSourcesForColor(state, player, color1, {
    forSpellPowered,
  });
  const sources2 = getAvailableManaSourcesForColor(state, player, color2, {
    forSpellPowered,
  });

  if (sources1.length === 0 || sources2.length === 0) {
    return false;
  }

  for (const source1 of sources1) {
    for (const source2 of sources2) {
      const isSameDie =
        source1.type === "die" &&
        source2.type === "die" &&
        source1.dieId === source2.dieId;
      if (!isSameDie) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Count how many distinct mana sources can provide a specific color.
 */
function countManaSourcesForColor(
  state: GameState,
  player: Player,
  requiredColor: ManaColor,
  options?: { forSpellPowered?: boolean }
): number {
  let count = 0;
  const forSpellPowered = options?.forSpellPowered ?? false;
  const blackAsAnyColor = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);
  if (!isManaColorAllowed(state, requiredColor) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
    return 0;
  }

  // Check Mana Steal stored die
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && !player.tacticState.manaStealUsedThisTurn) {
    if (storedDie.color === requiredColor) {
      count++;
    }
    if (storedDie.color === MANA_BLACK && requiredColor !== MANA_BLACK && blackAsAnyColor) {
      count++;
    }
  }

  // Check pure mana tokens
  for (const token of player.pureMana) {
    if (token.color === requiredColor) {
      if (forSpellPowered && token.cannotPowerSpells) {
        // Converted black mana cannot power the strong effect of spells.
        continue;
      }
      count++;
    } else if (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state)) {
      // Gold mana is wild for basic colors
      count++;
    }
    // Note: Black mana is NOT wild - only counts for exact MANA_BLACK match (handled above)
  }

  // Check crystals
  if (isBasicMana(requiredColor)) {
    count += getCrystalCount(player, requiredColor);
  }

  // Check source dice (only count if player can use source)
  // AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const hasExtraSourceDie = isRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
  const isSourceBlocked = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  const canUseSource = !isSourceBlocked && (!player.usedManaFromSource || hasExtraSourceDie);

  if (canUseSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        if (die.color === requiredColor) {
          count++;
        } else if (die.color === MANA_BLACK && requiredColor !== MANA_BLACK && blackAsAnyColor) {
          count++;
        } else if (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state)) {
          // Gold dice are wild for basic colors
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * Get all available mana sources that can provide a specific color.
 * Returns an array of ManaSourceInfo objects that could be used.
 * Used for auto-inferring mana source when there's only one option.
 */
export function getAvailableManaSourcesForColor(
  state: GameState,
  player: Player,
  requiredColor: ManaColor,
  options?: { forSpellPowered?: boolean }
): import("@mage-knight/shared").ManaSourceInfo[] {
  const sources: import("@mage-knight/shared").ManaSourceInfo[] = [];
  const forSpellPowered = options?.forSpellPowered ?? false;
  const blackAsAnyColor = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);
  if (!isManaColorAllowed(state, requiredColor) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
    return [];
  }

  // Check for endless mana supply first (from Ring artifacts)
  // This is the preferred source since it doesn't consume resources
  if (hasEndlessMana(state, player.id, requiredColor)) {
    sources.push({
      type: MANA_SOURCE_ENDLESS,
      color: requiredColor,
    });
  }

  // Check Mana Steal stored die
  const storedDie = player.tacticState.storedManaDie;
  if (storedDie && !player.tacticState.manaStealUsedThisTurn) {
    // Match exact color, or gold die for basic colors (gold is wild)
    // Note: Black dice are NOT wild - they only match exact MANA_BLACK
    if (storedDie.color === requiredColor ||
        (storedDie.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state))) {
      sources.push({
        type: "die" as const,
        dieId: storedDie.dieId,
        color: storedDie.color,
      });
    } else if (storedDie.color === MANA_BLACK && requiredColor !== MANA_BLACK && blackAsAnyColor) {
      sources.push({
        type: "die" as const,
        dieId: storedDie.dieId,
        color: requiredColor,
      });
    }
  }

  // Check pure mana tokens
  // Match exact color, or gold token for basic colors (gold is wild)
  // Note: Black tokens are NOT wild - they only match exact MANA_BLACK
  for (const token of player.pureMana) {
    if (forSpellPowered && token.cannotPowerSpells) {
      continue;
    }
    if (token.color === requiredColor ||
        (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state))) {
      sources.push({
        type: "token" as const,
        color: token.color,
      });
    }
  }

  // Check crystals
  if (isBasicMana(requiredColor)) {
    const crystalCount = getCrystalCount(player, requiredColor);
    if (crystalCount > 0) {
      sources.push({
        type: "crystal" as const,
        color: requiredColor as import("@mage-knight/shared").BasicManaColor,
      });
    }
  }

  // Check source dice
  // AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const hasExtraSourceDie = isRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
  const isSourceBlocked = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  const canUseSource = !isSourceBlocked && (!player.usedManaFromSource || hasExtraSourceDie);

  if (canUseSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId === null && !die.isDepleted) {
        const canUseBlackAsAny =
          blackAsAnyColor && die.color === MANA_BLACK && requiredColor !== MANA_BLACK;
        // Match exact color, or gold die for basic colors (gold is wild), or black as any color
        if (die.color === requiredColor ||
            (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state)) ||
            canUseBlackAsAny) {
          sources.push({
            type: "die" as const,
            dieId: die.id,
            color: canUseBlackAsAny ? requiredColor : die.color,
          });
        }
      }
    }
  }

  return sources;
}
