/**
 * Modifier system types for Mage Knight
 *
 * Skills, cards, and units can modify game rules and values for various durations.
 * This system tracks active modifiers and allows calculations to query effective values.
 */

import type { SkillId, CardId, Terrain, ManaColor, BasicManaColor, ResistanceType, HexCoord, Element, EnemyAbilityType } from "@mage-knight/shared";
import type { EnemyAbility } from "./enemy.js";
import type { DeedCardType } from "./cards.js";
import type { SourceDieId } from "./mana.js";
import type { CombatType } from "./effectTypes.js";
import {
  ABILITY_ANY,
  COMBAT_VALUE_ATTACK,
  COMBAT_VALUE_BLOCK,
  COMBAT_VALUE_RANGED,
  COMBAT_VALUE_SIEGE,
  DURATION_COMBAT,
  DURATION_PERMANENT,
  DURATION_ROUND,
  DURATION_TURN,
  DURATION_UNTIL_NEXT_TURN,
  EFFECT_ABILITY_NULLIFIER,
  EFFECT_ATTACK_BLOCK_CARD_BONUS,
  EFFECT_COMBAT_VALUE,
  EFFECT_DOUBLE_PHYSICAL_ATTACKS,
  EFFECT_ENDLESS_MANA,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_GRANT_RESISTANCES,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_ENEMY_STAT,
  EFFECT_RECRUIT_DISCOUNT,
  EFFECT_RECRUITMENT_BONUS,
  EFFECT_REMOVE_FIRE_RESISTANCE,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  EFFECT_REMOVE_RESISTANCES,
  EFFECT_COLD_TOUGHNESS_BLOCK,
  EFFECT_MOVEMENT_CARD_BONUS,
  EFFECT_MOVE_TO_ATTACK_CONVERSION,
  EFFECT_INFLUENCE_TO_BLOCK_CONVERSION,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SCOUT_FAME_BONUS,
  EFFECT_SIDEWAYS_VALUE,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_SAFE,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_UNIT_ARMOR_BONUS,
  EFFECT_UNIT_BLOCK_BONUS,
  EFFECT_BANNER_GLORY_FAME_TRACKING,
  EFFECT_DISEASE_ARMOR,
  EFFECT_CURE_ACTIVE,
  EFFECT_TRANSFORM_ATTACKS_COLD_FIRE,
  EFFECT_ADD_SIEGE_TO_ATTACKS,
  EFFECT_BURNING_SHIELD_ACTIVE,
  EFFECT_INTERACTION_BONUS,
  EFFECT_MANA_CLAIM_SUSTAINED,
  EFFECT_DEFEAT_IF_BLOCKED,
  EFFECT_MANA_CURSE,
  EFFECT_UNIT_COMBAT_BONUS,
  EFFECT_LEADERSHIP_BONUS,
  EFFECT_POSSESS_ATTACK_RESTRICTION,
  EFFECT_HERO_DAMAGE_REDUCTION,
  EFFECT_MOUNTAIN_LORE_HAND_LIMIT,
  EFFECT_EXPLORE_COST_REDUCTION,
  EFFECT_GOLDEN_GRAIL_FAME_TRACKING,
  EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL,
  EFFECT_LEARNING_DISCOUNT,
  EFFECT_SHAPESHIFT_ACTIVE,
  EFFECT_GRANT_ENEMY_ABILITY,
  EFFECT_NATURES_VENGEANCE_ATTACK_BONUS,
  EFFECT_BOW_PHASE_FAME_TRACKING,
  EFFECT_BOW_ATTACK_TRANSFORMATION,
  EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
  EFFECT_SHIELD_BASH_ARMOR_REDUCTION,
  EFFECT_REMOVE_ICE_RESISTANCE,
  EFFECT_CONVERT_ATTACK_ELEMENT,
  EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS,
  EFFECT_DUELING_TARGET,
  EFFECT_RUSH_OF_ADRENALINE_ACTIVE,
  SHAPESHIFT_TARGET_MOVE,
  SHAPESHIFT_TARGET_ATTACK,
  SHAPESHIFT_TARGET_BLOCK,
  LEADERSHIP_BONUS_BLOCK,
  LEADERSHIP_BONUS_ATTACK,
  LEADERSHIP_BONUS_RANGED_ATTACK,
  ELEMENT_COLD_FIRE,
  ELEMENT_FIRE,
  ELEMENT_ICE,
  ELEMENT_PHYSICAL,
  ENEMY_STAT_ARMOR,
  ENEMY_STAT_ATTACK,
  RULE_BLACK_AS_ANY_COLOR,
  RULE_BLACK_AS_GOLD,
  RULE_EXTENDED_EXPLORE,
  RULE_EXTRA_SOURCE_DIE,
  RULE_GOLD_AS_ANY_COLOR,
  RULE_SPACE_BENDING_ADJACENCY,
  RULE_TIME_BENDING_ACTIVE,
  RULE_GOLD_AS_BLACK,
  RULE_IGNORE_FORTIFICATION,
  RULE_IGNORE_REPUTATION,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_MOVE_CARDS_IN_COMBAT,
  RULE_INFLUENCE_CARDS_IN_COMBAT,
  RULE_NO_EXPLORATION,
  RULE_ALLOW_GOLD_AT_NIGHT,
  RULE_ALLOW_BLACK_AT_DAY,
  RULE_GARRISON_REVEAL_DISTANCE_2,
  RULE_SOURCE_BLOCKED,
  RULE_TERRAIN_DAY_NIGHT_SWAP,
  RULE_UNITS_CANNOT_ABSORB_DAMAGE,
  RULE_WOUNDS_PLAYABLE_SIDEWAYS,
  SCOPE_ALL_ENEMIES,
  SCOPE_ALL_PLAYERS,
  SCOPE_ALL_UNITS,
  SCOPE_ONE_ENEMY,
  SCOPE_ONE_UNIT,
  SCOPE_OTHER_PLAYERS,
  SCOPE_SELF,
  SIDEWAYS_CONDITION_NO_MANA_USED,
  SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR,
  SOURCE_CARD,
  SOURCE_SITE,
  SOURCE_SKILL,
  SOURCE_TACTIC,
  SOURCE_UNIT,
  TERRAIN_ALL,
} from "./modifierConstants.js";

