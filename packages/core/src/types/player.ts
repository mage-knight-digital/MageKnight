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
import type { PlayerUnit } from "./unit.js";
import type { SourceDieId } from "./mana.js";

// Mana token in play area (temporary, not crystals)
export interface ManaToken {
  readonly color: ManaColor;
  readonly source: ManaTokenSource;
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
  /** If true, wounds cannot be selected (default: true) */
  readonly filterWounds: boolean;
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

  // Skills
  readonly skills: readonly SkillId[];
  readonly skillCooldowns: SkillCooldowns;
  readonly skillFlipState: SkillFlipState;

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

  // Enemies defeated this turn (for fame bonuses like Sword of Justice)
  // Excludes summoned enemies. Reset at end of turn.
  readonly enemiesDefeatedThisTurn: number;

  // Resting state: true when player has declared rest but not yet completed it
  // While resting, movement/combat/interaction are blocked but cards can still be played
  readonly isResting: boolean;

  // Deep Mine crystal color choice pending (when ending turn on a deep mine with multiple colors)
  readonly pendingDeepMineChoice: readonly import("./map.js").MineColor[] | null;

  // Healing points accumulated this turn (cleared on combat entry per rulebook line 929)
  readonly healingPoints: number;

  // Wound immunity active (Veil of Mist spell)
  // When true, the hero ignores the first wound from enemies this turn (including Poison/Paralyze effects)
  // Reset at end of turn; cleared when first wound is ignored
  readonly woundImmunityActive: boolean;

  // Cards that have been removed from the game (destroyed artifacts, etc.)
  readonly removedCards: readonly CardId[];

  // Round Order token flipped (from cooperative assault or PvP this round)
  // Flipped tokens mean the player cannot participate in another cooperative assault this round
  readonly roundOrderTokenFlipped: boolean;
}
