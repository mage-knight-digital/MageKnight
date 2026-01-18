import { useEffect, useState, useRef } from "react";
import {
  END_TURN_ACTION,
  UNDO_ACTION,
  ACTIVATE_TACTIC_ACTION,
  TACTIC_THE_RIGHT_MOMENT,
  TACTIC_LONG_NIGHT,
  TACTIC_MIDNIGHT_MEDITATION,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import {
  useGameIntro,
  UI_REVEAL_TIMING,
} from "../../contexts/GameIntroContext";
import "./TurnActions.css";

export function TurnActions() {
  const { state, sendAction } = useGame();
  const player = useMyPlayer();
  const { phase, isIntroComplete } = useGameIntro();

  const isMyTurn = state?.currentPlayerId === player?.id;
  // Must check player exists AND has a tactic (not null/undefined)
  const hasTactic = player != null && player.selectedTacticId != null;

  // End turn seal should only appear after a tactic is selected
  // - "hidden": No tactic selected yet, or intro is running
  // - "revealing": Tactic just selected, animating in
  // - "visible": Fully visible
  // Always start hidden - the useEffect will reveal when appropriate
  const [sealAnimState, setSealAnimState] = useState<
    "hidden" | "revealing" | "visible"
  >("hidden");

  // Track if we've already animated in (to avoid re-animating)
  const hasAnimatedRef = useRef(false);

  // Reveal with animation when tactic is selected (after intro)
  useEffect(() => {
    // Don't animate if intro is still running
    if (!isIntroComplete) return;
    // Don't animate if no tactic selected
    if (!hasTactic) return;
    // Don't re-animate if we've already shown it
    if (hasAnimatedRef.current) return;

    hasAnimatedRef.current = true;

    // Animate in
    setSealAnimState("revealing");

    const visibleTimer = setTimeout(() => {
      setSealAnimState("visible");
    }, UI_REVEAL_TIMING.endTurnSeal.duration);

    return () => clearTimeout(visibleTimer);
  }, [hasTactic, isIntroComplete]);

  // If tactic is already selected on mount (e.g., hot reload), show immediately
  useEffect(() => {
    if (hasTactic && isIntroComplete) {
      hasAnimatedRef.current = true;
      setSealAnimState("visible");
    }
  }, []);
  const canUndo = state?.validActions.turn?.canUndo ?? false;

  // Check for activatable tactics
  const canActivate = state?.validActions.tacticEffects?.canActivate;
  const canActivateTheRightMoment = canActivate?.theRightMoment === true;
  const canActivateLongNight = canActivate?.longNight === true;
  const canActivateMidnightMeditation = canActivate?.midnightMeditation === true;

  // Ctrl+Z / Cmd+Z keyboard shortcut for undo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (canUndo && isMyTurn) {
          sendAction({ type: UNDO_ACTION });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [canUndo, isMyTurn, sendAction]);

  if (!state || !player) return null;

  const handleEndTurn = () => {
    sendAction({ type: END_TURN_ACTION });
  };

  const handleUndo = () => {
    sendAction({ type: UNDO_ACTION });
  };

  const handleActivateTheRightMoment = () => {
    sendAction({
      type: ACTIVATE_TACTIC_ACTION,
      tacticId: TACTIC_THE_RIGHT_MOMENT,
    });
  };

  const handleActivateLongNight = () => {
    sendAction({ type: ACTIVATE_TACTIC_ACTION, tacticId: TACTIC_LONG_NIGHT });
  };

  const handleActivateMidnightMeditation = () => {
    sendAction({
      type: ACTIVATE_TACTIC_ACTION,
      tacticId: TACTIC_MIDNIGHT_MEDITATION,
    });
  };

  // Build seal class names based on intro animation state
  const sealClassNames = [
    "end-turn-seal",
    sealAnimState === "revealing" && "end-turn-seal--intro-reveal",
  ]
    .filter(Boolean)
    .join(" ");

  // Don't render the seal at all until we're ready to show it
  const showSeal = sealAnimState !== "hidden";

  return (
    <>
      {/* End Turn - fixed bottom left, styled like a seal/sigil */}
      {/* Only render after tactic is selected */}
      {showSeal && (
        <button
          className={sealClassNames}
          onClick={handleEndTurn}
          disabled={!isMyTurn || !hasTactic}
          type="button"
          data-testid="end-turn-btn"
          title="End your turn"
        >
          <span className="end-turn-seal__icon">⚔</span>
          <span className="end-turn-seal__text">End Turn</span>
        </button>
      )}

      {/* Other actions - right side - only show after tactic selected */}
      {showSeal && (
        <div className="turn-actions">
          {/* Tactic buttons */}
          {canActivateTheRightMoment && (
            <button
              className="turn-actions__btn turn-actions__btn--tactic"
              onClick={handleActivateTheRightMoment}
              type="button"
              title="Take another turn after this one"
            >
              Right Moment
            </button>
          )}
          {canActivateLongNight && (
            <button
              className="turn-actions__btn turn-actions__btn--tactic-dark"
              onClick={handleActivateLongNight}
              type="button"
              title="Shuffle discard, put 3 cards back in deck"
            >
              Long Night
            </button>
          )}
          {canActivateMidnightMeditation && (
            <button
              className="turn-actions__btn turn-actions__btn--tactic-dark"
              onClick={handleActivateMidnightMeditation}
              type="button"
              title="Shuffle hand cards into deck, draw same amount"
            >
              Meditation
            </button>
          )}

          {/* Undo button */}
          <button
            className="turn-actions__btn turn-actions__btn--undo"
            onClick={handleUndo}
            disabled={!isMyTurn || !canUndo}
            type="button"
            title="Undo last action (Ctrl+Z)"
            data-testid="undo-btn"
          >
            ↩
          </button>
        </div>
      )}
    </>
  );
}
