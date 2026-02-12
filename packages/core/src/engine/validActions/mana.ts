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
import { isRuleActive, countRuleActive, hasEndlessMana } from "../modifiers/index.js";
import { RULE_BLACK_AS_ANY_COLOR, RULE_GOLD_AS_ANY_COLOR, RULE_EXTRA_SOURCE_DIE, RULE_SOURCE_BLOCKED, RULE_ALLOW_BLACK_AT_DAY } from "../../types/modifierConstants.js";
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
  const goldAsAnyColor = isRuleActive(state, player.id, RULE_GOLD_AS_ANY_COLOR);

  const addAvailableDie = (dieId: string, color: ManaColor) => {
    const colorAllowed =
      isManaColorAllowed(state, color, player.id) || (color === MANA_BLACK && blackAsAnyColor);
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
  // Base limit: 1 die. Each RULE_EXTRA_SOURCE_DIE modifier adds 1 more.
  // AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const isSourceBlocked = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  let canUseSource: boolean;
  if (isSourceBlocked) {
    canUseSource = false;
  } else if (!player.usedManaFromSource) {
    canUseSource = true;
  } else {
    const extraSourceDiceCount = countRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
    const maxDiceUsage = 1 + extraSourceDiceCount;
    canUseSource = Math.max(player.usedDieIds.length, 1) < maxDiceUsage;
  }

  // Amulet of Darkness: black dice available from Source during day
  const allowBlackAtDay = isRuleActive(state, player.id, RULE_ALLOW_BLACK_AT_DAY);

  if (canUseSource) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId !== null) continue;

      // Override depletion for black dice during day when Amulet of Darkness is active
      const effectivelyAvailable = !die.isDepleted ||
        (die.color === MANA_BLACK && die.isDepleted && allowBlackAtDay);

      if (effectivelyAvailable) {
        addAvailableDie(die.id, die.color);

        // Mana Pull basic: black dice can be used as any color this turn
        if (blackAsAnyColor && die.color === MANA_BLACK) {
          addAvailableDie(die.id, MANA_RED);
          addAvailableDie(die.id, MANA_BLUE);
          addAvailableDie(die.id, MANA_GREEN);
          addAvailableDie(die.id, MANA_WHITE);
          addAvailableDie(die.id, MANA_GOLD);
        }

        // Mana Storm powered: gold dice can be used as any basic color
        if (goldAsAnyColor && die.color === MANA_GOLD) {
          addAvailableDie(die.id, MANA_RED);
          addAvailableDie(die.id, MANA_BLUE);
          addAvailableDie(die.id, MANA_GREEN);
          addAvailableDie(die.id, MANA_WHITE);
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
  if (!isManaColorAllowed(state, requiredColor, player.id) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
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
    if (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id)) {
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
  // Base limit: 1 die. Each RULE_EXTRA_SOURCE_DIE modifier adds 1 more.
  // AND source is not blocked (e.g., by "Who Needs Magic?" skill for +3 bonus)
  const isSourceBlocked2 = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  let canUseSource2: boolean;
  if (isSourceBlocked2) {
    canUseSource2 = false;
  } else if (!player.usedManaFromSource) {
    canUseSource2 = true;
  } else {
    const extraDiceCount = countRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
    const maxDice = 1 + extraDiceCount;
    canUseSource2 = Math.max(player.usedDieIds.length, 1) < maxDice;
  }

  if (canUseSource2) {
    const blackAsAnyColor2 = isRuleActive(state, player.id, RULE_BLACK_AS_ANY_COLOR);
    const goldAsAnyColor2 = isRuleActive(state, player.id, RULE_GOLD_AS_ANY_COLOR);
    const allowBlackAtDay2 = isRuleActive(state, player.id, RULE_ALLOW_BLACK_AT_DAY);
    for (const die of state.source.dice) {
      if (die.takenByPlayerId !== null) continue;
      const effectivelyAvailable2 = !die.isDepleted ||
        (die.color === MANA_BLACK && die.isDepleted && allowBlackAtDay2);
      if (effectivelyAvailable2) {
        if (die.color === requiredColor) {
          return true;
        }
        if (die.color === MANA_BLACK && blackAsAnyColor2) {
          return true;
        }
        // Gold dice are wild (can substitute for basic colors) during the day
        if (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id)) {
          return true;
        }
        // Mana Storm powered: gold dice can be used as any basic color
        if (die.color === MANA_GOLD && isBasicMana(requiredColor) && goldAsAnyColor2) {
          return true;
        }
      }
    }
  }

  return false;
}

/** Basic mana colors (red, blue, green, white) for recruitment token. */
const BASIC_MANA_COLORS: ManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];

