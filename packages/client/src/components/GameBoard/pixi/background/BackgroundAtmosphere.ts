/**
 * Procedural Background Atmosphere System
 *
 * Uses canvas gradient (smooth, no banding) converted to PixiJS sprite.
 * Also manages floating dust particles for atmosphere.
 */

import { Container, Graphics, Ticker, Sprite, Texture } from "pixi.js";

/** Individual dust mote particle */
interface DustMote {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  maxAlpha: number;
  phase: number;
  phaseSpeed: number;
  driftRadius: number;
  twinklePhase: number;
  twinkleSpeed: number;
  colorIndex: number;
}

/** Day/night color palettes */
interface ColorPalette {
  center: number;
  edge: number;
  dust: number[];
}

const DAY_PALETTE: ColorPalette = {
  center: 0x3d3528,    // Warm brown center
  edge: 0x1a1610,      // Dark brown edges
  dust: [0xd4a574, 0xc9a86c, 0xa89070, 0x8b7355, 0xf0d9b5],
};

const NIGHT_PALETTE: ColorPalette = {
  center: 0x1a1d2e,    // Deep blue-purple center
  edge: 0x0a0a12,      // Near black edges
  dust: [0x6b7b9c, 0x5a6a8a, 0x8090b0, 0x4a5a7a, 0x9aaaca],
};

/** Configuration for the atmosphere */
export interface AtmosphereConfig {
  dustCount: number;
}

const DEFAULT_CONFIG: AtmosphereConfig = {
  dustCount: 100,
};

/**
 * Create a canvas with a smooth radial gradient
 */
function createGradientCanvas(
  width: number,
  height: number,
  centerColor: number,
  edgeColor: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.sqrt(cx * cx + cy * cy);

  // Create radial gradient - this is smooth, no banding
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);

  const centerHex = '#' + centerColor.toString(16).padStart(6, '0');
  const edgeHex = '#' + edgeColor.toString(16).padStart(6, '0');

  gradient.addColorStop(0, centerHex);
  gradient.addColorStop(1, edgeHex);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

export class BackgroundAtmosphere {
  private container: Container;
  private gradientSprite: Sprite | null = null;
  private dustGraphics: Graphics;
  private dustMotes: DustMote[] = [];
  private config: AtmosphereConfig;
  private width: number = 0;
  private height: number = 0;
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  // Day/night blending (0 = full day, 1 = full night)
  private nightBlend: number = 0;
  private targetNightBlend: number = 0;

  constructor(config: Partial<AtmosphereConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.container = new Container();
    this.container.label = "background-atmosphere";

    // Dust layer
    this.dustGraphics = new Graphics();
    this.dustGraphics.label = "dust-motes";
    this.container.addChild(this.dustGraphics);
  }

  /** Get the container to add to stage */
  getContainer(): Container {
    return this.container;
  }

