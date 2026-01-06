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
} from "@mage-knight/shared";
import type { Hero } from "./hero.js";
import type { CardEffect } from "./cards.js";
import type { PlayerUnit } from "./unit.js";

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
  readonly block: number;
  readonly blockElements: ElementalAttackValues;
  readonly blockSources: readonly BlockSource[];
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

// Helper to create empty combat accumulator
export function createEmptyCombatAccumulator(): CombatAccumulator {
  return {
    attack: {
      normal: 0,
      ranged: 0,
      siege: 0,
      normalElements: createEmptyElementalValues(),
      rangedElements: createEmptyElementalValues(),
      siegeElements: createEmptyElementalValues(),
    },
    block: 0,
    blockElements: createEmptyElementalValues(),
    blockSources: [],
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

// Pending choice - when a card requires player selection
export interface PendingChoice {
  readonly cardId: CardId;
  readonly options: readonly CardEffect[];
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

  // Crystals (max 3 each)
  readonly crystals: Crystals;

  // Tactic selection (per round)
  readonly selectedTactic: TacticId | null; // The tactic chosen for this round
  readonly tacticFlipped: boolean; // Whether the tactic's activated effect has been used

  // Combat state
  readonly knockedOut: boolean;

  // Turn state (resets at end of turn)
  readonly movePoints: number;
  readonly influencePoints: number;
  readonly playArea: readonly CardId[]; // cards played this turn
  readonly pureMana: readonly ManaToken[]; // mana in play area
  readonly usedManaFromSource: boolean;
  readonly usedDieId: string | null; // which die from source was used this turn
  readonly hasMovedThisTurn: boolean; // true once any movement occurs, enforces move-before-action
  readonly hasTakenActionThisTurn: boolean;

  // Combat accumulator (resets at end of combat or end of turn if no combat)
  readonly combatAccumulator: CombatAccumulator;

  // TODO: Should be pendingChoices: PendingChoice[] to allow stacking multiple
  // choice cards before resolution. See validators/index.ts for full explanation.
  readonly pendingChoice: PendingChoice | null;

  // Pending level ups to process at end of turn
  readonly pendingLevelUps: readonly number[]; // Levels crossed this turn

  // Combat tracking (only one combat per turn allowed)
  readonly hasCombattedThisTurn: boolean;

  // Mana usage tracking (for conditional effects)
  readonly manaUsedThisTurn: readonly ManaColor[];
}
