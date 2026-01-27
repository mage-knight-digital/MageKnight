/**
 * CardInteraction module
 *
 * Unified card interaction system with state machine for managing
 * card action menu → mana selection → effect choice flow.
 */

// Types
export type {
  CardInteractionState,
  CardInteractionAction,
} from "./types";
export { isActiveState, hasSourceRect, INITIAL_STATE } from "./types";

// Context and Provider
export { CardInteractionContext, type CardInteractionContextValue } from "./CardInteractionContext";
export { CardInteractionProvider } from "./CardInteractionProvider";

// Hooks
export { useCardInteraction, useCardInteractionOptional } from "./useCardInteraction";

// Rendering
export { PieMenuRenderer, type PieMenuWedge, type PieMenuRendererProps } from "./PieMenuRenderer";

// Color Helpers
export {
  UI_COLORS,
  ACTION_COLORS,
  MANA_COLORS,
  getActionColors,
  getManaColors,
  getEffectColors,
  formatEffectLabel,
  capitalize,
} from "./utils/colorHelpers";

// Wedge Configs
export {
  buildActionSelectConfig,
  buildManaSelectConfig,
  buildEffectChoiceConfig,
  type ActionSelectConfig,
  type ActionSelectWedge,
  type ManaSelectConfig,
  type ManaSelectWedge,
  type EffectChoiceConfig,
  type EffectChoiceWedge,
} from "./wedgeConfigs";

// Unified Card Menu
export { UnifiedCardMenu } from "./UnifiedCardMenu";

// Utilities
export { getAvailableManaSources } from "./utils/manaSourceHelpers";
