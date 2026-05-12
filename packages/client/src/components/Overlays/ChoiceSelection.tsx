import { useMemo, useCallback, useEffect } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { useCardInteraction } from "../CardInteraction";
import { extractChoiceOptions, hasAction } from "../../rust/legalActionUtils";
import { PixiPieMenu, type PixiPieMenuItem } from "../CardActionMenu";
import "./ChoiceSelection.css";

// Distinct muted palette used when all options share the same semantic color
// (e.g. "Discard X" × N would all be the same brownish red without this)
const CHOICE_PALETTE: ReadonlyArray<{ fill: number; hover: number }> = [
  { fill: 0x4a5568, hover: 0x5d6a7a },
  { fill: 0x553a4a, hover: 0x684d5e },
  { fill: 0x3d5a3e, hover: 0x4e7050 },
  { fill: 0x5a4a28, hover: 0x6e5c38 },
  { fill: 0x3a3a5a, hover: 0x4a4a6e },
  { fill: 0x5a3a28, hover: 0x6e4838 },
];

function getEffectColors(description: string): { fill: number; hover: number } {
  const desc = description.toLowerCase();

  if (desc.includes("red mana"))   return { fill: 0x6e2d28, hover: 0x8c3c32 };
  if (desc.includes("blue mana"))  return { fill: 0x284164, hover: 0x325582 };
  if (desc.includes("green mana")) return { fill: 0x285037, hover: 0x326946 };
  if (desc.includes("white mana")) return { fill: 0x55555a, hover: 0x737378 };
  if (desc.includes("gold mana"))  return { fill: 0x645528, hover: 0x826e32 };
  if (desc.includes("black mana")) return { fill: 0x282832, hover: 0x373746 };

  if (desc.includes("attack")) {
    if (desc.includes("fire"))                    return { fill: 0xa04030, hover: 0xc05040 };
    if (desc.includes("ice") || desc.includes("cold")) return { fill: 0x4a7090, hover: 0x5a88a8 };
    return { fill: 0x8c5a32, hover: 0xa87040 };
  }
  if (desc.includes("block")) {
    if (desc.includes("fire")) return { fill: 0x824637, hover: 0x9a5847 };
    return { fill: 0x2e5a4b, hover: 0x3e7060 };
  }

  if (desc.includes("move"))      return { fill: 0x465537, hover: 0x566848 };
  if (desc.includes("influence")) return { fill: 0x55415f, hover: 0x6a5475 };
  if (desc.includes("heal"))      return { fill: 0x64734b, hover: 0x788860 };
  if (desc.includes("discard"))   return { fill: 0x5a3232, hover: 0x704040 };

  return { fill: 0x3c3732, hover: 0x4e4842 };
}

function formatEffectLabel(description: string): { label: string; sublabel?: string } {
  // "Discard X" — put the card name first so each wedge looks unique
  const discardMatch = description.match(/^Discard (.+)$/i);
  if (discardMatch?.[1]) {
    const name = discardMatch[1];
    return { label: name.charAt(0).toUpperCase() + name.slice(1), sublabel: "Discard" };
  }

  const desc = description.toLowerCase();

  // "Gain X mana" → "X / Mana"
  const manaMatch = desc.match(/gain (\w+) mana/);
  if (manaMatch?.[1]) {
    const color = manaMatch[1].charAt(0).toUpperCase() + manaMatch[1].slice(1);
    return { label: color, sublabel: "Mana" };
  }

  // "+N Something" or "N Something"
  const numMatch = description.match(/^\+?(\d+)\s+(.+)$/);
  if (numMatch?.[1] && numMatch[2]) {
    return { label: `+${numMatch[1]}`, sublabel: numMatch[2] };
  }

  // "Gain N Something"
  const gainMatch = description.match(/^Gain (\d+) (.+)$/i);
  if (gainMatch?.[1] && gainMatch[2]) {
    return { label: `+${gainMatch[1]}`, sublabel: gainMatch[2] };
  }

  if (description.length <= 12) return { label: description };

  const words = description.split(" ");
  if (words.length >= 2) {
    return { label: words[0] ?? description, sublabel: words.slice(1).join(" ") };
  }

  return { label: description };
}

export function ChoiceSelection() {
  const { state, sendAction, legalActions } = useGame();
  const player = useMyPlayer();
  const { state: cardInteractionState } = useCardInteraction();

  const choiceOptions = useMemo(() => extractChoiceOptions(legalActions), [legalActions]);
  const pendingInfo = player?.pending;
  const hasChoices = choiceOptions.length > 0;
  const canUndo = hasAction(legalActions, "Undo");
  const isInCombat = state?.combat !== null;

  const unifiedMenuHandling = cardInteractionState.type !== "idle";

  useRegisterOverlay(hasChoices && !unifiedMenuHandling);

  const handleSelectChoice = useCallback((choiceIndex: number) => {
    const option = choiceOptions.find(o => o.choiceIndex === choiceIndex);
    if (option) sendAction(option.action);
  }, [sendAction, choiceOptions]);

  const handleUndo = useCallback(() => {
    sendAction("Undo");
  }, [sendAction]);

  // Auto-confirm when there's only one option and no undo available.
  // Skip auto-confirm when canUndo: the user might want to go back, and
  // auto-selecting would immediately re-trigger the same state on undo.
  const singleChoiceIndex =
    hasChoices && !unifiedMenuHandling && !canUndo && choiceOptions.length === 1
      ? (choiceOptions[0]?.choiceIndex ?? null)
      : null;

  useEffect(() => {
    if (singleChoiceIndex !== null) {
      handleSelectChoice(singleChoiceIndex);
    }
  }, [singleChoiceIndex, handleSelectChoice]);

  const pieItems: PixiPieMenuItem[] = useMemo(() => {
    const pendingOptions = pendingInfo?.options ?? [];
    const raw = choiceOptions.map((opt, index) => {
      const description = pendingOptions[opt.choiceIndex] ?? `Option ${opt.choiceIndex + 1}`;
      return { id: String(opt.choiceIndex), description, index, ...formatEffectLabel(description) };
    });

    // When all options would get the same semantic color, use the per-index palette
    // so each wedge is visually distinct (e.g. "Discard X" × 4)
    const semanticColors = raw.map(r => getEffectColors(r.description));
    const allSameColor = raw.length > 1 && semanticColors.every(c => c.fill === semanticColors[0]!.fill);

    return raw.map(({ id, label, sublabel, index }) => {
      const colors = allSameColor
        ? CHOICE_PALETTE[index % CHOICE_PALETTE.length]!
        : semanticColors[index]!;
      return { id, label, sublabel, color: colors.fill, hoverColor: colors.hover };
    });
  }, [choiceOptions, pendingInfo?.options]);

  const handlePieSelect = useCallback((id: string) => {
    const index = parseInt(id, 10);
    if (!isNaN(index)) handleSelectChoice(index);
  }, [handleSelectChoice]);

  // Don't render if no choices, if UnifiedCardMenu is handling it, or if auto-confirming
  if (!hasChoices || unifiedMenuHandling || singleChoiceIndex !== null) {
    return null;
  }

  return (
    <PixiPieMenu
      items={pieItems}
      onSelect={handlePieSelect}
      onCancel={canUndo ? handleUndo : () => {}}
      overlayOpacity={isInCombat ? 0.4 : 0.7}
      centerLabel={canUndo ? "Undo" : undefined}
    />
  );
}
