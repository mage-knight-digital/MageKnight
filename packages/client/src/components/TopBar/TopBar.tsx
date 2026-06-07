import { useState, useEffect, useRef } from "react";
import {
  LEVEL_THRESHOLDS,
  MANA_BLUE,
  MANA_GREEN,
  MANA_RED,
  MANA_WHITE,
  TIME_OF_DAY_DAY,
  TIME_OF_DAY_NIGHT,
  type BasicManaColor,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useGameIntro, UI_REVEAL_TIMING } from "../../contexts/GameIntroContext";
import { getManaIconUrl } from "../../assets/assetPaths";
import { HotkeyHelp } from "./HotkeyHelp";
import { PlayerListPanel } from "../PlayerList";
import "./TopBar.css";

const CRYSTAL_COLORS = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] as const;

function getCrystalTitle(color: BasicManaColor): string {
  return `${color[0]?.toUpperCase() ?? ""}${color.slice(1)} Crystal`;
}

export function TopBar() {
  const { state } = useGame();
  const player = useMyPlayer();
  const { shouldRevealUI, isIntroComplete } = useGameIntro();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Track intro animation state - start hidden unless intro already complete (replay mode)
  const [introAnimState, setIntroAnimState] = useState<"hidden" | "revealing" | "visible">(isIntroComplete ? "visible" : "hidden");
  const hasAnimatedRef = useRef(isIntroComplete);

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

  // Find the next level threshold the player hasn't reached yet
  // (handles pending level-ups where fame exceeds current level's threshold)
  let nextLevelFame = 999;
  for (let i = player.level; i < LEVEL_THRESHOLDS.length; i++) {
    const threshold = LEVEL_THRESHOLDS[i];
    if (threshold !== undefined && threshold > player.fame) {
      nextLevelFame = threshold;
      break;
    }
  }

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
          <span className="top-bar__hero-name">{player.hero}</span>
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
          {CRYSTAL_COLORS.map((color) => {
            const count = player.crystals[color];
            if (count <= 0) return null;
            return (
              <span
                key={color}
                className={`top-bar__crystal top-bar__crystal--${color}`}
                title={getCrystalTitle(color)}
              >
                <img
                  className="top-bar__mana-glyph"
                  src={getManaIconUrl(color)}
                  alt=""
                  aria-hidden="true"
                />
                <span className="top-bar__crystal-count">{count}</span>
              </span>
            );
          })}
        </div>

        {player.manaTokens.length > 0 && (
          <div className="top-bar__mana-group top-bar__mana-group--tokens" title="Mana Tokens">
            {player.manaTokens.map((token, i) => (
              <span
                key={i}
                className={`top-bar__token top-bar__token--${token.color}`}
                title={`${token.color} mana token`}
              >
                <img
                  className="top-bar__mana-glyph"
                  src={getManaIconUrl(token.color)}
                  alt=""
                  aria-hidden="true"
                />
              </span>
            ))}
          </div>
        )}

        {player.stolenManaDie && (
          <div className="top-bar__mana-group top-bar__mana-group--stolen" title="Stolen Mana (Mana Steal Tactic)">
            <span
              className={`top-bar__token top-bar__token--${player.stolenManaDie.color} top-bar__token--stolen`}
              title={`${player.stolenManaDie.color} mana (stolen via Mana Steal tactic - use anytime this turn)`}
            >
              <img
                className="top-bar__mana-glyph"
                src={getManaIconUrl(player.stolenManaDie.color)}
                alt=""
                aria-hidden="true"
              />
            </span>
          </div>
        )}
      </div>

      {/* Right section: Round/Players/Time/Help */}
      <div className="top-bar__section top-bar__section--right">
        <div className="top-bar__round" title="Current Round">
          <span className="top-bar__round-label">Round</span>
          <span className="top-bar__round-value">{state.round}</span>
        </div>

        <PlayerListPanel />

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
