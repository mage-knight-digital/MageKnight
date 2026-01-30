/**
 * Hero types for Mage Knight
 *
 * HeroId is a string literal type representing the hero identifiers.
 * This is defined in shared (not core) so it can be imported by the client
 * for the setup screen without creating a core → client dependency.
 */

// Base game heroes
export const HERO_ARYTHEA = "arythea" as const;
export const HERO_TOVAK = "tovak" as const;
export const HERO_GOLDYX = "goldyx" as const;
export const HERO_NOROWAS = "norowas" as const;

// Lost Legion expansion heroes
export const HERO_WOLFHAWK = "wolfhawk" as const;
export const HERO_KRANG = "krang" as const;

// Shades of Tezla expansion hero
export const HERO_BRAEVALAR = "braevalar" as const;

/** String literal type for hero identifiers */
export type HeroId =
  | typeof HERO_ARYTHEA
  | typeof HERO_TOVAK
  | typeof HERO_GOLDYX
  | typeof HERO_NOROWAS
  | typeof HERO_WOLFHAWK
  | typeof HERO_KRANG
  | typeof HERO_BRAEVALAR;

/** Array of base game heroes (always available) */
export const BASE_HEROES: readonly HeroId[] = [
  HERO_ARYTHEA,
  HERO_TOVAK,
  HERO_GOLDYX,
  HERO_NOROWAS,
] as const;

/** Array of Lost Legion expansion heroes */
export const LOST_LEGION_HEROES: readonly HeroId[] = [
  HERO_WOLFHAWK,
] as const;

/** Array of Krang expansion heroes */
export const KRANG_HEROES: readonly HeroId[] = [
  HERO_KRANG,
] as const;

/** Array of Shades of Tezla expansion heroes */
export const SHADES_OF_TEZLA_HEROES: readonly HeroId[] = [
  HERO_BRAEVALAR,
] as const;

/** All heroes (base + all expansions) */
export const ALL_HEROES: readonly HeroId[] = [
  ...BASE_HEROES,
  ...LOST_LEGION_HEROES,
  ...KRANG_HEROES,
  ...SHADES_OF_TEZLA_HEROES,
] as const;

/** Display names for heroes (for UI) */
export const HERO_NAMES: Record<HeroId, string> = {
  [HERO_ARYTHEA]: "Arythea",
  [HERO_TOVAK]: "Tovak",
  [HERO_GOLDYX]: "Goldyx",
  [HERO_NOROWAS]: "Norowas",
  [HERO_WOLFHAWK]: "Wolfhawk",
  [HERO_KRANG]: "Krang",
  [HERO_BRAEVALAR]: "Braevalar",
};
