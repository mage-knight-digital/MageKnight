/**
 * PixiPieMenu - Reusable PixiJS pie/wheel menu component
 *
 * A juicy radial menu with wedge segments, hover effects, and animations.
 * Used by PixiCardActionMenu, spell mana selection, and choice overlays.
 */

import { useEffect, useRef, useCallback } from "react";
import { Application, Container, Graphics, Text, BlurFilter } from "pixi.js";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);

  const onCancelRef = useRef(onCancel);
  const onSelectRef = useRef(onSelect);
  onCancelRef.current = onCancel;
  onSelectRef.current = onSelect;

  // Calculate sizes based on viewport
  const vmin = Math.min(window.innerWidth, window.innerHeight);
  const outerRadius = outerRadiusProp ?? Math.max(120, vmin * 0.15);
  const innerRadius = innerRadiusProp;
  const labelFontSize = labelFontSizeProp ?? Math.round(Math.max(16, vmin * 0.018));
  const sublabelFontSize = sublabelFontSizeProp ?? Math.round(Math.max(12, vmin * 0.012));
  const menuPosition = position ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Calculate wedge geometry
  const calculateWedges = useCallback(() => {
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

  // Initialize PixiJS
  useEffect(() => {
    if (!containerRef.current) return;
    isDestroyedRef.current = false;

    let app: Application | null = null;

    const init = async () => {
      app = new Application();
      await app.init({
        width: window.innerWidth,
        height: window.innerHeight,
        backgroundAlpha: 0,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });

      if (isDestroyedRef.current) {
        app.destroy(true, { children: true });
        return;
      }

      app.canvas.style.position = "absolute";
      app.canvas.style.top = "0";
      app.canvas.style.left = "0";
      app.canvas.style.width = "100%";
      app.canvas.style.height = "100%";
      app.canvas.style.pointerEvents = "auto";

      if (containerRef.current) {
        containerRef.current.appendChild(app.canvas);
      }
      appRef.current = app;

      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animManagerRef.current = animManager;

      // Overlay background
      if (showOverlay) {
        const overlay = new Graphics();
        overlay.rect(0, 0, window.innerWidth, window.innerHeight);
        overlay.fill({ color: COLORS.OVERLAY, alpha: overlayOpacity });
        overlay.eventMode = "static";
        overlay.cursor = "default";
        overlay.on("pointerdown", () => onCancelRef.current());
        overlay.alpha = 0;
        app.stage.addChild(overlay);

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
      app.stage.addChild(menuContainer);

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
          if (wedge.disabled) return;

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
          if (wedge.disabled) return;

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
          if (wedge.disabled) return;

          animManager.animate(`wedge-select-${index}`, wedgeContainer, {
            endScale: 1.1,
            duration: 80,
            easing: Easing.easeOutQuad,
            onComplete: () => {
              onSelectRef.current(wedge.id);
            },
          });
        });

        wedgeContainer.zIndex = index;
        menuContainer.addChild(wedgeContainer);

        // Entry animation
        wedgeContainer.scale.set(0.5);
        wedgeContainer.alpha = 0;
        setTimeout(() => {
          if (isDestroyedRef.current) return;
          animManager.animate(`wedge-entry-${index}`, wedgeContainer, {
            endScale: 1,
            endAlpha: wedge.disabled ? 0.5 : 1,
            duration: 250,
            easing: Easing.easeOutBack,
          });
        }, 50 + index * 40);
      });

      // Center glow
      const centerGlow = new Graphics();
      centerGlow.circle(0, 0, 20);
      centerGlow.fill({ color: COLORS.GLOW, alpha: 0.3 });
      centerGlow.filters = [new BlurFilter({ strength: 15 })];
      centerGlow.alpha = 0;
      menuContainer.addChildAt(centerGlow, 0);

      setTimeout(() => {
        if (isDestroyedRef.current) return;
        animManager.animate("center-glow", centerGlow, {
          endAlpha: 0.8,
          duration: 300,
          easing: Easing.easeOutQuad,
        });
      }, 200);

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

        setTimeout(() => {
          if (isDestroyedRef.current) return;
          animManager.animate("center-label", centerText, {
            endAlpha: 0.8,
            duration: 300,
            easing: Easing.easeOutQuad,
          });
        }, 250);
      }
    };

    init();

    return () => {
      isDestroyedRef.current = true;

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, outerRadius, innerRadius, labelFontSize, sublabelFontSize, showOverlay, overlayOpacity, centerLabel]);

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

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        pointerEvents: "auto",
      }}
    />
  );
}
