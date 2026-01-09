/**
 * Site properties for Mage Knight
 *
 * Defines the inherent properties of each site type.
 * Note: Some properties (like inhabited for Keep/MageTower/City) only apply
 * when the site is owned/conquered - game logic must check ownership too.
 */

import { SiteType } from "../types/map.js";
import {
  SiteReward,
  spellReward,
  artifactReward,
  crystalRollReward,
  compoundReward,
} from "@mage-knight/shared";

export interface SiteProperties {
  /** Requires Siege attacks to damage enemies, -1 Rep on assault */
  readonly fortified: boolean;
  /** Can interact with locals for Influence (when owned/conquered for some sites) */
  readonly inhabited: boolean;
  /** Can explore as action, has rewards */
  readonly adventureSite: boolean;
  /** More than one hero can end turn here (when conquered for City) */
  readonly allowsMultipleHeroes: boolean;
}

export const SITE_PROPERTIES: Record<SiteType, SiteProperties> = {
  [SiteType.Village]: {
    fortified: false,
    inhabited: true,
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.Monastery]: {
    fortified: false,
    inhabited: true,
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.MagicalGlade]: {
    fortified: false,
    inhabited: false,
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.Keep]: {
    fortified: true,
    inhabited: true, // when owned
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.MageTower]: {
    fortified: true,
    inhabited: true, // when conquered
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.AncientRuins]: {
    fortified: false,
    inhabited: false,
    adventureSite: true,
    allowsMultipleHeroes: false,
  },
  [SiteType.Dungeon]: {
    fortified: false,
    inhabited: false,
    adventureSite: true,
    allowsMultipleHeroes: false,
  },
  [SiteType.Tomb]: {
    fortified: false,
    inhabited: false,
    adventureSite: true,
    allowsMultipleHeroes: false,
  },
  [SiteType.MonsterDen]: {
    fortified: false,
    inhabited: false,
    adventureSite: true,
    allowsMultipleHeroes: false,
  },
  [SiteType.SpawningGrounds]: {
    fortified: false,
    inhabited: false,
    adventureSite: true,
    allowsMultipleHeroes: false,
  },
  [SiteType.Mine]: {
    fortified: false,
    inhabited: false,
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.Portal]: {
    fortified: false,
    inhabited: false,
    adventureSite: false,
    allowsMultipleHeroes: true,
  },
  [SiteType.City]: {
    fortified: true,
    inhabited: true, // when conquered
    adventureSite: false,
    allowsMultipleHeroes: true, // when conquered
  },

  // Lost Legion expansion sites
  [SiteType.DeepMine]: {
    fortified: false,
    inhabited: false,
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.Maze]: {
    fortified: false,
    inhabited: false,
    adventureSite: true, // numbered adventure site (6/4/2)
    allowsMultipleHeroes: false,
  },
  [SiteType.Labyrinth]: {
    fortified: false,
    inhabited: false,
    adventureSite: true, // core version of Maze (6/4/2)
    allowsMultipleHeroes: false,
  },
  [SiteType.RefugeeCamp]: {
    fortified: false,
    inhabited: true, // safe site similar to village
    adventureSite: false,
    allowsMultipleHeroes: false,
  },
  [SiteType.VolkaresCamp]: {
    fortified: true, // has walls
    inhabited: false,
    adventureSite: false, // special scenario site
    allowsMultipleHeroes: false,
  },
};

// Helper functions for querying site properties

export function isFortified(siteType: SiteType): boolean {
  return SITE_PROPERTIES[siteType].fortified;
}

export function isInhabited(siteType: SiteType): boolean {
  return SITE_PROPERTIES[siteType].inhabited;
}

export function isAdventureSite(siteType: SiteType): boolean {
  return SITE_PROPERTIES[siteType].adventureSite;
}

export function allowsMultipleHeroes(siteType: SiteType): boolean {
  return SITE_PROPERTIES[siteType].allowsMultipleHeroes;
}

// =============================================================================
// HEALING COSTS
// =============================================================================

/**
 * Healing costs by site type.
 * Value is the amount of influence required for 1 healing point.
 * Null means the site doesn't offer healing.
 */
export const HEALING_COSTS: Partial<Record<SiteType, number>> = {
  [SiteType.Village]: 3, // 3 influence = 1 healing
  [SiteType.Monastery]: 2, // 2 influence = 1 healing (cheaper)
};

/**
 * Get the healing cost for a site type.
 * Returns null if the site doesn't offer healing.
 */
export function getHealingCost(siteType: SiteType): number | null {
  return HEALING_COSTS[siteType] ?? null;
}

// =============================================================================
// CONQUEST REWARDS
// =============================================================================

/**
 * Rewards granted when a site is conquered (first time).
 * Note: Dungeon reward depends on die roll (spell vs artifact) - handled specially.
 * Note: Maze/Labyrinth rewards depend on path chosen - handled specially.
 */
export const CONQUEST_REWARDS: Partial<Record<SiteType, SiteReward>> = {
  // Mage Tower: 1 spell on conquest
  [SiteType.MageTower]: spellReward(1),

  // Tomb: 1 spell + 1 artifact on conquest
  [SiteType.Tomb]: compoundReward(spellReward(1), artifactReward(1)),

  // Monster Den: 2 crystal rolls on conquest
  [SiteType.MonsterDen]: crystalRollReward(2),

  // Spawning Grounds: 1 artifact + 3 crystal rolls on conquest
  [SiteType.SpawningGrounds]: compoundReward(
    artifactReward(1),
    crystalRollReward(3)
  ),

  // Note: Sites with special reward logic not listed here:
  // - Dungeon: roll die for spell (gold/black) vs artifact (color)
  // - Ancient Ruins: depends on yellow token
  // - Maze: depends on path (crystals / spell / artifact)
  // - Labyrinth: depends on path (crystals / spell / artifact) + advanced action
  // - Keep: no reward (just ownership)
  // - City: no reward (just conquest/ownership)
};

/**
 * Get the conquest reward for a site type.
 * Returns null if the site has no standard reward or uses special logic.
 */
export function getConquestReward(siteType: SiteType): SiteReward | null {
  return CONQUEST_REWARDS[siteType] ?? null;
}
