/**
 * Action card color helpers.
 *
 * Used for effects that depend on the color of a discarded Action card
 * (e.g., Ritual Attack).
 */

import type { CardId } from "@mage-knight/shared";
import type { BasicCardColor } from "../../types/effectTypes.js";
import {
  CARD_COLOR_RED,
  CARD_COLOR_BLUE,
  CARD_COLOR_GREEN,
  CARD_COLOR_WHITE,
} from "../../types/effectTypes.js";
import {
  RED_BASIC_ACTIONS,
  BLUE_BASIC_ACTIONS,
  GREEN_BASIC_ACTIONS,
  WHITE_BASIC_ACTIONS,
} from "../../data/basicActions/index.js";
import {
  RED_ADVANCED_ACTIONS,
  BLUE_ADVANCED_ACTIONS,
  GREEN_ADVANCED_ACTIONS,
  WHITE_ADVANCED_ACTIONS,
} from "../../data/advancedActions/index.js";
import { RED_SPELLS } from "../../data/spells/red/index.js";
import { BLUE_SPELLS } from "../../data/spells/blue/index.js";
import { GREEN_SPELLS } from "../../data/spells/green/index.js";
import { WHITE_SPELLS } from "../../data/spells/white/index.js";

const RED_ACTION_CARD_IDS = new Set<string>([
  ...Object.keys(RED_BASIC_ACTIONS),
  ...Object.keys(RED_ADVANCED_ACTIONS),
]);
const BLUE_ACTION_CARD_IDS = new Set<string>([
  ...Object.keys(BLUE_BASIC_ACTIONS),
  ...Object.keys(BLUE_ADVANCED_ACTIONS),
]);
const GREEN_ACTION_CARD_IDS = new Set<string>([
  ...Object.keys(GREEN_BASIC_ACTIONS),
  ...Object.keys(GREEN_ADVANCED_ACTIONS),
]);
const WHITE_ACTION_CARD_IDS = new Set<string>([
  ...Object.keys(WHITE_BASIC_ACTIONS),
  ...Object.keys(WHITE_ADVANCED_ACTIONS),
]);

const RED_SPELL_IDS = new Set<string>(Object.keys(RED_SPELLS));
const BLUE_SPELL_IDS = new Set<string>(Object.keys(BLUE_SPELLS));
const GREEN_SPELL_IDS = new Set<string>(Object.keys(GREEN_SPELLS));
const WHITE_SPELL_IDS = new Set<string>(Object.keys(WHITE_SPELLS));

/**
 * Get the frame color of an Action card by ID.
 * Returns null for non-action cards or unsupported colors.
 */
export function getActionCardColor(cardId: CardId): BasicCardColor | null {
  if (RED_ACTION_CARD_IDS.has(cardId)) return CARD_COLOR_RED;
  if (BLUE_ACTION_CARD_IDS.has(cardId)) return CARD_COLOR_BLUE;
  if (GREEN_ACTION_CARD_IDS.has(cardId)) return CARD_COLOR_GREEN;
  if (WHITE_ACTION_CARD_IDS.has(cardId)) return CARD_COLOR_WHITE;
  return null;
}

/**
 * Check if a card (Action or Spell) matches a given basic card color.
 * Action cards use their frame color. Spells use their non-black mana color.
 * Returns false for wounds, artifacts, and other uncolored cards.
 */
export function isCardOfColor(cardId: CardId, color: BasicCardColor): boolean {
  // Check action cards first (most common case)
  const actionColor = getActionCardColor(cardId);
  if (actionColor !== null) return actionColor === color;

  // Check spell cards by their registry membership
  if (RED_SPELL_IDS.has(cardId)) return color === CARD_COLOR_RED;
  if (BLUE_SPELL_IDS.has(cardId)) return color === CARD_COLOR_BLUE;
  if (GREEN_SPELL_IDS.has(cardId)) return color === CARD_COLOR_GREEN;
  if (WHITE_SPELL_IDS.has(cardId)) return color === CARD_COLOR_WHITE;

  return false;
}
