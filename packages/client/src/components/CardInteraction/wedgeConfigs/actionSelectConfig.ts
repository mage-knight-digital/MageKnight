/**
 * Action Select Wedge Configuration
 *
 * Builds wedges for the card action selection menu:
 * Basic (top) → Attack → Block → Powered (bottom) → Influence → Move
 */

import type { PlayableCard, SidewaysAs } from "@mage-knight/shared";
import {
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_ATTACK,
  PLAY_SIDEWAYS_AS_BLOCK,
} from "@mage-knight/shared";
import type { PieMenuWedge } from "../PieMenuRenderer";
import { getActionColors } from "../utils/colorHelpers";

// ============================================================================
// Types
// ============================================================================

export interface ActionSelectWedge extends PieMenuWedge {
  /** The type of action this wedge represents */
  readonly actionType: "basic" | "powered" | "sideways";
  /** For sideways actions, which type */
  readonly sidewaysAs?: SidewaysAs;
}

export interface ActionSelectConfig {
  readonly wedges: readonly ActionSelectWedge[];
}

// ============================================================================
// Config Builder
// ============================================================================

/**
 * Build action selection wedges based on card playability.
 *
 * Layout (6 wedges, clockwise from top):
 *   Basic (top) → Attack (right-top) → Block (right-bottom) →
 *   Powered (bottom) → Influence (left-bottom) → Move (left-top)
 */
export function buildActionSelectConfig(
  playability: PlayableCard,
  isInCombat: boolean
): ActionSelectConfig {
  const wedges: ActionSelectWedge[] = [];

  // Basic effect (top)
  const basicColors = getActionColors("basic", !playability.canPlayBasic);
  wedges.push({
    id: "basic",
    label: "Basic",
    actionType: "basic",
    disabled: !playability.canPlayBasic,
    color: basicColors.fill,
    hoverColor: basicColors.hover,
    weight: 2,
  });

  // Attack sideways (right-top) - only in combat
  const attackOption = playability.sidewaysOptions?.find(
    (o) => o.as === PLAY_SIDEWAYS_AS_ATTACK
  );
  const attackDisabled = !playability.canPlaySideways || !attackOption || !isInCombat;
  const attackColors = getActionColors("sideways", attackDisabled);
  wedges.push({
    id: "sideways-attack",
    label: `+${attackOption?.value ?? 1} Attack`,
    actionType: "sideways",
    sidewaysAs: PLAY_SIDEWAYS_AS_ATTACK,
    disabled: attackDisabled,
    color: attackColors.fill,
    hoverColor: attackColors.hover,
    weight: 1,
  });

  // Block sideways (right-bottom) - only in combat
  const blockOption = playability.sidewaysOptions?.find(
    (o) => o.as === PLAY_SIDEWAYS_AS_BLOCK
  );
  const blockDisabled = !playability.canPlaySideways || !blockOption || !isInCombat;
  const blockColors = getActionColors("sideways", blockDisabled);
  wedges.push({
    id: "sideways-block",
    label: `+${blockOption?.value ?? 1} Block`,
    actionType: "sideways",
    sidewaysAs: PLAY_SIDEWAYS_AS_BLOCK,
    disabled: blockDisabled,
    color: blockColors.fill,
    hoverColor: blockColors.hover,
    weight: 1,
  });

  // Powered effect (bottom)
  const poweredColors = getActionColors("powered", !playability.canPlayPowered);
  wedges.push({
    id: "powered",
    label: "Powered",
    actionType: "powered",
    disabled: !playability.canPlayPowered,
    color: poweredColors.fill,
    hoverColor: poweredColors.hover,
    weight: 2,
  });

  // Influence sideways (left-bottom)
  const influenceOption = playability.sidewaysOptions?.find(
    (o) => o.as === PLAY_SIDEWAYS_AS_INFLUENCE
  );
  const influenceDisabled = !playability.canPlaySideways || !influenceOption;
  const influenceColors = getActionColors("sideways", influenceDisabled);
  wedges.push({
    id: "sideways-influence",
    label: `+${influenceOption?.value ?? 1} Influence`,
    actionType: "sideways",
    sidewaysAs: PLAY_SIDEWAYS_AS_INFLUENCE,
    disabled: influenceDisabled,
    color: influenceColors.fill,
    hoverColor: influenceColors.hover,
    weight: 1,
  });

  // Move sideways (left-top)
  const moveOption = playability.sidewaysOptions?.find(
    (o) => o.as === PLAY_SIDEWAYS_AS_MOVE
  );
  const moveDisabled = !playability.canPlaySideways || !moveOption;
  const moveColors = getActionColors("sideways", moveDisabled);
  wedges.push({
    id: "sideways-move",
    label: `+${moveOption?.value ?? 1} Move`,
    actionType: "sideways",
    sidewaysAs: PLAY_SIDEWAYS_AS_MOVE,
    disabled: moveDisabled,
    color: moveColors.fill,
    hoverColor: moveColors.hover,
    weight: 1,
  });

  return { wedges };
}
