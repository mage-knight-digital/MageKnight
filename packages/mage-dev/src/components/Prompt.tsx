import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ConfirmPromptProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPrompt({
  message,
  onConfirm,
  onCancel,
}: ConfirmPromptProps) {
  useInput((input) => {
    if (input.toLowerCase() === "y") {
      onConfirm();
    } else if (input.toLowerCase() === "n" || input === "\x1B") {
      onCancel();
    }
  });

  return (
    <Box borderStyle="round" borderColor="yellow" paddingX={1}>
      <Text color="yellow">{"⚠ "}</Text>
      <Text>{message}</Text>
      <Text color="gray">{" ["}</Text>
      <Text color="green">y</Text>
      <Text color="gray">/</Text>
      <Text color="red">n</Text>
      <Text color="gray">{"]"}</Text>
    </Box>
  );
}

interface TextInputProps {
  label: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function TextInput({ label, onSubmit, onCancel }: TextInputProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim());
      }
    } else if (key.escape) {
      onCancel();
    } else if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
    } else if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text color="cyan">{"✎ "}</Text>
      <Text>{label}: </Text>
      <Text color="white" bold>{value}</Text>
      <Text color="cyan">{"█"}</Text>
    </Box>
  );
}
