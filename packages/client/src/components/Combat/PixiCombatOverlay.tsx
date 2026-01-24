/**
 * PixiCombatOverlay - PixiJS-based combat background overlay
 *
 * Renders the combat background using PixiJS instead of HTML/CSS to eliminate
 * click handling conflicts between the HTML overlay and PixiJS canvas.
 *
 * Uses the shared PixiJS Application via PixiAppContext. The overlay is added
 * to the overlayLayer with negative zIndex to sit behind the hand cards.
 *
 * Phase 0: Red rectangle proof-of-concept
 * Phase 1: Gradient background
 * Phase 2: Site backdrop sprite
 */

import { useEffect, useRef, useId } from "react";
import { Container, Sprite, Texture, BlurFilter } from "pixi.js";
import type { ClientCombatState } from "@mage-knight/shared";
import { hexKey } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGame } from "../../hooks/useGame";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { cleanupFilters } from "../../utils/pixiFilterCleanup";

// Combat overlay sits behind hand cards (hand uses zIndex 100+)
const COMBAT_OVERLAY_Z_INDEX = -100;

// Site sprite sheet configuration (matches CombatOverlay.tsx)
const SITES_SHEET = {
  src: "/assets/sites/sites_sprite_sheet.png",
  width: 1280,
  height: 1024,
  spriteWidth: 256,
  spriteHeight: 256,
  cols: 5,
  rows: 4,
};

// Map site types to sprite positions in the sheet (matches CombatOverlay.tsx)
const SITE_SPRITE_MAP: Record<string, { col: number; row: number }> = {
  // Adventure sites
  ancient_ruins: { col: 0, row: 0 },
  tomb: { col: 2, row: 3 },
  spawning_grounds: { col: 1, row: 3 },
  dungeon: { col: 3, row: 1 },
  monster_den: { col: 0, row: 0 },

  // Fortified sites
  keep: { col: 2, row: 1 },
  mage_tower: { col: 2, row: 1 },

  // Cities
  city: { col: 1, row: 0 },
  city_blue: { col: 1, row: 0 },
  city_green: { col: 2, row: 0 },
  city_red: { col: 3, row: 0 },
  city_white: { col: 4, row: 0 },

  // Safe sites
  village: { col: 3, row: 3 },
  monastery: { col: 0, row: 2 },
  magical_glade: { col: 1, row: 2 },

  // Resource sites
  deep_mine: { col: 0, row: 1 },
  mine: { col: 0, row: 1 },

  // Rampaging enemies
  orc_marauder: { col: 4, row: 2 },
  draconum: { col: 1, row: 1 },

  // Other
  refugee_camp: { col: 0, row: 3 },
  labyrinth: { col: 3, row: 1 },
  necropolis: { col: 1, row: 2 },
};

interface PixiCombatOverlayProps {
  combat: ClientCombatState;
}

/**
 * Create a radial gradient texture matching the CSS combat background
 */
function createCombatGradient(width: number, height: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Texture.EMPTY;
  }

  // Match CSS: radial-gradient ellipse at center
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.sqrt(width * width + height * height) / 2
  );

  // Match CSS colors from CombatOverlay.css
  // rgba(26, 29, 46, 0.98) at 0%
  // rgba(15, 15, 25, 0.98) at 50%
  // rgba(10, 10, 18, 0.99) at 100%
  gradient.addColorStop(0, "rgba(26, 29, 46, 0.98)");
  gradient.addColorStop(0.5, "rgba(15, 15, 25, 0.98)");
  gradient.addColorStop(1, "rgba(10, 10, 18, 0.99)");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return Texture.from(canvas);
}

