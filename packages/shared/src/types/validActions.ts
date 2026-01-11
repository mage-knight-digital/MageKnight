/**
 * ValidActions types - defines what actions are currently valid for a player
 *
 * This is the single source of truth for what a player can do.
 * Computed server-side and sent to clients via ClientGameState.
 */

import type { HexCoord, HexDirection } from "../hex.js";
import type { CardId, ManaColor, BasicManaColor } from "../ids.js";
import type { TacticId } from "../tactics.js";
import type { RestType } from "../actions.js";
import type { CombatPhase } from "../combatPhases.js";
import type {
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_MOVE,
  TacticDecisionType,
} from "../valueConstants.js";

// ============================================================================
// Top-level ValidActions structure
// ============================================================================

/**
 * Complete valid actions for a player at a given game state.
 * Sent to clients in ClientGameState.validActions.
 */
export interface ValidActions {
  /** Can this player act right now? */
  readonly canAct: boolean;

  /** Why can't act (only populated if canAct=false) */
  readonly reason: string | undefined;

  /** Movement options (undefined if no movement possible) */
  readonly move: MoveOptions | undefined;

  /** Exploration options (undefined if no exploration possible) */
  readonly explore: ExploreOptions | undefined;

  /** Card play options (undefined if no cards can be played) */
  readonly playCard: PlayCardOptions | undefined;

  /** Combat options (only present when in combat) */
  readonly combat: CombatOptions | undefined;

  /** Unit options (recruitment/activation) */
  readonly units: UnitOptions | undefined;

  /** Site interaction options */
  readonly sites: SiteOptions | undefined;

  /** Mana die/crystal options */
  readonly mana: ManaOptions | undefined;

  /** Turn structure options (end turn, rest, announce end of round) */
  readonly turn: TurnOptions | undefined;

  /** Tactic selection options (only during tactics phase) */
  readonly tactics: TacticsOptions | undefined;

  /** Combat entry options (not in combat yet) */
  readonly enterCombat: EnterCombatOptions | undefined;

  /** Tactic effect options (during player turns) */
  readonly tacticEffects: TacticEffectsOptions | undefined;
}

// ============================================================================
// Movement
// ============================================================================

export interface MoveOptions {
  readonly targets: readonly MoveTarget[];
}

export interface MoveTarget {
  readonly hex: HexCoord;
  readonly cost: number;
}

// ============================================================================
// Exploration
// ============================================================================

export interface ExploreOptions {
  readonly directions: readonly ExploreDirection[];
}

export interface ExploreDirection {
  readonly direction: HexDirection;
  readonly slotIndex?: number; // For wedge maps
  readonly targetCoord: HexCoord; // Where the new tile center would be placed
  readonly fromTileCoord: HexCoord; // The tile center this direction is relative to
}

// ============================================================================
// Card play
// ============================================================================

export interface PlayCardOptions {
  readonly cards: readonly PlayableCard[];
}

export interface PlayableCard {
  readonly cardId: CardId;
  readonly name: string;
  readonly canPlayBasic: boolean;
  readonly canPlayPowered: boolean;
  readonly requiredMana?: ManaColor; // For powered effect
  readonly canPlaySideways: boolean;
  readonly sidewaysOptions?: readonly SidewaysOption[];
  readonly basicEffectDescription: string;
  readonly poweredEffectDescription: string;
}

/** What a card can be played sideways as */
export type SidewaysAs =
  | typeof PLAY_SIDEWAYS_AS_MOVE
  | typeof PLAY_SIDEWAYS_AS_INFLUENCE
  | typeof PLAY_SIDEWAYS_AS_ATTACK
  | typeof PLAY_SIDEWAYS_AS_BLOCK;

export interface SidewaysOption {
  readonly as: SidewaysAs;
  readonly value: number; // How much move/influence/attack/block it provides
}

// ============================================================================
// Combat
// ============================================================================

/** Combat options when already in combat */
export interface CombatOptions {
  readonly phase: CombatPhase;
  readonly canEndPhase: boolean;

  /** Attack options (RANGED_SIEGE or ATTACK phase) */
  readonly attacks?: readonly AttackOption[];

  /** Block options (BLOCK phase) */
  readonly blocks?: readonly BlockOption[];

  /** Damage assignment options (ASSIGN_DAMAGE phase) */
  readonly damageAssignments?: readonly DamageAssignmentOption[];
}

