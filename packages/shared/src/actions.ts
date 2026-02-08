/**
 * Player action types - discriminated union for all actions a player can take
 */

import type { HexCoord, HexDirection } from "./hex.js";
import type { CardId, SkillId, BasicManaColor, ManaColor } from "./ids.js";
import type { UnitId, RecruitmentSource } from "./units/index.js";
import type { ManaSourceType, SparingPowerChoice } from "./valueConstants.js";
import type { EnemyId } from "./enemies/index.js";
import type { CombatType } from "./combatTypes.js";
import type { Element } from "./elements.js";
import type { TacticId } from "./tactics.js";
import {
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_MOVE,
  TACTIC_DECISION_MANA_STEAL,
  TACTIC_DECISION_MIDNIGHT_MEDITATION,
  TACTIC_DECISION_PREPARATION,
  TACTIC_DECISION_RETHINK,
  TACTIC_DECISION_SPARING_POWER,
} from "./valueConstants.js";

// Movement actions
export const MOVE_ACTION = "MOVE" as const;
export interface MoveAction {
  readonly type: typeof MOVE_ACTION;
  readonly target: HexCoord;
}

export const EXPLORE_ACTION = "EXPLORE" as const;
export interface ExploreAction {
  readonly type: typeof EXPLORE_ACTION;
  readonly direction: HexDirection;
  readonly fromTileCoord: HexCoord;
}

// Adventure site actions
export const ENTER_SITE_ACTION = "ENTER_SITE" as const;
export interface EnterSiteAction {
  readonly type: typeof ENTER_SITE_ACTION;
}

// Burn monastery action
export const BURN_MONASTERY_ACTION = "BURN_MONASTERY" as const;
export interface BurnMonasteryAction {
  readonly type: typeof BURN_MONASTERY_ACTION;
}

// Plunder village action
export const PLUNDER_VILLAGE_ACTION = "PLUNDER_VILLAGE" as const;
export interface PlunderVillageAction {
  readonly type: typeof PLUNDER_VILLAGE_ACTION;
}

// Turn structure actions
export const END_TURN_ACTION = "END_TURN" as const;
export interface EndTurnAction {
  readonly type: typeof END_TURN_ACTION;
}

/**
 * @deprecated Use DECLARE_REST_ACTION and COMPLETE_REST_ACTION instead.
 * Kept for backward compatibility with existing tests.
 */
export const REST_ACTION = "REST" as const;

// Rest type constants
export const REST_TYPE_STANDARD = "standard" as const;
export const REST_TYPE_SLOW_RECOVERY = "slow_recovery" as const;

export type RestType = typeof REST_TYPE_STANDARD | typeof REST_TYPE_SLOW_RECOVERY;

/**
 * @deprecated Use DeclareRestAction and CompleteRestAction instead.
 * Kept for backward compatibility with existing tests.
 */
export interface RestAction {
  readonly type: typeof REST_ACTION;
  readonly restType: RestType;
  readonly discardCardIds: readonly CardId[];
  readonly announceEndOfRound?: boolean; // Signal to other players
}

// New two-phase rest actions (per rulebook FAQ p.30)
// Resting is a STATE where player can still play cards before completing

export const DECLARE_REST_ACTION = "DECLARE_REST" as const;
/**
 * Declares intent to rest. Enters isResting state.
 * While resting: movement, combat initiation, and interaction are blocked.
 * Card play is still allowed (healing, special effects, influence for AAs).
 */
export interface DeclareRestAction {
  readonly type: typeof DECLARE_REST_ACTION;
}

export const COMPLETE_REST_ACTION = "COMPLETE_REST" as const;
/**
 * Completes the rest by discarding cards.
 * Rest type is determined automatically based on hand at completion:
 * - Standard Rest: exactly 1 non-wound + any wounds (if hand has non-wounds)
 * - Slow Recovery: exactly 1 wound (if hand has only wounds OR all wounds healed)
 */
export interface CompleteRestAction {
  readonly type: typeof COMPLETE_REST_ACTION;
  readonly discardCardIds: readonly CardId[];
  readonly announceEndOfRound?: boolean; // Signal to other players
}

export const INTERACT_ACTION = "INTERACT" as const;
export interface InteractAction {
  readonly type: typeof INTERACT_ACTION;
  // Interaction purchases
  readonly healing?: number; // Healing points to buy
  readonly recruitUnitId?: UnitId; // Unit to recruit (if any) - alternative to RecruitUnitAction
  // Future: spellId, advancedActionId, artifactId
}

