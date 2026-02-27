/**
 * UnifiedCardMenu - Main unified card interaction component
 *
 * Renders the appropriate pie menu based on card interaction state:
 * - action-select: Basic/Powered/Sideways options
 * - mana-select: Mana source selection (for powered effects)
 * - effect-choice: Engine choice selection (when card returns pendingChoice)
 *
 * The card stays in center throughout all states, providing a seamless
 * interaction experience.
 */

import { useCallback, useMemo, useEffect } from "react";
import {
  PLAY_CARD_ACTION,
  type ManaSourceInfo,
  type ManaColor,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { hasAction, extractChoiceOptions } from "../../rust/legalActionUtils";
import type { CardActionGroup } from "../../rust/legalActionUtils";
import { useRegisterOverlay } from "../../contexts/OverlayContext";
import { useCardMenuPosition } from "../../context/CardMenuPositionContext";
import { playSound } from "../../utils/audioManager";
import { useCardInteraction } from "./useCardInteraction";
import { PieMenuRenderer } from "./PieMenuRenderer";
import {
  buildActionSelectConfig,
  buildManaSelectConfig,
  buildEffectChoiceConfig,
  type ActionSelectWedge,
  type ManaSelectWedge,
  type EffectChoiceWedge,
} from "./wedgeConfigs";
import { getAvailableManaSources } from "./utils/manaSourceHelpers";

// ============================================================================
// Constants - must match PixiFloatingHand calculations
// ============================================================================

const CARD_ASPECT = 0.667;
const CARD_FAN_BASE_SCALE = 0.25;
const MENU_CARD_SCALE = 1.4;

// ============================================================================
// Component
// ============================================================================

export function UnifiedCardMenu() {
  const { state: gameState, sendAction, legalActions } = useGame();
  const player = useMyPlayer();
  const { state: interactionState, dispatch } = useCardInteraction();
  const { setPosition, visualScale } = useCardMenuPosition();

  // Register as overlay when menu is open
  const isMenuOpen = interactionState.type !== "idle";
  useRegisterOverlay(isMenuOpen);

  // Track mana source selection for sending action
  // This is needed because reducer transitions to "completing" but we need
  // the source to send the action
  const lastManaSourceRef = useMemo(
    () => ({ current: null as ManaSourceInfo | null }),
    []
  );
  const lastBlackSourceRef = useMemo(
    () => ({ current: null as ManaSourceInfo | null }),
    []
  );

  // Get available mana sources for current state
  const manaSources = useMemo(() => {
    if (
      interactionState.type !== "action-select" &&
      interactionState.type !== "mana-select"
    ) {
      return [];
    }
    if (!gameState || !player) return [];

    const playability = interactionState.playability;
    if (!playability.requiredMana) return [];

    // In mana-select state, use the required color from state
    if (interactionState.type === "mana-select") {
      return getAvailableManaSources(
        gameState,
        player,
        interactionState.requiredColor
      );
    }

    // In action-select, compute for powered effect
    return getAvailableManaSources(
      gameState,
      player,
      playability.requiredMana as ManaColor
    );
  }, [interactionState, gameState, player]);

  // Determine if we're in combat
  const isInCombat = gameState?.combat !== null;

  // Can undo (for effect choice state) — derive from legalActions
  const canUndo = hasAction(legalActions, "Undo");

  // Save position for ChoiceSelection fallback (during transition)
  useEffect(() => {
    if (
      interactionState.type !== "idle" &&
      "sourceRect" in interactionState
    ) {
      const rect = interactionState.sourceRect;
      setPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    }
  }, [interactionState, setPosition]);

  // Derive choice options from legalActions (must be before the useEffect that references it)
  const choiceOptions = useMemo(() => extractChoiceOptions(legalActions), [legalActions]);

  // Watch for pending choices from the Rust engine or complete the action.
  // We use choiceOptions (derived from legalActions) rather than player.pending
  // because legalActions update atomically with server responses, avoiding races
  // where stale player.pending re-triggers the effect-choice state.
  useEffect(() => {
    if (interactionState.type === "completing") {
      if (choiceOptions.length > 0 && player?.pending) {
        // Server responded with new choice options — transition to effect-choice
        dispatch({
          type: "ENGINE_CHOICE_REQUIRED",
          pendingChoice: player.pending,
        });
      } else if (choiceOptions.length === 0 && !player?.pending) {
        // No pending and no choice actions — action fully completed
        dispatch({ type: "ACTION_COMPLETED" });
      }
      // Otherwise: still waiting for server response (stale state), do nothing
    }
  }, [interactionState.type, choiceOptions.length, player?.pending, dispatch]);

  // Handle cancel
  const handleCancel = useCallback(() => {
    if (interactionState.type === "mana-select") {
      dispatch({ type: "BACK_TO_ACTION_SELECT" });
    } else if (interactionState.type === "effect-choice" && canUndo) {
      sendAction("Undo");
      dispatch({ type: "ACTION_COMPLETED" });
    } else {
      dispatch({ type: "CLOSE_MENU" });
    }
  }, [interactionState.type, canUndo, dispatch, sendAction]);

  // Handle action selection
  const handleActionSelect = useCallback(
    (wedgeId: string, wedge: ActionSelectWedge) => {
      if (interactionState.type !== "action-select") return;

      playSound("cardPlay");

      // Look up the pre-computed LegalAction from the _rustActions group
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rustActions: CardActionGroup | undefined =
        interactionState.playability
          ? (interactionState.playability as any)["_rustActions"] as CardActionGroup | undefined
          : undefined;

      if (wedge.actionType === "basic") {
        if (rustActions?.basic) {
          sendAction(rustActions.basic);
        }
        dispatch({ type: "SELECT_BASIC" });
      } else if (wedge.actionType === "powered") {
        if (rustActions) {
          // Each powered variant is a separate LegalAction with mana pre-selected.
          // If there's only one powered option, send it directly.
          // If multiple, we use the wedge's manaColor to find the right one.
          const manaColor = wedge.manaColor;
          const match = manaColor
            ? rustActions.powered.find(p => p.manaColor === manaColor)
            : rustActions.powered[0];
          if (match) {
            sendAction(match.action);
            dispatch({ type: "SELECT_BASIC" }); // Skip mana-select, go straight to completing
          }
        }
      } else if (wedge.actionType === "sideways" && wedge.sidewaysAs) {
        if (rustActions) {
          const match = rustActions.sideways.find(s => s.sidewaysAs === wedge.sidewaysAs);
          if (match) {
            sendAction(match.action);
          }
        }
        dispatch({ type: "SELECT_SIDEWAYS", as: wedge.sidewaysAs });
      }
    },
    [interactionState, dispatch, sendAction]
  );

  // Handle mana source selection
  const handleManaSelect = useCallback(
    (wedgeId: string, wedge: ManaSelectWedge) => {
      if (interactionState.type !== "mana-select") return;

      playSound("cardPlay");

      const source = wedge.source;

      if (interactionState.spellStep === "black") {
        // Save black source and transition to color step
        lastBlackSourceRef.current = source;
        dispatch({ type: "SELECT_MANA_SOURCE", source });
      } else if (interactionState.spellStep === "color") {
        // Spell complete: send action with both sources
        const blackSource = interactionState.blackSource ?? lastBlackSourceRef.current;
        if (blackSource) {
          sendAction({
            type: PLAY_CARD_ACTION,
            cardId: interactionState.cardId,
            powered: true,
            manaSources: [blackSource, source],
          });
        }
        lastManaSourceRef.current = source;
        dispatch({ type: "SELECT_MANA_SOURCE", source });
      } else {
        // Action card: send action with single source
        sendAction({
          type: PLAY_CARD_ACTION,
          cardId: interactionState.cardId,
          powered: true,
          manaSource: source,
        });
        lastManaSourceRef.current = source;
        dispatch({ type: "SELECT_MANA_SOURCE", source });
      }
    },
    [interactionState, dispatch, sendAction, lastBlackSourceRef, lastManaSourceRef]
  );

  // Handle effect choice selection — send the actual LegalAction from legalActions
  const handleChoiceSelect = useCallback(
    (wedgeId: string, wedge: EffectChoiceWedge) => {
      if (interactionState.type !== "effect-choice") return;

      playSound("cardPlay");

      // Find the actual legal action for this choice index
      const option = choiceOptions.find(o => o.choiceIndex === wedge.choiceIndex);
      if (option) {
        sendAction(option.action);
      }
      dispatch({ type: "SELECT_CHOICE", choiceIndex: wedge.choiceIndex });
    },
    [interactionState.type, dispatch, sendAction, choiceOptions]
  );

  // Build wedge config based on state
  const menuConfig = useMemo(() => {
    if (interactionState.type === "action-select") {
      return {
        type: "action" as const,
        config: buildActionSelectConfig(interactionState.playability, isInCombat),
      };
    }

    if (interactionState.type === "mana-select") {
      // Use sources from state if available, otherwise compute from game state
      const sources =
        interactionState.availableSources.length > 0
          ? interactionState.availableSources
          : manaSources;
      const isBlackStep = interactionState.spellStep === "black";
      return {
        type: "mana" as const,
        config: buildManaSelectConfig(sources, isBlackStep),
      };
    }

    if (interactionState.type === "effect-choice") {
      return {
        type: "choice" as const,
        config: buildEffectChoiceConfig(interactionState.pendingChoice, canUndo),
      };
    }

    return null;
  }, [interactionState, isInCombat, manaSources, canUndo]);

  // Handle wedge selection
  const handleSelect = useCallback(
    (id: string) => {
      if (!menuConfig) return;

      if (menuConfig.type === "action") {
        const wedge = menuConfig.config.wedges.find((w) => w.id === id);
        if (wedge && !wedge.disabled) {
          handleActionSelect(id, wedge);
        }
      } else if (menuConfig.type === "mana") {
        const wedge = menuConfig.config.wedges.find((w) => w.id === id);
        if (wedge) {
          handleManaSelect(id, wedge);
        }
      } else if (menuConfig.type === "choice") {
        const wedge = menuConfig.config.wedges.find((w) => w.id === id);
        if (wedge) {
          handleChoiceSelect(id, wedge);
        }
      }
    },
    [menuConfig, handleActionSelect, handleManaSelect, handleChoiceSelect]
  );

  // Menu position: screen center (card animates to center when menu opens)
  const menuPosition = useMemo(() => {
    if (interactionState.type === "idle") return undefined;
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }, [interactionState.type]);

  // Calculate sizes based on viewport and card
  // Must match PixiFloatingHand's actual card size, which varies by view mode
  // visualScale is set by PixiFloatingHand: 1.0 for ready mode, ~2.0 for focus mode
  const sizes = useMemo(() => {
    const screenHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    const vmin = Math.min(screenWidth, screenHeight);
    // Base card size is what ready mode uses
    const baseCardHeight = screenHeight * CARD_FAN_BASE_SCALE * MENU_CARD_SCALE;
    // Scale up for focus mode (visualScale > 1)
    const cardHeight = Math.round(baseCardHeight * visualScale);
    const cardWidth = Math.round(cardHeight * CARD_ASPECT);
    // Card covers a circular area roughly equal to its half-diagonal
    const cardCoverRadius = Math.max(cardWidth, cardHeight) / 2;
    // Outer radius: extend past the card with visible wedge area
    // Scale the wedge thickness with visualScale so it stays proportional
    const wedgeVisibleThickness = Math.max(90, vmin * 0.13) * visualScale;
    const outerRadius = cardCoverRadius + wedgeVisibleThickness;
    // Font sizes scale with viewport and visualScale
    const labelFontSize = Math.round(Math.max(16, vmin * 0.018) * visualScale);
    const sublabelFontSize = Math.round(Math.max(12, vmin * 0.012) * visualScale);
    return { outerRadius, cardCoverRadius, labelFontSize, sublabelFontSize, cardWidth, cardHeight };
  }, [visualScale]);

  // Don't render if idle or completing
  if (
    interactionState.type === "idle" ||
    interactionState.type === "completing" ||
    !menuConfig
  ) {
    return null;
  }

  // For effect-choice state, we need to render the card in the center since it's no longer in the hand
  const showCenterCard = interactionState.type === "effect-choice";
  const centerCardId = showCenterCard ? interactionState.cardId : undefined;

  return (
    <PieMenuRenderer
      wedges={menuConfig.config.wedges}
      onSelect={handleSelect}
      onCancel={handleCancel}
      position={menuPosition}
      outerRadius={sizes.outerRadius}
      innerRadius={0}
      labelInnerRadius={sizes.cardCoverRadius}
      labelFontSize={sizes.labelFontSize}
      sublabelFontSize={sizes.sublabelFontSize}
      overlayOpacity={isInCombat ? 0.4 : 0.7}
      centerLabel={
        menuConfig.type === "mana"
          ? menuConfig.config.centerLabel
          : menuConfig.type === "choice"
          ? menuConfig.config.centerLabel
          : undefined
      }
      centerCardId={centerCardId}
      cardWidth={sizes.cardWidth}
      cardHeight={sizes.cardHeight}
    />
  );
}
