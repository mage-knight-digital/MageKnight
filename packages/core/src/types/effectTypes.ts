/**
 * Card effect type constants (single source of truth for effect discriminators).
 *
 * These constants back the CardEffect discriminated union in cards.ts.
 * Attack elements reuse ELEMENT_* from modifierConstants.ts.
 */

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

// === Combat Type Constants ===
// Note: These are separate from enemy AttackType (physical/fire/ice/cold_fire).
// CombatType describes the *method* of attack (melee, ranged, siege).
export const COMBAT_TYPE_MELEE = "melee" as const;
export const COMBAT_TYPE_RANGED = "ranged" as const;
export const COMBAT_TYPE_SIEGE = "siege" as const;

export type CombatType =
  | typeof COMBAT_TYPE_MELEE
  | typeof COMBAT_TYPE_RANGED
  | typeof COMBAT_TYPE_SIEGE;

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
