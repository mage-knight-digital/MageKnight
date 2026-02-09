/**
 * Player types for Mage Knight
 */

import type {
  HexCoord,
  CardId,
  SkillId,
  ManaColor,
  ManaTokenSource,
  TacticId,
  BlockSource,
  SiteReward,
  TACTIC_RETHINK,
  TACTIC_MANA_STEAL,
  TACTIC_PREPARATION,
  TACTIC_MIDNIGHT_MEDITATION,
  TACTIC_SPARING_POWER,
} from "@mage-knight/shared";

// ============================================================================
// Level Up Rewards Types
// ============================================================================

/**
 * Pending level up reward for an even level.
 * Contains the 2 skills drawn from the hero's pool for selection.
 */
export interface PendingLevelUpReward {
  /** The level this reward is for (2, 4, 6, 8, 10) */
  readonly level: number;
  /** 2 skills drawn from hero's remaining pool */
  readonly drawnSkills: readonly SkillId[];
}
import type { Hero } from "./hero.js";
import type { CardEffect } from "./cards.js";
import type { BasicCardColor } from "./effectTypes.js";
import type { PlayerUnit } from "./unit.js";
import type { SourceDieId } from "./mana.js";

// Mana token in play area (temporary, not crystals)
export interface ManaToken {
  readonly color: ManaColor;
  readonly source: ManaTokenSource;
  /**
   * If true, this mana cannot be used to power the stronger effect of spells.
   * Set when black mana is polarized to a basic color during the day.
   * Per rulebook: "Use the gained token immediately (but not to power the stronger
   * effect of your Spell cards)"
   */
  readonly cannotPowerSpells?: boolean;
}

// Skill cooldown tracking
export interface SkillCooldowns {
  readonly usedThisRound: readonly SkillId[];
  readonly usedThisTurn: readonly SkillId[];
  readonly usedThisCombat: readonly SkillId[]; // for "once per combat" activation limits
  readonly activeUntilNextTurn: readonly SkillId[];
}

/**
 * Tracks the flip state of skills that can be flipped.
 * Similar to tactics, some skills have a front and back side.
 * Skills listed here are currently on their flipped (back) side.
 */
export interface SkillFlipState {
  readonly flippedSkills: readonly SkillId[];
}

export interface Crystals {
  readonly red: number;
  readonly blue: number;
  readonly green: number;
  readonly white: number;
}

// Elemental attack values - tracks by element type
export interface ElementalAttackValues {
  readonly physical: number;
  readonly fire: number;
  readonly ice: number;
  readonly coldFire: number;
}

// Combat accumulator - tracks attack/block values from played cards
// Attack is split by attack type (normal/ranged/siege) and then by element
export interface AccumulatedAttack {
  readonly normal: number;
  readonly ranged: number;
  readonly siege: number;
  // Elemental breakdown for each attack type
  readonly normalElements: ElementalAttackValues;
  readonly rangedElements: ElementalAttackValues;
  readonly siegeElements: ElementalAttackValues;
}

export interface CombatAccumulator {
  readonly attack: AccumulatedAttack;
  readonly assignedAttack: AccumulatedAttack; // Attack that has been assigned to enemies (pending resolution)
  readonly block: number;
  readonly blockElements: ElementalAttackValues;
  readonly swiftBlockElements: ElementalAttackValues;
  readonly blockSources: readonly BlockSource[];
  readonly assignedBlock: number; // Block that has been assigned to enemies (pending resolution)
  readonly assignedBlockElements: ElementalAttackValues; // Breakdown of assigned block by element
}

// Helper to create empty elemental values
export function createEmptyElementalValues(): ElementalAttackValues {
  return {
    physical: 0,
    fire: 0,
    ice: 0,
    coldFire: 0,
  };
}

// Helper to create empty accumulated attack
export function createEmptyAccumulatedAttack(): AccumulatedAttack {
  return {
    normal: 0,
    ranged: 0,
    siege: 0,
    normalElements: createEmptyElementalValues(),
    rangedElements: createEmptyElementalValues(),
    siegeElements: createEmptyElementalValues(),
  };
}

