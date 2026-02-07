/**
 * Card ID constants for Mage Knight
 *
 * Each constant is a branded CardId compatible value.
 */

// Import the cardId helper for local use
import { cardId } from "./cardIds/helpers.js";

// Re-export advanced action card IDs from modular structure
export * from "./cardIds/advancedActions/index.js";

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
export const CARD_AXE_THROW = cardId("axe_throw");
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
export const CARD_KRANG_BATTLE_RAGE = cardId("krang_battle_rage");

// Braevalar (Shades of Tezla expansion)
export const CARD_BRAEVALAR_DRUIDIC_PATHS = cardId("braevalar_druidic_paths");
export const CARD_BRAEVALAR_ONE_WITH_THE_LAND = cardId("braevalar_one_with_the_land");

// === Wound Card ===
export const CARD_WOUND = cardId("wound");

// === Artifact Card IDs ===

// Banners
export const CARD_BANNER_OF_GLORY = cardId("banner_of_glory");
export const CARD_BANNER_OF_FEAR = cardId("banner_of_fear");
export const CARD_BANNER_OF_PROTECTION = cardId("banner_of_protection");
export const CARD_BANNER_OF_COURAGE = cardId("banner_of_courage");
export const CARD_BANNER_OF_COMMAND = cardId("banner_of_command");
export const CARD_BANNER_OF_FORTITUDE = cardId("banner_of_fortitude");

// Rings
export const CARD_RUBY_RING = cardId("ruby_ring");
export const CARD_SAPPHIRE_RING = cardId("sapphire_ring");
export const CARD_DIAMOND_RING = cardId("diamond_ring");
export const CARD_EMERALD_RING = cardId("emerald_ring");

// Weapons
export const CARD_SWORD_OF_JUSTICE = cardId("sword_of_justice");
export const CARD_HORN_OF_WRATH = cardId("horn_of_wrath");
export const CARD_BOW_OF_STARSDAWN = cardId("bow_of_starsdawn");
export const CARD_SOUL_HARVESTER = cardId("soul_harvester");
export const CARD_SHIELD_OF_THE_FALLEN_KINGS = cardId("shield_of_the_fallen_kings");

// Amulets
export const CARD_AMULET_OF_THE_SUN = cardId("amulet_of_the_sun");
export const CARD_AMULET_OF_DARKNESS = cardId("amulet_of_darkness");

// Other Artifacts
export const CARD_ENDLESS_BAG_OF_GOLD = cardId("endless_bag_of_gold");
export const CARD_ENDLESS_GEM_POUCH = cardId("endless_gem_pouch");
export const CARD_GOLDEN_GRAIL = cardId("golden_grail");
export const CARD_BOOK_OF_WISDOM = cardId("book_of_wisdom");
export const CARD_DRUIDIC_STAFF = cardId("druidic_staff");
export const CARD_CIRCLET_OF_PROFICIENCY = cardId("circlet_of_proficiency");
export const CARD_TOME_OF_ALL_SPELLS = cardId("tome_of_all_spells");
export const CARD_MYSTERIOUS_BOX = cardId("mysterious_box");

// === Spell Card IDs ===
// Red spells
export const CARD_FIREBALL = cardId("fireball"); // #09 - Fire Ranged Attack 5 / Siege Fire Attack 8
export const CARD_FLAME_WALL = cardId("flame_wall"); // #10 - Fire Attack 5 or Fire Block 7
export const CARD_TREMOR = cardId("tremor"); // #11 - Target/All Armor reduction
export const CARD_MANA_MELTDOWN = cardId("mana_meltdown"); // #109 - Random crystal loss / Color wound + gain crystals
export const CARD_DEMOLISH = cardId("demolish"); // #12 - Ignore fortification + Armor -1 / Destroy enemy + Armor -1
export const CARD_BURNING_SHIELD = cardId("burning_shield"); // #08 - Fire Block 4 + conditional Fire Attack 4 / Fire Block 4 + destroy blocked enemy
export const CARD_OFFERING = cardId("offering"); // #46 - Gain red crystal + discard for crystals / Sacrifice crystal pairs for attacks

// Blue spells
export const CARD_SNOWSTORM = cardId("snowstorm"); // #15 - Ice Ranged Attack 5 / Siege Ice Attack 8
export const CARD_CHILL = cardId("chill"); // #13 - Target doesn't attack / defeat
export const CARD_MIST_FORM = cardId("mist_form"); // #14 - Move with all terrains cost 2 / Unit resistances + wound immunity

// Green spells
export const CARD_RESTORATION = cardId("restoration"); // #05 - Heal 3 (5 in forest)
export const CARD_WHIRLWIND = cardId("whirlwind"); // #07 - Target doesn't attack / defeat
export const CARD_ENERGY_FLOW = cardId("energy_flow"); // #12 - Ready unit + spend opponent units
export const CARD_UNDERGROUND_TRAVEL = cardId("underground_travel"); // #04 - Move 3 no swamp/lake / Assault ignore fortification

// White spells
export const CARD_EXPOSE = cardId("expose"); // #19 - Lose fortification/resistances
export const CARD_CURE = cardId("cure"); // #17 - Heal 2 + draw/ready / Armor reduction to 1

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
  | typeof CARD_AXE_THROW
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
  | typeof CARD_KRANG_BATTLE_RAGE
  | typeof CARD_BRAEVALAR_DRUIDIC_PATHS
  | typeof CARD_BRAEVALAR_ONE_WITH_THE_LAND;

export type BasicActionCardId =
  | SharedBasicActionCardId
  | HeroSpecificCardId
  | typeof CARD_WOUND;

