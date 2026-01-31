import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput, useStdout } from "ink";
import { Header, WorktreeFooter, AgentFooter, type TabType } from "./components/Header.js";
import { WorktreeList } from "./components/WorktreeList.js";
import { AgentList } from "./components/AgentList.js";
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
import {
  getAgents,
  getAgentLog,
  killAgent,
  cleanupCompletedAgents,
  launchAgentsInBackground,
  type Agent,
} from "./lib/agents.js";

type Mode =
  | { type: "normal" }
  | { type: "confirm-delete"; worktree: Worktree }
  | { type: "new-worktree" }
  | { type: "creating"; branch: string; output: string[] }
  | { type: "confirm-kill-agent"; agent: Agent }
  | { type: "view-log"; agent: Agent; lines: string[] }
  | { type: "launch-agent" };

export function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [activeTab, setActiveTab] = useState<TabType>("worktrees");
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [agentSelectedIndex, setAgentSelectedIndex] = useState(0);
  const [mode, setMode] = useState<Mode>({ type: "normal" });
  const [message, setMessage] = useState<string | undefined>();
  const [messageColor, setMessageColor] = useState<string | undefined>("yellow");

  // Clear screen when mode changes to avoid rendering artifacts
  const clearScreen = useCallback(() => {
    stdout.write("\x1B[2J\x1B[0f");
  }, [stdout]);

  const refreshWorktrees = useCallback(() => {
    const wts = getWorktrees();
    setWorktrees(wts);
    // Keep selection in bounds
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, wts.length - 1)));
  }, []);

  const refreshAgents = useCallback(() => {
    const ags = getAgents();
    setAgents(ags);
    // Keep selection in bounds
    setAgentSelectedIndex((prev) => Math.min(prev, Math.max(0, ags.length - 1)));
  }, []);

  const refresh = useCallback(() => {
    refreshWorktrees();
    refreshAgents();
  }, [refreshWorktrees, refreshAgents]);


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

  // Auto-refresh log view (tail mode)
  useEffect(() => {
    if (mode.type !== "view-log") return;

    const interval = setInterval(() => {
      const lines = getAgentLog(mode.agent.issueNumber, 30);
      setMode((prev) => {
        if (prev.type !== "view-log") return prev;
        return { ...prev, lines };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [mode.type, mode.type === "view-log" ? mode.agent.issueNumber : 0]);

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
    } else if (result.success) {
      showMessage(`Starting server for ${selectedWorktree.name}...`, "green");
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

  // Agent handlers
  const selectedAgent = agents[agentSelectedIndex];

  const handleLaunchAgents = (count: number, issueNumbers?: number[]) => {
    const result = launchAgentsInBackground(count, issueNumbers);
    if (result.success) {
      if (issueNumbers && issueNumbers.length > 0) {
        showMessage(`Launching agent for #${issueNumbers.join(", #")}...`, "cyan");
      } else {
        showMessage(`Launching ${count} agent(s) in background...`, "cyan");
      }
    } else {
      showMessage(`Failed: ${result.error}`, "red");
    }
  };

  const handleLaunchSpecificAgent = (input: string) => {
    const trimmed = input.trim().replace(/^#/, "");
    const issueNumber = trimmed ? parseInt(trimmed, 10) : undefined;

    if (trimmed && isNaN(issueNumber as number)) {
      showMessage("Invalid issue number", "red");
      setMode({ type: "normal" });
      return;
    }

    handleLaunchAgents(1, issueNumber ? [issueNumber] : undefined);
    setMode({ type: "normal" });
  };

  const handleViewLog = () => {
    if (!selectedAgent) return;
    const lines = getAgentLog(selectedAgent.issueNumber, 30);
    setMode({ type: "view-log", agent: selectedAgent, lines });
  };

  const handleKillAgent = () => {
    if (mode.type !== "confirm-kill-agent") return;
    const result = killAgent(mode.agent.issueNumber);
    if (result.success) {
      showMessage(`Killed agent for #${mode.agent.issueNumber}`, "green");
    } else {
      showMessage(`Failed: ${result.error}`, "red");
    }
    setMode({ type: "normal" });
    refreshAgents();
  };

  const handleCleanup = () => {
    const cleaned = cleanupCompletedAgents();
    showMessage(`Cleaned up ${cleaned} completed agents`, "green");
    refreshAgents();
  };

  useInput(
    (input, key) => {
      // Handle log view mode - any key exits
      if (mode.type === "view-log") {
        setMode({ type: "normal" });
        return;
      }

      if (mode.type !== "normal") return;

      // Tab switching
      if (key.tab) {
        setActiveTab((prev) => (prev === "worktrees" ? "agents" : "worktrees"));
        return;
      }

      // Quit works on both tabs
      if (input === "q" || input === "Q") {
        exit();
        return;
      }

      // Refresh works on both tabs
      if (input === "r" || input === "R") {
        refresh();
        showMessage("Refreshed", "green");
        return;
      }

      // Tab-specific input handling
      if (activeTab === "worktrees") {
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
        // Worktree actions
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
        }
      } else if (activeTab === "agents") {
        // Navigation
        if (input === "j" || key.downArrow) {
          setAgentSelectedIndex((prev) =>
            prev < agents.length - 1 ? prev + 1 : 0
          );
        } else if (input === "k" || key.upArrow) {
          setAgentSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : agents.length - 1
          );
        }
        // Agent actions
        else if (input === "l") {
          setMode({ type: "launch-agent" });
        } else if (input === "L") {
          handleLaunchAgents(3);
        } else if (input === "v" || input === "V") {
          handleViewLog();
        } else if (input === "o" || input === "O") {
          // Open/attach to agent session
          if (selectedAgent && selectedAgent.worktreePath) {
            const cmd = `cd ${selectedAgent.worktreePath} && claude --continue`;
            copyToClipboard(cmd);
            showMessage(`Copied command - paste in new terminal to continue session`, "green");
          } else if (selectedAgent) {
            showMessage("Agent has no worktree path", "yellow");
          }
        } else if (input === "K" && selectedAgent?.status === "running") {
          setMode({ type: "confirm-kill-agent", agent: selectedAgent });
        } else if (input === "c" || input === "C") {
          handleCleanup();
        }
      }
    },
    { isActive: mode.type === "normal" || mode.type === "view-log" }
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

  // Log view mode
  if (mode.type === "view-log") {
    // Filter out empty lines and check if there's actual content
    const nonEmptyLines = mode.lines.filter((line) => line.trim().length > 0);
    const hasContent = nonEmptyLines.length > 0;

    return (
      <Box flexDirection="column" padding={1}>
        <Text color="cyan" bold>◆ mage-dev</Text>
        <Text> </Text>
        <Box>
          <Text color="cyan" bold>Log for #{mode.agent.issueNumber}</Text>
          <Text color="gray">{" │ "}</Text>
          <Text color="green">● Live</Text>
        </Box>
        <Text color="gray" dimColor>Auto-refreshing • Press any key to close</Text>
        <Text> </Text>
        <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
          {!hasContent ? (
            <Text color="gray" italic>No log content yet</Text>
          ) : (
            nonEmptyLines.slice(-20).map((line, i) => (
              <Text key={i} color="gray" wrap="truncate">
                {line}
              </Text>
            ))
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Header message={message} messageColor={messageColor} activeTab={activeTab} />

      {activeTab === "worktrees" && (
        <>
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

          <WorktreeFooter />
        </>
      )}

      {activeTab === "agents" && (
        <>
          <AgentList agents={agents} selectedIndex={agentSelectedIndex} />

          {mode.type === "confirm-kill-agent" && (
            <Box marginTop={1}>
              <ConfirmPrompt
                message={`Kill agent for #${mode.agent.issueNumber}?`}
                onConfirm={handleKillAgent}
                onCancel={() => setMode({ type: "normal" })}
              />
            </Box>
          )}

          {mode.type === "launch-agent" && (
            <Box marginTop={1}>
              <TextInput
                label="Issue # (blank for auto)"
                onSubmit={handleLaunchSpecificAgent}
                onCancel={() => setMode({ type: "normal" })}
              />
            </Box>
          )}

          <AgentFooter />
        </>
      )}
    </Box>
  );
}
