import React from "react";
import { Box, Text } from "ink";

export type TabType = "worktrees" | "agents";

interface HeaderProps {
  message: string | undefined;
  messageColor: string | undefined;
  activeTab?: TabType;
}

export function Header({ message, messageColor, activeTab = "worktrees" }: HeaderProps) {
  const color = messageColor ?? "yellow";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          {"◆ "}
        </Text>
        <Text bold>mage-dev</Text>
        <Text color="gray">{" │ "}</Text>
        <Tab name="worktrees" label="Worktrees" active={activeTab === "worktrees"} />
        <Text color="gray">{" "}</Text>
        <Tab name="agents" label="Agents" active={activeTab === "agents"} />
        <Text color="gray">{" │ "}</Text>
        <Text color="gray" dimColor>Tab to switch</Text>
      </Box>

      {message && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={color}>{"► "}{message}</Text>
        </Box>
      )}
    </Box>
  );
}

interface TabProps {
  name: string;
  label: string;
  active: boolean;
}

function Tab({ label, active }: TabProps) {
  if (active) {
    return (
      <Text color="cyan" bold underline>
        {label}
      </Text>
    );
  }
  return <Text color="gray">{label}</Text>;
}

export function WorktreeFooter() {
  return (
    <Box marginTop={1} flexDirection="column">
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          <Text color="white">↑↓</Text> navigate{"  "}
          <Text color="white">⏎</Text> start{"  "}
          <Text color="white">s</Text> stop{"  "}
          <Text color="white">n</Text> new{"  "}
          <Text color="white">d</Text> delete{"  "}
          <Text color="white">o</Text> open{"  "}
          <Text color="white">Tab</Text> agents{"  "}
          <Text color="white">q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}

export function AgentFooter() {
  return (
    <Box marginTop={1} flexDirection="column">
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text color="gray">
          <Text color="white">↑↓</Text> navigate{"  "}
          <Text color="white">l</Text> launch{"  "}
          <Text color="white">L</Text> launch 3{"  "}
          <Text color="white">v</Text> log{"  "}
          <Text color="white">o</Text> attach{"  "}
          <Text color="white">p</Text> PR{"  "}
          <Text color="white">K</Text> kill{"  "}
          <Text color="white">c</Text> cleanup{"  "}
          <Text color="white">Tab</Text> worktrees{"  "}
          <Text color="white">q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}

// Keep old Footer for backward compatibility
export function Footer() {
  return <WorktreeFooter />;
}
