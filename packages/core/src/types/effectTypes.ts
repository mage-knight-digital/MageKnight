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
export const EFFECT_NOOP = "noop" as const;
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
// Internal: resolve effect after unit selection for readying
export const EFFECT_RESOLVE_READY_UNIT_TARGET = "resolve_ready_unit_target" as const;

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

export type BasicCardColor = Exclude<CardColor, typeof CARD_COLOR_WOUND>;

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
// Discard wound cards from hand (return to wound pile)
export const EFFECT_DISCARD_WOUNDS = "discard_wounds" as const;
// Reveal tiles on the map (e.g., reveal garrisons)
export const EFFECT_REVEAL_TILES = "reveal_tiles" as const;
// Pay mana as a cost (for skill activations)
export const EFFECT_PAY_MANA = "pay_mana" as const;
// Place an interactive skill token in the center for other players to use
export const EFFECT_PLACE_SKILL_IN_CENTER = "place_skill_in_center" as const;

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

// === Fame on Enemy Defeat by Specific Attack ===
// Track a specific attack and grant fame if it defeats at least one enemy
export const EFFECT_TRACK_ATTACK_DEFEAT_FAME = "track_attack_defeat_fame" as const;

// === Polarization Effect ===
// Mana conversion for Arythea's Polarization skill
// Removes source mana and adds converted token in one atomic operation
export const EFFECT_POLARIZE_MANA = "polarize_mana" as const;

// === Discard for Crystal Effect ===
// Discard a card to gain a crystal of matching color (action cards) or chosen color (artifacts)
// Used by Krang's Savage Harvesting card
export const EFFECT_DISCARD_FOR_CRYSTAL = "discard_for_crystal" as const;

// === Recruit Discount Effect ===
// Grants a turn-scoped recruit discount modifier. If the discount is used, reputation changes.
// Used by Ruthless Coercion basic effect.
export const EFFECT_APPLY_RECRUIT_DISCOUNT = "apply_recruit_discount" as const;

// === Ready Units for Influence Effect ===
// Entry point for readying L1/L2 units by paying influence per level.
// Used by Ruthless Coercion powered effect.
export const EFFECT_READY_UNITS_FOR_INFLUENCE = "ready_units_for_influence" as const;

// === Energy Flow Effects ===
// Ready a unit, then optionally spend opponent units (Energy Flow / Energy Steal spell).
// Entry point that handles ready → heal (if powered) → spend opponent units sequence.
export const EFFECT_ENERGY_FLOW = "energy_flow" as const;
// Internal: resolve effect after unit selection for Energy Flow
export const EFFECT_RESOLVE_ENERGY_FLOW_TARGET = "resolve_energy_flow_target" as const;
// Internal: resolve effect after unit selection for influence-paid readying
export const EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE = "resolve_ready_unit_for_influence" as const;

// === Ready All Units Effect ===
// Ready all units controlled by the player (regardless of level or wound status).
// Used by Banner of Courage powered effect.
export const EFFECT_READY_ALL_UNITS = "ready_all_units" as const;

// === Terrain Cost Reduction Selection Effects ===
// Select a hex coordinate for cost reduction (Druidic Paths basic effect)
export const EFFECT_SELECT_HEX_FOR_COST_REDUCTION = "select_hex_for_cost_reduction" as const;
// Select a terrain type for cost reduction (Druidic Paths powered effect)
export const EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION = "select_terrain_for_cost_reduction" as const;

// === Cure Spell Effects ===
// Basic Cure: Heal 2, draw a card per wound healed from hand this turn, ready healed units
export const EFFECT_CURE = "cure" as const;
// Powered Disease: Reduce armor to 1 for all fully-blocked enemies
export const EFFECT_DISEASE = "disease" as const;

// === Invocation Effect ===
// Atomic effect for Arythea's Invocation skill.
// Discards a card from hand and gains a mana token in one atomic operation.
// Wound cards → red or black mana. Non-wound cards → white or green mana.
export const EFFECT_INVOCATION_RESOLVE = "invocation_resolve" as const;

// === Ready Units Budget Effect ===
// Entry point for readying spent units up to a total level budget (no influence cost).
// Used by Restoration/Rebirth powered spell effect.
export const EFFECT_READY_UNITS_BUDGET = "ready_units_budget" as const;
// Internal: resolve effect after unit selection for budget-based readying
export const EFFECT_RESOLVE_READY_UNIT_BUDGET = "resolve_ready_unit_budget" as const;

