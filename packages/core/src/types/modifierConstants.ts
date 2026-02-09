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
export const RULE_IGNORE_REPUTATION = "ignore_reputation" as const;
export const RULE_WOUNDS_PLAYABLE_SIDEWAYS = "wounds_playable_sideways" as const;
export const RULE_GOLD_AS_BLACK = "gold_as_black" as const;
export const RULE_BLACK_AS_GOLD = "black_as_gold" as const;
export const RULE_TERRAIN_DAY_NIGHT_SWAP = "terrain_day_night_swap" as const;
export const RULE_SOURCE_BLOCKED = "source_blocked" as const;
export const RULE_EXTRA_SOURCE_DIE = "extra_source_die" as const;
export const RULE_BLACK_AS_ANY_COLOR = "black_as_any_color" as const;
export const RULE_GOLD_AS_ANY_COLOR = "gold_as_any_color" as const;
export const RULE_EXTENDED_EXPLORE = "extended_explore" as const;
export const RULE_SPACE_BENDING_ADJACENCY = "space_bending_adjacency" as const;
export const RULE_TIME_BENDING_ACTIVE = "time_bending_active" as const;

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

// === DefeatIfBlockedModifier ===
// Enemy is defeated if fully blocked during Block phase.
// For multi-attack enemies, ALL attacks must be blocked.
// Blocked by Arcane Immunity (magical effect targeting enemy).
// Used by Delphana Masters' red mana ability.
export const EFFECT_DEFEAT_IF_BLOCKED = "defeat_if_blocked" as const;

// === UnitCombatBonusModifier ===
// Grants +N to all attacks AND +N to all blocks for units.
// Only applies to units with base value > 0 for the respective ability.
// Used by Into the Heat card.
export const EFFECT_UNIT_COMBAT_BONUS = "unit_combat_bonus" as const;

// === RuleOverrideModifier["rule"] additions ===
// Prevents assigning damage to own units this combat (Into the Heat)
// Does NOT prevent opponents from assigning damage to your units (PvP)
export const RULE_UNITS_CANNOT_ABSORB_DAMAGE = "units_cannot_absorb_damage" as const;

// === LeadershipBonusModifier ===
// Grants a one-time bonus to the next unit activation.
// Stores which bonus type was chosen (block, attack, or ranged_attack)
// and the bonus amount. Consumed (removed) when a matching unit ability is activated.
// Used by Norowas' Leadership skill.
export const EFFECT_LEADERSHIP_BONUS = "leadership_bonus" as const;

// === LeadershipBonusModifier["bonusType"] ===
export const LEADERSHIP_BONUS_BLOCK = "block" as const;
export const LEADERSHIP_BONUS_ATTACK = "attack" as const;
export const LEADERSHIP_BONUS_RANGED_ATTACK = "ranged_attack" as const;

// === UnitArmorBonusModifier ===
// Grants +N armor to all units for the duration.
// Used by Banner of Glory powered effect.
export const EFFECT_UNIT_ARMOR_BONUS = "unit_armor_bonus" as const;

// === UnitBlockBonusModifier ===
// Grants +N to all block values for units (tack-on, requires base block).
// Used by Banner of Glory powered effect.
export const EFFECT_UNIT_BLOCK_BONUS = "unit_block_bonus" as const;

// === BannerOfGloryFameTracking ===
// Tracks fame +1 per unit that attacks or blocks this turn.
// Used by Banner of Glory powered effect.
export const EFFECT_BANNER_GLORY_FAME_TRACKING = "banner_glory_fame_tracking" as const;

// === InfluenceToBlockConversionModifier ===
// Allows converting influence points to block during combat (Diplomacy card)
// Basic: 1 influence = 1 physical block
// Powered: 1 influence = 1 ice block OR 1 fire block (chosen at play time)
export const EFFECT_INFLUENCE_TO_BLOCK_CONVERSION = "influence_to_block_conversion" as const;

// === RuleOverrideModifier["rule"] additions ===
// Allows playing influence cards during combat for their influence value
// (which can then be converted to block via InfluenceToBlockConversion)
export const RULE_INFLUENCE_CARDS_IN_COMBAT = "influence_cards_in_combat" as const;

// === PossessAttackRestrictionModifier ===
// Tracks that the player has attack points from a possessed enemy.
// The gained attack can only target OTHER enemies, not the possessed one.
// Used by Charm/Possess spell powered effect.
export const EFFECT_POSSESS_ATTACK_RESTRICTION = "possess_attack_restriction" as const;

