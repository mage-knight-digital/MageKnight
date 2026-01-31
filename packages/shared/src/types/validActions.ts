/**
 * ValidActions types - defines what actions are currently valid for a player
 *
 * This is the single source of truth for what a player can do.
 * Computed server-side and sent to clients via ClientGameState.
 */

import type { HexCoord, HexDirection } from "../hex.js";
import type { CardId, ManaColor, BasicManaColor, SkillId } from "../ids.js";
import type { TacticId } from "../tactics.js";
import type { RestType, AttackType, AttackElement } from "../actions.js";
import type { CombatPhase } from "../combatPhases.js";
import type { Element } from "../elements.js";
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

  /** Challenge rampaging enemies from adjacent hex */
  readonly challenge: ChallengeOptions | undefined;

  /** Tactic effect options (during player turns) */
  readonly tacticEffects: TacticEffectsOptions | undefined;

  /** Magical Glade wound discard options (at end of turn) */
  readonly gladeWound: GladeWoundOptions | undefined;

  /** Deep Mine crystal choice options (at end of turn) */
  readonly deepMine: DeepMineOptions | undefined;

  /** Level up reward options (when pending level up rewards exist) */
  readonly levelUpRewards: LevelUpRewardsOptions | undefined;

  /** Cooperative assault options (propose, respond, or cancel) */
  readonly cooperativeAssault: CooperativeAssaultOptions | undefined;

  /** Skill effect options (activatable skills during player turns) */
  readonly skillEffects: SkillEffectsOptions | undefined;
}

// ============================================================================
// Movement
// ============================================================================

export interface MoveOptions {
  /** Adjacent hexes the player can move to immediately (one-hop) */
  readonly targets: readonly MoveTarget[];
  /** All hexes reachable within current move points (multi-hop, optional) */
  readonly reachable?: readonly ReachableHex[];
}

export interface MoveTarget {
  readonly hex: HexCoord;
  readonly cost: number;
  /** Whether entering this hex triggers combat (fortified site, provokes rampaging, etc.) */
  readonly isTerminal?: boolean;
  /** Whether this move would reveal unrevealed enemies at adjacent fortified sites (Day only) */
  readonly wouldRevealEnemies?: boolean;
}

/**
 * A hex that can be reached with current move points.
 * Used for movement range visualization (flood-fill reachability).
 */
export interface ReachableHex {
  /** The reachable hex coordinate */
  readonly hex: HexCoord;
  /** Total movement cost to reach this hex via optimal path */
  readonly totalCost: number;
  /** Whether entering this hex ends movement (triggers combat, fortified site, etc.) */
  readonly isTerminal: boolean;
  /** Whether moving to this hex would reveal unrevealed enemies at adjacent fortified sites (Day only) */
  readonly wouldRevealEnemies?: boolean;
  /** The hex we came from to reach this hex (for path reconstruction) */
  readonly cameFrom?: HexCoord;
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
  readonly requiredMana?: ManaColor; // For powered effect (spell's color, not black)
  readonly isSpell?: boolean; // If true, powered effect needs black + requiredMana
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

  /** Block options (BLOCK phase) - legacy display info */
  readonly blocks?: readonly BlockOption[];

  /** Damage assignment options (ASSIGN_DAMAGE phase) */
  readonly damageAssignments?: readonly DamageAssignmentOption[];

  /** Available attack pool (what player can still assign) */
  readonly availableAttack?: AvailableAttackPool;

  /** Enemy states with pending damage (for incremental attack allocation) */
  readonly enemies?: readonly EnemyAttackState[];

  /** Valid attack assignment actions */
  readonly assignableAttacks?: readonly AssignAttackOption[];

  /** Valid attack unassignment actions */
  readonly unassignableAttacks?: readonly UnassignAttackOption[];

  // ---- Block allocation (BLOCK phase) ----

  /** Available block pool by element (what player can still assign) */
  readonly availableBlock?: AvailableBlockPool;

  /** Enemy states with pending block (for incremental block allocation) */
  readonly enemyBlockStates?: readonly EnemyBlockState[];

  /** Valid block assignment actions */
  readonly assignableBlocks?: readonly AssignBlockOption[];

