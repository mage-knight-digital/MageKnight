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
  // Pulse effect when circuit completes
  private isCircuitComplete = false;
  private pulseProgress = 0;
  private pulseDuration = 240; // ms for the pulse effect (20% slower for breathing room)

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

    // Phase 1: Drawing the trace
    if (!this.isCircuitComplete) {
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

      // Circuit just completed - trigger pulse!
      if (this.progress >= 1 && !this.isCircuitComplete) {
        this.isCircuitComplete = true;
        this.pulseProgress = 0;
        // Spawn burst of sparkles around the whole outline
        for (let i = 0; i < 24; i++) {
          const v = this.vertices[i % this.numVertices];
          if (!v) continue;
          this.sparkles.push({
            x: this.center.x + v.x + (Math.random() - 0.5) * 10,
            y: this.center.y + v.y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 60,
            vy: (Math.random() - 0.5) * 60 - 20,
            life: 300 + Math.random() * 200,
            maxLife: 500,
            size: 3 + Math.random() * 2,
            startSize: 4,
            endSize: 0,
            color: 0xffffff,
            alpha: 1,
            startAlpha: 1,
            endAlpha: 0,
            rotation: 0,
            rotationSpeed: 0,
            gravity: 15,
          });
        }
      }
    } else {
      // Phase 2: Pulse effect after circuit completes
      this.pulseProgress += deltaMs / this.pulseDuration;
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

    // Complete when pulse done and sparkles gone
    if (this.pulseProgress >= 1 && this.sparkles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    const firstVertex = this.vertices[0];
    if (!firstVertex) return;

    // Calculate line properties based on phase
    let lineWidth: number;
    let lineAlpha: number;
    let glowWidth: number;
    let glowAlpha: number;

    if (this.isCircuitComplete) {
      // Pulse effect: line gets thicker and brighter, then fades
      // Use sine wave for smooth pulse that peaks in the middle
      const pulseIntensity = Math.sin(Math.min(this.pulseProgress, 1) * Math.PI);
      lineWidth = 2 + 4 * pulseIntensity;  // 2 -> 6 -> 2
      lineAlpha = 0.9 + 0.1 * pulseIntensity; // Slightly brighter
      glowWidth = 8 + 12 * pulseIntensity;  // 8 -> 20 -> 8
      glowAlpha = 0.15 + 0.35 * pulseIntensity; // 0.15 -> 0.5 -> 0.15
    } else {
      // Drawing phase: thin line
      lineWidth = 2;
      lineAlpha = 0.9;
      glowWidth = 8;
      glowAlpha = 0.15;
    }

    // Draw the outline up to current progress (or full if circuit complete)
    const totalLength = this.numVertices;
    const currentPos = this.isCircuitComplete ? totalLength : Math.min(this.progress, 1) * totalLength;

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

    // Main line
    this.graphics.stroke({ width: lineWidth, color: this.color, alpha: lineAlpha });

    // Draw glow effect (wider, softer)
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

    // Glow
    this.graphics.stroke({ width: glowWidth, color: this.color, alpha: glowAlpha });

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
 * Dust puff effect - spreads outward along the ground from tile edges
 * Like dust being pushed out from under a heavy object slamming down
 * Hearthstone-style: particles spread horizontally, stay low, then dissipate
 */
export class DustBurstEffect {
  private particles: Particle[] = [];
  private graphics: Graphics;
  private isActive = true;
  private onComplete?: () => void;

  constructor(
    private container: Container,
    private center: PixelPosition,
    onComplete?: () => void
  ) {
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.onComplete = onComplete;
    this.spawn();
  }

  private spawn(): void {
    // Spawn dust particles around the tile perimeter
    // Each particle starts at an edge and moves outward
    const tileRadius = HEX_SIZE * 2.2; // Approximate tile edge distance
    const numParticles = 20;

    for (let i = 0; i < numParticles; i++) {
      // Random angle around the tile
      const angle = Math.random() * Math.PI * 2;

      // Start position: at the tile edge
      const startX = this.center.x + Math.cos(angle) * tileRadius;
      const startY = this.center.y + Math.sin(angle) * tileRadius;

      // Velocity: outward from center, mostly horizontal
      const outwardSpeed = 15 + Math.random() * 25; // Slow spread
      const vx = Math.cos(angle) * outwardSpeed;
      const vy = Math.sin(angle) * outwardSpeed * 0.3; // Flatten vertical component

      this.particles.push({
        x: startX,
        y: startY,
        vx,
        vy,
        life: 600 + Math.random() * 400, // 600-1000ms
        maxLife: 1000,
        size: 6 + Math.random() * 4,
        startSize: 6,
        endSize: 14, // Grow as they dissipate
        color: [0x9a9a9a, 0x8b8b8b, 0xa5a5a5, 0x7a7a7a][Math.floor(Math.random() * 4)] ?? 0x9a9a9a,
        alpha: 0.4,
        startAlpha: 0.4,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.5,
        gravity: 8, // Gentle downward pull to keep dust low
      });
    }
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    const dt = deltaMs / 1000;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics - add drag to slow particles down
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.vy += p.gravity * dt * 10; // Gentle gravity
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;

      // Interpolate properties
      const progress = 1 - p.life / p.maxLife;
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = p.startAlpha * (1 - progress * progress); // Fade out with easing
    }

    this.render();

    // Complete when all particles gone
    if (this.particles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    for (const p of this.particles) {
      // Draw soft circular dust puff
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
 * Legacy function for backward compatibility - now creates the improved dust effect
 */
export function createDustBurst(
  container: Container,
  origin: PixelPosition,
  onComplete?: () => void
): ParticleEmitter {
  // Create the new dust effect but return a fake emitter for compatibility
  // The ParticleManager will handle updating it
  return new ParticleEmitter(
    container,
    origin,
    {
      count: 0, // No particles from this - we'll use DustBurstEffect instead
      lifetime: 1,
      startSize: 0,
      endSize: 0,
      colors: [0x000000],
      startAlpha: 0,
      endAlpha: 0,
      speed: 0,
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
  private dustEffects: Set<DustBurstEffect> = new Set();
  private portalEffects: Set<PortalEffect> = new Set();
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

    // Update dust effects
    for (const dust of this.dustEffects) {
      if (!dust.update(deltaMs)) {
        this.dustEffects.delete(dust);
      }
    }

    // Update portal effects
    for (const portal of this.portalEffects) {
      if (!portal.update(deltaMs)) {
        this.portalEffects.delete(portal);
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
   * Create a dust burst effect - spreads outward from tile edges
   */
  dustBurst(
    container: Container,
    origin: PixelPosition,
    onComplete?: () => void
  ): DustBurstEffect {
    const dust = new DustBurstEffect(container, origin, onComplete);
    this.dustEffects.add(dust);
    return dust;
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
   * Create a void portal effect for hero emergence
   */
  createPortal(
    container: Container,
    center: PixelPosition,
    options: {
      heroId?: string;
      onHeroEmerge?: () => void;
      onComplete?: () => void;
    } = {}
  ): PortalEffect {
    const portal = new PortalEffect(container, center, options);
    this.portalEffects.add(portal);
    return portal;
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

    for (const dust of this.dustEffects) {
      dust.destroy();
    }
    this.dustEffects.clear();

    for (const portal of this.portalEffects) {
      portal.destroy();
    }
    this.portalEffects.clear();

    for (const shadow of this.shadows.values()) {
      shadow.destroy();
    }
    this.shadows.clear();
  }
}

// Debug: Slow down animations for analysis (1 = normal, higher = slower)
const DEBUG_SLOWDOWN = 1; // Normal speed
const DEBUG_PORTAL_SLOWDOWN = 1; // Normal speed

// Animation timing for Phase 5 effects
// Animation timing - 20% slower for breathing room (Blizzard/Disney approach)
export const HEX_OUTLINE_DURATION_MS = 360 * DEBUG_SLOWDOWN;  // was 300
export const TILE_RISE_DURATION_MS = 480 * DEBUG_SLOWDOWN;    // was 400
export const TILE_SLAM_DURATION_MS = 180 * DEBUG_SLOWDOWN;    // was 150
export const DUST_BURST_DELAY_MS = 50 * DEBUG_SLOWDOWN; // Slight delay after slam
export const SCREEN_SHAKE_DURATION_MS = 100 * DEBUG_SLOWDOWN;
export const SCREEN_SHAKE_INTENSITY = 3;

// Portal animation timing
export const PORTAL_OPEN_DURATION_MS = 600 * DEBUG_PORTAL_SLOWDOWN;
export const PORTAL_HOLD_DURATION_MS = 250 * DEBUG_PORTAL_SLOWDOWN; // Pause before hero emerges
export const PORTAL_HERO_EMERGE_DURATION_MS = 500 * DEBUG_PORTAL_SLOWDOWN;
export const PORTAL_CLOSE_DURATION_MS = 400 * DEBUG_PORTAL_SLOWDOWN;
// Total: 600 + 250 + 500 + 200 (breath) + 400 = 1950ms

/**
 * Void Portal Effect - theatrical hero entrance
 *
 * Creates a swirling magical portal that the hero emerges from,
 * befitting the lore of Mage Knights sent from the Council of the Void.
 *
 * Phases:
 * 1. Portal opens - ring expands from nothing, void particles swirl in
 * 2. Hero emerges - rises up through the portal
 * 3. Portal closes - ring contracts and fades, final energy burst
 */
export class PortalEffect {
  private graphics: Graphics;
  private particles: Particle[] = [];
  private isActive = true;
  private elapsed = 0;

  // Animation phases
  private phase: "opening" | "hold" | "emerging" | "breath" | "closing" = "opening";
  private phaseElapsed = 0;

  // Portal ring properties
  private portalRadius = 0;
  private targetRadius: number;
  private ringRotation = 0;

  // Callbacks
  private onHeroEmerge?: () => void;
  private onComplete?: () => void;

  // Debug: freeze animation
  private debugFreezeUntil = 0;

  // Color scheme - themed to hero
  private colors: {
    primary: number;
    secondary: number;
    glow: number;
    spark: number;
    energy: number;
  };

  // Hero color palettes based on their artwork
  private static readonly HERO_COLORS: Record<string, {
    primary: number;
    secondary: number;
    glow: number;
    energy: number;
  }> = {
    arythea: {
      primary: 0x8b1a1a,    // Deep crimson
      secondary: 0xcc3333,  // Blood red
      glow: 0x4a0a0a,       // Dark red glow
      energy: 0xff6666,     // Bright red
    },
    tovak: {
      primary: 0x6b6b2a,    // Olive gold
      secondary: 0x9a9a3a,  // Khaki
      glow: 0x3a3a15,       // Dark olive
      energy: 0xcccc66,     // Bright gold
    },
    goldyx: {
      primary: 0x4a6a7a,    // Steel blue-grey
      secondary: 0x7a9aaa,  // Lighter blue-grey
      glow: 0x2a3a4a,       // Dark blue
      energy: 0x99ccdd,     // Ice blue
    },
    norowas: {
      primary: 0x3a5a5a,    // Teal grey
      secondary: 0x5a8a8a,  // Steel blue
      glow: 0x1a2a2a,       // Dark teal
      energy: 0x88bbbb,     // Pale cyan
    },
    wolfhawk: {
      primary: 0x8a6a5a,    // Bronze/copper
      secondary: 0xaa8a7a,  // Dusty rose
      glow: 0x4a3a2a,       // Dark bronze
      energy: 0xddaa99,     // Warm copper
    },
    braevalar: {
      primary: 0x2a5a4a,    // Forest green
      secondary: 0x4a8a7a,  // Teal green
      glow: 0x1a3a2a,       // Dark forest
      energy: 0x77aa99,     // Sage green
    },
    // Default fallback for other heroes
    default: {
      primary: 0x6633ff,    // Purple
      secondary: 0x9966ff,  // Lighter purple
      glow: 0x3311aa,       // Dark purple
      energy: 0xaa88ff,     // Bright purple
    },
  };

  constructor(
    private container: Container,
    private center: PixelPosition,
    options: {
      heroId?: string;
      onHeroEmerge?: () => void;
      onComplete?: () => void;
    } = {}
  ) {
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.targetRadius = HEX_SIZE * 0.8;
    this.onHeroEmerge = options.onHeroEmerge;
    this.onComplete = options.onComplete;

    // Set colors based on hero
    const heroColors = options.heroId
      ? (PortalEffect.HERO_COLORS[options.heroId] ?? PortalEffect.HERO_COLORS.default)
      : PortalEffect.HERO_COLORS.default;

    this.colors = {
      ...heroColors,
      spark: 0xffffff, // White sparks for all heroes
    };

    // Spawn initial swirl particles
    this.spawnSwirlParticles(15);
  }

  private spawnSwirlParticles(count: number): void {
    // Use current portal radius so particles match the portal size
    const currentRadius = Math.max(this.portalRadius, this.targetRadius * 0.2);
    // Scale factor based on how open the portal is (0.2 to 1.0)
    const portalScale = currentRadius / this.targetRadius;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Spawn particles relative to current portal size, slightly outside
      const distance = currentRadius * (0.8 + Math.random() * 0.6);

      // Scale particle size with portal - smaller when portal is small
      const baseSize = 1.5 + Math.random() * 2;
      const scaledSize = baseSize * (0.5 + portalScale * 0.5);

      // Slower rotation when portal is small
      const baseRotation = 1.5 + Math.random() * 1.5;
      const scaledRotation = baseRotation * (0.4 + portalScale * 0.6);

      this.particles.push({
        x: this.center.x + Math.cos(angle) * distance,
        y: this.center.y + Math.sin(angle) * distance,
        vx: 0, // Will be calculated in update for spiral motion
        vy: 0,
        life: 800 + Math.random() * 600,
        maxLife: 1400,
        size: scaledSize,
        startSize: scaledSize,
        endSize: 0,
        color: Math.random() < 0.3 ? this.colors.spark : this.colors.secondary,
        alpha: 0.7,
        startAlpha: 0.7,
        endAlpha: 0,
        rotation: angle,
        rotationSpeed: scaledRotation,
        gravity: 0,
      });
    }
  }

  // Shockwave ring state
  private shockwaveRadius = 0;
  private shockwaveActive = false;
  private shockwaveMaxRadius = 0;

  private spawnEnergyBurst(): void {
    // Instead of particle burst, trigger a shockwave ring
    this.shockwaveActive = true;
    this.shockwaveRadius = this.targetRadius * 0.5; // Start from inner portal
    this.shockwaveMaxRadius = this.targetRadius * 2; // Expand to 2x portal size
  }

  private updateShockwave(dt: number): void {
    if (!this.shockwaveActive) return;

    // Expand rapidly
    const expandSpeed = this.targetRadius * 3; // Fast expansion
    this.shockwaveRadius += expandSpeed * dt;

    // Deactivate when fully expanded
    if (this.shockwaveRadius >= this.shockwaveMaxRadius) {
      this.shockwaveActive = false;
    }
  }

  private renderShockwave(): void {
    if (!this.shockwaveActive) return;

    // Calculate alpha - fade out as it expands
    const progress = (this.shockwaveRadius - this.targetRadius * 0.5) /
                     (this.shockwaveMaxRadius - this.targetRadius * 0.5);
    const alpha = 0.6 * (1 - progress);

    // Draw expanding ring
    this.graphics
      .circle(this.center.x, this.center.y, this.shockwaveRadius)
      .stroke({ width: 3, color: this.colors.energy, alpha });
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    // DEBUG: Freeze animation if set
    if (this.debugFreezeUntil > 0 && this.elapsed < this.debugFreezeUntil) {
      this.elapsed += deltaMs;
      this.render(); // Still render, just don't update
      return true;
    }

    this.elapsed += deltaMs;
    this.phaseElapsed += deltaMs;
    const dt = deltaMs / 1000;

    // Handle phases
    switch (this.phase) {
      case "opening":
        this.updateOpening();
        break;
      case "hold":
        this.updateHold();
        break;
      case "emerging":
        this.updateEmerging();
        break;
      case "breath":
        this.updateBreath();
        break;
      case "closing":
        this.updateClosing();
        break;
    }

    // Rotate the portal ring
    this.ringRotation += dt * 2;

    // Update shockwave
    this.updateShockwave(dt);

    // Update particles with spiral motion
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Black hole swirl - orbit around center with slow inward pull
      if (p.rotationSpeed > 0) {
        // Calculate current distance from center
        const dx = p.x - this.center.x;
        const dy = p.y - this.center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const currentAngle = Math.atan2(dy, dx);

        // Slower rotation when far, faster when close (black hole effect)
        // At targetRadius: base speed. Closer = faster, farther = slower
        const distanceRatio = Math.max(distance, 10) / this.targetRadius;
        const orbitSpeed = p.rotationSpeed / distanceRatio; // Inverse - closer = faster
        const newAngle = currentAngle + orbitSpeed * dt;

        // Very slow inward pull - mostly orbiting
        const inwardPull = 8 * dt;
        const newDistance = Math.max(5, distance - inwardPull);

        p.x = this.center.x + Math.cos(newAngle) * newDistance;
        p.y = this.center.y + Math.sin(newAngle) * newDistance;
      } else {
        // Normal physics for burst particles
        p.vy += p.gravity * dt * 50;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // Interpolate properties
      const progress = 1 - p.life / p.maxLife;
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * progress;
    }

    // Continuously spawn swirl particles during opening and emerging
    if (this.phase !== "closing" && Math.random() < 0.3) {
      this.spawnSwirlParticles(1);
    }

    this.render();

    // Complete when closing done and no particles
    if (this.phase === "closing" && this.phaseElapsed > PORTAL_CLOSE_DURATION_MS && this.particles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private updateOpening(): void {
    // Expand portal ring
    const progress = Math.min(this.phaseElapsed / PORTAL_OPEN_DURATION_MS, 1);
    // Ease out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3);
    this.portalRadius = this.targetRadius * eased;

    // Transition to hold when open
    if (progress >= 1) {
      this.phase = "hold";
      this.phaseElapsed = 0;
    }
  }

  private updateHold(): void {
    // Portal stays fully open, letting the vortex swirl
    const progress = Math.min(this.phaseElapsed / PORTAL_HOLD_DURATION_MS, 1);
    this.portalRadius = this.targetRadius;

    // Transition to emerging after hold
    if (progress >= 1) {
      this.phase = "emerging";
      this.phaseElapsed = 0;
      // Trigger hero emergence callback
      if (this.onHeroEmerge) {
        this.onHeroEmerge();
      }
      this.spawnEnergyBurst();
    }
  }

  private updateEmerging(): void {
    const progress = Math.min(this.phaseElapsed / PORTAL_HERO_EMERGE_DURATION_MS, 1);

    // Portal stays open during emergence
    this.portalRadius = this.targetRadius;

    // Transition to breath (anticipation before close)
    if (progress >= 1) {
      this.phase = "breath";
      this.phaseElapsed = 0;
    }
  }

  private updateBreath(): void {
    // Quick inhale - portal expands slightly before closing
    const breathDuration = 200 * DEBUG_PORTAL_SLOWDOWN; // Short breath
    const progress = Math.min(this.phaseElapsed / breathDuration, 1);

    // Ease out - quick expansion that slows
    const eased = 1 - Math.pow(1 - progress, 2);
    // Expand to 110% of target size
    this.portalRadius = this.targetRadius * (1 + 0.1 * eased);

    // Transition to closing
    if (progress >= 1) {
      this.phase = "closing";
      this.phaseElapsed = 0;
    }
  }

  private updateClosing(): void {
    const progress = Math.min(this.phaseElapsed / PORTAL_CLOSE_DURATION_MS, 1);
    // Ease in - accelerate the close (starts from expanded breath size)
    const eased = progress * progress;
    const startRadius = this.targetRadius * 1.1; // Start from breath expansion
    this.portalRadius = startRadius * (1 - eased);
  }

  private render(): void {
    this.graphics.clear();

    if (this.portalRadius > 1) {
      // Draw void glow (larger, softer)
      const glowRadius = this.portalRadius * 1.5;
      this.graphics
        .circle(this.center.x, this.center.y, glowRadius)
        .fill({ color: this.colors.glow, alpha: 0.2 });

      // Draw inner void darkness - gets more solid as portal opens
      const voidAlpha = Math.min(0.85, 0.4 + (this.portalRadius / this.targetRadius) * 0.45);
      this.graphics
        .circle(this.center.x, this.center.y, this.portalRadius * 0.7)
        .fill({ color: 0x050510, alpha: voidAlpha });

      // Rotating accretion disk - solid rings with pulsing alpha to show rotation
      // Outer ring - with slight alpha variation based on rotation
      const outerPulse = 0.4 + 0.15 * Math.sin(this.ringRotation * 2);
      this.graphics
        .circle(this.center.x, this.center.y, this.portalRadius)
        .stroke({ width: 6, color: this.colors.primary, alpha: outerPulse });

      // Middle ring - faster pulse
      const middlePulse = 0.5 + 0.2 * Math.sin(this.ringRotation * 3);
      this.graphics
        .circle(this.center.x, this.center.y, this.portalRadius * 0.88)
        .stroke({ width: 4, color: this.colors.secondary, alpha: middlePulse });

      // Inner ring - fastest pulse
      const innerPulse = 0.5 + 0.25 * Math.sin(this.ringRotation * 4);
      this.graphics
        .circle(this.center.x, this.center.y, this.portalRadius * 0.76)
        .stroke({ width: 2, color: this.colors.energy, alpha: innerPulse });
    }

    // Draw particles
    for (const p of this.particles) {
      this.graphics
        .circle(p.x, p.y, p.size)
        .fill({ color: p.color, alpha: p.alpha });
    }

    // Draw shockwave on top
    this.renderShockwave();
  }

  destroy(): void {
    this.isActive = false;
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  /**
   * Get progress through hero emergence (0-1)
   * Used to sync hero animation with portal
   */
  getHeroProgress(): number {
    if (this.phase === "opening") return 0;
    if (this.phase === "emerging") {
      return Math.min(this.phaseElapsed / PORTAL_HERO_EMERGE_DURATION_MS, 1);
    }
    return 1;
  }

  isInEmergingPhase(): boolean {
    return this.phase === "emerging";
  }
}
