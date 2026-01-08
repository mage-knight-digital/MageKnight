/**
 * Card ID constants for Mage Knight
 *
 * Each constant is a branded CardId compatible value.
 */

import type { CardId } from "./ids.js";

// === Helper to create CardId constants ===
// This ensures type safety while allowing the value to be used as a CardId
function cardId<T extends string>(id: T): T & CardId {
  return id as T & CardId;
}

// === Shared Basic Action Card IDs (14 cards in every starting deck) ===

export const CARD_RAGE = cardId("rage");
export const CARD_DETERMINATION = cardId("determination");
export const CARD_SWIFTNESS = cardId("swiftness");
export const CARD_MARCH = cardId("march");
export const CARD_STAMINA = cardId("stamina");
export const CARD_TRANQUILITY = cardId("tranquility");
export const CARD_PROMISE = cardId("promise");
export const CARD_THREATEN = cardId("threaten");
export const CARD_CRYSTALLIZE = cardId("crystallize");
export const CARD_MANA_DRAW = cardId("mana_draw");
export const CARD_CONCENTRATION = cardId("concentration");
export const CARD_IMPROVISATION = cardId("improvisation");

// === Hero-Specific Basic Actions (2 per hero) ===

// Arythea
export const CARD_ARYTHEA_BATTLE_VERSATILITY = cardId("arythea_battle_versatility");
export const CARD_ARYTHEA_MANA_PULL = cardId("arythea_mana_pull");

// Goldyx
export const CARD_GOLDYX_CRYSTAL_JOY = cardId("goldyx_crystal_joy");
export const CARD_GOLDYX_WILL_FOCUS = cardId("goldyx_will_focus");

// Norowas
export const CARD_NOROWAS_NOBLE_MANNERS = cardId("norowas_noble_manners");
export const CARD_NOROWAS_REJUVENATE = cardId("norowas_rejuvenate");

// Tovak
export const CARD_TOVAK_COLD_TOUGHNESS = cardId("tovak_cold_toughness");
export const CARD_TOVAK_INSTINCT = cardId("tovak_instinct");

// Wolfhawk (Lost Legion expansion)
export const CARD_WOLFHAWK_SWIFT_REFLEXES = cardId("wolfhawk_swift_reflexes");
export const CARD_WOLFHAWK_TIRELESSNESS = cardId("wolfhawk_tirelessness");

// Krang (Lost Legion expansion)
export const CARD_KRANG_SAVAGE_HARVESTING = cardId("krang_savage_harvesting");
export const CARD_KRANG_RUTHLESS_COERCION = cardId("krang_ruthless_coercion");

// Braevalar (Shades of Tezla expansion)
export const CARD_BRAEVALAR_DRUIDIC_PATHS = cardId("braevalar_druidic_paths");
export const CARD_BRAEVALAR_ONE_WITH_THE_LAND = cardId("braevalar_one_with_the_land");

// === Wound Card ===
export const CARD_WOUND = cardId("wound");

// === Advanced Action Card IDs ===
// Bolt cards (gain crystal basic / ranged attack powered)
export const CARD_FIRE_BOLT = cardId("fire_bolt");
export const CARD_ICE_BOLT = cardId("ice_bolt");
export const CARD_SWIFT_BOLT = cardId("swift_bolt");
export const CARD_CRUSHING_BOLT = cardId("crushing_bolt");

// === Card ID Type Unions ===

export type SharedBasicActionCardId =
  | typeof CARD_RAGE
  | typeof CARD_DETERMINATION
  | typeof CARD_SWIFTNESS
  | typeof CARD_MARCH
  | typeof CARD_STAMINA
  | typeof CARD_TRANQUILITY
  | typeof CARD_PROMISE
  | typeof CARD_THREATEN
  | typeof CARD_CRYSTALLIZE
  | typeof CARD_MANA_DRAW
  | typeof CARD_CONCENTRATION
  | typeof CARD_IMPROVISATION;

export type HeroSpecificCardId =
  | typeof CARD_ARYTHEA_BATTLE_VERSATILITY
  | typeof CARD_ARYTHEA_MANA_PULL
  | typeof CARD_GOLDYX_CRYSTAL_JOY
  | typeof CARD_GOLDYX_WILL_FOCUS
  | typeof CARD_NOROWAS_NOBLE_MANNERS
  | typeof CARD_NOROWAS_REJUVENATE
  | typeof CARD_TOVAK_COLD_TOUGHNESS
  | typeof CARD_TOVAK_INSTINCT
  | typeof CARD_WOLFHAWK_SWIFT_REFLEXES
  | typeof CARD_WOLFHAWK_TIRELESSNESS
  | typeof CARD_KRANG_SAVAGE_HARVESTING
  | typeof CARD_KRANG_RUTHLESS_COERCION
  | typeof CARD_BRAEVALAR_DRUIDIC_PATHS
  | typeof CARD_BRAEVALAR_ONE_WITH_THE_LAND;

export type BasicActionCardId =
  | SharedBasicActionCardId
  | HeroSpecificCardId
  | typeof CARD_WOUND;

export type AdvancedActionCardId =
  | typeof CARD_FIRE_BOLT
  | typeof CARD_ICE_BOLT
  | typeof CARD_SWIFT_BOLT
  | typeof CARD_CRUSHING_BOLT;
