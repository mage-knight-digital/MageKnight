/**
 * PixiPowerLine - Animated connection line during drag operations
 *
 * Renders a glowing line from drag start position to current cursor,
 * with animated particles traveling along the line.
 *
 * Features:
 * - Element-colored line and particles
 * - Outer glow effect
 * - Animated particles moving along the line
 * - Pulsing origin point
 */

import { useEffect, useRef, useId } from "react";
import { Container, Graphics, BlurFilter } from "pixi.js";
import type { AttackElement } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useCombatDrag } from "../../contexts/CombatDragContext";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";

// ============================================================================
// Constants
// ============================================================================

// Element colors matching CSS palette
const ELEMENT_COLORS: Record<AttackElement, { primary: number; glow: number }> = {
  physical: { primary: 0x95a5a6, glow: 0x95a5a6 },
  fire: { primary: 0xe74c3c, glow: 0xe74c3c },
  ice: { primary: 0x3498db, glow: 0x3498db },
  coldFire: { primary: 0x9b59b6, glow: 0x9b59b6 },
};

const PARTICLE_COUNT = 3;
const PARTICLE_CYCLE_DURATION = 0.5; // seconds for one full cycle
const PULSE_SPEED = 8; // radians per second

// ============================================================================
// Component
// ============================================================================

export function PixiPowerLine() {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();
  const { dragState } = useCombatDrag();

  const containerRef = useRef<Container | null>(null);
  const lineRef = useRef<Graphics | null>(null);
  const glowRef = useRef<Graphics | null>(null);
  const originRef = useRef<Graphics | null>(null);
  const particlesRef = useRef<Graphics[]>([]);
  const animationRef = useRef<{
    elapsed: number;
    pulseElapsed: number;
  }>({ elapsed: 0, pulseElapsed: 0 });
  const isDestroyedRef = useRef(false);

  // Create/destroy the power line container based on drag state
  useEffect(() => {
    if (!app || !overlayLayer) return;

    const { isDragging, startPosition, currentPosition, activeChip } = dragState;

    // If not dragging, clean up
    if (!isDragging || !startPosition || !currentPosition || !activeChip) {
      if (containerRef.current) {
        containerRef.current.destroy({ children: true });
        containerRef.current = null;
        lineRef.current = null;
        glowRef.current = null;
        originRef.current = null;
        particlesRef.current = [];
      }
      return;
    }

    // Get colors for this element
    const element = activeChip.element;
    const colors = ELEMENT_COLORS[element];

    // Create container if needed
    if (!containerRef.current) {
      isDestroyedRef.current = false;
      animationRef.current = { elapsed: 0, pulseElapsed: 0 };

      const container = new Container();
      container.label = `power-line-${uniqueId}`;
      container.zIndex = PIXI_Z_INDEX.POWER_LINE;
      overlayLayer.addChild(container);
      overlayLayer.sortChildren();
      containerRef.current = container;

      // Create glow line (behind main line)
      const glow = new Graphics();
      glow.filters = [new BlurFilter({ strength: 8 })];
      container.addChild(glow);
      glowRef.current = glow;

      // Create main line
      const line = new Graphics();
      container.addChild(line);
      lineRef.current = line;

      // Create particles
      particlesRef.current = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = new Graphics();
        const size = 4 - i; // Decreasing size
        particle.circle(0, 0, size);
        particle.fill({ color: i === 1 ? 0xffffff : colors.primary });
        container.addChild(particle);
        particlesRef.current.push(particle);
      }

      // Create pulsing origin point
      const origin = new Graphics();
      origin.circle(0, 0, 6);
      origin.fill({ color: colors.primary, alpha: 0.6 });
      container.addChild(origin);
      originRef.current = origin;
    }

    // Update line geometry
    const line = lineRef.current;
    const glow = glowRef.current;
    const origin = originRef.current;

    if (line) {
      line.clear();
      line.moveTo(startPosition.x, startPosition.y);
      line.lineTo(currentPosition.x, currentPosition.y);
      line.stroke({ color: colors.primary, width: 3, alpha: 0.8 });
    }

    if (glow) {
      glow.clear();
      glow.moveTo(startPosition.x, startPosition.y);
      glow.lineTo(currentPosition.x, currentPosition.y);
      glow.stroke({ color: colors.glow, width: 8, alpha: 0.4 });
    }

    if (origin) {
      origin.position.set(startPosition.x, startPosition.y);
    }

    // Animation tick function
    const animate = (ticker: { deltaMS: number }) => {
      if (isDestroyedRef.current) return;

      const deltaSeconds = ticker.deltaMS / 1000;
      animationRef.current.elapsed += deltaSeconds;
      animationRef.current.pulseElapsed += deltaSeconds;

      const { elapsed, pulseElapsed } = animationRef.current;

      // Animate particles along the line
      const particles = particlesRef.current;
      const start = dragState.startPosition;
      const current = dragState.currentPosition;

      if (start && current && particles.length > 0) {
        particles.forEach((particle, i) => {
          // Each particle is offset in time
          const t = ((elapsed / PARTICLE_CYCLE_DURATION + i * 0.15) % 1);
          particle.x = start.x + (current.x - start.x) * t;
          particle.y = start.y + (current.y - start.y) * t;
        });
      }

      // Pulse the origin point
      if (origin) {
        const scale = 1 + 0.3 * Math.sin(pulseElapsed * PULSE_SPEED);
        origin.scale.set(scale);
        origin.alpha = 0.6 - 0.3 * Math.sin(pulseElapsed * PULSE_SPEED);
      }
    };

    // Add animation to ticker
    app.ticker.add(animate);

    return () => {
      app.ticker.remove(animate);
    };
  }, [app, overlayLayer, dragState, uniqueId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isDestroyedRef.current = true;
      if (containerRef.current) {
        containerRef.current.destroy({ children: true });
        containerRef.current = null;
      }
    };
  }, []);

  // This component renders to PixiJS canvas, not DOM
  return null;
}
