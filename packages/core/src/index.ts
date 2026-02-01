/**
 * @mage-knight/core
 * Pure game logic for Mage Knight
 */

// Types
export type * from "./types/index.js";
export {
  Hero,
  HEROES,
  TileId,
  SiteType,
  RampagingEnemyType,
  // Player helpers
  createEmptyElementalValues,
  createEmptyCombatAccumulator,
  getTotalElementalValue,
  getTotalAttack,
  getTotalBlock,
  // Unit helpers
  createPlayerUnit,
  readyAllUnits,
  // Map helpers
  createEmptyMapState,
  mineColorToBasicManaColor,
  // Mana helpers
  createEmptyManaSource,
  createEmptyCrystalInventory,
  // Offers helpers
  createEmptyOffers,
  // Decks helpers
  createEmptyDecks,
  // Enemy helpers
  createEmptyEnemyTokenPiles,
  // City helpers
  determineCityLeader,
  createCityState,
} from "./types/index.js";

// State
export type { GameState, MapState, EnemyTokenPiles, RuinsTokenPiles } from "./state/GameState.js";
export { createInitialGameState } from "./state/GameState.js";
// Re-export GamePhase and TimeOfDay from shared for convenience
export type { GamePhase, TimeOfDay } from "@mage-knight/shared";

// Hex (re-exported from shared for convenience)
export type { HexCoord, HexDirection } from "./hex/HexCoord.js";
export {
  HEX_DIRECTIONS,
  hexKey,
  getNeighbor,
  getAllNeighbors,
} from "./hex/HexCoord.js";

// Tile data
export type { LocalHex, TileType, TileDefinition } from "./data/tiles/index.js";
export { TILE_DEFINITIONS, placeTile, getTilesByType } from "./data/tiles/index.js";

// Tile deck setup
export type { TileDeckSetupResult } from "./data/tileDeckSetup.js";
export {
  createTileDeck,
  drawTileFromDeck,
  getTotalTilesRemaining,
  isCityTile,
} from "./data/tileDeckSetup.js";

// Unit deck setup
export type { UnitDeckSetupResult } from "./data/unitDeckSetup.js";
export {
  createUnitDecksAndOffer,
  refreshUnitOffer,
  removeUnitFromOffer,
} from "./data/unitDeckSetup.js";

// Spell deck setup
export type { SpellDeckSetupResult } from "./data/spellDeckSetup.js";
export { createSpellDeckAndOffer, refreshSpellOffer } from "./data/spellDeckSetup.js";

// Advanced action deck setup
export type {
  AdvancedActionDeckSetupResult,
  CardOfferRefreshResult,
} from "./data/advancedActionDeckSetup.js";
export {
  createAdvancedActionDeckAndOffer,
  refreshAdvancedActionOffer,
} from "./data/advancedActionDeckSetup.js";

// Artifact deck setup
export type { ArtifactDeckSetupResult } from "./data/artifactDeckSetup.js";
export { createArtifactDeck } from "./data/artifactDeckSetup.js";

// Artifact cards
export { getArtifactCard, getAllArtifactCardIds } from "./data/artifacts/index.js";

// Site properties
export type { SiteProperties } from "./data/siteProperties.js";
export {
  SITE_PROPERTIES,
  isFortified,
  isInhabited,
  isAdventureSite,
  allowsMultipleHeroes,
} from "./data/siteProperties.js";

// Basic action cards
export { BASIC_ACTION_CARDS, getBasicActionCard } from "./data/basicActions/index.js";

// Engine
export { MageKnightEngine, createEngine } from "./engine/index.js";
export type { ActionResult } from "./engine/index.js";

// Valid actions
export {
  getValidActions,
  getTurnOptions,
  getValidMoveTargets,
  getValidExploreOptions,
} from "./engine/index.js";

// Explore / tile grid system
export {
  isEdgeHex,
  getValidExploreDirections,
  calculateTilePlacement,
  TILE_PLACEMENT_OFFSETS,
  getDirectionFromOffset,
  getExpansionDirections,
  generateWedgeSlots,
  generateTileSlots,
  isSlotAdjacentToFilled,
  getValidExploreDirectionsForShape,
  findTileCenterForHex,
  getExplorableSlotsFromTile,
} from "./engine/index.js";

// Modifiers
export type { ExpirationTrigger } from "./engine/index.js";
export {
  // Query helpers
  getModifiersOfType,
  getModifiersForPlayer,
  getModifiersForEnemy,
  // Effective value calculations
  getEffectiveTerrainCost,
  getEffectiveSidewaysValue,
  isRuleActive,
  getEffectiveEnemyArmor,
  getEffectiveEnemyAttack,
  // Lifecycle
  addModifier,
  removeModifier,
  expireModifiers,
} from "./engine/index.js";

// Mana source management
export {
  createManaSource,
  rerollDie,
  getAvailableDice,
  updateDiceForTimeOfDay,
} from "./engine/index.js";

// Effect descriptions
export { describeEffect } from "./engine/index.js";

// Enemy token helpers
export { createEnemyTokenPiles, drawEnemiesForHex } from "./engine/index.js";

// Ruins token helpers
export {
  createEmptyRuinsTokenPiles,
  createRuinsTokenPiles,
  drawRuinsToken,
  discardRuinsToken,
  shouldRuinsTokenBeRevealed,
  revealRuinsToken,
} from "./engine/index.js";
export type { DrawRuinsTokenResult } from "./engine/index.js";

// Monastery helpers
export { countMonasteries, drawMonasteryAdvancedAction } from "./engine/index.js";

// Command system (undo support)
export type {
  Command,
  CommandResult,
  UndoCheckpoint,
  CommandStackState,
  MoveCommandParams,
  RevealTileCommandParams,
} from "./engine/index.js";
export {
  createEmptyCommandStack,
  pushCommand,
  popCommand,
  canUndo,
  clearCommandStack,
  createMoveCommand,
  createRevealTileCommand,
} from "./engine/index.js";

// Utils
export { shuffle } from "./utils/index.js";

// RNG (seeded random number generator)
export type { RngState } from "./utils/index.js";
export {
  createRng,
  nextRandom,
  randomInt,
  shuffleWithRng,
  randomElement,
} from "./utils/index.js";

// Serialization (save/load support)
export {
  serializeGameState,
  deserializeGameState,
} from "./utils/index.js";