export const ANNOUNCE_END_OF_ROUND_ACTION = "ANNOUNCE_END_OF_ROUND" as const;
export interface AnnounceEndOfRoundAction {
  readonly type: typeof ANNOUNCE_END_OF_ROUND_ACTION;
}

// Cooperative assault actions
import type { CityColor, EnemyDistribution } from "./cooperativeAssault.js";

export const PROPOSE_COOPERATIVE_ASSAULT_ACTION = "PROPOSE_COOPERATIVE_ASSAULT" as const;
export interface ProposeCooperativeAssaultAction {
  readonly type: typeof PROPOSE_COOPERATIVE_ASSAULT_ACTION;
  readonly targetCity: CityColor;
  readonly invitedPlayerIds: readonly string[];
  readonly distribution: readonly EnemyDistribution[];
}

export const RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION = "RESPOND_TO_COOPERATIVE_PROPOSAL" as const;
export const COOPERATIVE_RESPONSE_ACCEPT = "accept" as const;
export const COOPERATIVE_RESPONSE_DECLINE = "decline" as const;
export type CooperativeResponse =
  | typeof COOPERATIVE_RESPONSE_ACCEPT
  | typeof COOPERATIVE_RESPONSE_DECLINE;

export interface RespondToCooperativeProposalAction {
  readonly type: typeof RESPOND_TO_COOPERATIVE_PROPOSAL_ACTION;
  readonly response: CooperativeResponse;
}

export const CANCEL_COOPERATIVE_PROPOSAL_ACTION = "CANCEL_COOPERATIVE_PROPOSAL" as const;
export interface CancelCooperativeProposalAction {
  readonly type: typeof CANCEL_COOPERATIVE_PROPOSAL_ACTION;
}

// Card playing actions
export const PLAY_CARD_ACTION = "PLAY_CARD" as const;

// Info about the mana source used to power a card
export interface ManaSourceInfo {
  readonly type: ManaSourceType;
  readonly color: ManaColor;
  readonly dieId?: string; // Required when type is "die"
}

export interface PlayCardAction {
  readonly type: typeof PLAY_CARD_ACTION;
  readonly cardId: CardId;
  readonly powered: boolean;
  /**
   * Single mana source for action cards (powered by one mana).
   * Required when powered is true for action cards.
   */
  readonly manaSource?: ManaSourceInfo;
  /**
   * Multiple mana sources for spells (require black + color mana).
   * Required when powered is true for spell cards.
   * When provided, manaSource is ignored.
   */
  readonly manaSources?: readonly ManaSourceInfo[];
}

export const PLAY_CARD_SIDEWAYS_ACTION = "PLAY_CARD_SIDEWAYS" as const;
export interface PlayCardSidewaysAction {
  readonly type: typeof PLAY_CARD_SIDEWAYS_ACTION;
  readonly cardId: CardId;
  readonly as:
    | typeof PLAY_SIDEWAYS_AS_MOVE
    | typeof PLAY_SIDEWAYS_AS_INFLUENCE
    | typeof PLAY_SIDEWAYS_AS_ATTACK
    | typeof PLAY_SIDEWAYS_AS_BLOCK;
}

// Mana usage actions
export const USE_MANA_DIE_ACTION = "USE_MANA_DIE" as const;
export interface UseManaDeieAction {
  readonly type: typeof USE_MANA_DIE_ACTION;
  readonly dieId: string;
}

export const CONVERT_CRYSTAL_ACTION = "CONVERT_CRYSTAL" as const;
export interface ConvertCrystalAction {
  readonly type: typeof CONVERT_CRYSTAL_ACTION;
  readonly color: BasicManaColor;
}

// Unit activation
export const ACTIVATE_UNIT_ACTION = "ACTIVATE_UNIT" as const;
export interface ActivateUnitAction {
  readonly type: typeof ACTIVATE_UNIT_ACTION;
  readonly unitInstanceId: string;
  readonly abilityIndex: number;
  /**
   * Mana source used to pay for abilities with manaCost.
   * Required when the ability has a manaCost defined.
   */
  readonly manaSource?: ManaSourceInfo;
}

