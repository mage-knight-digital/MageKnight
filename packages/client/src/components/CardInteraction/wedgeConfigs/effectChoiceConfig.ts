/**
 * Effect Choice Wedge Configuration
 *
 * Builds wedges for engine choice selection menu.
 * Used when a card effect returns a pending choice.
 */

import type { ClientPendingChoice } from "@mage-knight/shared";
import type { PieMenuWedge } from "../PieMenuRenderer";
import { getEffectColors, formatEffectLabel } from "../utils/colorHelpers";

// ============================================================================
// Types
// ============================================================================

export interface EffectChoiceWedge extends PieMenuWedge {
  /** The choice index this wedge represents */
  readonly choiceIndex: number;
}

export interface EffectChoiceConfig {
  readonly wedges: readonly EffectChoiceWedge[];
  /** Center label (usually "Undo" if available, or card name) */
  readonly centerLabel?: string;
}

// ============================================================================
// Config Builder
// ============================================================================

/**
 * Build effect choice wedges from a pending choice.
 *
 * @param pendingChoice The pending choice from the engine
 * @param canUndo Whether undo is available (shows "Undo" in center)
 */
export function buildEffectChoiceConfig(
  pendingChoice: ClientPendingChoice,
  canUndo: boolean = false
): EffectChoiceConfig {
  const wedges: EffectChoiceWedge[] = pendingChoice.options.map((option, index) => {
    const { label, sublabel } = formatEffectLabel(option.description);
    const colors = getEffectColors(option.type, option.description);

    return {
      id: `choice-${index}`,
      label,
      sublabel,
      choiceIndex: index,
      color: colors.fill,
      hoverColor: colors.hover,
      weight: 1,
    };
  });

  return {
    wedges,
    centerLabel: canUndo ? "Undo" : undefined,
  };
}
