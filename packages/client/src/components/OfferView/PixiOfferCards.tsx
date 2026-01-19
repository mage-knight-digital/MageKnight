/**
 * PixiOfferCards - PixiJS-based card rendering for offer panes
 *
 * Renders card sprites entirely in PixiJS with pre-uploaded GPU textures.
 * This eliminates the 300-500ms jank from DOM/CSS image decoding.
 *
 * Features:
 * - Single PixiJS canvas for all cards with hover/interaction
 * - Textures pre-loaded via Assets.load() during app init
 * - Minimal DOM overlay only for acquire button
 * - Responsive sizing based on container width
 */

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Application, Sprite, Texture, Rectangle, Assets, Graphics, Container } from "pixi.js";
import { getCardSpriteData, getUnitSpriteData, type SpriteData } from "../../utils/cardAtlas";

// Texture cache
const textureCache = new Map<string, Texture>();

// Placeholder texture for missing cards
let placeholderTexture: Texture | null = null;

function getPlaceholderTexture(): Texture {
  if (!placeholderTexture) {
    // Create a simple dark placeholder texture
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 280;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 200, 280);
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 4, 192, 272);
      ctx.fillStyle = "#444";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Loading...", 100, 140);
    }
    placeholderTexture = Texture.from(canvas);
  }
  return placeholderTexture;
}

/**
 * Get a PixiJS texture for a card or unit.
 * Uses the existing cardAtlas functions to get sprite coordinates.
 * Returns placeholder texture if card not found.
 */
async function getCardTexture(cardId: string, type: "unit" | "spell" | "aa"): Promise<Texture> {
  const cacheKey = `${type}:${cardId}`;
  const cached = textureCache.get(cacheKey);
  if (cached) return cached;

  // Get sprite data from cardAtlas
  let spriteData: SpriteData | null = null;

  if (type === "unit") {
    spriteData = getUnitSpriteData(cardId as never);
  } else {
    // Spells and AAs are both cards
    spriteData = getCardSpriteData(cardId as never);
  }

  if (!spriteData) {
    console.warn(`[PixiOfferCards] No sprite data for ${type}: ${cardId}`);
    return getPlaceholderTexture();
  }

  try {
    // Get base texture (already loaded via preloadAllSpriteSheets)
    const baseTexture = await Assets.load(spriteData.src);

    // Calculate frame coordinates
    const x = spriteData.col * spriteData.spriteWidth;
    const y = spriteData.row * spriteData.spriteHeight;

    // Create sub-texture with frame
    const frame = new Rectangle(x, y, spriteData.spriteWidth, spriteData.spriteHeight);
    const subTexture = new Texture({
      source: baseTexture.source,
      frame,
    });

    textureCache.set(cacheKey, subTexture);
    return subTexture;
  } catch (error) {
    console.warn(`[PixiOfferCards] Failed to load texture for ${cardId}:`, error);
    return getPlaceholderTexture();
  }
}

export interface CardInfo {
  id: string;
  canAcquire: boolean;
  acquireLabel?: string;
  isElite?: boolean;
  onAcquire?: () => void;
}

interface PixiOfferCardsProps {
  cards: CardInfo[];
  cardHeight: number;
  type: "unit" | "spell" | "aa";
}

// Card aspect ratio (width / height)
const CARD_ASPECT = 0.714;
const CARD_GAP = 24; // 1.5rem

// Border colors by type
const BORDER_COLORS: Record<string, number> = {
  unit: 0x7f8c8d,
  unit_elite: 0xf39c12,
  spell: 0x9b59b6,
  aa: 0xe67e22,
};

/**
 * Generate a pseudo-random rotation based on card ID and index
 */
