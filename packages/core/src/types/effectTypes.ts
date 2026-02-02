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
export const EFFECT_GAIN_FAME = "gain_fame" as const;
export const EFFECT_GAIN_CRYSTAL = "gain_crystal" as const;
export const EFFECT_CONVERT_MANA_TO_CRYSTAL = "convert_mana_to_crystal" as const;
// Internal: Final resolution for crystallize - consume token and gain crystal
export const EFFECT_CRYSTALLIZE_COLOR = "crystallize_color" as const;
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

// === Terrain-Based Effects ===
// Block with value based on terrain's unmodified movement cost
// Element varies by time of day: Fire (day) / Ice (night or underground)
export const EFFECT_TERRAIN_BASED_BLOCK = "terrain_based_block" as const;

// === Cost Effects ===
// Take a wound (add wound card to hand)
export const EFFECT_TAKE_WOUND = "take_wound" as const;

// === Enemy Targeting Effects ===
// Entry effect for selecting an enemy in combat
export const EFFECT_SELECT_COMBAT_ENEMY = "select_combat_enemy" as const;
// Internal: resolve effect after enemy selection
export const EFFECT_RESOLVE_COMBAT_ENEMY_TARGET = "resolve_combat_enemy_target" as const;

// === Skill-Related Effect Types ===
// Heal a unit (remove wound from unit)
export const EFFECT_HEAL_UNIT = "heal_unit" as const;
// Discard a card from hand (with filter options)
export const EFFECT_DISCARD_CARD = "discard_card" as const;
// Reveal tiles on the map (e.g., reveal garrisons)
export const EFFECT_REVEAL_TILES = "reveal_tiles" as const;
// Pay mana as a cost (for skill activations)
export const EFFECT_PAY_MANA = "pay_mana" as const;

// === Discard as Cost Effect ===
// Discard cards from hand as a cost, then resolve a follow-up effect (e.g., Improvisation)
export const EFFECT_DISCARD_COST = "discard_cost" as const;

// === Grant Wound Immunity Effect ===
// Hero ignores the first wound from enemies this turn (including wound effects)
// Used by Veil of Mist spell
export const EFFECT_GRANT_WOUND_IMMUNITY = "grant_wound_immunity" as const;

// === Discard for Attack Effect ===
// Discard any number of non-wound cards, gain attack per card (Sword of Justice basic)
export const EFFECT_DISCARD_FOR_ATTACK = "discard_for_attack" as const;

// === Fame per Enemy Defeated This Turn Effect ===
// Track and award fame based on enemies defeated (Sword of Justice)
export const EFFECT_FAME_PER_ENEMY_DEFEATED = "fame_per_enemy_defeated" as const;
