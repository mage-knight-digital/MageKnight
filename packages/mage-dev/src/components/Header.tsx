import React from "react";
import { Box, Text } from "ink";

interface HeaderProps {
  message: string | undefined;
  messageColor: string | undefined;
}

export function Header({ message, messageColor }: HeaderProps) {
  const color = messageColor ?? "yellow";

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1}>
        <Text color="cyan" bold>
          {"◆ "}
        </Text>
        <Text bold>mage-dev</Text>
        <Text color="gray">{" │ worktree manager"}</Text>
      </Box>

      {message && (
        <Box marginTop={1} marginLeft={1}>
          <Text color={color}>{"► "}{message}</Text>
        </Box>
      )}
    </Box>
  );
}

export function Footer() {
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
          <Text color="white">q</Text> quit
        </Text>
      </Box>
    </Box>
  );
}
