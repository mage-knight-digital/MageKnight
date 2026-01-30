/**
 * Debug Panel Data - Constants and data definitions for debug controls
 */

import type { EnemyId, CardId, BasicManaColor, ManaColor, UnitId } from "@mage-knight/shared";
import type { SoundEvent } from "../../utils/audioManager";
import type { TrackCategory, LayerType } from "../../utils/ambientMusicManager";

// Enemy options grouped by color
export const ENEMIES: { label: string; enemies: { id: EnemyId; name: string }[] }[] = [
  {
    label: "Green (Orcs)",
    enemies: [
      { id: "diggers" as EnemyId, name: "Diggers" },
      { id: "prowlers" as EnemyId, name: "Prowlers" },
      { id: "cursed_hags" as EnemyId, name: "Cursed Hags" },
      { id: "wolf_riders" as EnemyId, name: "Wolf Riders" },
      { id: "ironclads" as EnemyId, name: "Ironclads" },
      { id: "orc_summoners" as EnemyId, name: "Orc Summoners" },
    ],
  },
  {
    label: "Gray (Keep)",
    enemies: [
      { id: "crossbowmen" as EnemyId, name: "Crossbowmen" },
      { id: "guardsmen" as EnemyId, name: "Guardsmen" },
      { id: "swordsmen" as EnemyId, name: "Swordsmen" },
      { id: "golems" as EnemyId, name: "Golems" },
    ],
  },
  {
    label: "Brown (Dungeon)",
    enemies: [
      { id: "minotaur" as EnemyId, name: "Minotaur" },
      { id: "gargoyle" as EnemyId, name: "Gargoyle" },
      { id: "medusa" as EnemyId, name: "Medusa" },
      { id: "crypt_worm" as EnemyId, name: "Crypt Worm" },
      { id: "werewolf" as EnemyId, name: "Werewolf" },
      { id: "shadow" as EnemyId, name: "Shadow" },
    ],
  },
  {
    label: "Violet (Mage Tower)",
    enemies: [
      { id: "monks" as EnemyId, name: "Monks" },
      { id: "illusionists" as EnemyId, name: "Illusionists" },
      { id: "ice_mages" as EnemyId, name: "Ice Mages" },
      { id: "fire_mages" as EnemyId, name: "Fire Mages" },
      { id: "sorcerers" as EnemyId, name: "Sorcerers" },
    ],
  },
  {
    label: "Red (Draconum)",
    enemies: [
      { id: "fire_dragon" as EnemyId, name: "Fire Dragon" },
      { id: "ice_dragon" as EnemyId, name: "Ice Dragon" },
      { id: "swamp_dragon" as EnemyId, name: "Swamp Dragon" },
      { id: "high_dragon" as EnemyId, name: "High Dragon" },
    ],
  },
  {
    label: "White (City)",
    enemies: [
      { id: "thugs" as EnemyId, name: "Thugs" },
      { id: "shocktroops" as EnemyId, name: "Shocktroops" },
      { id: "ice_golems" as EnemyId, name: "Ice Golems" },
      { id: "freezers" as EnemyId, name: "Freezers" },
      { id: "altem_guardsmen" as EnemyId, name: "Altem Guardsmen" },
      { id: "altem_mages" as EnemyId, name: "Altem Mages" },
    ],
  },
];

