/**
 * Card definitions for Mage Knight
 */

import type {
  CardId,
  SkillId,
  ManaColor,
  BasicManaColor,
  Element,
  DiscardFilter,
  RevealTileType,
  ResistanceType,
} from "@mage-knight/shared";
import type { ModifierEffect, ModifierDuration, ModifierScope } from "./modifiers.js";
import type { CombatPhase } from "./combat.js";
import type { SourceDieId } from "./mana.js";
import {
  EFFECT_GAIN_MOVE,
  EFFECT_GAIN_INFLUENCE,
  EFFECT_GAIN_ATTACK,
  EFFECT_GAIN_BLOCK,
  EFFECT_GAIN_HEALING,
  EFFECT_GAIN_MANA,
  EFFECT_DRAW_CARDS,
  EFFECT_APPLY_MODIFIER,
  EFFECT_NOOP,
  EFFECT_COMPOUND,
  EFFECT_CHOICE,
  EFFECT_CONDITIONAL,
  EFFECT_SCALING,
  EFFECT_CHANGE_REPUTATION,
  EFFECT_GAIN_FAME,
  EFFECT_GAIN_CRYSTAL,
  EFFECT_CONVERT_MANA_TO_CRYSTAL,
  EFFECT_CRYSTALLIZE_COLOR,
  EFFECT_CARD_BOOST,
  EFFECT_RESOLVE_BOOST_TARGET,
  EFFECT_READY_UNIT,
  EFFECT_RESOLVE_READY_UNIT_TARGET,
  EFFECT_MANA_DRAW_POWERED,
  EFFECT_MANA_DRAW_PICK_DIE,
  EFFECT_MANA_DRAW_SET_COLOR,
  EFFECT_TAKE_WOUND,
  EFFECT_SELECT_COMBAT_ENEMY,
  EFFECT_RESOLVE_COMBAT_ENEMY_TARGET,
  EFFECT_HEAL_UNIT,
  EFFECT_DISCARD_CARD,
  EFFECT_DISCARD_WOUNDS,
  EFFECT_REVEAL_TILES,
  EFFECT_PAY_MANA,
  EFFECT_TERRAIN_BASED_BLOCK,
  EFFECT_PLACE_SKILL_IN_CENTER,
  EFFECT_DISCARD_COST,
  EFFECT_GRANT_WOUND_IMMUNITY,
  EFFECT_DISCARD_FOR_ATTACK,
  EFFECT_FAME_PER_ENEMY_DEFEATED,
  EFFECT_TRACK_ATTACK_DEFEAT_FAME,
  EFFECT_POLARIZE_MANA,
  EFFECT_DISCARD_FOR_CRYSTAL,
  EFFECT_APPLY_RECRUIT_DISCOUNT,
  EFFECT_READY_UNITS_FOR_INFLUENCE,
  EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE,
  EFFECT_CURE,
  EFFECT_DISEASE,
  EFFECT_SCOUT_PEEK,
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
  EFFECT_READY_ALL_UNITS,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
  EFFECT_INVOCATION_RESOLVE,
  MANA_ANY,
  type CombatType,
  type BasicCardColor,
} from "./effectTypes.js";
import type { EffectCondition } from "./conditions.js";
import type { ScalingFactor } from "./scaling.js";

// === Card Types ===
export const DEED_CARD_TYPE_BASIC_ACTION = "basic_action" as const;
export const DEED_CARD_TYPE_ADVANCED_ACTION = "advanced_action" as const;
export const DEED_CARD_TYPE_SPELL = "spell" as const;
export const DEED_CARD_TYPE_ARTIFACT = "artifact" as const;
export const DEED_CARD_TYPE_WOUND = "wound" as const;

// === Categories (symbols in top-left corner of card/skill art) ===
// These constants are shared between cards and skills.
export const CATEGORY_MOVEMENT = "movement" as const; // foot symbol
export const CATEGORY_COMBAT = "combat" as const; // crossed swords symbol
export const CATEGORY_INFLUENCE = "influence" as const; // head symbol
export const CATEGORY_HEALING = "healing" as const; // hand symbol
export const CATEGORY_SPECIAL = "special" as const; // compass/star symbol
export const CATEGORY_ACTION = "action" as const; // A symbol (counts as turn action)
export const CATEGORY_BANNER = "banner" as const; // banner/flag symbol (attachable to units)

