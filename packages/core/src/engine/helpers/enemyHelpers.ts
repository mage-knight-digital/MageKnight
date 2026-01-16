/**
 * Enemy token helpers for Mage Knight
 *
 * Functions for managing enemy token decks, drawing enemies, and mapping
 * sites/rampaging types to enemy colors.
 */

import type { EnemyId, EnemyColor, TimeOfDay } from "@mage-knight/shared";
import {
  ENEMIES,
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_GREEN,
  ENEMY_COLOR_RED,
  ENEMY_COLOR_VIOLET,
  ENEMY_COLOR_WHITE,
  TIME_OF_DAY_NIGHT,
} from "@mage-knight/shared";
import type { EnemyTokenId, EnemyTokenPiles } from "../../types/enemy.js";
import { SiteType, RampagingEnemyType, type HexEnemy } from "../../types/map.js";
import type { RngState } from "../../utils/rng.js";
import { shuffleWithRng } from "../../utils/rng.js";

// =============================================================================
// ENEMY TOKEN ID GENERATION
// =============================================================================

let tokenCounter = 0;

/**
 * Create a unique enemy token ID
 */
export function createEnemyTokenId(enemyId: EnemyId): EnemyTokenId {
  tokenCounter++;
  return `${enemyId}_${tokenCounter}` as EnemyTokenId;
}

/**
 * Reset token counter (for testing)
 */
export function resetTokenCounter(): void {
  tokenCounter = 0;
}

/**
 * Extract the EnemyId from an EnemyTokenId
 */
export function getEnemyIdFromToken(tokenId: EnemyTokenId): EnemyId {
  // Token format is "enemyId_counter"
  const parts = tokenId.split("_");
  // Handle enemy IDs that contain underscores (e.g., "cursed_hags")
  parts.pop(); // Remove the counter
  return parts.join("_") as EnemyId;
}

// =============================================================================
// ENEMY DECK INITIALIZATION
// =============================================================================

/**
 * Get all enemy IDs of a specific color
 */
export function getEnemyIdsByColor(color: EnemyColor): EnemyId[] {
  return (Object.keys(ENEMIES) as EnemyId[]).filter(
    (id) => ENEMIES[id].color === color
  );
}

/**
 * Create initial enemy token piles with all enemies shuffled by color.
 * Each enemy type creates one token in its color's draw pile.
 */
export function createEnemyTokenPiles(rng: RngState): {
  piles: EnemyTokenPiles;
  rng: RngState;
} {
  let currentRng = rng;

  // Create tokens for each color and shuffle
  const createColorPile = (
    color: EnemyColor
  ): { tokens: EnemyTokenId[]; rng: RngState } => {
    const enemyIds = getEnemyIdsByColor(color);
    const tokens = enemyIds.map((id) => createEnemyTokenId(id));
    const { result: shuffled, rng: newRng } = shuffleWithRng(
      tokens,
      currentRng
    );
    currentRng = newRng;
    return { tokens: shuffled, rng: currentRng };
  };

  const green = createColorPile(ENEMY_COLOR_GREEN);
  const gray = createColorPile(ENEMY_COLOR_GRAY);
  const brown = createColorPile(ENEMY_COLOR_BROWN);
  const violet = createColorPile(ENEMY_COLOR_VIOLET);
  const red = createColorPile(ENEMY_COLOR_RED);
  const white = createColorPile(ENEMY_COLOR_WHITE);

  return {
    piles: {
      drawPiles: {
        [ENEMY_COLOR_GREEN]: green.tokens,
        [ENEMY_COLOR_GRAY]: gray.tokens,
        [ENEMY_COLOR_BROWN]: brown.tokens,
        [ENEMY_COLOR_VIOLET]: violet.tokens,
        [ENEMY_COLOR_RED]: red.tokens,
        [ENEMY_COLOR_WHITE]: white.tokens,
      },
      discardPiles: {
        [ENEMY_COLOR_GREEN]: [],
        [ENEMY_COLOR_GRAY]: [],
        [ENEMY_COLOR_BROWN]: [],
        [ENEMY_COLOR_VIOLET]: [],
        [ENEMY_COLOR_RED]: [],
        [ENEMY_COLOR_WHITE]: [],
      },
    },
    rng: currentRng,
  };
}

// =============================================================================
// DRAW AND DISCARD
// =============================================================================

export interface DrawEnemyResult {
  readonly tokenId: EnemyTokenId | null;
  readonly piles: EnemyTokenPiles;
  readonly rng: RngState;
}

/**
 * Draw an enemy token from a specific color deck.
 * If the draw pile is empty, reshuffles the discard pile.
 * Returns null if both piles are empty.
 */
