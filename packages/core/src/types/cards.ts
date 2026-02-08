/**
 * Card definitions for Mage Knight
 */

import type {
  CardId,
  SkillId,
  UnitId,
  ManaColor,
  BasicManaColor,
  Element,
  DiscardFilter,
  RevealTileType,
  ResistanceType,
  ManaSourceInfo,
} from "@mage-knight/shared";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
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
  EFFECT_MANA_STORM_BASIC,
  EFFECT_MANA_STORM_SELECT_DIE,
  EFFECT_MANA_STORM_POWERED,
  EFFECT_SOURCE_OPENING_REROLL,
  EFFECT_SOURCE_OPENING_SELECT_DIE,
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
  EFFECT_READY_UNITS_BUDGET,
  EFFECT_RESOLVE_READY_UNIT_BUDGET,
  EFFECT_CURE,
  EFFECT_DISEASE,
  EFFECT_SCOUT_PEEK,
  EFFECT_ENERGY_FLOW,
  EFFECT_RESOLVE_ENERGY_FLOW_TARGET,
  EFFECT_READY_ALL_UNITS,
  EFFECT_SELECT_HEX_FOR_COST_REDUCTION,
  EFFECT_SELECT_TERRAIN_FOR_COST_REDUCTION,
  EFFECT_INVOCATION_RESOLVE,
  EFFECT_WOUND_ACTIVATING_UNIT,
  EFFECT_MANA_MELTDOWN,
  EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE,
  EFFECT_MANA_RADIANCE,
  EFFECT_RESOLVE_MANA_RADIANCE_COLOR,
  EFFECT_ALTEM_MAGES_COLD_FIRE,
  EFFECT_PURE_MAGIC,
  EFFECT_APPLY_RECRUITMENT_BONUS,
  EFFECT_APPLY_INTERACTION_BONUS,
  EFFECT_FREE_RECRUIT,
  EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
  EFFECT_SACRIFICE,
  EFFECT_RESOLVE_SACRIFICE,
  EFFECT_CALL_TO_ARMS,
  EFFECT_RESOLVE_CALL_TO_ARMS_UNIT,
  EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY,
  EFFECT_MANA_CLAIM,
  EFFECT_RESOLVE_MANA_CLAIM_DIE,
  EFFECT_RESOLVE_MANA_CLAIM_MODE,
  EFFECT_MANA_CURSE,
  EFFECT_MANA_BOLT,
  EFFECT_MIND_READ,
  EFFECT_RESOLVE_MIND_READ_COLOR,
  EFFECT_MIND_STEAL,
  EFFECT_RESOLVE_MIND_STEAL_COLOR,
  EFFECT_RESOLVE_MIND_STEAL_SELECTION,
  EFFECT_ACTIVATE_BANNER_PROTECTION,
  EFFECT_DECOMPOSE,
  EFFECT_MAXIMAL_EFFECT,
  EFFECT_HEAL_ALL_UNITS,
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
  EFFECT_CRYSTAL_MASTERY_BASIC,
  EFFECT_CRYSTAL_MASTERY_POWERED,
  EFFECT_POSSESS_ENEMY,
  EFFECT_RESOLVE_POSSESS_ENEMY,
  EFFECT_ROLL_DIE_FOR_WOUND,
  EFFECT_CHOOSE_BONUS_WITH_RISK,
  EFFECT_RESOLVE_BONUS_CHOICE,
  EFFECT_ROLL_FOR_CRYSTALS,
  EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE,
  EFFECT_BOOK_OF_WISDOM,
  EFFECT_MAGIC_TALENT_BASIC,
  EFFECT_RESOLVE_MAGIC_TALENT_SPELL,
  EFFECT_MAGIC_TALENT_POWERED,
  EFFECT_RESOLVE_MAGIC_TALENT_GAIN,
  EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA,
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
  /**
   * If true, the targeted enemy will be defeated (destroyed) if fully blocked
   * during the Block phase. Checked after block resolution.
   * Blocked by Arcane Immunity (magical effect targeting the enemy).
   * For multi-attack enemies, ALL attacks must be blocked.
   * Used by Delphana Masters' red mana ability.
   */
  readonly defeatIfBlocked?: boolean;
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
  /**
   * Maximum number of enemies that can be targeted (default: 1).
   * When > 1, after each selection the player can choose another target or stop.
   * Used by Banner of Fear powered effect (up to 3 enemies).
   */
  readonly maxTargets?: number;
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
  /**
   * Multi-target tracking: original SelectCombatEnemyEffect for continuing selection.
   * When present, after resolving this target, re-enter selection for remaining targets.
   */
  readonly multiTargetSource?: SelectCombatEnemyEffect;
  /** How many more targets can be selected after this one (excluding this selection) */
  readonly remainingTargets?: number;
  /** Enemy instance IDs already targeted (to exclude from future selections) */
  readonly alreadyTargeted?: readonly string[];
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
  /** If true, cards with no action color (artifacts, spells) can be discarded for no effect.
   *  Used by Druidic Staff where discarding an artifact gives nothing. */
  readonly allowNoColor?: boolean;
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
 * Decompose effect - throw away an action card from hand and gain crystals.
 * Used by the Decompose advanced action card.
 *
 * Resolution:
 * - Player selects an action card from hand (excluding Decompose itself and wounds)
 * - Card is permanently removed from the game (added to removedCards)
 * - Basic mode: gain 2 crystals matching the thrown card's color
 * - Powered mode: gain 1 crystal of each basic color NOT matching the thrown card's color
 *
 * Creates pendingDecompose state. Player selects card via RESOLVE_DECOMPOSE action.
 */