// === Wound Activating Unit Effect ===
// Wounds the unit that activated this ability (sets unit.wounded = true).
// Used by Utem Swordsmen's Attack/Block 6 ability.
// This is a self-inflicted wound, NOT combat damage — does not trigger
// Paralyze, Vampiric, or Poison enemy abilities.
export const EFFECT_WOUND_ACTIVATING_UNIT = "wound_activating_unit" as const;

// === Mana Meltdown / Mana Radiance Effects ===
// Basic (Mana Meltdown): Each opponent randomly loses a crystal (or takes wound).
// Caster may gain one lost crystal.
export const EFFECT_MANA_MELTDOWN = "mana_meltdown" as const;
// Internal: Caster chooses which stolen crystal to gain (or skip)
export const EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE = "resolve_mana_meltdown_choice" as const;
// Powered (Mana Radiance): Choose a basic color, all players wound per crystal, gain 2 crystals.
export const EFFECT_MANA_RADIANCE = "mana_radiance" as const;
// Internal: Resolve after color selection
export const EFFECT_RESOLVE_MANA_RADIANCE_COLOR = "resolve_mana_radiance_color" as const;

// === Mana Claim / Mana Curse Effects ===
// Basic (Mana Claim): Take a basic color die from Source, keep until end of round.
// Choose: 3 tokens now OR 1 token per turn for remainder of round.
export const EFFECT_MANA_CLAIM = "mana_claim" as const;
// Internal: Player has selected which die to claim
export const EFFECT_RESOLVE_MANA_CLAIM_DIE = "resolve_mana_claim_die" as const;
// Internal: Player has chosen burst (3 now) or sustained (1 per turn) mode
export const EFFECT_RESOLVE_MANA_CLAIM_MODE = "resolve_mana_claim_mode" as const;
// Powered (Mana Curse): Same as basic + curse effect on other players' mana usage.
export const EFFECT_MANA_CURSE = "mana_curse" as const;

// === Scout Peek Effect ===
// Reveals face-down enemy tokens within a distance from the player.
// Also creates a modifier tracking which enemies were revealed, granting +1 fame on defeat.
// Used by Scouts unit ability.
export const EFFECT_SCOUT_PEEK = "scout_peek" as const;

// === Altem Mages Cold Fire Attack/Block Effect ===
// Dynamic choice: Cold Fire Attack OR Block 5, optionally boosted by paying
// blue (+2), red (+2), or both (+4) mana tokens.
// Generates choices based on available mana at resolution time.
export const EFFECT_ALTEM_MAGES_COLD_FIRE = "altem_mages_cold_fire" as const;

// === Pure Magic Effect ===
// Pay a basic mana token → effect determined by color paid:
// Green → Move, White → Influence, Blue → Block, Red → Attack.
// Blue/Red only available during combat (Block/Attack are combat actions).
// Values differ between basic (4) and powered (7) modes.
export const EFFECT_PURE_MAGIC = "pure_magic" as const;

// === Mana Bolt Effect ===
// Pay a basic mana token → attack determined by color paid:
// Blue → Melee Ice Attack, Red → Melee Cold Fire Attack,
// White → Ranged Ice Attack, Green → Siege Ice Attack.
// Combat only. Values differ between basic and powered modes.
export const EFFECT_MANA_BOLT = "mana_bolt" as const;

// === Recruitment Bonus Effect ===
// Adds a turn-scoped modifier that grants reputation and/or fame per unit recruited.
// Used by Heroic Tale (basic: Rep+1 per recruit, powered: Rep+1 + Fame+1 per recruit).
export const EFFECT_APPLY_RECRUITMENT_BONUS = "apply_recruitment_bonus" as const;

// === Interaction Bonus Effect ===
// Adds a turn-scoped modifier that grants fame and/or reputation on the first interaction.
// Used by Noble Manners (basic: Fame+1 on interact, powered: Fame+1 + Rep+1 on interact).
export const EFFECT_APPLY_INTERACTION_BONUS = "apply_interaction_bonus" as const;

