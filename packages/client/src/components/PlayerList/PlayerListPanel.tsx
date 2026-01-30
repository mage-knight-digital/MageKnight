import { useState, useEffect, useRef } from "react";
import { useGame } from "../../hooks/useGame";
import { useGameIntro, UI_REVEAL_TIMING } from "../../contexts/GameIntroContext";
import { PlayerEntry } from "./PlayerEntry";
import "./PlayerListPanel.css";

export function PlayerListPanel() {
  const { state, myPlayerId } = useGame();
  const { shouldRevealUI, isIntroComplete } = useGameIntro();
  const [introAnimState, setIntroAnimState] = useState<"hidden" | "revealing" | "visible">("hidden");
  const hasAnimatedRef = useRef(false);

  // Trigger reveal animation slightly after top bar
  useEffect(() => {
    if (shouldRevealUI && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;

      const revealTimer = setTimeout(() => {
        setIntroAnimState("revealing");
      }, UI_REVEAL_TIMING.topBar.delay + 50);

      const visibleTimer = setTimeout(() => {
        setIntroAnimState("visible");
      }, UI_REVEAL_TIMING.topBar.delay + 50 + 400);

      return () => {
        clearTimeout(revealTimer);
        clearTimeout(visibleTimer);
      };
    }
  }, [shouldRevealUI]);

  // Show immediately if intro already complete (e.g., hot reload)
  useEffect(() => {
    if (isIntroComplete && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setIntroAnimState("visible");
    }
  }, [isIntroComplete]);

  if (!state) return null;

  // Only show for multiplayer (2+ players)
  const players = state.players;
  if (players.length < 2) return null;

  // Don't render until ready to show
  if (introAnimState === "hidden") return null;

  // Map turnOrder to Player objects
  const playerList = state.turnOrder
    .map(pid => players.find(p => p.id === pid))
    .filter((p): p is NonNullable<typeof p> => p != null);

  const currentPlayerId = state.currentPlayerId;
  const isMyTurn = currentPlayerId === myPlayerId;
  const currentPlayer = playerList.find(p => p.id === currentPlayerId);

  const className = [
    "player-list-panel",
    introAnimState === "revealing" && "player-list-panel--intro-reveal",
  ].filter(Boolean).join(" ");

  return (
    <div className={className}>
      {/* Turn indicator */}
      <div className="player-list-panel__indicator">
        {isMyTurn ? "YOUR TURN" : `Waiting for ${currentPlayer?.heroId ?? "player"}...`}
      </div>

      {/* Player entries in turn order */}
      <div className="player-list-panel__entries">
        {playerList.map(player => (
          <PlayerEntry
            key={player.id}
            player={player}
            isActive={player.id === currentPlayerId}
            isLocalPlayer={player.id === myPlayerId}
          />
        ))}
      </div>
    </div>
  );
}