// Helper to create empty combat accumulator
export function createEmptyCombatAccumulator(): CombatAccumulator {
  return {
    attack: createEmptyAccumulatedAttack(),
    assignedAttack: createEmptyAccumulatedAttack(),
    block: 0,
    blockElements: createEmptyElementalValues(),
    swiftBlockElements: createEmptyElementalValues(),
    blockSources: [],
    assignedBlock: 0,
    assignedBlockElements: createEmptyElementalValues(),
  };
}

// Helper to get total elemental value
export function getTotalElementalValue(values: ElementalAttackValues): number {
  return values.physical + values.fire + values.ice + values.coldFire;
}

// Helper to get total attack value (sum of normal, ranged, siege)
export function getTotalAttack(accumulator: CombatAccumulator): number {
  return accumulator.attack.normal + accumulator.attack.ranged + accumulator.attack.siege;
}

// Helper to get total block value
export function getTotalBlock(accumulator: CombatAccumulator): number {
  return accumulator.block;
}

// Pending choice - when a card, skill, or unit ability requires player selection
export interface PendingChoice {
  // Source of the choice - exactly one should be set
  readonly cardId: CardId | null;
  readonly skillId: SkillId | null;
  readonly unitInstanceId: string | null; // For unit effect-based abilities (e.g., Sorcerers)
  readonly options: readonly CardEffect[];
  /**
   * Tracks whether a movement card bonus (Tirelessness) was already applied
   * during this card's resolution to avoid double-applying across choices.
   */
  readonly movementBonusApplied?: boolean;
  /**
   * Remaining effects to resolve after this choice is resolved.
   * Used when a compound effect is interrupted by a choice - the remaining
   * sub-effects are stored here so they can continue after the choice is resolved.
   */
  readonly remainingEffects?: readonly CardEffect[];
}

/**
 * Pending discard cost resolution.
 * Set when a card effect requires discarding cards as a cost (e.g., Improvisation).
 * Contains source card and count needed for UI display and validation.
 */
export interface PendingDiscard {
  /** Source card that triggered the discard requirement */
  readonly sourceCardId: CardId;
  /** How many cards must be discarded */
  readonly count: number;
  /** If true, discarding is optional (can skip) */
  readonly optional: boolean;
  /** Effect to resolve after discarding */
  readonly thenEffect: CardEffect;
  /** If true, discarded card color determines which effect resolves */
  readonly colorMatters?: boolean;
  /** Per-color effects when colorMatters is true */
  readonly thenEffectByColor?: Partial<Record<BasicCardColor, CardEffect>>;
  /** If true, wounds cannot be selected (default: true) */
  readonly filterWounds: boolean;
  /** If true, cards with no action color can be discarded (gives no effect). Used by Druidic Staff. */
  readonly allowNoColor?: boolean;
}

/**
 * Pending discard-for-attack resolution (Sword of Justice basic effect).
 * Player can discard 0 or more non-wound cards to gain attack.
 */
export interface PendingDiscardForAttack {
  /** Source card that triggered the discard requirement */
  readonly sourceCardId: CardId;
  /** Attack gained per card discarded */
  readonly attackPerCard: number;
  /** Combat type for the gained attack (usually melee) */
  readonly combatType: import("@mage-knight/shared").CombatType;
}

/**
 * Pending discard-for-bonus resolution (Stout Resolve).
 * Player can optionally discard cards to increase a chosen effect.
 */
export interface PendingDiscardForBonus {
  /** Source card that triggered the discard (Stout Resolve) */
  readonly sourceCardId: CardId;
  /** Choice options (Move/Influence/Attack/Block with base values) */
  readonly choiceOptions: readonly import("./cards.js").CardEffect[];
  /** Bonus added to the chosen effect per card discarded */
  readonly bonusPerCard: number;
  /** Maximum cards that can be discarded */
  readonly maxDiscards: number;
  /** Filter for which cards can be discarded */
  readonly discardFilter: "wound_only" | "any_max_one_wound";
}

/**
 * Pending discard-for-crystal resolution (Savage Harvesting).
 * Player discards a card to gain a crystal.
 * - Action cards: crystal matches card color automatically
 * - Artifacts: requires second step to choose crystal color
 */
