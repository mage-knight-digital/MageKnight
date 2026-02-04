/**
 * Exploration action options.
 *
 * Computes valid explore options for a player, respecting map shape constraints.
 *
 * Per rulebook: "You can only reveal new tiles if you occupy a space
 * adjacent to a position where a new tile can be added."
 *
 * This means we need to check ALL placed tiles to see if the player is
 * adjacent to any of their unfilled expansion slots - not just the tile
 * the player is currently standing on.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { TileId } from "../../types/map.js";
import type { ExploreOptions, ExploreDirection } from "@mage-knight/shared";
import type { HexDirection, HexCoord } from "@mage-knight/shared";
import { MAP_SHAPE_WEDGE, MAP_SHAPE_OPEN_3, MAP_SHAPE_OPEN_4, MAP_SHAPE_OPEN_5, hexKey } from "@mage-knight/shared";
import {
  isEdgeHex,
  TILE_PLACEMENT_OFFSETS,
  getExpansionDirections,
} from "../explore/index.js";
import { canExploreFromPosition } from "../explore/adjacency.js";
import { isCoastlineSlot, getColumnRangeForShape } from "../explore/tileGrid.js";
import { peekNextTileType } from "../../data/tileDeckSetup.js";
import { TILE_TYPE_CORE } from "../../data/tileConstants.js";
import { mustAnnounceEndOfRound } from "./helpers.js";

/** Exploration costs 2 move points from a safe space */
const EXPLORE_COST = 2;

/**
 * Get valid explore options for a player.
 *
 * Checks ALL placed tiles to find unfilled slots the player is adjacent to.
 * A player can explore if they are adjacent to any hex of a potential new tile,
 * regardless of which tile they are standing on.
 *
 * Checks:
 * - Player is on the map
 * - Player is on an edge hex (has unrevealed neighbors)
 * - Player has enough move points (2)
 * - Tiles are available to draw
 * - Player is adjacent to at least one unfilled tile slot
 */