// === Duration and Scope ===

export type ModifierDuration =
  | typeof DURATION_TURN // expires at end of current player's turn
  | typeof DURATION_COMBAT // expires when combat ends
  | typeof DURATION_ROUND // expires at end of round
  | typeof DURATION_UNTIL_NEXT_TURN // expires at START of the source player's next turn (interactive skills)
  | typeof DURATION_PERMANENT; // never expires automatically

export type ModifierScope =
  | { readonly type: typeof SCOPE_SELF }
  | { readonly type: typeof SCOPE_ONE_ENEMY; readonly enemyId: string }
  | { readonly type: typeof SCOPE_ALL_ENEMIES }
  | { readonly type: typeof SCOPE_ONE_UNIT; readonly unitIndex: number }
  | { readonly type: typeof SCOPE_ALL_UNITS }
  | { readonly type: typeof SCOPE_OTHER_PLAYERS }
  | { readonly type: typeof SCOPE_ALL_PLAYERS };

// === Modifier Source ===

export type ModifierSource =
  | { readonly type: typeof SOURCE_SKILL; readonly skillId: SkillId; readonly playerId: string }
  | { readonly type: typeof SOURCE_CARD; readonly cardId: CardId; readonly playerId: string }
  | { readonly type: typeof SOURCE_UNIT; readonly unitIndex: number; readonly playerId: string }
  | { readonly type: typeof SOURCE_SITE; readonly siteType: string }
  | { readonly type: typeof SOURCE_TACTIC; readonly tacticId: string; readonly playerId: string };

// === Modifier Effects ===

// Terrain cost modifier (e.g., "forest costs 1 less")
export interface TerrainCostModifier {
  readonly type: typeof EFFECT_TERRAIN_COST;
  readonly terrain: Terrain | typeof TERRAIN_ALL;
  readonly amount: number; // negative = reduction (ignored if replaceCost is set)
  readonly minimum: number; // usually 0 or 2
  /**
   * If set, replaces the base cost entirely instead of modifying it.
   * Used by Mist Form spell which sets all terrain costs to exactly 2.
   * When replaceCost is set, amount is ignored and minimum is applied after.
   */
  readonly replaceCost?: number;
  /**
   * If set, modifier only applies to this specific coordinate.
   * Used by Druidic Paths to reduce cost of a specific hex rather than all hexes of a terrain type.
   */
  readonly specificCoordinate?: HexCoord;
}

// Terrain safe modifier (e.g., "mountains are safe spaces for you")
export interface TerrainSafeModifier {
  readonly type: typeof EFFECT_TERRAIN_SAFE;
  readonly terrain: Terrain | typeof TERRAIN_ALL;
}

// Sideways card value modifier (e.g., "+2 instead of +1")
export interface SidewaysValueModifier {
  readonly type: typeof EFFECT_SIDEWAYS_VALUE;
  readonly newValue: number; // typically 2, 3, or 4
  readonly forWounds: boolean; // Power of Pain allows wounds
  readonly condition?:
    | typeof SIDEWAYS_CONDITION_NO_MANA_USED
    | typeof SIDEWAYS_CONDITION_WITH_MANA_MATCHING_COLOR;
  readonly forCardTypes?: readonly DeedCardType[];
  /** Mana color spent for this modifier (Universal Power: used for color matching) */
  readonly manaColor?: BasicManaColor;
}

