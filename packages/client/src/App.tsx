import { useState } from "react";
import type { GameConfig } from "@mage-knight/shared";
import { GameProvider } from "./context/GameProvider";
import { CardMenuPositionProvider } from "./context/CardMenuPositionContext";
import { CardInteractionProvider } from "./components/CardInteraction";
import { GameIntroProvider } from "./contexts/GameIntroContext";
import { AnimationDispatcherProvider } from "./contexts/AnimationDispatcherContext";
import { CinematicProvider } from "./contexts/CinematicContext";
import { OverlayProvider } from "./contexts/OverlayContext";
import { DebugDisplayProvider } from "./contexts/DebugDisplayContext";
import { PixiAppProvider } from "./contexts/PixiAppContext";
import { TurnNotificationProvider } from "./contexts/TurnNotificationContext";
import { GameView } from "./components/GameView";
import { DebugPanel } from "./components/DebugPanel";
import { SetupScreen } from "./components/Setup";

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

export function App() {
  // Game configuration state - null until setup is complete
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  // Show setup screen until configuration is complete
  if (!gameConfig) {
    return <SetupScreen onComplete={setGameConfig} />;
  }

  // Once setup is complete, render the game
  return (
    <GameProvider seed={GAME_SEED} config={gameConfig}>
      <TurnNotificationProvider>
        <AnimationDispatcherProvider>
          <GameIntroProvider>
            <CinematicProvider>
              <OverlayProvider>
                <DebugDisplayProvider>
                  <PixiAppProvider>
                    <CardMenuPositionProvider>
                      <CardInteractionProvider>
                        <GameView />
                        <DebugPanel />
                      </CardInteractionProvider>
                    </CardMenuPositionProvider>
                  </PixiAppProvider>
                </DebugDisplayProvider>
              </OverlayProvider>
            </CinematicProvider>
          </GameIntroProvider>
        </AnimationDispatcherProvider>
      </TurnNotificationProvider>
    </GameProvider>
  );
}
