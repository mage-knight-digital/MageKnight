/**
 * Level system constants and helper functions
 */

// Fame thresholds for each level
export const LEVEL_THRESHOLDS = [
  0, // Level 1 (start)
  3, // Level 2
  8, // Level 3
  14, // Level 4
  21, // Level 5
  29, // Level 6
  38, // Level 7
  48, // Level 8
  59, // Level 9
  71, // Level 10
] as const;

export const MAX_LEVEL = 10;

// Stats by level
export interface LevelStats {
  readonly armor: number;
  readonly handLimit: number;
  readonly commandSlots: number;
}

// Level stats progression
// Armor increases at levels 3, 7
// Hand limit increases at levels 5, 9
// Command slots increase at levels 3, 5, 7, 9 (odd levels)
export const LEVEL_STATS: Record<number, LevelStats> = {
  1: { armor: 2, handLimit: 5, commandSlots: 1 },
  2: { armor: 2, handLimit: 5, commandSlots: 1 },
  3: { armor: 3, handLimit: 5, commandSlots: 2 },
  4: { armor: 3, handLimit: 5, commandSlots: 2 },
  5: { armor: 3, handLimit: 6, commandSlots: 3 },
  6: { armor: 3, handLimit: 6, commandSlots: 3 },
  7: { armor: 4, handLimit: 6, commandSlots: 4 },
  8: { armor: 4, handLimit: 6, commandSlots: 4 },
  9: { armor: 4, handLimit: 7, commandSlots: 5 },
  10: { armor: 4, handLimit: 7, commandSlots: 5 },
};

export function getLevelStats(level: number): LevelStats {
  const stats = LEVEL_STATS[level];
  if (!stats) {
    throw new Error(`Missing LEVEL_STATS for level: ${level}`);
  }
  return stats;
}

// Level up rewards
export const LEVEL_UP_TYPE_ODD = "odd" as const; // Levels 3, 5, 7, 9: +command slot, +armor/hand
export const LEVEL_UP_TYPE_EVEN = "even" as const; // Levels 2, 4, 6, 8, 10: +skill, +advanced action

export type LevelUpType = typeof LEVEL_UP_TYPE_ODD | typeof LEVEL_UP_TYPE_EVEN;

export function getLevelUpType(level: number): LevelUpType {
  return level % 2 === 0 ? LEVEL_UP_TYPE_EVEN : LEVEL_UP_TYPE_ODD;
}

// Calculate level from fame
export function getLevelFromFame(fame: number): number {
  for (let level = MAX_LEVEL; level >= 1; level--) {
    const threshold = LEVEL_THRESHOLDS[level - 1];
    if (threshold !== undefined && fame >= threshold) {
      return level;
    }
  }
  return 1;
}

// Check how many levels crossed between old and new fame
export function getLevelsCrossed(oldFame: number, newFame: number): number[] {
  const oldLevel = getLevelFromFame(oldFame);
  const newLevel = getLevelFromFame(newFame);

  if (newLevel <= oldLevel) return [];

  const crossed: number[] = [];
  for (let level = oldLevel + 1; level <= newLevel; level++) {
    crossed.push(level);
  }
  return crossed;
}
