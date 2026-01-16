/**
 * PixiJS Particle System
 *
 * Lightweight particle effects for tile reveals and combat polish.
 * Phase 5: Magic outlines, dust bursts, and ambient sparkles.
 */

import { Container, Graphics, Ticker } from "pixi.js";
import type { PixelPosition } from "./types";
import { HEX_SIZE } from "./types";
import { getHexVertices } from "./hexMath";

/**
 * Individual particle state
 */
interface Particle {
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
 * Particle emitter - manages a batch of particles
 */
export class ParticleEmitter {
  private particles: Particle[] = [];
  private graphics: Graphics;
  private isActive = true;
  private onComplete?: () => void;

  constructor(
    private container: Container,
    private origin: PixelPosition,
    private config: ParticleConfig,
    onComplete?: () => void
  ) {
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.onComplete = onComplete;
    this.spawn();
  }

  private spawn(): void {
    for (let i = 0; i < this.config.count; i++) {
      const lifetimeVar = this.config.lifetimeVariance ?? 0;
      const lifetime =
        this.config.lifetime + (Math.random() - 0.5) * 2 * lifetimeVar;

      const sizeVar = this.config.sizeVariance ?? 0;
      const startSize =
        this.config.startSize + (Math.random() - 0.5) * 2 * sizeVar;
      const endSize = this.config.endSize + (Math.random() - 0.5) * 2 * sizeVar;

      const speedVar = this.config.speedVariance ?? 0;
      const speed =
        this.config.speed + (Math.random() - 0.5) * 2 * speedVar;

      // Direction: if specified, use with spread; otherwise random 360
      let angle: number;
      if (this.config.direction !== undefined) {
        const spread = this.config.spread ?? 0;
        angle = this.config.direction + (Math.random() - 0.5) * spread;
      } else {
        angle = Math.random() * Math.PI * 2;
      }

      const colorIndex = Math.floor(Math.random() * this.config.colors.length);
      const color = this.config.colors[colorIndex] ?? 0xffffff;

      this.particles.push({
        x: this.origin.x,
        y: this.origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: lifetime,
        maxLife: lifetime,
        size: startSize,
        startSize,
        endSize,
        color,
        alpha: this.config.startAlpha,
        startAlpha: this.config.startAlpha,
        endAlpha: this.config.endAlpha,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (this.config.rotationSpeed ?? 0) * (Math.random() - 0.5) * 2,
        gravity: this.config.gravity ?? 0,
      });
    }
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    const dt = deltaMs / 1000; // Convert to seconds for physics

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics
      p.vy += p.gravity * dt * 1000;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;

      // Interpolate properties
      const progress = 1 - p.life / p.maxLife;
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * progress;
    }

    // Render
    this.render();

    // Check if complete
    if (this.particles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    for (const p of this.particles) {
      this.graphics
        .circle(p.x, p.y, p.size)
        .fill({ color: p.color, alpha: p.alpha });
    }
  }

  destroy(): void {
    this.isActive = false;
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
    if (this.onComplete) {
      this.onComplete();
    }
  }
}

/**
 * Hex outline tracer - draws magic outline with sparkles
 */
export class HexOutlineTracer {
  private graphics: Graphics;
  private progress = 0;
  private duration: number;
  private isActive = true;
  private vertices: PixelPosition[];
  private sparkles: Particle[] = [];
  private onComplete?: () => void;

  constructor(
    private container: Container,
    private center: PixelPosition,
    duration: number,
    private color: number = 0x88ccff,
    onComplete?: () => void
  ) {
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.duration = duration;
    this.vertices = getHexVertices(HEX_SIZE * 0.95);
    this.onComplete = onComplete;
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    this.progress += deltaMs / this.duration;

    // Spawn sparkles along the drawing path
    if (this.progress < 1) {
      const totalLength = 6; // 6 sides
      const currentPos = this.progress * totalLength;
      const sideIndex = Math.floor(currentPos) % 6;
      const sideProgress = currentPos - Math.floor(currentPos);

      const v1 = this.vertices[sideIndex];
      const v2 = this.vertices[(sideIndex + 1) % 6];
      if (!v1 || !v2) return true; // Skip this frame if vertices missing

      const sparkleX =
        this.center.x + v1.x + (v2.x - v1.x) * sideProgress;
      const sparkleY =
        this.center.y + v1.y + (v2.y - v1.y) * sideProgress;

      // Add sparkle at trace point
      if (Math.random() < 0.4) {
        this.sparkles.push({
          x: sparkleX + (Math.random() - 0.5) * 4,
          y: sparkleY + (Math.random() - 0.5) * 4,
          vx: (Math.random() - 0.5) * 20,
          vy: (Math.random() - 0.5) * 20 - 10,
          life: 300 + Math.random() * 200,
          maxLife: 500,
          size: 2 + Math.random() * 2,
          startSize: 3,
          endSize: 0,
          color: Math.random() < 0.5 ? 0xffffff : this.color,
          alpha: 1,
          startAlpha: 1,
          endAlpha: 0,
          rotation: 0,
          rotationSpeed: 0,
          gravity: 20,
        });
      }
    }

    // Update sparkles
    const dt = deltaMs / 1000;
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      if (!s) continue;
      s.life -= deltaMs;
      if (s.life <= 0) {
        this.sparkles.splice(i, 1);
        continue;
      }
      s.vy += s.gravity * dt * 100;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const progress = 1 - s.life / s.maxLife;
      s.size = s.startSize + (s.endSize - s.startSize) * progress;
      s.alpha = s.startAlpha + (s.endAlpha - s.startAlpha) * progress;
    }