// Movement card bonus modifier (e.g., "next movement card gets +1")
export interface MovementCardBonusModifier {
  readonly type: typeof EFFECT_MOVEMENT_CARD_BONUS;
  readonly amount: number;
  /** If set, decrements each time a movement card bonus is applied */
  readonly remaining?: number;
}

// Combat value modifier (e.g., "+2 Attack")
export interface CombatValueModifier {
  readonly type: typeof EFFECT_COMBAT_VALUE;
  readonly valueType:
    | typeof COMBAT_VALUE_ATTACK
    | typeof COMBAT_VALUE_BLOCK
    | typeof COMBAT_VALUE_RANGED
    | typeof COMBAT_VALUE_SIEGE;
  readonly element?:
    | typeof ELEMENT_FIRE
    | typeof ELEMENT_ICE
    | typeof ELEMENT_COLD_FIRE
    | typeof ELEMENT_PHYSICAL;
  readonly amount: number;
}

// Enemy stat modifier (e.g., "enemy gets -1 Armor")
export interface EnemyStatModifier {
  readonly type: typeof EFFECT_ENEMY_STAT;
  readonly stat: typeof ENEMY_STAT_ARMOR | typeof ENEMY_STAT_ATTACK;
  readonly amount: number;
  readonly minimum: number; // usually 1
  /**
   * For multi-attack enemies, optionally apply this attack modifier to only
   * a single attack index (0-based). Ignored for armor modifiers.
   *
   * If omitted, applies to all attacks (legacy behavior).
   */
  readonly attackIndex?: number;
  readonly perResistance?: boolean; // Resistance Break: -1 per resistance
  readonly fortifiedAmount?: number; // Earthquake: alternative amount if target is fortified
  readonly excludeResistance?: ResistanceType; // Demolish: skip enemies with this resistance
  readonly onlyIfEnemyAttacks?: boolean; // Taunt: armor reduction only if enemy actually attacks
}

// Rule override modifier (e.g., "ignore fortification")
export interface RuleOverrideModifier {
  readonly type: typeof EFFECT_RULE_OVERRIDE;
  readonly rule:
    | typeof RULE_IGNORE_FORTIFICATION
    | typeof RULE_IGNORE_REPUTATION
    | typeof RULE_IGNORE_RAMPAGING_PROVOKE
    | typeof RULE_WOUNDS_PLAYABLE_SIDEWAYS
    | typeof RULE_GOLD_AS_BLACK
    | typeof RULE_BLACK_AS_GOLD
    | typeof RULE_BLACK_AS_ANY_COLOR
    | typeof RULE_GOLD_AS_ANY_COLOR
    | typeof RULE_TERRAIN_DAY_NIGHT_SWAP
    | typeof RULE_SOURCE_BLOCKED
    | typeof RULE_EXTRA_SOURCE_DIE
    | typeof RULE_MOVE_CARDS_IN_COMBAT
    | typeof RULE_INFLUENCE_CARDS_IN_COMBAT
    | typeof RULE_EXTENDED_EXPLORE
    | typeof RULE_UNITS_CANNOT_ABSORB_DAMAGE
    | typeof RULE_SPACE_BENDING_ADJACENCY
    | typeof RULE_TIME_BENDING_ACTIVE
    | typeof RULE_NO_EXPLORATION
    | typeof RULE_ALLOW_GOLD_AT_NIGHT
    | typeof RULE_ALLOW_BLACK_AT_DAY
    | typeof RULE_GARRISON_REVEAL_DISTANCE_2;
}

// Ability nullifier (e.g., "ignore Swift on one enemy")
export interface AbilityNullifierModifier {
  readonly type: typeof EFFECT_ABILITY_NULLIFIER;
  readonly ability: EnemyAbility["type"] | typeof ABILITY_ANY;
  /**
   * If true, this nullifier can affect Arcane Immune enemies.
   * Use sparingly for effects that explicitly bypass Arcane Immunity.
   */
  readonly ignoreArcaneImmunity?: boolean;
}

// Enemy skip attack modifier (e.g., "enemy does not attack this combat")
// Used by Chill, Whirlwind spells
export interface EnemySkipAttackModifier {
  readonly type: typeof EFFECT_ENEMY_SKIP_ATTACK;
}

// Enemy remove resistances modifier (e.g., "enemy loses all resistances")
// Used by Expose spell
export interface EnemyRemoveResistancesModifier {
  readonly type: typeof EFFECT_REMOVE_RESISTANCES;
}

// Endless mana supply modifier (e.g., "endless supply of red and black mana this turn")
// Used by Ring artifacts
// Note: Black mana restrictions (day/night) still apply even with endless supply
export interface EndlessManaModifier {
  readonly type: typeof EFFECT_ENDLESS_MANA;
  readonly colors: readonly ManaColor[];
}

