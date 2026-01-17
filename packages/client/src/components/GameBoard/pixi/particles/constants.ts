/**
 * Particle System Constants
 *
 * Animation timing and debug settings for particle effects.
 */

// Debug: Slow down animations for analysis (1 = normal, higher = slower)
const DEBUG_SLOWDOWN = 1; // Normal speed
const DEBUG_PORTAL_SLOWDOWN = 1; // Normal speed

// Animation timing for Phase 5 effects
// Animation timing - 20% slower for breathing room (Blizzard/Disney approach)
export const HEX_OUTLINE_DURATION_MS = 360 * DEBUG_SLOWDOWN; // was 300
export const TILE_RISE_DURATION_MS = 480 * DEBUG_SLOWDOWN; // was 400
export const TILE_SLAM_DURATION_MS = 180 * DEBUG_SLOWDOWN; // was 150
export const DUST_BURST_DELAY_MS = 50 * DEBUG_SLOWDOWN; // Slight delay after slam
export const SCREEN_SHAKE_DURATION_MS = 100 * DEBUG_SLOWDOWN;
export const SCREEN_SHAKE_INTENSITY = 3;

// Portal animation timing
export const PORTAL_OPEN_DURATION_MS = 600 * DEBUG_PORTAL_SLOWDOWN;
export const PORTAL_HOLD_DURATION_MS = 250 * DEBUG_PORTAL_SLOWDOWN; // Pause before hero emerges
export const PORTAL_HERO_EMERGE_DURATION_MS = 500 * DEBUG_PORTAL_SLOWDOWN;
export const PORTAL_CLOSE_DURATION_MS = 400 * DEBUG_PORTAL_SLOWDOWN;
// Total: 600 + 250 + 500 + 200 (breath) + 400 = 1950ms
