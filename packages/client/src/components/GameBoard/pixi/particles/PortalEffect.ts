/**
 * Portal Effect
 *
 * Theatrical void portal effect for hero entrance.
 * Creates a swirling magical portal that the hero emerges from,
 * befitting the lore of Mage Knights sent from the Council of the Void.
 */

import { Container, Graphics } from "pixi.js";
import type { PixelPosition } from "../types";
import { HEX_SIZE } from "../types";
import type { Particle } from "./types";
import {
  PORTAL_OPEN_DURATION_MS,
  PORTAL_HOLD_DURATION_MS,
  PORTAL_HERO_EMERGE_DURATION_MS,
  PORTAL_CLOSE_DURATION_MS,
} from "./constants";

// Debug: Slow down animations for analysis (1 = normal, higher = slower)
const DEBUG_PORTAL_SLOWDOWN = 1; // Normal speed

/**
 * Void Portal Effect - theatrical hero entrance
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
  private phase: "opening" | "hold" | "emerging" | "breath" | "closing" =
    "opening";
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
  private static readonly HERO_COLORS: Record<
    string,
    {
      primary: number;
      secondary: number;
      glow: number;
      energy: number;
    }
  > = {
    arythea: {
      primary: 0x8b1a1a, // Deep crimson
      secondary: 0xcc3333, // Blood red
      glow: 0x4a0a0a, // Dark red glow
      energy: 0xff6666, // Bright red
    },
    tovak: {
      primary: 0x6b6b2a, // Olive gold
      secondary: 0x9a9a3a, // Khaki
      glow: 0x3a3a15, // Dark olive
      energy: 0xcccc66, // Bright gold
    },
    goldyx: {
      primary: 0x4a6a7a, // Steel blue-grey
      secondary: 0x7a9aaa, // Lighter blue-grey
      glow: 0x2a3a4a, // Dark blue
      energy: 0x99ccdd, // Ice blue
    },
    norowas: {
      primary: 0x3a5a5a, // Teal grey
      secondary: 0x5a8a8a, // Steel blue
      glow: 0x1a2a2a, // Dark teal
      energy: 0x88bbbb, // Pale cyan
    },
    wolfhawk: {
      primary: 0x8a6a5a, // Bronze/copper
      secondary: 0xaa8a7a, // Dusty rose
      glow: 0x4a3a2a, // Dark bronze
      energy: 0xddaa99, // Warm copper
    },
    braevalar: {
      primary: 0x2a5a4a, // Forest green
      secondary: 0x4a8a7a, // Teal green
      glow: 0x1a3a2a, // Dark forest
      energy: 0x77aa99, // Sage green
    },
    // Default fallback for other heroes
    default: {
      primary: 0x6633ff, // Purple
      secondary: 0x9966ff, // Lighter purple
      glow: 0x3311aa, // Dark purple
      energy: 0xaa88ff, // Bright purple
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

    // Set colors based on hero - default fallback is always defined
    const defaultColors = {
      primary: 0x6633ff,
      secondary: 0x9966ff,
      glow: 0x3311aa,
      energy: 0xaa88ff,
    };
    const heroColors = options.heroId
      ? (PortalEffect.HERO_COLORS[options.heroId] ?? defaultColors)
      : defaultColors;

    this.colors = {
      primary: heroColors.primary,
      secondary: heroColors.secondary,
      glow: heroColors.glow,
      energy: heroColors.energy,
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
    const progress =
      (this.shockwaveRadius - this.targetRadius * 0.5) /
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
    if (
      this.phase === "closing" &&
      this.phaseElapsed > PORTAL_CLOSE_DURATION_MS &&
      this.particles.length === 0
    ) {
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
    const progress = Math.min(
      this.phaseElapsed / PORTAL_HERO_EMERGE_DURATION_MS,
      1
    );

    // Portal stays open during emergence
    this.portalRadius = this.targetRadius;

    // Transition to breath (anticipation before close)
    if (progress >= 1) {
      this.phase = "breath";
      this.phaseElapsed = 0;
      // Signal hero emergence complete - tactics can now appear
      // The portal will continue its closing animation independently
      if (this.onComplete) {
        this.onComplete();
        this.onComplete = undefined; // Only call once
      }
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
      const voidAlpha = Math.min(
        0.85,
        0.4 + (this.portalRadius / this.targetRadius) * 0.45
      );
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
