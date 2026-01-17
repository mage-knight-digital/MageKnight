/**
 * PixiJS Particle System
 *
 * Lightweight particle effects for tile reveals and combat polish.
 * Phase 5: Magic outlines, dust bursts, and ambient sparkles.
 */

import { Container, Graphics, Ticker } from "pixi.js";
import type { PixelPosition } from "./types";
import { HEX_SIZE, TILE_WIDTH, TILE_HEIGHT } from "./types";
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
 * Generate vertices for a 7-hex cluster outline (the actual tile boundary)
 * This traces the outer edge of the center hex + 6 surrounding hexes
 * creating the characteristic "flower" shape of a Mage Knight tile.
 *
 * Uses the EXACT same vertex calculation as getHexVertices and hexToPixel
 * to ensure perfect alignment with the rendered hex overlays.
 *
 * Returns 18 vertices RELATIVE TO THE TILE CENTER for continuous tracing.
 */
function get7HexClusterVertices(hexSize: number): PixelPosition[] {
  // Use the exact same vertex calculation as getHexVertices
  const getVertex = (hexCenterX: number, hexCenterY: number, vertexIndex: number): PixelPosition => {
    const angle = (Math.PI / 3) * vertexIndex - Math.PI / 6; // Same as getHexVertices
    return {
      x: hexCenterX + hexSize * Math.cos(angle),
      y: hexCenterY + hexSize * Math.sin(angle)
    };
  };

  // Use the exact same center calculation as hexToPixel
  const getHexCenter = (q: number, r: number): PixelPosition => ({
    x: hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: hexSize * ((3 / 2) * r)
  });

  // The 6 outer hexes using TILE_HEX_OFFSETS from the game engine
  // NE: (1, -1), E: (1, 0), SE: (0, 1), SW: (-1, 1), W: (-1, 0), NW: (0, -1)
  const nw = getHexCenter(0, -1);
  const ne = getHexCenter(1, -1);
  const e = getHexCenter(1, 0);
  const se = getHexCenter(0, 1);
  const sw = getHexCenter(-1, 1);
  const w = getHexCenter(-1, 0);

  // Trace clockwise starting from NW hex
  // getHexVertices returns: 0=top-right, 1=right, 2=bottom-right, 3=bottom-left, 4=left, 5=top-left
  // Each outer hex contributes 3 outer vertices to the boundary (18 total)
  return [
    // NW hex - outer vertices 4, 5, 0
    getVertex(nw.x, nw.y, 4),
    getVertex(nw.x, nw.y, 5),
    getVertex(nw.x, nw.y, 0),

    // NE hex - outer vertices 5, 0, 1
    getVertex(ne.x, ne.y, 5),
    getVertex(ne.x, ne.y, 0),
    getVertex(ne.x, ne.y, 1),

    // E hex - outer vertices 0, 1, 2
    getVertex(e.x, e.y, 0),
    getVertex(e.x, e.y, 1),
    getVertex(e.x, e.y, 2),

    // SE hex - outer vertices 1, 2, 3
    getVertex(se.x, se.y, 1),
    getVertex(se.x, se.y, 2),
    getVertex(se.x, se.y, 3),

    // SW hex - outer vertices 2, 3, 4
    getVertex(sw.x, sw.y, 2),
    getVertex(sw.x, sw.y, 3),
    getVertex(sw.x, sw.y, 4),

    // W hex - outer vertices 3, 4, 5
    getVertex(w.x, w.y, 3),
    getVertex(w.x, w.y, 4),
    getVertex(w.x, w.y, 5),
  ];
}

/**
 * Tile outline tracer - draws magic outline around the 7-hex cluster with sparkles
 */
export class TileOutlineTracer {
  private graphics: Graphics;
  private progress = 0;
  private duration: number;
  private isActive = true;
  private vertices: PixelPosition[];
  private numVertices: number;
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
    // Use actual 7-hex cluster boundary (18 vertices: 6 outer hexes × 3 outer vertices each)
    // Use full HEX_SIZE to match the tile images
    this.vertices = get7HexClusterVertices(HEX_SIZE);
    this.numVertices = this.vertices.length;
    this.onComplete = onComplete;
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    this.progress += deltaMs / this.duration;