export type Category =
  | typeof CATEGORY_MOVEMENT
  | typeof CATEGORY_COMBAT
  | typeof CATEGORY_INFLUENCE
  | typeof CATEGORY_HEALING
  | typeof CATEGORY_SPECIAL
  | typeof CATEGORY_ACTION
  | typeof CATEGORY_BANNER;

// Legacy aliases for backwards compatibility during migration
// TODO: Remove these after all card definitions are updated
/** @deprecated Use CATEGORY_MOVEMENT instead */
export const CARD_CATEGORY_MOVEMENT = CATEGORY_MOVEMENT;
/** @deprecated Use CATEGORY_COMBAT instead */
export const CARD_CATEGORY_COMBAT = CATEGORY_COMBAT;
/** @deprecated Use CATEGORY_INFLUENCE instead */
export const CARD_CATEGORY_INFLUENCE = CATEGORY_INFLUENCE;
/** @deprecated Use CATEGORY_HEALING instead */
export const CARD_CATEGORY_HEALING = CATEGORY_HEALING;
/** @deprecated Use CATEGORY_SPECIAL instead */
export const CARD_CATEGORY_SPECIAL = CATEGORY_SPECIAL;
/** @deprecated Use CATEGORY_ACTION instead */
export const CARD_CATEGORY_ACTION = CATEGORY_ACTION;
/** @deprecated Use CATEGORY_BANNER instead */
export const CARD_CATEGORY_BANNER = CATEGORY_BANNER;
/** @deprecated Use Category instead */
export type CardCategory = Category;

export type DeedCardType =
  | typeof DEED_CARD_TYPE_BASIC_ACTION
  | typeof DEED_CARD_TYPE_ADVANCED_ACTION
  | typeof DEED_CARD_TYPE_SPELL
  | typeof DEED_CARD_TYPE_ARTIFACT
  | typeof DEED_CARD_TYPE_WOUND;

export type { Element } from "@mage-knight/shared";

// === Card Effect Interfaces ===

export interface GainMoveEffect {
  readonly type: typeof EFFECT_GAIN_MOVE;
  readonly amount: number;
}

export interface GainInfluenceEffect {
  readonly type: typeof EFFECT_GAIN_INFLUENCE;
  readonly amount: number;
}

export interface GainAttackEffect {
  readonly type: typeof EFFECT_GAIN_ATTACK;
  readonly amount: number;
  readonly combatType: CombatType;
  readonly element?: Element; // undefined = physical
}

export interface GainBlockEffect {
  readonly type: typeof EFFECT_GAIN_BLOCK;
  readonly amount: number;
  readonly element?: Element; // undefined = physical
}

export interface GainHealingEffect {
  readonly type: typeof EFFECT_GAIN_HEALING;
  readonly amount: number;
}

export interface GainManaEffect {
  readonly type: typeof EFFECT_GAIN_MANA;
  readonly color: ManaColor | typeof MANA_ANY;
}

export interface DrawCardsEffect {
  readonly type: typeof EFFECT_DRAW_CARDS;
  readonly amount: number;
}

export interface NoopEffect {
  readonly type: typeof EFFECT_NOOP;
}

export interface ChangeReputationEffect {
  readonly type: typeof EFFECT_CHANGE_REPUTATION;
  readonly amount: number; // positive = gain, negative = lose
}

export interface GainFameEffect {
  readonly type: typeof EFFECT_GAIN_FAME;
  readonly amount: number;
}

export interface GainCrystalEffect {
  readonly type: typeof EFFECT_GAIN_CRYSTAL;
  readonly color: BasicManaColor; // red, blue, green, white only
}

/**
 * Convert a mana token to a crystal of the same color.
 * Player chooses which mana token to spend, gains crystal of that color.
 * Used by Crystallize basic effect.
 */
export interface ConvertManaToCrystalEffect {
  readonly type: typeof EFFECT_CONVERT_MANA_TO_CRYSTAL;
}

/**
 * Internal: Final resolution for crystallize - consume token and gain crystal.
 * Generated as dynamic choice options by ConvertManaToCrystalEffect.
 */
export interface CrystallizeColorEffect {
  readonly type: typeof EFFECT_CRYSTALLIZE_COLOR;
  readonly color: BasicManaColor;
}

