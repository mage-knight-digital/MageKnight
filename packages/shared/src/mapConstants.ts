/**
 * Map-related constants (distinct domains even if values overlap).
 */

// === City Colors ===
// Faction/identity for cities on the map
export const CITY_COLOR_RED = "red" as const;
export const CITY_COLOR_BLUE = "blue" as const;
export const CITY_COLOR_GREEN = "green" as const;
export const CITY_COLOR_WHITE = "white" as const;

export type CityColor =
  | typeof CITY_COLOR_RED
  | typeof CITY_COLOR_BLUE
  | typeof CITY_COLOR_GREEN
  | typeof CITY_COLOR_WHITE;

// === Mine Colors ===
// Resource-adjacent; yields basic mana crystals
export const MINE_COLOR_RED = "red" as const;
export const MINE_COLOR_BLUE = "blue" as const;
export const MINE_COLOR_GREEN = "green" as const;
export const MINE_COLOR_WHITE = "white" as const;

export type MineColor =
  | typeof MINE_COLOR_RED
  | typeof MINE_COLOR_BLUE
  | typeof MINE_COLOR_GREEN
  | typeof MINE_COLOR_WHITE;

// === Discard Filter Types ===
// Used for card discard effects (e.g., "discard a wound", "discard any card")
export const DISCARD_FILTER_WOUND = "wound" as const;
export const DISCARD_FILTER_NON_WOUND = "non-wound" as const;
export const DISCARD_FILTER_ANY = "any" as const;

export type DiscardFilter =
  | typeof DISCARD_FILTER_WOUND
  | typeof DISCARD_FILTER_NON_WOUND
  | typeof DISCARD_FILTER_ANY;

// === Reveal Tile Types ===
// Used for tile/enemy reveal effects (e.g., Scouting, Intelligence skills)
export const REVEAL_TILE_TYPE_ENEMY = "enemy" as const;
export const REVEAL_TILE_TYPE_GARRISON = "garrison" as const;
export const REVEAL_TILE_TYPE_ALL = "all" as const;

export type RevealTileType =
  | typeof REVEAL_TILE_TYPE_ENEMY
  | typeof REVEAL_TILE_TYPE_GARRISON
  | typeof REVEAL_TILE_TYPE_ALL;