// === Sacrifice (Offering powered) Effect ===
// Two-stage color choice: first green/white (attack type), then red/blue (element).
// Count crystal pairs of chosen colors. Each pair generates attack.
// Convert all complete pairs to mana tokens.
export const EFFECT_SACRIFICE = "sacrifice" as const;
// Internal: Resolve after second color choice — calculate attack, convert crystals.
export const EFFECT_RESOLVE_SACRIFICE = "resolve_sacrifice" as const;

// === Free Recruit Effect ===
// Recruit any unit from the units offer for free (no influence cost).
// No location restrictions (can be anywhere, even in combat).
// If at command limit, must disband a unit first.
// Used by Banner of Command powered effect and Call to Glory spell.
export const EFFECT_FREE_RECRUIT = "free_recruit" as const;
// Internal: resolve after unit selection for free recruitment
export const EFFECT_RESOLVE_FREE_RECRUIT_TARGET = "resolve_free_recruit_target" as const;

// === Call to Arms Effect ===
// Borrow a unit ability from the Units Offer without recruiting.
// Presents units from offer (excluding Magic Familiars, Delphana Masters).
// Then presents abilities of the selected unit. Resolves chosen ability.
// Cannot assign damage to the borrowed unit.
// Used by Call to Arms spell basic effect.
export const EFFECT_CALL_TO_ARMS = "call_to_arms" as const;
// Internal: resolve after selecting which unit to borrow from
export const EFFECT_RESOLVE_CALL_TO_ARMS_UNIT = "resolve_call_to_arms_unit" as const;
// Internal: resolve after selecting which ability to use from the borrowed unit
export const EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY = "resolve_call_to_arms_ability" as const;

// === Mind Read / Mind Steal Effects ===
// Basic (Mind Read): Choose color, gain crystal, force opponents to discard matching card.
// Opponents with no matching cards reveal their hand.
export const EFFECT_MIND_READ = "mind_read" as const;
// Internal: Resolve after color selection for Mind Read
export const EFFECT_RESOLVE_MIND_READ_COLOR = "resolve_mind_read_color" as const;
// Powered (Mind Steal): Same as basic + optionally steal one discarded Action card.
export const EFFECT_MIND_STEAL = "mind_steal" as const;
// Internal: Resolve after color selection for Mind Steal
export const EFFECT_RESOLVE_MIND_STEAL_COLOR = "resolve_mind_steal_color" as const;
// Internal: Resolve after caster selects which Action card to steal (or skip)
export const EFFECT_RESOLVE_MIND_STEAL_SELECTION = "resolve_mind_steal_selection" as const;

// === Decompose Effect ===
// Throw away an action card from hand and gain crystals based on mode.
// Basic: gain 2 crystals matching the thrown card's color.
// Powered: gain 1 crystal of each basic color NOT matching the thrown card's color.
export const EFFECT_DECOMPOSE = "decompose" as const;

// === Banner of Protection Activation Effect ===
// Marks that Banner of Protection powered effect is active this turn.
// At end of turn, player may throw away wounds received this turn.
export const EFFECT_ACTIVATE_BANNER_PROTECTION = "activate_banner_protection" as const;

// === Crystal Mastery Effects ===
// Basic: Choose a crystal color you already own, gain one crystal of that color.
export const EFFECT_CRYSTAL_MASTERY_BASIC = "crystal_mastery_basic" as const;
// Powered: At end of turn, spent crystals this turn are returned to inventory.
export const EFFECT_CRYSTAL_MASTERY_POWERED = "crystal_mastery_powered" as const;

// === Heal All Units Effect ===
// Heal all units completely (remove wounds from all wounded units).
// Used by Banner of Fortitude powered effect.
export const EFFECT_HEAL_ALL_UNITS = "heal_all_units" as const;

// === Possess Enemy Effect ===
// Entry point for the Charm/Possess powered effect.
// Targets an enemy (excludes Arcane Immune), applies skip-attack modifier,
// then gains melee Attack equal to the enemy's attack value (including elements).
// Special abilities are excluded. The gained attack can only target OTHER enemies.
export const EFFECT_POSSESS_ENEMY = "possess_enemy" as const;
// Internal: resolve after selecting which enemy to possess
export const EFFECT_RESOLVE_POSSESS_ENEMY = "resolve_possess_enemy" as const;

