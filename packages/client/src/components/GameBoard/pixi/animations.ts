/**
 * PixiJS Animation Utilities
 *
 * Simple tweening system using PixiJS ticker for smooth animations.
 */

import type { Container, Ticker } from "pixi.js";
import type { PixelPosition } from "./types";

/**
 * Easing functions for animations
 */
export const Easing = {
  // Linear - no easing
  linear: (t: number): number => t,

  // Ease in quad - accelerating
  easeInQuad: (t: number): number => t * t,

  // Ease out quad - decelerating
  easeOutQuad: (t: number): number => t * (2 - t),

  // Ease out cubic - more pronounced deceleration
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),

  // Ease in out quad - smooth acceleration and deceleration
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,

  // Ease out back - slight overshoot
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },

  // Ease out elastic - bouncy
  easeOutElastic: (t: number): number => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export type EasingFunction = (t: number) => number;

/**
 * Animation state for tracking active tweens
 */
interface TweenState {
  target: Container;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  startScale: number;
  endScale: number;
  startAlpha: number;
  endAlpha: number;
  startRotation: number;
  endRotation: number;
  duration: number;
  elapsed: number;
  easing: EasingFunction;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

/**
 * Animation manager for handling multiple concurrent tweens
 */
export class AnimationManager {
  private tweens: Map<string, TweenState> = new Map();
  private ticker: Ticker | null = null;
  private tickerCallback: ((ticker: Ticker) => void) | null = null;

  /**
   * Attach to a PixiJS ticker
   */
  attach(ticker: Ticker): void {
    if (this.ticker) {
      this.detach();
    }
    this.ticker = ticker;
    this.tickerCallback = (t: Ticker) => this.update(t.deltaMS);
    ticker.add(this.tickerCallback);
  }

  /**
   * Detach from ticker
   */
  detach(): void {
    if (this.ticker && this.tickerCallback) {
      this.ticker.remove(this.tickerCallback);
    }
    this.ticker = null;
    this.tickerCallback = null;
  }

  /**
   * Update all active tweens
   */
  private update(deltaMs: number): void {
    const completed: string[] = [];

    for (const [id, tween] of this.tweens) {
      tween.elapsed += deltaMs;
      const progress = Math.min(tween.elapsed / tween.duration, 1);
      const easedProgress = tween.easing(progress);

      // Update position
      tween.target.x = tween.startX + (tween.endX - tween.startX) * easedProgress;
      tween.target.y = tween.startY + (tween.endY - tween.startY) * easedProgress;

      // Update scale
      const scale = tween.startScale + (tween.endScale - tween.startScale) * easedProgress;
      tween.target.scale.set(scale);

      // Update alpha
      tween.target.alpha = tween.startAlpha + (tween.endAlpha - tween.startAlpha) * easedProgress;

      // Update rotation
      tween.target.rotation = tween.startRotation + (tween.endRotation - tween.startRotation) * easedProgress;

      // Call update callback
      if (tween.onUpdate) {
        tween.onUpdate(easedProgress);
      }

      // Check if complete
      if (progress >= 1) {
        completed.push(id);
        if (tween.onComplete) {
          tween.onComplete();
        }
      }
    }

    // Remove completed tweens
    for (const id of completed) {
      this.tweens.delete(id);
    }
  }

  /**
   * Animate a container to a new position
   */
  moveTo(
    id: string,
    target: Container,
    endPos: PixelPosition,
    duration: number,
    easing: EasingFunction = Easing.easeOutQuad,
    onComplete?: () => void
  ): void {
    // Cancel existing tween for this id
    this.tweens.delete(id);

    this.tweens.set(id, {
      target,
      startX: target.x,
      startY: target.y,
      endX: endPos.x,
      endY: endPos.y,
      startScale: target.scale.x,
      endScale: target.scale.x,
      startAlpha: target.alpha,
      endAlpha: target.alpha,
      startRotation: target.rotation,
      endRotation: target.rotation,
      duration,
      elapsed: 0,
      easing,
      onComplete,
    });
  }

  /**
   * Animate a container with full property control
   */
  animate(
    id: string,
    target: Container,
    options: {
      endX?: number;
      endY?: number;
      endScale?: number;
      endAlpha?: number;
      endRotation?: number;
      duration: number;
      easing?: EasingFunction;
      onComplete?: () => void;
      onUpdate?: (progress: number) => void;
    }
  ): void {
    // Cancel existing tween for this id
    this.tweens.delete(id);

    this.tweens.set(id, {
      target,
      startX: target.x,
      startY: target.y,
      endX: options.endX ?? target.x,
      endY: options.endY ?? target.y,
      startScale: target.scale.x,
      endScale: options.endScale ?? target.scale.x,
      startAlpha: target.alpha,
      endAlpha: options.endAlpha ?? target.alpha,
      startRotation: target.rotation,
      endRotation: options.endRotation ?? target.rotation,
      duration: options.duration,
      elapsed: 0,
      easing: options.easing ?? Easing.easeOutQuad,
      onComplete: options.onComplete,
      onUpdate: options.onUpdate,
    });
  }

