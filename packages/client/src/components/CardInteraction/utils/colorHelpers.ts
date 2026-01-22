/**
 * Color Helpers for Card Interaction Menus
 *
 * Centralized color definitions and utilities for pie menu wedges.
 * Extracted from PixiCardActionMenu and ChoiceSelection.
 */

import type { ManaColor } from "@mage-knight/shared";

// ============================================================================
// Base Colors
// ============================================================================

/**
 * Core UI colors used across pie menus.
 */
export const UI_COLORS = {
  /** Stroke color for wedge borders */
  STROKE: 0x5c4a3a,
  /** Stroke color when hovering */
  STROKE_HOVER: 0xb49664,
  /** Primary text color */
  TEXT: 0xf0e6d2,
  /** Text color for disabled items */
  TEXT_DISABLED: 0x666666,
  /** Sublabel text color */
  TEXT_SUBLABEL: 0xb0a090,
  /** Glow effect color */
  GLOW: 0xffc864,
  /** Overlay background */
  OVERLAY: 0x0a0805,
} as const;

// ============================================================================
// Action Type Colors
// ============================================================================

/**
 * Colors for card action types (basic, powered, sideways).
 */
export const ACTION_COLORS = {
  /** Basic effect - warm brown */
  BASIC: {
    fill: 0x3c3228,
    hover: 0x554638,
  },
  /** Powered effect - purple tint */
  POWERED: {
    fill: 0x463250,
    hover: 0x5f466e,
  },
  /** Sideways play - blue-gray */
  SIDEWAYS: {
    fill: 0x2d3c4b,
    hover: 0x3c5064,
  },
  /** Disabled state */
  DISABLED: {
    fill: 0x232328,
    hover: 0x232328,
  },
} as const;

/**
 * Get colors for a card action type.
 */
export function getActionColors(
  type: "basic" | "powered" | "sideways",
  disabled: boolean
): { fill: number; hover: number } {
  if (disabled) {
    return ACTION_COLORS.DISABLED;
  }
  switch (type) {
    case "basic":
      return ACTION_COLORS.BASIC;
    case "powered":
      return ACTION_COLORS.POWERED;
    case "sideways":
      return ACTION_COLORS.SIDEWAYS;
  }
}

// ============================================================================
// Mana Colors
// ============================================================================

/**
 * Colors for each mana type.
 */
export const MANA_COLORS: Record<
  ManaColor,
  { fill: number; hover: number; stroke: number }
> = {
  red: { fill: 0x6e2d28, hover: 0x8c3c32, stroke: 0xe76450 },
  blue: { fill: 0x284164, hover: 0x325582, stroke: 0x5096dc },
  green: { fill: 0x285037, hover: 0x326946, stroke: 0x50c878 },
  white: { fill: 0x55555a, hover: 0x737378, stroke: 0xf0f0f5 },
  gold: { fill: 0x645528, hover: 0x826e32, stroke: 0xf1c432 },
  black: { fill: 0x282832, hover: 0x373746, stroke: 0x8c8ca0 },
};

/**
 * Get colors for a mana type.
 */
export function getManaColors(
  color: ManaColor
): { fill: number; hover: number; stroke: number } {
  return MANA_COLORS[color] ?? { fill: 0x464650, hover: 0x5a5a68, stroke: 0x888888 };
}

// ============================================================================
// Effect Choice Colors
// ============================================================================

/**
 * Get colors for an effect choice based on its type and description.
 * Used by the effect choice wedges when engine returns a pending choice.
 */
export function getEffectColors(
  type: string,
  description: string
): { fill: number; hover: number } {
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
  if (type.includes("attack") || desc.includes("attack")) {
    if (desc.includes("fire")) {
      return { fill: 0xa04030, hover: 0xc05040 };
    }
    if (desc.includes("ice") || desc.includes("cold")) {
      return { fill: 0x4a7090, hover: 0x5a88a8 };
    }
    return { fill: 0x8c5a32, hover: 0xa87040 };
  }
  if (type.includes("block") || desc.includes("block")) {
    if (desc.includes("fire")) {
      return { fill: 0x824637, hover: 0x9a5847 };
    }
    return { fill: 0x2e5a4b, hover: 0x3e7060 };
  }

  // Movement - earthy brown-green
  if (type.includes("move") || desc.includes("move")) {
    return { fill: 0x465537, hover: 0x566848 };
  }

  // Influence - dusty purple
  if (type.includes("influence") || desc.includes("influence")) {
    return { fill: 0x55415f, hover: 0x6a5475 };
  }

  // Healing - moss green
  if (type.includes("heal") || desc.includes("heal")) {
    return { fill: 0x64734b, hover: 0x788860 };
  }

  // Default - warm neutral brown
  return { fill: 0x3c3732, hover: 0x4e4842 };
}

// ============================================================================
// Label Formatting
// ============================================================================

/**
 * Format effect description into label + sublabel for pie menu display.
 * E.g., "Gain blue mana" -> { label: "Blue", sublabel: "Mana" }
 * E.g., "+3 Attack" -> { label: "+3", sublabel: "Attack" }
 */
export function formatEffectLabel(
  description: string
): { label: string; sublabel?: string } {
  const desc = description.toLowerCase();

  // Mana effects: "Gain X mana"
  const manaMatch = desc.match(/gain (\w+) mana/);
  if (manaMatch && manaMatch[1]) {
    const color = manaMatch[1].charAt(0).toUpperCase() + manaMatch[1].slice(1);
    return { label: color, sublabel: "Mana" };
  }

  // Numeric effects: "+N Something" or "N Something"
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

/**
 * Capitalize first letter of a string.
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