export interface PendingDiscardForCrystal {
  /** Source card that triggered the discard (Savage Harvesting) */
  readonly sourceCardId: CardId;
  /** If true, player can skip without discarding */
  readonly optional: boolean;
  /** Card that was discarded (null if still selecting) */
  readonly discardedCardId: CardId | null;
  /** If true, waiting for player to choose crystal color (artifact was discarded) */
  readonly awaitingColorChoice: boolean;
}

/**
 * Pending decompose resolution (Decompose advanced action card).
 * Player must select an action card from hand to throw away.
 * - Basic mode: gain 2 crystals matching the thrown card's color
 * - Powered mode: gain 1 crystal of each basic color NOT matching the thrown card's color
 */
export interface PendingDecompose {
  /** Source card that triggered the decompose (Decompose card) */
  readonly sourceCardId: CardId;
  /** Whether this is "basic" or "powered" mode */
  readonly mode: "basic" | "powered";
}

/**
 * Pending Maximal Effect resolution (Maximal Effect advanced action card).
 * Player must select an action card from hand to throw away and execute its effect multiple times.
 * - Basic mode: use target card's basic effect 3 times
 * - Powered mode: use target card's powered effect 2 times (for free)
 */
export interface PendingMaximalEffect {
  /** Source card that triggered the effect (Maximal Effect card) */
  readonly sourceCardId: CardId;
  /** How many times to execute the target card's effect */
  readonly multiplier: number;
  /** Whether to use the target card's "basic" or "powered" effect */
  readonly effectKind: "basic" | "powered";
}

/**
 * Pending Book of Wisdom resolution.
 * Phase 1 (select_card): Player selects an action card from hand to throw away.
 * Phase 2 (select_from_offer): Player selects a matching card from the AA or spell offer.
 *
 * Basic mode: AA offer → card goes to hand.
 * Powered mode: Spell offer → card goes to hand + crystal of matching color.
 */
export interface PendingBookOfWisdom {
  /** Source card (Book of Wisdom) */
  readonly sourceCardId: CardId;
  /** Whether this is "basic" or "powered" mode */
  readonly mode: "basic" | "powered";
  /** Current phase of the two-step resolution */
  readonly phase: "select_card" | "select_from_offer";
  /** Color of the thrown-away card (set after phase 1) */
  readonly thrownCardColor: import("../types/effectTypes.js").BasicCardColor | null;
  /** Cards available in the offer matching the thrown card color (set after phase 1) */
  readonly availableOfferCards: readonly CardId[];
}

/**
 * Pending Training resolution.
 * Phase 1 (select_card): Player selects an action card from hand to throw away.
 * Phase 2 (select_from_offer): Player selects a matching AA from the offer.
 *
 * Basic mode: gained AA goes to discard pile.
 * Powered mode: gained AA goes to hand.
 */
export interface PendingTraining {
  /** Source card (Training) */
  readonly sourceCardId: CardId;
  /** Whether this is "basic" or "powered" mode */
  readonly mode: "basic" | "powered";
  /** Current phase of the two-step resolution */
  readonly phase: "select_card" | "select_from_offer";
  /** Color of the thrown-away card (set after phase 1) */
  readonly thrownCardColor: import("../types/effectTypes.js").BasicCardColor | null;
  /** Cards available in the AA offer matching the thrown card color (set after phase 1) */
  readonly availableOfferCards: readonly CardId[];
}

/**
 * Mysterious Box per-turn tracking.
 * Stores the revealed artifact and how Box was used before end-turn cleanup.
 */
export interface MysteriousBoxState {
  /** Artifact revealed from the top of the artifact deck */
  readonly revealedArtifactId: CardId;
  /** How Mysterious Box was used this turn */
  readonly usedAs: "unused" | "basic" | "powered" | "banner";
  /**
   * Snapshot of minimum-turn requirement state from before Mysterious Box was played.
   * Needed so "play + return unused" does not incorrectly satisfy the requirement.
   */
  readonly playedCardFromHandBeforePlay: boolean;
}

