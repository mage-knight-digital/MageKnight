import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { Header, Footer } from "./components/Header.js";
import { WorktreeList } from "./components/WorktreeList.js";
import { ConfirmPrompt, TextInput } from "./components/Prompt.js";
import {
  getWorktrees,
  startDevServer,
  killDevServer,
  deleteWorktree,
  createWorktree,
  openInBrowser,
  copyToClipboard,
  type Worktree,
} from "./lib/worktrees.js";

type Mode =
  | { type: "normal" }
  | { type: "confirm-delete"; worktree: Worktree }
  | { type: "new-worktree" }
  | { type: "creating"; branch: string; output: string[] };

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ type: "normal" });
  const [message, setMessage] = useState<string | undefined>();
  const [messageColor, setMessageColor] = useState<string | undefined>("yellow");

  // Clear screen when mode changes to avoid rendering artifacts
  const clearScreen = useCallback(() => {
    stdout.write("\x1B[2J\x1B[0f");
  }, [stdout]);

  const refresh = useCallback(() => {
    const wts = getWorktrees();
    setWorktrees(wts);
    // Keep selection in bounds
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, wts.length - 1)));
  }, []);


  // Initial load and auto-refresh
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Clear message after a delay
  useEffect(() => {
    if (message) {
      const timeout = setTimeout(() => setMessage(undefined), 3000);
      return () => clearTimeout(timeout);
    }
  }, [message]);

  const showMessage = (msg: string, color = "yellow") => {
    setMessage(msg);
    setMessageColor(color);
  };

  const selectedWorktree = worktrees[selectedIndex];

  const handleStartServer = () => {
    if (!selectedWorktree) return;
    const result = startDevServer(selectedWorktree.name);
    if (result.alreadyRunning) {
      showMessage(`Already running: ${selectedWorktree.serverUrl ?? ""}`, "yellow");
      if (selectedWorktree.serverUrl) {
        openInBrowser(selectedWorktree.serverUrl);
      }
    } else if (result.success) {
      showMessage(`Starting server for ${selectedWorktree.name}...`, "green");
      // Open browser after a short delay
      setTimeout(() => {
        refresh();
        const wt = getWorktrees().find((w) => w.name === selectedWorktree.name);
        if (wt?.serverUrl) {
          openInBrowser(wt.serverUrl);
        }
      }, 3000);
    } else {
      showMessage(`Failed: ${result.error}`, "red");
    }
    refresh();
  };

  const handleKillServer = () => {
    if (!selectedWorktree) return;
    if (selectedWorktree.serverRunning) {
      killDevServer(selectedWorktree.name);
      showMessage(`Stopped server for ${selectedWorktree.name}`, "green");
      refresh();
    } else {
      showMessage("No server running", "yellow");
    }
  };

  const handleOpenBrowser = () => {
    if (!selectedWorktree?.serverUrl) {
      showMessage("No server URL available", "yellow");
      return;
    }
    openInBrowser(selectedWorktree.serverUrl);
    showMessage(`Opened ${selectedWorktree.serverUrl}`, "green");
  };

  const handleConfirmDelete = () => {
    if (mode.type !== "confirm-delete") return;
    const result = deleteWorktree(mode.worktree.name);
    if (result.success) {
      showMessage(`Deleted ${mode.worktree.name}`, "green");
    } else {
      showMessage(`Failed: ${result.error}`, "red");
    }
    setMode({ type: "normal" });
    refresh();
  };

  const handleCreateWorktree = async (branch: string) => {
    clearScreen();
    setMode({ type: "creating", branch, output: [] });

    // Throttle output updates to reduce render thrashing
    let pendingLines: string[] = [];
    let updateScheduled = false;

    const flushOutput = () => {
      if (pendingLines.length === 0) return;
      const linesToAdd = pendingLines;
      pendingLines = [];
      updateScheduled = false;
      setMode((prev) => {
        if (prev.type !== "creating") return prev;
        return { ...prev, output: [...prev.output, ...linesToAdd].slice(-8) };
      });
    };

    const result = await createWorktree(branch, (line) => {
      pendingLines.push(line);
      if (!updateScheduled) {
        updateScheduled = true;
        setTimeout(flushOutput, 100);
      }
    });

    // Flush any remaining output
    flushOutput();

    // Clear screen before transitioning out of creating mode
    clearScreen();

    if (result.success && result.worktreePath) {
      const cmd = `cd ${result.worktreePath} && claude --dangerously-skip-permissions`;
      copyToClipboard(cmd);
      showMessage(`Created! Cmd copied - paste in new tab`, "green");
    } else if (!result.success) {
      showMessage(`Failed: ${result.error}`, "red");
    }
    setMode({ type: "normal" });
    refresh();
  };

  useInput(
    (input, key) => {
      if (mode.type !== "normal") return;

      // Navigation
      if (input === "j" || key.downArrow) {
        setSelectedIndex((prev) =>
          prev < worktrees.length - 1 ? prev + 1 : 0
        );
      } else if (input === "k" || key.upArrow) {
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : worktrees.length - 1
        );
      }
      // Actions
      else if (key.return) {
        handleStartServer();
      } else if (input === "s" || input === "S") {
        handleKillServer();
      } else if (input === "o" || input === "O") {
        handleOpenBrowser();
      } else if (input === "d" || input === "D") {
        if (selectedWorktree) {
          if (selectedWorktree.isMain) {
            showMessage("Cannot delete main repo", "red");
          } else {
            setMode({ type: "confirm-delete", worktree: selectedWorktree });
          }
        }
      } else if (input === "n" || input === "N") {
        setMode({ type: "new-worktree" });
      } else if (input === "r" || input === "R") {
        refresh();
        showMessage("Refreshed", "green");
      } else if (input === "q" || input === "Q") {
        exit();
      }
    },
    { isActive: mode.type === "normal" }
  );

  // Simplified view during creating mode to avoid render issues
  if (mode.type === "creating") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>◆ mage-dev</Text>
        <Text> </Text>
        <Text color="cyan">{"⟳ "}Creating {mode.branch}...</Text>
        <Text> </Text>
        {mode.output.map((line, i) => (
          <Text key={i} color="gray" wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header message={message} messageColor={messageColor} />
      <WorktreeList worktrees={worktrees} selectedIndex={selectedIndex} />

      {mode.type === "confirm-delete" && (
        <Box marginTop={1}>
          <ConfirmPrompt
            message={`Delete ${mode.worktree.name} (branch: ${mode.worktree.branch})?`}
            onConfirm={handleConfirmDelete}
            onCancel={() => setMode({ type: "normal" })}
          />
        </Box>
      )}

      {mode.type === "new-worktree" && (
        <Box marginTop={1}>
          <TextInput
            label="Branch name"
            onSubmit={handleCreateWorktree}
            onCancel={() => setMode({ type: "normal" })}
          />
        </Box>
      )}

      <Footer />
    </Box>
  );
}
