/**
 * Ghost hex rendering for PixiJS hex grid
 *
 * Renders two types of ghost hexes:
 * 1. Board shape ghosts: Show the full map layout (unfilled tile slots)
 *    - Subtle parchment-colored outline
 *    - Non-interactive (just for visual reference)
 * 2. Exploration ghosts: Show where player can explore next
 *    - Gold interactive tile outlines with "?" marker
 *    - Hover effect with magic dust particles
 *    - Click to trigger exploration
 */

import { Graphics, Text, TextStyle, Container, MeshRope, Point, Texture } from "pixi.js";
import type { Ticker } from "pixi.js";
import type { HexCoord, HexDirection, ClientTileSlot } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { hexToPixel, rotatePoint } from "../hexMath";
import type { WorldLayers } from "../types";
import { HEX_SIZE } from "../types";
import { get7HexClusterVertices } from "../particles/outlineTracers";
import type { Particle } from "../particles/types";

/**
 * Create a gradient texture for the rope trail
 * Goes from bright gold (head) to transparent (tail)
 */
function createTrailGradientTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 8; // Thin trail
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.WHITE;

  // Create horizontal gradient from bright to transparent
  const gradient = ctx.createLinearGradient(0, 0, 256, 0);
  gradient.addColorStop(0, "rgba(255, 229, 160, 0.9)"); // Bright gold (head)
  gradient.addColorStop(0.1, "rgba(255, 229, 160, 0.7)");
  gradient.addColorStop(0.3, "rgba(212, 168, 75, 0.5)");
  gradient.addColorStop(0.6, "rgba(212, 168, 75, 0.25)");
  gradient.addColorStop(0.85, "rgba(212, 168, 75, 0.1)");
  gradient.addColorStop(1, "rgba(212, 168, 75, 0)"); // Transparent (tail)

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 8);

  // Add a brighter center line for the glow core
  ctx.globalCompositeOperation = "lighter";
  const vertGradient = ctx.createLinearGradient(0, 0, 0, 8);
  vertGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  vertGradient.addColorStop(0.4, "rgba(255, 255, 255, 0.3)");
  vertGradient.addColorStop(0.5, "rgba(255, 255, 255, 0.5)");
  vertGradient.addColorStop(0.6, "rgba(255, 255, 255, 0.3)");
  vertGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  // Apply vertical gradient to make it glow from center
  ctx.fillStyle = vertGradient;
  ctx.fillRect(0, 0, 100, 8); // Only bright core near the head

  return Texture.from(canvas);
}

// Cache the trail texture (recreated on first use after code changes)
let trailTexture: Texture | null = null;
function getTrailTexture(): Texture {
  if (!trailTexture) {
    trailTexture = createTrailGradientTexture();
  }
  return trailTexture;
}

// Clear texture cache (for hot reload)
export function clearTrailTextureCache(): void {
  trailTexture = null;
}

/**
 * Explore target with direction info
 */
export interface ExploreTarget {
  coord: HexCoord;
  direction: HexDirection;
  fromTileCoord: HexCoord;
}

/**
 * Ghost hex visual colors - warm gold tones for magical exploration feel
 */
const GHOST_FILL_COLOR = 0xd4a84b;    // Warm gold
const GHOST_STROKE_COLOR = 0xc9973b;  // Darker gold edge
const GHOST_TEXT_COLOR = 0xffd966;    // Bright gold for "?"
const GHOST_HOVER_GLOW = 0xffe5a0;    // Light gold glow on hover

/**
 * Particle effect for hover - glowing outline with fairy dust particles
 * Simple and clean: just glow the outline and spawn particles drifting outward
 */
class ExploreHoverEffect {
  private particles: Particle[] = [];
  private graphics: Graphics;
  private isActive = false;
  private isFadingOut = false;
  private fadeAlpha = 0;
  private vertices: { x: number; y: number }[];
  private center: { x: number; y: number };
  private tickerCallback: ((ticker: Ticker) => void) | null = null;
  private ticker: Ticker | null = null;
  private container: Container | null = null;
  private time = 0; // For subtle pulsing