/**
 * Pending terrain cost reduction choice (Druidic Paths and similar effects).
 * Player must choose a hex coordinate or terrain type to apply cost reduction.
 */
export interface PendingTerrainCostReduction {
  /** Whether to pick a hex coordinate or terrain type */
  readonly mode: "hex" | "terrain";
  /** Available hex coordinates (for "hex" mode) */
  readonly availableCoordinates: readonly HexCoord[];
  /** Available terrain types (for "terrain" mode) */
  readonly availableTerrains: readonly string[];
  /** Cost reduction amount (negative, e.g., -1) */
  readonly reduction: number;
  /** Minimum cost after reduction */
  readonly minimumCost: number;
}

/**
 * Track an attack that grants fame if it defeats at least one enemy.
 * Used by Axe Throw powered effect, Chivalry, and Explosive Bolt.
 */
export interface AttackDefeatFameTracker {
  /** Source card that created the tracker (if any) */
  readonly sourceCardId: CardId | null;
  /** Attack type being tracked (melee/ranged/siege) */
  readonly attackType: import("@mage-knight/shared").AttackType;
  /** Element type for the tracked attack (physical/fire/ice/coldFire) */
  readonly element: import("@mage-knight/shared").AttackElement;
  /** Total attack amount tracked for this effect */
  readonly amount: number;
  /** Remaining unassigned attack amount */
  readonly remaining: number;
  /** Amount assigned per enemy instance ID */
  readonly assignedByEnemy: Readonly<Record<string, number>>;
  /** Fame to grant if any tracked enemy is defeated (flat, not per-enemy) */
  readonly fame: number;
  /** Reputation to gain per enemy defeated by this attack (Chivalry) */
  readonly reputationPerDefeat?: number;
  /** Fame to gain per enemy defeated by this attack (Chivalry powered) */
  readonly famePerDefeat?: number;
  /**
   * Armor reduction to apply per enemy defeated by this attack (Explosive Bolt).
   * For each defeated enemy, another surviving enemy gets Armor -armorReductionPerDefeat
   * (minimum 1). Fire Resistant enemies are immune. Lasts entire combat.
   */
  readonly armorReductionPerDefeat?: number;
}

// === Tactic-specific state types ===

// Tactic-specific persistent state (survives across turns within a round)
export interface TacticState {
  // Mana Steal (Day 3): stored die from source
  readonly storedManaDie?: {
    readonly dieId: SourceDieId;
    readonly color: ManaColor;
  };

  // Mana Steal (Day 3): used the stolen die this turn (will be returned at end of turn)
  readonly manaStealUsedThisTurn?: boolean;

  // Sparing Power (Night 6): cards stored under the tactic
  readonly sparingPowerStored?: readonly CardId[];

  // The Right Moment (Day 6): extra turn queued
  readonly extraTurnPending?: boolean;

  // Mana Search (Night 3): used this turn flag
  readonly manaSearchUsedThisTurn?: boolean;
}

// Pending tactic decision (blocks other actions until resolved)
export type PendingTacticDecision =
  | { readonly type: typeof TACTIC_RETHINK; readonly maxCards: 3 }
  | { readonly type: typeof TACTIC_MANA_STEAL }
  | { readonly type: typeof TACTIC_PREPARATION; readonly deckSnapshot: readonly CardId[] }
  | { readonly type: typeof TACTIC_MIDNIGHT_MEDITATION; readonly maxCards: 5 }
  | { readonly type: typeof TACTIC_SPARING_POWER };

// Helper to create empty tactic state
export function createEmptyTacticState(): TacticState {
  return {};
}

/**
 * Persistent state for Krang's Master of Chaos skill.
 */
export interface MasterOfChaosState {
  // Current shield token position (color wheel).
  readonly position: ManaColor;
  // True when the player may do the between-turn free rotate.
  readonly freeRotateAvailable: boolean;
}

/**
 * Tracks a banner artifact attached to a unit.
 * Banners provide persistent basic effects while attached.
 */
export interface BannerAttachment {
  readonly bannerId: CardId;
  readonly unitInstanceId: string;
  readonly isUsedThisRound: boolean;
}

