/**
 * Particle Emitter
 *
 * Core particle system that manages a batch of particles with configurable behavior.
 */

import { Container, Graphics } from "pixi.js";
import type { PixelPosition } from "../types";
import type { Particle, ParticleConfig } from "./types";

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
      const speed = this.config.speed + (Math.random() - 0.5) * 2 * speedVar;

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
        rotationSpeed:
          (this.config.rotationSpeed ?? 0) * (Math.random() - 0.5) * 2,
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