export type SpellCardId =
  // Red spells
  | typeof CARD_FIREBALL
  | typeof CARD_FLAME_WALL
  | typeof CARD_TREMOR
  | typeof CARD_MANA_MELTDOWN
  | typeof CARD_DEMOLISH
  | typeof CARD_BURNING_SHIELD
  | typeof CARD_OFFERING
  // Blue spells
  | typeof CARD_SNOWSTORM
  | typeof CARD_CHILL
  | typeof CARD_MIST_FORM
  // Green spells
  | typeof CARD_RESTORATION
  | typeof CARD_WHIRLWIND
  | typeof CARD_ENERGY_FLOW
  | typeof CARD_UNDERGROUND_TRAVEL
  // White spells
  | typeof CARD_EXPOSE
  | typeof CARD_CURE;

export type ArtifactCardId =
  // Banners
  | typeof CARD_BANNER_OF_GLORY
  | typeof CARD_BANNER_OF_FEAR
  | typeof CARD_BANNER_OF_PROTECTION
  | typeof CARD_BANNER_OF_COURAGE
  | typeof CARD_BANNER_OF_COMMAND
  | typeof CARD_BANNER_OF_FORTITUDE
  // Rings
  | typeof CARD_RUBY_RING
  | typeof CARD_SAPPHIRE_RING
  | typeof CARD_DIAMOND_RING
  | typeof CARD_EMERALD_RING
  // Weapons
  | typeof CARD_SWORD_OF_JUSTICE
  | typeof CARD_HORN_OF_WRATH
  | typeof CARD_BOW_OF_STARSDAWN
  | typeof CARD_SOUL_HARVESTER
  | typeof CARD_SHIELD_OF_THE_FALLEN_KINGS
  // Amulets
  | typeof CARD_AMULET_OF_THE_SUN
  | typeof CARD_AMULET_OF_DARKNESS
  // Other Artifacts
  | typeof CARD_ENDLESS_BAG_OF_GOLD
  | typeof CARD_ENDLESS_GEM_POUCH
  | typeof CARD_GOLDEN_GRAIL
  | typeof CARD_BOOK_OF_WISDOM
  | typeof CARD_DRUIDIC_STAFF
  | typeof CARD_CIRCLET_OF_PROFICIENCY
  | typeof CARD_TOME_OF_ALL_SPELLS
  | typeof CARD_MYSTERIOUS_BOX;

// === Card ID Arrays ===

export const ALL_SHARED_BASIC_ACTION_IDS = [
  CARD_RAGE,
  CARD_DETERMINATION,
  CARD_SWIFTNESS,
  CARD_MARCH,
  CARD_STAMINA,
  CARD_TRANQUILITY,
  CARD_PROMISE,
  CARD_THREATEN,
  CARD_CRYSTALLIZE,
  CARD_MANA_DRAW,
  CARD_AXE_THROW,
  CARD_CONCENTRATION,
  CARD_IMPROVISATION,
] as const;

export const ALL_HERO_SPECIFIC_IDS = [
  CARD_ARYTHEA_BATTLE_VERSATILITY,
  CARD_ARYTHEA_MANA_PULL,
  CARD_GOLDYX_CRYSTAL_JOY,
  CARD_GOLDYX_WILL_FOCUS,
  CARD_NOROWAS_NOBLE_MANNERS,
  CARD_NOROWAS_REJUVENATE,
  CARD_TOVAK_COLD_TOUGHNESS,
  CARD_TOVAK_INSTINCT,
  CARD_WOLFHAWK_SWIFT_REFLEXES,
  CARD_WOLFHAWK_TIRELESSNESS,
  CARD_KRANG_SAVAGE_HARVESTING,
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_KRANG_BATTLE_RAGE,
  CARD_BRAEVALAR_DRUIDIC_PATHS,
  CARD_BRAEVALAR_ONE_WITH_THE_LAND,
] as const;

export const ALL_SPELL_IDS = [
  CARD_FIREBALL,
  CARD_FLAME_WALL,
  CARD_TREMOR,
  CARD_MANA_MELTDOWN,
  CARD_DEMOLISH,
  CARD_BURNING_SHIELD,
  CARD_SNOWSTORM,
  CARD_CHILL,
  CARD_MIST_FORM,
  CARD_RESTORATION,
  CARD_WHIRLWIND,
  CARD_ENERGY_FLOW,
  CARD_UNDERGROUND_TRAVEL,
  CARD_EXPOSE,
  CARD_CURE,
] as const;

export const ALL_ARTIFACT_IDS = [
  CARD_BANNER_OF_GLORY,
  CARD_BANNER_OF_FEAR,
  CARD_BANNER_OF_PROTECTION,
  CARD_BANNER_OF_COURAGE,
  CARD_BANNER_OF_COMMAND,
  CARD_BANNER_OF_FORTITUDE,
  CARD_RUBY_RING,
  CARD_SAPPHIRE_RING,
  CARD_DIAMOND_RING,
  CARD_EMERALD_RING,
  CARD_SWORD_OF_JUSTICE,
  CARD_HORN_OF_WRATH,
  CARD_BOW_OF_STARSDAWN,
  CARD_SOUL_HARVESTER,
  CARD_SHIELD_OF_THE_FALLEN_KINGS,
  CARD_AMULET_OF_THE_SUN,
  CARD_AMULET_OF_DARKNESS,
  CARD_ENDLESS_BAG_OF_GOLD,
  CARD_ENDLESS_GEM_POUCH,
  CARD_GOLDEN_GRAIL,
  CARD_BOOK_OF_WISDOM,
  CARD_DRUIDIC_STAFF,
  CARD_CIRCLET_OF_PROFICIENCY,
  CARD_TOME_OF_ALL_SPELLS,
  CARD_MYSTERIOUS_BOX,
] as const;