export function drawEnemy(
  piles: EnemyTokenPiles,
  color: EnemyColor,
  rng: RngState
): DrawEnemyResult {
  const drawPile = piles.drawPiles[color];
  const discardPile = piles.discardPiles[color];

  // If draw pile has tokens, draw from it
  if (drawPile.length > 0) {
    const [tokenId, ...remaining] = drawPile;
    return {
      tokenId: tokenId ?? null,
      piles: {
        ...piles,
        drawPiles: {
          ...piles.drawPiles,
          [color]: remaining,
        },
      },
      rng,
    };
  }

  // If draw pile is empty, reshuffle discard
  if (discardPile.length > 0) {
    const { result: shuffled, rng: newRng } = shuffleWithRng(discardPile, rng);
    const [tokenId, ...remaining] = shuffled;
    return {
      tokenId: tokenId ?? null,
      piles: {
        ...piles,
        drawPiles: {
          ...piles.drawPiles,
          [color]: remaining,
        },
        discardPiles: {
          ...piles.discardPiles,
          [color]: [],
        },
      },
      rng: newRng,
    };
  }

  // Both piles empty
  return { tokenId: null, piles, rng };
}

/**
 * Discard an enemy token to its color's discard pile.
 */
export function discardEnemy(
  piles: EnemyTokenPiles,
  tokenId: EnemyTokenId
): EnemyTokenPiles {
  const enemyId = getEnemyIdFromToken(tokenId);
  const enemy = ENEMIES[enemyId];
  const color = enemy.color;

  return {
    ...piles,
    discardPiles: {
      ...piles.discardPiles,
      [color]: [...piles.discardPiles[color], tokenId],
    },
  };
}

// =============================================================================
// SITE TO DEFENDER MAPPING
// =============================================================================

export interface SiteDefenderConfig {
  readonly color: EnemyColor;
  readonly count: number;
}

/**
 * Get the defender configuration for a site type at tile reveal time.
 * Returns null for sites that have no defenders at reveal.
 *
 * NOTE: Dungeon and Tomb enemies are drawn when the player EXPLORES the site,
 * not when the tile is revealed. Use getAdventureSiteEnemies() for those.
 * Ancient Ruins only have enemies at night.
 */
export function getSiteDefenders(
  siteType: SiteType,
  timeOfDay?: TimeOfDay
): SiteDefenderConfig | null {
  switch (siteType) {
    // Fortified sites - gray defenders
    case SiteType.Keep:
      return { color: ENEMY_COLOR_GRAY, count: 1 };
    case SiteType.MageTower:
      return { color: ENEMY_COLOR_VIOLET, count: 1 };

    // Monster Den and Spawning Grounds: enemies drawn on EXPLORE, not at tile reveal
    // Per rules: "draw a brown enemy token" / "draw two brown enemy tokens"
    case SiteType.MonsterDen:
    case SiteType.SpawningGrounds:
      return null;

    // Dungeon/Tomb: enemies drawn on EXPLORE, not at tile reveal
    case SiteType.Dungeon:
    case SiteType.Tomb:
      return null;

    // Ancient ruins: enemies only at night
    case SiteType.AncientRuins:
      return timeOfDay === TIME_OF_DAY_NIGHT
        ? { color: ENEMY_COLOR_BROWN, count: 1 }
        : null;

    // Maze/Labyrinth have numbered defenders (6/4/2 pattern) - simplified to 1
    case SiteType.Maze:
    case SiteType.Labyrinth:
      return { color: ENEMY_COLOR_BROWN, count: 1 };

    // Safe sites - no defenders
    case SiteType.Village:
    case SiteType.Monastery:
    case SiteType.MagicalGlade:
    case SiteType.Mine:
    case SiteType.DeepMine:
    case SiteType.Portal:
    case SiteType.RefugeeCamp:
      return null;

    // City - complex multi-enemy setup (deferred)
    case SiteType.City:
      return null;

    // Volkare's Camp - special scenario (deferred)
    case SiteType.VolkaresCamp:
      return null;

    default:
      return null;
  }
}

/**
 * Get enemy configuration for adventure sites when a player explores them.
 * These enemies are drawn when the player chooses to enter the site,
 * not when the tile is revealed.
 */
