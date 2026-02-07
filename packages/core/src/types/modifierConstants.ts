/**
 * Modifier system constants (single source of truth for string literal unions).
 *
 * These constants back discriminated unions in `types/modifiers.ts` via `typeof`,
 * and are also used by engine logic to avoid magic strings.
 */

import {
  ELEMENT_COLD_FIRE,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_PHYSICAL,
} from "@mage-knight/shared";

// === ExpirationTrigger["type"] (engine-owned trigger, but used as string union) ===
export const EXPIRATION_TURN_END = "turn_end" as const;
export const EXPIRATION_COMBAT_END = "combat_end" as const;
export const EXPIRATION_ROUND_END = "round_end" as const;
export const EXPIRATION_TURN_START = "turn_start" as const;

// === ModifierDuration ===
export const DURATION_TURN = "turn" as const;
export const DURATION_COMBAT = "combat" as const;
export const DURATION_ROUND = "round" as const;
export const DURATION_UNTIL_NEXT_TURN = "until_next_turn" as const;
export const DURATION_PERMANENT = "permanent" as const;

// === ModifierScope["type"] ===
export const SCOPE_SELF = "self" as const;
export const SCOPE_ONE_ENEMY = "one_enemy" as const;
export const SCOPE_ALL_ENEMIES = "all_enemies" as const;
export const SCOPE_ONE_UNIT = "one_unit" as const;
export const SCOPE_ALL_UNITS = "all_units" as const;
export const SCOPE_OTHER_PLAYERS = "other_players" as const;
export const SCOPE_ALL_PLAYERS = "all_players" as const;

// === ModifierSource["type"] ===
export const SOURCE_SKILL = "skill" as const;
export const SOURCE_CARD = "card" as const;
export const SOURCE_UNIT = "unit" as const;
export const SOURCE_SITE = "site" as const;
export const SOURCE_TACTIC = "tactic" as const;

// === Shared convenience markers ===
export const TERRAIN_ALL = "all" as const;

// === ModifierEffect["type"] ===
export const EFFECT_TERRAIN_COST = "terrain_cost" as const;
export const EFFECT_TERRAIN_SAFE = "terrain_safe" as const;
export const EFFECT_SIDEWAYS_VALUE = "sideways_value" as const;
export const EFFECT_MOVEMENT_CARD_BONUS = "movement_card_bonus" as const;
export const EFFECT_COMBAT_VALUE = "combat_value" as const;
export const EFFECT_ENEMY_STAT = "enemy_stat" as const;
export const EFFECT_RULE_OVERRIDE = "rule_override" as const;
export const EFFECT_ABILITY_NULLIFIER = "ability_nullifier" as const;

// === SidewaysValueModifier["condition"] ===
export const SIDEWAYS_CONDITION_NO_MANA_USED = "no_mana_used" as const;
export const SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR =
  "with_mana_matching_color" as const;

// === CombatValueModifier["valueType"] ===
export const COMBAT_VALUE_ATTACK = "attack" as const;
export const COMBAT_VALUE_BLOCK = "block" as const;
export const COMBAT_VALUE_RANGED = "ranged" as const;
export const COMBAT_VALUE_SIEGE = "siege" as const;

// === CombatValueModifier["element"] ===
export { ELEMENT_FIRE, ELEMENT_ICE, ELEMENT_COLD_FIRE, ELEMENT_PHYSICAL };

// === EnemyStatModifier["stat"] ===
export const ENEMY_STAT_ARMOR = "armor" as const;
export const ENEMY_STAT_ATTACK = "attack" as const;

// === RuleOverrideModifier["rule"] ===
export const RULE_IGNORE_FORTIFICATION = "ignore_fortification" as const;
export const RULE_IGNORE_RAMPAGING_PROVOKE = "ignore_rampaging_provoke" as const;
export const RULE_WOUNDS_PLAYABLE_SIDEWAYS = "wounds_playable_sideways" as const;
export const RULE_GOLD_AS_BLACK = "gold_as_black" as const;
export const RULE_BLACK_AS_GOLD = "black_as_gold" as const;
export const RULE_TERRAIN_DAY_NIGHT_SWAP = "terrain_day_night_swap" as const;
export const RULE_SOURCE_BLOCKED = "source_blocked" as const;
export const RULE_EXTRA_SOURCE_DIE = "extra_source_die" as const;
export const RULE_BLACK_AS_ANY_COLOR = "black_as_any_color" as const;
export const RULE_EXTENDED_EXPLORE = "extended_explore" as const;

// === AbilityNullifierModifier ===
export const ABILITY_ANY = "any" as const;

// === EnemySkipAttackModifier ===
// Enemy does not attack this combat (used by Chill, Whirlwind)
export const EFFECT_ENEMY_SKIP_ATTACK = "enemy_skip_attack" as const;

// === EnemyRemoveResistancesModifier ===
// Enemy loses all resistances this combat (used by Expose)
export const EFFECT_REMOVE_RESISTANCES = "remove_resistances" as const;

// === EndlessManaModifier ===
// Provides endless supply of specific mana colors for a turn (used by Ring artifacts)
export const EFFECT_ENDLESS_MANA = "endless_mana" as const;

// === TerrainProhibitionModifier ===
// Prohibits entering specific terrains (e.g., Mist Form: cannot enter hills/mountains)
export const EFFECT_TERRAIN_PROHIBITION = "terrain_prohibition" as const;

// === GrantResistancesModifier ===
// Grants resistances to units (e.g., Veil of Mist: all units gain all resistances)
export const EFFECT_GRANT_RESISTANCES = "grant_resistances" as const;

