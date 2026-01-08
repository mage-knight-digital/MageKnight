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

// Red advanced actions
export const CARD_BLOOD_RAGE = cardId("blood_rage");
export const CARD_INTIMIDATE = cardId("intimidate");
export const CARD_BLOOD_RITUAL = cardId("blood_ritual");
export const CARD_INTO_THE_HEAT = cardId("into_the_heat");
export const CARD_DECOMPOSE = cardId("decompose");
export const CARD_MAXIMAL_EFFECT = cardId("maximal_effect");
export const CARD_COUNTERATTACK = cardId("counterattack");
export const CARD_RITUAL_ATTACK = cardId("ritual_attack");
export const CARD_BLOOD_OF_ANCIENTS = cardId("blood_of_ancients");
export const CARD_EXPLOSIVE_BOLT = cardId("explosive_bolt");

// Blue advanced actions
export const CARD_ICE_SHIELD = cardId("ice_shield");
export const CARD_FROST_BRIDGE = cardId("frost_bridge");
export const CARD_PURE_MAGIC = cardId("pure_magic");
export const CARD_STEADY_TEMPO = cardId("steady_tempo");
export const CARD_CRYSTAL_MASTERY = cardId("crystal_mastery");
export const CARD_MAGIC_TALENT = cardId("magic_talent");
export const CARD_SHIELD_BASH = cardId("shield_bash");
export const CARD_TEMPORAL_PORTAL = cardId("temporal_portal");
export const CARD_SPELL_FORGE = cardId("spell_forge");

// White advanced actions
export const CARD_AGILITY = cardId("agility");
export const CARD_SONG_OF_WIND = cardId("song_of_wind");
export const CARD_HEROIC_TALE = cardId("heroic_tale");
export const CARD_DIPLOMACY = cardId("diplomacy");
export const CARD_MANA_STORM = cardId("mana_storm");
export const CARD_LEARNING = cardId("learning");
export const CARD_CHIVALRY = cardId("chivalry");
export const CARD_PEACEFUL_MOMENT = cardId("peaceful_moment");
export const CARD_DODGE_AND_WEAVE = cardId("dodge_and_weave");

// Green advanced actions
export const CARD_REFRESHING_WALK = cardId("refreshing_walk");
export const CARD_PATH_FINDING = cardId("path_finding");
export const CARD_REGENERATION = cardId("regeneration");
export const CARD_IN_NEED = cardId("in_need");
export const CARD_AMBUSH = cardId("ambush");
export const CARD_TRAINING = cardId("training");
export const CARD_STOUT_RESOLVE = cardId("stout_resolve");
export const CARD_FORCE_OF_NATURE = cardId("force_of_nature");
export const CARD_MOUNTAIN_LORE = cardId("mountain_lore");
export const CARD_POWER_OF_CRYSTALS = cardId("power_of_crystals");

// Dual-color advanced actions
export const CARD_RUSH_OF_ADRENALINE = cardId("rush_of_adrenaline"); // green+red
export const CARD_CHILLING_STARE = cardId("chilling_stare"); // blue+white

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
  // Bolt cards
  | typeof CARD_FIRE_BOLT
  | typeof CARD_ICE_BOLT
  | typeof CARD_SWIFT_BOLT
  | typeof CARD_CRUSHING_BOLT
  // Red advanced actions
  | typeof CARD_BLOOD_RAGE
  | typeof CARD_INTIMIDATE
  | typeof CARD_BLOOD_RITUAL
  | typeof CARD_INTO_THE_HEAT
  | typeof CARD_DECOMPOSE
  | typeof CARD_MAXIMAL_EFFECT
  | typeof CARD_COUNTERATTACK
  | typeof CARD_RITUAL_ATTACK
  | typeof CARD_BLOOD_OF_ANCIENTS
  | typeof CARD_EXPLOSIVE_BOLT
  // Blue advanced actions
  | typeof CARD_ICE_SHIELD
  | typeof CARD_FROST_BRIDGE
  | typeof CARD_PURE_MAGIC
  | typeof CARD_STEADY_TEMPO
  | typeof CARD_CRYSTAL_MASTERY
  | typeof CARD_MAGIC_TALENT
  | typeof CARD_SHIELD_BASH
  | typeof CARD_TEMPORAL_PORTAL
  | typeof CARD_SPELL_FORGE
  // White advanced actions
  | typeof CARD_AGILITY
  | typeof CARD_SONG_OF_WIND
  | typeof CARD_HEROIC_TALE
  | typeof CARD_DIPLOMACY
  | typeof CARD_MANA_STORM
  | typeof CARD_LEARNING
  | typeof CARD_CHIVALRY
  | typeof CARD_PEACEFUL_MOMENT
  | typeof CARD_DODGE_AND_WEAVE
  // Green advanced actions
  | typeof CARD_REFRESHING_WALK
  | typeof CARD_PATH_FINDING
  | typeof CARD_REGENERATION
  | typeof CARD_IN_NEED
  | typeof CARD_AMBUSH
  | typeof CARD_TRAINING
  | typeof CARD_STOUT_RESOLVE
  | typeof CARD_FORCE_OF_NATURE
  | typeof CARD_MOUNTAIN_LORE
  | typeof CARD_POWER_OF_CRYSTALS
  // Dual-color advanced actions
  | typeof CARD_RUSH_OF_ADRENALINE
  | typeof CARD_CHILLING_STARE;
