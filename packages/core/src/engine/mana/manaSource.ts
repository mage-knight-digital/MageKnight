/**
 * Mana source (dice pool) management
 *
 * The mana source contains dice that players can use to power their cards.
 * - Each die shows a random mana color
 * - Gold dice are depleted at night
 * - Black dice are depleted during the day
 * - At least half the dice must show basic colors
 */

import type { ManaSource, SourceDie, SourceDieId } from "../../types/mana.js";
import { sourceDieId } from "../../types/mana.js";
import type { RngState } from "../../utils/rng.js";
import type { TimeOfDay, ManaColor, BasicManaColor } from "@mage-knight/shared";
import { nextRandom } from "../../utils/rng.js";
import {
  ALL_MANA_COLORS,
  BASIC_MANA_COLORS,
  MANA_GOLD,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
} from "@mage-knight/shared";

/**
 * Roll a single die to get a random mana color
 */
function rollDie(rng: RngState): { color: ManaColor; rng: RngState } {
  const { value, rng: newRng } = nextRandom(rng);
  const index = Math.floor(value * ALL_MANA_COLORS.length);
  const color = ALL_MANA_COLORS[index];
  if (!color) {
    // Fallback - should never happen given the math
    const fallbackColor = ALL_MANA_COLORS[0];
    if (!fallbackColor) {
      throw new Error("ALL_MANA_COLORS is empty");
    }
    return { color: fallbackColor, rng: newRng };
  }
  return { color, rng: newRng };
}

/**
 * Check if a color is a basic mana color
 */
function isBasicColor(color: ManaColor): color is BasicManaColor {
  return (BASIC_MANA_COLORS as readonly ManaColor[]).includes(color);
}

/**
 * Check if at least half the dice show basic colors
 */
function hasEnoughBasicColors(dice: readonly SourceDie[]): boolean {
  const basicCount = dice.filter((d) => isBasicColor(d.color)).length;
  return basicCount >= Math.ceil(dice.length / 2);
}

/**
 * Check if a die is depleted based on time of day
 */
function isDieDepletedForTime(color: ManaColor, timeOfDay: TimeOfDay): boolean {
  // Black is depleted during day, gold is depleted at night
  if (color === MANA_BLACK && timeOfDay === TIME_OF_DAY_DAY) {
    return true;
  }
  if (color === MANA_GOLD && timeOfDay !== TIME_OF_DAY_DAY) {
    return true;
  }
  return false;
}

/**
 * Create initial mana source for a game
 *
 * The number of dice = playerCount + 2
 * Rolls all dice, then rerolls gold/black until at least half show basic colors.
 */
export function createManaSource(
  playerCount: number,
  timeOfDay: TimeOfDay,
  rng: RngState
): { source: ManaSource; rng: RngState } {
  const diceCount = playerCount + 2;
  let currentRng = rng;
  let dice: SourceDie[] = [];

  // Roll all dice
  for (let i = 0; i < diceCount; i++) {
    const { color, rng: newRng } = rollDie(currentRng);
    currentRng = newRng;
    dice.push({
      id: sourceDieId(`die_${i}`),
      color,
      isDepleted: false,
      takenByPlayerId: null,
    });
  }

  // Reroll gold/black until at least half are basic
  while (!hasEnoughBasicColors(dice)) {
    dice = dice.map((die) => {
      if (die.color === MANA_GOLD || die.color === MANA_BLACK) {
        const { color, rng: newRng } = rollDie(currentRng);
        currentRng = newRng;
        return { ...die, color };
      }
      return die;
    });
  }

  // Mark depleted dice based on time of day
  dice = dice.map((die) => ({
    ...die,
    isDepleted: isDieDepletedForTime(die.color, timeOfDay),
  }));

  return { source: { dice }, rng: currentRng };
}

/**
 * Reroll a single die and return it to source
 *
 * Called at end of turn when a die was used, or when an effect forces a reroll.
 */
export function rerollDie(
  source: ManaSource,
  dieId: SourceDieId,
  timeOfDay: TimeOfDay,
  rng: RngState
): { source: ManaSource; rng: RngState } {
  const { color, rng: newRng } = rollDie(rng);

  const dice = source.dice.map((die) => {
    if (die.id === dieId) {
      return {
        ...die,
        color,
        isDepleted: isDieDepletedForTime(color, timeOfDay),
        takenByPlayerId: null, // Clear taken status on reroll
      };
    }
    return die;
  });

  return { source: { dice }, rng: newRng };
}

/**
 * Get available (non-depleted) dice from source
 */
export function getAvailableDice(source: ManaSource): readonly SourceDie[] {
  return source.dice.filter((d) => !d.isDepleted);
}

/**
 * Update all dice's depleted status based on time of day
 *
 * Called when time of day changes (round transition).
 */
export function updateDiceForTimeOfDay(
  source: ManaSource,
  timeOfDay: TimeOfDay
): ManaSource {
  const dice = source.dice.map((die) => ({
    ...die,
    isDepleted: isDieDepletedForTime(die.color, timeOfDay),
  }));

  return { dice };
}
