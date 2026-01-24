/**
 * PixiEnemyTokens - PixiJS-based enemy token rendering
 *
 * Renders the circular enemy token images using PixiJS.
 * The allocation UI remains in HTML (EnemyCard) as per Phase 6 hybrid approach.
 *
 * Features:
 * - Circular masked enemy images
 * - Defeated/blocked overlays
 * - Health bar indicator
 * - Click handling to show detail panel
 * - "Can defeat" crack/glow effect
 */

import { useEffect, useRef, useId, useCallback, useState } from "react";
import { Container, Graphics, Sprite, Texture, Assets } from "pixi.js";
import type { ClientCombatEnemy, EnemyId } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";

// Enemy tokens sit above background but below phase rail
const ENEMY_TOKENS_Z_INDEX = 5;

// Colors
const COLORS = {
  BORDER_DEFAULT: 0x333333,
  BORDER_CAN_DEFEAT: 0x5a8a70, // Verdigris
  BORDER_BLOCKED: 0x2e6b5a,
  OVERLAY_DEFEATED: 0x000000,
  OVERLAY_BLOCKED: 0x2e6b5a,
  HEALTH_BG: 0x1a1d2e,
  HEALTH_FILL: 0xb87333, // Bronze
  CAN_DEFEAT_GLOW: 0x5a8a70,
};

// Get enemy token image URL
function getEnemyImageUrl(enemyId: EnemyId): string {
  return `/assets/enemies/${enemyId}.jpg`;
}

interface EnemyTokenData {
  enemy: ClientCombatEnemy;
  canDefeat?: boolean;
}

interface PixiEnemyTokensProps {
  enemies: EnemyTokenData[];
  onEnemyClick?: (instanceId: string) => void;
}