/**
 * Stored enemy token from Puppet Master skill.
 * Preserves only the stats relevant for Attack/Block calculation (FAQ S1).
 */
export interface KeptEnemyToken {
  readonly enemyId: import("@mage-knight/shared").EnemyId;
  readonly name: string;
  /** Single attack value (legacy). Used when attacks array is absent. */
  readonly attack: number;
  /** Single attack element (legacy). Used when attacks array is absent. */
  readonly attackElement: import("@mage-knight/shared").Element;
  /** Multiple attacks (overrides attack/attackElement when present). */
  readonly attacks?: readonly import("@mage-knight/shared").EnemyAttack[];
  readonly armor: number;
  readonly resistances: import("@mage-knight/shared").EnemyResistances;
}

export interface Player {
  readonly id: string;
  readonly hero: Hero; // which hero they're playing

  // Position
  readonly position: HexCoord | null; // null = not yet on map

  // Fame & Level
  readonly fame: number;
  readonly level: number;
  readonly reputation: number; // -7 to +7 scale

  // Combat stats (derived from level, but useful to cache)
  readonly armor: number;
  readonly handLimit: number;
  readonly commandTokens: number;

  // Cards
  readonly hand: readonly CardId[];
  readonly deck: readonly CardId[];
  readonly discard: readonly CardId[];

  // Units
  readonly units: readonly PlayerUnit[];

  // Bonds of Loyalty: instance ID of the unit recruited under the Bonds command token.
  // null means the slot is empty (no unit recruited or unit was destroyed).
  readonly bondsOfLoyaltyUnitInstanceId: string | null;

  // Banner artifacts attached to units
  readonly attachedBanners: readonly BannerAttachment[];

  // Skills
  readonly skills: readonly SkillId[];
  readonly skillCooldowns: SkillCooldowns;
  readonly skillFlipState: SkillFlipState;
  readonly masterOfChaosState?: MasterOfChaosState;

  // Puppet Master: accumulated enemy tokens (persists across turns)
  readonly keptEnemyTokens: readonly KeptEnemyToken[];

  // Crystals (max 3 each)
  readonly crystals: Crystals;

  // Tactic selection (per round)
  readonly selectedTactic: TacticId | null; // The tactic chosen for this round
  readonly tacticFlipped: boolean; // Whether the tactic's activated effect has been used
  readonly tacticState: TacticState; // Tactic-specific persistent state
  readonly pendingTacticDecision: PendingTacticDecision | null; // Pending tactic decision to resolve
  readonly beforeTurnTacticPending: boolean; // Whether a before-turn tactic action is required

  // Combat state
  readonly knockedOut: boolean;

  // Turn state (resets at end of turn)
  readonly movePoints: number;
  readonly influencePoints: number;
  readonly playArea: readonly CardId[]; // cards played this turn
  readonly pureMana: readonly ManaToken[]; // mana in play area
  readonly usedManaFromSource: boolean;
  readonly usedDieIds: readonly SourceDieId[]; // dice from source used this turn (rerolled at turn end)
  readonly manaDrawDieIds: readonly SourceDieId[]; // dice used via Mana Draw/Mana Pull powered (NOT rerolled at turn end)
  readonly hasMovedThisTurn: boolean; // true once any movement occurs, enforces move-before-action
  readonly hasTakenActionThisTurn: boolean;

  // Combat accumulator (resets at end of combat or end of turn if no combat)
  readonly combatAccumulator: CombatAccumulator;

  // TODO: Should be pendingChoices: PendingChoice[] to allow stacking multiple
  // choice cards before resolution. See validators/index.ts for full explanation.
  readonly pendingChoice: PendingChoice | null;

  // Pending level ups to process at end of turn
  readonly pendingLevelUps: readonly number[]; // Levels crossed this turn

  // Pending level up rewards for even levels (skill + AA selection)
  readonly pendingLevelUpRewards: readonly PendingLevelUpReward[];

  // Skills remaining in hero's personal pool (not yet drawn)
  readonly remainingHeroSkills: readonly SkillId[];