  constructor(center: { x: number; y: number }) {
    this.graphics = new Graphics();
    this.graphics.label = "explore-hover-effect";
    this.center = center;

    // Get tile outline vertices
    const rawVertices = get7HexClusterVertices(HEX_SIZE);
    this.vertices = rawVertices.map((v) => rotatePoint(v.x, v.y));
  }

  ensureAttached(container: Container): void {
    this.container = container;
    if (this.graphics.parent !== container) {
      container.addChild(this.graphics);
    }
  }

  start(ticker: Ticker): void {
    if (this.isActive && !this.isFadingOut) return;
    this.isActive = true;
    this.isFadingOut = false;
    this.ticker = ticker;

    if (!this.tickerCallback) {
      this.tickerCallback = (t: Ticker) => this.update(t.deltaMS);
      ticker.add(this.tickerCallback);
    }
  }

  stop(): void {
    if (!this.isActive) return;
    this.isFadingOut = true;
  }

  /**
   * Get world position for a progress value (0-1) along the outline
   */
  private getPositionAtProgress(progress: number): { x: number; y: number } {
    const p = ((progress % 1) + 1) % 1;

    const totalEdges = this.vertices.length;
    const edgeProgress = p * totalEdges;
    const edgeIndex = Math.floor(edgeProgress) % totalEdges;
    const edgeFraction = edgeProgress - Math.floor(edgeProgress);

    const v1 = this.vertices[edgeIndex];
    const v2 = this.vertices[(edgeIndex + 1) % totalEdges];

    if (!v1 || !v2) return { x: this.center.x, y: this.center.y };

    return {
      x: this.center.x + v1.x + (v2.x - v1.x) * edgeFraction,
      y: this.center.y + v1.y + (v2.y - v1.y) * edgeFraction,
    };
  }

  /**
   * Get outward direction at a position on the outline (away from center)
   */
  private getOutwardDirection(pos: { x: number; y: number }): { x: number; y: number } {
    const dx = pos.x - this.center.x;
    const dy = pos.y - this.center.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) return { x: 0, y: -1 };
    return { x: dx / len, y: dy / len };
  }

  private update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.time += dt;

    // Handle fade in/out
    if (this.isFadingOut) {
      this.fadeAlpha -= dt * 3;
      if (this.fadeAlpha <= 0) {
        this.fadeAlpha = 0;
        this.isActive = false;
        this.isFadingOut = false;
        this.particles = [];
        if (this.ticker && this.tickerCallback) {
          this.ticker.remove(this.tickerCallback);
          this.tickerCallback = null;
          this.ticker = null;
        }
        this.graphics.clear();
        return;
      }
    } else {
      this.fadeAlpha = Math.min(1, this.fadeAlpha + dt * 4);
    }

    // Spawn fairy dust particles from random spots on the outline
    if (!this.isFadingOut && Math.random() < 0.4) {
      const spawnProgress = Math.random();
      const pos = this.getPositionAtProgress(spawnProgress);
      const outward = this.getOutwardDirection(pos);

      const speed = 8 + Math.random() * 12;
      const angleVariance = (Math.random() - 0.5) * Math.PI * 0.8;
      const cos = Math.cos(angleVariance);
      const sin = Math.sin(angleVariance);
      const vx = (outward.x * cos - outward.y * sin) * speed;
      const vy = (outward.x * sin + outward.y * cos) * speed;

      this.particles.push({
        x: pos.x + (Math.random() - 0.5) * 4,
        y: pos.y + (Math.random() - 0.5) * 4,
        vx,
        vy,
        life: 600 + Math.random() * 500,
        maxLife: 1100,
        size: 0.8 + Math.random() * 1.2,
        startSize: 1 + Math.random() * 1,
        endSize: 0,
        color: Math.random() < 0.35 ? 0xffffff : GHOST_HOVER_GLOW,
        alpha: 0.6,
        startAlpha: 0.6,
        endAlpha: 0,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 2,
        gravity: 0,
      });
    }

    // Update drifting particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (!p) continue;

      p.life -= deltaMs;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vx *= 0.992;
      p.vy *= 0.992;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;

      const progress = 1 - p.life / p.maxLife;
      p.size = p.startSize + (p.endSize - p.startSize) * progress;
      p.alpha = p.startAlpha + (p.endAlpha - p.startAlpha) * progress;
    }

    this.render();
  }

  private render(): void {
    this.graphics.clear();

    if (this.fadeAlpha <= 0) return;

    // Subtle pulse for the glow
    const pulse = 0.9 + 0.1 * Math.sin(this.time * 2.5);

    // Build the full outline path
    const worldVertices = this.vertices.map((v) => ({
      x: this.center.x + v.x,
      y: this.center.y + v.y,
    }));

    // Draw glowing outline (outer to inner layers)
    // Outer glow
    this.graphics.poly(worldVertices);
    this.graphics.stroke({
      width: 10,
      color: GHOST_FILL_COLOR,
      alpha: 0.12 * this.fadeAlpha * pulse,
      join: "round",
    });

    // Mid glow
    this.graphics.poly(worldVertices);
    this.graphics.stroke({
      width: 5,
      color: GHOST_HOVER_GLOW,
      alpha: 0.25 * this.fadeAlpha * pulse,
      join: "round",
    });

    // Inner bright line
    this.graphics.poly(worldVertices);
    this.graphics.stroke({
      width: 2,
      color: 0xffffff,
      alpha: 0.35 * this.fadeAlpha * pulse,
      join: "round",
    });

    // Draw drifting fairy dust particles
    for (const p of this.particles) {
      const twinkle = 0.7 + 0.3 * Math.sin(p.rotation * 5);
      const alpha = p.alpha * twinkle * this.fadeAlpha;

      // Soft glow
      this.graphics
        .circle(p.x, p.y, p.size * 2)
        .fill({ color: p.color, alpha: alpha * 0.25 });

      // Main particle
      this.graphics
        .circle(p.x, p.y, p.size)
        .fill({ color: p.color, alpha });
    }
  }

  destroy(): void {
    this.isActive = false;
    this.isFadingOut = false;
    this.particles = [];
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
      this.ticker = null;
    }
    if (this.graphics.parent) {
      this.graphics.parent.removeChild(this.graphics);
    }
    this.graphics.destroy();
  }
}

