/**
 * Feature flags for the game engine.
 *
 * These can be toggled to enable/disable features for testing,
 * performance tuning, or gradual rollout.
 */

export const FEATURE_FLAGS = {
  /**
   * When enabled, computes all reachable hexes within move points
   * using Dijkstra's algorithm (flood-fill reachability).
   *
   * This enables the client to show the full movement range,
   * not just adjacent hexes.
   *
   * Disable if there are performance concerns with large move point values.
   */
  ENABLE_REACHABLE_HEXES: true,
} as const;
