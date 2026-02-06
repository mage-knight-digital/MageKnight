/**
 * Modifier system types for Mage Knight
 *
 * Skills, cards, and units can modify game rules and values for various durations.
 * This system tracks active modifiers and allows calculations to query effective values.
 */

import type { SkillId, CardId, Terrain, ManaColor, ResistanceType, HexCoord } from "@mage-knight/shared";
import type { EnemyAbility } from "./enemy.js";
import type { DeedCardType } from "./cards.js";
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
  EFFECT_COMBAT_VALUE,
  EFFECT_DOUBLE_PHYSICAL_ATTACKS,
  EFFECT_ENDLESS_MANA,
  EFFECT_ENEMY_SKIP_ATTACK,
  EFFECT_GRANT_RESISTANCES,
  EFFECT_TERRAIN_PROHIBITION,
  EFFECT_ENEMY_STAT,
  EFFECT_RECRUIT_DISCOUNT,
  EFFECT_REMOVE_PHYSICAL_RESISTANCE,
  EFFECT_REMOVE_RESISTANCES,
  EFFECT_COLD_TOUGHNESS_BLOCK,
  EFFECT_MOVEMENT_CARD_BONUS,
  EFFECT_MOVE_TO_ATTACK_CONVERSION,
  EFFECT_RULE_OVERRIDE,
  EFFECT_SCOUT_FAME_BONUS,
  EFFECT_SIDEWAYS_VALUE,
  EFFECT_TERRAIN_COST,
  EFFECT_TERRAIN_SAFE,
  EFFECT_UNIT_ATTACK_BONUS,
  EFFECT_DISEASE_ARMOR,
  EFFECT_CURE_ACTIVE,
  EFFECT_TRANSFORM_ATTACKS_COLD_FIRE,
  EFFECT_ADD_SIEGE_TO_ATTACKS,
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
  RULE_GOLD_AS_BLACK,
  RULE_IGNORE_FORTIFICATION,
  RULE_IGNORE_RAMPAGING_PROVOKE,
  RULE_MOVE_CARDS_IN_COMBAT,
  RULE_SOURCE_BLOCKED,
  RULE_TERRAIN_DAY_NIGHT_SWAP,
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
  readonly perResistance?: boolean; // Resistance Break: -1 per resistance
  readonly fortifiedAmount?: number; // Earthquake: alternative amount if target is fortified
  readonly excludeResistance?: ResistanceType; // Demolish: skip enemies with this resistance
}

// Rule override modifier (e.g., "ignore fortification")
export interface RuleOverrideModifier {
  readonly type: typeof EFFECT_RULE_OVERRIDE;
  readonly rule:
    | typeof RULE_IGNORE_FORTIFICATION
    | typeof RULE_IGNORE_RAMPAGING_PROVOKE
    | typeof RULE_WOUNDS_PLAYABLE_SIDEWAYS
    | typeof RULE_GOLD_AS_BLACK
    | typeof RULE_BLACK_AS_GOLD
    | typeof RULE_BLACK_AS_ANY_COLOR
    | typeof RULE_TERRAIN_DAY_NIGHT_SWAP
    | typeof RULE_SOURCE_BLOCKED
    | typeof RULE_EXTRA_SOURCE_DIE
    | typeof RULE_MOVE_CARDS_IN_COMBAT
    | typeof RULE_EXTENDED_EXPLORE;
}

// Ability nullifier (e.g., "ignore Swift on one enemy")
export interface AbilityNullifierModifier {
  readonly type: typeof EFFECT_ABILITY_NULLIFIER;
  readonly ability: EnemyAbility["type"] | typeof ABILITY_ANY;
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
  | ColdToughnessBlockModifier
  | RecruitDiscountModifier
  | MoveToAttackConversionModifier
  | ScoutFameBonusModifier
  | UnitAttackBonusModifier
  | DiseaseArmorModifier
  | CureActiveModifier
  | TransformAttacksColdFireModifier
  | AddSiegeToAttacksModifier;

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