// Skill usage
export const USE_SKILL_ACTION = "USE_SKILL" as const;
export interface UseSkillAction {
  readonly type: typeof USE_SKILL_ACTION;
  readonly skillId: SkillId;
}

// Return interactive skill from center (e.g., Prayer of Weather)
export const RETURN_INTERACTIVE_SKILL_ACTION = "RETURN_INTERACTIVE_SKILL" as const;
export interface ReturnInteractiveSkillAction {
  readonly type: typeof RETURN_INTERACTIVE_SKILL_ACTION;
  readonly skillId: SkillId;
}

// Interaction actions
export const RECRUIT_UNIT_ACTION = "RECRUIT_UNIT" as const;
export interface RecruitUnitAction {
  readonly type: typeof RECRUIT_UNIT_ACTION;
  readonly unitId: UnitId;
  readonly influenceSpent: number; // Must meet unit's cost
  /**
   * Source of recruitment - determines which special rules apply.
   * Defaults to "normal" if not specified (standard recruitment at a site).
   * "artifact" or "spell" bypass Heroes/Thugs special rules.
   */
  readonly source?: RecruitmentSource;
  /**
   * Mana source used to pay for Magic Familiars recruitment.
   * Required when recruiting a unit with restrictedFromFreeRecruit.
   */
  readonly manaSource?: ManaSourceInfo;
  /**
   * The basic mana color to place as a token on the unit (Magic Familiars).
   * Required when recruiting Magic Familiars. Gold mana can be used but
   * this specifies which basic color the token becomes.
   */
  readonly manaTokenColor?: BasicManaColor;
}

export const DISBAND_UNIT_ACTION = "DISBAND_UNIT" as const;
export interface DisbandUnitAction {
  readonly type: typeof DISBAND_UNIT_ACTION;
  readonly unitInstanceId: string;
}

// Banner assignment actions
export const ASSIGN_BANNER_ACTION = "ASSIGN_BANNER" as const;
export interface AssignBannerAction {
  readonly type: typeof ASSIGN_BANNER_ACTION;
  readonly bannerCardId: CardId;
  readonly targetUnitInstanceId: string;
}

// Banner of Fear: cancel one enemy attack during block phase
export const USE_BANNER_FEAR_ACTION = "USE_BANNER_FEAR" as const;
/**
 * Spend a unit with Banner of Fear attached to cancel one enemy attack.
 * Usable during block phase. Unit must be ready and unwounded.
 * Cancels one attack (not block — Elusive armor still applies).
 * Grants Fame +1. Does not work on Arcane Immune enemies.
 */
export interface UseBannerFearAction {
  readonly type: typeof USE_BANNER_FEAR_ACTION;
  readonly unitInstanceId: string;
  readonly targetEnemyInstanceId: string;
  /** For multi-attack enemies, which attack index to cancel (default: 0) */
  readonly attackIndex?: number;
}

// Heroes special rule: pay influence for assault abilities
export const PAY_HEROES_ASSAULT_INFLUENCE_ACTION = "PAY_HEROES_ASSAULT_INFLUENCE" as const;
/**
 * Pay 2 influence to allow Heroes units to use abilities during
 * fortified site assaults. Per rulebook, Heroes refuse to participate
 * in assaults on Keeps, Mage Towers, and Cities without this payment.
 */
export interface PayHeroesAssaultInfluenceAction {
  readonly type: typeof PAY_HEROES_ASSAULT_INFLUENCE_ACTION;
}

// Thugs special rule: pay influence to assign damage to Thugs unit
export const PAY_THUGS_DAMAGE_INFLUENCE_ACTION = "PAY_THUGS_DAMAGE_INFLUENCE" as const;
/**
 * Pay 2 influence to allow combat damage to be assigned to a specific Thugs unit.
 * Per rulebook: Thugs are not willing to take damage unless you pay 2 Influence.
 * Payment is per-unit, per-combat.
 */
export interface PayThugsDamageInfluenceAction {
  readonly type: typeof PAY_THUGS_DAMAGE_INFLUENCE_ACTION;
  readonly unitInstanceId: string;
}

export const BUY_SPELL_ACTION = "BUY_SPELL" as const;
/**
 * Buy a spell from the spell offer at a conquered Mage Tower.
 * Costs 7 influence points.
 */
export interface BuySpellAction {
  readonly type: typeof BUY_SPELL_ACTION;
  readonly cardId: CardId;
}

