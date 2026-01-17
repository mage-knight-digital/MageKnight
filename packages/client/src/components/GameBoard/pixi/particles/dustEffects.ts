/**
 * Dust Effects
 *
 * Naturalistic dust burst effects for tile landings and object impacts.
 */

import { Container, Graphics } from "pixi.js";
import type { PixelPosition } from "../types";
import { HEX_SIZE } from "../types";
import type { DustParticle } from "./types";
import { ParticleEmitter } from "./ParticleEmitter";

/**
 * Mini dust burst for smaller objects (enemies, tokens)
 * Scaled down version of the main dust burst
 */
export class MiniDustBurstEffect {
  private particles: DustParticle[] = [];
  private graphics: Graphics;
  private isActive = true;
  private onComplete?: () => void;

  constructor(
    private container: Container,
    private center: PixelPosition,
    private radius: number = 20,
    onComplete?: () => void
  ) {
    this.graphics = new Graphics();
    this.container.addChild(this.graphics);
    this.onComplete = onComplete;
    this.spawn();
  }

  private spawn(): void {
    // Fewer, smaller particles than the tile dust burst
    // Layer 1: Small mid-ground puffs
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.center.x + Math.cos(angle) * this.radius;
      const startY = this.center.y + Math.sin(angle) * this.radius;
      const outwardSpeed = 8 + Math.random() * 15;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * outwardSpeed,
        vy: Math.sin(angle) * outwardSpeed * 0.25,
        life: 350 + Math.random() * 250,
        maxLife: 600,
        size: 3 + Math.random() * 3,
        startSize: 3,
        endSize: 8,
        color:
          [0x9a9a9a, 0x8b8b8b, 0xa0a0a0][Math.floor(Math.random() * 3)] ??
          0x9a9a9a,
        alpha: 0.3,
        startAlpha: 0.35,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.6,
        gravity: 5,
        turbulencePhase: Math.random() * Math.PI * 2,
        turbulenceSpeed: 3 + Math.random() * 2,
        turbulenceAmp: 3 + Math.random() * 2,
        layer: 1,
      });
    }

    // Layer 2: Tiny foreground puffs
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.center.x + Math.cos(angle) * (this.radius * 1.1);
      const startY = this.center.y + Math.sin(angle) * (this.radius * 1.1);
      const outwardSpeed = 12 + Math.random() * 18;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * outwardSpeed,
        vy: Math.sin(angle) * outwardSpeed * 0.3,
        life: 250 + Math.random() * 200,
        maxLife: 450,
        size: 2 + Math.random() * 2,
        startSize: 2,
        endSize: 5,
        color:
          [0xa8a8a8, 0xb0b0b0][Math.floor(Math.random() * 2)] ?? 0xa8a8a8,
        alpha: 0.4,
        startAlpha: 0.45,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.8,
        gravity: 8,
        turbulencePhase: Math.random() * Math.PI * 2,
        turbulenceSpeed: 4 + Math.random() * 2,
        turbulenceAmp: 2 + Math.random() * 2,
        layer: 2,
      });
    }
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    const dt = deltaMs / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics with drag
      const drag = 0.96;
      p.vx *= drag;
      p.vy *= drag;
      p.vy += p.gravity * dt * 6;

      // Turbulence
      p.turbulencePhase += p.turbulenceSpeed * dt;
      const wobbleX = Math.sin(p.turbulencePhase) * p.turbulenceAmp * dt;
      const wobbleY =
        Math.cos(p.turbulencePhase * 0.7) * p.turbulenceAmp * 0.5 * dt;

      p.x += p.vx * dt + wobbleX;
      p.y += p.vy * dt + wobbleY;
      p.rotation += p.rotationSpeed * dt;

      const progress = 1 - p.life / p.maxLife;
      const sizeProgress = 1 - Math.pow(1 - progress, 2);
      p.size = p.startSize + (p.endSize - p.startSize) * sizeProgress;
      const fadeProgress = progress * progress;
      p.alpha = p.startAlpha * (1 - fadeProgress);
    }

    this.render();

    if (this.particles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    const sorted = [...this.particles].sort((a, b) => a.layer - b.layer);

    for (const p of sorted) {
      // Main dust body
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
 * Dust puff effect - spreads outward along the ground from tile edges
 * More naturalistic: layered particles with turbulence and varied sizes
 * Inspired by real dust physics - heavier particles settle, lighter ones drift
 */
export class DustBurstEffect {
  private particles: DustParticle[] = [];
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
    const tileRadius = HEX_SIZE * 2.2;

    // Layer 0: Background wisps - large, faint, slow
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.center.x + Math.cos(angle) * (tileRadius * 0.9);
      const startY = this.center.y + Math.sin(angle) * (tileRadius * 0.9);
      const outwardSpeed = 8 + Math.random() * 12;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * outwardSpeed,
        vy: Math.sin(angle) * outwardSpeed * 0.2,
        life: 800 + Math.random() * 500,
        maxLife: 1300,
        size: 18 + Math.random() * 12,
        startSize: 15,
        endSize: 30,
        color: 0x8a8a8a,
        alpha: 0.12,
        startAlpha: 0.15,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3,
        gravity: 3,
        turbulencePhase: Math.random() * Math.PI * 2,
        turbulenceSpeed: 2 + Math.random() * 2,
        turbulenceAmp: 8 + Math.random() * 6,
        layer: 0,
      });
    }

    // Layer 1: Mid-ground dust - medium size, moderate opacity
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.center.x + Math.cos(angle) * tileRadius;
      const startY = this.center.y + Math.sin(angle) * tileRadius;
      const outwardSpeed = 12 + Math.random() * 20;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * outwardSpeed,
        vy: Math.sin(angle) * outwardSpeed * 0.25,
        life: 600 + Math.random() * 400,
        maxLife: 1000,
        size: 8 + Math.random() * 6,
        startSize: 6,
        endSize: 16,
        color:
          [0x9a9a9a, 0x8b8b8b, 0xa0a0a0][Math.floor(Math.random() * 3)] ??
          0x9a9a9a,
        alpha: 0.25,
        startAlpha: 0.28,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.6,
        gravity: 6,
        turbulencePhase: Math.random() * Math.PI * 2,
        turbulenceSpeed: 3 + Math.random() * 3,
        turbulenceAmp: 4 + Math.random() * 4,
        layer: 1,
      });
    }

    // Layer 2: Foreground puffs - smaller, more opaque, faster settling
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const startX = this.center.x + Math.cos(angle) * (tileRadius * 1.05);
      const startY = this.center.y + Math.sin(angle) * (tileRadius * 1.05);
      const outwardSpeed = 18 + Math.random() * 25;

      this.particles.push({
        x: startX,
        y: startY,
        vx: Math.cos(angle) * outwardSpeed,
        vy: Math.sin(angle) * outwardSpeed * 0.3,
        life: 400 + Math.random() * 350,
        maxLife: 750,
        size: 4 + Math.random() * 4,
        startSize: 4,
        endSize: 10,
        color:
          [0xa8a8a8, 0xb0b0b0, 0x989898][Math.floor(Math.random() * 3)] ??
          0xa8a8a8,
        alpha: 0.35,
        startAlpha: 0.4,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.8,
        gravity: 12,
        turbulencePhase: Math.random() * Math.PI * 2,
        turbulenceSpeed: 4 + Math.random() * 3,
        turbulenceAmp: 2 + Math.random() * 3,
        layer: 2,
      });
    }
  }

  update(deltaMs: number): boolean {
    if (!this.isActive) return false;

    const dt = deltaMs / 1000;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;
      p.life -= deltaMs;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Physics with drag
      const drag = 0.97 + p.layer * 0.005; // Heavier particles (layer 2) have less drag
      p.vx *= drag;
      p.vy *= drag;
      p.vy += p.gravity * dt * 8;

      // Turbulence - organic wobble
      p.turbulencePhase += p.turbulenceSpeed * dt;
      const wobbleX = Math.sin(p.turbulencePhase) * p.turbulenceAmp * dt;
      const wobbleY =
        Math.cos(p.turbulencePhase * 0.7) * p.turbulenceAmp * 0.5 * dt;

      p.x += p.vx * dt + wobbleX;
      p.y += p.vy * dt + wobbleY;
      p.rotation += p.rotationSpeed * dt;

      // Interpolate properties with smooth easing
      const progress = 1 - p.life / p.maxLife;
      // Ease out cubic for more natural growth
      const sizeProgress = 1 - Math.pow(1 - progress, 2);
      p.size = p.startSize + (p.endSize - p.startSize) * sizeProgress;
      // Fade with ease-in for lingering effect
      const fadeProgress = progress * progress;
      p.alpha = p.startAlpha * (1 - fadeProgress);
    }

    this.render();

    if (this.particles.length === 0) {
      this.destroy();
      return false;
    }

    return true;
  }

  private render(): void {
    this.graphics.clear();

    // Sort by layer so background renders first
    const sorted = [...this.particles].sort((a, b) => a.layer - b.layer);

    for (const p of sorted) {
      // Outer soft glow for organic edge
      if (p.layer < 2) {
        this.graphics
          .circle(p.x, p.y, p.size * 1.4)
          .fill({ color: p.color, alpha: p.alpha * 0.3 });
      }

      // Main dust body
      this.graphics
        .circle(p.x, p.y, p.size)
        .fill({ color: p.color, alpha: p.alpha });

      // Slightly brighter core for depth
      if (p.size > 6) {
        this.graphics
          .circle(p.x, p.y, p.size * 0.5)
          .fill({ color: p.color, alpha: p.alpha * 0.4 });
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