  /** Valid block unassignment actions */
  readonly unassignableBlocks?: readonly UnassignBlockOption[];
}

export interface BlockOption {
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, which attack this option is for (0-indexed).
   * Undefined for single-attack enemies (backwards compatible).
   */
  readonly attackIndex?: number;
  readonly enemyName: string;
  readonly enemyAttack: number;
  /** Element of this attack (for block efficiency calculation) */
  readonly attackElement?: Element;
  readonly requiredBlock: number; // Pre-calculated (2x for Swift)
  readonly isSwift: boolean;
  readonly isBrutal: boolean;
  readonly isBlocked: boolean;
}

/**
 * Information about a unit that can receive damage during ASSIGN_DAMAGE phase.
 */
export interface UnitDamageTarget {
  /** Unique instance ID for this unit */
  readonly unitInstanceId: string;
  /** Unit type ID (e.g., "peasants", "guardian_golems") */
  readonly unitId: string;
  /** Unit display name */
  readonly unitName: string;
  /** Unit's armor value (damage absorbed per wound) */
  readonly armor: number;
  /** Whether unit has resistance to the attack element */
  readonly isResistantToAttack: boolean;
  /** Whether unit already had damage assigned this combat (can't assign again) */
  readonly alreadyAssignedThisCombat: boolean;
  /** Whether unit is currently wounded */
  readonly isWounded: boolean;
  /** Computed: true if unit can receive damage (!isWounded && !alreadyAssignedThisCombat) */
  readonly canBeAssigned: boolean;
}

export interface DamageAssignmentOption {
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, which attack's damage needs to be assigned (0-indexed).
   * Undefined for single-attack enemies (backwards compatible).
   */
  readonly attackIndex?: number;
  readonly enemyName: string;
  /** Attack's element (physical, fire, ice, cold_fire) */
  readonly attackElement: Element;
  /** Whether enemy has Brutal ability (doubles damage) */
  readonly isBrutal: boolean;
  /** Raw attack value before Brutal modifier */
  readonly rawAttackValue: number;
  /** Total damage to assign (2x if Brutal) */
  readonly totalDamage: number;
  /** @deprecated Use totalDamage instead */
  readonly unassignedDamage: number;
  /** Units available to absorb damage (empty if units not allowed in combat) */
  readonly availableUnits: readonly UnitDamageTarget[];
}

// ============================================================================
// Incremental Attack Assignment (new system)
// ============================================================================

/** Elemental damage values for pending/effective damage */
export interface ElementalDamageValues {
  readonly physical: number;
  readonly fire: number;
  readonly ice: number;
  readonly coldFire: number;
}

/** Available attack pool by type and element */
export interface AvailableAttackPool {
  // Base (physical) attack by type
  readonly ranged: number;
  readonly siege: number;
  readonly melee: number;
  // Elemental attack by type
  readonly fireRanged: number;
  readonly fireSiege: number;
  readonly fireMelee: number;
  readonly iceRanged: number;
  readonly iceSiege: number;
  readonly iceMelee: number;
  readonly coldFireMelee: number;
}

/** Enemy state with pending damage for incremental allocation */
export interface EnemyAttackState {
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  readonly armor: number;
  readonly isDefeated: boolean;
  readonly isFortified: boolean;
  readonly requiresSiege: boolean; // In ranged/siege phase

  /** Raw pending damage (what's been assigned, before resistances) */
  readonly pendingDamage: ElementalDamageValues;

  /** Effective pending damage (after resistances applied by server) */
  readonly effectiveDamage: ElementalDamageValues;

  /** Total effective damage (sum of effectiveDamage) */
  readonly totalEffectiveDamage: number;

  /** Can this enemy be defeated with current pending damage? */
  readonly canDefeat: boolean;

  /** Enemy resistances (for UI to show warnings) */
  readonly resistances: {
    readonly physical: boolean;
    readonly fire: boolean;
    readonly ice: boolean;
  };
}

