import { GameProvider } from "./context/GameContext";
import { useGame } from "./hooks/useGame";
import { HexGrid } from "./components/GameBoard/HexGrid";
import { ManaSourceOverlay } from "./components/GameBoard/ManaSourceOverlay";
import { TopBar } from "./components/TopBar";
import { TurnActions } from "./components/TurnActions";
import { PlayerHand } from "./components/Hand/PlayerHand";
import { TacticSelection } from "./components/Overlays/TacticSelection";
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

  if (!state) {
    return <div className="loading">Loading game state...</div>;
  }

  // Show combat overlay when in combat
  const inCombat = state.combat && state.validActions.combat;

  return (
    <div className="app">
      {/* Overlays */}
      <TacticSelection />
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
  return (
    <GameProvider seed={GAME_SEED}>
      <GameView />
      <DebugPanel />
    </GameProvider>
  );
}
