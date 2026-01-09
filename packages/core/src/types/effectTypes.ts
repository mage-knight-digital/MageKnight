/**
 * Card effect type constants (single source of truth for effect discriminators).
 *
 * These constants back the CardEffect discriminated union in cards.ts.
 * Attack elements reuse ELEMENT_* from modifierConstants.ts.
 */

export {
  COMBAT_TYPE_MELEE,
  COMBAT_TYPE_RANGED,
  COMBAT_TYPE_SIEGE,
} from "@mage-knight/shared";
export type { CombatType } from "@mage-knight/shared";

// === Card Effect Type Discriminators ===
export const EFFECT_GAIN_MOVE = "gain_move" as const;
export const EFFECT_GAIN_INFLUENCE = "gain_influence" as const;
export const EFFECT_GAIN_ATTACK = "gain_attack" as const;
export const EFFECT_GAIN_BLOCK = "gain_block" as const;
export const EFFECT_GAIN_HEALING = "gain_healing" as const;
export const EFFECT_GAIN_MANA = "gain_mana" as const;
export const EFFECT_DRAW_CARDS = "draw_cards" as const;
export const EFFECT_APPLY_MODIFIER = "apply_modifier" as const;
export const EFFECT_COMPOUND = "compound" as const;
export const EFFECT_CHOICE = "choice" as const;
export const EFFECT_CONDITIONAL = "conditional" as const;
export const EFFECT_SCALING = "scaling" as const;
export const EFFECT_CHANGE_REPUTATION = "change_reputation" as const;
export const EFFECT_GAIN_CRYSTAL = "gain_crystal" as const;
export const EFFECT_CONVERT_MANA_TO_CRYSTAL = "convert_mana_to_crystal" as const;
export const EFFECT_CARD_BOOST = "card_boost" as const;
export const EFFECT_RESOLVE_BOOST_TARGET = "resolve_boost_target" as const;
export const EFFECT_READY_UNIT = "ready_unit" as const;

// === Mana Draw Powered Effect ===
// Entry point for the powered effect
export const EFFECT_MANA_DRAW_POWERED = "mana_draw_powered" as const;
// Internal: Player has selected which die to take
export const EFFECT_MANA_DRAW_PICK_DIE = "mana_draw_pick_die" as const;
// Internal: Final resolution with die and color chosen
export const EFFECT_MANA_DRAW_SET_COLOR = "mana_draw_set_color" as const;

// === Card Color Constants ===
// Note: These are separate from ManaColor which includes gold/black.
// Card colors are the colors shown on the card frame (indicates what mana powers the card).
export const CARD_COLOR_RED = "red" as const;
export const CARD_COLOR_BLUE = "blue" as const;
export const CARD_COLOR_GREEN = "green" as const;
export const CARD_COLOR_WHITE = "white" as const;

// Wound cards have no mana color - they cannot be powered.
// This is a distinct value to avoid confusion with red mana.
export const CARD_COLOR_WOUND = "wound" as const;

export type CardColor =
  | typeof CARD_COLOR_RED
  | typeof CARD_COLOR_BLUE
  | typeof CARD_COLOR_GREEN
  | typeof CARD_COLOR_WHITE
  | typeof CARD_COLOR_WOUND;

// === Mana "Any" Constant ===
// Used when an effect can produce any color of mana
export const MANA_ANY = "any" as const;
