/**
 * PixiScreenEffects - PixiJS-based screen flash effects
 *
 * Renders full-screen flash effects for combat feedback:
 * - Damage: Crimson flash with screen shake
 * - Block: Verdigris/teal flash
 * - Attack: Bronze/copper flash
 */

import { useEffect, useRef, useId } from "react";
import { Container, Graphics } from "pixi.js";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";

// Effect colors (matching CSS)
const EFFECT_COLORS = {
  damage: 0xa04030, // Deep crimson
  block: 0x2e6b5a, // Verdigris/teal
  attack: 0xb87333, // Bronze/copper
} as const;

type EffectType = "damage" | "block" | "attack";

interface PixiScreenEffectsProps {
  /** Current active effect, or null if none */
  activeEffect: EffectType | null;
  /** Key to force re-trigger of the same effect type */
  effectKey: number;
}

export function PixiScreenEffects({ activeEffect, effectKey }: PixiScreenEffectsProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);

  // Set up the container (once)
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;

    // Create root container for effects
    const rootContainer = new Container();
    rootContainer.label = `screen-effects-${uniqueId}`;
    rootContainer.zIndex = PIXI_Z_INDEX.SCREEN_EFFECTS;

    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    return () => {
      isDestroyedRef.current = true;

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
  }, [app, overlayLayer, uniqueId]);

  // Trigger effect when activeEffect changes
  useEffect(() => {
    if (!activeEffect || !app || !rootContainerRef.current || !animManagerRef.current) return;
    if (isDestroyedRef.current) return;

    const rootContainer = rootContainerRef.current;
    const animManager = animManagerRef.current;
    const color = EFFECT_COLORS[activeEffect];

    // Create full-screen flash overlay
    const flash = new Graphics();
    flash.rect(0, 0, app.screen.width, app.screen.height);
    flash.fill({ color, alpha: activeEffect === "damage" ? 0.7 : activeEffect === "block" ? 0.45 : 0.4 });
    flash.label = `flash-${activeEffect}`;
    rootContainer.addChild(flash);

    if (activeEffect === "damage") {
      // Damage effect: flash + screen shake
      const shakeDuration = 350;
      const shakeIntensity = 12;

      // Shake animation using onUpdate for custom behavior
      let elapsed = 0;
      const shakeId = `shake-${effectKey}`;

      // Create a dummy container to animate (we'll use onUpdate to shake the flash)
      const shakeTarget = new Container();
      shakeTarget.alpha = 0; // Invisible, just for animation tracking
      rootContainer.addChild(shakeTarget);

      animManager.animate(shakeId, shakeTarget, {
        duration: shakeDuration,
        endAlpha: 0,
        easing: Easing.linear,
        onUpdate: (progress) => {
          elapsed = progress * shakeDuration;

          // Shake pattern: sharp hits then settle
          let offsetX = 0;
          let offsetY = 0;

          if (elapsed < 28) {
            // 0-8%: sharp left-down
            const t = elapsed / 28;
            offsetX = -shakeIntensity * (1 - t);
            offsetY = 4 * (1 - t);
          } else if (elapsed < 56) {
            // 8-16%: sharp right-up
            const t = (elapsed - 28) / 28;
            offsetX = 10 * (1 - t);
            offsetY = -3 * (1 - t);
          } else if (elapsed < 98) {
            // 16-28%: small left
            const t = (elapsed - 56) / 42;
            offsetX = -4 * (1 - t);
            offsetY = 2 * (1 - t);
          } else if (elapsed < 140) {
            // 28-40%: tiny right
            const t = (elapsed - 98) / 42;
            offsetX = 2 * (1 - t);
            offsetY = -1 * (1 - t);
          }

          flash.x = offsetX;
          flash.y = offsetY;

          // Fade out the flash
          if (progress < 0.1) {
            flash.alpha = 0.7;
          } else if (progress < 0.4) {
            flash.alpha = 0.7 - (progress - 0.1) * 1.5;
          } else {
            flash.alpha = Math.max(0, 0.25 - (progress - 0.4) * 0.42);
          }
        },
        onComplete: () => {
          if (!isDestroyedRef.current && flash.parent) {
            flash.destroy();
          }
          if (!isDestroyedRef.current && shakeTarget.parent) {
            shakeTarget.destroy();
          }
        },
      });
    } else {
      // Block/Attack: simple fade out
      const duration = 300;

      animManager.animate(`flash-${effectKey}`, flash, {
        endAlpha: 0,
        duration,
        easing: Easing.easeOutQuad,
        onComplete: () => {
          if (!isDestroyedRef.current && flash.parent) {
            flash.destroy();
          }
        },
      });
    }
  }, [activeEffect, effectKey, app]);

  return null;
}
