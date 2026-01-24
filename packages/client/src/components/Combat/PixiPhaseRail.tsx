/**
 * PixiPhaseRail - PixiJS-based combat phase indicator
 *
 * Renders the combat phase rail using PixiJS instead of HTML/CSS.
 * Shows combat flow: Ranged -> Block -> Damage -> Attack
 *
 * Features:
 * - Phase icons with active/completed/upcoming states
 * - Instruction text for current phase
 * - Action button with hover effects
 * - Warning message when damage must be resolved
 */

import { useEffect, useRef, useId, useCallback } from "react";
import { Container, Graphics, Text } from "pixi.js";
import {
  COMBAT_PHASE_RANGED_SIEGE,
  COMBAT_PHASE_BLOCK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
  COMBAT_PHASE_ATTACK,
  type CombatPhase,
} from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";

// Phase rail sits above the combat background but below hand cards
const PHASE_RAIL_Z_INDEX = 10;

// Colors matching CSS
const COLORS = {
  // Text colors
  INSTRUCTION: 0xd4a574, // Antique gold
  LABEL_ACTIVE: 0xe8e0d0, // Light parchment
  LABEL_COMPLETED: 0x5a8a70, // Verdigris/moss
  LABEL_UPCOMING: 0x444444, // Dim gray

  // Button colors
  BUTTON_BG: 0x3d3528, // Warm brown
  BUTTON_BORDER: 0xd4a574, // Antique gold
  BUTTON_HOVER_BG: 0x4b4130,
  BUTTON_DISABLED: 0x333333,

  // Ready pulse (verdigris)
  READY_GLOW: 0x5a8a70,

  // Warning
  WARNING_TEXT: 0xc06040, // Deep crimson
  WARNING_BG: 0x1a1d2e,
  WARNING_BORDER: 0xa04030,

  // Phase glow
  ACTIVE_GLOW: 0xb87333, // Bronze
};

// Phase definitions
const PHASES: { id: CombatPhase; label: string; icon: string; instruction: string }[] = [
  {
    id: COMBAT_PHASE_RANGED_SIEGE,
    label: "Ranged",
    icon: "\u{1F3F9}", // Bow and arrow emoji
    instruction: "Strike from afar before enemies close in",
  },
  {
    id: COMBAT_PHASE_BLOCK,
    label: "Block",
    icon: "\u{1F6E1}", // Shield emoji
    instruction: "Defend against enemy attacks",
  },
  {
    id: COMBAT_PHASE_ASSIGN_DAMAGE,
    label: "Damage",
    icon: "\u{1F480}", // Skull emoji
    instruction: "Unblocked enemies deal damage",
  },
  {
    id: COMBAT_PHASE_ATTACK,
    label: "Attack",
    icon: "\u{2694}", // Crossed swords emoji
    instruction: "Finish off remaining enemies",
  },
];

interface PixiPhaseRailProps {
  currentPhase: CombatPhase;
  canEndPhase: boolean;
  onEndPhase: () => void;
  allEnemiesDefeatable?: boolean;
}