// Track active hover effects for cleanup
const activeHoverEffects = new Map<string, ExploreHoverEffect>();
let currentTicker: Ticker | null = null;

/**
 * Set the ticker for hover effects (call once during initialization)
 */
export function setGhostHexTicker(ticker: Ticker): void {
  currentTicker = ticker;
}

/**
 * Clean up all hover effects (call on unmount)
 */
export function cleanupGhostHexEffects(): void {
  for (const effect of activeHoverEffects.values()) {
    effect.destroy();
  }
  activeHoverEffects.clear();
}

/**
 * Render ghost hexes for exploration targets with click handling
 *
 * Shows the full 7-hex tile shape (not just center hex) since you're
 * exploring an entire tile, not just one hex.
 *
 * @param layers - World layer containers
 * @param exploreTargets - Array of exploration targets from game state
 * @param onExploreClick - Callback when exploration target is clicked
 */
export function renderGhostHexes(
  layers: WorldLayers,
  exploreTargets: ExploreTarget[],
  onExploreClick: (target: ExploreTarget) => void
): void {
  layers.ghostHexes.removeChildren();

  // Clean up hover effects for targets that no longer exist
  const currentTargetKeys = new Set(exploreTargets.map((t) => hexKey(t.coord)));
  for (const [key, effect] of activeHoverEffects.entries()) {
    if (!currentTargetKeys.has(key)) {
      effect.destroy();
      activeHoverEffects.delete(key);
    }
  }

  for (const target of exploreTargets) {
    const { x, y } = hexToPixel(target.coord);
    const targetKey = hexKey(target.coord);

    // Container for this explore target
    const container = new Container();
    container.label = `ghost-${targetKey}`;

    const graphics = new Graphics();
    graphics.label = `ghost-shape-${targetKey}`;

    // Use full 7-hex tile cluster shape
    const vertices = get7HexClusterVertices(HEX_SIZE);

    // Rotate and translate to tile position
    const worldVertices = vertices.map((v) => {
      const r = rotatePoint(v.x, v.y);
      return { x: x + r.x, y: y + r.y };
    });

    // Draw filled shape with border
    graphics
      .poly(worldVertices)
      .fill({ color: GHOST_FILL_COLOR, alpha: 0.15 })
      .stroke({ color: GHOST_STROKE_COLOR, width: 3, alpha: 0.7 });

    // Make interactive
    graphics.eventMode = "static";
    graphics.cursor = "pointer";
    graphics.on("pointerdown", () => onExploreClick(target));

    // Create or get hover effect for this target
    let hoverEffect = activeHoverEffects.get(targetKey);
    if (!hoverEffect) {
      hoverEffect = new ExploreHoverEffect({ x, y });
      activeHoverEffects.set(targetKey, hoverEffect);
    }
    // Re-attach graphics after removeChildren() cleared the layer
    hoverEffect.ensureAttached(layers.ghostHexes);

    // Hover effects - brighten and start particle effect
    graphics.on("pointerenter", () => {
      graphics.clear();
      graphics
        .poly(worldVertices)
        .fill({ color: GHOST_FILL_COLOR, alpha: 0.25 })
        .stroke({ color: GHOST_HOVER_GLOW, width: 4, alpha: 0.9 });

      // Start particle effect
      if (currentTicker && hoverEffect) {
        hoverEffect.start(currentTicker);
      }
    });

    graphics.on("pointerleave", () => {
      graphics.clear();
      graphics
        .poly(worldVertices)
        .fill({ color: GHOST_FILL_COLOR, alpha: 0.15 })
        .stroke({ color: GHOST_STROKE_COLOR, width: 3, alpha: 0.7 });

      // Stop particle effect (particles will fade out naturally)
      if (hoverEffect) {
        hoverEffect.stop();
      }
    });

    container.addChild(graphics);

    // Add "?" text at center
    const style = new TextStyle({
      fontSize: 32,
      fontWeight: "bold",
      fill: GHOST_TEXT_COLOR,
      dropShadow: {
        color: 0x000000,
        blur: 4,
        distance: 2,
        alpha: 0.5,
      },
    });
    const questionMark = new Text({ text: "?", style });
    questionMark.anchor.set(0.5, 0.5);
    questionMark.position.set(x, y);
    // Make the ? clickable too - clicks should trigger explore
    questionMark.eventMode = "static";
    questionMark.cursor = "pointer";
    questionMark.on("pointerdown", () => onExploreClick(target));
    container.addChild(questionMark);

    layers.ghostHexes.addChild(container);
  }
}