/**
 * Card boost effect - play another Action card with free powered effect + bonus.
 * Used by Concentration (bonus: 2) and Will Focus (bonus: 3).
 * Triggers a choice from eligible hand cards, then resolves the target's powered effect.
 */
export interface CardBoostEffect {
  readonly type: typeof EFFECT_CARD_BOOST;
  readonly bonus: number; // +2 for Concentration, +3 for Will Focus
}

/**
 * Internal effect used during card boost resolution.
 * Generated dynamically as choice options - one per eligible card in hand.
 * When selected, moves target card to play area and resolves its boosted powered effect.
 */
export interface ResolveBoostTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_BOOST_TARGET;
  readonly targetCardId: CardId;
  readonly bonus: number;
}

/**
 * Ready a unit of a given max level.
 * Used by Rejuvenate, Song of Wind, Herbalists, etc.
 * - maxLevel 1: "Ready a level I unit"
 * - maxLevel 2: "Ready a level I or II unit"
 * - maxLevel 3: "Ready a level I, II, or III unit"
 * - maxLevel 4: "Ready any unit"
 *
 * Targets Spent units only (can't ready an already-ready unit).
 * Wound status is irrelevant - units can be readied whether wounded or not.
 */
export interface ReadyUnitEffect {
  readonly type: typeof EFFECT_READY_UNIT;
  readonly maxLevel: 1 | 2 | 3 | 4;
}

/**
 * Internal effect generated as a choice option after unit selection.
 * Applies the ready effect to the specific unit.
 */
export interface ResolveReadyUnitTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_READY_UNIT_TARGET;
  readonly unitInstanceId: string;
  /** Stored for UI display without needing state lookup */
  readonly unitName: string;
}

/**
 * Mana Draw/Mana Pull powered effect entry point.
 * Parameterized to handle both cards:
 * - Mana Draw: diceCount=1, tokensPerDie=2 (1 die, 2 tokens same color)
 * - Mana Pull: diceCount=2, tokensPerDie=1 (2 dice, 1 token each)
 *
 * Dice are returned at end of turn WITHOUT rerolling (keep chosen colors).
 */
export interface ManaDrawPoweredEffect {
  readonly type: typeof EFFECT_MANA_DRAW_POWERED;
  readonly diceCount: 1 | 2;
  readonly tokensPerDie: 1 | 2;
}

/**
 * Internal: Player has selected which die to take.
 * Triggers color selection (red, blue, green, white).
 * Tracks already-selected dice for multi-die effects like Mana Pull.
 */
export interface ManaDrawPickDieEffect {
  readonly type: typeof EFFECT_MANA_DRAW_PICK_DIE;
  readonly dieId: SourceDieId;
  /** Current color of the die (for display purposes) */
  readonly dieColor: ManaColor;
  /** Remaining dice to select after this one (for Mana Pull) */
  readonly remainingDiceToSelect: number;
  /** Tokens to grant per die */
  readonly tokensPerDie: 1 | 2;
  /** Die IDs already selected in this effect chain */
  readonly alreadySelectedDieIds: readonly SourceDieId[];
}

/**
 * Internal: Final resolution for one die - set color and gain tokens.
 * For multi-die effects, may chain to another die selection.
 */
export interface ManaDrawSetColorEffect {
  readonly type: typeof EFFECT_MANA_DRAW_SET_COLOR;
  readonly dieId: SourceDieId;
  readonly color: BasicManaColor; // red, blue, green, white only
  /** How many tokens to grant for this die */
  readonly tokensPerDie: 1 | 2;
  /** Remaining dice to select after this one (for Mana Pull) */
  readonly remainingDiceToSelect: number;
  /** Die IDs already selected in this effect chain (excluding current) */
  readonly alreadySelectedDieIds: readonly SourceDieId[];
}

/**
 * Take a wound - add wound card(s) to hand.
 * Used as a cost for powerful spell effects like Fireball and Snowstorm powered.
 * This is NOT combat damage - it bypasses armor and adds wounds directly.
 */
export interface TakeWoundEffect {
  readonly type: typeof EFFECT_TAKE_WOUND;
  readonly amount: number; // Number of wounds to take (usually 1)
}

export interface ApplyModifierEffect {
  readonly type: typeof EFFECT_APPLY_MODIFIER;
  readonly modifier: ModifierEffect;
  readonly duration: ModifierDuration;
  /** Scope for the modifier - defaults to SCOPE_SELF if not specified */
  readonly scope?: ModifierScope;
  /** Optional human-readable description for UI display */
  readonly description?: string;
}