export function getAdventureSiteEnemies(
  siteType: SiteType
): SiteDefenderConfig | null {
  switch (siteType) {
    case SiteType.Dungeon:
      // Per rules: "reveal a brown enemy token and fight it"
      return { color: ENEMY_COLOR_BROWN, count: 1 };
    case SiteType.Tomb:
      // Per rules: "draw a red Draconum enemy token to fight"
      return { color: ENEMY_COLOR_RED, count: 1 };
    case SiteType.MonsterDen:
      // Per rules: "draw a brown enemy token to fight"
      return { color: ENEMY_COLOR_BROWN, count: 1 };
    case SiteType.SpawningGrounds:
      // Per rules: "draw two brown enemy tokens and fight them"
      return { color: ENEMY_COLOR_BROWN, count: 2 };
    default:
      return null;
  }
}

// =============================================================================
// RAMPAGING ENEMY MAPPING
// =============================================================================

/**
 * Get the enemy deck color for a rampaging enemy type.
 */
export function getRampagingEnemyColor(
  rampagingType: RampagingEnemyType
): EnemyColor {
  switch (rampagingType) {
    case RampagingEnemyType.OrcMarauder:
      return ENEMY_COLOR_GREEN;
    case RampagingEnemyType.Draconum:
      return ENEMY_COLOR_RED;
  }
}

// =============================================================================
// VISIBILITY RULES
// =============================================================================

/**
 * Determine if enemies at a site are placed face-up (revealed) or face-down.
 * Per Mage Knight rules:
 * - Fortified sites (Keep, Mage Tower): face-DOWN, revealed when adjacent during Day
 * - Adventure sites (Monster Den, Spawning Grounds): face-UP (immediately visible)
 * - Cities: face-DOWN (complex setup, handled separately)
 * - Ancient Ruins at night: face-UP
 */
function isSiteEnemyRevealed(siteType: SiteType): boolean {
  switch (siteType) {
    // Fortified sites - face DOWN
    case SiteType.Keep:
    case SiteType.MageTower:
    case SiteType.City:
      return false;

    // Adventure sites - face UP when placed
    // (Monster Den, Spawning Grounds have enemies drawn when you enter,
    //  and they're revealed to fight. Maze/Labyrinth similar.)
    case SiteType.MonsterDen:
    case SiteType.SpawningGrounds:
    case SiteType.AncientRuins:
    case SiteType.Maze:
    case SiteType.Labyrinth:
      return true;

    // Dungeon/Tomb enemies drawn on explore - face UP when drawn
    case SiteType.Dungeon:
    case SiteType.Tomb:
      return true;

    // Safe sites don't have enemies, but default to revealed
    default:
      return true;
  }
}

// =============================================================================
// DRAW ENEMIES FOR HEX
// =============================================================================

export interface DrawEnemiesForHexResult {
  readonly enemies: readonly HexEnemy[];
  readonly piles: EnemyTokenPiles;
  readonly rng: RngState;
}

/**
 * Draw all enemies needed for a hex (rampaging + site defenders).
 * Pass timeOfDay to correctly handle sites like Ancient Ruins (night-only enemies).
 *
 * Returns HexEnemy[] with proper isRevealed values:
 * - Rampaging enemies: always face-UP (revealed)
 * - Fortified sites: face-DOWN (unrevealed)
 * - Adventure sites: face-UP (revealed)
 */
export function drawEnemiesForHex(
  rampagingTypes: readonly RampagingEnemyType[],
  siteType: SiteType | null,
  piles: EnemyTokenPiles,
  rng: RngState,
  timeOfDay?: TimeOfDay
): DrawEnemiesForHexResult {
  const enemies: HexEnemy[] = [];
  let currentPiles = piles;
  let currentRng = rng;

  // Draw rampaging enemies - always face UP (revealed)
  for (const rampagingType of rampagingTypes) {
    const color = getRampagingEnemyColor(rampagingType);
    const result = drawEnemy(currentPiles, color, currentRng);
    if (result.tokenId) {
      enemies.push({
        tokenId: result.tokenId,
        color,
        isRevealed: true, // Rampaging enemies are always face-up
      });
    }
    currentPiles = result.piles;
    currentRng = result.rng;
  }

  // Draw site defenders (only those placed at tile reveal)
  if (siteType) {
    const defenderConfig = getSiteDefenders(siteType, timeOfDay);
    if (defenderConfig) {
      const isRevealed = isSiteEnemyRevealed(siteType);
      for (let i = 0; i < defenderConfig.count; i++) {
        const result = drawEnemy(currentPiles, defenderConfig.color, currentRng);
        if (result.tokenId) {
          enemies.push({
            tokenId: result.tokenId,
            color: defenderConfig.color,
            isRevealed,
          });
        }
        currentPiles = result.piles;
        currentRng = result.rng;
      }
    }
  }

  return {
    enemies,
    piles: currentPiles,
    rng: currentRng,
  };
}