  /** Initialize with screen dimensions */
  initialize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.createGradientSprite();
    this.spawnDustMotes();
  }

  /** Handle resize */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.createGradientSprite();

    // Respawn dust to fill new area
    this.dustMotes = [];
    this.spawnDustMotes();
  }

  /** Set day/night state (transitions smoothly) */
  setNight(isNight: boolean): void {
    this.targetNightBlend = isNight ? 1 : 0;
  }

  /** Get current blended palette */
  private getCurrentPalette(): ColorPalette {
    const t = this.nightBlend;
    return {
      center: this.lerpColor(DAY_PALETTE.center, NIGHT_PALETTE.center, t),
      edge: this.lerpColor(DAY_PALETTE.edge, NIGHT_PALETTE.edge, t),
      dust: DAY_PALETTE.dust.map((dayColor, i) =>
        this.lerpColor(dayColor, NIGHT_PALETTE.dust[i] ?? dayColor, t)
      ),
    };
  }

  /** Create gradient sprite from canvas */
  private createGradientSprite(): void {
    // Remove old sprite
    if (this.gradientSprite) {
      this.container.removeChild(this.gradientSprite);
      this.gradientSprite.destroy();
    }

    const palette = this.getCurrentPalette();
    const canvas = createGradientCanvas(this.width, this.height, palette.center, palette.edge);
    const texture = Texture.from(canvas);

    this.gradientSprite = new Sprite(texture);
    this.gradientSprite.label = "gradient";

    // Add at bottom of container
    this.container.addChildAt(this.gradientSprite, 0);
  }

  /** Spawn ambient dust motes */
  private spawnDustMotes(): void {
    const palette = this.getCurrentPalette();

    for (let i = 0; i < this.config.dustCount; i++) {
      const x = Math.random() * this.width;
      const y = Math.random() * this.height;
      const size = 1 + Math.random() * 3;
      const maxAlpha = 0.1 + Math.random() * 0.3;

      const mote: DustMote = {
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.06 - 0.02,
        size,
        alpha: maxAlpha * Math.random(),
        maxAlpha,
        phase: Math.random() * Math.PI * 2,
        phaseSpeed: 0.0003 + Math.random() * 0.0008,
        driftRadius: 40 + Math.random() * 60,
        twinklePhase: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.001 + Math.random() * 0.002,
        colorIndex: i % palette.dust.length,
      };

      this.dustMotes.push(mote);
    }
  }

  /** Attach to ticker for animation */
  attach(ticker: Ticker): void {
    this.tickerCallback = (t: Ticker) => this.update(t.deltaMS);
    ticker.add(this.tickerCallback);
  }

  /** Detach from ticker */
  detach(ticker: Ticker): void {
    if (this.tickerCallback) {
      ticker.remove(this.tickerCallback);
      this.tickerCallback = null;
    }
  }

  /** Update animation */
  private update(deltaMs: number): void {
    // Smoothly transition day/night
    const blendSpeed = 0.002;
    if (Math.abs(this.nightBlend - this.targetNightBlend) > 0.001) {
      this.nightBlend += (this.targetNightBlend - this.nightBlend) * blendSpeed * deltaMs;
      // Recreate gradient when blending
      this.createGradientSprite();
    }

    const palette = this.getCurrentPalette();
    const g = this.dustGraphics;
    g.clear();

    for (const mote of this.dustMotes) {
      // Update phase for organic movement
      mote.phase += mote.phaseSpeed * deltaMs;
      mote.twinklePhase += mote.twinkleSpeed * deltaMs;

      // Organic wobble
      const wobbleX = Math.sin(mote.phase) * 0.4;
      const wobbleY = Math.cos(mote.phase * 0.7) * 0.25;

      // Move
      mote.x += (mote.vx + wobbleX) * deltaMs * 0.016;
      mote.y += (mote.vy + wobbleY) * deltaMs * 0.016;

      // Soft boundary - drift back toward base position
      const dx = mote.x - mote.baseX;
      const dy = mote.y - mote.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > mote.driftRadius) {
        const pullStrength = 0.00008 * deltaMs;
        mote.vx -= dx * pullStrength;
        mote.vy -= dy * pullStrength;
      }

      // Wrap around screen edges
      if (mote.x < -10) {
        mote.x = this.width + 10;
        mote.baseX = mote.x;
      }
      if (mote.x > this.width + 10) {
        mote.x = -10;
        mote.baseX = mote.x;
      }
      if (mote.y < -10) {
        mote.y = this.height + 10;
        mote.baseY = mote.y;
      }
      if (mote.y > this.height + 10) {
        mote.y = -10;
        mote.baseY = mote.y;
      }

      // Twinkle alpha
      const twinkle = 0.6 + 0.4 * Math.sin(mote.twinklePhase);
      mote.alpha = mote.maxAlpha * twinkle;

      // Get color from palette
      const color = palette.dust[mote.colorIndex] ?? palette.dust[0] ?? 0xffffff;

      // Draw mote with soft glow
      g.circle(mote.x, mote.y, mote.size * 2);
      g.fill({ color, alpha: mote.alpha * 0.3 });
      g.circle(mote.x, mote.y, mote.size);
      g.fill({ color, alpha: mote.alpha });
    }
  }

  /** Linear interpolate between two colors */
  private lerpColor(color1: number, color2: number, t: number): number {
    const r1 = (color1 >> 16) & 0xff;
    const g1 = (color1 >> 8) & 0xff;
    const b1 = color1 & 0xff;

    const r2 = (color2 >> 16) & 0xff;
    const g2 = (color2 >> 8) & 0xff;
    const b2 = color2 & 0xff;

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return (r << 16) | (g << 8) | b;
  }

  /** Clean up */
  destroy(): void {
    this.dustMotes = [];
    if (this.gradientSprite) {
      this.gradientSprite.destroy();
    }
    this.container.destroy({ children: true });
  }
}