// Terrain prohibition modifier (e.g., "cannot enter hills or mountains")
// Used by Mist Form spell - makes specific terrains impassable for duration
export interface TerrainProhibitionModifier {
  readonly type: typeof EFFECT_TERRAIN_PROHIBITION;
  readonly prohibitedTerrains: readonly Terrain[];
}

// Grant resistances modifier (e.g., "all units gain all resistances")
// Used by Veil of Mist spell - grants resistances to units for duration
export interface GrantResistancesModifier {
  readonly type: typeof EFFECT_GRANT_RESISTANCES;
  readonly resistances: readonly ResistanceType[];
}

// Double physical attacks modifier (Sword of Justice powered)
// Doubles the physical attack contribution during Attack Phase only
// Applied LAST after all other bonuses
export interface DoublePhysicalAttacksModifier {
  readonly type: typeof EFFECT_DOUBLE_PHYSICAL_ATTACKS;
}

// Remove physical resistance from enemies (Sword of Justice powered)
// Unlike EFFECT_REMOVE_RESISTANCES which removes ALL resistances,
// this only removes physical resistance.
// Does not affect Arcane Immune enemies.
export interface RemovePhysicalResistanceModifier {
  readonly type: typeof EFFECT_REMOVE_PHYSICAL_RESISTANCE;
}

// Remove fire resistance from enemies (Chill spell)
// Unlike EFFECT_REMOVE_RESISTANCES which removes ALL resistances,
// this only removes fire resistance.
// Does not affect Arcane Immune enemies.
export interface RemoveFireResistanceModifier {
  readonly type: typeof EFFECT_REMOVE_FIRE_RESISTANCE;
}

// Cold Toughness scaling block modifier (Tovak)
// Grants +1 ice block per ability/attack color/resistance on blocked enemy.
// Arcane Immunity on the enemy negates the bonus entirely.
export interface ColdToughnessBlockModifier {
  readonly type: typeof EFFECT_COLD_TOUGHNESS_BLOCK;
}

// Recruit discount modifier (Ruthless Coercion basic effect)
// Grants a discount toward recruiting one unit this turn.
// If the discounted unit is actually recruited, reputation changes.
// The modifier is consumed (removed) when the discount is applied.
export interface RecruitDiscountModifier {
  readonly type: typeof EFFECT_RECRUIT_DISCOUNT;
  readonly discount: number; // Amount of influence discount (e.g., 2)
  readonly reputationChange: number; // Rep change if discount used (e.g., -1)
}

// Move-to-attack conversion modifier (Agility card)
// Allows converting accumulated move points to attack during combat.
// Basic Agility: 1 move = 1 melee attack
// Powered Agility: 1 move = 1 melee attack OR 2 move = 1 ranged attack
export interface MoveToAttackConversionModifier {
  readonly type: typeof EFFECT_MOVE_TO_ATTACK_CONVERSION;
  /** Move points required per attack point */
  readonly costPerPoint: number;
  /** Type of attack gained from conversion */
  readonly attackType: typeof COMBAT_VALUE_ATTACK | typeof COMBAT_VALUE_RANGED;
}

// Influence-to-block conversion modifier (Diplomacy card)
// Allows converting accumulated influence points to block during combat.
// Basic Diplomacy: 1 influence = 1 physical block
// Powered Diplomacy: 1 influence = 1 ice or 1 fire block (chosen at play time)
export interface InfluenceToBlockConversionModifier {
  readonly type: typeof EFFECT_INFLUENCE_TO_BLOCK_CONVERSION;
  /** Influence points required per block point */
  readonly costPerPoint: number;
  /** Element of the block gained (undefined = physical) */
  readonly element?: typeof ELEMENT_FIRE | typeof ELEMENT_ICE;
}

// Scout fame bonus modifier (Scouts unit ability)
// Tracks enemies revealed by the Scout peek ability.
// When any of these enemies are defeated, grants +1 fame per enemy.
export interface ScoutFameBonusModifier {
  readonly type: typeof EFFECT_SCOUT_FAME_BONUS;
  readonly revealedEnemyIds: readonly string[];
  readonly fame: number; // Fame per revealed enemy defeated (typically 1)
}

// Unit attack bonus modifier (Shocktroops Coordinated Fire)
// Grants +N to all attacks (melee, ranged, siege) for targeted units.
// Typically scoped to SCOPE_OTHER_UNITS to exclude the activating unit.
export interface UnitAttackBonusModifier {
  readonly type: typeof EFFECT_UNIT_ATTACK_BONUS;
  readonly amount: number; // +1 per Shocktroops activation
}

// Disease armor modifier (Disease powered effect)
// Sets enemy armor to a fixed value. Applied to fully-blocked enemies.
// Unlike EnemyStatModifier which adds/subtracts, this sets the armor absolutely.
export interface DiseaseArmorModifier {
  readonly type: typeof EFFECT_DISEASE_ARMOR;
  readonly setTo: number; // Armor is set to this value (typically 1)
}

