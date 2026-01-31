/**
 * Site to enemy mapping
 *
 * Functions for determining enemy colors and counts for sites,
 * rampaging enemy types, and visibility rules.
 */

import type { EnemyColor, TimeOfDay } from "@mage-knight/shared";
import {
  ENEMY_COLOR_BROWN,
  ENEMY_COLOR_GRAY,
  ENEMY_COLOR_GREEN,
  ENEMY_COLOR_RED,
  ENEMY_COLOR_VIOLET,
} from "@mage-knight/shared";
import { SiteType, RampagingEnemyType } from "../../../types/map.js";

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
 * Ancient Ruins use yellow ruins tokens (not enemy tokens) - handled separately.
 *
 * @param _timeOfDay - Currently unused, kept for potential future time-based defenders
 */
export function getSiteDefenders(
  siteType: SiteType,
  _timeOfDay?: TimeOfDay
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

    // Ancient Ruins: uses yellow ruins tokens (not enemy tokens)
    // Ruins tokens are handled separately via ruinsTokenHelpers
    case SiteType.AncientRuins:
      return null;

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
export function isSiteEnemyRevealed(siteType: SiteType): boolean {
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
