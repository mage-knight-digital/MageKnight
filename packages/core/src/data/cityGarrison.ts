/**
 * City garrison composition by city color and level.
 *
 * Each entry maps a city level to the enemy token colors that make up
 * the garrison. Enemies are drawn from the corresponding color piles
 * when the city tile is revealed.
 *
 * Pattern: every 3 levels adds one more defender, shifting from weaker
 * (gray) toward stronger (white) enemies as level increases.
 */

import type { EnemyColor, CityColor } from "@mage-knight/shared";
import {
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_VIOLET,
  ENEMY_COLOR_WHITE,
  CITY_COLOR_BLUE,
  CITY_COLOR_GREEN,
  CITY_COLOR_RED,
  CITY_COLOR_WHITE,
} from "@mage-knight/shared";

type CityGarrisonTable = Record<
  CityColor,
  Record<number, readonly EnemyColor[]>
>;

export const CITY_GARRISON: CityGarrisonTable = {
  [CITY_COLOR_BLUE]: {
    1: [ENEMY_COLOR_GRAY, ENEMY_COLOR_VIOLET],
    2: [ENEMY_COLOR_VIOLET, ENEMY_COLOR_VIOLET],
    3: [ENEMY_COLOR_VIOLET, ENEMY_COLOR_WHITE],
    4: [ENEMY_COLOR_GRAY, ENEMY_COLOR_VIOLET, ENEMY_COLOR_WHITE],
    5: [ENEMY_COLOR_VIOLET, ENEMY_COLOR_VIOLET, ENEMY_COLOR_WHITE],
    6: [ENEMY_COLOR_VIOLET, ENEMY_COLOR_WHITE, ENEMY_COLOR_WHITE],
    7: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
    ],
    8: [
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    9: [
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    10: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    11: [
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
  },
  [CITY_COLOR_GREEN]: {
    1: [ENEMY_COLOR_GRAY, ENEMY_COLOR_BROWN],
    2: [ENEMY_COLOR_BROWN, ENEMY_COLOR_BROWN],
    3: [ENEMY_COLOR_GRAY, ENEMY_COLOR_GRAY, ENEMY_COLOR_BROWN],
    4: [ENEMY_COLOR_GRAY, ENEMY_COLOR_BROWN, ENEMY_COLOR_WHITE],
    5: [ENEMY_COLOR_BROWN, ENEMY_COLOR_BROWN, ENEMY_COLOR_WHITE],
    6: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
    ],
    7: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
    ],
    8: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    9: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
    ],
    10: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    11: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
  },
  [CITY_COLOR_RED]: {
    1: [ENEMY_COLOR_WHITE],
    2: [ENEMY_COLOR_BROWN, ENEMY_COLOR_VIOLET],
    3: [ENEMY_COLOR_BROWN, ENEMY_COLOR_WHITE],
    4: [ENEMY_COLOR_BROWN, ENEMY_COLOR_VIOLET, ENEMY_COLOR_VIOLET],
    5: [ENEMY_COLOR_BROWN, ENEMY_COLOR_VIOLET, ENEMY_COLOR_WHITE],
    6: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
    ],
    7: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
    ],
    8: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    9: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
    ],
    10: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    11: [
      ENEMY_COLOR_BROWN,
      ENEMY_COLOR_VIOLET,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
  },
  [CITY_COLOR_WHITE]: {
    1: [ENEMY_COLOR_WHITE],
    2: [ENEMY_COLOR_GRAY, ENEMY_COLOR_WHITE],
    3: [ENEMY_COLOR_WHITE, ENEMY_COLOR_WHITE],
    4: [ENEMY_COLOR_GRAY, ENEMY_COLOR_GRAY, ENEMY_COLOR_WHITE],
    5: [ENEMY_COLOR_GRAY, ENEMY_COLOR_WHITE, ENEMY_COLOR_WHITE],
    6: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
    ],
    7: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    8: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    9: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    10: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
    11: [
      ENEMY_COLOR_GRAY,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
      ENEMY_COLOR_WHITE,
    ],
  },
} satisfies CityGarrisonTable;

/**
 * Get the garrison composition for a city by color and level.
 * Returns the list of enemy colors to draw from their respective piles.
 */
export function getCityGarrison(
  cityColor: CityColor,
  level: number
): readonly EnemyColor[] {
  const colorTable = CITY_GARRISON[cityColor];
  if (!colorTable) {
    throw new Error(`Unknown city color: ${cityColor}`);
  }
  const garrison = colorTable[level];
  if (!garrison) {
    throw new Error(
      `Unknown garrison level ${level} for ${cityColor} city (valid: ${Object.keys(colorTable).join(", ")})`
    );
  }
  return garrison;
}
