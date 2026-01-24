/**
 * PixiPieMenu - Reusable PixiJS pie/wheel menu component
 *
 * A juicy radial menu with wedge segments, hover effects, and animations.
 * Uses the shared PixiJS Application from PixiAppContext instead of creating
 * its own Application, avoiding WebGL context conflicts.
 *
 * Used by PixiCardActionMenu, spell mana selection, and choice overlays.
 *
 * Architecture: Separates app lifecycle from content lifecycle.
 * - App created once on mount, destroyed on unmount
 * - Content (wedges) can smoothly transition when items change
 */

import { useEffect, useRef, useCallback, useMemo, useId } from "react";
import { Container, Graphics, Text, BlurFilter } from "pixi.js";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { cleanupFilters } from "../../utils/pixiFilterCleanup";

// ============================================
// Types
// ============================================

export interface PixiPieMenuItem {
  id: string;
  label: string;
  sublabel?: string;
  color: number;
  hoverColor: number;
  strokeColor?: number;
  disabled?: boolean;
  weight?: number; // Relative size of wedge (default 1)
}

export interface PixiPieMenuProps {
  items: PixiPieMenuItem[];
  onSelect: (id: string) => void;
  onCancel: () => void;
  /** Position on screen (defaults to center) */
  position?: { x: number; y: number };
  /** Outer radius of the pie menu */
  outerRadius?: number;
  /** Inner radius (0 for full pie, >0 for donut) */
  innerRadius?: number;
  /** Font sizes - will be calculated from viewport if not provided */
  labelFontSize?: number;
  sublabelFontSize?: number;
  /** Whether to show the overlay background */
  showOverlay?: boolean;
  /** Overlay opacity (0-1) */
  overlayOpacity?: number;
  /** Center label text */
  centerLabel?: string;
}

interface WedgeData extends PixiPieMenuItem {
  startAngle: number;
  endAngle: number;
  midAngle: number;
}

// ============================================
// Constants
// ============================================

const COLORS = {
  STROKE: 0x5c4a3a,
  STROKE_HOVER: 0xb49664,
  TEXT: 0xf0e6d2,
  TEXT_DISABLED: 0x666666,
  TEXT_SUBLABEL: 0xb0a090,
  GLOW: 0xffc864,
  OVERLAY: 0x0a0805,
};

// Animation timing
const ENTRY_DURATION = 250;
const ENTRY_STAGGER = 40;
const ENTRY_DELAY = 50;

function polarToCartesian(radius: number, angle: number) {
  return {
    x: radius * Math.cos(angle),
    y: radius * Math.sin(angle),
  };
}

// ============================================
// Component
// ============================================