// Cure active modifier (Cure basic effect)
// When active, future healing from hand also draws cards,
// and future unit healing also readies the healed unit.
export interface CureActiveModifier {
  readonly type: typeof EFFECT_CURE_ACTIVE;
}

// Transform attacks to Cold Fire modifier (Altem Mages black mana ability option 1)
// All attacks played by this player become Cold Fire element for the rest of combat.
// Applied at accumulation time: new attacks are stored as Cold Fire regardless of original element.
export interface TransformAttacksColdFireModifier {
  readonly type: typeof EFFECT_TRANSFORM_ATTACKS_COLD_FIRE;
}

// Add Siege to attacks modifier (Altem Mages black mana ability option 2)
// All attacks played by this player also count as Siege for the rest of combat.
// Applied at accumulation time: melee/ranged attacks are duplicated into siege pool.
export interface AddSiegeToAttacksModifier {
  readonly type: typeof EFFECT_ADD_SIEGE_TO_ATTACKS;
}

// Burning Shield active modifier (Burning Shield / Exploding Shield spell)
// Tracks that the spell is active during this combat's Block phase.
// On first successful block, triggers a bonus based on mode:
// - "attack": grants Fire Attack 4 in Attack phase
// - "destroy": destroys the blocked enemy (respects Fire/Arcane resistances, no fame for summoned)
export interface BurningShieldActiveModifier {
  readonly type: typeof EFFECT_BURNING_SHIELD_ACTIVE;
  readonly mode: "attack" | "destroy";
  readonly blockValue: number; // The block value (4 for both basic and powered)
  readonly attackValue: number; // Fire Attack value if mode is "attack" (4)
}

// Unit recruitment bonus modifier (Heroic Tale)
// Grants reputation and/or fame each time a unit is recruited this turn.
// Unlike RecruitDiscountModifier, this is NOT consumed — it triggers on every recruitment.
export interface UnitRecruitmentBonusModifier {
  readonly type: typeof EFFECT_RECRUITMENT_BONUS;
  readonly reputationPerRecruit: number; // Reputation gained per recruitment (e.g., 1)
  readonly famePerRecruit: number; // Fame gained per recruitment (e.g., 0 for basic, 1 for powered)
}

// Interaction bonus modifier (Noble Manners)
// Grants fame and/or reputation on the first interaction (recruit, heal, buy spell).
// Consumed after first interaction — only triggers once per card play.
export interface InteractionBonusModifier {
  readonly type: typeof EFFECT_INTERACTION_BONUS;
  readonly fame: number;
  readonly reputation: number;
}

// Mana Claim sustained token modifier (Mana Claim sustained mode)
// Grants 1 mana token of the claimed color at the start of each subsequent turn.
// Duration: round. The claimed die ID is tracked so it can be returned at round end.
export interface ManaClaimSustainedModifier {
  readonly type: typeof EFFECT_MANA_CLAIM_SUSTAINED;
  readonly color: BasicManaColor;
  readonly claimedDieId: SourceDieId;
}

// Unit combat bonus modifier (Into the Heat card)
// Grants +N to all attacks AND +N to all blocks for units.
// Only applies to units whose base ability value > 0.
// Scoped to ALL_UNITS. Duration: combat.
export interface UnitCombatBonusModifier {
  readonly type: typeof EFFECT_UNIT_COMBAT_BONUS;
  readonly attackBonus: number;
  readonly blockBonus: number;
}

// Mana Curse modifier (Mana Curse powered effect)
// When another player uses mana of the cursed color, they take a wound.
// Max 1 wound per player per turn from this curse.
// Tracks which players have already been wounded this turn.
export interface ManaCurseModifier {
  readonly type: typeof EFFECT_MANA_CURSE;
  readonly color: BasicManaColor;
  readonly claimedDieId: SourceDieId;
  readonly woundedPlayerIdsThisTurn: readonly string[];
}

// Defeat if blocked modifier (Delphana Masters red mana ability)
// Enemy is defeated if fully blocked during Block phase.
// For multi-attack enemies, ALL attacks must be blocked.
export interface DefeatIfBlockedModifier {
  readonly type: typeof EFFECT_DEFEAT_IF_BLOCKED;
}

// Leadership bonus modifier (Norowas' Leadership skill)
// Grants a one-time bonus to the next unit activation.
// The bonus type determines which ability it applies to (block, attack, or ranged).
// In Attack Phase, attack bonus applies to siege units too (FAQ S2).
// Consumed (removed) when a matching unit ability is activated.
export type LeadershipBonusType =
  | typeof LEADERSHIP_BONUS_BLOCK
  | typeof LEADERSHIP_BONUS_ATTACK
  | typeof LEADERSHIP_BONUS_RANGED_ATTACK;

