import { useEffect } from "react";
import { GameProvider } from "./context/GameContext";
import { CardMenuPositionProvider } from "./context/CardMenuPositionContext";
import { useGame } from "./hooks/useGame";
import { useMyPlayer } from "./hooks/useMyPlayer";
import { HexGrid } from "./components/GameBoard/HexGrid";
import { ManaSourceOverlay } from "./components/GameBoard/ManaSourceOverlay";
import { TopBar } from "./components/TopBar";
import { TurnActions } from "./components/TurnActions";
import { PlayerHand } from "./components/Hand/PlayerHand";
import { ChoiceSelection } from "./components/Overlays/ChoiceSelection";
import { RewardSelection } from "./components/Overlays/RewardSelection";
import { ManaStealDecision } from "./components/Overlays/ManaStealDecision";
import { RethinkDecision } from "./components/Overlays/RethinkDecision";
import { MidnightMeditationDecision } from "./components/Overlays/MidnightMeditationDecision";
import { PreparationDecision } from "./components/Overlays/PreparationDecision";
import { SparingPowerDecision } from "./components/Overlays/SparingPowerDecision";
import { ManaSearchReroll } from "./components/Overlays/ManaSearchReroll";
import { GladeWoundDecision } from "./components/Overlays/GladeWoundDecision";
import { CombatOverlay } from "./components/Combat";
import { OffersBar } from "./components/OffersBar";
import { DebugPanel } from "./components/DebugPanel";
import { startAmbientMusic, isAmbientPlaying } from "./utils/ambientMusicManager";

// Get seed from URL param (?seed=12345) or use current time
// This allows reproducible games for testing and debugging
function getGameSeed(): number {
  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get("seed");
  if (seedParam) {
    const seed = parseInt(seedParam, 10);
    if (!isNaN(seed)) {
      console.log("Game seed (from URL):", seed);
      return seed;
    }
  }
  const seed = Date.now();
  console.log("Game seed (random):", seed);
  return seed;
}

const GAME_SEED = getGameSeed();

function GameView() {
  const { state } = useGame();
  const player = useMyPlayer();

  if (!state) {
    return <div className="loading">Loading game state...</div>;
  }

  // Show combat overlay when in combat
  const inCombat = state.combat && state.validActions.combat;

  // Check if we're in tactic selection mode
  const isTacticSelectionActive = player && player.selectedTacticId === null && !!state.validActions.tactics;

  const appClassName = [
    "app",
    isTacticSelectionActive && "app--tactic-selection",
    inCombat && "app--combat",
  ].filter(Boolean).join(" ");

  return (
    <div className={appClassName}>
      {/* Overlays */}
      <ChoiceSelection />
      <RewardSelection />
      <ManaStealDecision />
      <RethinkDecision />
      <MidnightMeditationDecision />
      <PreparationDecision />
      <SparingPowerDecision />
      <ManaSearchReroll />
      <GladeWoundDecision />
      {inCombat && (
        <CombatOverlay
          combat={state.combat}
          combatOptions={state.validActions.combat}
        />
      )}

      <TopBar />
      <OffersBar />

      <main className="app__main">
        <div className="app__board">
          <HexGrid />
          <ManaSourceOverlay />
        </div>
      </main>

      <PlayerHand />
      <TurnActions />
    </div>
  );
}

export function App() {
  // Start ambient music on first user interaction
  useEffect(() => {
    const startMusicOnInteraction = () => {
      if (!isAmbientPlaying()) {
        startAmbientMusic();
      }
      // Remove listeners after first interaction
      document.removeEventListener("click", startMusicOnInteraction);
      document.removeEventListener("keydown", startMusicOnInteraction);
    };

    document.addEventListener("click", startMusicOnInteraction);
    document.addEventListener("keydown", startMusicOnInteraction);

    return () => {
      document.removeEventListener("click", startMusicOnInteraction);
      document.removeEventListener("keydown", startMusicOnInteraction);
    };
  }, []);

  return (
    <GameProvider seed={GAME_SEED}>
      <CardMenuPositionProvider>
        <GameView />
        <DebugPanel />
      </CardMenuPositionProvider>
    </GameProvider>
  );
}
