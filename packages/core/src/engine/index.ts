/**
 * Game engine functions
 *
 * This module contains the core game logic including:
 * - MageKnightEngine for action processing
 * - Validator system for action validation
 * - Command pattern for undo support
 * - Modifier management and effective value calculations
 */

// Engine
export { MageKnightEngine, createEngine } from "./MageKnightEngine.js";
export type { ActionResult } from "./MageKnightEngine.js";

// Commands
export { createCommandForAction } from "./commands/index.js";
export type { Command, CommandResult, UndoCheckpoint } from "./commands.js";
export type { CommandStackState } from "./commandStack.js";
export {
  createEmptyCommandStack,
  pushCommand,
  popCommand,
  canUndo,
  clearCommandStack,
} from "./commandStack.js";

// Command implementations
export {
  createMoveCommand,
  type MoveCommandParams,
  createRevealTileCommand,
  type RevealTileCommandParams,
} from "./commands/index.js";

// Validators
export { validateAction, getValidatorsForAction } from "./validators/index.js";
export type {
  Validator,
  ValidationResult,
  ValidationError,
} from "./validators/types.js";

// Modifier system
export type { ExpirationTrigger } from "./modifiers/index.js";
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
} from "./modifiers/index.js";

// Mana source management
export {
  createManaSource,
  rerollDie,
  getAvailableDice,
  updateDiceForTimeOfDay,
} from "./mana/index.js";

// Effect descriptions
export { describeEffect } from "./effects/index.js";

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
} from "./explore/index.js";

// Valid actions computation
export {
  getValidActions,
  getTurnOptions,
  getValidMoveTargets,
  getValidExploreOptions,
} from "./validActions/index.js";

// Enemy token helpers
export { createEnemyTokenPiles, drawEnemiesForHex } from "./helpers/index.js";

// Monastery helpers
export {
  countMonasteries,
  drawMonasteryAdvancedAction,
} from "./helpers/index.js";

// Ruins token helpers
export {
  createEmptyRuinsTokenPiles,
  createRuinsTokenPiles,
  drawRuinsToken,
  discardRuinsToken,
  shouldRuinsTokenBeRevealed,
  revealRuinsToken,
} from "./helpers/index.js";
export type { DrawRuinsTokenResult } from "./helpers/index.js";
