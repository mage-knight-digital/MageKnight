import React from "react";
import { Box, Text } from "ink";
import type { Worktree } from "../lib/worktrees.js";

interface WorktreeListProps {
  worktrees: Worktree[];
  selectedIndex: number;
  deletingWorktrees?: Set<string>;
}

export function WorktreeList({ worktrees, selectedIndex, deletingWorktrees }: WorktreeListProps) {
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
            isDeleting={deletingWorktrees?.has(wt.name) ?? false}
          />
        ))
      )}
    </Box>
  );
}

interface WorktreeRowProps {
  worktree: Worktree;
  isSelected: boolean;
  isDeleting: boolean;
}

function WorktreeRow({ worktree, isSelected, isDeleting }: WorktreeRowProps) {
  const pointer = isSelected ? "│" : " ";
  const bullet = isDeleting ? "⟳" : isSelected ? "●" : "○";

  // Colors - dim if deleting
  const pointerColor = isDeleting ? "yellow" : isSelected ? "cyan" : "gray";
  const bulletColor = isDeleting ? "yellow" : isSelected ? "cyan" : "gray";
  const nameColor = isDeleting ? "yellow" : isSelected ? "white" : "gray";

  // Status indicator
  const statusIcon = worktree.serverRunning ? "▶" : " ";
  const statusColor = worktree.serverRunning ? "green" : "gray";

  return (
    <Box>
      <Text color={pointerColor}>{pointer}</Text>
      <Text color={bulletColor}>{" "}{bullet}{" "}</Text>
      <Text color={nameColor} bold={isSelected && !isDeleting} dimColor={isDeleting}>
        {worktree.name}
      </Text>
      {isDeleting && (
        <Text color="yellow" dimColor>{" "}deleting...</Text>
      )}
      {worktree.isMain && !isDeleting && (
        <Text color="yellow">{" "}★</Text>
      )}
      {!isDeleting && <Text color={statusColor}>{" "}{statusIcon}</Text>}
      {!isDeleting && worktree.serverRunning && worktree.serverUrl && (
        <Text color="green">{" "}{worktree.serverUrl}</Text>
      )}
    </Box>
  );
}