    this.render();

    // Complete when fully drawn and sparkles gone
    if (this.progress >= 1 && this.sparkles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    // Draw the outline up to current progress
    const totalLength = 6;
    const currentPos = Math.min(this.progress, 1) * totalLength;

    const firstVertex = this.vertices[0];
    if (!firstVertex) return;

    this.graphics.moveTo(
      this.center.x + firstVertex.x,
      this.center.y + firstVertex.y
    );

    for (let i = 0; i < 6; i++) {
      if (i >= currentPos) break;

      const nextVertex = this.vertices[(i + 1) % 6];
      if (!nextVertex) continue;

      if (i + 1 <= currentPos) {
        // Full side
        this.graphics.lineTo(
          this.center.x + nextVertex.x,
          this.center.y + nextVertex.y
        );
      } else {
        // Partial side
        const sideProgress = currentPos - i;
        const v1 = this.vertices[i];
        const v2 = nextVertex;
        if (v1) {
          const x = this.center.x + v1.x + (v2.x - v1.x) * sideProgress;
          const y = this.center.y + v1.y + (v2.y - v1.y) * sideProgress;
          this.graphics.lineTo(x, y);
        }
      }
    }

    this.graphics.stroke({ width: 2, color: this.color, alpha: 0.8 });

    // Draw glow effect
    this.graphics.moveTo(
      this.center.x + firstVertex.x,
      this.center.y + firstVertex.y
    );

    for (let i = 0; i < 6 && i < currentPos; i++) {
      const nextVertex = this.vertices[(i + 1) % 6];
      if (!nextVertex) continue;

      if (i + 1 <= currentPos) {
        this.graphics.lineTo(
          this.center.x + nextVertex.x,
          this.center.y + nextVertex.y
        );
      } else {
        const sideProgress = currentPos - i;
        const v1 = this.vertices[i];
        const v2 = nextVertex;
        if (v1) {
          this.graphics.lineTo(
            this.center.x + v1.x + (v2.x - v1.x) * sideProgress,
            this.center.y + v1.y + (v2.y - v1.y) * sideProgress
          );
        }
      }
    }

    this.graphics.stroke({ width: 6, color: this.color, alpha: 0.2 });

    // Draw sparkles
    for (const s of this.sparkles) {
      this.graphics
        .circle(s.x, s.y, s.size)
        .fill({ color: s.color, alpha: s.alpha });
    }
  }

  destroy(): void {
    this.isActive = false;
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
    if (this.onComplete) {
      this.onComplete();
    }
  }
}

/**
 * Drop shadow for 3D rising effect
 */
export class DropShadow {
  private graphics: Graphics;
  private _scale = 1;
  private _alpha = 0.3;

  constructor(
    private container: Container,
    private center: PixelPosition,
    private radius: number
  ) {
    this.graphics = new Graphics();
    this.graphics.zIndex = -1; // Below other content
    this.container.addChild(this.graphics);
    this.render();
  }

  set scale(value: number) {
    this._scale = value;
    this.render();
  }

  get scale(): number {
    return this._scale;
  }

  set alpha(value: number) {
    this._alpha = value;
    this.render();
  }

  get alpha(): number {
    return this._alpha;
  }

  private render(): void {
    this.graphics.clear();

    // Elliptical shadow (flattened vertically for 3D perspective)
    const shadowWidth = this.radius * this._scale;
    const shadowHeight = this.radius * this._scale * 0.4;

    this.graphics
      .ellipse(this.center.x, this.center.y + this.radius * 0.3, shadowWidth, shadowHeight)
      .fill({ color: 0x000000, alpha: this._alpha });
  }