  // Pending rewards to select at end of turn (from site conquests)
  readonly pendingRewards: readonly SiteReward[];

  // Combat tracking (only one combat per turn allowed)
  readonly hasCombattedThisTurn: boolean;

// Minimum turn requirement tracking - must play at least one card from hand per turn
  // (or discard if no card is played). Set by playCardCommand/playCardSidewaysCommand.
  readonly playedCardFromHandThisTurn: boolean;

  // Plunder tracking (only one plunder per turn allowed)
  readonly hasPlunderedThisTurn: boolean;

  // Unit recruitment tracking (for "On Her Own" skill condition)
  readonly hasRecruitedUnitThisTurn: boolean;

  // Heroes special rule: track units recruited during current site interaction.
  // Cleared when player moves away from a site. Used for:
  // - Double reputation modifier (applies once per interaction when recruiting Heroes)
  // - Heroes/Thugs exclusion (cannot recruit both in same interaction)
  readonly unitsRecruitedThisInteraction: readonly import("@mage-knight/shared").UnitId[];

  // Mana usage tracking (for conditional effects)
  readonly manaUsedThisTurn: readonly ManaColor[];

  // Spell color tracking (for Ring artifacts fame bonus)
  // Tracks unique basic mana colors of spells cast this turn (not black)
  readonly spellColorsCastThisTurn: readonly ManaColor[];

  // Spell count tracking by color (for Ring artifacts fame bonus)
  // Tracks count of spells cast per color this turn (e.g., { red: 2, white: 1 })
  // Used by Ring artifacts: "Fame +1 for each [color] spell cast this turn"
  readonly spellsCastByColorThisTurn: Readonly<Partial<Record<ManaColor, number>>>;

  // Magical Glade wound discard choice pending (when wounds exist in both hand and discard)
  readonly pendingGladeWoundChoice: boolean;

  // Discard as cost pending (e.g., Improvisation requires discarding a card before gaining benefit)
  readonly pendingDiscard: PendingDiscard | null;

  // Discard for attack pending (Sword of Justice basic effect)
  readonly pendingDiscardForAttack: PendingDiscardForAttack | null;

  // Discard for bonus pending (Stout Resolve)
  readonly pendingDiscardForBonus: PendingDiscardForBonus | null;

  // Discard for crystal pending (Savage Harvesting)
  readonly pendingDiscardForCrystal: PendingDiscardForCrystal | null;

  // Decompose pending (throw away action card for crystals)
  readonly pendingDecompose: PendingDecompose | null;

  // Maximal Effect pending (throw away action card and execute its effect multiple times)
  readonly pendingMaximalEffect: PendingMaximalEffect | null;

  // Book of Wisdom pending (throw away action card, gain card from offer)
  readonly pendingBookOfWisdom: PendingBookOfWisdom | null;

  // Training pending (throw away action card, gain same-color AA from offer)
  readonly pendingTraining: PendingTraining | null;

  // Mysterious Box tracking (revealed artifact + usage mode for end-turn cleanup)
  readonly mysteriousBoxState: MysteriousBoxState | null;

  // Attack-based fame tracking (e.g., Axe Throw powered effect)
  readonly pendingAttackDefeatFame: readonly AttackDefeatFameTracker[];

  // Enemies defeated this turn (for fame bonuses like Sword of Justice)
  // Excludes summoned enemies. Reset at end of turn.
  readonly enemiesDefeatedThisTurn: number;

  // Resting state: true when player has declared rest but not yet completed it
  // While resting, movement/combat/interaction are blocked but cards can still be played
  readonly isResting: boolean;

  // Deep Mine crystal color choice pending (when ending turn on a deep mine with multiple colors)
  readonly pendingDeepMineChoice: readonly import("./map.js").MineColor[] | null;

  // Crystal Joy reclaim pending (when Crystal Joy card is played this turn)
  // Tracks which version was played to enforce correct card eligibility rules
  readonly pendingCrystalJoyReclaim:
    | { readonly version: "basic" | "powered" }
    | undefined;

