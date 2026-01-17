/**
 * Particle System
 *
 * Re-exports all particle effect components for convenient importing.
 */

// Types
export type { Particle, ParticleConfig, DustParticle } from "./types";

// Constants
export {
  HEX_OUTLINE_DURATION_MS,
  TILE_RISE_DURATION_MS,
  TILE_SLAM_DURATION_MS,
  DUST_BURST_DELAY_MS,
  SCREEN_SHAKE_DURATION_MS,
  SCREEN_SHAKE_INTENSITY,
  PORTAL_OPEN_DURATION_MS,
  PORTAL_HOLD_DURATION_MS,
  PORTAL_HERO_EMERGE_DURATION_MS,
  PORTAL_CLOSE_DURATION_MS,
} from "./constants";

// Core particle emitter
export { ParticleEmitter, createMagicSparkles } from "./ParticleEmitter";

// Outline tracers
export {
  TileOutlineTracer,
  HexOutlineTracer,
  get7HexClusterVertices,
} from "./outlineTracers";

// Shadow effects
export { DropShadow, CircleShadow } from "./shadows";

// Dust effects
export {
  DustBurstEffect,
  MiniDustBurstEffect,
  createDustBurst,
} from "./dustEffects";

// Portal effect
export { PortalEffect } from "./PortalEffect";

// Central manager
export { ParticleManager } from "./ParticleManager";