export const LEARN_ADVANCED_ACTION_ACTION = "LEARN_ADVANCED_ACTION" as const;
export interface LearnAdvancedActionAction {
  readonly type: typeof LEARN_ADVANCED_ACTION_ACTION;
  readonly cardId: CardId;
  readonly fromMonastery: boolean;
}

export const BUY_HEALING_ACTION = "BUY_HEALING" as const;
export interface BuyHealingAction {
  readonly type: typeof BUY_HEALING_ACTION;
  readonly amount: number;
}

// Tactics selection
export const SELECT_TACTIC_ACTION = "SELECT_TACTIC" as const;
export interface SelectTacticAction {
  readonly type: typeof SELECT_TACTIC_ACTION;
  readonly tacticId: TacticId;
}

// Tactic effect actions
export const ACTIVATE_TACTIC_ACTION = "ACTIVATE_TACTIC" as const;
export interface ActivateTacticAction {
  readonly type: typeof ACTIVATE_TACTIC_ACTION;
  readonly tacticId: TacticId;
}

export const RESOLVE_TACTIC_DECISION_ACTION = "RESOLVE_TACTIC_DECISION" as const;

// Payload types for different tactic decisions
export type ResolveTacticDecisionPayload =
  | { readonly type: typeof TACTIC_DECISION_RETHINK; readonly cardIds: readonly CardId[] }
  | { readonly type: typeof TACTIC_DECISION_MANA_STEAL; readonly dieId: string }
  | { readonly type: typeof TACTIC_DECISION_PREPARATION; readonly cardId: CardId }
  | { readonly type: typeof TACTIC_DECISION_MIDNIGHT_MEDITATION; readonly cardIds: readonly CardId[] }
  | {
      readonly type: typeof TACTIC_DECISION_SPARING_POWER;
      readonly choice: SparingPowerChoice;
    };

export interface ResolveTacticDecisionAction {
  readonly type: typeof RESOLVE_TACTIC_DECISION_ACTION;
  readonly decision: ResolveTacticDecisionPayload;
}

export const REROLL_SOURCE_DICE_ACTION = "REROLL_SOURCE_DICE" as const;
export interface RerollSourceDiceAction {
  readonly type: typeof REROLL_SOURCE_DICE_ACTION;
  readonly dieIds: readonly string[];
}

// Undo action
export const UNDO_ACTION = "UNDO" as const;
export interface UndoAction {
  readonly type: typeof UNDO_ACTION;
}

// Choice resolution action
export const RESOLVE_CHOICE_ACTION = "RESOLVE_CHOICE" as const;
export interface ResolveChoiceAction {
  readonly type: typeof RESOLVE_CHOICE_ACTION;
  readonly choiceIndex: number; // Which option to choose (0, 1, etc.)
}

// Terrain cost reduction actions (for Druidic Paths and similar effects)
export const RESOLVE_HEX_COST_REDUCTION_ACTION = "RESOLVE_HEX_COST_REDUCTION" as const;
export interface ResolveHexCostReductionAction {
  readonly type: typeof RESOLVE_HEX_COST_REDUCTION_ACTION;
  readonly coordinate: HexCoord;
}

export const RESOLVE_TERRAIN_COST_REDUCTION_ACTION = "RESOLVE_TERRAIN_COST_REDUCTION" as const;
export interface ResolveTerrainCostReductionAction {
  readonly type: typeof RESOLVE_TERRAIN_COST_REDUCTION_ACTION;
  readonly terrain: string; // Terrain type identifier
}

// Level up rewards choice action
export const CHOOSE_LEVEL_UP_REWARDS_ACTION = "CHOOSE_LEVEL_UP_REWARDS" as const;
export interface ChooseLevelUpRewardsAction {
  readonly type: typeof CHOOSE_LEVEL_UP_REWARDS_ACTION;
  readonly level: number;
  readonly skillChoice: {
    readonly fromCommonPool: boolean;
    readonly skillId: string;
  };
  readonly advancedActionId: string;
}

// Site reward selection action
export const SELECT_REWARD_ACTION = "SELECT_REWARD" as const;
export interface SelectRewardAction {
  readonly type: typeof SELECT_REWARD_ACTION;
  readonly cardId: CardId; // The card selected from the offer
  readonly rewardIndex: number; // Which pending reward this selection is for (0 = first)
}

