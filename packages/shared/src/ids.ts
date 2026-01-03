/**
 * Branded ID types shared between client and server
 *
 * These are used in actions and events that flow between client and server.
 */

// Card IDs (action cards, artifact cards, spell cards, unit cards, wound cards)
export type CardId = string & { readonly __brand: "CardId" };

// Skill IDs
export type SkillId = string & { readonly __brand: "SkillId" };

// === Mana Color Constants ===

// Basic mana colors (can be crystals)
export const MANA_RED = "red" as const;
export const MANA_BLUE = "blue" as const;
export const MANA_GREEN = "green" as const;
export const MANA_WHITE = "white" as const;

// Special mana colors (not basic - gold/black)
export const MANA_GOLD = "gold" as const;
export const MANA_BLACK = "black" as const;

// Type derived from constants
export type BasicManaColor =
  | typeof MANA_RED
  | typeof MANA_BLUE
  | typeof MANA_GREEN
  | typeof MANA_WHITE;

export type SpecialManaColor = typeof MANA_GOLD | typeof MANA_BLACK;

export type ManaColor = BasicManaColor | SpecialManaColor;

// Back-compat aliases (prefer MANA_* constants)
export const BASIC_MANA_RED = MANA_RED;
export const BASIC_MANA_BLUE = MANA_BLUE;
export const BASIC_MANA_GREEN = MANA_GREEN;
export const BASIC_MANA_WHITE = MANA_WHITE;

// Array of all mana colors for dice rolling
export const ALL_MANA_COLORS: readonly ManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
];

// Array of basic mana colors
export const BASIC_MANA_COLORS: readonly BasicManaColor[] = [
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
];