export interface AttackOption {
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  readonly enemyArmor: number;
  readonly isDefeated: boolean;
  readonly isFortified: boolean;
  readonly requiresSiege: boolean;
}

export interface BlockOption {
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  readonly enemyAttack: number;
  readonly requiredBlock: number; // Pre-calculated (2x for Swift)
  readonly isSwift: boolean;
  readonly isBrutal: boolean;
  readonly isBlocked: boolean;
}

export interface DamageAssignmentOption {
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  readonly unassignedDamage: number;
}

// ============================================================================
// Units
// ============================================================================

export interface UnitOptions {
  readonly recruitable: readonly RecruitableUnit[];
  readonly activatable: readonly ActivatableUnit[];
}

export interface RecruitableUnit {
  readonly unitId: string;
  readonly cost: number;
  readonly canAfford: boolean;
}

export interface ActivatableUnit {
  readonly unitInstanceId: string;
  readonly unitId: string;
  readonly abilities: readonly ActivatableAbility[];
}

export interface ActivatableAbility {
  readonly index: number;
  readonly name: string;
  readonly manaCost?: ManaColor;
  readonly canActivate: boolean;
  readonly reason?: string; // Why can't activate
}

// ============================================================================
// Sites
// ============================================================================

export interface SiteOptions {
  readonly canEnter: boolean;
  readonly canInteract: boolean;
  readonly interactOptions?: InteractOptions;
}

export interface InteractOptions {
  readonly canHeal: boolean;
  readonly healCost?: number;
  readonly canRecruit: boolean;
}

// ============================================================================
// Mana
// ============================================================================

export interface ManaOptions {
  readonly availableDice: readonly AvailableDie[];
  readonly canConvertCrystal: boolean;
  readonly convertibleColors: readonly BasicManaColor[];
}

export interface AvailableDie {
  readonly dieId: string;
  readonly color: ManaColor;
}

// ============================================================================
// Turn structure
// ============================================================================

export interface TurnOptions {
  readonly canEndTurn: boolean;
  readonly canAnnounceEndOfRound: boolean;
  readonly canUndo: boolean;
  readonly canRest: boolean;
  readonly restTypes: readonly RestType[] | undefined;
}

// ============================================================================
// Tactics selection (pre-turn phase)
// ============================================================================

export interface TacticsOptions {
  readonly availableTactics: readonly TacticId[];
  readonly isYourTurn: boolean;
}

// ============================================================================
// Tactic effects (during player turns)
// ============================================================================

/**
 * Tactic effect options for the current player.
 * Present when the player has a tactic with actionable effects.
 */
export interface TacticEffectsOptions {
  /** Activated tactics that can be used (flip to use) */
  readonly canActivate?: ActivatableTacticOptions;

  /** Mana Search reroll available */
  readonly canRerollSourceDice?: ManaSearchOptions;

  /** Pending tactic decision that must be resolved */
  readonly pendingDecision?: PendingTacticDecisionInfo;

  /** Before-turn decision required (blocks other actions) */
  readonly beforeTurnRequired?: BeforeTurnTacticInfo;
}

export interface ActivatableTacticOptions {
  /** The Right Moment (Day 6) - extra turn */
  readonly theRightMoment?: boolean;
  /** Long Night (Night 2) - shuffle discard into deck */
  readonly longNight?: boolean;
  /** Midnight Meditation (Night 4) - shuffle hand cards into deck */
  readonly midnightMeditation?: boolean;
}

export interface ManaSearchOptions {
  readonly maxDice: number;
  readonly mustPickDepletedFirst: boolean;
  readonly availableDiceIds: readonly string[];
}

export interface PendingTacticDecisionInfo {
  readonly type: TacticDecisionType;
  /** For preparation: visible deck cards (only sent to owning player) */
  readonly deckSnapshot?: readonly CardId[];
  /** For rethink/midnight_meditation: max selectable cards */
  readonly maxCards?: number;
}

export interface BeforeTurnTacticInfo {
  readonly tacticId: TacticId;
}

// ============================================================================
// Enter combat (before combat starts)
// ============================================================================

export interface EnterCombatOptions {
  readonly availableEnemies: readonly AvailableEnemy[];
}

export interface AvailableEnemy {
  readonly enemyId: string;
  readonly position: HexCoord;
  readonly isFortified: boolean;
}
