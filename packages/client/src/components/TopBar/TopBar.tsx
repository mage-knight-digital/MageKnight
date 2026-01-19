import { useState, useEffect, useRef } from "react";
import { TIME_OF_DAY_DAY, TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro, UI_REVEAL_TIMING } from "../../contexts/GameIntroContext";
import { HotkeyHelp } from "./HotkeyHelp";
import "./TopBar.css";

export function TopBar() {
  const { state } = useGame();
  const player = useMyPlayer();
  const { shouldRevealUI, isIntroComplete } = useGameIntro();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Track intro animation state - start hidden
  const [introAnimState, setIntroAnimState] = useState<"hidden" | "revealing" | "visible">("hidden");
  const hasAnimatedRef = useRef(false);

  // Trigger reveal animation when shouldRevealUI becomes true
  useEffect(() => {
    if (shouldRevealUI && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;

      const revealTimer = setTimeout(() => {
        setIntroAnimState("revealing");
      }, UI_REVEAL_TIMING.topBar.delay);

      const visibleTimer = setTimeout(() => {
        setIntroAnimState("visible");
      }, UI_REVEAL_TIMING.topBar.delay + UI_REVEAL_TIMING.topBar.duration);

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

  if (!state || !player) return null;

  // Don't render until ready to show
  if (introAnimState === "hidden") return null;

  // Calculate fame needed for next level
  const fameThresholds = [0, 3, 8, 15, 24, 35, 48, 63, 80, 99, 999];
  const nextLevelFame = fameThresholds[player.level] ?? 999;

  const isNight = state.timeOfDay === TIME_OF_DAY_NIGHT;

  const topBarClassNames = [
    "top-bar",
    introAnimState === "revealing" && "top-bar--intro-reveal",
  ].filter(Boolean).join(" ");

  return (
    <div className={topBarClassNames}>
      {/* Left section: Hero identity */}
      <div className="top-bar__section top-bar__section--left">
        <div className="top-bar__hero">
          <span className="top-bar__hero-name">{player.heroId}</span>
        </div>

        <div className="top-bar__stat" title="Level">
          <span className="top-bar__icon top-bar__icon--level">⬡</span>
          <span className="top-bar__value">{player.level}</span>
        </div>

        <div className="top-bar__stat" title={`Fame: ${player.fame} / ${nextLevelFame} to next level`}>
          <span className="top-bar__icon top-bar__icon--fame">★</span>
          <span className="top-bar__value">{player.fame}/{nextLevelFame}</span>
        </div>

        <div className="top-bar__stat" title="Armor">
          <span className="top-bar__icon top-bar__icon--armor">🛡</span>
          <span className="top-bar__value">{player.armor}</span>
        </div>

        <div className="top-bar__stat" title="Reputation">
          <span className="top-bar__icon top-bar__icon--reputation">⚖</span>
          <span className="top-bar__value">{player.reputation}</span>
        </div>

        <div className="top-bar__divider" />

        <div className="top-bar__stat top-bar__stat--move" title="Move Points">
          <span className="top-bar__icon top-bar__icon--move">→</span>
          <span className="top-bar__value">{player.movePoints}</span>
        </div>

        <div className="top-bar__stat top-bar__stat--influence" title="Influence Points">
          <span className="top-bar__icon top-bar__icon--influence">♦</span>
          <span className="top-bar__value">{player.influencePoints}</span>
        </div>
      </div>

      {/* Center section: Mana */}
      <div className="top-bar__section top-bar__section--center">
        <div className="top-bar__mana-group" title="Mana Crystals">
          {player.crystals.red > 0 && (
            <span className="top-bar__crystal top-bar__crystal--red" title="Red Crystal">
              {player.crystals.red}
            </span>
          )}
          {player.crystals.blue > 0 && (
            <span className="top-bar__crystal top-bar__crystal--blue" title="Blue Crystal">
              {player.crystals.blue}
            </span>
          )}
          {player.crystals.green > 0 && (
            <span className="top-bar__crystal top-bar__crystal--green" title="Green Crystal">
              {player.crystals.green}
            </span>
          )}
          {player.crystals.white > 0 && (
            <span className="top-bar__crystal top-bar__crystal--white" title="White Crystal">
              {player.crystals.white}
            </span>
          )}
        </div>

        {player.pureMana.length > 0 && (
          <div className="top-bar__mana-group top-bar__mana-group--tokens" title="Mana Tokens">
            {player.pureMana.map((token, i) => (
              <span
                key={i}
                className={`top-bar__token top-bar__token--${token.color}`}
                title={`${token.color} mana token`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right section: Round/Time/Help */}
      <div className="top-bar__section top-bar__section--right">
        <div className="top-bar__round" title="Current Round">
          <span className="top-bar__round-label">Round</span>
          <span className="top-bar__round-value">{state.round}</span>
        </div>

        <div
          className={`top-bar__time ${isNight ? "top-bar__time--night" : "top-bar__time--day"}`}
          title={state.timeOfDay === TIME_OF_DAY_DAY ? "Daytime" : "Nighttime"}
        >
          {state.timeOfDay === TIME_OF_DAY_DAY ? "☀" : "☾"}
        </div>

        <button
          className="top-bar__help-btn"
          onClick={() => setIsHelpOpen(true)}
          title="Keyboard shortcuts"
        >
          ?
        </button>
      </div>

      <HotkeyHelp isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