/** A single valid attack assignment action */
export interface AssignAttackOption {
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

/** A single valid attack unassignment action */
export interface UnassignAttackOption {
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

// ============================================================================
// Incremental Block Assignment (new system)
// ============================================================================

/** Available block pool by element */
export interface AvailableBlockPool {
  readonly physical: number;
  readonly fire: number;
  readonly ice: number;
  readonly coldFire: number;
}

/** Enemy state with pending block for incremental allocation */
export interface EnemyBlockState {
  readonly enemyInstanceId: string;
  readonly enemyName: string;
  readonly enemyAttack: number;
  /** Enemy's attack element (physical, fire, ice, cold_fire) - determines block efficiency */
  readonly attackElement: string;
  readonly requiredBlock: number; // Pre-calculated (2x for Swift)
  readonly isSwift: boolean;
  readonly isBrutal: boolean;
  readonly isBlocked: boolean;
  readonly isDefeated: boolean;

  /** Raw pending block (what's been assigned) */
  readonly pendingBlock: ElementalDamageValues;

  /** Effective pending block (after elemental efficiency) */
  readonly effectiveBlock: number;

  /** Can this enemy be blocked with current pending block? */
  readonly canBlock: boolean;
}

/** A single valid block assignment action */
export interface AssignBlockOption {
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number;
}

/** A single valid block unassignment action */
export interface UnassignBlockOption {
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number;
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

/**
 * Site options for the hex the player is currently on.
 * Provides rich info for UI display and actions.
 */
export interface SiteOptions {
  /** The site type (e.g., "dungeon", "tomb", "village") */
  readonly siteType: string;

  /** Human-readable display name (e.g., "Dungeon", "Mage Tower") */
  readonly siteName: string;

  /** Whether this site has been conquered */
  readonly isConquered: boolean;

  /** Player ID of owner (if conquered fortified site) */
  readonly owner: string | null;

  // --- Adventure Site Entry ---

  /** Can enter this site as an action (adventure sites) */
  readonly canEnter: boolean;

  /** Description of what entering does (e.g., "Fight 1 brown enemy") */
  readonly enterDescription?: string;

  /** Combat restrictions when entering */
  readonly enterRestrictions?: SiteEnterRestrictions;

  /** Reward description for conquering (e.g., "Spell or Artifact") */
  readonly conquestReward?: string;

  // --- Inhabited Site Interaction ---

  /** Can interact with this site (inhabited sites) */
  readonly canInteract: boolean;

  /** Interaction options (healing, recruiting, buying) */
  readonly interactOptions?: InteractOptions;

  // --- Passive Effects ---

  /** Passive effect that triggers at end of turn (e.g., "+1 Blue Crystal") */
  readonly endOfTurnEffect?: string;