// All available cards - flat list for search
export const ALL_CARDS: { id: CardId; name: string; category: string }[] = [
  // Basic Actions
  { id: "rage" as CardId, name: "Rage", category: "Basic" },
  { id: "determination" as CardId, name: "Determination", category: "Basic" },
  { id: "swiftness" as CardId, name: "Swiftness", category: "Basic" },
  { id: "march" as CardId, name: "March", category: "Basic" },
  { id: "stamina" as CardId, name: "Stamina", category: "Basic" },
  { id: "tranquility" as CardId, name: "Tranquility", category: "Basic" },
  { id: "promise" as CardId, name: "Promise", category: "Basic" },
  { id: "threaten" as CardId, name: "Threaten", category: "Basic" },
  { id: "crystallize" as CardId, name: "Crystallize", category: "Basic" },
  { id: "mana_draw" as CardId, name: "Mana Draw", category: "Basic" },
  { id: "concentration" as CardId, name: "Concentration", category: "Basic" },
  { id: "improvisation" as CardId, name: "Improvisation", category: "Basic" },
  { id: "wound" as CardId, name: "Wound", category: "Basic" },
  // Spells (Red)
  { id: "fireball" as CardId, name: "Fireball", category: "Spell Red" },
  { id: "flame_wall" as CardId, name: "Flame Wall", category: "Spell Red" },
  { id: "tremor" as CardId, name: "Tremor", category: "Spell Red" },
  // Spells (Blue)
  { id: "snowstorm" as CardId, name: "Snowstorm", category: "Spell Blue" },
  { id: "chill" as CardId, name: "Chill", category: "Spell Blue" },
  // Spells (Green)
  { id: "restoration" as CardId, name: "Restoration", category: "Spell Green" },
  // Spells (White)
  { id: "expose" as CardId, name: "Expose", category: "Spell White" },
  { id: "whirlwind" as CardId, name: "Whirlwind", category: "Spell White" },
  // Advanced Actions - Bolts
  { id: "fire_bolt" as CardId, name: "Fire Bolt", category: "Advanced" },
  { id: "ice_bolt" as CardId, name: "Ice Bolt", category: "Advanced" },
  { id: "swift_bolt" as CardId, name: "Swift Bolt", category: "Advanced" },
  { id: "crushing_bolt" as CardId, name: "Crushing Bolt", category: "Advanced" },
  // Advanced Actions - Red
  { id: "blood_rage" as CardId, name: "Blood Rage", category: "Advanced Red" },
  { id: "intimidate" as CardId, name: "Intimidate", category: "Advanced Red" },
  { id: "blood_ritual" as CardId, name: "Blood Ritual", category: "Advanced Red" },
  { id: "into_the_heat" as CardId, name: "Into the Heat", category: "Advanced Red" },
  { id: "decompose" as CardId, name: "Decompose", category: "Advanced Red" },
  { id: "maximal_effect" as CardId, name: "Maximal Effect", category: "Advanced Red" },
  { id: "counterattack" as CardId, name: "Counterattack", category: "Advanced Red" },
  { id: "ritual_attack" as CardId, name: "Ritual Attack", category: "Advanced Red" },
  { id: "blood_of_ancients" as CardId, name: "Blood of Ancients", category: "Advanced Red" },
  { id: "explosive_bolt" as CardId, name: "Explosive Bolt", category: "Advanced Red" },
  // Advanced Actions - Blue
  { id: "ice_shield" as CardId, name: "Ice Shield", category: "Advanced Blue" },
  { id: "frost_bridge" as CardId, name: "Frost Bridge", category: "Advanced Blue" },
  { id: "pure_magic" as CardId, name: "Pure Magic", category: "Advanced Blue" },
  { id: "steady_tempo" as CardId, name: "Steady Tempo", category: "Advanced Blue" },
  { id: "crystal_mastery" as CardId, name: "Crystal Mastery", category: "Advanced Blue" },
  { id: "magic_talent" as CardId, name: "Magic Talent", category: "Advanced Blue" },
  { id: "shield_bash" as CardId, name: "Shield Bash", category: "Advanced Blue" },
  { id: "temporal_portal" as CardId, name: "Temporal Portal", category: "Advanced Blue" },
  { id: "spell_forge" as CardId, name: "Spell Forge", category: "Advanced Blue" },
  // Advanced Actions - White
  { id: "agility" as CardId, name: "Agility", category: "Advanced White" },
  { id: "song_of_wind" as CardId, name: "Song of Wind", category: "Advanced White" },
  { id: "heroic_tale" as CardId, name: "Heroic Tale", category: "Advanced White" },
  { id: "diplomacy" as CardId, name: "Diplomacy", category: "Advanced White" },
  { id: "mana_storm" as CardId, name: "Mana Storm", category: "Advanced White" },
  { id: "learning" as CardId, name: "Learning", category: "Advanced White" },
  { id: "chivalry" as CardId, name: "Chivalry", category: "Advanced White" },
  { id: "peaceful_moment" as CardId, name: "Peaceful Moment", category: "Advanced White" },
  { id: "dodge_and_weave" as CardId, name: "Dodge and Weave", category: "Advanced White" },
  // Advanced Actions - Green
  { id: "refreshing_walk" as CardId, name: "Refreshing Walk", category: "Advanced Green" },
  { id: "path_finding" as CardId, name: "Path Finding", category: "Advanced Green" },
  { id: "regeneration" as CardId, name: "Regeneration", category: "Advanced Green" },
  { id: "in_need" as CardId, name: "In Need", category: "Advanced Green" },
  { id: "ambush" as CardId, name: "Ambush", category: "Advanced Green" },
  { id: "training" as CardId, name: "Training", category: "Advanced Green" },
  { id: "stout_resolve" as CardId, name: "Stout Resolve", category: "Advanced Green" },
  { id: "force_of_nature" as CardId, name: "Force of Nature", category: "Advanced Green" },
  { id: "mountain_lore" as CardId, name: "Mountain Lore", category: "Advanced Green" },
  { id: "power_of_crystals" as CardId, name: "Power of Crystals", category: "Advanced Green" },
  // Dual-color
  { id: "rush_of_adrenaline" as CardId, name: "Rush of Adrenaline", category: "Advanced Dual" },
  { id: "chilling_stare" as CardId, name: "Chilling Stare", category: "Advanced Dual" },
];

