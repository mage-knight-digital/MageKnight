import { useState, useCallback, useEffect, type ChangeEvent } from "react";
import { isValidArtifact, getPlayerIds, type ArtifactData } from "../../context/ReplayProvider";
import "./ReplayLoadScreen.css";

interface ArtifactListEntry {
  path: string;
  name: string;
  dir: number;
  size: number;
  mtime: string;
}

interface ReplayLoadScreenProps {
  onLoad: (artifact: ArtifactData, playerId: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReplayLoadScreen({ onLoad }: ReplayLoadScreenProps) {
  const [artifact, setArtifact] = useState<ArtifactData | null>(null);
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  // Server-side artifact listing
  const [artifactList, setArtifactList] = useState<ArtifactListEntry[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [selectedArtifactIndex, setSelectedArtifactIndex] = useState(0);
  const [fetchingArtifact, setFetchingArtifact] = useState(false);

  // Fetch artifact index on mount
  useEffect(() => {
    fetch("/__artifacts")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch artifact list");
        return res.json() as Promise<ArtifactListEntry[]>;
      })
      .then((list) => {
        setArtifactList(list);
      })
      .catch(() => {
        // Server endpoint not available (production build, etc.) - that's fine
      })
      .finally(() => setListLoading(false));
  }, []);

  const loadArtifactData = useCallback((data: unknown, name: string) => {
    if (!isValidArtifact(data)) {
      setError("Invalid artifact format: missing 'run' or 'messageLog' fields.");
      setArtifact(null);
      return;
    }
    const ids = getPlayerIds(data);
    if (ids.length === 0) {
      setError("No state_update frames found in this artifact.");
      setArtifact(null);
      return;
    }
    setError(null);
    setArtifact(data);
    setPlayerIds(ids);
    setSelectedPlayer(ids[0]);
    setFileName(name);
  }, []);

  // Load from server dropdown
  const handleLoadFromServer = useCallback(() => {
    const entry = artifactList[selectedArtifactIndex];
    if (!entry) return;
    setFetchingArtifact(true);
    setError(null);
    const params = new URLSearchParams({ dir: String(entry.dir), path: entry.path });
    fetch(`/__artifacts?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch artifact");
        return res.json();
      })
      .then((data) => {
        loadArtifactData(data, entry.path.split("/").pop() ?? entry.path);
      })
      .catch(() => {
        setError("Failed to load artifact from server.");
      })
      .finally(() => setFetchingArtifact(false));
  }, [artifactList, selectedArtifactIndex, loadArtifactData]);

  // Load from file picker
  const handleFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        loadArtifactData(data, file.name);
      } catch {
        setError("Failed to parse JSON file.");
        setArtifact(null);
      }
    };
    reader.readAsText(file);
  }, [loadArtifactData]);

  const handleStart = useCallback(() => {
    if (artifact && selectedPlayer) {
      onLoad(artifact, selectedPlayer);
    }
  }, [artifact, selectedPlayer, onLoad]);

  return (
    <div className="replay-load-screen">
      <h1 className="replay-load-screen__title">Replay Viewer</h1>
      <div className="replay-load-screen__content">

        {/* Server artifact picker */}
        {!listLoading && artifactList.length > 0 && !artifact && (
          <div className="replay-load-screen__server-picker">
            <select
              className="replay-load-screen__artifact-select"
              value={selectedArtifactIndex}
              onChange={(e) => setSelectedArtifactIndex(Number(e.target.value))}
            >
              {artifactList.map((entry, i) => (
                <option key={`${entry.dir}:${entry.path}`} value={i}>
                  {entry.name} ({formatSize(entry.size)}, {formatDate(entry.mtime)})
                </option>
              ))}
            </select>
            <button
              className="replay-load-screen__load-button"
              onClick={handleLoadFromServer}
              disabled={fetchingArtifact || artifactList.length === 0}
            >
              {fetchingArtifact ? "Loading..." : "Load"}
            </button>
          </div>
        )}

        {/* Show "no artifacts found" hint when list is empty and loaded */}
        {!listLoading && artifactList.length === 0 && !artifact && (
          <p className="replay-load-screen__hint">
            No artifacts in sim-artifacts/. Run a game with <code>--save-artifact</code> to generate one.
          </p>
        )}

        {/* Divider between methods */}
        {!artifact && !listLoading && (
          <div className="replay-load-screen__divider">
            <span>or upload a file</span>
          </div>
        )}

        {/* File picker fallback */}
        {!artifact && (
          <label className="replay-load-screen__file-label">
            <span className="replay-load-screen__file-button">
              Choose artifact JSON
            </span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="replay-load-screen__file-input"
            />
          </label>
        )}

        {error && <p className="replay-load-screen__error">{error}</p>}

        {artifact && (
          <div className="replay-load-screen__metadata">
            <p className="replay-load-screen__file-name">{fileName}</p>
            <div className="replay-load-screen__meta-row">
              <span className="replay-load-screen__meta-label">Seed</span>
              <span className="replay-load-screen__meta-value">{artifact.run.seed}</span>
            </div>
            <div className="replay-load-screen__meta-row">
              <span className="replay-load-screen__meta-label">Steps</span>
              <span className="replay-load-screen__meta-value">{artifact.run.steps}</span>
            </div>
            <div className="replay-load-screen__meta-row">
              <span className="replay-load-screen__meta-label">Outcome</span>
              <span className="replay-load-screen__meta-value">{artifact.run.outcome}</span>
            </div>
            {artifact.run.reason && (
              <div className="replay-load-screen__meta-row">
                <span className="replay-load-screen__meta-label">Reason</span>
                <span className="replay-load-screen__meta-value">{artifact.run.reason}</span>
              </div>
            )}

            {playerIds.length > 1 && (
              <div className="replay-load-screen__player-select">
                <label className="replay-load-screen__meta-label" htmlFor="player-select">
                  Player
                </label>
                <select
                  id="player-select"
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="replay-load-screen__select"
                >
                  {playerIds.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              className="replay-load-screen__start-button"
              onClick={handleStart}
            >
              Start Replay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
