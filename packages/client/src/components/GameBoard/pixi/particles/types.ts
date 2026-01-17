/**
 * Particle System Types
 *
 * Shared interfaces for the particle effects system.
 */

/**
 * Individual particle state
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  startSize: number;
  endSize: number;
  color: number;
  alpha: number;
  startAlpha: number;
  endAlpha: number;
  rotation: number;
  rotationSpeed: number;
  gravity: number;
}

/**
 * Particle emitter configuration
 */
export interface ParticleConfig {
  /** Number of particles to spawn */
  count: number;
  /** Particle lifetime in ms */
  lifetime: number;
  /** Lifetime variance (random +/- this amount) */
  lifetimeVariance?: number;
  /** Starting size */
  startSize: number;
  /** Ending size */
  endSize: number;
  /** Size variance */
  sizeVariance?: number;
  /** Particle color(s) - picks randomly if array */
  colors: number[];
  /** Starting alpha */
  startAlpha: number;
  /** Ending alpha */
  endAlpha: number;
  /** Initial velocity range */
  speed: number;
  /** Speed variance */
  speedVariance?: number;
  /** Direction in radians (undefined = random 360) */
  direction?: number;
  /** Direction spread in radians */
  spread?: number;
  /** Gravity (positive = down) */
  gravity?: number;
  /** Rotation speed range */
  rotationSpeed?: number;
}

/**
 * Dust cloud particle - extends base particle with turbulence
 */
export interface DustParticle extends Particle {
  turbulencePhase: number; // Phase offset for organic wobble
  turbulenceSpeed: number; // How fast it wobbles
  turbulenceAmp: number; // Amplitude of wobble
  layer: number; // 0 = background wisp, 1 = mid, 2 = foreground puff
}