// Magical Glade wound discard choice
export const RESOLVE_GLADE_WOUND_ACTION = "RESOLVE_GLADE_WOUND" as const;
export const GLADE_WOUND_CHOICE_HAND = "hand" as const;
export const GLADE_WOUND_CHOICE_DISCARD = "discard" as const;
export const GLADE_WOUND_CHOICE_SKIP = "skip" as const;
export type GladeWoundChoice =
  | typeof GLADE_WOUND_CHOICE_HAND
  | typeof GLADE_WOUND_CHOICE_DISCARD
  | typeof GLADE_WOUND_CHOICE_SKIP;
export interface ResolveGladeWoundAction {
  readonly type: typeof RESOLVE_GLADE_WOUND_ACTION;
  readonly choice: GladeWoundChoice;
}

// Unit maintenance at round start (Magic Familiars: pay crystal or disband)
export const RESOLVE_UNIT_MAINTENANCE_ACTION = "RESOLVE_UNIT_MAINTENANCE" as const;
export interface ResolveUnitMaintenanceAction {
  readonly type: typeof RESOLVE_UNIT_MAINTENANCE_ACTION;
  readonly unitInstanceId: string;
  /** true = pay crystal to keep unit, false = disband */
  readonly keepUnit: boolean;
  /** Crystal color to pay (required when keepUnit is true) */
  readonly crystalColor?: BasicManaColor;
  /** New mana token color to place on unit (required when keepUnit is true) */
  readonly newManaTokenColor?: BasicManaColor;
}

// Deep Mine crystal color choice
export const RESOLVE_DEEP_MINE_ACTION = "RESOLVE_DEEP_MINE" as const;
export interface ResolveDeepMineAction {
  readonly type: typeof RESOLVE_DEEP_MINE_ACTION;
  readonly color: BasicManaColor; // The chosen crystal color
}

// Crystal Joy card reclaim action (end-of-turn choice to reclaim card to hand)
export const RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION = "RESOLVE_CRYSTAL_JOY_RECLAIM" as const;
export interface ResolveCrystalJoyReclaimAction {
  readonly type: typeof RESOLVE_CRYSTAL_JOY_RECLAIM_ACTION;
  readonly cardId?: CardId; // Card to reclaim to hand, undefined = skip reclaim
}

// Steady Tempo deck placement action (end-of-turn choice to place card in deck)
export const RESOLVE_STEADY_TEMPO_ACTION = "RESOLVE_STEADY_TEMPO" as const;

// Banner of Protection wound removal action (end-of-turn choice to throw away wounds)
export const RESOLVE_BANNER_PROTECTION_ACTION = "RESOLVE_BANNER_PROTECTION" as const;
export interface ResolveSteadyTempoAction {
  readonly type: typeof RESOLVE_STEADY_TEMPO_ACTION;
  readonly place: boolean; // true = place in deck, false = discard normally
}

export interface ResolveBannerProtectionAction {
  readonly type: typeof RESOLVE_BANNER_PROTECTION_ACTION;
  readonly removeAll: boolean; // true = throw away all received wounds, false = skip
}

// Discard as cost action (e.g., Improvisation requires discarding before gaining benefit)
export const RESOLVE_DISCARD_ACTION = "RESOLVE_DISCARD" as const;
export interface ResolveDiscardAction {
  readonly type: typeof RESOLVE_DISCARD_ACTION;
  /** Card IDs to discard (length must match pendingDiscard.count, or empty to skip if optional) */
  readonly cardIds: readonly CardId[];
}

// Discard for attack action (Sword of Justice basic effect)
export const RESOLVE_DISCARD_FOR_ATTACK_ACTION = "RESOLVE_DISCARD_FOR_ATTACK" as const;
export interface ResolveDiscardForAttackAction {
  readonly type: typeof RESOLVE_DISCARD_FOR_ATTACK_ACTION;
  /** Card IDs to discard (0 or more non-wound cards) */
  readonly cardIds: readonly CardId[];
}

// Discard for crystal action (Savage Harvesting)
export const RESOLVE_DISCARD_FOR_CRYSTAL_ACTION = "RESOLVE_DISCARD_FOR_CRYSTAL" as const;
export interface ResolveDiscardForCrystalAction {
  readonly type: typeof RESOLVE_DISCARD_FOR_CRYSTAL_ACTION;
  /** Card ID to discard, or null to skip (if optional) */
  readonly cardId: CardId | null;
}