export interface LeadershipBonusModifier {
  readonly type: typeof EFFECT_LEADERSHIP_BONUS;
  readonly bonusType: LeadershipBonusType;
  readonly amount: number;
}

// Unit armor bonus modifier (Banner of Glory powered)
// Grants +N armor to all units for the duration.
export interface UnitArmorBonusModifier {
  readonly type: typeof EFFECT_UNIT_ARMOR_BONUS;
  readonly amount: number;
}

// Unit block bonus modifier (Banner of Glory powered)
// Grants +N to all block values for units (tack-on, requires base block).
export interface UnitBlockBonusModifier {
  readonly type: typeof EFFECT_UNIT_BLOCK_BONUS;
  readonly amount: number;
}

// Banner of Glory fame tracking modifier (Banner of Glory powered)
// Tracks which units have attacked/blocked and awards fame +1 per unit.
export interface BannerGloryFameTrackingModifier {
  readonly type: typeof EFFECT_BANNER_GLORY_FAME_TRACKING;
  readonly unitInstanceIdsAwarded: readonly string[];
}

// Possess attack restriction modifier (Charm/Possess spell)
// Tracks that the player gained attack from a possessed enemy.
// The gained attack can only target OTHER enemies, not the possessed one.
// This modifier is checked during attack assignment validation.
export interface PossessAttackRestrictionModifier {
  readonly type: typeof EFFECT_POSSESS_ATTACK_RESTRICTION;
  readonly possessedEnemyId: string;
  readonly attackAmount: number;
}

// Attack/Block card bonus modifier (Ambush card, Deadly Aim skill)
// Grants a one-time bonus to the first Attack or Block CARD played this turn.
// Whichever card type (attack or block) is played first consumes the modifier.
// Only applies to deed cards (not units or skills).
// Sideways plays for attack/block also trigger the bonus.
export interface AttackBlockCardBonusModifier {
  readonly type: typeof EFFECT_ATTACK_BLOCK_CARD_BONUS;
  readonly attackBonus: number; // +1 (basic) or +2 (powered)
  readonly blockBonus: number; // +2 (basic) or +4 (powered)
  /** If set, the attack bonus to use when in the Ranged/Siege phase instead of attackBonus.
   *  Used by Deadly Aim (+1 in Ranged/Siege, +2 in Attack phase). */
  readonly rangedSiegeAttackBonus?: number;
}

// Hero damage reduction modifier (Elemental Resistance, Battle Hardened)
// Reduces incoming damage to the hero from a single enemy attack.
// Applied AFTER Brutal doubling, BEFORE armor division.
// The reduction amount depends on the attack element:
// - Matching elements get the full reduction (e.g., Fire/Ice get 2 for Elemental Resistance)
// - Other elements get a lesser reduction (e.g., Physical/ColdFire get 1)
// Consumed after first application (single attack scope).
export interface HeroDamageReductionModifier {
  readonly type: typeof EFFECT_HERO_DAMAGE_REDUCTION;
  readonly amount: number;
  readonly elements: readonly (
    | typeof ELEMENT_FIRE
    | typeof ELEMENT_ICE
    | typeof ELEMENT_COLD_FIRE
    | typeof ELEMENT_PHYSICAL
  )[];
}

// Explore cost reduction modifier (Braevalar's Feral Allies)
// Reduces the move point cost of exploring (revealing a new tile).
// Base exploration cost is 2; this reduces it by the specified amount (min 0).
export interface ExploreCostReductionModifier {
  readonly type: typeof EFFECT_EXPLORE_COST_REDUCTION;
  readonly amount: number; // negative = reduction (e.g., -1)
}

// Golden Grail fame tracking modifier (Golden Grail basic effect)
// Awards Fame +1 per healing point from the Grail that is spent healing wounds from hand.
// Stores remaining healing amount from the Grail; decremented as wounds are healed.
export interface GoldenGrailFameTrackingModifier {
  readonly type: typeof EFFECT_GOLDEN_GRAIL_FAME_TRACKING;
  readonly remainingHealingPoints: number;
}

// Golden Grail draw-on-heal modifier (Golden Grail powered effect)
// When active, every time a wound is healed from hand, draw 1 card.
// Duration: turn. Not consumed — triggers on every hand wound healed.
export interface GoldenGrailDrawOnHealModifier {
  readonly type: typeof EFFECT_GOLDEN_GRAIL_DRAW_ON_HEAL;
}

// Learning discount modifier (Learning advanced action card)
// Enables a one-time discounted AA purchase from the regular offer.
// Basic: pay 6 influence, AA goes to discard pile.
// Powered: pay 9 influence, AA goes to hand.
// Consumed on first use. Does not require being at a site.
export interface LearningDiscountModifier {
  readonly type: typeof EFFECT_LEARNING_DISCOUNT;
  readonly cost: number; // Influence cost (6 for basic, 9 for powered)
  readonly destination: "hand" | "discard"; // Where the AA goes
}