export function PixiPieMenu({
  items,
  onSelect,
  onCancel,
  position,
  outerRadius: outerRadiusProp,
  innerRadius: innerRadiusProp = 0,
  labelFontSize: labelFontSizeProp,
  sublabelFontSize: sublabelFontSizeProp,
  showOverlay = true,
  overlayOpacity = 0.7,
  centerLabel,
}: PixiPieMenuProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);
  const timeoutIdsRef = useRef<number[]>([]);

  // Stable callback refs
  const onCancelRef = useRef(onCancel);
  const onSelectRef = useRef(onSelect);
  onCancelRef.current = onCancel;
  onSelectRef.current = onSelect;

  // Calculate sizes based on viewport (memoized to avoid recalc)
  const sizes = useMemo(() => {
    const vmin = Math.min(window.innerWidth, window.innerHeight);
    return {
      outerRadius: outerRadiusProp ?? Math.max(120, vmin * 0.15),
      innerRadius: innerRadiusProp,
      labelFontSize: labelFontSizeProp ?? Math.round(Math.max(16, vmin * 0.018)),
      sublabelFontSize: sublabelFontSizeProp ?? Math.round(Math.max(12, vmin * 0.012)),
    };
  }, [outerRadiusProp, innerRadiusProp, labelFontSizeProp, sublabelFontSizeProp]);

  const menuPosition = useMemo(
    () => position ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    [position]
  );

  // Calculate wedge geometry
  const calculateWedges = useCallback((): WedgeData[] => {
    if (items.length === 0) return [];

    const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
    const firstWeight = items[0]?.weight ?? 1;
    const firstAngle = (firstWeight / totalWeight) * (2 * Math.PI);
    let currentAngle = -Math.PI / 2 - firstAngle / 2;

    return items.map((item) => {
      const weight = item.weight ?? 1;
      const angleSpan = (weight / totalWeight) * (2 * Math.PI);
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      const midAngle = (startAngle + endAngle) / 2;
      currentAngle = endAngle;

      return { ...item, startAngle, endAngle, midAngle };
    });
  }, [items]);

  // Draw a wedge path
  const drawWedge = useCallback((
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
  }, []);

  // Build the pie menu using the shared PixiJS Application
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;
    timeoutIdsRef.current = [];

    const { outerRadius, innerRadius, labelFontSize, sublabelFontSize } = sizes;

    // Create root container for this pie menu instance
    const rootContainer = new Container();
    rootContainer.label = `pie-menu-${uniqueId}`;
    rootContainer.zIndex = 1000; // Above all combat UI (enemy tokens, phase rail, etc.)
    overlayLayer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager attached to the shared app's ticker
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Overlay background
    if (showOverlay) {
      const overlay = new Graphics();
      overlay.rect(0, 0, app.screen.width, app.screen.height);
      overlay.fill({ color: COLORS.OVERLAY, alpha: overlayOpacity });
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

    const wedges = calculateWedges();

    // Render wedges
    wedges.forEach((wedge, index) => {
      const wedgeContainer = new Container();

      // Glow effect (behind)
      const glow = new Graphics();
      drawWedge(glow, Math.max(0, innerRadius - 5), outerRadius + 10, wedge.startAngle, wedge.endAngle, COLORS.GLOW, COLORS.GLOW, 0);
      glow.filters = [new BlurFilter({ strength: 15 })];
      glow.alpha = 0;
      wedgeContainer.addChild(glow);

      // Wedge shape
      const shape = new Graphics();
      const strokeColor = wedge.strokeColor ?? COLORS.STROKE;
      drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.color, strokeColor, 2);
      wedgeContainer.addChild(shape);

      // Label position
      const labelRadius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const labelPos = polarToCartesian(labelRadius, wedge.midAngle);

      // Main label
      const labelOffset = wedge.sublabel ? sublabelFontSize * 0.7 : 0;
      const label = new Text({
        text: wedge.label,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: labelFontSize,
          fontWeight: "bold",
          fill: wedge.disabled ? COLORS.TEXT_DISABLED : COLORS.TEXT,
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
            fill: wedge.disabled ? COLORS.TEXT_DISABLED : COLORS.TEXT_SUBLABEL,
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

        drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.hoverColor, COLORS.STROKE_HOVER, 3);
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

        drawWedge(shape, innerRadius, outerRadius, wedge.startAngle, wedge.endAngle, wedge.color, strokeColor, 2);
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
          duration: ENTRY_DURATION,
          easing: Easing.easeOutBack,
        });
      }, ENTRY_DELAY + index * ENTRY_STAGGER);
      timeoutIdsRef.current.push(wedgeTimeoutId);
    });

    // Center glow
    const centerGlow = new Graphics();
    centerGlow.circle(0, 0, 20);
    centerGlow.fill({ color: COLORS.GLOW, alpha: 0.3 });
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

      // Remove and destroy our container from the overlay layer
      if (rootContainerRef.current) {
        // Clear filters before destroying to prevent stencil/mask errors
        cleanupFilters(rootContainerRef.current);

        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [app, overlayLayer, items, sizes.outerRadius, sizes.innerRadius, sizes.labelFontSize, sizes.sublabelFontSize, showOverlay, overlayOpacity, centerLabel]);

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

  // No DOM element needed - we render directly to the shared PixiJS canvas
  return null;
}