export interface CompoundEffect {
  readonly type: typeof EFFECT_COMPOUND;
  readonly effects: readonly CardEffect[];
}

export interface ChoiceEffect {
  readonly type: typeof EFFECT_CHOICE;
  readonly options: readonly CardEffect[];
}

export interface ConditionalEffect {
  readonly type: typeof EFFECT_CONDITIONAL;
  readonly condition: EffectCondition;
  readonly thenEffect: CardEffect;
  readonly elseEffect?: CardEffect;
}

/** Base effects that can be scaled (the ones that have an amount) */
export type ScalableBaseEffect =
  | GainAttackEffect
  | GainBlockEffect
  | GainMoveEffect
  | GainInfluenceEffect;

export interface ScalingEffect {
  readonly type: typeof EFFECT_SCALING;
  readonly baseEffect: ScalableBaseEffect;
  readonly scalingFactor: ScalingFactor;
  readonly amountPerUnit: number; // e.g., +2 per enemy
  readonly minimum?: number; // Floor value (default 0)
  readonly maximum?: number; // Cap (optional)
}

// === Enemy Targeting Effects ===

/**
 * Declarative template for what happens to a targeted enemy.
 * Cleaner than nesting full CardEffect trees.
 */
export interface CombatEnemyTargetTemplate {
  /** Modifiers to apply to the target enemy */
  readonly modifiers?: readonly {
    readonly modifier: ModifierEffect;
    readonly duration: ModifierDuration;
    readonly description?: string;
  }[];
  /** If true, defeat the enemy immediately (for powered versions like Tornado) */
  readonly defeat?: boolean;
  /**
   * Optional bundled effect to resolve AFTER applying modifiers/defeat.
   * Used by Sorcerers' abilities to grant ranged attack after stripping fortification/resistances.
   * Note: The bundled effect is NOT blocked by Arcane Immunity - it always resolves.
   */
  readonly bundledEffect?: CardEffect;
  /**
   * If set, establishes a damage redirect from this enemy to the specified unit.
   * The unit instance ID is injected at resolution time by the activation command.
   * Damage from this enemy must be assigned to the specified unit first,
   * overriding Assassination. NOT blocked by Arcane Immunity (it's a defensive
   * ability on the player's side, not a magical effect targeting the enemy).
   * Used by Shocktroops' Taunt ability.
   */
  readonly setDamageRedirectFromUnit?: string;
}

/**
 * Entry effect for selecting an enemy in combat.
 * Generates dynamicChoiceOptions with one option per eligible enemy.
 * Used by Tremor, Chill, Whirlwind spells.
 */
export interface SelectCombatEnemyEffect {
  readonly type: typeof EFFECT_SELECT_COMBAT_ENEMY;
  /** Template defining what happens to the selected enemy */
  readonly template: CombatEnemyTargetTemplate;
  /** Include defeated enemies as valid targets (default: false) */
  readonly includeDefeated?: boolean;
  /** If set, effect can only be used in this combat phase (e.g., Tornado = attack only) */
  readonly requiredPhase?: CombatPhase;
  /** If true, exclude enemies that are currently fortified (after modifiers) */
  readonly excludeFortified?: boolean;
  /** If true, exclude enemies with Arcane Immunity from targeting */
  readonly excludeArcaneImmune?: boolean;
  /** If set, exclude enemies with this resistance type from targeting */
  readonly excludeResistance?: ResistanceType;
}

/**
 * Internal effect generated as a choice option after enemy selection.
 * Applies the template to the specific enemy.
 */
export interface ResolveCombatEnemyTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_COMBAT_ENEMY_TARGET;
  readonly enemyInstanceId: string;
  /** Stored for UI display without needing state lookup */
  readonly enemyName: string;
  readonly template: CombatEnemyTargetTemplate;
}

// === Skill-Related Effect Types ===

/**
 * Heal a unit - remove a wound from a unit.
 * Used by skills like First Aid and Healing.
 * If maxLevel is specified, only units up to that level can be healed.
 */
export interface HealUnitEffect {
  readonly type: typeof EFFECT_HEAL_UNIT;
  readonly maxLevel?: 1 | 2 | 3 | 4;
}