export function getValidExploreOptions(
  state: GameState,
  player: Player
): ExploreOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Must announce end of round before taking other actions
  if (mustAnnounceEndOfRound(state, player)) {
    return undefined;
  }

  // Can't explore while resting
  if (player.isResting) {
    return undefined;
  }

  // Can't explore after taking an action
  if (player.hasTakenActionThisTurn) {
    return undefined;
  }

  // Must have enough move points
  if (player.movePoints < EXPLORE_COST) {
    return undefined;
  }

  // Must have tiles available
  if (
    state.map.tileDeck.countryside.length === 0 &&
    state.map.tileDeck.core.length === 0
  ) {
    return undefined;
  }

  // Must be on an edge hex (has at least one unrevealed adjacent hex)
  if (!isEdgeHex(state, player.position)) {
    return undefined;
  }

  const mapShape = state.scenarioConfig.mapShape;
  const expansionDirections = getExpansionDirections(mapShape);

  // Track unique target slots the player can explore to
  // Key: hexKey of target slot, Value: ExploreDirection info
  const validTargets = new Map<string, ExploreDirection>();

  // If no tiles are tracked (test scenario), create an implicit tile at origin
  // so exploration can still work based on hex adjacency
  const tilesToCheck = state.map.tiles.length > 0
    ? state.map.tiles
    : [{ centerCoord: { q: 0, r: 0 }, tileId: "implicit" as TileId, rotation: 0 }];

  // Check ALL placed tiles to find slots the player is adjacent to
  for (const tile of tilesToCheck) {
    const tileCenter = tile.centerCoord;

    for (const dir of expansionDirections) {
      const offset = TILE_PLACEMENT_OFFSETS[dir];

      // Calculate where a new tile would be placed from this tile
      const targetSlotCoord: HexCoord = {
        q: tileCenter.q + offset.q,
        r: tileCenter.r + offset.r,
      };
      const targetKey = hexKey(targetSlotCoord);

      // Skip if we already found this target from another tile
      if (validTargets.has(targetKey)) continue;

      // Check if slot is already filled
      // For maps with tileSlots (wedge, open 3/4/5): use slot.filled status
      // For all other cases: check if there's already a tile at that position
      const hasTileSlots = state.map.tileSlots && Object.keys(state.map.tileSlots).length > 0;
      const isSlotBasedMap = mapShape === MAP_SHAPE_WEDGE ||
        mapShape === MAP_SHAPE_OPEN_3 ||
        mapShape === MAP_SHAPE_OPEN_4 ||
        mapShape === MAP_SHAPE_OPEN_5;

      if (isSlotBasedMap && hasTileSlots) {
        const slot = state.map.tileSlots[targetKey];
        if (!slot) continue; // Slot doesn't exist in grid (outside column limits)
        if (slot.filled) continue; // Slot already filled
      } else {
        // For generic open maps OR maps without tileSlots: check tiles array
        const existingTile = state.map.tiles.find(
          (t) => t.centerCoord.q === targetSlotCoord.q && t.centerCoord.r === targetSlotCoord.r
        );
        if (existingTile) continue; // Slot already filled
      }

      // NOW check if player is adjacent to where this new tile would be placed
      if (!canExploreFromPosition(player.position, tileCenter, dir)) {
        continue;
      }

      // Add valid target with the actual target coordinates AND the tile we're exploring from
      // This is critical because the same target can be reached from different tiles
      // with different directions
      if (isSlotBasedMap && hasTileSlots) {
        const slot = state.map.tileSlots[targetKey];
        if (slot) {
          validTargets.set(targetKey, {
            direction: dir as HexDirection,
            slotIndex: slot.row,
            targetCoord: targetSlotCoord,
            fromTileCoord: tileCenter,
          });
        }
      } else if (isSlotBasedMap && !hasTileSlots) {
        // No tile slots initialized (test state) - allow direction
        validTargets.set(targetKey, {
          direction: dir as HexDirection,
          targetCoord: targetSlotCoord,
          fromTileCoord: tileCenter,
        });
      } else {
        validTargets.set(targetKey, {
          direction: dir as HexDirection,
          targetCoord: targetSlotCoord,
          fromTileCoord: tileCenter,
        });
      }
    }
  }

  // Filter out coastline slots if next tile is core (wedge maps only)
  // Per rulebook: "Core (brown) tiles cannot be added to the coastline"
  if (mapShape === MAP_SHAPE_WEDGE && state.map.tileSlots && Object.keys(state.map.tileSlots).length > 0) {
    const nextTileType = peekNextTileType(state.map.tileDeck);
    if (nextTileType === TILE_TYPE_CORE) {
      // Filter out coastline slots
      for (const [key, direction] of validTargets) {
        if (isCoastlineSlot(direction.targetCoord, state.map.tileSlots)) {
          validTargets.delete(key);
        }
      }
    }
  }

  // Filter out slots outside column limits (Open 3/4/5 maps)
  const isOpenWithLimits = mapShape === MAP_SHAPE_OPEN_3 ||
    mapShape === MAP_SHAPE_OPEN_4 ||
    mapShape === MAP_SHAPE_OPEN_5;

  if (isOpenWithLimits && state.map.tileSlots && Object.keys(state.map.tileSlots).length > 0) {
    const columnRange = getColumnRangeForShape(mapShape);
    if (columnRange) {
      for (const [key, direction] of validTargets) {
        const slot = state.map.tileSlots[hexKey(direction.targetCoord)];
        if (!slot) {
          // Slot doesn't exist in grid - outside column limits
          validTargets.delete(key);
        } else if (slot.column < columnRange.minColumn || slot.column > columnRange.maxColumn) {
          // Slot is outside column range
          validTargets.delete(key);
        }
      }
    }
  }

  if (validTargets.size === 0) {
    return undefined;
  }

  return { directions: Array.from(validTargets.values()) };
}