// Meditation spell resolution action
export const RESOLVE_MEDITATION_ACTION = "RESOLVE_MEDITATION" as const;
export interface ResolveMeditationAction {
  readonly type: typeof RESOLVE_MEDITATION_ACTION;
  readonly selectedCardIds?: readonly CardId[]; // Phase 1 (powered): cards selected from discard
  readonly placeOnTop?: boolean; // Phase 2: true = top of deck, false = bottom
}

// Decompose action (throw away action card for crystals)
export const RESOLVE_DECOMPOSE_ACTION = "RESOLVE_DECOMPOSE" as const;
export interface ResolveDecomposeAction {
  readonly type: typeof RESOLVE_DECOMPOSE_ACTION;
  /** Card ID of the action card to throw away */
  readonly cardId: CardId;
}

// Artifact crystal color choice action (Savage Harvesting - second step for artifacts)
export const RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION = "RESOLVE_ARTIFACT_CRYSTAL_COLOR" as const;
export interface ResolveArtifactCrystalColorAction {
  readonly type: typeof RESOLVE_ARTIFACT_CRYSTAL_COLOR_ACTION;
  /** Crystal color to gain */
  readonly color: BasicManaColor;
}

// Combat action constants
export const ENTER_COMBAT_ACTION = "ENTER_COMBAT" as const;
export const CHALLENGE_RAMPAGING_ACTION = "CHALLENGE_RAMPAGING" as const;
export const END_COMBAT_PHASE_ACTION = "END_COMBAT_PHASE" as const;
export const DECLARE_BLOCK_ACTION = "DECLARE_BLOCK" as const;
/**
 * @deprecated Use incremental ASSIGN_ATTACK_ACTION + END_COMBAT_PHASE_ACTION instead.
 * Kept for backward compatibility with existing tests.
 */
export const DECLARE_ATTACK_ACTION = "DECLARE_ATTACK" as const;
export const ASSIGN_DAMAGE_ACTION = "ASSIGN_DAMAGE" as const;

// Incremental attack assignment actions
export const ASSIGN_ATTACK_ACTION = "ASSIGN_ATTACK" as const;
export const UNASSIGN_ATTACK_ACTION = "UNASSIGN_ATTACK" as const;

// Incremental block assignment actions
export const ASSIGN_BLOCK_ACTION = "ASSIGN_BLOCK" as const;
export const UNASSIGN_BLOCK_ACTION = "UNASSIGN_BLOCK" as const;

// Cumbersome ability - spend move points to reduce enemy attack
export const SPEND_MOVE_ON_CUMBERSOME_ACTION = "SPEND_MOVE_ON_CUMBERSOME" as const;

// Agility - convert move points to attack during combat
export const CONVERT_MOVE_TO_ATTACK_ACTION = "CONVERT_MOVE_TO_ATTACK" as const;

export const CONVERSION_TYPE_MELEE = "melee" as const;
export const CONVERSION_TYPE_RANGED = "ranged" as const;
export type MoveToAttackConversionType =
  | typeof CONVERSION_TYPE_MELEE
  | typeof CONVERSION_TYPE_RANGED;

export interface ConvertMoveToAttackAction {
  readonly type: typeof CONVERT_MOVE_TO_ATTACK_ACTION;
  readonly movePointsToSpend: number;
  readonly conversionType: MoveToAttackConversionType;
}

// Diplomacy - convert influence points to block during combat
export const CONVERT_INFLUENCE_TO_BLOCK_ACTION = "CONVERT_INFLUENCE_TO_BLOCK" as const;

export interface ConvertInfluenceToBlockAction {
  readonly type: typeof CONVERT_INFLUENCE_TO_BLOCK_ACTION;
  readonly influencePointsToSpend: number;
}

// Debug actions (dev-only)
export const DEBUG_ADD_FAME_ACTION = "DEBUG_ADD_FAME" as const;
export interface DebugAddFameAction {
  readonly type: typeof DEBUG_ADD_FAME_ACTION;
  readonly amount: number;
}

export const DEBUG_TRIGGER_LEVEL_UP_ACTION = "DEBUG_TRIGGER_LEVEL_UP" as const;
export interface DebugTriggerLevelUpAction {
  readonly type: typeof DEBUG_TRIGGER_LEVEL_UP_ACTION;
}