// === RuleOverrideModifier["rule"] - Source Opening ===
// Grants one extra source die, restricted to basic colors only (no gold)
export const RULE_EXTRA_SOURCE_DIE_BASIC_ONLY = "extra_source_die_basic_only" as const;

// === AttackBlockCardBonusModifier ===
// Grants a one-time bonus to the first Attack or Block card played this turn.
// Whichever card type is played first consumes the modifier entirely.
// Only applies to deed cards (not units or skills).
// Used by Ambush card.
export const EFFECT_ATTACK_BLOCK_CARD_BONUS = "attack_block_card_bonus" as const;

// === RuleOverrideModifier["rule"] - Flight ===
// Prevents tile exploration (Wings of Wind flight)
export const RULE_NO_EXPLORATION = "no_exploration" as const;

// === RuleOverrideModifier["rule"] - Amulet of the Sun ===
// Allows using gold mana at night (normally gold is only available during day)
// Does NOT change time of day for skills, does NOT allow gold→black conversion
export const RULE_ALLOW_GOLD_AT_NIGHT = "allow_gold_at_night" as const;

// === RuleOverrideModifier["rule"] - Amulet of Darkness ===
// Allows using black mana during day (normally black is only available at night)
// Also makes black dice available from Source during day (overrides depletion)
// Does NOT change time of day for skills, does NOT allow black→gold conversion
export const RULE_ALLOW_BLACK_AT_DAY = "allow_black_at_day" as const;

// === RuleOverrideModifier["rule"] - Hawk Eyes (Day) ===
// Reveals garrisons of fortified sites at distance 2 during movement (Day only).
// Normal reveal range is distance 1 (adjacent). This extends it to distance 2.
// Used by Wolfhawk's Hawk Eyes skill.
export const RULE_GARRISON_REVEAL_DISTANCE_2 = "garrison_reveal_distance_2" as const;

// === HeroDamageReductionModifier ===
// Reduces incoming damage to the hero from a single enemy attack.
// Element-specific: different reduction amounts based on attack element.
// Applied AFTER Brutal doubling, BEFORE armor division.
// Used by Braevalar's Elemental Resistance, Krang's Battle Hardened.
export const EFFECT_HERO_DAMAGE_REDUCTION = "hero_damage_reduction" as const;

// === Mountain Lore Hand Limit Modifier ===
// Marks that end-of-turn terrain should grant a next-draw hand limit bonus.
// Basic: hills +1. Powered: mountains +2, hills +1.
export const EFFECT_MOUNTAIN_LORE_HAND_LIMIT = "mountain_lore_hand_limit" as const;

// === ExploreCostReductionModifier ===
// Reduces the move point cost of exploring (revealing a new tile).
// Base exploration cost is 2; this modifier reduces it by the specified amount.
// Used by Braevalar's Feral Allies passive effect.
export const EFFECT_EXPLORE_COST_REDUCTION = "explore_cost_reduction" as const;

// === GoldenGrailFameTrackingModifier ===
// Tracks healing points from Golden Grail that have been spent (used to heal wounds).
// Awards Fame +1 per healing point spent from this card.
// Modifier stores the remaining healing amount from the Grail; each time
// a wound is healed from hand, fame is awarded and the remaining decrements.
export const EFFECT_GOLDEN_GRAIL_FAME_TRACKING = "golden_grail_fame_tracking" as const;

// === GoldenGrailDrawOnHealModifier ===
// When active, every time a wound is healed from hand this turn, draw 1 card.
// Used by Golden Grail powered effect. Duration: turn.
export const EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL = "golden_grail_draw_on_heal" as const;

// === LearningDiscountModifier ===
// Enables a one-time discounted AA purchase from the regular offer.
// Created by the Learning advanced action card.
// Basic: pay 6 influence, AA goes to discard pile.
// Powered: pay 9 influence, AA goes to hand.
// Consumed on first use. Does not require being at a site.
export const EFFECT_LEARNING_DISCOUNT = "learning_discount" as const;

// === ShapeshiftActiveModifier ===
// Marks that Braevalar's Shapeshift skill is active for a specific card.
// When the targeted card is played, its effect is transformed:
// Move ↔ Attack ↔ Block (preserving elemental types and amounts).
// Consumed when the targeted card is played.
export const EFFECT_SHAPESHIFT_ACTIVE = "shapeshift_active" as const;