// Bow of Starsdawn phase fame tracking modifier (Bow of Starsdawn basic effect)
// Grants fame per enemy defeated in the current combat phase (not the whole turn).
// Consumed after the phase transition where it was active (only triggers once per phase).
export interface BowPhaseFameTrackingModifier {
  readonly type: typeof EFFECT_BOW_PHASE_FAME_TRACKING;
  readonly famePerEnemy: number; // Fame per enemy defeated in this phase (typically 1)
}

// Bow of Starsdawn attack transformation modifier (Bow of Starsdawn powered effect)
// For each Ranged/Siege attack during Ranged/Siege phase:
// - Ranged Attack: choice to double OR convert to Siege of same element
// - Siege Attack: can double but becomes Ranged of same element
// Applies to attacks from all sources (cards, units, skills).
// Does NOT apply during Attack Phase (all attacks are plain "Attacks" there).
export interface BowAttackTransformationModifier {
  readonly type: typeof EFFECT_BOW_ATTACK_TRANSFORMATION;
}

// Shapeshift target type
export type ShapeshiftTargetType =
  | typeof SHAPESHIFT_TARGET_MOVE
  | typeof SHAPESHIFT_TARGET_ATTACK
  | typeof SHAPESHIFT_TARGET_BLOCK;

// Shapeshift active modifier (Braevalar's Shapeshift skill)
// When active, the next play of the targeted Basic Action card transforms
// one of its Move/Attack/Block effects into the specified target type.
// Consumed when the targeted card is played.
export interface ShapeshiftActiveModifier {
  readonly type: typeof EFFECT_SHAPESHIFT_ACTIVE;
  readonly targetCardId: CardId;
  readonly targetType: ShapeshiftTargetType;
  /** Index of the effect to transform within a choice effect (if applicable) */
  readonly choiceIndex?: number;
  /** The combat type to use when converting to attack (default: melee) */
  readonly combatType?: CombatType;
  /** The element to preserve when converting between attack and block */
  readonly element?: Element;
}

// Grant enemy ability modifier (Nature's Vengeance)
// Grants an ability (e.g., Cumbersome) to a specific enemy for a duration.
// Checked by ability detection functions alongside the enemy's native abilities.
export interface GrantEnemyAbilityModifier {
  readonly type: typeof EFFECT_GRANT_ENEMY_ABILITY;
  readonly ability: EnemyAbilityType;
}

// Nature's Vengeance competitive attack bonus modifier
// When Nature's Vengeance token is in the center, other players' enemies
// get +1 attack during Block phase only (S1). Owner is exempt.
// For multi-attack enemies, each attack gets +1.
export interface NaturesVengeanceAttackBonusModifier {
  readonly type: typeof EFFECT_NATURES_VENGEANCE_ATTACK_BONUS;
  readonly amount: number; // +1 per the rules
}

// Soul Harvester crystal tracking modifier (Soul Harvester artifact)
// When enemies are defeated during the current combat phase, the player gains
// one crystal per enemy (up to limit). Crystal color options are based on the
// defeated enemy's resistances: Fire→Red, Ice→Blue, Physical→Green, always White.
// Basic mode: limit 1 (only first defeated enemy). Powered mode: unlimited.
export interface SoulHarvesterCrystalTrackingModifier {
  readonly type: typeof EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING;
  /** Maximum number of crystals to gain (1 for basic, Infinity-like large number for powered) */
  readonly limit: number;
  /** If true, only enemies defeated by this specific attack count (basic effect tracking via fame tracker) */
  readonly trackByAttack: boolean;
}

// Dodge and Weave conditional attack bonus modifier
// Applied when Dodge and Weave is played in Block phase.
// When transitioning to Attack phase, grants physical attack if no wounds
// were added to hero's hand this combat.
export interface DodgeAndWeaveAttackBonusModifier {
  readonly type: typeof EFFECT_DODGE_AND_WEAVE_ATTACK_BONUS;
  readonly amount: number; // Attack bonus (1 for basic, 2 for powered)
}

// Shield Bash armor reduction modifier (Shield Bash powered effect)
// When a block succeeds, reduces the blocked enemy's armor by the excess block points.
// Excess = total undoubled block - block needed to fully block.
// Ice Resistant enemies are immune (blue card = ice element).
// Cannot reduce Summoner armor via summoned monster.
// Not consumed — applies to every successful block while active.
export interface ShieldBashArmorReductionModifier {
  readonly type: typeof EFFECT_SHIELD_BASH_ARMOR_REDUCTION;
}

// Remove ice resistance from enemies (Know Your Prey)
// Unlike EFFECT_REMOVE_RESISTANCES which removes ALL resistances,
// this only removes ice resistance.
// Does not affect Arcane Immune enemies.
export interface RemoveIceResistanceModifier {
  readonly type: typeof EFFECT_REMOVE_ICE_RESISTANCE;
}