// Attack type for incremental assignment
export const ATTACK_TYPE_RANGED = "ranged" as const;
export const ATTACK_TYPE_SIEGE = "siege" as const;
export const ATTACK_TYPE_MELEE = "melee" as const;
export type AttackType =
  | typeof ATTACK_TYPE_RANGED
  | typeof ATTACK_TYPE_SIEGE
  | typeof ATTACK_TYPE_MELEE;

// Element type for incremental assignment
export const ATTACK_ELEMENT_PHYSICAL = "physical" as const;
export const ATTACK_ELEMENT_FIRE = "fire" as const;
export const ATTACK_ELEMENT_ICE = "ice" as const;
export const ATTACK_ELEMENT_COLD_FIRE = "coldFire" as const;
export type AttackElement =
  | typeof ATTACK_ELEMENT_PHYSICAL
  | typeof ATTACK_ELEMENT_FIRE
  | typeof ATTACK_ELEMENT_ICE
  | typeof ATTACK_ELEMENT_COLD_FIRE;

// Enter combat with specified enemies
export interface EnterCombatAction {
  readonly type: typeof ENTER_COMBAT_ACTION;
  readonly enemyIds: readonly EnemyId[];
  readonly isAtFortifiedSite?: boolean; // Optional: site provides fortification (Keeps, Mage Towers, Cities)
}

// Challenge rampaging enemies from adjacent hex
export interface ChallengeRampagingAction {
  readonly type: typeof CHALLENGE_RAMPAGING_ACTION;
  readonly targetHex: HexCoord;
}

// Advance to next combat phase (or skip current)
export interface EndCombatPhaseAction {
  readonly type: typeof END_COMBAT_PHASE_ACTION;
}

// Block source with elemental type
export interface BlockSource {
  readonly element: Element;
  readonly value: number;
}

// Declare a block against one enemy (or one attack for multi-attack enemies)
// Note: blocks are now read from server-side combatAccumulator.blockSources
export interface DeclareBlockAction {
  readonly type: typeof DECLARE_BLOCK_ACTION;
  readonly targetEnemyInstanceId: string;
  /**
   * For multi-attack enemies, specifies which attack to block (0-indexed).
   * Defaults to 0 for single-attack enemies or when not specified.
   */
  readonly attackIndex?: number;
}

// Attack source with elemental type
export interface AttackSource {
  readonly element: Element;
  readonly value: number;
}

/**
 * @deprecated Use incremental AssignAttackAction + END_COMBAT_PHASE_ACTION instead.
 * This action resolves attacks immediately (all-or-nothing).
 * The incremental system allows partial allocation and undo before committing.
 * Kept for backward compatibility with existing tests.
 */
export interface DeclareAttackAction {
  readonly type: typeof DECLARE_ATTACK_ACTION;
  readonly targetEnemyInstanceIds: readonly string[];
  readonly attacks: readonly AttackSource[]; // Elemental breakdown of attacks
  readonly attackType: CombatType; // melee, ranged, siege
}

// Damage assignment target
export const DAMAGE_TARGET_HERO = "hero" as const;
export const DAMAGE_TARGET_UNIT = "unit" as const;

export type DamageTarget =
  | typeof DAMAGE_TARGET_HERO
  | typeof DAMAGE_TARGET_UNIT;

export interface DamageAssignment {
  readonly target: DamageTarget;
  readonly unitInstanceId?: string; // Required when target is "unit"
  readonly amount: number;
}

// Assign damage from unblocked enemy (or one attack for multi-attack enemies) to hero/units
export interface AssignDamageAction {
  readonly type: typeof ASSIGN_DAMAGE_ACTION;
  readonly enemyInstanceId: string;
  /**
   * For multi-attack enemies, specifies which attack's damage to assign (0-indexed).
   * Defaults to 0 for single-attack enemies or when not specified.
   */
  readonly attackIndex?: number;
  readonly assignments?: readonly DamageAssignment[]; // If not provided, all damage goes to hero
}

// Incrementally assign attack damage to an enemy (for new allocation system)
export interface AssignAttackAction {
  readonly type: typeof ASSIGN_ATTACK_ACTION;
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number; // Usually 1 for AI, can be more for UI batching
}

// Remove assigned attack damage from an enemy (for new allocation system)
export interface UnassignAttackAction {
  readonly type: typeof UNASSIGN_ATTACK_ACTION;
  readonly enemyInstanceId: string;
  readonly attackType: AttackType;
  readonly element: AttackElement;
  readonly amount: number;
}