// === BowPhaseFameTrackingModifier ===
// Grants fame per enemy defeated in the current combat phase (not the whole turn).
// Applied by Bow of Starsdawn basic effect. Consumed after the phase in which it was applied.
export const EFFECT_BOW_PHASE_FAME_TRACKING = "bow_phase_fame_tracking" as const;

// === BowAttackTransformationModifier ===
// Ranged attacks can be doubled OR converted to Siege of same element.
// Siege attacks can be doubled but become Ranged of same element.
// Applies to all sources (cards, units, skills). Does NOT apply in Attack Phase.
// Applied by Bow of Starsdawn powered effect. Duration: turn.
export const EFFECT_BOW_ATTACK_TRANSFORMATION = "bow_attack_transformation" as const;

// === ShapeshiftActiveModifier target effect types ===
export const SHAPESHIFT_TARGET_MOVE = "move" as const;
export const SHAPESHIFT_TARGET_ATTACK = "attack" as const;
export const SHAPESHIFT_TARGET_BLOCK = "block" as const;

// === GrantEnemyAbilityModifier ===
// Grants an ability (e.g., Cumbersome) to an enemy for a duration.
// Used by Nature's Vengeance skill.
export const EFFECT_GRANT_ENEMY_ABILITY = "grant_enemy_ability" as const;

// === NaturesVengeanceAttackBonusModifier ===
// Grants +1 attack to all enemies during Block phase ONLY for other players.
// Owner of Nature's Vengeance is exempt (S1).
// Used when Nature's Vengeance token is in the center.
export const EFFECT_NATURES_VENGEANCE_ATTACK_BONUS = "natures_vengeance_attack_bonus" as const;

// === SoulHarvesterCrystalTrackingModifier ===
// Tracks crystal rewards from Soul Harvester when enemies are defeated.
// Basic: gain 1 crystal from first enemy defeated (by this attack).
// Powered: gain 1 crystal per enemy defeated in current combat phase.
// Crystal color options based on defeated enemy's resistances:
//   Fire Resistance → Red, Ice Resistance → Blue, Physical Resistance → Green, always White.
export const EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING = "soul_harvester_crystal_tracking" as const;

// === DodgeAndWeaveAttackBonusModifier ===
// Grants physical attack in Attack phase if no wounds were added to hero's hand this combat.
// The condition is evaluated when transitioning to Attack phase.
// Duration: combat. Applied by Dodge and Weave card.
export const EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS = "dodge_and_weave_attack_bonus" as const;

// === ShieldBashArmorReductionModifier ===
// When active, a successful block applies armor reduction to the blocked enemy.
// Armor reduction = excess undoubled block points (block used minus block needed).
// Ice Resistant enemies are immune to the armor reduction (blue card = ice element).
// Summoner enemies cannot have their armor reduced via their summoned monster.
// Duration: combat. Applied by Shield Bash powered effect.
export const EFFECT_SHIELD_BASH_ARMOR_REDUCTION = "shield_bash_armor_reduction" as const;

// === RemoveIceResistanceModifier ===
// Removes ice resistance from enemies (Know Your Prey)
// Does not affect Arcane Immune enemies
export const EFFECT_REMOVE_ICE_RESISTANCE = "remove_ice_resistance" as const;

// === ConvertAttackElementModifier ===
// Converts an enemy's attack element for the rest of combat.
// Fire/Ice → Physical, or one element of Cold Fire → Fire/Ice.
// Applied per-enemy by Know Your Prey skill.
export const EFFECT_CONVERT_ATTACK_ELEMENT = "convert_attack_element" as const;

// === DuelingTargetModifier ===
// Tracks which enemy was targeted by Wolfhawk's Dueling skill in Block phase.
// Used to grant Attack 1 vs the same enemy in Attack phase.
// Also tracks whether any unit was involved with this enemy (for Fame +1 bonus).
// Duration: combat. Applied by Dueling skill activation.
export const EFFECT_DUELING_TARGET = "dueling_target" as const;

// === RushOfAdrenalineActiveModifier ===
// When active, taking wounds to hand triggers card draws.
// Basic: draw 1 card per wound (up to 3 total). Retroactive for wounds already taken.
// Powered: throw away first wound + draw 1, then draw 1 per wound (up to 3 more).
// Duration: turn. Applied by Rush of Adrenaline card.
export const EFFECT_RUSH_OF_ADRENALINE_ACTIVE = "rush_of_adrenaline_active" as const;
