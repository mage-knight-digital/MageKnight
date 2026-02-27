/**
 * Effect Choice Wedge Configuration
 *
 * Builds wedges for engine choice selection menu.
 * Used when a card effect returns a pending choice.
 */

import type { RustPendingInfo } from "../types";
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
 * Build effect choice wedges from the Rust engine's pending info.
 *
 * @param pendingInfo The pending info from the Rust engine (label + string options)
 * @param canUndo Whether undo is available (shows "Undo" in center)
 */
export function buildEffectChoiceConfig(
  pendingInfo: RustPendingInfo,
  canUndo: boolean = false
): EffectChoiceConfig {
  const wedges: EffectChoiceWedge[] = pendingInfo.options.map((description, index) => {
    const { label, sublabel } = formatEffectLabel(description);
    // Use the description for both type and description since Rust only sends strings
    const colors = getEffectColors(description, description);

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
