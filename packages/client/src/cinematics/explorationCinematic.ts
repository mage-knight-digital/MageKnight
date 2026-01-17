/**
 * Exploration Cinematic Sequence
 *
 * Plays when a player explores a new tile:
 * 1. Disable input, fade UI
 * 2. Pan camera to exploration target
 * 3. Tile drops with tracer + shadow + dust
 * 4. Enemies drop in sequence
 * 5. Pan camera back to hero
 * 6. Restore UI, enable input
 */

import type { HexCoord } from "@mage-knight/shared";
import type { CinematicSequence, CinematicStep } from "../contexts/CinematicContext";
import type { PixelPosition } from "../components/GameBoard/pixi/types";

export const EXPLORATION_CINEMATIC_ID = "exploration" as const;

/**
 * Parameters needed to create an exploration cinematic
 */
export interface ExplorationCinematicParams {
  /** The tile that was explored */
  tileId: string;
  /** Center position of the new tile in hex coords */
  tilePosition: HexCoord;
  /** Center position in pixel coords */
  tilePixelPosition: PixelPosition;
  /** New hexes that were revealed */
  newHexes: readonly HexCoord[];
  /** Enemies on the new tile (if any) */
  enemyTokenIds: readonly string[];
  /** Current hero position in pixel coords */
  heroPixelPosition: PixelPosition;
  /** Callbacks for actual animation execution */
  callbacks: {
    /** Pan camera to a position */
    panCameraTo: (position: PixelPosition, instant?: boolean) => void;
    /** Start the tile drop animation, returns duration in ms */
    animateTileDrop: () => number;
    /** Start enemy drop animations, returns total duration in ms */
    animateEnemyDrops: () => number;
    /** Fade UI elements (0 = hidden, 1 = visible) */
    setUIVisibility: (visible: boolean) => void;
  };
}

/**
 * Camera pan timing constants
 */
const CAMERA_PAN_DURATION_MS = 400;
const POST_TILE_PAUSE_MS = 200;
const POST_ENEMY_PAUSE_MS = 300;

/**
 * Create an exploration cinematic sequence
 */
export function createExplorationCinematic(
  params: ExplorationCinematicParams
): CinematicSequence {
  const {
    tileId,
    tilePixelPosition,
    enemyTokenIds,
    heroPixelPosition,
    callbacks,
  } = params;

  const steps: CinematicStep[] = [];

  // Step 1: Fade UI and disable input (handled by cinematic context)
  steps.push({
    id: "fade-ui",
    description: "Fade out UI elements",
    duration: 200,
    execute: () => {
      callbacks.setUIVisibility(false);
    },
  });

  // Step 2: Pan camera to tile location
  steps.push({
    id: "pan-to-tile",
    description: "Pan camera to new tile",
    duration: CAMERA_PAN_DURATION_MS,
    execute: () => {
      callbacks.panCameraTo(tilePixelPosition);
    },
  });

  // Step 3: Tile drop animation
  steps.push({
    id: "tile-drop",
    description: "Tile drops with tracer and effects",
    duration: 0, // Will be set dynamically
    execute: () => {
      const duration = callbacks.animateTileDrop();
      // We return early - the step system will handle duration
      // Duration is 0, so completeStep() must be called
      setTimeout(() => {
        // This is a bit awkward - we need to signal completion
        // The PixiHexGrid will call completeStep when tile animation ends
      }, duration);
    },
  });

  // Step 4: Brief pause after tile lands
  steps.push({
    id: "post-tile-pause",
    description: "Pause after tile lands",
    duration: POST_TILE_PAUSE_MS,
    execute: () => {},
  });

  // Step 5: Enemy drops (if any enemies)
  if (enemyTokenIds.length > 0) {
    steps.push({
      id: "enemy-drops",
      description: `Drop ${enemyTokenIds.length} enemies`,
      duration: 0, // Dynamic based on enemy count
      execute: () => {
        const duration = callbacks.animateEnemyDrops();
        setTimeout(() => {
          // PixiHexGrid will call completeStep when enemies finish
        }, duration);
      },
    });

    steps.push({
      id: "post-enemy-pause",
      description: "Pause after enemies land",
      duration: POST_ENEMY_PAUSE_MS,
      execute: () => {},
    });
  }

  // Step 6: Pan camera back to hero
  steps.push({
    id: "pan-to-hero",
    description: "Pan camera back to hero",
    duration: CAMERA_PAN_DURATION_MS,
    execute: () => {
      callbacks.panCameraTo(heroPixelPosition);
    },
  });

  // Step 7: Restore UI
  steps.push({
    id: "restore-ui",
    description: "Restore UI elements",
    duration: 200,
    execute: () => {
      callbacks.setUIVisibility(true);
    },
  });

  return {
    id: EXPLORATION_CINEMATIC_ID,
    name: `Explore tile ${tileId}`,
    steps,
  };
}
