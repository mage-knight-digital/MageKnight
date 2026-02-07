import { useState, useEffect, useRef } from "react";
import { useGameIntro, UI_REVEAL_TIMING } from "../../contexts/GameIntroContext";
import "./DeckDiscardIndicator.css";

interface DeckDiscardIndicatorProps {
  deckCount: number;
  discardCount: number;
  isHidden: boolean;
}

export function DeckDiscardIndicator({ deckCount, discardCount, isHidden }: DeckDiscardIndicatorProps) {
  const { shouldRevealUI, isIntroComplete } = useGameIntro();

  // Track intro animation state for the deck/discard
  // Always start hidden - will reveal after intro completes
  const [introAnimState, setIntroAnimState] = useState<"hidden" | "revealing" | "visible">("hidden");

  // Track if we've animated in already
  const hasAnimatedRef = useRef(false);

  // Trigger reveal animation when shouldRevealUI becomes true
  useEffect(() => {
    if (shouldRevealUI && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;

      // Start reveal after the configured delay (deck comes in last)
      const revealTimer = setTimeout(() => {
        setIntroAnimState("revealing");
      }, UI_REVEAL_TIMING.deckDiscard.delay);

      // Transition to visible after animation completes
      const visibleTimer = setTimeout(() => {
        setIntroAnimState("visible");
      }, UI_REVEAL_TIMING.deckDiscard.delay + UI_REVEAL_TIMING.deckDiscard.duration);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(visibleTimer);
      };
    }
  }, [shouldRevealUI]);

  // If intro is already complete on mount (e.g., hot reload), show immediately
  useEffect(() => {
    if (isIntroComplete && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setIntroAnimState("visible");
    }
  }, [isIntroComplete]);

  const className = [
    "floating-hand__deck-discard",
    isHidden && "floating-hand__deck-discard--hidden",
    introAnimState === "hidden" && "floating-hand__deck-discard--intro-hidden",
    introAnimState === "revealing" && "floating-hand__deck-discard--intro-reveal",
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      <div className="floating-hand__deck" title={`${deckCount} cards in deck`}>
        <img
          src="/assets/atlas/cards/card_back.jpg"
          alt="Deck"
          className="floating-hand__deck-image"
        />
        <span className="floating-hand__deck-count">{deckCount}</span>
      </div>
      <div className="floating-hand__discard" title={`${discardCount} cards in discard`}>
        <div className="floating-hand__discard-pile" />
        <span className="floating-hand__discard-count">{discardCount}</span>
      </div>
    </div>
  );
}
