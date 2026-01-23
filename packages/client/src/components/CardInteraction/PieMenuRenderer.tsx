/**
 * PieMenuRenderer - Shared PixiJS pie menu rendering component
 *
 * Extracted from PixiPieMenu for use by the unified card interaction system.
 * Renders wedges with hover effects, glow animations, and entry/exit animations.
 *
 * Uses the shared PixiJS Application from PixiAppContext to avoid WebGL context conflicts.
 */

import { useEffect, useRef, useCallback, useId, useState } from "react";
import { Container, Graphics, Text, BlurFilter, Sprite, Texture } from "pixi.js";
import type { CardId } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { UI_COLORS } from "./utils/colorHelpers";
import { getCardTexture } from "../../utils/pixiTextureLoader";

// ============================================================================
// Types
// ============================================================================

export interface PieMenuWedge {
  /** Unique identifier for the wedge */
  readonly id: string;
  /** Main label text */
  readonly label: string;
  /** Optional secondary label */
  readonly sublabel?: string;
  /** Fill color (hex) */
  readonly color: number;
  /** Hover color (hex) */
  readonly hoverColor: number;
  /** Optional custom stroke color */
  readonly strokeColor?: number;
  /** Whether this wedge is disabled */
  readonly disabled?: boolean;
  /** Relative size of wedge (default 1) */
  readonly weight?: number;
}

export interface PieMenuRendererProps {
  /** Wedge configurations */
  readonly wedges: readonly PieMenuWedge[];
  /** Called when a wedge is selected */
  readonly onSelect: (id: string) => void;
  /** Called when menu is cancelled (click overlay or press Escape) */
  readonly onCancel: () => void;
  /** Position on screen (defaults to center) */
  readonly position?: { x: number; y: number };
  /** Outer radius of the pie menu */
  readonly outerRadius?: number;
  /** Inner radius (0 for full pie, >0 for donut) */
  readonly innerRadius?: number;
  /**
   * Inner radius for label positioning (where visible wedge area starts).
   * When a card covers the center, labels should be placed in the visible
   * area outside the card, not at the geometric center.
   * Defaults to innerRadius if not provided.
   */
  readonly labelInnerRadius?: number;
  /** Font sizes - will be calculated from viewport if not provided */
  readonly labelFontSize?: number;
  readonly sublabelFontSize?: number;
  /** Whether to show the overlay background */
  readonly showOverlay?: boolean;
  /** Overlay opacity (0-1) */
  readonly overlayOpacity?: number;
  /** Center label text */
  readonly centerLabel?: string;
  /** Card ID to render in center (for effect-choice state) */
  readonly centerCardId?: CardId;
  /** Card dimensions for center card rendering */
  readonly cardWidth?: number;
  readonly cardHeight?: number;
}

// ============================================================================
// Helpers
// ============================================================================

function polarToCartesian(radius: number, angle: number) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

// ============================================================================
// Component
// ============================================================================