function getHoverRotation(cardId: string, index: number): number {
  let hash = 0;
  const str = `${cardId}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const positive = Math.abs(hash);
  const sign = hash >= 0 ? 1 : -1;
  const magnitude = 0.5 + (positive % 16) / 10;
  return sign * magnitude * (Math.PI / 180); // Convert to radians
}

export function PixiOfferCards({ cards, cardHeight, type }: PixiOfferCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const cardContainersRef = useRef<Map<number, Container>>(new Map());
  const [isReady, setIsReady] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [buttonPosition, setButtonPosition] = useState<{ x: number; y: number; width: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const cardWidth = Math.round(cardHeight * CARD_ASPECT);

  // Calculate ideal canvas dimensions based on card count
  const idealCanvasWidth = useMemo(() => {
    if (cards.length === 0) return 300;
    // Cards in a row with gaps + extra padding for hover scale
    return cards.length * cardWidth + (cards.length - 1) * CARD_GAP + 40;
  }, [cards.length, cardWidth]);

  // Use container width to determine if we need to scale down
  const scaleFactor = useMemo(() => {
    if (containerWidth === 0 || idealCanvasWidth <= containerWidth) return 1;
    return containerWidth / idealCanvasWidth;
  }, [containerWidth, idealCanvasWidth]);

  // Actual canvas dimensions (may be scaled down to fit)
  const canvasWidth = Math.round(idealCanvasWidth * scaleFactor);
  const canvasHeight = Math.round((cardHeight + 60) * scaleFactor); // Extra space for hover lift

  // Scaled card dimensions
  const scaledCardWidth = Math.round(cardWidth * scaleFactor);
  const scaledCardHeight = Math.round(cardHeight * scaleFactor);
  const scaledGap = Math.round(CARD_GAP * scaleFactor);

  // Track container width for responsive scaling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const parentWidth = container.parentElement?.clientWidth ?? window.innerWidth;
      setContainerWidth(parentWidth - 48); // Account for padding
    };

    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  // Card base positions (before hover transforms) - uses scaled dimensions
  const cardPositions = useMemo(() => {
    const padding = 20 * scaleFactor;
    const topPadding = 30 * scaleFactor;
    return cards.map((_, index) => ({
      x: padding + index * (scaledCardWidth + scaledGap) + scaledCardWidth / 2, // Center anchor
      y: topPadding + scaledCardHeight / 2, // Center anchor with top padding
    }));
  }, [cards.length, scaledCardWidth, scaledCardHeight, scaledGap, scaleFactor]);

  // Initialize PixiJS app
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    let destroyed = false;

    const initApp = async () => {
      const app = new Application();
      await app.init({
        width: canvasWidth,
        height: canvasHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);
      appRef.current = app;
      setIsReady(true);
    };

    initApp();

    return () => {
      destroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      cardContainersRef.current.clear();
      setIsReady(false);
    };
  }, [canvasWidth, canvasHeight]);

  // Update sprites when cards change
  useEffect(() => {
    const app = appRef.current;
    if (!app || !isReady) return;

    const updateSprites = async () => {
      // Clear old containers
      app.stage.removeChildren();
      cardContainersRef.current.clear();

      // Add new card containers
      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (!card) continue;

        const pos = cardPositions[i];
        if (!pos) continue;

        const texture = await getCardTexture(card.id, type);

        // Create container for card + border
        const cardContainer = new Container();
        cardContainer.x = pos.x;
        cardContainer.y = pos.y;
        cardContainer.pivot.set(scaledCardWidth / 2, scaledCardHeight / 2);

        // Card sprite - uses scaled dimensions
        const sprite = new Sprite(texture);
        sprite.width = scaledCardWidth;
        sprite.height = scaledCardHeight;
        cardContainer.addChild(sprite);

        // Border graphics
        const borderColor = type === "unit" && card.isElite
          ? BORDER_COLORS['unit_elite']
          : BORDER_COLORS[type];
        const border = new Graphics();
        border.setStrokeStyle({ width: Math.max(2, 3 * scaleFactor), color: borderColor });
        border.roundRect(0, 0, scaledCardWidth, scaledCardHeight, scaledCardWidth * 0.04);
        border.stroke();
        cardContainer.addChild(border);

        // Make interactive
        cardContainer.eventMode = "static";
        cardContainer.cursor = "pointer";

        const cardIndex = i; // Capture for closure
        cardContainer.on("pointerenter", () => {
          setHoveredIndex(cardIndex);
        });
        cardContainer.on("pointerleave", () => {
          setHoveredIndex(null);
        });
        cardContainer.on("pointerdown", () => {
          if (card.canAcquire && card.onAcquire) {
            card.onAcquire();
          }
        });

        app.stage.addChild(cardContainer);
        cardContainersRef.current.set(i, cardContainer);
      }
    };

    updateSprites();
  }, [cards, cardPositions, scaledCardWidth, scaledCardHeight, scaleFactor, isReady, type]);

  // Handle hover animation
  useEffect(() => {
    const containers = cardContainersRef.current;

    cards.forEach((card, index) => {
      const container = containers.get(index);
      if (!container) return;

      const pos = cardPositions[index];
      if (!pos) return;

      const isHovered = hoveredIndex === index;
      const canAcquire = card.canAcquire;

      if (isHovered) {
        const rotation = getHoverRotation(card.id, index);
        const liftY = (canAcquire ? -15 : -8) * scaleFactor;
        const scale = canAcquire ? 1.05 : 1;

        container.rotation = rotation;
        container.y = pos.y + liftY;
        container.scale.set(scale);
        container.zIndex = 10;

        // Update button position for DOM overlay
        if (card.onAcquire) {
          const globalPos = container.getGlobalPosition();
          setButtonPosition({
            x: globalPos.x - (scaledCardWidth * scale) / 2,
            y: globalPos.y + (scaledCardHeight * scale) / 2 - 40 * scaleFactor,
            width: scaledCardWidth * scale,
          });
        }
      } else {
        container.rotation = 0;
        container.y = pos.y;
        container.scale.set(1);
        container.zIndex = 1;
      }
    });

    // Sort by zIndex
    appRef.current?.stage.sortChildren();

    // Clear button position when not hovering
    if (hoveredIndex === null) {
      setButtonPosition(null);
    }
  }, [hoveredIndex, cards, cardPositions, scaledCardWidth, scaledCardHeight, scaleFactor]);

  if (cards.length === 0) {
    return <div className="offer-pane__empty">No {type}s available</div>;
  }

  const hoveredCard = hoveredIndex !== null ? cards[hoveredIndex] : null;

  return (
    <div
      ref={containerRef}
      className="pixi-offer-cards"
      style={{
        position: "relative",
        width: canvasWidth,
        height: canvasHeight,
        margin: "0 auto",
      }}
    >
      {/* PixiJS canvas container */}
      <div
        ref={canvasContainerRef}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: canvasWidth,
          height: canvasHeight,
        }}
      />

      {/* Acquire button overlay - only shown when hovering a card with onAcquire */}
      {hoveredCard?.onAcquire && buttonPosition && (
        <button
          className={`offer-card__acquire-btn ${!hoveredCard.canAcquire ? "offer-card__acquire-btn--disabled" : ""}`}
          style={{
            position: "absolute",
            left: buttonPosition.x + 8,
            top: buttonPosition.y,
            width: buttonPosition.width - 16,
            opacity: 1,
            transform: "translateY(0)",
            zIndex: 100,
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (hoveredCard.canAcquire && hoveredCard.onAcquire) {
              hoveredCard.onAcquire();
            }
          }}
          disabled={!hoveredCard.canAcquire}
        >
          {hoveredCard.acquireLabel || "Acquire"}
        </button>
      )}
    </div>
  );
}