  /**
   * Cancel a tween by id
   */
  cancel(id: string): void {
    this.tweens.delete(id);
  }

  /**
   * Check if a tween is active
   */
  isAnimating(id: string): boolean {
    return this.tweens.has(id);
  }

  /**
   * Cancel all tweens
   */
  cancelAll(): void {
    this.tweens.clear();
  }
}

// Animation timing constants
export const HERO_MOVE_DURATION_MS = 200;
export const TILE_CASCADE_DURATION_MS = 500;
export const TILE_CASCADE_STAGGER_MS = 100;
export const ENEMY_FLIP_DURATION_MS = 400;
export const ENEMY_FLIP_STAGGER_MS = 250; // Stagger to guide the eye across the board
export const TILE_REVEAL_DURATION_MS = 500;
export const CAMERA_FOLLOW_DURATION_MS = 300;
export const INTRO_PHASE_GAP_MS = 400; // Breathing room between intro phases

// Flip animation constants
export const FLIP_LIFT_SCALE = 1.2; // Scale up 20% at peak of flip
export const FLIP_LIFT_Y = -15; // Move up 15px at peak of flip

/**
 * Options for the flip animation
 */
export interface FlipAnimationOptions {
  /** Duration of the full flip in ms (default: 400) */
  duration?: number;
  /** Scale multiplier at peak of flip (default: 1.2) */
  liftScale?: number;
  /** Y offset at peak of flip in px (default: -15) */
  liftY?: number;
  /** Additional elements to scale X along with the main target (e.g., mask, border) */
  additionalScaleTargets?: { scale: { x: number } }[];
  /** Called at midpoint to swap content (e.g., change texture) */
  onMidpoint?: () => void;
  /** Called when animation completes */
  onComplete?: () => void;
}

/**
 * Animate a "card flip" effect on a container.
 *
 * The animation:
 * 1. Scales X from 1 to 0 while lifting up and scaling larger
 * 2. Calls onMidpoint (to swap texture/content)
 * 3. Scales X from 0 to 1 while settling back down
 *
 * Works for any container - cards, tokens, tiles, etc.
 * For masked elements (like circular tokens), pass the mask in additionalScaleTargets.
 *
 * @param animManager - The animation manager
 * @param id - Unique ID for this animation (for cancellation)
 * @param container - The container to flip
 * @param options - Animation options
 */
export function animateFlip(
  animManager: AnimationManager,
  id: string,
  container: Container,
  options: FlipAnimationOptions = {}
): void {
  const {
    duration = ENEMY_FLIP_DURATION_MS,
    liftScale = FLIP_LIFT_SCALE,
    liftY = FLIP_LIFT_Y,
    additionalScaleTargets = [],
    onMidpoint,
    onComplete,
  } = options;

  const halfDuration = duration / 2;
  const originalY = container.position.y;
  const originalScaleY = container.scale.y;

  // First half: scale X from 1 to 0 while lifting
  animManager.animate(`${id}-out`, container, {
    duration: halfDuration,
    easing: Easing.easeInQuad,
    onUpdate: (progress) => {
      const scaleX = 1 - progress;
      container.scale.x = scaleX;
      for (const target of additionalScaleTargets) {
        target.scale.x = scaleX;
      }

      // Lift effect
      const lift = 1 + (liftScale - 1) * progress;
      container.scale.y = originalScaleY * lift;
      container.position.y = originalY + liftY * progress;
    },
    onComplete: () => {
      // Guard: if container was destroyed, abort
      if (!container.parent) {
        onComplete?.();
        return;
      }

      // Call midpoint callback to swap content
      onMidpoint?.();

      // Reset X scale to 0 for second half
      container.scale.x = 0;
      for (const target of additionalScaleTargets) {
        target.scale.x = 0;
      }

      // Second half: scale X from 0 to 1 while settling
      animManager.animate(`${id}-in`, container, {
        duration: halfDuration,
        easing: Easing.easeOutQuad,
        onUpdate: (progress) => {
          container.scale.x = progress;
          for (const target of additionalScaleTargets) {
            target.scale.x = progress;
          }

          // Settle back down
          const settleProgress = 1 - progress;
          const lift = 1 + (liftScale - 1) * settleProgress;
          container.scale.y = originalScaleY * lift;
          container.position.y = originalY + liftY * settleProgress;
        },
        onComplete: () => {
          // Reset to exact final values
          container.scale.x = 1;
          container.scale.y = originalScaleY;
          container.position.y = originalY;
          for (const target of additionalScaleTargets) {
            target.scale.x = 1;
          }
          onComplete?.();
        },
      });
    },
  });
}