export function PixiPhaseRail({
  currentPhase,
  canEndPhase,
  onEndPhase,
  allEnemiesDefeatable = false,
}: PixiPhaseRailProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const buttonRef = useRef<Graphics | null>(null);
  const isDestroyedRef = useRef(false);

  // Stable callback ref for onEndPhase
  const onEndPhaseRef = useRef(onEndPhase);
  onEndPhaseRef.current = onEndPhase;

  const currentIndex = PHASES.findIndex((p) => p.id === currentPhase);
  const isLastPhase = currentPhase === COMBAT_PHASE_ATTACK;
  const activePhase = PHASES.find((p) => p.id === currentPhase);
  const showReadyPulse = allEnemiesDefeatable && canEndPhase;
  const showWarning = !canEndPhase && currentPhase === COMBAT_PHASE_ASSIGN_DAMAGE;

  // Calculate sizes based on viewport
  const getSizes = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const vmin = Math.min(vw, vh);

    return {
      padding: Math.max(16, vw * 0.02),
      iconSize: Math.max(40, vmin * 0.05),
      labelFontSize: Math.max(10, vmin * 0.012),
      instructionFontSize: Math.max(11, vmin * 0.013),
      buttonSize: Math.max(48, vmin * 0.06),
      buttonFontSize: Math.max(24, vmin * 0.03),
      finishButtonPadding: Math.max(12, vmin * 0.015),
      finishFontSize: Math.max(12, vmin * 0.014),
      phaseGap: Math.max(8, vh * 0.01),
      sectionGap: Math.max(16, vh * 0.02),
    };
  }, []);

  // Build the phase rail
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;

    const sizes = getSizes();

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `phase-rail-${uniqueId}`;
    rootContainer.zIndex = PHASE_RAIL_Z_INDEX;
    rootContainer.sortableChildren = true;

    overlayLayer.sortableChildren = true;
    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    let yOffset = 0;

    // === Instruction Text ===
    if (activePhase) {
      const instruction = new Text({
        text: activePhase.instruction,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: sizes.instructionFontSize,
          fontStyle: "italic",
          fontWeight: "500",
          fill: COLORS.INSTRUCTION,
          align: "center",
          wordWrap: true,
          wordWrapWidth: 150,
        },
      });
      instruction.anchor.set(0.5, 0);
      instruction.x = sizes.padding + 60;
      instruction.y = yOffset;
      instruction.alpha = 0;
      rootContainer.addChild(instruction);

      // Fade in instruction
      animManager.animate("instruction-fade", instruction, {
        endAlpha: 0.9,
        duration: 400,
        easing: Easing.easeOutQuad,
      });

      yOffset += instruction.height + sizes.sectionGap;
    }

    // === Phase Markers ===
    PHASES.forEach((phase, index) => {
      const isActive = phase.id === currentPhase;
      const isCompleted = index < currentIndex;

      const phaseContainer = new Container();
      phaseContainer.x = sizes.padding + 60;
      phaseContainer.y = yOffset;

      // Icon
      const icon = new Text({
        text: isCompleted ? "\u2713" : phase.icon, // Checkmark for completed
        style: {
          fontFamily: "Arial, Segoe UI Emoji, sans-serif",
          fontSize: sizes.iconSize * 0.6,
          fill: isCompleted ? COLORS.LABEL_COMPLETED : isActive ? 0xffffff : COLORS.LABEL_UPCOMING,
          align: "center",
        },
      });
      icon.anchor.set(0.5);
      icon.alpha = isActive ? 1 : isCompleted ? 0.6 : 0.25;
      phaseContainer.addChild(icon);

      // Label
      const label = new Text({
        text: phase.label,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: sizes.labelFontSize,
          fontWeight: "600",
          fill: isCompleted ? COLORS.LABEL_COMPLETED : isActive ? COLORS.LABEL_ACTIVE : COLORS.LABEL_UPCOMING,
          align: "center",
        },
      });
      label.anchor.set(0.5, 0);
      label.y = sizes.iconSize * 0.4;
      label.alpha = isActive ? 0.9 : isCompleted ? 0.6 : 0.2;
      phaseContainer.addChild(label);

      // Active glow effect
      if (isActive) {
        const glow = new Graphics();
        glow.circle(0, 0, sizes.iconSize * 0.5);
        glow.fill({ color: COLORS.ACTIVE_GLOW, alpha: 0.3 });
        glow.zIndex = -1;
        phaseContainer.addChild(glow);

        // Pulse animation for active phase
        const pulseGlow = () => {
          if (isDestroyedRef.current || !glow.parent) return;
          animManager.animate(`glow-pulse-${index}`, glow, {
            endScale: 1.3,
            endAlpha: 0.15,
            duration: 1000,
            easing: Easing.easeInOutQuad,
            onComplete: () => {
              if (isDestroyedRef.current || !glow.parent) return;
              animManager.animate(`glow-pulse-back-${index}`, glow, {
                endScale: 1,
                endAlpha: 0.3,
                duration: 1000,
                easing: Easing.easeInOutQuad,
                onComplete: pulseGlow,
              });
            },
          });
        };
        pulseGlow();

        // Scale up active phase
        phaseContainer.scale.set(1.15);
      }

      // Entry animation
      phaseContainer.alpha = 0;
      phaseContainer.scale.set(isActive ? 1.15 * 0.8 : 0.8);
      setTimeout(() => {
        if (isDestroyedRef.current || !phaseContainer.parent) return;
        animManager.animate(`phase-entry-${index}`, phaseContainer, {
          endAlpha: 1,
          endScale: isActive ? 1.15 : 1,
          duration: 300,
          easing: Easing.easeOutBack,
        });
      }, 100 + index * 50);

      rootContainer.addChild(phaseContainer);
      yOffset += sizes.iconSize + sizes.labelFontSize + sizes.phaseGap;
    });

    yOffset += sizes.sectionGap;

    // === Action Button ===
    const buttonContainer = new Container();
    buttonContainer.x = sizes.padding + 60;
    buttonContainer.y = yOffset;

    const button = new Graphics();
    buttonRef.current = button;

    const drawButton = (hover = false) => {
      button.clear();

      if (isLastPhase) {
        // "End Combat" button - rounded rectangle
        const width = 100;
        const height = 40;
        button.roundRect(-width / 2, -height / 2, width, height, 4);

        if (!canEndPhase) {
          button.fill({ color: COLORS.BUTTON_DISABLED, alpha: 0.5 });
          button.stroke({ color: COLORS.BUTTON_DISABLED, width: 2 });
        } else if (showReadyPulse) {
          button.fill({ color: hover ? COLORS.BUTTON_HOVER_BG : COLORS.BUTTON_BG, alpha: 0.9 });
          button.stroke({ color: COLORS.READY_GLOW, width: 2 });
        } else {
          button.fill({ color: hover ? COLORS.BUTTON_HOVER_BG : COLORS.BUTTON_BG, alpha: 0.9 });
          button.stroke({ color: COLORS.BUTTON_BORDER, width: 2 });
        }
      } else {
        // Arrow button - circle
        button.circle(0, 0, sizes.buttonSize / 2);

        if (!canEndPhase) {
          button.fill({ color: 0x111111, alpha: 0.5 });
          button.stroke({ color: COLORS.BUTTON_DISABLED, width: 2 });
        } else if (showReadyPulse) {
          button.fill({ color: hover ? 0x222222 : 0x111111, alpha: 0.8 });
          button.stroke({ color: COLORS.READY_GLOW, width: 2 });
        } else {
          button.fill({ color: hover ? 0x222222 : 0x111111, alpha: 0.8 });
          button.stroke({ color: 0x555555, width: 2 });
        }
      }
    };

    drawButton();
    buttonContainer.addChild(button);

    // Button label
    const buttonLabel = new Text({
      text: isLastPhase ? "End Combat" : "\u2192", // Right arrow
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: isLastPhase ? sizes.finishFontSize : sizes.buttonFontSize,
        fontWeight: isLastPhase ? "700" : "400",
        fill: canEndPhase ? (isLastPhase ? COLORS.BUTTON_BORDER : 0xcccccc) : 0x666666,
        align: "center",
        letterSpacing: isLastPhase ? 1 : 0,
      },
    });
    buttonLabel.anchor.set(0.5);
    buttonContainer.addChild(buttonLabel);

    // Button interactivity
    if (canEndPhase) {
      button.eventMode = "static";
      button.cursor = "pointer";

      button.on("pointerenter", () => {
        if (isDestroyedRef.current) return;
        drawButton(true);
        animManager.animate("button-hover", buttonContainer, {
          endScale: 1.1,
          duration: 100,
          easing: Easing.easeOutQuad,
        });
      });

      button.on("pointerleave", () => {
        if (isDestroyedRef.current) return;
        drawButton(false);
        animManager.animate("button-hover", buttonContainer, {
          endScale: 1,
          duration: 100,
          easing: Easing.easeOutQuad,
        });
      });

      button.on("pointertap", () => {
        if (isDestroyedRef.current) return;
        animManager.animate("button-click", buttonContainer, {
          endScale: 0.95,
          duration: 50,
          easing: Easing.easeOutQuad,
          onComplete: () => {
            onEndPhaseRef.current();
          },
        });
      });

      // Ready pulse animation
      if (showReadyPulse) {
        const pulseButton = () => {
          if (isDestroyedRef.current || !buttonContainer.parent) return;
          animManager.animate("ready-pulse", buttonContainer, {
            endScale: 1.08,
            duration: 500,
            easing: Easing.easeInOutQuad,
            onComplete: () => {
              if (isDestroyedRef.current || !buttonContainer.parent) return;
              animManager.animate("ready-pulse-back", buttonContainer, {
                endScale: 1,
                duration: 500,
                easing: Easing.easeInOutQuad,
                onComplete: pulseButton,
              });
            },
          });
        };
        pulseButton();
      }
    } else {
      button.eventMode = "none";
      buttonContainer.alpha = 0.3;
    }

    // Entry animation for button
    buttonContainer.alpha = 0;
    setTimeout(() => {
      if (isDestroyedRef.current || !buttonContainer.parent) return;
      animManager.animate("button-entry", buttonContainer, {
        endAlpha: canEndPhase ? 1 : 0.3,
        duration: 300,
        easing: Easing.easeOutQuad,
      });
    }, 300);

    rootContainer.addChild(buttonContainer);
    yOffset += isLastPhase ? 50 : sizes.buttonSize + sizes.sectionGap;

    // === Warning Message ===
    if (showWarning) {
      const warningContainer = new Container();
      warningContainer.x = sizes.padding + 60;
      warningContainer.y = yOffset;

      const warningBg = new Graphics();
      const warningWidth = 100;
      const warningHeight = 24;
      warningBg.roundRect(-warningWidth / 2, -warningHeight / 2, warningWidth, warningHeight, 3);
      warningBg.fill({ color: COLORS.WARNING_BG, alpha: 0.8 });
      warningBg.stroke({ color: COLORS.WARNING_BORDER, width: 1, alpha: 0.35 });
      warningContainer.addChild(warningBg);

      const warningText = new Text({
        text: "Resolve damage",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 10,
          fontWeight: "600",
          fill: COLORS.WARNING_TEXT,
          align: "center",
        },
      });
      warningText.anchor.set(0.5);
      warningContainer.addChild(warningText);

      rootContainer.addChild(warningContainer);
    }

    // Position rail on left side, vertically centered
    const totalHeight = yOffset;
    rootContainer.x = 0;
    rootContainer.y = (app.screen.height - totalHeight) / 2;

    // Handle resize
    const handleResize = () => {
      if (isDestroyedRef.current || !app || !rootContainer.parent) return;
      rootContainer.y = (app.screen.height - totalHeight) / 2;
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

      buttonRef.current = null;
    };
  }, [app, overlayLayer, uniqueId, currentPhase, canEndPhase, isLastPhase, activePhase, currentIndex, showReadyPulse, showWarning, getSizes]);

  return null;
}