export function PixiEnemyTokens({ enemies, onEnemyClick }: PixiEnemyTokensProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const tokenContainersRef = useRef<Map<string, Container>>(new Map());
  const isDestroyedRef = useRef(false);
  const [texturesLoaded, setTexturesLoaded] = useState(false);

  // Stable callback ref
  const onEnemyClickRef = useRef(onEnemyClick);
  onEnemyClickRef.current = onEnemyClick;

  // Calculate token size based on viewport (matching CSS clamp)
  const getTokenSize = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Match CSS: clamp(100px, min(18vw, 28vh), 280px)
    const size = Math.min(Math.max(100, Math.min(vw * 0.18, vh * 0.28)), 280);
    return size;
  }, []);

  // Calculate layout positions for tokens
  const getTokenPositions = useCallback((tokenSize: number, count: number) => {
    if (count === 0) return [];

    const gap = 32; // ~2rem gap matching CSS
    const totalWidth = count * tokenSize + (count - 1) * gap;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Center horizontally, position in upper-middle area (accounting for hand at bottom)
    const startX = (screenWidth - totalWidth) / 2;
    const baseY = screenHeight * 0.38; // Position in upper area

    return enemies.map((_, index) => ({
      x: startX + index * (tokenSize + gap) + tokenSize / 2,
      y: baseY,
    }));
  }, [enemies]);

  // Preload enemy textures
  useEffect(() => {
    const loadTextures = async () => {
      const urls = enemies.map((e) => getEnemyImageUrl(e.enemy.enemyId));
      const uniqueUrls = [...new Set(urls)];

      try {
        await Promise.all(
          uniqueUrls.map((url) =>
            Assets.load(url).catch(() => {
              // Texture load failed, will use placeholder
              console.warn(`Failed to load enemy texture: ${url}`);
            })
          )
        );
        setTexturesLoaded(true);
      } catch {
        // Continue anyway with placeholders
        setTexturesLoaded(true);
      }
    };

    loadTextures();
  }, [enemies]);

  // Build the enemy tokens
  useEffect(() => {
    if (!app || !overlayLayer || !texturesLoaded) return;
    isDestroyedRef.current = false;

    const tokenSize = getTokenSize();
    const positions = getTokenPositions(tokenSize, enemies.length);

    // Capture the token containers map for cleanup
    const tokenContainers = tokenContainersRef.current;

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `enemy-tokens-${uniqueId}`;
    rootContainer.zIndex = ENEMY_TOKENS_Z_INDEX;
    rootContainer.sortableChildren = true;

    overlayLayer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Create each enemy token
    enemies.forEach((data, index) => {
      const { enemy, canDefeat } = data;
      const pos = positions[index];
      if (!pos) return;

      const tokenContainer = new Container();
      tokenContainer.label = `enemy-${enemy.instanceId}`;
      tokenContainer.x = pos.x;
      tokenContainer.y = pos.y;
      tokenContainer.sortableChildren = true;

      // Circular mask
      const radius = tokenSize / 2;
      const mask = new Graphics();
      mask.circle(0, 0, radius);
      mask.fill({ color: 0xffffff });

      // Border ring
      const border = new Graphics();
      const borderColor = enemy.isBlocked
        ? COLORS.BORDER_BLOCKED
        : canDefeat && !enemy.isDefeated
          ? COLORS.BORDER_CAN_DEFEAT
          : COLORS.BORDER_DEFAULT;
      border.circle(0, 0, radius + 3);
      border.fill({ color: 0x000000, alpha: 0.4 });
      border.stroke({ color: borderColor, width: 4 });
      border.zIndex = 0;
      tokenContainer.addChild(border);

      // Can defeat glow effect
      if (canDefeat && !enemy.isDefeated) {
        const glow = new Graphics();
        glow.circle(0, 0, radius + 8);
        glow.fill({ color: COLORS.CAN_DEFEAT_GLOW, alpha: 0.3 });
        glow.zIndex = -1;
        tokenContainer.addChild(glow);

        // Pulse animation
        const pulseGlow = () => {
          if (isDestroyedRef.current || !glow.parent) return;
          animManager.animate(`glow-pulse-${enemy.instanceId}`, glow, {
            endScale: 1.15,
            endAlpha: 0.15,
            duration: 800,
            easing: Easing.easeInOutQuad,
            onComplete: () => {
              if (isDestroyedRef.current || !glow.parent) return;
              animManager.animate(`glow-pulse-back-${enemy.instanceId}`, glow, {
                endScale: 1,
                endAlpha: 0.3,
                duration: 800,
                easing: Easing.easeInOutQuad,
                onComplete: pulseGlow,
              });
            },
          });
        };
        pulseGlow();
      }

      // Enemy image sprite
      const imageUrl = getEnemyImageUrl(enemy.enemyId);
      let texture: Texture;
      try {
        texture = Assets.get(imageUrl) ?? Texture.EMPTY;
      } catch {
        texture = Texture.EMPTY;
      }

      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5);
      sprite.width = tokenSize;
      sprite.height = tokenSize;
      sprite.mask = mask;
      sprite.zIndex = 1;

      // Apply defeated tint
      if (enemy.isDefeated) {
        sprite.tint = 0x666666;
        sprite.alpha = 0.6;
      }

      tokenContainer.addChild(mask);
      tokenContainer.addChild(sprite);

      // Defeated overlay
      if (enemy.isDefeated) {
        const overlay = new Graphics();
        overlay.circle(0, 0, radius);
        overlay.fill({ color: COLORS.OVERLAY_DEFEATED, alpha: 0.7 });
        overlay.zIndex = 2;
        tokenContainer.addChild(overlay);

        // "DEFEATED" text
        // Note: Using Graphics text is limited, keeping overlay simple
      }

      // Blocked overlay
      if (enemy.isBlocked && !enemy.isDefeated) {
        const overlay = new Graphics();
        overlay.circle(0, 0, radius);
        overlay.fill({ color: COLORS.OVERLAY_BLOCKED, alpha: 0.3 });
        overlay.zIndex = 2;
        tokenContainer.addChild(overlay);
      }

      // Armor indicator (shows armor value below token)
      if (!enemy.isDefeated) {
        const armorWidth = 32;
        const armorHeight = 18;
        const armorY = radius + 8;

        // Background pill
        const armorBg = new Graphics();
        armorBg.roundRect(-armorWidth / 2, armorY, armorWidth, armorHeight, 9);
        armorBg.fill({ color: COLORS.HEALTH_BG, alpha: 0.9 });
        armorBg.stroke({ color: COLORS.HEALTH_FILL, width: 1.5 });
        armorBg.zIndex = 3;
        tokenContainer.addChild(armorBg);
      }

      // Click handling
      border.eventMode = "static";
      border.cursor = "pointer";
      border.on("pointertap", () => {
        if (isDestroyedRef.current) return;
        onEnemyClickRef.current?.(enemy.instanceId);
      });

      // Hover effect
      border.on("pointerenter", () => {
        if (isDestroyedRef.current) return;
        animManager.animate(`hover-${enemy.instanceId}`, tokenContainer, {
          endScale: 1.05,
          duration: 100,
          easing: Easing.easeOutQuad,
        });
      });

      border.on("pointerleave", () => {
        if (isDestroyedRef.current) return;
        animManager.animate(`hover-${enemy.instanceId}`, tokenContainer, {
          endScale: 1,
          duration: 100,
          easing: Easing.easeOutQuad,
        });
      });

      // Entry animation (slam in from above)
      tokenContainer.alpha = 0;
      tokenContainer.scale.set(2);
      tokenContainer.y = pos.y - 100;

      setTimeout(() => {
        if (isDestroyedRef.current || !tokenContainer.parent) return;
        animManager.animate(`entry-${enemy.instanceId}`, tokenContainer, {
          endY: pos.y,
          endScale: 1,
          endAlpha: 1,
          duration: 500,
          easing: Easing.easeOutBack,
        });
      }, 100 + index * 150);

      rootContainer.addChild(tokenContainer);
      tokenContainersRef.current.set(enemy.instanceId, tokenContainer);
    });

    // Handle resize
    const handleResize = () => {
      if (isDestroyedRef.current || !rootContainer.parent) return;

      const newTokenSize = getTokenSize();
      const newPositions = getTokenPositions(newTokenSize, enemies.length);

      enemies.forEach((data, index) => {
        const container = tokenContainersRef.current.get(data.enemy.instanceId);
        const pos = newPositions[index];
        if (container && pos) {
          container.x = pos.x;
          container.y = pos.y;
          // Note: Full resize would need to rebuild sprites, keeping positions for now
        }
      });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDestroyedRef.current = true;
      window.removeEventListener("resize", handleResize);

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

      tokenContainers.clear();
    };
  }, [app, overlayLayer, uniqueId, enemies, texturesLoaded, getTokenSize, getTokenPositions]);

  return null;
}
