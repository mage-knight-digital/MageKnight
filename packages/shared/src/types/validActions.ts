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
import type { CombatType } from "../combatTypes.js";
import type { Element } from "../elements.js";
import type {
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_MOVE,
  TacticDecisionType,
} from "../valueConstants.js";

// ============================================================================
// ValidActions discriminated union (state machine)
// ============================================================================
//
// Shared mixins and blocking turn options are defined after their constituent
// types (TurnOptions, ManaOptions, etc.). State interfaces and union follow.

/** Turn options available during pending/blocking states. Typically only undo is available. */
export interface BlockingTurnOptions {
  readonly canUndo: boolean;
}

/** Mixin for states that allow mana operations. */
export interface HasManaOptions {
  readonly mana: ManaOptions;
}

/** Mixin for states that allow skill activation. */
export interface HasSkillOptions {
  readonly skills: SkillOptions | undefined;
}

/** Mixin for states that allow card play. */
export interface HasCardOptions {
  readonly playCard: PlayCardOptions | undefined;
}

/** Mixin for states that allow unit operations. */
export interface HasUnitOptions {
  readonly units: UnitOptions | undefined;
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

  // ---- Cumbersome options (BLOCK phase) ----

  /** Cumbersome enemies that can have move points spent on them */
  readonly cumbersomeOptions?: readonly CumbersomeOption[];

  /** Available move points for Cumbersome reduction */
  readonly availableMovePoints?: number;

  // ---- Move-to-attack conversion (Agility card) ----

  /** Move-to-attack conversion options during RANGED_SIEGE and ATTACK phases */
  readonly moveToAttackConversions?: readonly MoveToAttackConversionOption[];

  /** Available move points for conversion */
  readonly availableMovePointsForConversion?: number;

  // ---- Heroes assault influence payment (fortified site assaults) ----

  /** Whether player can pay 2 Influence to allow Heroes to use abilities */
  readonly canPayHeroesAssaultInfluence?: boolean;

  /** Cost to enable Heroes abilities (always 2) */
  readonly heroesAssaultInfluenceCost?: number;

  /** Whether Heroes assault influence has already been paid this combat */
  readonly heroesAssaultInfluencePaid?: boolean;

  // ---- Thugs damage influence payment ----

  /** Thugs units that need influence payment before damage can be assigned */
  readonly thugsDamagePaymentOptions?: readonly ThugsDamagePaymentOption[];
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
  /** Computed: true if unit can receive damage (!isWounded && !alreadyAssignedThisCombat && influence paid if required) */
  readonly canBeAssigned: boolean;
  /** Whether this unit requires influence payment before damage can be assigned (Thugs) */
  readonly requiresInfluencePayment?: boolean;
  /** Whether the influence payment has been made for this unit this combat */
  readonly influencePaymentMade?: boolean;
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
  /** When true, damage MUST go to the redirect unit (Taunt). Hero cannot be targeted. */
  readonly damageRedirectOnly?: boolean;
}

// ============================================================================
// Thugs Damage Influence Payment
// ============================================================================

/**
 * Information about a Thugs unit that requires influence payment
 * before damage can be assigned to it.
 */
