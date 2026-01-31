import React from "react";
import { Box, Text } from "ink";
import type { Agent } from "../lib/agents.js";

interface AgentListProps {
  agents: Agent[];
  selectedIndex: number;
}

export function AgentList({ agents, selectedIndex }: AgentListProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
    >
      {agents.length === 0 ? (
        <Text color="gray" italic>
          No agents running. Press 'l' to launch agents.
        </Text>
      ) : (
        agents.map((agent, index) => (
          <AgentRow
            key={agent.issueNumber > 0 ? agent.issueNumber : `pending-${index}`}
            agent={agent}
            isSelected={index === selectedIndex}
          />
        ))
      )}
    </Box>
  );
}

interface AgentRowProps {
  agent: Agent;
  isSelected: boolean;
}

function AgentRow({ agent, isSelected }: AgentRowProps) {
  const pointer = isSelected ? "│" : " ";
  const bullet = isSelected ? "●" : "○";

  // Colors based on selection
  const pointerColor = isSelected ? "cyan" : "gray";
  const bulletColor = isSelected ? "cyan" : "gray";
  const nameColor = isSelected ? "white" : "gray";

  // Status indicator and color
  const statusConfig = {
    running: { icon: "⟳", color: "cyan" },
    completed: { icon: "✓", color: "green" },
    failed: { icon: "✗", color: "red" },
    stopped: { icon: "○", color: "gray" },
    initializing: { icon: "◐", color: "yellow" },
  };
  const { icon: statusIcon, color: statusColor } = statusConfig[agent.status];

  // Format runtime if running
  const runtime = agent.startTime
    ? formatDuration(Date.now() - agent.startTime.getTime())
    : "";

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={pointerColor}>{pointer}</Text>
        <Text color={bulletColor}>
          {" "}
          {bullet}{" "}
        </Text>
        <Text color={statusColor}>{statusIcon} </Text>
        <Text color={nameColor} bold={isSelected}>
          #{agent.issueNumber}
        </Text>
        <Text color="gray"> • </Text>
        <Text color={nameColor}>
          {agent.issueTitle
            ? agent.issueTitle.slice(0, 50) + (agent.issueTitle.length > 50 ? "…" : "")
            : agent.worktreeName}
        </Text>
        {runtime && (
          <Text color="gray">
            {" "}
            ({runtime})
          </Text>
        )}
      </Box>
      {isSelected && agent.lastLogLine && (
        <Box marginLeft={5}>
          <Text color="gray" wrap="truncate">
            └ {agent.lastLogLine}
          </Text>
        </Box>
      )}
    </Box>
  );
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