/**
 * Discard a card from hand.
 * Used by skills that require discarding as a cost or for an effect.
 * - filter: what type of cards can be discarded
 * - amount: how many cards to discard
 * - onSuccess: optional effect to resolve after discarding
 */
export interface DiscardCardEffect {
  readonly type: typeof EFFECT_DISCARD_CARD;
  readonly filter: DiscardFilter;
  readonly amount: number;
  readonly onSuccess?: CardEffect;
}

/**
 * Discard wound cards from hand (return them to the wound pile).
 * Used by skills that throw away wounds without healing effects.
 */
export interface DiscardWoundsEffect {
  readonly type: typeof EFFECT_DISCARD_WOUNDS;
  readonly count: number;
}

/**
 * Reveal tiles on the map.
 * Used by skills like Scouting and Intelligence.
 * - distance: how far from the player's position to reveal
 * - tileType: optional filter for what types of tiles/information to reveal
 */
export interface RevealTilesEffect {
  readonly type: typeof EFFECT_REVEAL_TILES;
  readonly distance: number;
  readonly tileType?: RevealTileType;
}

/**
 * Pay mana as a cost for an effect.
 * Used by skills that require mana payment to activate.
 * - colors: which mana colors are acceptable (player chooses one)
 * - amount: how many mana tokens to pay
 */
export interface PayManaCostEffect {
  readonly type: typeof EFFECT_PAY_MANA;
  readonly colors: readonly ManaColor[];
  readonly amount: number;
}

/**
 * Place an interactive skill token in the center, making it available to other players.
 */
export interface PlaceSkillInCenterEffect {
  readonly type: typeof EFFECT_PLACE_SKILL_IN_CENTER;
  readonly skillId: SkillId;
}

/**
 * Terrain-based block effect.
 * Block value equals the unmodified movement cost of the hex the player is on.
 * Element varies by time of day:
 * - Day: Fire Block
 * - Night or Underground (Dungeon/Tomb): Ice Block
 *
 * Used by Braevalar's "One with the Land" card.
 * Per FAQ S1: Dungeons and Tombs count as "night" for this effect.
 */
export interface TerrainBasedBlockEffect {
  readonly type: typeof EFFECT_TERRAIN_BASED_BLOCK;
}

/**
 * Discard from hand as a cost, then execute a follow-up effect.
 * Used by cards like Improvisation that require discarding before gaining benefit.
 *
 * Resolution:
 * 1. Create pendingDiscard state with selectable cards
 * 2. Player selects card(s) to discard via RESOLVE_DISCARD action
 * 3. Discard happens, then thenEffect resolves
 *
 * Undo from card selection undoes the entire card play.
 */
export interface DiscardCostEffect {
  readonly type: typeof EFFECT_DISCARD_COST;
  /** How many cards must be discarded (usually 1) */
  readonly count: number;
  /** If true, discarding is optional (player can skip) */
  readonly optional: boolean;
  /** Effect to resolve after discarding succeeds */
  readonly thenEffect: CardEffect;
  /** If true, the discarded card color determines which effect resolves */
  readonly colorMatters?: boolean;
  /** Per-color effects when colorMatters is true */
  readonly thenEffectByColor?: Partial<Record<BasicCardColor, CardEffect>>;
  /** If true, wounds cannot be discarded (default: true per standard rules) */
  readonly filterWounds?: boolean;
}

/**
 * Grant wound immunity to the hero for this turn.
 * Hero ignores the first wound from enemies (including Poison/Paralyze effects).
 * Used by Veil of Mist (powered) spell.
 */
export interface GrantWoundImmunityEffect {
  readonly type: typeof EFFECT_GRANT_WOUND_IMMUNITY;
}

/**
 * Discard any number of non-wound cards to gain attack.
 * Used by Sword of Justice basic effect.
 *
 * Resolution:
 * 1. Create pendingDiscardForAttack state
 * 2. Player selects 0 or more non-wound cards
 * 3. Cards discarded, attack = attackPerCard × cards discarded
 * 4. Attack added to combat accumulator
 *
 * Per FAQ Q4/A4: All attack points must combine into single attack.
 * This is implicit - all attack goes into the shared accumulator pool.
 */
export interface DiscardForAttackEffect {
  readonly type: typeof EFFECT_DISCARD_FOR_ATTACK;
  /** Attack gained per card discarded */
  readonly attackPerCard: number;
  /** Combat type for the attack (usually melee) */
  readonly combatType: CombatType;
}