export interface DecomposeEffect {
  readonly type: typeof EFFECT_DECOMPOSE;
  /** "basic" = 2 crystals of matching color, "powered" = 1 of each non-matching color */
  readonly mode: "basic" | "powered";
}

/**
 * Maximal Effect - throw away an action card from hand and use its effect multiple times.
 * Used by the Maximal Effect advanced action card.
 *
 * Resolution:
 * - Player selects an action card from hand (excluding Maximal Effect itself and wounds)
 * - Card is permanently removed from the game (added to removedCards)
 * - Basic mode: use target card's basic effect 3 times
 * - Powered mode: use target card's powered effect 2 times (for free)
 *
 * Effects aggregate: e.g., 3x Attack 2 = single Attack 6.
 * Cards with choices allow different choices per use.
 *
 * Creates pendingMaximalEffect state. Player selects card via RESOLVE_MAXIMAL_EFFECT action.
 */
export interface MaximalEffectEffect {
  readonly type: typeof EFFECT_MAXIMAL_EFFECT;
  /** How many times to execute the target card's effect */
  readonly multiplier: number;
  /** Whether to use the target card's "basic" or "powered" effect */
  readonly effectKind: "basic" | "powered";
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
 * Ready units up to a total level budget (free, no influence cost).
 * Used by Restoration/Rebirth powered spell effect.
 *
 * Resolution:
 * 1. Find eligible spent units where level <= remaining budget
 * 2. Present choices: one per eligible unit + "Done" option
 * 3. On selection: ready unit, deduct level from budget, re-present remaining choices
 * 4. On "Done": complete resolution
 */
export interface ReadyUnitsBudgetEffect {
  readonly type: typeof EFFECT_READY_UNITS_BUDGET;
  readonly totalLevels: number; // Budget of unit levels (e.g., 3 or 5)
}

/**
 * Internal effect generated as a choice option for budget-based unit readying.
 * Readies the selected unit and chains back with remaining budget.
 */
export interface ResolveReadyUnitBudgetEffect {
  readonly type: typeof EFFECT_RESOLVE_READY_UNIT_BUDGET;
  readonly unitInstanceId: string;
  readonly unitName: string;
  readonly unitLevel: number; // Level of the selected unit
  readonly remainingBudget: number; // Budget remaining after readying this unit
}

/**
 * Mana Meltdown basic effect (Red Spell #109).
 * Each opponent randomly loses a crystal (or takes a wound if no crystals).
 * Caster may gain one crystal from the lost pool.
 * After end-of-round announced: does nothing.
 */
export interface ManaMeltdownEffect {
  readonly type: typeof EFFECT_MANA_MELTDOWN;
}

/**
 * Internal: Caster chooses which stolen crystal color to gain (or skip).
 * Generated dynamically based on crystals lost by opponents.
 */
export interface ResolveManaMeltdownChoiceEffect {
  readonly type: typeof EFFECT_RESOLVE_MANA_MELTDOWN_CHOICE;
  /** The crystal color to gain (one of the stolen colors) */
  readonly color: BasicManaColor;
}

/**
 * Mana Radiance powered effect (Red Spell #109).
 * Choose a basic mana color. Each player (including caster) takes 1 wound
 * per crystal of that color they own. Caster gains 2 crystals of chosen color.
 * After end-of-round announced: only applies to caster (no wounds to others).
 */
export interface ManaRadianceEffect {
  readonly type: typeof EFFECT_MANA_RADIANCE;
}

/**
 * Internal: Resolve Mana Radiance after caster picks a basic mana color.
 * Applies wounds to all players per crystal of chosen color, then grants
 * 2 crystals of that color to the caster.
 */
export interface ResolveManaRadianceColorEffect {
  readonly type: typeof EFFECT_RESOLVE_MANA_RADIANCE_COLOR;
  /** The chosen basic mana color */
  readonly color: BasicManaColor;
}

/**
 * Mana Claim basic effect (Blue Spell #110).
 * Take a basic color die from Source, keep until end of round.
 * Choose: 3 tokens now OR 1 token per turn for remainder of round.
 */
export interface ManaClaimEffect {
  readonly type: typeof EFFECT_MANA_CLAIM;
}

/**
 * Internal: Player has selected which die to claim from the Source.
 * Generates mode choice options (burst vs sustained).
 */
export interface ResolveManaClaimDieEffect {
  readonly type: typeof EFFECT_RESOLVE_MANA_CLAIM_DIE;
  readonly dieId: SourceDieId;
  readonly dieColor: ManaColor;
  /** Whether curse effect should be applied (powered mode) */
  readonly withCurse: boolean;
}

/**
 * Internal: Player has chosen burst or sustained mode for the claimed die.
 * - burst: Gain 3 tokens of the claimed color immediately
 * - sustained: Gain 1 token per turn for remainder of round (starting next turn)
 */
export interface ResolveManaClaimModeEffect {
  readonly type: typeof EFFECT_RESOLVE_MANA_CLAIM_MODE;
  readonly dieId: SourceDieId;
  readonly color: BasicManaColor;
  readonly mode: "burst" | "sustained";
  readonly withCurse: boolean;
}

/**
 * Mana Curse powered effect (Blue Spell #110).
 * Same as Mana Claim basic, plus curse: until end of round, other players
 * take a wound when using mana of the claimed color (max 1 per player per turn).
 */
export interface ManaCurseEffect {
  readonly type: typeof EFFECT_MANA_CURSE;
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

/**
 * Wound the unit that activated this ability (self-wound).
 * Sets the activating unit's wounded flag to true.
 *
 * This is NOT combat damage — it's a cost of using the ability:
 * - Does NOT trigger Paralyze (enemy ability: instant-kill on wound)
 * - Does NOT trigger Vampiric (enemy ability: armor increase on wound)
 * - Does NOT trigger Poison (enemy ability: extra wounds)
 * - DOES prevent future activation (wounded units can't activate)
 *
 * The unitInstanceId is injected at resolution time by the activation command
 * using the __ACTIVATING_UNIT__ placeholder pattern.
 *
 * Used by Utem Swordsmen's Attack/Block 6 ability.
 */
export interface WoundActivatingUnitEffect {
  readonly type: typeof EFFECT_WOUND_ACTIVATING_UNIT;
  readonly unitInstanceId: string;
}

/**
 * Altem Mages Cold Fire Attack/Block effect.
 * Base: Cold Fire Attack 5 OR Cold Fire Block 5.
 * Scaling: pay blue mana = 7, pay red mana = 7, pay both = 9.
 * Generates dynamic choices based on available mana tokens.
 */
export interface AltemMagesColdFireEffect {
  readonly type: typeof EFFECT_ALTEM_MAGES_COLD_FIRE;
  readonly baseValue: number;
  readonly boostPerMana: number;
}

/**
 * Apply a recruitment bonus modifier that triggers on each unit recruited this turn.
 * Used by Heroic Tale:
 * - Basic: Rep +1 per recruit
 * - Powered: Rep +1 AND Fame +1 per recruit
 */
export interface ApplyRecruitmentBonusEffect {
  readonly type: typeof EFFECT_APPLY_RECRUITMENT_BONUS;
  readonly reputationPerRecruit: number;
  readonly famePerRecruit: number;
}

/**
 * Apply an interaction bonus modifier that triggers on the first interaction this turn.
 * Used by Noble Manners:
 * - Basic: Fame +1 on first interaction
 * - Powered: Fame +1 AND Rep +1 on first interaction
 */
export interface ApplyInteractionBonusEffect {
  readonly type: typeof EFFECT_APPLY_INTERACTION_BONUS;
  readonly fame: number;
  readonly reputation: number;
}

/**
 * Pure Magic mana-payment-driven effect.
 * Player pays 1 basic mana token and the color determines the effect:
 * Green → Move, White → Influence, Blue → Block, Red → Attack.
 * Blue/Red are only available during combat.
 * Value differs between basic and powered modes.
 */
export interface PureMagicEffect {
  readonly type: typeof EFFECT_PURE_MAGIC;
  readonly value: number;
}

/**
 * Mana Bolt mana-payment-driven combat effect.
 * Player pays 1 basic mana token and the color determines the attack:
 * Blue → Melee Ice Attack (baseValue), Red → Melee Cold Fire Attack (baseValue - 1),
 * White → Ranged Ice Attack (baseValue - 2), Green → Siege Ice Attack (baseValue - 3).
 * Combat only. baseValue differs between basic (8) and powered (11) modes.
 */
export interface ManaBoltEffect {
  readonly type: typeof EFFECT_MANA_BOLT;
  readonly baseValue: number;
}

/**
 * Free recruit effect entry point.
 * Presents the units offer for the player to pick a unit for free.
 * No location restrictions (works anywhere, even in combat).
 * If at command limit, the player must disband a unit first (handled externally).
 *
 * Used by Banner of Command powered effect and Call to Glory spell.
 */
export interface FreeRecruitEffect {
  readonly type: typeof EFFECT_FREE_RECRUIT;
}

/**
 * Internal effect generated as a choice option for free recruitment unit selection.
 * Recruits the selected unit for free (0 influence, artifact source).
 */
export interface ResolveFreeRecruitTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_FREE_RECRUIT_TARGET;
  readonly unitId: UnitId;
  readonly unitName: string;
}

/**
 * Sacrifice effect entry point (Offering powered effect).
 *
 * Two-stage color choice:
 * 1. Choose green or white (determines attack type: siege vs ranged)
 * 2. Choose red or blue (determines element: fire vs ice)
 *
 * Crystal pairs of the chosen colors determine attack value:
 * - green+red pair → Siege Fire Attack 4 per pair
 * - green+blue pair → Siege Ice Attack 4 per pair
 * - white+red pair → Ranged Fire Attack 6 per pair
 * - white+blue pair → Ranged Ice Attack 6 per pair
 *
 * All complete pairs are converted to mana tokens (immediately usable).
 */
export interface SacrificeEffect {
  readonly type: typeof EFFECT_SACRIFICE;
}

/**
 * Internal: Resolve after both color choices for Sacrifice.
 * Calculates attack from crystal pairs and converts pairs to mana tokens.
 */
export interface ResolveSacrificeEffect {
  readonly type: typeof EFFECT_RESOLVE_SACRIFICE;
  /** First choice: green or white */
  readonly attackColor: typeof MANA_GREEN | typeof MANA_WHITE;
  /** Second choice: red or blue */
  readonly elementColor: typeof MANA_RED | typeof MANA_BLUE;
}

/**
 * Call to Arms effect entry point (White Spell basic effect).
 * Borrow a unit's ability from the Units Offer for this turn.
 * Presents eligible units from the offer (excludes Magic Familiars, Delphana Masters).
 * No damage can be assigned to the borrowed unit.
 */
export interface CallToArmsEffect {
  readonly type: typeof EFFECT_CALL_TO_ARMS;
}

/**
 * Internal: After selecting a unit from the offer.
 * Presents the selected unit's abilities as choices.
 */
export interface ResolveCallToArmsUnitEffect {
  readonly type: typeof EFFECT_RESOLVE_CALL_TO_ARMS_UNIT;
  readonly unitId: UnitId;
  readonly unitName: string;
}

/**
 * Internal: After selecting an ability from the borrowed unit.
 * Resolves the ability effect (value-based or effect-based).
 */
export interface ResolveCallToArmsAbilityEffect {
  readonly type: typeof EFFECT_RESOLVE_CALL_TO_ARMS_ABILITY;
  readonly unitId: UnitId;
  readonly unitName: string;
  readonly abilityIndex: number;
  readonly abilityDescription: string;
}

/**
 * Mind Read effect entry point (White Spell basic effect).
 * Choose a basic mana color. Gain crystal. Each opponent must discard
 * a Spell or Action card of that color, or reveal hand to show they have none.
 */
export interface MindReadEffect {
  readonly type: typeof EFFECT_MIND_READ;
}

/**
 * Internal: Resolve after caster selects a color for Mind Read.
 * Applies crystal gain and forced discard.
 */
export interface ResolveMindReadColorEffect {
  readonly type: typeof EFFECT_RESOLVE_MIND_READ_COLOR;
  readonly color: BasicManaColor;
}

/**
 * Mind Steal effect entry point (White Spell powered effect).
 * Same as Mind Read, plus caster may steal one discarded Action card.
 */
export interface MindStealEffect {
  readonly type: typeof EFFECT_MIND_STEAL;
}

/**
 * Internal: Resolve after caster selects a color for Mind Steal.
 * Applies crystal gain, forced discard, then presents steal options.
 */
export interface ResolveMindStealColorEffect {
  readonly type: typeof EFFECT_RESOLVE_MIND_STEAL_COLOR;
  readonly color: BasicManaColor;
}

/**
 * Internal: Resolve after caster selects an Action card to steal (or skip).
 * Moves the selected card to the caster's hand permanently.
 */
export interface ResolveMindStealSelectionEffect {
  readonly type: typeof EFFECT_RESOLVE_MIND_STEAL_SELECTION;
  readonly cardId: CardId;
  readonly cardName: string;
  readonly fromPlayerId: string;
}

/**
 * Heal all units completely (remove wounds from all wounded units).
 * No unit selection needed — all wounded units are healed automatically.
 * Used by Banner of Fortitude powered effect.
 */
export interface HealAllUnitsEffect {
  readonly type: typeof EFFECT_HEAL_ALL_UNITS;
}

/**
 * Activate Banner of Protection powered effect.
 * Sets bannerOfProtectionActive flag; at end of turn, player may throw away
 * all wounds received this turn.
 */
export interface ActivateBannerProtectionEffect {
  readonly type: typeof EFFECT_ACTIVATE_BANNER_PROTECTION;
}

/**
 * Crystal Mastery basic effect.
 * Gain a crystal of a color you already own.
 * Presents a choice of colors matching owned crystals.
 * If player owns no crystals, the effect cannot be resolved.
 */
export interface CrystalMasteryBasicEffect {
  readonly type: typeof EFFECT_CRYSTAL_MASTERY_BASIC;
}

/**
 * Crystal Mastery powered effect.
 * At end of turn, all crystals spent this turn are returned to inventory.
 * Sets a flag on the player; the actual return happens during end-of-turn processing.
 */
export interface CrystalMasteryPoweredEffect {
  readonly type: typeof EFFECT_CRYSTAL_MASTERY_POWERED;
}

/**
 * Wings of Night multi-target skip-attack effect entry point.
 * First enemy targeted for free. Additional enemies cost 1, 2, 3... move points.
 * All targeted enemies get SKIP_ATTACK modifier. Arcane Immune enemies excluded.
 */
export interface WingsOfNightEffect {
  readonly type: typeof EFFECT_WINGS_OF_NIGHT;
}

/**
 * Internal: resolve after selecting an enemy for Wings of Night.
 * Applies skip-attack modifier, deducts move cost, chains for more targets.
 */
export interface ResolveWingsOfNightTargetEffect {
  readonly type: typeof EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET;
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  /** Move cost for this target (0 for first, 1 for second, etc.) */
  readonly moveCost: number;
  /** Number of enemies targeted so far (including this one) */
  readonly targetCount: number;
}

/**
 * Mana Storm basic effect entry point.
 * Choose a die in the Source showing a basic color.
 * Gain a crystal of that color, then reroll the die and return it to the Source.
 */
export interface ManaStormBasicEffect {
  readonly type: typeof EFFECT_MANA_STORM_BASIC;
}

/**
 * Internal: Player selected a die from the Source for Mana Storm basic.
 * Gains a crystal of that die's color and rerolls the die.
 */
export interface ManaStormSelectDieEffect {
  readonly type: typeof EFFECT_MANA_STORM_SELECT_DIE;
  readonly dieId: SourceDieId;
  readonly dieColor: BasicManaColor;
}

/**
 * Mana Storm powered effect entry point.
 * Reroll all dice in the Source. Grant 3 extra source dice usage and
 * allow black/gold dice as any basic color for the rest of the turn.
 */
export interface ManaStormPoweredEffect {
  readonly type: typeof EFFECT_MANA_STORM_POWERED;
}

/**
 * Source Opening reroll effect entry point.
 * Presents available source dice for optional reroll. Player can skip.
 */
export interface SourceOpeningRerollEffect {
  readonly type: typeof EFFECT_SOURCE_OPENING_REROLL;
}

/**
 * Internal: Player selected a die to reroll for Source Opening (or skipped).
 * Rerolls the selected die in the Source.
 */
export interface SourceOpeningSelectDieEffect {
  readonly type: typeof EFFECT_SOURCE_OPENING_SELECT_DIE;
  readonly dieId: SourceDieId;
}

/**
 * Possess enemy effect entry point (Charm/Possess powered spell).
 * Targets an enemy (excludes Arcane Immune), prevents it from attacking,
 * and grants the player melee Attack equal to the enemy's attack value
 * (including elements like fire/ice). Special abilities are excluded.
 * The gained attack can only target OTHER enemies (not the possessed one).
 */
export interface PossessEnemyEffect {
  readonly type: typeof EFFECT_POSSESS_ENEMY;
}

/**
 * Internal: resolve after selecting which enemy to possess.
 * Applies skip-attack modifier and grants attack from enemy's stats.
 */
export interface ResolvePossessEnemyEffect {
  readonly type: typeof EFFECT_RESOLVE_POSSESS_ENEMY;
  readonly enemyInstanceId: string;
  readonly enemyName: string;
}

/**
 * Roll mana dice and gain wounds for black or red results.
 * Used by Horn of Wrath basic effect.
 */
export interface RollDieForWoundEffect {
  readonly type: typeof EFFECT_ROLL_DIE_FOR_WOUND;
  readonly diceCount: number;
  readonly woundColors: readonly ManaColor[];
}

/**
 * Choose a bonus amount (0 to max), then roll dice per bonus chosen.
 * Gain siege attack for the bonus and wounds for black/red results.
 * Used by Horn of Wrath powered effect.
 */
export interface ChooseBonusWithRiskEffect {
  readonly type: typeof EFFECT_CHOOSE_BONUS_WITH_RISK;
  readonly maxBonus: number;
  readonly attackType: CombatType;
  readonly woundColors: readonly ManaColor[];
}

/**
 * Internal: resolve after player selects a bonus amount.
 * Applies siege attack bonus and rolls dice for wound risk.
 */
export interface ResolveBonusChoiceEffect {
  readonly type: typeof EFFECT_RESOLVE_BONUS_CHOICE;
  readonly bonus: number;
  readonly attackType: CombatType;
  readonly woundColors: readonly ManaColor[];
}

/**
 * Roll mana dice and gain crystals based on results.
 * Basic colors → crystal of that color, gold → player chooses, black → Fame +1.
 * Used by Endless Gem Pouch basic effect.
 */
export interface RollForCrystalsEffect {
  readonly type: typeof EFFECT_ROLL_FOR_CRYSTALS;
  readonly diceCount: number;
}

/**
 * Internal: resolve after player chooses a crystal color for a gold roll.
 * Applies the remaining crystal gains and fame from the roll results.
 */
export interface ResolveCrystalRollChoiceEffect {
  readonly type: typeof EFFECT_RESOLVE_CRYSTAL_ROLL_CHOICE;
  readonly chosenColor: BasicManaColor;
  readonly remainingResults: readonly ManaColor[];
}

/**
 * Book of Wisdom: throw away an action card, then gain a card from offer matching color.
 * Basic: gain AA from offer to hand.
 * Powered: gain spell from offer to hand + crystal of that color.
 */
export interface BookOfWisdomEffect {
  readonly type: typeof EFFECT_BOOK_OF_WISDOM;
  readonly mode: "basic" | "powered";
}

/**
 * Magic Talent basic effect entry point.
 * Discard a card of any color from hand. Then play one Spell card of the
 * same color from the Spells Offer as if it were in your hand.
 * The spell remains in the offer after use.
 * Must still pay mana cost to cast the spell.
 */
export interface MagicTalentBasicEffect {
  readonly type: typeof EFFECT_MAGIC_TALENT_BASIC;
}

/**
 * Internal: After discarding a card for Magic Talent basic, resolve the
 * selected spell from the offer. The spell's basic effect is resolved
 * but the spell card stays in the offer.
 */
export interface ResolveMagicTalentSpellEffect {
  readonly type: typeof EFFECT_RESOLVE_MAGIC_TALENT_SPELL;
  /** The spell card selected from the offer */
  readonly spellCardId: CardId;
  /** Name of the spell for display */
  readonly spellName: string;
}

/**
 * Magic Talent powered effect entry point.
 * Pay a mana of any color (in addition to blue for powering the card).
 * Gain a Spell card of that color from the Spells Offer to your discard pile.
 */
export interface MagicTalentPoweredEffect {
  readonly type: typeof EFFECT_MAGIC_TALENT_POWERED;
}

/**
 * Internal: After paying mana for Magic Talent powered, gain the
 * selected spell from the offer to the player's discard pile.
 * The offer is replenished from the spell deck.
 */
export interface ResolveMagicTalentGainEffect {
  readonly type: typeof EFFECT_RESOLVE_MAGIC_TALENT_GAIN;
  /** The spell card selected from the offer */
  readonly spellCardId: CardId;
  /** Name of the spell for display */
  readonly spellName: string;
}

/**
 * Internal: Consume a specific mana source to pay for casting a spell
 * from the Spell Offer via Magic Talent basic, then resolve the spell's
 * basic effect. Generated as dynamic choice options when multiple mana
 * sources are available.
 */
export interface ResolveMagicTalentSpellManaEffect {
  readonly type: typeof EFFECT_RESOLVE_MAGIC_TALENT_SPELL_MANA;
  /** The spell card to cast from the offer */
  readonly spellCardId: CardId;
  /** Name of the spell for display */
  readonly spellName: string;
  /** The mana source to consume for payment */
  readonly manaSource: ManaSourceInfo;
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
  | DecomposeEffect
  | MaximalEffectEffect
  | RecruitDiscountEffect
  | ReadyUnitsForInfluenceEffect
  | ResolveReadyUnitForInfluenceEffect
  | ReadyAllUnitsEffect
  | ReadyUnitsBudgetEffect
  | ResolveReadyUnitBudgetEffect
  | ScoutPeekEffect
  | EnergyFlowEffect
  | ResolveEnergyFlowTargetEffect
  | SelectHexForCostReductionEffect
  | SelectTerrainForCostReductionEffect
  | CureEffect
  | DiseaseEffect
  | InvocationResolveEffect
  | WoundActivatingUnitEffect
  | ManaMeltdownEffect
  | ResolveManaMeltdownChoiceEffect
  | ManaRadianceEffect
  | ResolveManaRadianceColorEffect
  | AltemMagesColdFireEffect
  | PureMagicEffect
  | ManaBoltEffect
  | ApplyRecruitmentBonusEffect
  | ApplyInteractionBonusEffect
  | FreeRecruitEffect
  | ResolveFreeRecruitTargetEffect
  | SacrificeEffect
  | ResolveSacrificeEffect
  | CallToArmsEffect
  | ResolveCallToArmsUnitEffect
  | ResolveCallToArmsAbilityEffect
  | ManaClaimEffect
  | ResolveManaClaimDieEffect
  | ResolveManaClaimModeEffect
  | ManaCurseEffect
  | MindReadEffect
  | ResolveMindReadColorEffect
  | MindStealEffect
  | ResolveMindStealColorEffect
  | ResolveMindStealSelectionEffect
  | HealAllUnitsEffect
  | ActivateBannerProtectionEffect
  | WingsOfNightEffect
  | ResolveWingsOfNightTargetEffect
  | CrystalMasteryBasicEffect
  | CrystalMasteryPoweredEffect
  | ManaStormBasicEffect
  | ManaStormSelectDieEffect
  | ManaStormPoweredEffect
  | SourceOpeningRerollEffect
  | SourceOpeningSelectDieEffect
  | PossessEnemyEffect
  | ResolvePossessEnemyEffect
  | RollDieForWoundEffect
  | ChooseBonusWithRiskEffect
  | ResolveBonusChoiceEffect
  | RollForCrystalsEffect
  | ResolveCrystalRollChoiceEffect
  | BookOfWisdomEffect
  | MagicTalentBasicEffect
  | ResolveMagicTalentSpellEffect
  | MagicTalentPoweredEffect
  | ResolveMagicTalentGainEffect
  | ResolveMagicTalentSpellManaEffect;

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

  // Restrict which combat phases this card can be played in.
  // When set, the card is only playable during the specified phases.
  // Used by Into the Heat which can only be played at start of combat (Ranged/Siege phase).
  readonly combatPhaseRestriction?: readonly CombatPhase[];
}
