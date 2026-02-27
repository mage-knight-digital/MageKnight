import { useState, useCallback } from "react";
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
import { ReplayLoadScreen } from "./components/Replay";

const MODE_PARAM = "mode" as const;
const SERVER_URL_PARAM = "serverUrl" as const;
const PLAYER_ID_PARAM = "playerId" as const;
const MODE_REPLAY = "replay" as const;
const DEFAULT_RUST_SERVER_URL = "ws://localhost:3030/ws" as const;
const HERO_PARAM = "hero" as const;
const SEED_PARAM = "seed" as const;

interface RuntimeRustConfig {
  serverUrl: string;
  hero: string;
  seed?: number;
  playerId?: string;
}

function isReplayModeRequested(): boolean {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(MODE_PARAM) === MODE_REPLAY;
}

function getRuntimeRustConfig(): RuntimeRustConfig {
  const urlParams = new URLSearchParams(window.location.search);

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

const RUNTIME_RUST_CONFIG = getRuntimeRustConfig();
const REPLAY_MODE_REQUESTED = isReplayModeRequested();

export function App() {
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

  // Default: connect to Rust mk-server
  return (
    <GameProvider
      serverUrl={RUNTIME_RUST_CONFIG.serverUrl}
      hero={RUNTIME_RUST_CONFIG.hero}
      seed={RUNTIME_RUST_CONFIG.seed}
      playerId={RUNTIME_RUST_CONFIG.playerId}
    >
      {gameShell}
    </GameProvider>
  );
}
