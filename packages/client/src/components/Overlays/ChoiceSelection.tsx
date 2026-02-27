import { useMemo, useCallback } from "react";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { useCardMenuPosition } from "../../context/CardMenuPositionContext";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { useCardInteraction } from "../CardInteraction";
import { extractChoiceOptions, hasAction } from "../../rust/legalActionUtils";
import { PixiPieMenu, type PixiPieMenuItem } from "../CardActionMenu";
import "./ChoiceSelection.css";

/**
 * Map effect types to hex colors for PixiJS rendering.
 * Returns { fill, hover } colors for the wedge.
 */
function getEffectColors(description: string): { fill: number; hover: number } {
  const desc = description.toLowerCase();

  // Check for mana-related effects
  if (desc.includes("red mana")) {
    return { fill: 0x6e2d28, hover: 0x8c3c32 };
  }
  if (desc.includes("blue mana")) {
    return { fill: 0x284164, hover: 0x325582 };
  }
  if (desc.includes("green mana")) {
    return { fill: 0x285037, hover: 0x326946 };
  }
  if (desc.includes("white mana")) {
    return { fill: 0x55555a, hover: 0x737378 };
  }
  if (desc.includes("gold mana")) {
    return { fill: 0x645528, hover: 0x826e32 };
  }
  if (desc.includes("black mana")) {
    return { fill: 0x282832, hover: 0x373746 };
  }

  // Check for combat effects
  if (desc.includes("attack")) {
    if (desc.includes("fire")) {
      return { fill: 0xa04030, hover: 0xc05040 };
    }
    if (desc.includes("ice") || desc.includes("cold")) {
      return { fill: 0x4a7090, hover: 0x5a88a8 };
    }
    return { fill: 0x8c5a32, hover: 0xa87040 };
  }
  if (desc.includes("block")) {
    if (desc.includes("fire")) {
      return { fill: 0x824637, hover: 0x9a5847 };
    }
    return { fill: 0x2e5a4b, hover: 0x3e7060 };
  }

  // Movement - earthy brown-green
  if (desc.includes("move")) {
    return { fill: 0x465537, hover: 0x566848 };
  }

  // Influence - dusty purple
  if (desc.includes("influence")) {
    return { fill: 0x55415f, hover: 0x6a5475 };
  }

  // Healing - moss green
  if (desc.includes("heal")) {
    return { fill: 0x64734b, hover: 0x788860 };
  }

  // Discard - muted red
  if (desc.includes("discard")) {
    return { fill: 0x5a3232, hover: 0x704040 };
  }

  // Default - warm neutral brown
  return { fill: 0x3c3732, hover: 0x4e4842 };
}

// Format effect description into label + sublabel for pie menu
function formatEffectLabel(description: string): { label: string; sublabel?: string } {
  const desc = description.toLowerCase();

  // Mana effects: "Gain X mana"
  const manaMatch = desc.match(/gain (\w+) mana/);
  if (manaMatch && manaMatch[1]) {
    const color = manaMatch[1].charAt(0).toUpperCase() + manaMatch[1].slice(1);
    return { label: color, sublabel: "Mana" };
  }

  // Numeric effects: "+N Something"
  const numMatch = description.match(/^\+?(\d+)\s+(.+)$/);
  if (numMatch && numMatch[1] && numMatch[2]) {
    return { label: `+${numMatch[1]}`, sublabel: numMatch[2] };
  }

  // "Gain N Something"
  const gainMatch = description.match(/^Gain (\d+) (.+)$/i);
  if (gainMatch && gainMatch[1] && gainMatch[2]) {
    return { label: `+${gainMatch[1]}`, sublabel: gainMatch[2] };
  }

  // Short descriptions can just be the label
  if (description.length <= 12) {
    return { label: description };
  }

  // Fallback: first word as label, rest as sublabel
  const words = description.split(" ");
  if (words.length >= 2) {
    return { label: words[0] ?? description, sublabel: words.slice(1).join(" ") };
  }

  return { label: description };
}

export function ChoiceSelection() {
  const { state, sendAction, legalActions } = useGame();
  const player = useMyPlayer();
  const { position: savedPosition } = useCardMenuPosition();
  const { state: cardInteractionState } = useCardInteraction();

  // Derive choices from legalActions — only show when server actually has ResolveChoice actions
  const choiceOptions = useMemo(() => extractChoiceOptions(legalActions), [legalActions]);
  const pendingInfo = player?.pending;
  const hasChoices = choiceOptions.length > 0;
  const canUndo = hasAction(legalActions, "Undo");
  const isInCombat = state?.combat !== null;

  // Don't render if UnifiedCardMenu is handling the interaction
  const unifiedMenuHandling = cardInteractionState.type !== "idle";

  // Register this component as an active overlay to disable background interactions
  useRegisterOverlay(hasChoices && !unifiedMenuHandling);

  const handleSelectChoice = useCallback((choiceIndex: number) => {
    // Find the actual LegalAction to send (guaranteed to be accepted by the server)
    const option = choiceOptions.find(o => o.choiceIndex === choiceIndex);
    if (option) {
      sendAction(option.action);
    }
  }, [sendAction, choiceOptions]);

  const handleUndo = useCallback(() => {
    sendAction("Undo");
  }, [sendAction]);

  // Build pie items from pending.options labels, but only for choice indices that are legal
  const pieItems: PixiPieMenuItem[] = useMemo(() => {
    const pendingOptions = pendingInfo?.options ?? [];
    return choiceOptions.map((opt) => {
      // Use the pending option description if available, fall back to index
      const description = pendingOptions[opt.choiceIndex] ?? `Option ${opt.choiceIndex + 1}`;
      const { label, sublabel } = formatEffectLabel(description);
      const colors = getEffectColors(description);
      return {
        id: String(opt.choiceIndex),
        label,
        sublabel,
        color: colors.fill,
        hoverColor: colors.hover,
      };
    });
  }, [choiceOptions, pendingInfo?.options]);

  const handlePieSelect = useCallback((id: string) => {
    const index = parseInt(id, 10);
    if (!isNaN(index)) {
      handleSelectChoice(index);
    }
  }, [handleSelectChoice]);

  // Don't render if no choices or if UnifiedCardMenu is handling it
  if (!hasChoices || unifiedMenuHandling) {
    return null;
  }

  return (
    <PixiPieMenu
      items={pieItems}
      onSelect={handlePieSelect}
      onCancel={canUndo ? handleUndo : () => {}}
      position={savedPosition ?? undefined}
      overlayOpacity={isInCombat ? 0.4 : 0.7}
      centerLabel={canUndo ? "Undo" : undefined}
    />
  );
}