/**
 * Board shape ghost hex colors - subtle parchment tones
 */
const BOARD_SHAPE_FILL_COLOR = 0xc9a86c;    // Warm tan/parchment
const BOARD_SHAPE_STROKE_COLOR = 0x8b7355;  // Darker parchment edge

/**
 * Render board shape ghost hexes for unfilled tile slots
 *
 * These show the overall map shape and where tiles will eventually go.
 * Much more subtle than exploration ghosts - just a hint of the map boundary.
 *
 * @param layers - World layer containers
 * @param tileSlots - Record of tile slots from game state
 */
export function renderBoardShape(
  layers: WorldLayers,
  tileSlots: Record<string, ClientTileSlot>
): void {
  layers.boardShape.removeChildren();

  // Get all unfilled slots
  const unfilledSlots = Object.values(tileSlots).filter(slot => !slot.filled);

  for (const slot of unfilledSlots) {
    const { x, y } = hexToPixel(slot.coord);

    const graphics = new Graphics();
    graphics.label = `board-shape-${hexKey(slot.coord)}`;

    // Use the 7-hex cluster shape for a tile outline
    const vertices = get7HexClusterVertices(HEX_SIZE);

    // Rotate and translate to slot position
    const worldVertices = vertices.map((v) => {
      const r = rotatePoint(v.x, v.y);
      return { x: x + r.x, y: y + r.y };
    });

    // Draw filled shape with thick border
    graphics
      .poly(worldVertices)
      .fill({ color: BOARD_SHAPE_FILL_COLOR, alpha: 0.15 })
      .stroke({ color: BOARD_SHAPE_STROKE_COLOR, width: 5, alpha: 0.6 });

    layers.boardShape.addChild(graphics);
  }
}
