/**
 * Particle Manager
 *
 * Central coordinator for all particle effects in the game.
 */

import { Container, Ticker } from "pixi.js";
import type { PixelPosition } from "../types";
import { ParticleEmitter, createMagicSparkles } from "./ParticleEmitter";
import { TileOutlineTracer, HexOutlineTracer } from "./outlineTracers";
import { DropShadow } from "./shadows";
import { DustBurstEffect, MiniDustBurstEffect } from "./dustEffects";
import { PortalEffect } from "./PortalEffect";

// Union type for tracers
type OutlineTracer = HexOutlineTracer | TileOutlineTracer;

/**
 * Particle system manager - coordinates all active effects
 */
export class ParticleManager {
  private emitters: Set<ParticleEmitter> = new Set();
  private tracers: Set<OutlineTracer> = new Set();
  private dustEffects: Set<DustBurstEffect> = new Set();
  private miniDustEffects: Set<MiniDustBurstEffect> = new Set();
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
      try {
        // Guard against corrupted ticker state during HMR
        this.ticker.remove(this.tickerCallback);
      } catch {
        // Ticker may be in an invalid state during HMR - ignore cleanup errors
      }
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

    // Update mini dust effects
    for (const dust of this.miniDustEffects) {
      if (!dust.update(deltaMs)) {
        this.miniDustEffects.delete(dust);
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
    const tracer = new HexOutlineTracer(
      container,
      center,
      duration,
      color,
      onComplete
    );
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
    const tracer = new TileOutlineTracer(
      container,
      center,
      duration,
      color,
      onComplete
    );
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
   * Create a mini dust burst effect for smaller objects (enemies, tokens)
   */
  miniDustBurst(
    container: Container,
    origin: PixelPosition,
    radius: number = 20,
    onComplete?: () => void
  ): MiniDustBurstEffect {
    const dust = new MiniDustBurstEffect(container, origin, radius, onComplete);
    this.miniDustEffects.add(dust);
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

    for (const dust of this.miniDustEffects) {
      dust.destroy();
    }
    this.miniDustEffects.clear();

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
