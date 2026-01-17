/**
 * Movement Events
 *
 * Events related to player movement and map exploration. Movement is a core
 * mechanic that drives exploration and triggers combat.
 *
 * @module events/movement
 *
 * @example Movement Flow
 * ```
 * PLAYER_MOVED (to new hex)
 *   └─► If hex at edge of revealed map:
 *         └─► TILE_REVEALED (sees enemy tokens on fortified sites)
 *         └─► TILE_EXPLORED (new tile placed, hexes added)
 *   └─► If hex has rampaging enemies:
 *         └─► COMBAT_TRIGGERED
 *   └─► If moving onto fortified site:
 *         └─► ENEMIES_REVEALED
 *         └─► COMBAT_TRIGGERED
 * ```
 */

import type { HexCoord } from "../hex.js";

// ============================================================================
// PLAYER_MOVED
// ============================================================================

/**
 * Event type constant for player movement.
 * @see PlayerMovedEvent
 */
export const PLAYER_MOVED = "PLAYER_MOVED" as const;

/**
 * Emitted when a player moves to a new hex.
 *
 * Movement costs move points based on terrain and may trigger exploration
 * or combat.
 *
 * @remarks
 * - Movement requires sufficient move points
 * - Terrain affects movement cost (e.g., forest costs 3, plains costs 2)
 * - Moving onto certain hexes triggers mandatory combat
 * - Can be undone if no irreversible action occurred after
 * - Triggers: MOVE_ACTION
 *
 * @example
 * ```typescript
 * if (event.type === PLAYER_MOVED) {
 *   animatePlayerMove(event.playerId, event.from, event.to);
 *   revealAdjacentHexes(event.to);
 * }
 * ```
 */
export interface PlayerMovedEvent {
  readonly type: typeof PLAYER_MOVED;
  /** ID of the moving player */
  readonly playerId: string;
  /** Starting hex coordinate */
  readonly from: HexCoord;
  /** Destination hex coordinate */
  readonly to: HexCoord;
}

/**
 * Creates a PlayerMovedEvent.
 *
 * @param playerId - ID of the moving player
 * @param from - Starting hex coordinate
 * @param to - Destination hex coordinate
 * @returns A new PlayerMovedEvent
 *
 * @example
 * const event = createPlayerMovedEvent("player1", { q: 0, r: 0 }, { q: 1, r: 0 });
 */
export function createPlayerMovedEvent(
  playerId: string,
  from: HexCoord,
  to: HexCoord
): PlayerMovedEvent {
  return {
    type: PLAYER_MOVED,
    playerId,
    from,
    to,
  };
}

// ============================================================================
// TILE_REVEALED
// ============================================================================

/**
 * Event type constant for tile revelation.
 * @see TileRevealedEvent
 */
export const TILE_REVEALED = "TILE_REVEALED" as const;

/**
 * Emitted when a map tile is revealed but not yet placed.
 *
 * This occurs when a player moves adjacent to an unexplored tile.
 * The tile becomes visible but its exact orientation is not yet determined.
 *
 * @remarks
 * - Reveals enemy tokens on fortified sites within the tile
 * - Tile is not yet placed on the map
 * - Player may choose whether to explore (place the tile)
 * - Creates an undo checkpoint (irreversible)
 *
 * @example
 * ```typescript
 * if (event.type === TILE_REVEALED) {
 *   showTilePreview(event.tileId, event.position);
 *   promptForExploration();
 * }
 * ```
 */
export interface TileRevealedEvent {
  readonly type: typeof TILE_REVEALED;
  /** ID of the player who revealed the tile */
  readonly playerId: string;
  /** Position where the tile was revealed */
  readonly position: HexCoord;
  /** ID of the tile that was revealed */
  readonly tileId: string;
}

/**
 * Creates a TileRevealedEvent.
 *
 * @param playerId - ID of the revealing player
 * @param position - Hex coordinate of the revealed tile
 * @param tileId - ID of the revealed tile
 * @returns A new TileRevealedEvent
 */
export function createTileRevealedEvent(
  playerId: string,
  position: HexCoord,
  tileId: string
): TileRevealedEvent {
  return {
    type: TILE_REVEALED,
    playerId,
    position,
    tileId,
  };
}

// ============================================================================
// TILE_EXPLORED
// ============================================================================

/**
 * Event type constant for tile exploration.
 * @see TileExploredEvent
 */
export const TILE_EXPLORED = "TILE_EXPLORED" as const;

/**
 * Emitted when a tile is placed on the map during exploration.
 *
 * The tile is now part of the game board and its hexes can be entered.
 *
 * @remarks
 * - Tile is placed with a specific rotation (0-5)
 * - newHexes lists all hex coordinates added to the map
 * - Creates an undo checkpoint (irreversible - RNG involved)
 * - May trigger combat if player ends on rampaging enemy
 *
 * @example
 * ```typescript
 * if (event.type === TILE_EXPLORED) {
 *   placeTileOnMap(event.tileId, event.position, event.rotation);
 *   addNewHexesToMap(event.newHexes);
 *   setUndoCheckpoint();
 * }
 * ```
 */
export interface TileExploredEvent {
  readonly type: typeof TILE_EXPLORED;
  /** ID of the exploring player */
  readonly playerId: string;
  /** ID of the placed tile */
  readonly tileId: string;
  /** Position where the tile was placed */
  readonly position: HexCoord;
  /** Rotation of the tile (0-5, representing 60-degree increments) */
  readonly rotation: number;
  /** All hex coordinates added to the map by this tile */
  readonly newHexes: readonly HexCoord[];
}

/**
 * Creates a TileExploredEvent.
 *
 * @param playerId - ID of the exploring player
 * @param tileId - ID of the tile
 * @param position - Tile placement position
 * @param rotation - Tile rotation (0-5)
 * @param newHexes - Hex coordinates added
 * @returns A new TileExploredEvent
 */
export function createTileExploredEvent(
  playerId: string,
  tileId: string,
  position: HexCoord,
  rotation: number,
  newHexes: readonly HexCoord[]
): TileExploredEvent {
  return {
    type: TILE_EXPLORED,
    playerId,
    tileId,
    position,
    rotation,
    newHexes,
  };
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard for PlayerMovedEvent.
 */
export function isPlayerMovedEvent(event: {
  type: string;
}): event is PlayerMovedEvent {
  return event.type === PLAYER_MOVED;
}

/**
 * Type guard for TileRevealedEvent.
 */
export function isTileRevealedEvent(event: {
  type: string;
}): event is TileRevealedEvent {
  return event.type === TILE_REVEALED;
}

/**
 * Type guard for TileExploredEvent.
 */
export function isTileExploredEvent(event: {
  type: string;
}): event is TileExploredEvent {
  return event.type === TILE_EXPLORED;
}

/**
 * Check if an event is any movement-related event.
 */
export function isMovementEvent(event: { type: string }): boolean {
  return [PLAYER_MOVED, TILE_REVEALED, TILE_EXPLORED].includes(
    event.type as typeof PLAYER_MOVED
  );
}
