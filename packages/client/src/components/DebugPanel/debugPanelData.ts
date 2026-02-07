/**
 * Debug Panel Data - Constants and data definitions for debug controls
 *
 * Game data (cards, enemies, units) is derived dynamically from @mage-knight/shared.
 * Audio-related constants are defined locally (no shared equivalent).
 */

import type { BasicManaColor, ManaColor, CardId, EnemyId, UnitId, EnemyColor } from "@mage-knight/shared";
import {
  ALL_SHARED_BASIC_ACTION_IDS,
  ALL_HERO_SPECIFIC_IDS,
  ALL_SPELL_IDS,
  ALL_ARTIFACT_IDS,
  ALL_ADVANCED_ACTION_IDS,
  CARD_WOUND,
  ENEMIES as ENEMY_DEFS,
  UNITS as UNIT_DEFS,
} from "@mage-knight/shared";
import type { SoundEvent } from "../../utils/audioManager";
import type { TrackCategory, LayerType } from "../../utils/ambientMusicManager";

// === Helpers ===

function formatCardId(id: string): string {
  return id
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function buildCardEntries(ids: readonly CardId[], category: string) {
  return ids.map((id) => ({ id, name: formatCardId(id), category }));
}

// === Cards ===

export const ALL_CARDS: { id: CardId; name: string; category: string }[] = [
  ...buildCardEntries(ALL_SHARED_BASIC_ACTION_IDS, "Basic"),
  { id: CARD_WOUND, name: "Wound", category: "Basic" },
  ...buildCardEntries(ALL_HERO_SPECIFIC_IDS, "Hero"),
  ...buildCardEntries(ALL_SPELL_IDS, "Spell"),
  ...buildCardEntries(ALL_ARTIFACT_IDS, "Artifact"),
  ...buildCardEntries(ALL_ADVANCED_ACTION_IDS, "Advanced"),
];

// === Enemies ===

const ENEMY_COLOR_LABELS: Record<EnemyColor, string> = {
  green: "Green (Orcs)",
  gray: "Gray (Keep)",
  brown: "Brown (Dungeon)",
  violet: "Violet (Mage Tower)",
  red: "Red (Draconum)",
  white: "White (City)",
};

const ENEMY_COLOR_ORDER: EnemyColor[] = ["green", "gray", "brown", "violet", "red", "white"];

export const ENEMIES: { label: string; enemies: { id: EnemyId; name: string }[] }[] =
  ENEMY_COLOR_ORDER.map((color) => ({
    label: ENEMY_COLOR_LABELS[color],
    enemies: Object.values(ENEMY_DEFS)
      .filter((e) => e.color === color)
      .map((e) => ({ id: e.id, name: e.name })),
  }));

// === Units ===

const UNIT_LEVEL_LABELS: Record<number, string> = {
  1: "Regular (Level 1)",
  2: "Regular (Level 2)",
  3: "Elite (Level 3)",
  4: "Elite (Level 4)",
};

export const UNITS: { label: string; units: { id: UnitId; name: string }[] }[] =
  [1, 2, 3, 4].map((level) => ({
    label: UNIT_LEVEL_LABELS[level],
    units: Object.values(UNIT_DEFS)
      .filter((u) => u.level === level)
      .map((u) => ({ id: u.id, name: u.name })),
  }));

// === Mana ===

export const MANA_COLORS: { id: BasicManaColor; name: string; color: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c" },
  { id: "blue", name: "Blue", color: "#3498db" },
  { id: "green", name: "Green", color: "#27ae60" },
  { id: "white", name: "White", color: "#ecf0f1" },
];

export const ALL_TOKEN_COLORS: { id: ManaColor; name: string; color: string; textColor: string }[] = [
  { id: "red", name: "Red", color: "#e74c3c", textColor: "#fff" },
  { id: "blue", name: "Blue", color: "#3498db", textColor: "#fff" },
  { id: "green", name: "Green", color: "#27ae60", textColor: "#fff" },
  { id: "white", name: "White", color: "#ecf0f1", textColor: "#333" },
  { id: "black", name: "Black", color: "#2c3e50", textColor: "#fff" },
  { id: "gold", name: "Gold", color: "#f1c40f", textColor: "#333" },
];

// === Audio ===

export const SOUND_EVENT_LABELS: Record<SoundEvent, string> = {
  cardHover: "Card Hover",
  cardDeal: "Card Deal",
  cardPlay: "Card Play",
};

export const CATEGORY_LABELS: Record<TrackCategory, string> = {
  pad: "Pads",
  strings: "Strings",
  piano: "Piano",
  guitar: "Guitar",
  mallets: "Mallets",
  nature: "Nature",
};

export const LAYER_LABELS: Record<LayerType, string> = {
  music: "Music",
  nature: "Nature",
};
