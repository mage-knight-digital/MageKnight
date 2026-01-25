import React from "react";
import { Box, Text } from "ink";
import type { Worktree } from "../lib/worktrees.js";

interface WorktreeListProps {
  worktrees: Worktree[];
  selectedIndex: number;
}

export function WorktreeList({ worktrees, selectedIndex }: WorktreeListProps) {
  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {worktrees.length === 0 ? (
        <Text color="gray" italic>No worktrees found</Text>
      ) : (
        worktrees.map((wt, index) => (
          <WorktreeRow
            key={wt.name}
            worktree={wt}
            isSelected={index === selectedIndex}
          />
        ))
      )}
    </Box>
  );
}

interface WorktreeRowProps {
  worktree: Worktree;
  isSelected: boolean;
}

function WorktreeRow({ worktree, isSelected }: WorktreeRowProps) {
  const pointer = isSelected ? "│" : " ";
  const bullet = isSelected ? "●" : "○";

  // Colors
  const pointerColor = isSelected ? "cyan" : "gray";
  const bulletColor = isSelected ? "cyan" : "gray";
  const nameColor = isSelected ? "white" : "gray";

  // Status indicator
  const statusIcon = worktree.serverRunning ? "▶" : " ";
  const statusColor = worktree.serverRunning ? "green" : "gray";

  return (
    <Box>
      <Text color={pointerColor}>{pointer}</Text>
      <Text color={bulletColor}>{" "}{bullet}{" "}</Text>
      <Text color={nameColor} bold={isSelected}>
        {worktree.name}
      </Text>
      {worktree.isMain && (
        <Text color="yellow">{" "}★</Text>
      )}
      <Text color={statusColor}>{" "}{statusIcon}</Text>
      {worktree.serverRunning && worktree.serverUrl && (
        <Text color="green">{" "}{worktree.serverUrl}</Text>
      )}
    </Box>
  );
}