export function PieMenuRenderer({
  wedges,
  onSelect,
  onCancel,
  position,
  outerRadius: outerRadiusProp,
  innerRadius: innerRadiusProp = 0,
  labelInnerRadius: labelInnerRadiusProp,
  labelFontSize: labelFontSizeProp,
  sublabelFontSize: sublabelFontSizeProp,
  showOverlay = true,
  overlayOpacity = 0.7,
  centerLabel,
  centerCardId,
  cardWidth: cardWidthProp,
  cardHeight: cardHeightProp,
}: PieMenuRendererProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);
  const timeoutIdsRef = useRef<number[]>([]);

  // Load card texture if centerCardId is provided
  const [cardTexture, setCardTexture] = useState<Texture | null>(null);
  useEffect(() => {
    if (!centerCardId) {
      setCardTexture(null);
      return;
    }
    getCardTexture(centerCardId).then(setCardTexture);
  }, [centerCardId]);

  // Keep callbacks in refs to avoid stale closures
  const onCancelRef = useRef(onCancel);
  const onSelectRef = useRef(onSelect);
  onCancelRef.current = onCancel;
  onSelectRef.current = onSelect;

  // Calculate sizes based on viewport
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const outerRadius = outerRadiusProp ?? Math.max(120, vmin * 0.15);
  const innerRadius = innerRadiusProp;
  // For label positioning: use labelInnerRadius if provided, else innerRadius
  const labelInnerRadius = labelInnerRadiusProp ?? innerRadius;
  const labelFontSize = labelFontSizeProp ?? Math.round(Math.max(16, vmin * 0.018));
  const sublabelFontSize = sublabelFontSizeProp ?? Math.round(Math.max(12, vmin * 0.012));
  const menuPosition = position ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Calculate wedge geometry
  const calculateWedgeGeometry = useCallback(() => {
    if (wedges.length === 0) return [];

    const totalWeight = wedges.reduce((sum, w) => sum + (w.weight ?? 1), 0);
    const firstWeight = wedges[0]?.weight ?? 1;
    const firstAngle = (firstWeight / totalWeight) * (2 * Math.PI);
    let currentAngle = -Math.PI / 2 - firstAngle / 2;

    return wedges.map((wedge) => {
      const weight = wedge.weight ?? 1;
      const angleSpan = (weight / totalWeight) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      const midAngle = (startAngle + endAngle) / 2;
      currentAngle = endAngle;

      return { ...wedge, startAngle, endAngle, midAngle };
    });
  }, [wedges]);

  // Draw a wedge path
  const drawWedge = useCallback(
    (
      graphics: Graphics,
      innerR: number,
      outerR: number,
      startAngle: number,
      endAngle: number,
      color: number,
      strokeColor: number,
      strokeWidth: number
    ) => {
      graphics.clear();

      if (innerR === 0) {
        graphics.moveTo(0, 0);
        graphics.arc(0, 0, outerR, startAngle, endAngle);
        graphics.lineTo(0, 0);
      } else {
        const innerStart = polarToCartesian(innerR, startAngle);
        const outerEnd = polarToCartesian(outerR, endAngle);

        graphics.moveTo(innerStart.x, innerStart.y);
        graphics.arc(0, 0, innerR, startAngle, endAngle);
        graphics.lineTo(outerEnd.x, outerEnd.y);
        graphics.arc(0, 0, outerR, endAngle, startAngle, true);
        graphics.lineTo(innerStart.x, innerStart.y);
      }

      graphics.fill({ color, alpha: 0.95 });
      graphics.stroke({ color: strokeColor, width: strokeWidth });
    },
    []
  );

  // Build the pie menu
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;
    timeoutIdsRef.current = [];

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `pie-menu-${uniqueId}`;
    overlayLayer.addChild(rootContainer);
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Overlay background
    if (showOverlay) {
      const overlay = new Graphics();
      overlay.rect(0, 0, app.screen.width, app.screen.height);
      overlay.fill({ color: UI_COLORS.OVERLAY, alpha: overlayOpacity });
      overlay.eventMode = "static";
      overlay.cursor = "default";
      overlay.on("pointerdown", () => onCancelRef.current());
      overlay.alpha = 0;
      rootContainer.addChild(overlay);

      animManager.animate("overlay-fade", overlay, {
        endAlpha: 1,
        duration: 200,
        easing: Easing.easeOutQuad,
      });
    }

    // Menu container
    const menuContainer = new Container();
    menuContainer.sortableChildren = true;
    menuContainer.position.set(menuPosition.x, menuPosition.y);
    rootContainer.addChild(menuContainer);

    const wedgeData = calculateWedgeGeometry();

    // Render wedges
    wedgeData.forEach((wedge, index) => {
      const wedgeContainer = new Container();

      // Glow effect (behind)
      const glow = new Graphics();
      drawWedge(
        glow,
        Math.max(0, innerRadius - 5),
        outerRadius + 10,
        wedge.startAngle,
        wedge.endAngle,
        UI_COLORS.GLOW,
        UI_COLORS.GLOW,
        0
      );
      glow.filters = [new BlurFilter({ strength: 15 })];
      glow.alpha = 0;
      wedgeContainer.addChild(glow);

      // Wedge shape
      const shape = new Graphics();
      const strokeColor = wedge.strokeColor ?? UI_COLORS.STROKE;
      drawWedge(
        shape,
        innerRadius,
        outerRadius,
        wedge.startAngle,
        wedge.endAngle,
        wedge.color,
        strokeColor,
        2
      );
      wedgeContainer.addChild(shape);

      // Label position - centered in visible wedge area (outside card cover area)
      const labelRadius = labelInnerRadius + (outerRadius - labelInnerRadius) * 0.5;
      const labelPos = polarToCartesian(labelRadius, wedge.midAngle);

      // Main label
      const labelOffset = wedge.sublabel ? sublabelFontSize * 0.7 : 0;
      const label = new Text({
        text: wedge.label,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: labelFontSize,
          fontWeight: "bold",
          fill: wedge.disabled ? UI_COLORS.TEXT_DISABLED : UI_COLORS.TEXT,
          align: "center",
        },
      });
      label.anchor.set(0.5);
      label.position.set(labelPos.x, labelPos.y - labelOffset);
      wedgeContainer.addChild(label);

      // Sublabel
      if (wedge.sublabel) {
        const sublabel = new Text({
          text: wedge.sublabel,
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: sublabelFontSize,
            fill: wedge.disabled ? UI_COLORS.TEXT_DISABLED : UI_COLORS.TEXT_SUBLABEL,
            align: "center",
          },
        });
        sublabel.anchor.set(0.5);
        sublabel.position.set(labelPos.x, labelPos.y + sublabelFontSize * 0.9);
        wedgeContainer.addChild(sublabel);
      }

      if (wedge.disabled) {
        wedgeContainer.alpha = 0.5;
      }

      // Interactivity
      shape.eventMode = wedge.disabled ? "none" : "static";
      shape.cursor = wedge.disabled ? "not-allowed" : "pointer";

      shape.on("pointerenter", () => {
        if (wedge.disabled || isDestroyedRef.current) return;

        wedgeContainer.zIndex = 100;
        menuContainer.sortChildren();

        animManager.animate(`wedge-hover-${index}`, wedgeContainer, {
          endScale: 1.05,
          duration: 100,
          easing: Easing.easeOutQuad,
        });

        animManager.animate(`glow-${index}`, glow, {
          endAlpha: 0.6,
          duration: 100,
          easing: Easing.easeOutQuad,
        });

        drawWedge(
          shape,
          innerRadius,
          outerRadius,
          wedge.startAngle,
          wedge.endAngle,
          wedge.hoverColor,
          UI_COLORS.STROKE_HOVER,
          3
        );
      });

      shape.on("pointerleave", () => {
        if (wedge.disabled || isDestroyedRef.current) return;

        wedgeContainer.zIndex = index;
        menuContainer.sortChildren();

        animManager.animate(`wedge-hover-${index}`, wedgeContainer, {
          endScale: 1,
          duration: 100,
          easing: Easing.easeOutQuad,
        });

        animManager.animate(`glow-${index}`, glow, {
          endAlpha: 0,
          duration: 100,
          easing: Easing.easeOutQuad,
        });

        drawWedge(
          shape,
          innerRadius,
          outerRadius,
          wedge.startAngle,
          wedge.endAngle,
          wedge.color,
          strokeColor,
          2
        );
      });

      shape.on("pointerdown", () => {
        if (wedge.disabled || isDestroyedRef.current) return;

        animManager.animate(`wedge-select-${index}`, wedgeContainer, {
          endScale: 1.1,
          duration: 80,
          easing: Easing.easeOutQuad,
          onComplete: () => {
            if (!isDestroyedRef.current) {
              onSelectRef.current(wedge.id);
            }
          },
        });
      });

      wedgeContainer.zIndex = index;
      menuContainer.addChild(wedgeContainer);

      // Entry animation
      wedgeContainer.scale.set(0.5);
      wedgeContainer.alpha = 0;
      const wedgeTimeoutId = window.setTimeout(() => {
        if (isDestroyedRef.current || !wedgeContainer.parent) return;
        animManager.animate(`wedge-entry-${index}`, wedgeContainer, {
          endScale: 1,
          endAlpha: wedge.disabled ? 0.5 : 1,
          duration: 250,
          easing: Easing.easeOutBack,
        });
      }, 50 + index * 40);
      timeoutIdsRef.current.push(wedgeTimeoutId);
    });

    // Center glow
    const centerGlow = new Graphics();
    centerGlow.circle(0, 0, 20);
    centerGlow.fill({ color: UI_COLORS.GLOW, alpha: 0.3 });
    centerGlow.filters = [new BlurFilter({ strength: 15 })];
    centerGlow.alpha = 0;
    menuContainer.addChildAt(centerGlow, 0);

    const glowTimeoutId = window.setTimeout(() => {
      if (isDestroyedRef.current || !centerGlow.parent) return;
      animManager.animate("center-glow", centerGlow, {
        endAlpha: 0.8,
        duration: 300,
        easing: Easing.easeOutQuad,
      });
    }, 200);
    timeoutIdsRef.current.push(glowTimeoutId);

    // Center card (for effect-choice state when card is no longer in hand)
    // Starts partially visible (alpha=0.3) and fades in immediately (no delay)
    // to create a smooth crossfade with the hand's card fading out
    if (cardTexture && cardWidthProp && cardHeightProp) {
      const cardSprite = new Sprite(cardTexture);
      cardSprite.width = cardWidthProp;
      cardSprite.height = cardHeightProp;
      // Center the card (anchor at center)
      cardSprite.anchor.set(0.5, 0.5);
      cardSprite.position.set(0, 0);
      cardSprite.alpha = 0.3; // Start partially visible for smooth crossfade
      cardSprite.zIndex = 500; // Above wedges
      menuContainer.addChild(cardSprite);

      // Animate card fade in immediately (no delay) to crossfade with hand card
      animManager.animate("center-card", cardSprite, {
        endAlpha: 1,
        duration: 150, // Matches hand card fade out duration
        easing: Easing.easeOutQuad,
      });
    }

    // Center label
    if (centerLabel) {
      const centerText = new Text({
        text: centerLabel,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: sublabelFontSize,
          fill: 0x888888,
          align: "center",
        },
      });
      centerText.anchor.set(0.5);
      centerText.position.set(0, 0);
      centerText.alpha = 0;
      menuContainer.addChild(centerText);

      const labelTimeoutId = window.setTimeout(() => {
        if (isDestroyedRef.current || !centerText.parent) return;
        animManager.animate("center-label", centerText, {
          endAlpha: 0.8,
          duration: 300,
          easing: Easing.easeOutQuad,
        });
      }, 250);
      timeoutIdsRef.current.push(labelTimeoutId);
    }

    return () => {
      isDestroyedRef.current = true;

      // Clear all pending timeouts
      for (const id of timeoutIdsRef.current) {
        window.clearTimeout(id);
      }
      timeoutIdsRef.current = [];

      // Cancel all animations
      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      // Remove and destroy container
      if (rootContainerRef.current) {
        // Clear filters before destroying
        const clearFiltersRecursive = (container: Container) => {
          if (container.filters) {
            container.filters = [];
          }
          for (const child of container.children) {
            if (child instanceof Container) {
              clearFiltersRecursive(child);
            }
          }
        };
        clearFiltersRecursive(rootContainerRef.current);

        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    app,
    overlayLayer,
    wedges,
    outerRadius,
    innerRadius,
    labelFontSize,
    sublabelFontSize,
    showOverlay,
    overlayOpacity,
    centerLabel,
    cardTexture,
    cardWidthProp,
    cardHeightProp,
  ]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Renders directly to shared PixiJS canvas
  return null;
}