/**
 * Returns true if the player can pay for at least one basic mana color.
 * Used to decide if Magic Familiars (restrictedFromFreeRecruit) can be shown as recruitable.
 * Shared with validators so advertised valid actions match server validation.
 */
export function canPayForAnyBasicMana(
  state: GameState,
  player: Player
): boolean {
  for (const color of BASIC_MANA_COLORS) {
    if (canPayForMana(state, player, color)) {
      return true;
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
  if (!isManaColorAllowed(state, requiredColor, player.id) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
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
    } else if (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id)) {
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
  const isSourceBlocked3 = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  let canUseSource3: boolean;
  if (isSourceBlocked3) {
    canUseSource3 = false;
  } else if (!player.usedManaFromSource) {
    canUseSource3 = true;
  } else {
    const extraDiceCount3 = countRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
    const maxDice3 = 1 + extraDiceCount3;
    canUseSource3 = Math.max(player.usedDieIds.length, 1) < maxDice3;
  }
  const goldAsAnyColor3 = isRuleActive(state, player.id, RULE_GOLD_AS_ANY_COLOR);
  const allowBlackAtDay3 = isRuleActive(state, player.id, RULE_ALLOW_BLACK_AT_DAY);

  if (canUseSource3) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId !== null) continue;
      const effectivelyAvailable3 = !die.isDepleted ||
        (die.color === MANA_BLACK && die.isDepleted && allowBlackAtDay3);
      if (effectivelyAvailable3) {
        if (die.color === requiredColor) {
          count++;
        } else if (die.color === MANA_BLACK && requiredColor !== MANA_BLACK && blackAsAnyColor) {
          count++;
        } else if (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id)) {
          // Gold dice are wild for basic colors
          count++;
        } else if (die.color === MANA_GOLD && isBasicMana(requiredColor) && goldAsAnyColor3) {
          // Mana Storm powered: gold dice can be used as any basic color
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
  if (!isManaColorAllowed(state, requiredColor, player.id) && !(requiredColor === MANA_BLACK && blackAsAnyColor)) {
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
        (storedDie.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id))) {
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
        (token.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id))) {
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
  const isSourceBlocked4 = isRuleActive(state, player.id, RULE_SOURCE_BLOCKED);
  let canUseSource4: boolean;
  if (isSourceBlocked4) {
    canUseSource4 = false;
  } else if (!player.usedManaFromSource) {
    canUseSource4 = true;
  } else {
    const extraDiceCount4 = countRuleActive(state, player.id, RULE_EXTRA_SOURCE_DIE);
    const maxDice4 = 1 + extraDiceCount4;
    canUseSource4 = Math.max(player.usedDieIds.length, 1) < maxDice4;
  }
  const goldAsAnyColor4 = isRuleActive(state, player.id, RULE_GOLD_AS_ANY_COLOR);
  const allowBlackAtDay4 = isRuleActive(state, player.id, RULE_ALLOW_BLACK_AT_DAY);

  if (canUseSource4) {
    for (const die of state.source.dice) {
      if (die.takenByPlayerId !== null) continue;
      const effectivelyAvailable4 = !die.isDepleted ||
        (die.color === MANA_BLACK && die.isDepleted && allowBlackAtDay4);
      if (effectivelyAvailable4) {
        const canUseBlackAsAny =
          blackAsAnyColor && die.color === MANA_BLACK && requiredColor !== MANA_BLACK;
        const canUseGoldAsAny =
          goldAsAnyColor4 && die.color === MANA_GOLD && isBasicMana(requiredColor);
        // Match exact color, or gold die for basic colors (gold is wild), or black as any color,
        // or gold as any basic color (Mana Storm)
        if (die.color === requiredColor ||
            (die.color === MANA_GOLD && isBasicMana(requiredColor) && canUseGoldAsWild(state, player.id)) ||
            canUseBlackAsAny ||
            canUseGoldAsAny) {
          const useAsColor = canUseBlackAsAny || canUseGoldAsAny ? requiredColor : die.color;
          sources.push({
            type: "die" as const,
            dieId: die.id,
            color: useAsColor,
          });
        }
      }
    }
  }

  return sources;
}