  /** Passive effect that triggers at start of turn (e.g., "+1 Gold Mana") */
  readonly startOfTurnEffect?: string;
}

/**
 * Combat restrictions for entering certain sites (dungeons, tombs).
 */
export interface SiteEnterRestrictions {
  /** Night mana rules apply (gold mana unavailable) */
  readonly nightManaRules: boolean;
  /** Units cannot participate in combat */
  readonly unitsAllowed: boolean;
}

/**
 * Interaction options for inhabited sites.
 */
export interface InteractOptions {
  /** Can buy healing here */
  readonly canHeal: boolean;
  /** Influence cost per healing point */
  readonly healCost?: number;
  /** Can recruit units here */
  readonly canRecruit: boolean;
  /** Can buy spells here (conquered Mage Tower) */
  readonly canBuySpells: boolean;
  /** Spell purchase cost */
  readonly spellCost?: number;
  /** Can buy advanced actions here (Monastery) */
  readonly canBuyAdvancedActions: boolean;
  /** Advanced action purchase cost */
  readonly advancedActionCost?: number;
  /** Can burn this monastery */
  readonly canBurnMonastery?: boolean;
  /** Can plunder this village */
  readonly canPlunderVillage?: boolean;
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
  /** @deprecated Use canDeclareRest instead */
  readonly canRest: boolean;
  readonly restTypes: readonly RestType[] | undefined;
  /** Can declare intent to rest (enters resting state) */
  readonly canDeclareRest: boolean;
  /** Can complete rest with card discards (when already in resting state) */
  readonly canCompleteRest: boolean;
  /** Whether player is currently in resting state */
  readonly isResting: boolean;
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
  /** For sparing_power: whether stash option is available (deck not empty) */
  readonly canStash?: boolean;
  /** For sparing_power: number of cards currently stored under tactic */
  readonly storedCount?: number;
  /** For mana_steal: available basic color dice to choose from */
  readonly availableDiceIds?: readonly string[];
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

// ============================================================================
// Challenge rampaging enemies (from adjacent hex)
// ============================================================================

/**
 * Options for challenging rampaging enemies from an adjacent hex.
 * Only present when there are rampaging enemies adjacent to the player.
 */
export interface ChallengeOptions {
  /** Whether the player can challenge (true if targetHexes is non-empty) */
  readonly canChallenge: boolean;
  /** Adjacent hexes containing rampaging enemies that can be challenged */
  readonly targetHexes: readonly HexCoord[];
}

// ============================================================================
// Magical Glade
// ============================================================================

/**
 * Options for Magical Glade wound discard at end of turn.
 * Only present when player is on a Magical Glade and has wounds.
 */
export interface GladeWoundOptions {
  /** Whether wounds exist in hand */
  readonly hasWoundsInHand: boolean;
  /** Whether wounds exist in discard pile */
  readonly hasWoundsInDiscard: boolean;
}

// ============================================================================
// Deep Mine
// ============================================================================

/**
 * Options for Deep Mine crystal color choice at end of turn.
 * Only present when player has a pending deep mine choice.
 */
export interface DeepMineOptions {
  /** Available crystal colors to choose from */
  readonly availableColors: readonly BasicManaColor[];
}

// ============================================================================
// Level Up Rewards
// ============================================================================

/**
 * Options for selecting level up rewards at even levels.
 * Player must choose 1 skill and 1 advanced action.
 *
 * Skill selection mechanics:
 * - 2 skills drawn from hero's personal pool
 * - Can pick one of the drawn skills OR a skill from the common pool
 * - Rejected skill(s) go to common pool
 */
export interface LevelUpRewardsOptions {
  /** The level being resolved (e.g., 2, 4, 6) */
  readonly level: number;
  /** 2 skills drawn from player's hero skill pool */
  readonly drawnSkills: readonly SkillId[];
  /** Skills in the shared common pool (from other players' rejected draws) */
  readonly commonPoolSkills: readonly SkillId[];
  /** Available advanced action cards in the offer */
  readonly availableAAs: readonly CardId[];
}

// ============================================================================
// Cooperative Assault
// ============================================================================

import type { CityColor, EnemyDistribution } from "../cooperativeAssault.js";

/**
 * Eligible invitee for cooperative assault.
 */
export interface EligibleInvitee {
  readonly playerId: string;
  readonly playerName: string;
}

/**
 * Cooperative assault options for the current player.
 * Present when the player can propose, respond to, or cancel a cooperative assault.
 */
export interface CooperativeAssaultOptions {
  /** Cities that can be targeted (adjacent and not conquered) */
  readonly targetableCities: readonly CityColor[];

  /** Eligible players to invite for each targetable city */
  readonly eligibleInvitees: Partial<Record<CityColor, readonly EligibleInvitee[]>>;

  /** Number of enemies in garrison for each targetable city */
  readonly garrisonSizes: Partial<Record<CityColor, number>>;

  /** Can cancel current proposal (only if initiator) */
  readonly canCancelProposal: boolean;

  /** Can respond to current proposal (only if invitee who hasn't responded) */
  readonly canRespondToProposal: boolean;

  /** Pending proposal details (if any) */
  readonly pendingProposal?: {
    readonly initiatorId: string;
    readonly targetCity: CityColor;
    readonly distribution: readonly EnemyDistribution[];
    /** Enemy count assigned to this player in the proposal */
    readonly assignedEnemyCount: number;
  };
}

// ============================================================================
// Skill Effects
// ============================================================================

/**
 * Options for activating skills during player turns.
 * Present when the player has skills that can be activated.
 */
export interface SkillEffectsOptions {
  /** Skills that can be activated (not on cooldown, have effects) */
  readonly activatableSkills: readonly ActivatableSkill[];
}

/**
 * A skill that can be activated by the player.
 */
export interface ActivatableSkill {
  /** The skill identifier */
  readonly skillId: SkillId;
  /** Human-readable skill name */
  readonly name: string;
  /** Skill description/effect text */
  readonly description: string;
}