    // Spawn sparkles along the drawing path
    if (this.progress < 1) {
      const totalLength = this.numVertices; // 18 edges around the cluster
      const currentPos = this.progress * totalLength;
      const sideIndex = Math.floor(currentPos) % this.numVertices;
      const sideProgress = currentPos - Math.floor(currentPos);

      const v1 = this.vertices[sideIndex];
      const v2 = this.vertices[(sideIndex + 1) % this.numVertices];
      if (!v1 || !v2) return true;

      const sparkleX =
        this.center.x + v1.x + (v2.x - v1.x) * sideProgress;
      const sparkleY =
        this.center.y + v1.y + (v2.y - v1.y) * sideProgress;

      // Add sparkles at trace point
      if (Math.random() < 0.5) {
        this.sparkles.push({
          x: sparkleX + (Math.random() - 0.5) * 6,
          y: sparkleY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 25,
          vy: (Math.random() - 0.5) * 25 - 10,
          life: 350 + Math.random() * 250,
          maxLife: 600,
          size: 2 + Math.random() * 2,
          startSize: 3,
          endSize: 0,
          color: Math.random() < 0.5 ? 0xffffff : this.color,
          alpha: 1,
          startAlpha: 1,
          endAlpha: 0,
          rotation: 0,
          rotationSpeed: 0,
          gravity: 12,
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
    const totalLength = this.numVertices;
    const currentPos = Math.min(this.progress, 1) * totalLength;

    const firstVertex = this.vertices[0];
    if (!firstVertex) return;

    this.graphics.moveTo(
      this.center.x + firstVertex.x,
      this.center.y + firstVertex.y
    );

    for (let i = 0; i < this.numVertices; i++) {
      if (i >= currentPos) break;

      const nextVertex = this.vertices[(i + 1) % this.numVertices];
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
          const x = this.center.x + v1.x + (v2.x - v1.x) * sideProgress;
          const y = this.center.y + v1.y + (v2.y - v1.y) * sideProgress;
          this.graphics.lineTo(x, y);
        }
      }
    }

    // Line for tile outline
    this.graphics.stroke({ width: 2, color: this.color, alpha: 0.9 });

    // Draw glow effect
    this.graphics.moveTo(
      this.center.x + firstVertex.x,
      this.center.y + firstVertex.y
    );

    for (let i = 0; i < this.numVertices && i < currentPos; i++) {
      const nextVertex = this.vertices[(i + 1) % this.numVertices];
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

    // Wider glow
    this.graphics.stroke({ width: 8, color: this.color, alpha: 0.15 });

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
 * Hex outline tracer - draws magic outline with sparkles (for single hex effects)
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
 * Drop shadow for 3D rising effect - uses hex cluster shape
 */
export class DropShadow {
  private graphics: Graphics;
  private _scale = 1;
  private _alpha = 0.3;
  private _offsetY = 0; // Vertical offset for shadow (increases as tile rises)
  private vertices: PixelPosition[];

  constructor(
    private container: Container,
    private center: PixelPosition,
    hexSize: number
  ) {
    this.graphics = new Graphics();
    this.graphics.zIndex = -1; // Below other content
    this.container.addChild(this.graphics);
    // Get the hex cluster vertices for the shadow shape
    this.vertices = get7HexClusterVertices(hexSize);
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

  set offsetY(value: number) {
    this._offsetY = value;
    this.render();
  }

  get offsetY(): number {
    return this._offsetY;
  }

  private render(): void {
    this.graphics.clear();

    // Shadow centered directly under tile - no offset
    const shadowPoints = this.vertices.map(v => ({
      x: this.center.x + v.x * this._scale,
      y: this.center.y + v.y * this._scale
    }));

    // Soft dark shadow
    this.graphics
      .poly(shadowPoints)
      .fill({ color: 0x000000, alpha: 0.25 });
  }

  destroy(): void {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}

/**
 * Dust puff effect - soft ground-level dust that spreads outward and settles
 * Like dust being pushed out from under a heavy object landing
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
      count: 16,
      lifetime: 1200,           // Longer life for slow drift
      lifetimeVariance: 400,
      startSize: 4,
      endSize: 12,              // Grow as they dissipate
      sizeVariance: 3,
      colors: [0x8b8b8b, 0x9a9a9a, 0x7a7a7a, 0xa5a5a5], // Muted gray dust
      startAlpha: 0.35,         // Start more transparent
      endAlpha: 0,
      speed: 25,                // Much slower - gentle puff
      speedVariance: 15,
      direction: Math.PI / 2,   // Horizontal outward (will be randomized by spread)
      spread: Math.PI * 2,      // Full 360 degrees
      gravity: -2,              // Slight upward drift (dust floats)
      rotationSpeed: 0.5,
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

// Union type for tracers
type OutlineTracer = HexOutlineTracer | TileOutlineTracer;

/**
 * Particle system manager - coordinates all active effects
 */
export class ParticleManager {
  private emitters: Set<ParticleEmitter> = new Set();
  private tracers: Set<OutlineTracer> = new Set();
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

  addTracer(tracer: OutlineTracer): void {
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
   * Create a hex outline trace effect (for single hex)
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
   * Create a tile outline trace effect (for full tile cluster)
   */
  traceTileOutline(
    container: Container,
    center: PixelPosition,
    duration: number,
    color?: number,
    onComplete?: () => void
  ): TileOutlineTracer {
    const tracer = new TileOutlineTracer(container, center, duration, color, onComplete);
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

// Debug: Slow down animations for analysis (1 = normal, higher = slower)
const DEBUG_SLOWDOWN = 1; // Normal speed

// Animation timing for Phase 5 effects
export const HEX_OUTLINE_DURATION_MS = 300 * DEBUG_SLOWDOWN;
export const TILE_RISE_DURATION_MS = 400 * DEBUG_SLOWDOWN;
export const TILE_SLAM_DURATION_MS = 150 * DEBUG_SLOWDOWN;
export const DUST_BURST_DELAY_MS = 50 * DEBUG_SLOWDOWN; // Slight delay after slam
export const SCREEN_SHAKE_DURATION_MS = 100 * DEBUG_SLOWDOWN;
export const SCREEN_SHAKE_INTENSITY = 3;