/**
 * Award fame based on enemies defeated this turn.
 * Used by Sword of Justice.
 *
 * Tracks enemies defeated through the turn and awards fame at resolution.
 * Summoned enemies (e.g., from Summoner ability) don't count.
 *
 * This effect creates a modifier that tracks enemies defeated.
 * Fame is awarded when effect resolves (typically at end of combat/turn).
 */
export interface FamePerEnemyDefeatedEffect {
  readonly type: typeof EFFECT_FAME_PER_ENEMY_DEFEATED;
  /** Fame gained per qualifying enemy */
  readonly famePerEnemy: number;
  /** If true, exclude summoned enemies from count */
  readonly excludeSummoned: boolean;
}

/**
 * Track a specific attack and grant fame if it defeats at least one enemy.
 * Used by Axe Throw (powered).
 *
 * Resolution:
 * 1. Register the attack amount/type/element for tracking
 * 2. When pending damage resolves, award fame if any tracked enemy was defeated
 * 3. Tracker is removed after resolution
 */
export interface TrackAttackDefeatFameEffect {
  readonly type: typeof EFFECT_TRACK_ATTACK_DEFEAT_FAME;
  /** Attack amount to track for this effect */
  readonly amount: number;
  /** Combat type of the tracked attack */
  readonly combatType: CombatType;
  /** Optional element (defaults to physical) */
  readonly element?: Element;
  /** Fame to grant if at least one enemy is defeated by this attack */
  readonly fame: number;
  /** Optional source card ID for disambiguation */
  readonly sourceCardId?: CardId;
}

/**
 * Polarize mana - convert one mana source to its opposite color.
 * Used by Arythea's Polarization skill.
 *
 * This effect atomically:
 * 1. Removes the source mana (token, crystal, or die color change)
 * 2. Adds a converted mana token
 *
 * The sourceType determines what is being converted:
 * - "token": Remove token from pureMana by index
 * - "crystal": Decrement crystal count for source color
 * - "die": Change die color in the source (die stays in pool)
 *
 * Conversion rules by time of day:
 * - Basic colors always convert to opposite: Red↔Blue, Green↔White
 * - Day: Black → any basic color (cannot power spells)
 * - Night: Gold → Black (can power spells)
 */
export interface PolarizeManaEffect {
  readonly type: typeof EFFECT_POLARIZE_MANA;
  /** Type of mana source being converted */
  readonly sourceType: "token" | "crystal" | "die";
  /** Color of the source mana */
  readonly sourceColor: ManaColor;
  /** Color to convert to */
  readonly targetColor: ManaColor;
  /** Index in pureMana array (for tokens) */
  readonly tokenIndex?: number;
  /** Die ID (for source dice) */
  readonly dieId?: string;
  /** If true, converted mana cannot power spell stronger effects */
  readonly cannotPowerSpells: boolean;
}

/**
 * Discard a card to gain a crystal of matching color.
 * Used by Krang's Savage Harvesting card.
 *
 * Resolution:
 * - Action cards: Crystal color matches the card's frame color
 * - Artifacts: Player chooses which crystal color to gain
 * - Wounds cannot be discarded (filtered out)
 *
 * Creates pendingDiscardForCrystal state. Player selects card via
 * RESOLVE_DISCARD_FOR_CRYSTAL action. For artifacts, an additional
 * RESOLVE_ARTIFACT_CRYSTAL_COLOR action is needed to select the color.
 */
export interface DiscardForCrystalEffect {
  readonly type: typeof EFFECT_DISCARD_FOR_CRYSTAL;
  /** If true, player can skip discarding (no crystal gained) */
  readonly optional: boolean;
}

/**
 * Recruit discount effect - grants a turn-scoped modifier that discounts
 * the cost of recruiting one unit. If the discounted unit is recruited,
 * reputation changes.
 * Used by Ruthless Coercion basic effect.
 */
export interface RecruitDiscountEffect {
  readonly type: typeof EFFECT_APPLY_RECRUIT_DISCOUNT;
  readonly discount: number; // Amount of influence discount (e.g., 2)
  readonly reputationChange: number; // Rep change if discount used (e.g., -1)
}

