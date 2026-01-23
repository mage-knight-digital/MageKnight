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

import { useState, useEffect, useRef } from "react";
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
} from "@mage-knight/shared";

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
  const { state } = useGame();
  const player = useMyPlayer();
  const { shouldRevealManaSource, isIntroComplete } = useGameIntro();
  const { emit: emitAnimationEvent } = useAnimationDispatcher();

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
    <div className={overlayClassNames}>
      <div className="mana-source-overlay__label">Source</div>
      <div className="mana-source-overlay__dice">
        {state.source.dice.map((die) => {
          const isTakenByMe = die.takenByPlayerId === myId;
          const isTakenByOther = die.takenByPlayerId !== null && !isTakenByMe;
          const isUnavailable = die.isDepleted || isTakenByMe || isTakenByOther;
          const isRolling = rollingDieIds.has(die.id);
          const isTakenAnimating = takenDieIds.has(die.id);
          const staggerIndex = rollingDieArray.indexOf(die.id);
          const staggerDelay =
            staggerIndex >= 0 ? staggerIndex * STAGGER_DELAY_MS : 0;

          const classNames = [
            "mana-source-overlay__die",
            isUnavailable && "mana-source-overlay__die--unavailable",
            isRolling && "mana-source-overlay__die--rolling",
            isTakenAnimating && "mana-source-overlay__die--taken",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={die.id}
              className={classNames}
              style={
                isRolling ? { animationDelay: `${staggerDelay}ms` } : undefined
              }
              title={
                die.isDepleted
                  ? `${die.color} (depleted)`
                  : isTakenByMe
                    ? `${die.color} (used by you)`
                    : isTakenByOther
                      ? `${die.color} (taken)`
                      : die.color
              }
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