export interface ThugsDamagePaymentOption {
  /** Unit instance ID */
  readonly unitInstanceId: string;
  /** Unit display name */
  readonly unitName: string;
  /** Influence cost to pay (always 2) */
  readonly cost: number;
  /** Whether the player can afford to pay */
  readonly canAfford: boolean;
  /** Whether payment has already been made this combat */
  readonly alreadyPaid: boolean;
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
// Cumbersome Ability (BLOCK phase)
// ============================================================================

/**
 * Information about a Cumbersome enemy that can have move points spent on it.
 * Present during BLOCK phase when there are Cumbersome enemies.
 */
export interface CumbersomeOption {
  /** Instance ID of the enemy with Cumbersome ability */
  readonly enemyInstanceId: string;
  /** Enemy display name */
  readonly enemyName: string;
  /** Base attack value (before any reductions) */
  readonly baseAttack: number;
  /** Move points already spent on this enemy */
  readonly currentReduction: number;
  /** Current attack value after reduction (baseAttack - currentReduction) */
  readonly reducedAttack: number;
  /** Maximum additional move points that can be spent (min of playerMovePoints, reducedAttack) */
  readonly maxAdditionalReduction: number;
}

// ============================================================================
// Move-to-Attack Conversion (Agility card, RANGED_SIEGE/ATTACK phases)
// ============================================================================

/**
 * Information about an available move-to-attack conversion option.
 * Present during RANGED_SIEGE and ATTACK phases when a conversion modifier is active.
 */
export interface MoveToAttackConversionOption {
  /** Type of attack gained from conversion */
  readonly attackType: "melee" | "ranged";
  /** Move points required per 1 attack point */
  readonly costPerPoint: number;
  /** Maximum attack points that can be gained (floor(availableMove / cost)) */
  readonly maxAttackGainable: number;
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
// Discard as Cost
// ============================================================================

/**
 * Options for discard as cost resolution (e.g., Improvisation).
 * Only present when player has a pending discard cost.
 */
export interface DiscardCostOptions {
  /** Source card that triggered the discard */
  readonly sourceCardId: CardId;
  /** Cards available to discard (filtered based on rules, e.g., no wounds) */
  readonly availableCardIds: readonly CardId[];
  /** How many cards must be selected */
  readonly count: number;
  /** If true, player can skip discarding */
  readonly optional: boolean;
}

// ============================================================================
// Discard for Attack (Sword of Justice)
// ============================================================================

/**
 * Options for discard for attack resolution (Sword of Justice basic effect).
 * Only present when player has a pending discard for attack state.
 * Unlike DiscardCostOptions, the player can discard 0 or more cards.
 */
export interface DiscardForAttackOptions {
  /** Source card that triggered the discard-for-attack */
  readonly sourceCardId: CardId;
  /** Cards available to discard (non-wound cards in hand) */
  readonly availableCardIds: readonly CardId[];
  /** Attack gained per card discarded */
  readonly attackPerCard: number;
  /** Combat type for the attack (e.g., melee) */
  readonly combatType: CombatType;
}

// ============================================================================
// Discard for Crystal (Savage Harvesting)
// ============================================================================

/**
 * Options for discard for crystal resolution (Savage Harvesting card effect).
 * Only present when player has a pending discard-for-crystal state.
 * Player can discard one non-wound card to gain a crystal.
 */
export interface DiscardForCrystalOptions {
  /** Source card that triggered the discard-for-crystal */
  readonly sourceCardId: CardId;
  /** Cards available to discard (non-wound cards in hand) */
  readonly availableCardIds: readonly CardId[];
  /** Whether the discard is optional (can skip) */
  readonly optional: boolean;
}

/**
 * Options for artifact crystal color selection (second step of Savage Harvesting).
 * Only present when an artifact was discarded and player must choose a crystal color.
 */
export interface ArtifactCrystalColorOptions {
  /** Available crystal colors to choose from */
  readonly availableColors: readonly BasicManaColor[];
}

// ============================================================================
// Crystal Joy Reclaim
// ============================================================================

/**
 * Options for Crystal Joy reclaim at end of turn.
 * Only present when player has a pending Crystal Joy reclaim choice.
 * Player can optionally discard a card from discard pile to return Crystal Joy to hand.
 */
export interface CrystalJoyReclaimOptions {
  /** Which version of Crystal Joy was played (determines card eligibility) */
  readonly version: "basic" | "powered";
  /** Cards in discard pile eligible to be discarded for the reclaim */
  readonly eligibleCardIds: readonly CardId[];
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
// Terrain Cost Reduction
// ============================================================================

export interface HexCostReductionOptions {
  /** Available hexes where cost reduction can be applied */
  readonly availableCoordinates: readonly HexCoord[];
  /** Cost reduction amount (e.g., -1) */
  readonly reduction: number;
  /** Minimum cost after reduction (e.g., 2) */
  readonly minimumCost: number;
}

export interface TerrainCostReductionOptions {
  /** Available terrain types for cost reduction */
  readonly availableTerrains: readonly string[];
  /** Cost reduction amount (e.g., -1) */
  readonly reduction: number;
  /** Minimum cost after reduction (e.g., 2) */
  readonly minimumCost: number;
}

export interface PendingHexCostReductionState {
  readonly mode: "pending_hex_cost_reduction";
  readonly turn: BlockingTurnOptions;
  readonly hexCostReduction: HexCostReductionOptions;
}

export interface PendingTerrainCostReductionState {
  readonly mode: "pending_terrain_cost_reduction";
  readonly turn: BlockingTurnOptions;
  readonly terrainCostReduction: TerrainCostReductionOptions;
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
// Banners
// ============================================================================

/** A banner that can be assigned from hand */
export interface AssignableBanner {
  readonly bannerCardId: CardId;
  readonly targetUnits: readonly string[];
}

/** Banner assignment options for the current player */
export interface BannerOptions {
  readonly assignable: readonly AssignableBanner[];
}

// ============================================================================
// Skills
// ============================================================================

/**
 * Options for activating skills.
 * Only shows skills that can currently be activated (not on cooldown).
 */
export interface SkillOptions {
  /** Skills that can be activated this turn */
  readonly activatable: readonly ActivatableSkill[];
}

/**
 * A skill that can be activated.
 */
export interface ActivatableSkill {
  /** Skill ID */
  readonly skillId: SkillId;
  /** Display name */
  readonly name: string;
  /** Short description of the skill's effect */
  readonly description: string;
}

// ============================================================================
// ValidActions state interfaces (discriminated union)
// ============================================================================

export interface CannotActState {
  readonly mode: "cannot_act";
  readonly reason: string;
}

export interface TacticsSelectionState {
  readonly mode: "tactics_selection";
  readonly tactics: TacticsOptions;
}

export interface PendingTacticDecisionState {
  readonly mode: "pending_tactic_decision";
  readonly tacticDecision: PendingTacticDecisionInfo;
}

export interface PendingGladeWoundState {
  readonly mode: "pending_glade_wound";
  readonly turn: BlockingTurnOptions;
  readonly gladeWound: GladeWoundOptions;
}

export interface PendingDeepMineState {
  readonly mode: "pending_deep_mine";
  readonly turn: BlockingTurnOptions;
  readonly deepMine: DeepMineOptions;
}

export interface PendingDiscardCostState {
  readonly mode: "pending_discard_cost";
  readonly turn: BlockingTurnOptions;
  readonly discardCost: DiscardCostOptions;
}

export interface PendingDiscardForAttackState {
  readonly mode: "pending_discard_for_attack";
  readonly turn: BlockingTurnOptions;
  readonly discardForAttack: DiscardForAttackOptions;
}

export interface PendingDiscardForCrystalState {
  readonly mode: "pending_discard_for_crystal";
  readonly turn: BlockingTurnOptions;
  readonly discardForCrystal: DiscardForCrystalOptions;
}

export interface PendingArtifactCrystalColorState {
  readonly mode: "pending_artifact_crystal_color";
  readonly turn: BlockingTurnOptions;
  readonly artifactCrystalColor: ArtifactCrystalColorOptions;
}

export interface PendingCrystalJoyState {
  readonly mode: "pending_crystal_joy_reclaim";
  readonly turn: BlockingTurnOptions;
  readonly crystalJoyReclaim: CrystalJoyReclaimOptions;
}

export interface PendingLevelUpState {
  readonly mode: "pending_level_up";
  readonly turn: BlockingTurnOptions;
  readonly levelUpRewards: LevelUpRewardsOptions;
}

export interface PendingChoiceState {
  readonly mode: "pending_choice";
  readonly turn: BlockingTurnOptions;
}

export interface CombatState
  extends HasManaOptions,
    HasSkillOptions,
    HasCardOptions,
    HasUnitOptions {
  readonly mode: "combat";
  readonly turn: BlockingTurnOptions;
  readonly combat: CombatOptions;
}

export interface NormalTurnState
  extends HasManaOptions,
    HasSkillOptions,
    HasCardOptions,
    HasUnitOptions {
  readonly mode: "normal_turn";
  readonly turn: TurnOptions;
  readonly move: MoveOptions | undefined;
  readonly explore: ExploreOptions | undefined;
  readonly sites: SiteOptions | undefined;
  readonly challenge: ChallengeOptions | undefined;
  readonly tacticEffects: TacticEffectsOptions | undefined;
  readonly cooperativeAssault: CooperativeAssaultOptions | undefined;
  readonly banners: BannerOptions | undefined;
}

/**
 * ValidActions as a discriminated union.
 * The `mode` field determines which shape is active.
 */
export type ValidActions =
  | CannotActState
  | TacticsSelectionState
  | PendingTacticDecisionState
  | PendingGladeWoundState
  | PendingDeepMineState
  | PendingDiscardCostState
  | PendingDiscardForAttackState
  | PendingDiscardForCrystalState
  | PendingArtifactCrystalColorState
  | PendingCrystalJoyState
  | PendingLevelUpState
  | PendingChoiceState
  | PendingHexCostReductionState
  | PendingTerrainCostReductionState
  | CombatState
  | NormalTurnState;

/** All possible mode values. */
export type ValidActionsMode = ValidActions["mode"];

// ============================================================================
// Type guards
// ============================================================================

export function canAct(
  state: ValidActions
): state is Exclude<ValidActions, CannotActState> {
  return state.mode !== "cannot_act";
}

export function isNormalTurn(state: ValidActions): state is NormalTurnState {
  return state.mode === "normal_turn";
}

export function isCombat(state: ValidActions): state is CombatState {
  return state.mode === "combat";
}

export function isPendingState(state: ValidActions): boolean {
  return state.mode.startsWith("pending_");
}

export function isBlockingState(state: ValidActions): boolean {
  return state.mode !== "normal_turn" && state.mode !== "cannot_act";
}

/**
 * Get skills options when in combat or normal turn; undefined otherwise.
 */
export function getSkillsFromValidActions(
  state: ValidActions
): SkillOptions | undefined {
  return state.mode === "combat" || state.mode === "normal_turn"
    ? state.skills
    : undefined;
}
