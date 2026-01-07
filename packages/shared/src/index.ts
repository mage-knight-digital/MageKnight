/**
 * @mage-knight/shared
 * Shared types and utilities for client and server
 */

// Branded IDs
export type { CardId, SkillId, BasicManaColor, SpecialManaColor, ManaColor } from "./ids.js";
export {
  // Mana color constants
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  // Mana color arrays
  ALL_MANA_COLORS,
  BASIC_MANA_COLORS,
  // Back-compat aliases
  BASIC_MANA_RED,
  BASIC_MANA_BLUE,
  BASIC_MANA_GREEN,
  BASIC_MANA_WHITE,
} from "./ids.js";

// Card IDs
export * from "./cardIds.js";

// Hex coordinates
export type { HexCoord, HexDirection } from "./hex.js";
export {
  HEX_DIRECTIONS,
  hexKey,
  getNeighbor,
  getAllNeighbors,
  TILE_PLACEMENT_OFFSETS,
  TILE_HEX_OFFSETS,
  findTileCenterForHex,
  calculateTilePlacementPosition,
} from "./hex.js";

// Terrain
export type { Terrain, MovementCost, MovementCosts } from "./terrain.js";
export {
  DEFAULT_MOVEMENT_COSTS,
  TERRAIN_PLAINS,
  TERRAIN_HILLS,
  TERRAIN_FOREST,
  TERRAIN_WASTELAND,
  TERRAIN_DESERT,
  TERRAIN_SWAMP,
  TERRAIN_LAKE,
  TERRAIN_MOUNTAIN,
  TERRAIN_OCEAN,
} from "./terrain.js";

// Levels
export type { LevelStats, LevelUpType } from "./levels.js";
export {
  LEVEL_THRESHOLDS,
  MAX_LEVEL,
  LEVEL_STATS,
  LEVEL_UP_TYPE_ODD,
  LEVEL_UP_TYPE_EVEN,
  getLevelUpType,
  getLevelFromFame,
  getLevelsCrossed,
} from "./levels.js";

// Shared state constants/types
export * from "./stateConstants.js";

// Unit state
export * from "./unitState.js";

// Events
export * from "./events.js";
export type {
  GameEvent,
  GameEventType,
  // Game lifecycle
  GameStartedEvent,
  RoundStartedEvent,
  TurnStartedEvent,
  TurnEndedEvent,
  RoundEndedEvent,
  GameEndedEvent,
  ScenarioEndTriggeredEvent,
  EndOfRoundAnnouncedEvent,
  NewRoundStartedEvent,
  TimeOfDayChangedEvent,
  ManaSourceResetEvent,
  DecksReshuffledEvent,
  PlayerRestedEvent,
  RestUndoneEvent,
  // Movement
  PlayerMovedEvent,
  TileRevealedEvent,
  TileExploredEvent,
  // Combat
  CombatStartedEvent,
  CombatEndedEvent,
  CombatTriggeredEvent,
  // Cards
  CardPlayedEvent,
  CardDrawnEvent,
  CardDiscardedEvent,
  CardGainedEvent,
  // Mana
  ManaDieTakenEvent,
  ManaDieReturnedEvent,
  CrystalConvertedEvent,
  // Health/damage
  WoundReceivedEvent,
  WoundHealedEvent,
  // Progression
  FameGainedEvent,
  FameLostEvent,
  ReputationChangedEvent,
  LevelUpEvent,
  LevelUpRewardsPendingEvent,
  AdvancedActionGainedEvent,
  CommandSlotGainedEvent,
  // Units
  UnitRecruitedEvent,
  UnitDisbandedEvent,
  UnitActivatedEvent,
  UnitWoundedEvent,
  UnitHealedEvent,
  UnitReadiedEvent,
  UnitsReadiedEvent,
  UnitDestroyedEvent,
  // Skills
  SkillUsedEvent,
  SkillGainedEvent,
  // Offers
  OfferRefreshedEvent,
  OfferCardTakenEvent,
  // Undo
  MoveUndoneEvent,
  UndoFailedEvent,
  UndoCheckpointSetEvent,
  // Choice
  ChoiceRequiredEvent,
  ChoiceResolvedEvent,
  // Tactics
  TacticSelectedEvent,
  TacticsPhaseEndedEvent,
} from "./events.js";

// Actions
export * from "./actions.js";
export type {
  PlayerAction,
  PlayerActionType,
  // Movement
  MoveAction,
  ExploreAction,
  // Adventure sites
  EnterSiteAction,
  // Turn structure
  EndTurnAction,
  RestAction,
  InteractAction,
  AnnounceEndOfRoundAction,
  // Card playing
  PlayCardAction,
  PlayCardSidewaysAction,
  ManaSourceInfo,
  // Mana usage
  UseManaDeieAction,
  ConvertCrystalAction,
  // Unit activation
  ActivateUnitAction,
  // Skill usage
  UseSkillAction,
  // Interactions
  RecruitUnitAction,
  DisbandUnitAction,
  BuySpellAction,
  LearnAdvancedActionAction,
  BuyHealingAction,
  // Tactics
  SelectTacticAction,
  // Undo
  UndoAction,
  // Choice resolution
  ResolveChoiceAction,
  // Level up
  ChooseLevelUpRewardsAction,
  // Combat
  BlockSource,
  AttackSource,
  DeclareBlockAction,
  DeclareAttackAction,
  AssignDamageAction,
  DamageAssignment,
  DamageTarget,
} from "./actions.js";

// Connection
export type {
  GameConnection,
  GameEngine,
  EventCallback,
  ActionResult,
} from "./connection.js";
export { LocalConnection } from "./connection.js";

// Client state types
export type {
  ClientCrystals,
  ClientPlayerUnit,
  ClientManaToken,
  ClientElementalValues,
  ClientAccumulatedAttack,
  ClientCombatAccumulator,
  ClientPlayer,
  ClientSourceDie,
  ClientManaSource,
  ClientSite,
  ClientHexState,
  ClientMapState,
  ClientCardOffer,
  ClientGameOffers,
  ClientGameState,
  ClientCombatState,
  ClientCombatEnemy,
  ClientPendingChoice,
} from "./types/clientState.js";

// Valid actions types
export type {
  ValidActions,
  MoveOptions,
  MoveTarget,
  ExploreOptions,
  ExploreDirection,
  PlayCardOptions,
  PlayableCard,
  SidewaysAs,
  SidewaysOption,
  CombatOptions,
  AttackOption,
  BlockOption,
  DamageAssignmentOption,
  UnitOptions,
  RecruitableUnit,
  ActivatableUnit,
  ActivatableAbility,
  SiteOptions,
  InteractOptions,
  ManaOptions,
  AvailableDie,
  TurnOptions,
  TacticsOptions,
  EnterCombatOptions,
  AvailableEnemy,
} from "./types/validActions.js";

// Shared value constants (sub-unions)
export * from "./valueConstants.js";

// Elements & combat types
export * from "./elements.js";
export * from "./combatTypes.js";
export * from "./combatPhases.js";

// Enemy definitions
export * from "./enemies.js";

// Unit definitions
export * from "./units.js";

// Scenario definitions
export * from "./scenarios.js";

// Tactics
export * from "./tactics.js";
