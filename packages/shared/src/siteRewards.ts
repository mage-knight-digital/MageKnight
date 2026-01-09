/**
 * Site Reward Types
 *
 * Defines the rewards granted when conquering or exploring sites.
 * Used by Mage Towers, Dungeons, Tombs, Monster Dens, etc.
 */

// =============================================================================
// Reward Type Constants
// =============================================================================

export const SITE_REWARD_SPELL = "spell" as const;
export const SITE_REWARD_ARTIFACT = "artifact" as const;
export const SITE_REWARD_CRYSTAL_ROLL = "crystal_roll" as const;
export const SITE_REWARD_ADVANCED_ACTION = "advanced_action" as const;
export const SITE_REWARD_FAME = "fame" as const;
export const SITE_REWARD_COMPOUND = "compound" as const;

// =============================================================================
// Reward Type Union
// =============================================================================

export type SiteRewardType =
  | typeof SITE_REWARD_SPELL
  | typeof SITE_REWARD_ARTIFACT
  | typeof SITE_REWARD_CRYSTAL_ROLL
  | typeof SITE_REWARD_ADVANCED_ACTION
  | typeof SITE_REWARD_FAME
  | typeof SITE_REWARD_COMPOUND;

// =============================================================================
// Reward Discriminated Union
// =============================================================================

/**
 * Spell reward - draw from spell offer
 * Used by: Mage Tower, Dungeon (on gold/black roll), Tomb, Maze, Labyrinth
 */
export interface SpellReward {
  readonly type: typeof SITE_REWARD_SPELL;
  readonly count: number;
}

/**
 * Artifact reward - draw from artifact offer
 * Used by: Dungeon (on color roll), Tomb, Spawning Grounds, Maze, Labyrinth
 */
export interface ArtifactReward {
  readonly type: typeof SITE_REWARD_ARTIFACT;
  readonly count: number;
}

/**
 * Crystal roll reward - roll mana die for crystal color
 * Gold = player choice, Black = +1 fame instead
 * Used by: Monster Den, Spawning Grounds
 */
export interface CrystalRollReward {
  readonly type: typeof SITE_REWARD_CRYSTAL_ROLL;
  readonly count: number;
}

/**
 * Advanced action reward - draw from advanced action offer
 * Used by: Labyrinth
 */
export interface AdvancedActionReward {
  readonly type: typeof SITE_REWARD_ADVANCED_ACTION;
  readonly count: number;
}

/**
 * Fame reward - gain flat fame amount
 * Used by: Ancient Ruins (altar tribute)
 */
export interface FameReward {
  readonly type: typeof SITE_REWARD_FAME;
  readonly amount: number;
}

/**
 * Compound reward - multiple rewards combined
 * Used by: Tomb (spell + artifact), Spawning Grounds (artifact + crystals)
 */
export interface CompoundReward {
  readonly type: typeof SITE_REWARD_COMPOUND;
  readonly rewards: readonly SiteReward[];
}

/**
 * Union of all site reward types
 */
export type SiteReward =
  | SpellReward
  | ArtifactReward
  | CrystalRollReward
  | AdvancedActionReward
  | FameReward
  | CompoundReward;

// =============================================================================
// Helper Constructors
// =============================================================================

export const spellReward = (count: number = 1): SpellReward => ({
  type: SITE_REWARD_SPELL,
  count,
});

export const artifactReward = (count: number = 1): ArtifactReward => ({
  type: SITE_REWARD_ARTIFACT,
  count,
});

export const crystalRollReward = (count: number): CrystalRollReward => ({
  type: SITE_REWARD_CRYSTAL_ROLL,
  count,
});

export const advancedActionReward = (
  count: number = 1
): AdvancedActionReward => ({
  type: SITE_REWARD_ADVANCED_ACTION,
  count,
});

export const fameReward = (amount: number): FameReward => ({
  type: SITE_REWARD_FAME,
  amount,
});

export const compoundReward = (
  ...rewards: readonly SiteReward[]
): CompoundReward => ({
  type: SITE_REWARD_COMPOUND,
  rewards,
});
