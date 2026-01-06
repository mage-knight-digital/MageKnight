/**
 * Player action types - discriminated union for all actions a player can take
 */

import type { HexCoord, HexDirection } from "./hex.js";
import type { CardId, SkillId, BasicManaColor, ManaColor } from "./ids.js";
import type { UnitId } from "./units.js";
import type { ManaSourceType } from "./valueConstants.js";
import type { EnemyId } from "./enemies.js";
import type { CombatType } from "./combatTypes.js";
import type { Element } from "./elements.js";
import type { TacticId } from "./tactics.js";
import {
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_MOVE,
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

// Turn structure actions
export const END_TURN_ACTION = "END_TURN" as const;
export interface EndTurnAction {
  readonly type: typeof END_TURN_ACTION;
}

export const REST_ACTION = "REST" as const;

// Rest type constants
export const REST_TYPE_STANDARD = "standard" as const;
export const REST_TYPE_SLOW_RECOVERY = "slow_recovery" as const;

export type RestType = typeof REST_TYPE_STANDARD | typeof REST_TYPE_SLOW_RECOVERY;

export interface RestAction {
  readonly type: typeof REST_ACTION;
  readonly restType: RestType;
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
  readonly manaSource?: ManaSourceInfo; // Required when powered is true
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
  readonly manaPaid?: ManaColor;
}

// Skill usage
export const USE_SKILL_ACTION = "USE_SKILL" as const;
export interface UseSkillAction {
  readonly type: typeof USE_SKILL_ACTION;
  readonly skillId: SkillId;
}

// Interaction actions
export const RECRUIT_UNIT_ACTION = "RECRUIT_UNIT" as const;
export interface RecruitUnitAction {
  readonly type: typeof RECRUIT_UNIT_ACTION;
  readonly unitId: UnitId;
  readonly influenceSpent: number; // Must meet unit's cost
}

export const DISBAND_UNIT_ACTION = "DISBAND_UNIT" as const;
export interface DisbandUnitAction {
  readonly type: typeof DISBAND_UNIT_ACTION;
  readonly unitInstanceId: string;
}

export const BUY_SPELL_ACTION = "BUY_SPELL" as const;
export interface BuySpellAction {
  readonly type: typeof BUY_SPELL_ACTION;
  readonly cardId: CardId;
  readonly manaPaid: ManaColor;
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

// Combat action constants
export const ENTER_COMBAT_ACTION = "ENTER_COMBAT" as const;
export const END_COMBAT_PHASE_ACTION = "END_COMBAT_PHASE" as const;
export const DECLARE_BLOCK_ACTION = "DECLARE_BLOCK" as const;
export const DECLARE_ATTACK_ACTION = "DECLARE_ATTACK" as const;
export const ASSIGN_DAMAGE_ACTION = "ASSIGN_DAMAGE" as const;

// Enter combat with specified enemies
export interface EnterCombatAction {
  readonly type: typeof ENTER_COMBAT_ACTION;
  readonly enemyIds: readonly EnemyId[];
  readonly isAtFortifiedSite?: boolean; // Optional: site provides fortification (Keeps, Mage Towers, Cities)
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

// Declare a block against one enemy
// Note: blocks are now read from server-side combatAccumulator.blockSources
export interface DeclareBlockAction {
  readonly type: typeof DECLARE_BLOCK_ACTION;
  readonly targetEnemyInstanceId: string;
}

// Attack source with elemental type
export interface AttackSource {
  readonly element: Element;
  readonly value: number;
}

// Declare an attack against enemies
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

// Assign damage from unblocked enemy to hero/units
export interface AssignDamageAction {
  readonly type: typeof ASSIGN_DAMAGE_ACTION;
  readonly enemyInstanceId: string;
  readonly assignments?: readonly DamageAssignment[]; // If not provided, all damage goes to hero
}

export type PlayerAction =
  // Movement
  | MoveAction
  | ExploreAction
  // Adventure sites
  | EnterSiteAction
  // Turn structure
  | EndTurnAction
  | RestAction
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
  // Interactions
  | RecruitUnitAction
  | DisbandUnitAction
  | BuySpellAction
  | LearnAdvancedActionAction
  | BuyHealingAction
  // Tactics
  | SelectTacticAction
  // Undo
  | UndoAction
  // Choice resolution
  | ResolveChoiceAction
  // Level up
  | ChooseLevelUpRewardsAction
  // Combat
  | EnterCombatAction
  | EndCombatPhaseAction
  | DeclareBlockAction
  | DeclareAttackAction
  | AssignDamageAction;

export type PlayerActionType = PlayerAction["type"];