  destroy(): void {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}

/**
 * Dust burst effect - "flour from dropped book" explosion
 */
export function createDustBurst(
  container: Container,
  origin: PixelPosition,
  onComplete?: () => void
): ParticleEmitter {
  return new ParticleEmitter(
    container,
    origin,
    {
      count: 24,
      lifetime: 600,
      lifetimeVariance: 200,
      startSize: 3,
      endSize: 8,
      sizeVariance: 2,
      colors: [0xd4c4a8, 0xc9b896, 0xbfae84, 0xe0d4bc], // Dusty tan colors
      startAlpha: 0.6,
      endAlpha: 0,
      speed: 80,
      speedVariance: 40,
      direction: -Math.PI / 2, // Upward bias
      spread: Math.PI * 1.5, // Wide spread
      gravity: 30, // Light gravity to drift down
      rotationSpeed: 2,
    },
    onComplete
  );
}

/**
 * Magic sparkle burst for tile appearance
 */
export function createMagicSparkles(
  container: Container,
  origin: PixelPosition,
  onComplete?: () => void
): ParticleEmitter {
  return new ParticleEmitter(
    container,
    origin,
    {
      count: 16,
      lifetime: 400,
      lifetimeVariance: 150,
      startSize: 2,
      endSize: 0,
      sizeVariance: 1,
      colors: [0xffffff, 0x88ccff, 0xaaddff, 0xffeeaa], // White/blue/gold sparkles
      startAlpha: 1,
      endAlpha: 0,
      speed: 60,
      speedVariance: 30,
      gravity: -10, // Float upward slightly
      rotationSpeed: 3,
    },
    onComplete
  );
}

/**
 * Particle system manager - coordinates all active effects
 */
export class ParticleManager {
  private emitters: Set<ParticleEmitter> = new Set();
  private tracers: Set<HexOutlineTracer> = new Set();
  private shadows: Map<string, DropShadow> = new Map();
  private ticker: Ticker | null = null;
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  attach(ticker: Ticker): void {
    if (this.ticker) {
      this.detach();
    }
    this.ticker = ticker;
    this.tickerCallback = (t: Ticker) => this.update(t.deltaMS);
    ticker.add(this.tickerCallback);
  }

  detach(): void {
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
    }
    this.ticker = null;
    this.tickerCallback = null;
  }

  private update(deltaMs: number): void {
    // Update emitters
    for (const emitter of this.emitters) {
      if (!emitter.update(deltaMs)) {
        this.emitters.delete(emitter);
      }
    }

    // Update tracers
    for (const tracer of this.tracers) {
      if (!tracer.update(deltaMs)) {
        this.tracers.delete(tracer);
      }
    }
  }

  addEmitter(emitter: ParticleEmitter): void {
    this.emitters.add(emitter);
  }

  addTracer(tracer: HexOutlineTracer): void {
    this.tracers.add(tracer);
  }

  addShadow(id: string, shadow: DropShadow): void {
    this.shadows.set(id, shadow);
  }

  getShadow(id: string): DropShadow | undefined {
    return this.shadows.get(id);
  }

  removeShadow(id: string): void {
    const shadow = this.shadows.get(id);
    if (shadow) {
      shadow.destroy();
      this.shadows.delete(id);
    }
  }

  /**
   * Create a hex outline trace effect
   */
  traceHexOutline(
    container: Container,
    center: PixelPosition,
    duration: number,
    color?: number,
    onComplete?: () => void
  ): HexOutlineTracer {
    const tracer = new HexOutlineTracer(container, center, duration, color, onComplete);
    this.tracers.add(tracer);
    return tracer;
  }

  /**
   * Create a dust burst effect
   */
  dustBurst(
    container: Container,
    origin: PixelPosition,
    onComplete?: () => void
  ): ParticleEmitter {
    const emitter = createDustBurst(container, origin, onComplete);
    this.emitters.add(emitter);
    return emitter;
  }

  /**
   * Create magic sparkles effect
   */
  magicSparkles(
    container: Container,
    origin: PixelPosition,
    onComplete?: () => void
  ): ParticleEmitter {
    const emitter = createMagicSparkles(container, origin, onComplete);
    this.emitters.add(emitter);
    return emitter;
  }

  /**
   * Clean up all effects
   */
  clear(): void {
    for (const emitter of this.emitters) {
      emitter.destroy();
    }
    this.emitters.clear();

    for (const tracer of this.tracers) {
      tracer.destroy();
    }
    this.tracers.clear();

    for (const shadow of this.shadows.values()) {
      shadow.destroy();
    }
    this.shadows.clear();
  }
}

// Animation timing for Phase 5 effects
export const HEX_OUTLINE_DURATION_MS = 300;
export const TILE_RISE_DURATION_MS = 400;
export const TILE_SLAM_DURATION_MS = 150;
export const DUST_BURST_DELAY_MS = 50; // Slight delay after slam
export const SCREEN_SHAKE_DURATION_MS = 100;
export const SCREEN_SHAKE_INTENSITY = 3;
