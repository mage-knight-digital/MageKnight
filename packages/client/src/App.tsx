import { useState, useCallback } from "react";
import type { GameConfig } from "@mage-knight/shared";
import { GameProvider } from "./context/GameProvider";
import { ReplayProvider, type ArtifactData } from "./context/ReplayProvider";
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
import { ReplayLoadScreen } from "./components/Replay";

const MODE_PARAM = "mode" as const;
const MODE_NETWORK = "network" as const;
const MODE_RUST = "rust" as const;
const SERVER_URL_PARAM = "serverUrl" as const;
const GAME_ID_PARAM = "gameId" as const;
const PLAYER_ID_PARAM = "playerId" as const;
const SESSION_TOKEN_PARAM = "sessionToken" as const;
const MODE_REPLAY = "replay" as const;
const DEFAULT_NETWORK_SERVER_URL = "ws://localhost:3001" as const;
const DEFAULT_RUST_SERVER_URL = "ws://localhost:3030/ws" as const;
const HERO_PARAM = "hero" as const;
const SEED_PARAM = "seed" as const;

interface RuntimeNetworkConfig {
  serverUrl: string;
  gameId: string;
  playerId: string;
  sessionToken?: string;
}

interface RuntimeRustConfig {
  serverUrl: string;
  hero: string;
  seed?: number;
  playerId?: string;
}

function getRuntimeNetworkConfig(): RuntimeNetworkConfig | null {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get(MODE_PARAM);

  if (mode !== MODE_NETWORK) {
    return null;
  }

  const gameId = urlParams.get(GAME_ID_PARAM);
  const playerId = urlParams.get(PLAYER_ID_PARAM);

  if (!gameId || !playerId) {
    return null;
  }

  const serverUrl = urlParams.get(SERVER_URL_PARAM) ?? DEFAULT_NETWORK_SERVER_URL;
  const sessionToken = urlParams.get(SESSION_TOKEN_PARAM) ?? undefined;

  return {
    serverUrl,
    gameId,
    playerId,
    sessionToken,
  };
}

function isNetworkModeRequested(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(MODE_PARAM) === MODE_NETWORK;
}

function isReplayModeRequested(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(MODE_PARAM) === MODE_REPLAY;
}

function getRuntimeRustConfig(): RuntimeRustConfig | null {
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get(MODE_PARAM);

  if (mode !== MODE_RUST) {
    return null;
  }

  const hero = urlParams.get(HERO_PARAM) ?? "arythea";
  const serverUrl = urlParams.get(SERVER_URL_PARAM) ?? DEFAULT_RUST_SERVER_URL;
  const playerId = urlParams.get(PLAYER_ID_PARAM) ?? undefined;
  const seedParam = urlParams.get(SEED_PARAM);
  const seed = seedParam ? parseInt(seedParam, 10) : undefined;

  return {
    serverUrl,
    hero,
    seed: seed && !isNaN(seed) ? seed : undefined,
    playerId,
  };
}

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
const RUNTIME_NETWORK_CONFIG = getRuntimeNetworkConfig();
const RUNTIME_RUST_CONFIG = getRuntimeRustConfig();
const NETWORK_MODE_REQUESTED = isNetworkModeRequested();
const REPLAY_MODE_REQUESTED = isReplayModeRequested();

export function App() {
  // Game configuration state - null until setup is complete
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);

  // Replay mode state
  const [replayArtifact, setReplayArtifact] = useState<ArtifactData | null>(null);
  const [replayPlayerId, setReplayPlayerId] = useState<string | null>(null);
  const [replayArtifactName, setReplayArtifactName] = useState<string | null>(null);

  const handleReplayLoad = useCallback((artifact: ArtifactData, playerId: string, artifactName: string) => {
    setReplayArtifact(artifact);
    setReplayPlayerId(playerId);
    setReplayArtifactName(artifactName);
  }, []);

  const gameShell = (
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
  );

  // Replay mode: load artifact, then play back through existing UI
  if (REPLAY_MODE_REQUESTED) {
    if (!replayArtifact || !replayPlayerId) {
      return <ReplayLoadScreen onLoad={handleReplayLoad} />;
    }
    return (
      <ReplayProvider artifact={replayArtifact} playerId={replayPlayerId} artifactName={replayArtifactName ?? undefined}>
        {gameShell}
      </ReplayProvider>
    );
  }

  if (RUNTIME_NETWORK_CONFIG) {
    return (
      <GameProvider
        mode="network"
        serverUrl={RUNTIME_NETWORK_CONFIG.serverUrl}
        gameId={RUNTIME_NETWORK_CONFIG.gameId}
        playerId={RUNTIME_NETWORK_CONFIG.playerId}
        sessionToken={RUNTIME_NETWORK_CONFIG.sessionToken}
      >
        {gameShell}
      </GameProvider>
    );
  }

  if (NETWORK_MODE_REQUESTED) {
    return (
      <div className="loading-screen error">
        <p>Missing network connection parameters.</p>
        <p className="error-message">
          Required URL params: <code>?mode=network&gameId=...&playerId=...</code>
        </p>
        <p className="error-hint">
          Optional params: <code>serverUrl=ws://localhost:3001</code> and{" "}
          <code>sessionToken=...</code>
        </p>
      </div>
    );
  }

  // Rust mode: connect to Rust mk-server via WebSocket
  if (RUNTIME_RUST_CONFIG) {
    return (
      <GameProvider
        mode="rust"
        serverUrl={RUNTIME_RUST_CONFIG.serverUrl}
        hero={RUNTIME_RUST_CONFIG.hero}
        seed={RUNTIME_RUST_CONFIG.seed}
        playerId={RUNTIME_RUST_CONFIG.playerId}
      >
        {gameShell}
      </GameProvider>
    );
  }

  // Show setup screen until configuration is complete
  if (!gameConfig) {
    return <SetupScreen onComplete={setGameConfig} />;
  }

  // Once setup is complete, render the game
  return (
    <GameProvider mode="local" seed={GAME_SEED} config={gameConfig}>
      {gameShell}
    </GameProvider>
  );
}
