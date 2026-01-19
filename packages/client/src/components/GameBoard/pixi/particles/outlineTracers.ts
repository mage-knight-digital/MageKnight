/**
 * Outline Tracers
 *
 * Magic outline effects that trace around hexes and tile clusters with sparkles.
 */

import { Container, Graphics } from "pixi.js";
import type { PixelPosition } from "../types";
import { HEX_SIZE } from "../types";
import { getHexVertices, rotatePoint } from "../hexMath";
import type { Particle } from "./types";

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
export function get7HexClusterVertices(hexSize: number): PixelPosition[] {
  // Use the exact same vertex calculation as getHexVertices
  const getVertex = (
    hexCenterX: number,
    hexCenterY: number,
    vertexIndex: number
  ): PixelPosition => {
    const angle = (Math.PI / 3) * vertexIndex - Math.PI / 6; // Same as getHexVertices
    return {
      x: hexCenterX + hexSize * Math.cos(angle),
      y: hexCenterY + hexSize * Math.sin(angle),
    };
  };

  // Use the exact same center calculation as hexToPixel
  const getHexCenter = (q: number, r: number): PixelPosition => ({
    x: hexSize * (Math.sqrt(3) * q + (Math.sqrt(3) / 2) * r),
    y: hexSize * ((3 / 2) * r),
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
 *
 * Phases:
 * 1. Drawing - traces the outline with sparkles
 * 2. Pulse - circuit completes with bright pulse
 * 3. Linger - stays visible (dimmed) while tile drops, fades out slowly
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
  // Linger phase - trace stays visible during tile drop
  private isLingering = false;
  private lingerProgress = 0;
  private lingerDuration = 800; // ms to linger and fade (covers tile drop + slam)
  private lingerAlpha = 1; // Fades during linger

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
    // Use full HEX_SIZE to match the tile images, rotated to match map orientation
    const rawVertices = get7HexClusterVertices(HEX_SIZE);
    this.vertices = rawVertices.map(v => rotatePoint(v.x, v.y));
    this.numVertices = this.vertices.length;
    this.onComplete = onComplete;
  }

  /**
   * Move graphics to a lower z-index layer (call when tile starts dropping)
   */
  moveToBackground(backgroundContainer: Container): void {
    // Remove from current container and add to background
    this.container.removeChild(this.graphics);
    backgroundContainer.addChild(this.graphics);
    this.container = backgroundContainer;
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

        // Add sparkles at trace point with varied behavior
        if (Math.random() < 0.7) {
          // Slightly more particles
          // Determine particle type for variety
          const particleType = Math.random();

          // Some float up, some fall, some drift sideways, some spiral
          let vx, vy, gravity, rotationSpeed;
          let size, startAlpha;

          if (particleType < 0.25) {
            // Floaters - rise up with gentle sway
            vx = (Math.random() - 0.5) * 30;
            vy = -20 - Math.random() * 30;
            gravity = -8 - Math.random() * 8; // Stronger float
            rotationSpeed = (Math.random() - 0.5) * 4;
            size = 2 + Math.random() * 2;
            startAlpha = 0.9;
          } else if (particleType < 0.5) {
            // Drifters - mostly horizontal with tumble
            vx = (Math.random() - 0.5) * 60; // More horizontal speed
            vy = (Math.random() - 0.5) * 20;
            gravity = 5 + Math.random() * 8;
            rotationSpeed = (Math.random() - 0.5) * 6;
            size = 1.5 + Math.random() * 2;
            startAlpha = 0.85;
          } else if (particleType < 0.75) {
            // Fallers - drop down with varied weight
            vx = (Math.random() - 0.5) * 25;
            vy = 5 + Math.random() * 15;
            gravity = 15 + Math.random() * 25;
            rotationSpeed = (Math.random() - 0.5) * 3;
            size = 1 + Math.random() * 2;
            startAlpha = 0.8;
          } else {
            // Sparklers - burst outward then fade quickly (the "pop")
            const burstAngle = Math.random() * Math.PI * 2;
            const burstSpeed = 40 + Math.random() * 40;
            vx = Math.cos(burstAngle) * burstSpeed;
            vy = Math.sin(burstAngle) * burstSpeed;
            gravity = 2; // Almost no gravity
            rotationSpeed = 0;
            size = 2.5 + Math.random() * 2;
            startAlpha = 1;
          }

          this.sparkles.push({
            x: sparkleX + (Math.random() - 0.5) * 10,
            y: sparkleY + (Math.random() - 0.5) * 10,
            vx,
            vy,
            life: 250 + Math.random() * 450, // Slightly shorter for snappier feel
            maxLife: 700,
            size,
            startSize: size,
            endSize: 0,
            color: Math.random() < 0.35 ? 0xffffff : this.color,
            alpha: startAlpha,
            startAlpha,
            endAlpha: 0,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed,
            gravity,
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
    } else if (!this.isLingering) {
      // Phase 2: Pulse effect after circuit completes
      this.pulseProgress += deltaMs / this.pulseDuration;

      // Transition to linger phase when pulse completes
      if (this.pulseProgress >= 1) {
        this.isLingering = true;
        this.lingerProgress = 0;
        // Fire onComplete now so tile drop can start while we linger
        if (this.onComplete) {
          this.onComplete();
          this.onComplete = undefined; // Only fire once
        }
      }
    } else {
      // Phase 3: Linger - trace stays visible but fades during tile drop
      this.lingerProgress += deltaMs / this.lingerDuration;
      // Ease out the fade for a gentle disappearance
      this.lingerAlpha = 1 - Math.pow(this.lingerProgress, 1.5);
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

    // Complete when linger done (sparkles may still be finishing but that's ok)
    if (this.isLingering && this.lingerProgress >= 1) {
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

    if (this.isLingering) {
      // Linger phase: solid line that fades out
      lineWidth = 2;
      lineAlpha = 0.7 * this.lingerAlpha;
      glowWidth = 10;
      glowAlpha = 0.2 * this.lingerAlpha;
    } else if (this.isCircuitComplete) {
      // Pulse effect: line gets thicker and brighter, then fades
      // Use sine wave for smooth pulse that peaks in the middle
      const pulseIntensity = Math.sin(
        Math.min(this.pulseProgress, 1) * Math.PI
      );
      lineWidth = 2 + 4 * pulseIntensity; // 2 -> 6 -> 2
      lineAlpha = 0.9 + 0.1 * pulseIntensity; // Slightly brighter
      glowWidth = 8 + 12 * pulseIntensity; // 8 -> 20 -> 8
      glowAlpha = 0.15 + 0.35 * pulseIntensity; // 0.15 -> 0.5 -> 0.15
    } else {
      // Drawing phase: thin line
      lineWidth = 2;
      lineAlpha = 0.9;
      glowWidth = 8;
      glowAlpha = 0.15;
    }

    // Draw the outline up to current progress (or full if circuit complete/lingering)
    const totalLength = this.numVertices;
    const currentPos =
      this.isCircuitComplete || this.isLingering
        ? totalLength
        : Math.min(this.progress, 1) * totalLength;

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
    this.graphics.stroke({
      width: lineWidth,
      color: this.color,
      alpha: lineAlpha,
    });

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
    this.graphics.stroke({
      width: glowWidth,
      color: this.color,
      alpha: glowAlpha,
    });

    // Draw sparkles with twinkle effect (also fade during linger)
    for (const s of this.sparkles) {
      // Twinkle: modulate alpha based on rotation for shimmer
      const twinkle = 0.7 + 0.3 * Math.sin(s.rotation * 3);
      const effectiveAlpha = s.alpha * twinkle * this.lingerAlpha;

      // Draw glow halo for brighter particles
      if (s.size > 2 && effectiveAlpha > 0.4) {
        this.graphics
          .circle(s.x, s.y, s.size * 2)
          .fill({ color: s.color, alpha: effectiveAlpha * 0.15 });
      }

      // Main sparkle
      this.graphics
        .circle(s.x, s.y, s.size)
        .fill({ color: s.color, alpha: effectiveAlpha });

      // Bright core for larger particles
      if (s.size > 1.5) {
        this.graphics
          .circle(s.x, s.y, s.size * 0.4)
          .fill({ color: 0xffffff, alpha: effectiveAlpha * 0.6 });
      }
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
    // Rotate vertices to match map orientation
    const rawVertices = getHexVertices(HEX_SIZE * 0.95);
    this.vertices = rawVertices.map(v => rotatePoint(v.x, v.y));
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

      const sparkleX = this.center.x + v1.x + (v2.x - v1.x) * sideProgress;
      const sparkleY = this.center.y + v1.y + (v2.y - v1.y) * sideProgress;

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