/**
 * Ready units for influence effect - allows readying L1/L2 spent units
 * by paying influence per level of unit.
 * Used by Ruthless Coercion powered effect.
 *
 * Resolution:
 * 1. Find eligible spent units at level 1-2
 * 2. Present choices: one per eligible unit + "Done" option
 * 3. On selection: deduct influence, ready unit, re-present remaining choices
 * 4. On "Done": complete resolution
 */
export interface ReadyUnitsForInfluenceEffect {
  readonly type: typeof EFFECT_READY_UNITS_FOR_INFLUENCE;
  readonly maxLevel: 1 | 2 | 3 | 4;
  readonly costPerLevel: number; // Influence cost per unit level (e.g., 2)
}

/**
 * Internal effect generated as a choice option for influence-paid readying.
 * Deducts influence and readies the specific unit, then chains back
 * to present remaining eligible units.
 */
export interface ResolveReadyUnitForInfluenceEffect {
  readonly type: typeof EFFECT_RESOLVE_READY_UNIT_FOR_INFLUENCE;
  readonly unitInstanceId: string;
  readonly unitName: string;
  readonly influenceCost: number; // Total influence to deduct
  readonly maxLevel: 1 | 2 | 3 | 4;
  readonly costPerLevel: number;
}

/**
 * Ready all units controlled by the player.
 * Unlike ReadyUnitEffect, this readies ALL spent units regardless of level.
 * Wounded units are also readied (wound status unchanged).
 * Used by Banner of Courage powered effect.
 */
export interface ReadyAllUnitsEffect {
  readonly type: typeof EFFECT_READY_ALL_UNITS;
}

/**
 * Scout peek effect (Scouts unit ability).
 * Reveals face-down enemy tokens within a distance from the player.
 * Also creates a ScoutFameBonus modifier tracking which enemies were newly revealed,
 * granting bonus fame when those enemies are defeated this turn.
 */
export interface ScoutPeekEffect {
  readonly type: typeof EFFECT_SCOUT_PEEK;
  /** How far from the player to reveal (in hex distance) */
  readonly distance: number;
  /** Fame bonus per revealed enemy defeated this turn */
  readonly fame: number;
}

/**
 * Energy Flow / Energy Steal spell effect.
 * Ready a unit, optionally heal it, then optionally spend one unit
 * of a given max level in each other player's unit area.
 *
 * In single-player, the "spend opponent units" part is a no-op.
 */
export interface EnergyFlowEffect {
  readonly type: typeof EFFECT_ENERGY_FLOW;
  /** Max unit level for spending opponent units */
  readonly spendMaxLevel: 1 | 2 | 3 | 4;
  /** Whether to heal the readied unit (powered effect only) */
  readonly healReadiedUnit: boolean;
}

/**
 * Internal effect generated as a choice option for Energy Flow unit selection.
 * Readies the selected unit (and heals if powered).
 */
export interface ResolveEnergyFlowTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_ENERGY_FLOW_TARGET;
  readonly unitInstanceId: string;
  readonly unitName: string;
  readonly healReadiedUnit: boolean;
}

/**
 * Select a hex coordinate for terrain cost reduction (Druidic Paths basic).
 * Sets pendingTerrainCostReduction in "hex" mode with all map hexes as options.
 */
export interface SelectHexForCostReductionEffect {
  readonly type: typeof EFFECT_SELECT_HEX_FOR_COST_REDUCTION;
  readonly reduction: number;
  readonly minimumCost: number;
}

/**
 * Select a terrain type for terrain cost reduction (Druidic Paths powered).
 * Sets pendingTerrainCostReduction in "terrain" mode with all terrain types as options.
 */
export interface SelectTerrainForCostReductionEffect {
  readonly type: typeof EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION;
  readonly reduction: number;
  readonly minimumCost: number;
}

/**
 * Cure spell basic effect.
 * 1. Heal `amount` wounds from hand
 * 2. Draw a card for each wound healed from hand this turn (including the heal just done)
 * 3. Ready each unit healed this turn
 *
 * Also establishes a turn-scoped modifier so future healing triggers additional
 * card draws and unit readying.
 */
export interface CureEffect {
  readonly type: typeof EFFECT_CURE;
  readonly amount: number;
}

