import { useEffect, useState, useCallback } from "react";
import { GameProvider } from "./context/GameContext";
import { CardMenuPositionProvider } from "./context/CardMenuPositionContext";
import { GameIntroProvider, useGameIntro } from "./contexts/GameIntroContext";
import { AnimationDispatcherProvider } from "./contexts/AnimationDispatcherContext";
import { CinematicProvider, useCinematic } from "./contexts/CinematicContext";
import { OverlayProvider } from "./contexts/OverlayContext";
import { DebugDisplayProvider } from "./contexts/DebugDisplayContext";
import { useGame } from "./hooks/useGame";
import { useMyPlayer } from "./hooks/useMyPlayer";
import { PixiHexGrid } from "./components/GameBoard/PixiHexGrid";
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
import { OfferView } from "./components/OfferView";
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
  const { isIntroComplete } = useGameIntro();
  const { isInCinematic } = useCinematic();
  const [isOfferViewVisible, setIsOfferViewVisible] = useState(false);

  // Handle offer view state from PlayerHand
  const handleOfferViewChange = useCallback((isVisible: boolean) => {
    setIsOfferViewVisible(isVisible);
  }, []);

  // Handle closing offer view (from overlay click or S key in OfferView)
  const handleOfferViewClose = useCallback(() => {
    setIsOfferViewVisible(false);
  }, []);

  if (!state) {
    return <div className="loading">Loading game state...</div>;
  }

  // Show combat overlay when in combat
  const inCombat = state.combat && state.validActions.combat;

  // Check if we're in tactic selection mode
  // Only dim the world after intro completes - don't dim during the theatrical reveal
  const isTacticSelectionActive = player && player.selectedTacticId === null && !!state.validActions.tactics;
  const shouldDimForTactics = isTacticSelectionActive && isIntroComplete;

  const appClassName = [
    "app",
    shouldDimForTactics && "app--tactic-selection",
    inCombat && "app--combat",
    isInCinematic && "app--cinematic",
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

      {/* Offer View - Inscryption-style offer display */}
      <OfferView isVisible={isOfferViewVisible} onClose={handleOfferViewClose} />

      <main className="app__main">
        <div className="app__board">
          <PixiHexGrid />
          <ManaSourceOverlay />
        </div>
      </main>

      <PlayerHand onOfferViewChange={handleOfferViewChange} />
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
      <AnimationDispatcherProvider>
        <GameIntroProvider>
          <CinematicProvider>
            <OverlayProvider>
              <DebugDisplayProvider>
                <CardMenuPositionProvider>
                  <GameView />
                  <DebugPanel />
                </CardMenuPositionProvider>
              </DebugDisplayProvider>
            </OverlayProvider>
          </CinematicProvider>
        </GameIntroProvider>
      </AnimationDispatcherProvider>
    </GameProvider>
  );
}