// Convert enemy attack element modifier (Know Your Prey)
// Fire/Ice → Physical, Cold Fire → Fire or Ice (player choice).
// Applied per-enemy. Duration: combat.
export interface ConvertAttackElementModifier {
  readonly type: typeof EFFECT_CONVERT_ATTACK_ELEMENT;
  /** The element to convert FROM (the original element being changed) */
  readonly fromElement: Element;
  /** The element to convert TO */
  readonly toElement: Element;
}

// Dueling target modifier (Wolfhawk Dueling skill)
// Tracks the enemy targeted in Block phase for the deferred Attack 1 in Attack phase.
// Also tracks whether any unit was involved with this enemy for the Fame +1 bonus.
// Scoped to SCOPE_SELF with playerId. Duration: combat.
export interface DuelingTargetModifier {
  readonly type: typeof EFFECT_DUELING_TARGET;
  /** The enemy instance ID targeted by Dueling */
  readonly enemyInstanceId: string;
  /** Whether Attack 1 has been granted in Attack phase */
  readonly attackApplied: boolean;
  /** Whether any unit was involved with this enemy (disqualifies Fame +1) */
  readonly unitInvolved: boolean;
}

// Mountain Lore end-turn hand limit modifier
// Stores terrain-dependent bonuses to apply at end of turn:
// - hillsBonus when ending turn in hills
// - mountainBonus when ending turn in mountains
export interface MountainLoreHandLimitModifier {
  readonly type: typeof EFFECT_MOUNTAIN_LORE_HAND_LIMIT;
  readonly hillsBonus: number;
  readonly mountainBonus: number;
}

// Rush of Adrenaline wound-triggered draw modifier
// Basic mode: draw 1 card per wound taken to hand (first 3 this turn). Retroactive.
// Powered mode: throw away first wound + draw 1, then draw 1 per wound (next 3).
// Tracks remaining draws and whether the first wound has been thrown (powered).
export interface RushOfAdrenalineActiveModifier {
  readonly type: typeof EFFECT_RUSH_OF_ADRENALINE_ACTIVE;
  readonly mode: "basic" | "powered";
  readonly remainingDraws: number;
  readonly thrownFirstWound: boolean;
}

// Union of all modifier effects
export type ModifierEffect =
  | TerrainCostModifier
  | TerrainSafeModifier
  | SidewaysValueModifier
  | MovementCardBonusModifier
  | CombatValueModifier
  | EnemyStatModifier
  | RuleOverrideModifier
  | AbilityNullifierModifier
  | EnemySkipAttackModifier
  | EnemyRemoveResistancesModifier
  | EndlessManaModifier
  | TerrainProhibitionModifier
  | GrantResistancesModifier
  | DoublePhysicalAttacksModifier
  | RemovePhysicalResistanceModifier
  | RemoveFireResistanceModifier
  | ColdToughnessBlockModifier
  | RecruitDiscountModifier
  | MoveToAttackConversionModifier
  | InfluenceToBlockConversionModifier
  | ScoutFameBonusModifier
  | UnitAttackBonusModifier
  | DiseaseArmorModifier
  | CureActiveModifier
  | TransformAttacksColdFireModifier
  | AddSiegeToAttacksModifier
  | BurningShieldActiveModifier
  | UnitRecruitmentBonusModifier
  | InteractionBonusModifier
  | ManaClaimSustainedModifier
  | ManaCurseModifier
  | DefeatIfBlockedModifier
  | UnitCombatBonusModifier
  | LeadershipBonusModifier
  | UnitArmorBonusModifier
  | UnitBlockBonusModifier
  | BannerGloryFameTrackingModifier
  | PossessAttackRestrictionModifier
  | AttackBlockCardBonusModifier
  | HeroDamageReductionModifier
  | ExploreCostReductionModifier
  | GoldenGrailFameTrackingModifier
  | GoldenGrailDrawOnHealModifier
  | LearningDiscountModifier
  | ShapeshiftActiveModifier
  | GrantEnemyAbilityModifier
  | NaturesVengeanceAttackBonusModifier
  | BowPhaseFameTrackingModifier
  | BowAttackTransformationModifier
  | SoulHarvesterCrystalTrackingModifier
  | ShieldBashArmorReductionModifier
  | RemoveIceResistanceModifier
  | ConvertAttackElementModifier
  | DodgeAndWeaveAttackBonusModifier
  | DuelingTargetModifier
  | MountainLoreHandLimitModifier
  | RushOfAdrenalineActiveModifier;

// === Active Modifier (live in game state) ===

export interface ActiveModifier {
  readonly id: string; // unique identifier
  readonly source: ModifierSource;
  readonly duration: ModifierDuration;
  readonly scope: ModifierScope;
  readonly effect: ModifierEffect;
  readonly createdAtRound: number;
  readonly createdByPlayerId: string;
}