// === DoublePhysicalAttacksModifier ===
// Doubles physical attack damage (Sword of Justice powered)
// Only applies during Attack Phase, applied after all other bonuses
export const EFFECT_DOUBLE_PHYSICAL_ATTACKS = "double_physical_attacks" as const;

// === RemovePhysicalResistanceModifier ===
// Removes physical resistance from enemies (Sword of Justice powered)
// Does not affect Arcane Immune enemies
export const EFFECT_REMOVE_PHYSICAL_RESISTANCE = "remove_physical_resistance" as const;

// === RemoveFireResistanceModifier ===
// Removes fire resistance from enemies (Chill spell)
// Does not affect Arcane Immune enemies
export const EFFECT_REMOVE_FIRE_RESISTANCE = "remove_fire_resistance" as const;

// === ColdToughnessBlockModifier ===
// Grants +1 ice block per ability/attack color/resistance on blocked enemy (Tovak)
// Arcane Immunity on the enemy negates the bonus entirely
export const EFFECT_COLD_TOUGHNESS_BLOCK = "cold_toughness_block" as const;

// === RecruitDiscountModifier ===
// Grants a discount toward recruiting one unit this turn
// If the discount is used (unit recruited at reduced cost), reputation changes
// Used by Ruthless Coercion basic effect
export const EFFECT_RECRUIT_DISCOUNT = "recruit_discount" as const;

// === MoveToAttackConversionModifier ===
// Allows converting move points to attack during combat (Agility card)
// Basic: 1 move = 1 melee attack, Powered: also 2 move = 1 ranged attack
export const EFFECT_MOVE_TO_ATTACK_CONVERSION = "move_to_attack_conversion" as const;

// === RuleOverrideModifier["rule"] additions ===
// Allows playing movement cards during combat for their move value
export const RULE_MOVE_CARDS_IN_COMBAT = "move_cards_in_combat" as const;

// === ScoutFameBonusModifier ===
// Grants +1 fame when defeating an enemy that was revealed by Scout ability this turn
// Tracks which enemies were revealed via Scout peek
export const EFFECT_SCOUT_FAME_BONUS = "scout_fame_bonus" as const;

// === DamageRedirectModifier ===
// Forces damage from a specific enemy to be assigned to a specific unit first.
// Overrides Assassination ability. If the unit is wounded/destroyed before
// damage assignment, the redirect is inactive and damage can go anywhere.
// Used by Shocktroops' Taunt ability.
export const EFFECT_DAMAGE_REDIRECT = "damage_redirect" as const;

// === UnitAttackBonusModifier ===
// Grants +N to all attacks (melee, ranged, siege) for units.
// Scoped to SCOPE_OTHER_UNITS to exclude the unit that granted the bonus.
// Used by Shocktroops' Coordinated Fire ability.
export const EFFECT_UNIT_ATTACK_BONUS = "unit_attack_bonus" as const;

// === DiseaseArmorModifier ===
// Sets enemy armor to a fixed value (Disease powered effect).
// Applied to fully-blocked enemies during block phase.
export const EFFECT_DISEASE_ARMOR = "disease_armor" as const;

// === CureActiveModifier ===
// Marks that Cure spell is active this turn.
// When active, future healing from hand also draws cards,
// and future unit healing also readies the unit.
export const EFFECT_CURE_ACTIVE = "cure_active" as const;

// === TransformAttacksToColdFireModifier ===
// All attacks played by this player become Cold Fire element this combat.
// Applied by Altem Mages' black mana ability (option 1).
// Only affects attacks played AFTER activation (transforms at accumulation time).
export const EFFECT_TRANSFORM_ATTACKS_COLD_FIRE = "transform_attacks_cold_fire" as const;

// === AddSiegeToAttacksModifier ===
// All attacks played by this player also count as Siege this combat.
// Applied by Altem Mages' black mana ability (option 2).
// Only affects attacks played AFTER activation (adds siege copy at accumulation time).
export const EFFECT_ADD_SIEGE_TO_ATTACKS = "add_siege_to_attacks" as const;

// === UnitRecruitmentBonusModifier ===
// Grants reputation and/or fame bonuses each time a unit is recruited this turn.
// Does NOT get consumed — applies to every recruitment for the rest of the turn.
// Used by Heroic Tale card.
export const EFFECT_RECRUITMENT_BONUS = "recruitment_bonus" as const;

// === InteractionBonusModifier ===
// Grants fame and/or reputation when the player completes an interaction
// (recruit unit, buy spell, heal at village/monastery).
// Consumed on first interaction — only triggers once per card play.
// Used by Noble Manners card.
export const EFFECT_INTERACTION_BONUS = "interaction_bonus" as const;

// === BurningShieldActiveModifier ===
// Marks that Burning Shield/Exploding Shield spell is active this combat.
// When a block is successfully declared against any enemy, triggers a bonus:
// - Basic (mode "attack"): grants Fire Attack 4 in Attack phase
// - Powered (mode "destroy"): destroys the blocked enemy (respects Fire/Arcane resistances)
// The modifier fires ONCE on the first successful block, then is consumed.
export const EFFECT_BURNING_SHIELD_ACTIVE = "burning_shield_active" as const;

// === ManaClaimSustainedModifier ===
// Grants 1 mana token of the claimed color at the start of each turn.
// Duration: round (expires at end of round when die is returned).
// Applied by Mana Claim sustained mode.
export const EFFECT_MANA_CLAIM_SUSTAINED = "mana_claim_sustained" as const;

// === ManaCurseModifier ===
// When another player uses mana of the cursed color, they take a wound.
// Max 1 wound per player per turn. Duration: round.
export const EFFECT_MANA_CURSE = "mana_curse" as const;

