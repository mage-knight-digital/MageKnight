/**
 * ManaSourceOverlay - Displays mana source dice in a corner of the game board
 *
 * Shows the shared mana dice pool that all players can see.
 * Positioned in the top-right corner of the hex grid area.
 * Animates dice when they are rerolled (color changes).
 *
 * Intro animation: The overlay slides in from the right, then dice "cast"
 * onto the tray one by one with a satisfying bounce.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  useGameIntro,
  UI_REVEAL_TIMING,
} from "../../contexts/GameIntroContext";
import { useAnimationDispatcher } from "../../contexts/AnimationDispatcherContext";
import {
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  USE_MANA_DIE_ACTION,
  BASIC_MANA_COLORS,
} from "@mage-knight/shared";
import type { ManaColor, BasicManaColor, AvailableDie } from "@mage-knight/shared";
import "./ManaSourceOverlay.css";

function getManaIconUrl(color: string): string {
  const colorMap: Record<string, string> = {
    [MANA_RED]: "red",
    [MANA_BLUE]: "blue",
    [MANA_GREEN]: "green",
    [MANA_WHITE]: "white",
    [MANA_GOLD]: "gold",
    [MANA_BLACK]: "black",
  };
  const colorName = colorMap[color] || "white";
  return `/assets/mana_icons/glossy/${colorName}.png`;
}

// Animation durations must match CSS
const ROLL_ANIMATION_MS = 700;
const TAKEN_ANIMATION_MS = 400;
// Stagger delay between dice
const STAGGER_DELAY_MS = 80;

export function ManaSourceOverlay() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { shouldRevealManaSource, isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();

  // Color picker state for multi-color dice (gold/black)
  const [colorPickerDieId, setColorPickerDieId] = useState<string | null>(null);

  // Track intro animation state
  // Always start hidden - will reveal after intro completes
  const [introAnimState, setIntroAnimState] = useState<
    "hidden" | "revealing" | "visible"
  >("hidden");

  // Track if we've animated in already
  const hasAnimatedRef = useRef(false);

  // Track which dice are currently animating
  const [rollingDieIds, setRollingDieIds] = useState<Set<string>>(new Set());
  const [takenDieIds, setTakenDieIds] = useState<Set<string>>(new Set());

  // Track previous dice state to detect changes
  const prevDiceColorsRef = useRef<Map<string, string>>(new Map());
  const prevTakenByRef = useRef<Map<string, string | null>>(new Map());

  // Trigger reveal animation when shouldRevealManaSource becomes true
  useEffect(() => {
    if (shouldRevealManaSource && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;

      // Calculate total animation time including dice stagger
      const diceCount = state?.source.dice.length ?? 0;
      const totalDiceStagger = diceCount * STAGGER_DELAY_MS;
      const totalAnimTime =
        UI_REVEAL_TIMING.manaSource.delay +
        UI_REVEAL_TIMING.manaSource.duration +
        totalDiceStagger;

      // Start the reveal animation
      const revealTimer = setTimeout(() => {
        setIntroAnimState("revealing");
      }, UI_REVEAL_TIMING.manaSource.delay);

      const visibleTimer = setTimeout(() => {
        setIntroAnimState("visible");
      }, UI_REVEAL_TIMING.manaSource.delay + UI_REVEAL_TIMING.manaSource.duration);

      // Emit completion event after all dice have animated in
      const completeTimer = setTimeout(() => {
        emitAnimationEvent("mana-source-complete");
      }, totalAnimTime);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(visibleTimer);
        clearTimeout(completeTimer);
      };
    }
  }, [shouldRevealManaSource, state?.source.dice.length, emitAnimationEvent]);

  // If intro is already complete on mount (e.g., hot reload), show immediately
  useEffect(() => {
    if (isIntroComplete && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setIntroAnimState("visible");
    }
  }, [isIntroComplete]);

  // Detect dice color changes and trigger roll animation
  useEffect(() => {
    if (!state?.source.dice) return;

    const prevColors = prevDiceColorsRef.current;
    const changedDieIds: string[] = [];

    // Find dice whose colors changed
    for (const die of state.source.dice) {
      const prevColor = prevColors.get(die.id);
      if (prevColor !== undefined && prevColor !== die.color) {
        changedDieIds.push(die.id);
      }
    }

    // Update ref with current colors
    const newColors = new Map<string, string>();
    for (const die of state.source.dice) {
      newColors.set(die.id, die.color);
    }
    prevDiceColorsRef.current = newColors;

    // Trigger animation for changed dice
    if (changedDieIds.length > 0) {
      setRollingDieIds(new Set(changedDieIds));

      // Clear animation after it completes (with stagger time)
      const totalDuration =
        ROLL_ANIMATION_MS + changedDieIds.length * STAGGER_DELAY_MS;
      const timeout = setTimeout(() => {
        setRollingDieIds(new Set());
      }, totalDuration);

      return () => clearTimeout(timeout);
    }
  }, [state?.source.dice]);

  // Detect when dice are taken (used) and trigger taken animation
  useEffect(() => {
    if (!state?.source.dice) return;

    const prevTakenBy = prevTakenByRef.current;
    const newlyTakenDieIds: string[] = [];

    // Find dice that just got taken (went from null to a playerId)
    for (const die of state.source.dice) {
      const prevTaken = prevTakenBy.get(die.id);
      if (prevTaken === null && die.takenByPlayerId !== null) {
        newlyTakenDieIds.push(die.id);
      }
    }

    // Update ref with current taken state
    const newTakenBy = new Map<string, string | null>();
    for (const die of state.source.dice) {
      newTakenBy.set(die.id, die.takenByPlayerId);
    }
    prevTakenByRef.current = newTakenBy;

    // Trigger animation for newly taken dice
    if (newlyTakenDieIds.length > 0) {
      setTakenDieIds(new Set(newlyTakenDieIds));

      const timeout = setTimeout(() => {
        setTakenDieIds(new Set());
      }, TAKEN_ANIMATION_MS);

      return () => clearTimeout(timeout);
    }
  }, [state?.source.dice]);

  // Get available dice from validActions (memoized to avoid re-creating on every render)
  const availableDice: readonly AvailableDie[] = useMemo(() =>
    state?.validActions && "mana" in state.validActions
      ? state.validActions.mana.availableDice
      : [],
    [state?.validActions],
  );

  const handleDieClick = useCallback((dieId: string, dieColor: ManaColor) => {
    // Find this die in available dice
    const available = availableDice.find((d) => d.dieId === dieId);
    if (!available) return;

    // Basic color dice: use directly
    const isBasic = (BASIC_MANA_COLORS as readonly string[]).includes(dieColor);
    if (isBasic) {
      sendAction({ type: USE_MANA_DIE_ACTION, dieId, color: dieColor as BasicManaColor });
      setColorPickerDieId(null);
      return;
    }

    // Gold or black dice can produce multiple colors - show picker
    setColorPickerDieId(dieId);
  }, [availableDice, sendAction]);

  const handleColorPickerSelect = useCallback((color: ManaColor) => {
    if (!colorPickerDieId) return;
    sendAction({ type: USE_MANA_DIE_ACTION, dieId: colorPickerDieId, color });
    setColorPickerDieId(null);
  }, [colorPickerDieId, sendAction]);

  if (!state) return null;

  const myId = player?.id;

  // Calculate stagger index for each rolling die
  const rollingDieArray = Array.from(rollingDieIds);

  // Build overlay class names based on intro animation state
  const overlayClassNames = [
    "mana-source-overlay",
    introAnimState === "hidden" && "mana-source-overlay--intro-hidden",
    introAnimState === "revealing" && "mana-source-overlay--intro-reveal",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={overlayClassNames} data-testid="mana-source-overlay">
      <div className="mana-source-overlay__label">Source</div>
      <div className="mana-source-overlay__dice">
        {state.source.dice.map((die) => {
          const isTakenByMe = die.takenByPlayerId === myId;
          const isTakenByOther = die.takenByPlayerId !== null && !isTakenByMe;
          const isStolen = die.isStolenByTactic;
          const isStolenByMe = isStolen && isTakenByMe;
          const isStolenByOther = isStolen && isTakenByOther;
          // Stolen dice get different treatment than normally used dice
          const isUnavailable =
            die.isDepleted || isTakenByMe || isTakenByOther;
          const isRolling = rollingDieIds.has(die.id);
          const isTakenAnimating = takenDieIds.has(die.id);
          const staggerIndex = rollingDieArray.indexOf(die.id);
          const staggerDelay =
            staggerIndex >= 0 ? staggerIndex * STAGGER_DELAY_MS : 0;

          // Check if this die is available to click
          const isClickable = availableDice.some((d) => d.dieId === die.id);

          const classNames = [
            "mana-source-overlay__die",
            // Stolen dice get distinct "stolen" styling instead of generic "unavailable"
            isStolen
              ? "mana-source-overlay__die--stolen"
              : isUnavailable && "mana-source-overlay__die--unavailable",
            isRolling && "mana-source-overlay__die--rolling",
            isTakenAnimating && "mana-source-overlay__die--taken",
            isClickable && "mana-source-overlay__die--clickable",
          ]
            .filter(Boolean)
            .join(" ");

          // Build tooltip text based on die state
          let titleText: string = die.color;
          if (die.isDepleted) {
            titleText = `${die.color} (depleted)`;
          } else if (isStolenByMe) {
            titleText = `${die.color} (stolen by you - on tactic card)`;
          } else if (isStolenByOther) {
            titleText = `${die.color} (stolen by another player)`;
          } else if (isTakenByMe) {
            titleText = `${die.color} (used by you)`;
          } else if (isTakenByOther) {
            titleText = `${die.color} (taken)`;
          } else if (isClickable) {
            titleText = `Click to use ${die.color} mana`;
          }

          return (
            <div
              key={die.id}
              className={classNames}
              data-testid="mana-die"
              style={
                isRolling ? { animationDelay: `${staggerDelay}ms` } : undefined
              }
              title={titleText}
              onClick={isClickable ? () => handleDieClick(die.id, die.color) : undefined}
              role={isClickable ? "button" : undefined}
              tabIndex={isClickable ? 0 : undefined}
              onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") handleDieClick(die.id, die.color); } : undefined}
            >
              <img
                src={getManaIconUrl(die.color)}
                alt={die.color}
                className="mana-source-overlay__die-icon"
                style={
                  isRolling
                    ? { animationDelay: `${staggerDelay}ms` }
                    : undefined
                }
              />
              {isStolen && (
                <span className="mana-source-overlay__die-badge" title="On tactic card">
                  📜
                </span>
              )}
              {/* Color picker popup for gold/black dice */}
              {colorPickerDieId === die.id && (
                <div className="mana-source-overlay__color-picker">
                  {[MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE].map((color) => (
                    <button
                      key={color}
                      className={`mana-source-overlay__color-option mana-source-overlay__color-option--${color}`}
                      onClick={(e) => { e.stopPropagation(); handleColorPickerSelect(color); }}
                      title={color}
                      type="button"
                    >
                      <img src={getManaIconUrl(color)} alt={color} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