export function PixiCombatOverlay({ combat }: PixiCombatOverlayProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();
  const player = useMyPlayer();
  const { state } = useGame();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const gradientSpriteRef = useRef<Sprite | null>(null);
  const backdropSpriteRef = useRef<Sprite | null>(null);
  const isDestroyedRef = useRef(false);

  // Determine the backdrop type based on player position
  const backdropType = (() => {
    if (!player?.position || !state?.map.hexes) return null;
    const key = hexKey(player.position);
    const hex = state.map.hexes[key];

    // Check for site first
    if (hex?.site?.type) {
      if (hex.site.type === "city" && hex.site.cityColor) {
        return `city_${hex.site.cityColor}`;
      }
      return hex.site.type;
    }

    // Check for rampaging enemies
    if (hex?.rampagingEnemies && hex.rampagingEnemies.length > 0) {
      return hex.rampagingEnemies[0];
    }

    // Fallback: check combat enemies for green tokens (orc marauders)
    if (combat.enemies.length > 0) {
      const greenEnemyIds = [
        "diggers",
        "prowlers",
        "cursed_hags",
        "wolf_riders",
        "ironclads",
        "orc_summoners",
      ];
      const enemyIds = combat.enemies.map((e) => e.enemyId);
      if (enemyIds.some((id) => greenEnemyIds.includes(id))) {
        return "orc_marauder";
      }
    }

    return null;
  })();

  const siteSprite = backdropType ? SITE_SPRITE_MAP[backdropType] : null;

  // Build the combat overlay
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;

    // Create root container for combat overlay
    const rootContainer = new Container();
    rootContainer.label = `combat-overlay-${uniqueId}`;
    rootContainer.zIndex = COMBAT_OVERLAY_Z_INDEX;
    rootContainer.sortableChildren = true;

    // Ensure overlay layer is sortable
    overlayLayer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Phase 1: Gradient background (replacing Phase 0 red rectangle)
    const gradientTexture = createCombatGradient(
      app.screen.width,
      app.screen.height
    );
    const gradientSprite = new Sprite(gradientTexture);
    gradientSprite.label = "combat-gradient";
    gradientSprite.eventMode = "none"; // Don't intercept clicks
    gradientSprite.zIndex = 0;
    gradientSprite.alpha = 0;
    rootContainer.addChild(gradientSprite);
    gradientSpriteRef.current = gradientSprite;

    // Fade in the gradient
    animManager.animate("gradient-fade-in", gradientSprite, {
      endAlpha: 1,
      duration: 400,
      easing: Easing.easeOutQuad,
    });

    // Phase 2: Site backdrop sprite
    if (siteSprite) {
      const backdropSprite = Sprite.from(SITES_SHEET.src);
      backdropSprite.label = "combat-backdrop";
      backdropSprite.eventMode = "none";
      backdropSprite.zIndex = 1; // Above gradient

      // Set up sprite sheet frame
      backdropSprite.texture.frame.x = siteSprite.col * SITES_SHEET.spriteWidth;
      backdropSprite.texture.frame.y = siteSprite.row * SITES_SHEET.spriteHeight;
      backdropSprite.texture.frame.width = SITES_SHEET.spriteWidth;
      backdropSprite.texture.frame.height = SITES_SHEET.spriteHeight;
      backdropSprite.texture.updateUvs();

      // Size: 70% of the smaller viewport dimension (matching CSS)
      const size = Math.min(app.screen.width, app.screen.height) * 0.7;
      backdropSprite.width = size;
      backdropSprite.height = size;

      // Center the sprite
      backdropSprite.anchor.set(0.5);
      backdropSprite.x = app.screen.width / 2;
      backdropSprite.y = app.screen.height / 2;

      // Apply blur and transparency (matching CSS)
      backdropSprite.filters = [new BlurFilter({ strength: 2 })];
      backdropSprite.alpha = 0;

      rootContainer.addChild(backdropSprite);
      backdropSpriteRef.current = backdropSprite;

      // Fade in the backdrop after a short delay
      setTimeout(() => {
        if (isDestroyedRef.current || !backdropSprite.parent) return;
        animManager.animate("backdrop-fade-in", backdropSprite, {
          endAlpha: 0.25, // Match CSS opacity
          duration: 800,
          easing: Easing.easeOutQuad,
        });
      }, 100);
    }

    rootContainer.sortChildren();

    // Handle window resize
    const handleResize = () => {
      if (isDestroyedRef.current || !app || !rootContainer.parent) return;

      // Update gradient
      if (gradientSpriteRef.current) {
        const newTexture = createCombatGradient(
          app.screen.width,
          app.screen.height
        );
        gradientSpriteRef.current.texture.destroy(true);
        gradientSpriteRef.current.texture = newTexture;
      }

      // Update backdrop position and size
      if (backdropSpriteRef.current) {
        const size = Math.min(app.screen.width, app.screen.height) * 0.7;
        backdropSpriteRef.current.width = size;
        backdropSpriteRef.current.height = size;
        backdropSpriteRef.current.x = app.screen.width / 2;
        backdropSpriteRef.current.y = app.screen.height / 2;
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      isDestroyedRef.current = true;
      window.removeEventListener("resize", handleResize);

      // Cancel all animations
      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      // Clean up filters before destroying
      if (rootContainerRef.current) {
        cleanupFilters(rootContainerRef.current);

        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }

      gradientSpriteRef.current = null;
      backdropSpriteRef.current = null;
    };
  }, [app, overlayLayer, uniqueId, siteSprite]);

  // No DOM element needed - renders directly to PixiJS canvas
  return null;
}
