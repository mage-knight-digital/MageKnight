/**
 * Mana Select Wedge Configuration
 *
 * Builds wedges for mana source selection menu.
 * Used when powering a card that requires mana selection.
 */

import type { ManaSourceInfo, ManaColor } from "@mage-knight/shared";
import {
  MANA_SOURCE_DIE,
  MANA_SOURCE_CRYSTAL,
  MANA_SOURCE_TOKEN,
  MANA_GOLD,
} from "@mage-knight/shared";
import type { PieMenuWedge } from "../PieMenuRenderer";
import { getManaColors, capitalize } from "../utils/colorHelpers";

// ============================================================================
// Types
// ============================================================================

export interface ManaSelectWedge extends PieMenuWedge {
  /** The mana source this wedge represents */
  readonly source: ManaSourceInfo;
}

export interface ManaSelectConfig {
  readonly wedges: readonly ManaSelectWedge[];
  /** Center label for the menu */
  readonly centerLabel: string;
}

// ============================================================================
// Config Builder
// ============================================================================

/**
 * Build mana source selection wedges.
 *
 * @param sources Available mana sources to choose from
 * @param isBlackStep For spells: true if selecting black mana (first step)
 */
export function buildManaSelectConfig(
  sources: readonly ManaSourceInfo[],
  isBlackStep: boolean = false
): ManaSelectConfig {
  const wedges: ManaSelectWedge[] = sources.map((source, index) => {
    const colors = getManaColors(source.color as ManaColor);
    const { label, sublabel } = getManaSourceLabel(source);

    return {
      id: `mana-${index}`,
      label,
      sublabel,
      source,
      color: colors.fill,
      hoverColor: colors.hover,
      strokeColor: colors.stroke,
      weight: 1,
    };
  });

  return {
    wedges,
    centerLabel: isBlackStep ? "Black Mana" : "Back",
  };
}

/**
 * Get display label for a mana source.
 */
function getManaSourceLabel(source: ManaSourceInfo): { label: string; sublabel: string } {
  const colorLabel = capitalize(source.color);

  switch (source.type) {
    case MANA_SOURCE_CRYSTAL:
      return { label: colorLabel, sublabel: "Crystal" };
    case MANA_SOURCE_TOKEN:
      return { label: colorLabel, sublabel: "Token" };
    case MANA_SOURCE_DIE:
      if (source.color === MANA_GOLD) {
        return { label: "Gold", sublabel: "Wild Die" };
      }
      return { label: colorLabel, sublabel: "Die" };
    default:
      return { label: colorLabel, sublabel: "" };
  }
}