// Incrementally assign block to an enemy (for new allocation system)
// Unlike attacks, block has no "type" - it's just elemental block value
export interface AssignBlockAction {
  readonly type: typeof ASSIGN_BLOCK_ACTION;
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number; // Usually 1 for AI, can be more for UI batching
}

// Remove assigned block from an enemy (for new allocation system)
export interface UnassignBlockAction {
  readonly type: typeof UNASSIGN_BLOCK_ACTION;
  readonly enemyInstanceId: string;
  readonly element: AttackElement;
  readonly amount: number;
}

// Spend move points to reduce Cumbersome enemy attack (for Cumbersome ability)
export interface SpendMoveOnCumbersomeAction {
  readonly type: typeof SPEND_MOVE_ON_CUMBERSOME_ACTION;
  readonly enemyInstanceId: string;
  readonly movePointsToSpend: number;
}

export type PlayerAction =
  // Movement
  | MoveAction
  | ExploreAction
  // Adventure sites
  | EnterSiteAction
  | BurnMonasteryAction
  | PlunderVillageAction
  // Turn structure
  | EndTurnAction
  | RestAction // @deprecated - use DeclareRestAction + CompleteRestAction
  | DeclareRestAction
  | CompleteRestAction
  | InteractAction
  | AnnounceEndOfRoundAction
  // Card playing
  | PlayCardAction
  | PlayCardSidewaysAction
  // Mana usage
  | UseManaDeieAction
  | ConvertCrystalAction
  // Unit activation
  | ActivateUnitAction
  // Skill usage
  | UseSkillAction
  | ReturnInteractiveSkillAction
  // Interactions
  | RecruitUnitAction
  | DisbandUnitAction
  | AssignBannerAction
  | UseBannerFearAction
  | PayHeroesAssaultInfluenceAction
  | PayThugsDamageInfluenceAction
  | BuySpellAction
  | LearnAdvancedActionAction
  | BuyHealingAction
  // Tactics
  | SelectTacticAction
  | ActivateTacticAction
  | ResolveTacticDecisionAction
  | RerollSourceDiceAction
  // Undo
  | UndoAction
  // Choice resolution
  | ResolveChoiceAction
  // Terrain cost reduction (Druidic Paths, etc.)
  | ResolveHexCostReductionAction
  | ResolveTerrainCostReductionAction
  // Level up
  | ChooseLevelUpRewardsAction
  // Site rewards
  | SelectRewardAction
  // Magical Glade
  | ResolveGladeWoundAction
  // Unit maintenance (Magic Familiars)
  | ResolveUnitMaintenanceAction
  // Deep Mine
  | ResolveDeepMineAction
  // Crystal Joy reclaim
  | ResolveCrystalJoyReclaimAction
  // Steady Tempo deck placement
  | ResolveSteadyTempoAction
  // Banner of Protection wound removal
  | ResolveBannerProtectionAction
  // Discard as cost
  | ResolveDiscardAction
  // Discard for attack (Sword of Justice)
  | ResolveDiscardForAttackAction
  // Discard for crystal (Savage Harvesting)
  | ResolveDiscardForCrystalAction
  // Meditation spell
  | ResolveMeditationAction
  // Decompose (throw away action card for crystals)
  | ResolveDecomposeAction
  // Artifact crystal color choice (Savage Harvesting - for artifacts)
  | ResolveArtifactCrystalColorAction
  // Combat
  | EnterCombatAction
  | ChallengeRampagingAction
  | EndCombatPhaseAction
  | DeclareBlockAction
  | DeclareAttackAction
  | AssignDamageAction
  // Incremental attack assignment
  | AssignAttackAction
  | UnassignAttackAction
  // Incremental block assignment
  | AssignBlockAction
  | UnassignBlockAction
  // Cumbersome ability
  | SpendMoveOnCumbersomeAction
  // Move-to-attack conversion (Agility)
  | ConvertMoveToAttackAction
  // Influence-to-block conversion (Diplomacy)
  | ConvertInfluenceToBlockAction
  // Debug actions (dev-only)
  | DebugAddFameAction
  | DebugTriggerLevelUpAction
  // Cooperative assault
  | ProposeCooperativeAssaultAction
  | RespondToCooperativeProposalAction
  | CancelCooperativeProposalAction;

export type PlayerActionType = PlayerAction["type"];