// === Mana Storm Effects ===
// Entry point for Mana Storm basic effect (select die, gain crystal, reroll)
export const EFFECT_MANA_STORM_BASIC = "mana_storm_basic" as const;
// Internal: Player selected a die — gain crystal of that color and reroll die
export const EFFECT_MANA_STORM_SELECT_DIE = "mana_storm_select_die" as const;
// Entry point for Mana Storm powered effect (reroll all, modifiers)
export const EFFECT_MANA_STORM_POWERED = "mana_storm_powered" as const;

// === Source Opening Effects ===
// Entry point for Source Opening activation: optional reroll of a source die
export const EFFECT_SOURCE_OPENING_REROLL = "source_opening_reroll" as const;
// Internal: Player selected a die to reroll (or skip)
export const EFFECT_SOURCE_OPENING_SELECT_DIE = "source_opening_select_die" as const;

// === Horn of Wrath Die Rolling Effects ===
// Roll mana dice and gain wounds for black/red results.
// Used by Horn of Wrath basic effect (1 die) and internally by the bonus resolver.
export const EFFECT_ROLL_DIE_FOR_WOUND = "roll_die_for_wound" as const;
// Choose a bonus amount (0 to max), then roll dice and gain siege attack + wounds.
// Used by Horn of Wrath powered effect.
export const EFFECT_CHOOSE_BONUS_WITH_RISK = "choose_bonus_with_risk" as const;
// Internal: resolve after player selects a bonus amount.
export const EFFECT_RESOLVE_BONUS_CHOICE = "resolve_bonus_choice" as const;

// === Maximal Effect ===
// Throw away an action card from hand, then execute its effect multiple times.
// Basic: use target card's basic effect 3 times.
// Powered: use target card's powered effect 2 times (for free).
export const EFFECT_MAXIMAL_EFFECT = "maximal_effect" as const;

// === Endless Gem Pouch Crystal Rolling Effects ===
// Roll mana dice and gain crystals based on results.
// Basic colors → crystal of that color, gold → player chooses color, black → Fame +1.
// Entry point: presents roll results and handles gold choices.
export const EFFECT_ROLL_FOR_CRYSTALS = "roll_for_crystals" as const;
// Internal: resolve after player chooses crystal color for a gold roll.
export const EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE = "resolve_crystal_roll_choice" as const;

// === Book of Wisdom Effect ===
// Throw away an action card from hand, then gain a card from an offer matching the thrown card's color.
// Basic: gain Advanced Action from AA offer to hand.
// Powered: gain Spell from Spell offer to hand + crystal of that color.
export const EFFECT_BOOK_OF_WISDOM = "book_of_wisdom" as const;

// === Magic Talent Effects ===
// Basic: Discard a card of any color. Play one Spell of the same color
// from the Spells Offer as if it were in your hand. Spell stays in offer.
export const EFFECT_MAGIC_TALENT_BASIC = "magic_talent_basic" as const;
// Internal: After discarding a card, player selects a spell from the offer
// of matching color, then resolves that spell's basic effect.
export const EFFECT_RESOLVE_MAGIC_TALENT_SPELL = "resolve_magic_talent_spell" as const;
// Powered: Pay a mana of any color. Gain a Spell card of that color from
// the Spells Offer and put it in your discard pile.
export const EFFECT_MAGIC_TALENT_POWERED = "magic_talent_powered" as const;
// Internal: After paying mana, player selects a spell from the offer
// of matching color, then gains it to discard pile.
export const EFFECT_RESOLVE_MAGIC_TALENT_GAIN = "resolve_magic_talent_gain" as const;
// Internal: Consume a specific mana source to pay for casting a spell
// from the offer, then resolve the spell's basic effect.
export const EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA = "resolve_magic_talent_spell_mana" as const;

// === Wings of Night Multi-Target Skip Attack Effect ===
// Entry point for multi-target enemy skip-attack with scaling move cost.
// First enemy free, second costs 1 move, third costs 2 move, etc.
// Arcane Immune enemies cannot be targeted.
export const EFFECT_WINGS_OF_NIGHT = "wings_of_night" as const;
// Internal: resolve after selecting an enemy target for Wings of Night.
// Applies skip-attack modifier, deducts move cost, chains for more targets.
export const EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET = "resolve_wings_of_night_target" as const;