/**
 * Invocation resolve effect (Arythea's Invocation skill).
 *
 * Atomic operation: discard a card from hand and gain a mana token.
 * - Wound cards are returned to the wound pile (not discard pile)
 * - Non-wound cards go to the discard pile
 * - Mana token is added with MANA_TOKEN_SOURCE_SKILL
 *
 * Each option in the pendingChoice encodes the full operation.
 */
export interface InvocationResolveEffect {
  readonly type: typeof EFFECT_INVOCATION_RESOLVE;
  /** The card to discard from hand */
  readonly cardId: CardId;
  /** Whether the discarded card is a wound */
  readonly isWound: boolean;
  /** The mana color to gain */
  readonly manaColor: ManaColor;
  /** Human-readable description for UI */
  readonly description: string;
}

/**
 * Disease spell powered effect.
 * All enemies that have ALL their attacks blocked during the Block phase
 * get their armor reduced to 1 for the rest of combat.
 * Must be played during Block phase.
 */
export interface DiseaseEffect {
  readonly type: typeof EFFECT_DISEASE;
}

// Union of all card effects
export type CardEffect =
  | GainMoveEffect
  | GainInfluenceEffect
  | GainAttackEffect
  | GainBlockEffect
  | GainHealingEffect
  | GainManaEffect
  | DrawCardsEffect
  | NoopEffect
  | ChangeReputationEffect
  | GainFameEffect
  | GainCrystalEffect
  | ConvertManaToCrystalEffect
  | CrystallizeColorEffect
  | CardBoostEffect
  | ResolveBoostTargetEffect
  | ReadyUnitEffect
  | ResolveReadyUnitTargetEffect
  | ManaDrawPoweredEffect
  | ManaDrawPickDieEffect
  | ManaDrawSetColorEffect
  | TakeWoundEffect
  | ApplyModifierEffect
  | CompoundEffect
  | ChoiceEffect
  | ConditionalEffect
  | ScalingEffect
  | SelectCombatEnemyEffect
  | ResolveCombatEnemyTargetEffect
  | HealUnitEffect
  | DiscardCardEffect
  | DiscardWoundsEffect
  | RevealTilesEffect
  | PayManaCostEffect
  | TerrainBasedBlockEffect
  | PlaceSkillInCenterEffect
  | DiscardCostEffect
  | GrantWoundImmunityEffect
  | DiscardForAttackEffect
  | FamePerEnemyDefeatedEffect
  | TrackAttackDefeatFameEffect
  | PolarizeManaEffect
  | DiscardForCrystalEffect
  | RecruitDiscountEffect
  | ReadyUnitsForInfluenceEffect
  | ResolveReadyUnitForInfluenceEffect
  | ReadyAllUnitsEffect
  | ScoutPeekEffect
  | EnergyFlowEffect
  | ResolveEnergyFlowTargetEffect
  | SelectHexForCostReductionEffect
  | SelectTerrainForCostReductionEffect
  | CureEffect
  | DiseaseEffect
  | InvocationResolveEffect;

// === Card Definition ===

export interface DeedCard {
  readonly id: CardId;
  readonly name: string;
  /** Alternate name for powered effect (spells only, e.g., "Flame Wall" → "Flame Wave") */
  readonly poweredName?: string;
  readonly cardType: DeedCardType;

  // Mana colors that can power this card's powered effect
  // Empty array means the card cannot be powered (e.g., wounds)
  // Most cards have a single color, but some advanced actions can be powered by multiple
  readonly poweredBy: readonly ManaColor[];

  // Card categories (symbols shown in top-left corner of card art)
  // For spells, this is the category for the basic effect
  readonly categories: readonly CardCategory[];

  // Optional per-effect category overrides
  // Use when basic/powered effects differ (e.g., healing vs combat)
  readonly basicEffectCategories?: readonly CardCategory[];
  readonly poweredEffectCategories?: readonly CardCategory[];

  // Basic effect (play without mana)
  readonly basicEffect: CardEffect;

  // Powered effect (play with matching mana)
  readonly poweredEffect: CardEffect;

  // Sideways value (usually 1, wounds are 0)
  readonly sidewaysValue: number;

  // If true, card is destroyed after playing its powered effect (artifacts only)
  readonly destroyOnPowered?: boolean;

  // If true, card affects other players and can be removed in "friendly game" mode
  // Spells: Mana Meltdown, Mana Claim, Mind Read, Energy Flow (#109-112)
  readonly interactive?: boolean;
}