export const MANA_COLORS: { id: BasicManaColor; name: string; color: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c" },
  { id: "blue", name: "Blue", color: "#3498db" },
  { id: "green", name: "Green", color: "#27ae60" },
  { id: "white", name: "White", color: "#ecf0f1" },
];

// All mana colors including special ones (for tokens)
export const ALL_TOKEN_COLORS: { id: ManaColor; name: string; color: string; textColor: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c", textColor: "#fff" },
  { id: "blue", name: "Blue", color: "#3498db", textColor: "#fff" },
  { id: "green", name: "Green", color: "#27ae60", textColor: "#fff" },
  { id: "white", name: "White", color: "#ecf0f1", textColor: "#333" },
  { id: "black", name: "Black", color: "#2c3e50", textColor: "#fff" },
  { id: "gold", name: "Gold", color: "#f1c40f", textColor: "#333" },
];

// Units grouped by type and level
export const UNITS: { label: string; units: { id: UnitId; name: string }[] }[] = [
  {
    label: "Regular (Level 1)",
    units: [
      { id: "peasants" as UnitId, name: "Peasants" },
      { id: "foresters" as UnitId, name: "Foresters" },
      { id: "herbalist" as UnitId, name: "Herbalist" },
      { id: "scouts" as UnitId, name: "Scouts" },
      { id: "thugs" as UnitId, name: "Thugs" },
    ],
  },
  {
    label: "Regular (Level 2)",
    units: [
      { id: "utem_crossbowmen" as UnitId, name: "Utem Crossbowmen" },
      { id: "utem_guardsmen" as UnitId, name: "Utem Guardsmen" },
      { id: "utem_swordsmen" as UnitId, name: "Utem Swordsmen" },
      { id: "guardian_golems" as UnitId, name: "Guardian Golems" },
      { id: "illusionists" as UnitId, name: "Illusionists" },
      { id: "shocktroops" as UnitId, name: "Shocktroops" },
      { id: "red_cape_monks" as UnitId, name: "Red Cape Monks" },
      { id: "northern_monks" as UnitId, name: "Northern Monks" },
      { id: "savage_monks" as UnitId, name: "Savage Monks" },
      { id: "magic_familiars" as UnitId, name: "Magic Familiars" },
    ],
  },
  {
    label: "Elite (Level 3)",
    units: [
      { id: "fire_mages" as UnitId, name: "Fire Mages" },
      { id: "ice_mages" as UnitId, name: "Ice Mages" },
      { id: "fire_golems" as UnitId, name: "Fire Golems" },
      { id: "ice_golems" as UnitId, name: "Ice Golems" },
      { id: "sorcerers" as UnitId, name: "Sorcerers" },
      { id: "catapults" as UnitId, name: "Catapults" },
      { id: "amotep_gunners" as UnitId, name: "Amotep Gunners" },
      { id: "amotep_freezers" as UnitId, name: "Amotep Freezers" },
      { id: "heroes" as UnitId, name: "Heroes" },
    ],
  },
  {
    label: "Elite (Level 4)",
    units: [
      { id: "altem_mages" as UnitId, name: "Altem Mages" },
      { id: "altem_guardians" as UnitId, name: "Altem Guardians" },
      { id: "delphana_masters" as UnitId, name: "Delphana Masters" },
    ],
  },
];

// Level thresholds and stats from shared/levels.ts
export const LEVEL_THRESHOLDS = [0, 3, 8, 14, 21, 29, 38, 48, 59, 71];
export const LEVEL_STATS: Record<number, { armor: number; handLimit: number; commandSlots: number }> = {
  1: { armor: 2, handLimit: 5, commandSlots: 1 },
  2: { armor: 2, handLimit: 5, commandSlots: 1 },
  3: { armor: 3, handLimit: 5, commandSlots: 2 },
  4: { armor: 3, handLimit: 5, commandSlots: 2 },
  5: { armor: 3, handLimit: 6, commandSlots: 3 },
  6: { armor: 3, handLimit: 6, commandSlots: 3 },
  7: { armor: 4, handLimit: 6, commandSlots: 4 },
  8: { armor: 4, handLimit: 6, commandSlots: 4 },
  9: { armor: 4, handLimit: 7, commandSlots: 5 },
  10: { armor: 4, handLimit: 7, commandSlots: 5 },
};

// Sound event labels for display
export const SOUND_EVENT_LABELS: Record<SoundEvent, string> = {
  cardHover: "Card Hover",
  cardDeal: "Card Deal",
  cardPlay: "Card Play",
};

// Category labels for display
export const CATEGORY_LABELS: Record<TrackCategory, string> = {
  pad: "Pads",
  strings: "Strings",
  piano: "Piano",
  guitar: "Guitar",
  mallets: "Mallets",
  nature: "Nature",
};

// Layer labels for display
export const LAYER_LABELS: Record<LayerType, string> = {
  music: "Music",
  nature: "Nature",
};