  // Steady Tempo deck placement pending (when Steady Tempo is played this turn)
  // Tracks version: basic = bottom of deck (requires non-empty deck), powered = top of deck
  readonly pendingSteadyTempoDeckPlacement:
    | { readonly version: "basic" | "powered" }
    | undefined;

  // Terrain cost reduction pending (Druidic Paths and similar effects)
  // When set, the player must choose a hex coordinate or terrain type for cost reduction
  readonly pendingTerrainCostReduction: PendingTerrainCostReduction | null;

  // Pending unit maintenance at round start (Magic Familiars: pay crystal or disband)
  readonly pendingUnitMaintenance: readonly {
    readonly unitInstanceId: string;
    readonly unitId: import("@mage-knight/shared").UnitId;
  }[] | null;

  // Healing points accumulated this turn (cleared on combat entry per rulebook line 929)
  readonly healingPoints: number;

  // Cure spell tracking (reset at end of turn)
  // Tracks wounds healed from hand this turn (for Cure's card draw bonus)
  readonly woundsHealedFromHandThisTurn: number;
  // Tracks unit instance IDs healed this turn (for Cure's ready bonus)
  readonly unitsHealedThisTurn: readonly string[];

  // Wound immunity active (Veil of Mist spell)
  // When true, the hero ignores the first wound from enemies this turn (including Poison/Paralyze effects)
  // Reset at end of turn; cleared when first wound is ignored
  readonly woundImmunityActive: boolean;

  // Cards that have been removed from the game (destroyed artifacts, etc.)
  readonly removedCards: readonly CardId[];

  // Round Order token flipped (from cooperative assault or PvP this round)
  // Flipped tokens mean the player cannot participate in another cooperative assault this round
  readonly roundOrderTokenFlipped: boolean;

  // Time Bending (Space Bending powered effect) state
  // True during the extra turn granted by Time Bending
  readonly isTimeBentTurn: boolean;
  // Cards set aside by Time Bending for the rest of the round
  // These are excluded from hand/deck/discard and returned at end of round
  readonly timeBendingSetAsideCards: readonly CardId[];

  // Banner of Protection: wounds received this turn
  // Tracks the count of wounds added to hand and discard this turn.
  // Used at end of turn to allow removing received wounds.
  // Does NOT include wounds drawn from deck or wounds on units.
  // Reset at end of turn via playerReset.
  readonly woundsReceivedThisTurn: {
    readonly hand: number;
    readonly discard: number;
  };

  // Banner of Protection: powered effect active this turn
  // When true, at end of turn the player may throw away wounds received this turn.
  readonly bannerOfProtectionActive: boolean;

  // Banner of Protection: pending end-of-turn wound removal choice
  // Set to true when end turn checks detect active banner + received wounds.
  // Player must resolve this before turn can end.
  readonly pendingBannerProtectionChoice: boolean;

  // Crystal Mastery: tracks crystals spent this turn (for powered effect return)
  // Incremented whenever crystals are consumed (mana payment, sacrifice, polarize).
  // NOT incremented for crystal-to-token conversions (crystallize is gain, not spend).
  // Reset at end of turn via playerReset.
  readonly spentCrystalsThisTurn: Crystals;

  // Crystal Mastery: powered effect active this turn
  // When true, at end of turn spent crystals are returned to inventory (capped at 3).
  readonly crystalMasteryPoweredActive: boolean;

  // Source Opening: pending end-of-turn reroll choice for the extra die
  // When set, the player must choose whether to reroll the extra die used via
  // Source Opening before other dice are rerolled (FAQ S3).
  // Stores the die ID so dice management can skip it if player chooses not to reroll.
  readonly pendingSourceOpeningRerollChoice: SourceDieId | null;

  // Meditation spell pending state
  // Set when Meditation/Trance spell is played to track card selection and placement
  readonly pendingMeditation:
    | {
        readonly version: "basic" | "powered";
        readonly phase: "select_cards" | "place_cards";
        readonly selectedCardIds: readonly CardId[];
      }
    | undefined;

  // Meditation spell hand limit bonus
  // Added to hand limit at end-of-turn draw, consumed by getEndTurnDrawLimit()
  readonly meditationHandLimitBonus: number;
}
