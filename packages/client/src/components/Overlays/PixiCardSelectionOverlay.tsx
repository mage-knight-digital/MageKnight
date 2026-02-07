/**
 * PixiCardSelectionOverlay - Pure PixiJS card selection modal
 *
 * Renders the entire card selection UI (overlay, panel, cards, buttons) in PixiJS,
 * following the PixiOfferView pattern. Returns null — all rendering happens
 * on the shared overlayLayer via usePixiApp().
 *
 * Used for rest completion, discard-as-cost, Crystal Joy reclaim, etc.
 */

import { useEffect, useRef, useCallback, useId } from "react";
import { Container, Graphics, Text, Sprite } from "pixi.js";
import type { CardId } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { getCardTexture, getPlaceholderTexture } from "../../utils/pixiTextureLoader";
import { addToOverlayLayer, PIXI_Z_INDEX } from "../../utils/pixiLayers";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import type { CardSelectionOverlayProps } from "./CardSelectionOverlay";

// ============================================
// Constants
// ============================================

const COLORS = {
  OVERLAY: 0x0f0c0a,
  PANEL_BG: 0x1a1815,
  PANEL_BORDER: 0x3d3530,
  TEXT: 0xf0e6d2,
  TEXT_DIM: 0x888888,
  TEXT_COUNT: 0xf39c12,
  CARD_BORDER: 0x555555,
  CARD_HOVER: 0xf39c12,
  CARD_SELECTED: 0x2ecc71,
  CARD_DISABLED: 0x333333,
  CHECKMARK_BG: 0x2ecc71,
  BTN_PRIMARY: 0x2ecc71,
  BTN_PRIMARY_HOVER: 0x27ae60,
  BTN_PRIMARY_BORDER: 0x27ae60,
  BTN_PRIMARY_DISABLED_BG: 0x1a1a3e,
  BTN_PRIMARY_DISABLED_BORDER: 0x333333,
  BTN_PRIMARY_DISABLED_TEXT: 0x666666,
  BTN_SECONDARY: 0x1a1a3e,
  BTN_SECONDARY_HOVER: 0x2a2a5e,
  BTN_SECONDARY_BORDER: 0x333333,
};

const CARD_WIDTH = 140;
const CARD_HEIGHT = 200;
const CARD_GAP = 16;
const PANEL_PADDING = 32;
const BUTTON_HEIGHT = 36;
const BUTTON_GAP = 12;
const BUTTON_PADDING_X = 24;
const CHECKMARK_SIZE = 28;

// ============================================
// Component
// ============================================

export function PixiCardSelectionOverlay({
  cards,
  instruction,
  minSelect = 1,
  maxSelect = 1,
  canSkip = false,
  skipText = "Skip",
  onSelect,
  onSkip,
  onUndo,
  cardFilter,
  filterMessage,
}: CardSelectionOverlayProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);
  const selectedIndicesRef = useRef<Set<number>>(new Set());

  // Keep mutable refs for callbacks used inside PixiJS event handlers
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;
  const onUndoRef = useRef(onUndo);
  onUndoRef.current = onUndo;

  // Refs for imperative visual updates
  const cardContainersRef = useRef<Container[]>([]);
  const confirmBtnRef = useRef<Container | null>(null);
  const selectionTextRef = useRef<Text | null>(null);

  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 1080;

  // Determine which cards are selectable (by index, since cardFilter works on CardId)
  const selectableIndices = useRef<Set<number>>(new Set());
  selectableIndices.current = new Set(
    cards.map((_, i) => i).filter((i) => !cardFilter || cardFilter(cards[i] as CardId))
  );

  // Grid layout calculations
  const cardsPerRow = Math.max(1, Math.min(cards.length, 4));
  const rows = cards.length > 0 ? Math.ceil(cards.length / cardsPerRow) : 0;
  const gridWidth = cards.length > 0 ? cardsPerRow * (CARD_WIDTH + CARD_GAP) - CARD_GAP : 0;
  const gridHeight = rows > 0 ? rows * (CARD_HEIGHT + CARD_GAP) - CARD_GAP : 0;

  // Update visual state of a card (border, checkmark, opacity)
  const updateCardVisual = useCallback(
    (container: Container, index: number, isSelected: boolean) => {
      const isSelectable = selectableIndices.current.has(index);
      // Children: [sprite, border, checkmark]
      const border = container.getChildAt(1) as Graphics;
      const checkmark = container.getChildAt(2) as Container;

      border.clear();
      border.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
      if (isSelected) {
        border.setStrokeStyle({ width: 3, color: COLORS.CARD_SELECTED });
      } else {
        border.setStrokeStyle({ width: 3, color: isSelectable ? COLORS.CARD_BORDER : COLORS.CARD_DISABLED });
      }
      border.stroke();

      checkmark.visible = isSelected;
      container.alpha = isSelectable ? 1.0 : 0.5;
    },
    []
  );

  // Update the confirm button enabled/disabled state
  const updateConfirmButton = useCallback(() => {
    const btn = confirmBtnRef.current;
    if (!btn) return;

    const count = selectedIndicesRef.current.size;
    const canConfirm = count >= minSelect && count <= maxSelect;

    const bg = btn.getChildAt(0) as Graphics;
    const text = btn.getChildAt(1) as Text;

    bg.clear();
    bg.roundRect(0, 0, btn.width, BUTTON_HEIGHT, 8);
    if (canConfirm) {
      bg.fill({ color: COLORS.BTN_PRIMARY });
      bg.setStrokeStyle({ width: 2, color: COLORS.BTN_PRIMARY_BORDER });
    } else {
      bg.fill({ color: COLORS.BTN_PRIMARY_DISABLED_BG });
      bg.setStrokeStyle({ width: 2, color: COLORS.BTN_PRIMARY_DISABLED_BORDER });
    }
    bg.stroke();

    text.style.fill = canConfirm ? 0xffffff : COLORS.BTN_PRIMARY_DISABLED_TEXT;
    btn.cursor = canConfirm ? "pointer" : "not-allowed";
  }, [minSelect, maxSelect]);

  // Update selection count text
  const updateSelectionText = useCallback(() => {
    const text = selectionTextRef.current;
    if (!text) return;

    const count = selectedIndicesRef.current.size;
    let label: string;
    if (minSelect === maxSelect) {
      label = `Select ${minSelect} card${minSelect !== 1 ? "s" : ""} (${count} selected)`;
    } else {
      label = `Select ${minSelect}-${maxSelect} cards (${count} selected)`;
    }
    text.text = label;
  }, [minSelect, maxSelect]);

  // Handle clicking a card
  const handleCardClick = useCallback(
    (index: number) => {
      if (!selectableIndices.current.has(index)) return;

      const selected = selectedIndicesRef.current;
      if (selected.has(index)) {
        selected.delete(index);
      } else if (selected.size < maxSelect) {
        selected.add(index);
      } else if (maxSelect === 1) {
        // Single-select: replace
        const prevIndex = selected.values().next().value as number;
        selected.clear();
        selected.add(index);
        // Update previous card visual
        const prevContainer = cardContainersRef.current[prevIndex];
        if (prevContainer) {
          updateCardVisual(prevContainer, prevIndex, false);
        }
      } else {
        return; // At max, ignore
      }

      // Update clicked card visual
      const container = cardContainersRef.current[index];
      if (container) {
        updateCardVisual(container, index, selected.has(index));
      }

      updateSelectionText();
      updateConfirmButton();
    },
    [maxSelect, updateCardVisual, updateSelectionText, updateConfirmButton]
  );

  // Build the entire overlay
  useEffect(() => {
    if (!app || !overlayLayer) return;

    isDestroyedRef.current = false;
    selectedIndicesRef.current = new Set();
    cardContainersRef.current = [];

    const rootContainer = new Container();
    rootContainer.label = `card-selection-${uniqueId}`;
    addToOverlayLayer(overlayLayer, rootContainer, PIXI_Z_INDEX.CARD_SELECTION_MODAL);
    rootContainerRef.current = rootContainer;

    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // === Dark overlay background ===
    const overlay = new Graphics();
    overlay.rect(0, 0, screenWidth, screenHeight);
    overlay.fill({ color: COLORS.OVERLAY, alpha: 0.85 });
    overlay.eventMode = "static";
    overlay.cursor = "default";
    // Block clicks from falling through to game elements
    overlay.on("pointerdown", (e) => e.stopPropagation());
    rootContainer.addChild(overlay);

    // === Calculate panel dimensions ===
    const titleHeight = 30;
    const filterHeight = filterMessage ? 22 : 0;
    const infoHeight = 22;
    const headerHeight = titleHeight + filterHeight + infoHeight + 24; // 24 gap
    const buttonRowHeight = BUTTON_HEIGHT + 16;
    const emptyHeight = cards.length === 0 ? 60 : 0;

    const panelContentWidth = Math.max(gridWidth, 300);
    const panelWidth = panelContentWidth + PANEL_PADDING * 2;
    const panelHeight = headerHeight + (cards.length > 0 ? gridHeight : emptyHeight) + buttonRowHeight + PANEL_PADDING * 2;

    const panelX = (screenWidth - panelWidth) / 2;
    const panelY = (screenHeight - panelHeight) / 2;

    // === Panel container ===
    const panelContainer = new Container();
    panelContainer.position.set(panelX, panelY);
    panelContainer.eventMode = "static"; // Block clicks to overlay
    rootContainer.addChild(panelContainer);

    // Panel background
    const panelBg = new Graphics();
    panelBg.roundRect(0, 0, panelWidth, panelHeight, 12);
    panelBg.fill({ color: COLORS.PANEL_BG });
    panelBg.setStrokeStyle({ width: 2, color: COLORS.PANEL_BORDER });
    panelBg.stroke();
    panelContainer.addChild(panelBg);

    let yOffset = PANEL_PADDING;

    // === Title ===
    const titleText = new Text({
      text: instruction,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fontWeight: "600",
        fill: COLORS.TEXT,
        wordWrap: true,
        wordWrapWidth: panelWidth - PANEL_PADDING * 2,
        align: "center",
      },
    });
    titleText.anchor.set(0.5, 0);
    titleText.position.set(panelWidth / 2, yOffset);
    panelContainer.addChild(titleText);
    yOffset += titleHeight;

    // === Filter message (optional) ===
    if (filterMessage) {
      const filterText = new Text({
        text: filterMessage,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 13,
          fontStyle: "italic",
          fill: COLORS.TEXT_DIM,
          wordWrap: true,
          wordWrapWidth: panelWidth - PANEL_PADDING * 2,
          align: "center",
        },
      });
      filterText.anchor.set(0.5, 0);
      filterText.position.set(panelWidth / 2, yOffset);
      panelContainer.addChild(filterText);
      yOffset += filterHeight;
    }

    // === Selection info ===
    let infoLabel: string;
    if (minSelect === maxSelect) {
      infoLabel = `Select ${minSelect} card${minSelect !== 1 ? "s" : ""} (0 selected)`;
    } else {
      infoLabel = `Select ${minSelect}-${maxSelect} cards (0 selected)`;
    }

    const infoText = new Text({
      text: infoLabel,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 13,
        fill: COLORS.TEXT_COUNT,
        align: "center",
      },
    });
    infoText.anchor.set(0.5, 0);
    infoText.position.set(panelWidth / 2, yOffset + 4);
    panelContainer.addChild(infoText);
    selectionTextRef.current = infoText;
    yOffset += infoHeight + 16;

    // === Cards grid ===
    if (cards.length > 0) {
      const gridContainer = new Container();
      const gridX = (panelWidth - gridWidth) / 2;
      gridContainer.position.set(gridX, yOffset);
      panelContainer.addChild(gridContainer);

      for (let index = 0; index < cards.length; index++) {
        const cardId = cards[index] as CardId;
        const row = Math.floor(index / cardsPerRow);
        const col = index % cardsPerRow;

        // Center incomplete rows
        const cardsInThisRow =
          row === rows - 1 ? cards.length - row * cardsPerRow : cardsPerRow;
        const rowOffset =
          ((cardsPerRow - cardsInThisRow) * (CARD_WIDTH + CARD_GAP)) / 2;

        const x = rowOffset + col * (CARD_WIDTH + CARD_GAP);
        const y = row * (CARD_HEIGHT + CARD_GAP);

        const cardContainer = new Container();
        cardContainer.position.set(x, y);
        const isSelectable = selectableIndices.current.has(index);

        // Card sprite (placeholder initially, replaced when texture loads)
        const sprite = new Sprite(getPlaceholderTexture());
        sprite.width = CARD_WIDTH;
        sprite.height = CARD_HEIGHT;
        cardContainer.addChild(sprite);

        // Border
        const border = new Graphics();
        border.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
        border.setStrokeStyle({ width: 3, color: isSelectable ? COLORS.CARD_BORDER : COLORS.CARD_DISABLED });
        border.stroke();
        cardContainer.addChild(border);

        // Checkmark badge (hidden by default)
        const checkContainer = new Container();
        checkContainer.position.set(CARD_WIDTH - CHECKMARK_SIZE - 8, 8);
        checkContainer.visible = false;

        const checkBg = new Graphics();
        checkBg.circle(CHECKMARK_SIZE / 2, CHECKMARK_SIZE / 2, CHECKMARK_SIZE / 2);
        checkBg.fill({ color: COLORS.CHECKMARK_BG });
        checkContainer.addChild(checkBg);

        const checkText = new Text({
          text: "\u2713",
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 16,
            fontWeight: "bold",
            fill: 0xffffff,
          },
        });
        checkText.anchor.set(0.5);
        checkText.position.set(CHECKMARK_SIZE / 2, CHECKMARK_SIZE / 2);
        checkContainer.addChild(checkText);
        cardContainer.addChild(checkContainer);

        // Set initial opacity
        cardContainer.alpha = isSelectable ? 1.0 : 0.5;

        // Interactivity
        cardContainer.eventMode = "static";
        cardContainer.cursor = isSelectable ? "pointer" : "not-allowed";

        const cardIndex = index;

        cardContainer.on("pointerenter", () => {
          if (isDestroyedRef.current) return;
          if (!selectableIndices.current.has(cardIndex)) return;
          if (!selectedIndicesRef.current.has(cardIndex)) {
            border.clear();
            border.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
            border.setStrokeStyle({ width: 3, color: COLORS.CARD_HOVER });
            border.stroke();
          }
        });

        cardContainer.on("pointerleave", () => {
          if (isDestroyedRef.current) return;
          if (!selectableIndices.current.has(cardIndex)) return;
          const isSelected = selectedIndicesRef.current.has(cardIndex);
          border.clear();
          border.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 8);
          border.setStrokeStyle({
            width: 3,
            color: isSelected ? COLORS.CARD_SELECTED : COLORS.CARD_BORDER,
          });
          border.stroke();
        });

        cardContainer.on("pointerdown", () => {
          if (isDestroyedRef.current) return;
          handleCardClick(cardIndex);
        });

        gridContainer.addChild(cardContainer);
        cardContainersRef.current.push(cardContainer);

        // Async texture load
        const capturedIndex = index;
        getCardTexture(cardId).then((texture) => {
          if (isDestroyedRef.current || !sprite.parent) return;
          sprite.texture = texture;
        });

        // Stagger fade-in animation
        cardContainer.alpha = 0;
        const targetAlpha = isSelectable ? 1.0 : 0.5;
        setTimeout(() => {
          if (isDestroyedRef.current || !cardContainer.parent) return;
          animManager.animate(`card-entry-${capturedIndex}`, cardContainer, {
            endAlpha: targetAlpha,
            endY: y,
            duration: 200,
            easing: Easing.easeOutQuad,
          });
        }, 50 + index * 30);
      }

      yOffset += gridHeight + 16;
    } else {
      // Empty state
      const emptyText = new Text({
        text: "No cards available to select.",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontStyle: "italic",
          fill: COLORS.TEXT_DIM,
          align: "center",
        },
      });
      emptyText.anchor.set(0.5, 0);
      emptyText.position.set(panelWidth / 2, yOffset + 16);
      panelContainer.addChild(emptyText);
      yOffset += emptyHeight;
    }

    // === Action buttons ===
    const buttonY = yOffset + 8;
    const buttons: { label: string; isPrimary: boolean; onClick: () => void }[] = [];

    if (onUndo) {
      buttons.push({ label: "Cancel", isPrimary: false, onClick: () => onUndoRef.current?.() });
    }
    if (canSkip && onSkip) {
      buttons.push({ label: skipText, isPrimary: false, onClick: () => onSkipRef.current?.() });
    }
    buttons.push({
      label: "Confirm",
      isPrimary: true,
      onClick: () => {
        const count = selectedIndicesRef.current.size;
        if (count >= minSelect && count <= maxSelect) {
          const selectedCardIds = Array.from(selectedIndicesRef.current).map(
            (i) => cards[i] as CardId
          );
          onSelectRef.current(selectedCardIds);
        }
      },
    });

    // Measure button widths
    const buttonWidths = buttons.map((b) => {
      const tempText = new Text({
        text: b.label,
        style: { fontFamily: "Arial, sans-serif", fontSize: 14, fontWeight: "500" },
      });
      const w = Math.max(tempText.width + BUTTON_PADDING_X * 2, 100);
      tempText.destroy();
      return w;
    });
    const totalButtonWidth =
      buttonWidths.reduce((a, b) => a + b, 0) + (buttons.length - 1) * BUTTON_GAP;
    let buttonX = (panelWidth - totalButtonWidth) / 2;

    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i]!;
      const w = buttonWidths[i]!;

      const btnContainer = new Container();
      btnContainer.position.set(buttonX, buttonY);
      // Store width on container for updateConfirmButton to read
      btnContainer.width = w;

      const bg = new Graphics();
      bg.roundRect(0, 0, w, BUTTON_HEIGHT, 8);
      if (btn.isPrimary) {
        // Initially disabled (0 selected)
        bg.fill({ color: COLORS.BTN_PRIMARY_DISABLED_BG });
        bg.setStrokeStyle({ width: 2, color: COLORS.BTN_PRIMARY_DISABLED_BORDER });
      } else {
        bg.fill({ color: COLORS.BTN_SECONDARY });
        bg.setStrokeStyle({ width: 2, color: COLORS.BTN_SECONDARY_BORDER });
      }
      bg.stroke();
      btnContainer.addChild(bg);

      const text = new Text({
        text: btn.label,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontWeight: "500",
          fill: btn.isPrimary ? COLORS.BTN_PRIMARY_DISABLED_TEXT : 0xdddddd,
        },
      });
      text.anchor.set(0.5);
      text.position.set(w / 2, BUTTON_HEIGHT / 2);
      btnContainer.addChild(text);

      btnContainer.eventMode = "static";
      btnContainer.cursor = btn.isPrimary ? "not-allowed" : "pointer";

      if (!btn.isPrimary) {
        // Secondary button hover
        btnContainer.on("pointerenter", () => {
          if (isDestroyedRef.current) return;
          bg.clear();
          bg.roundRect(0, 0, w, BUTTON_HEIGHT, 8);
          bg.fill({ color: COLORS.BTN_SECONDARY_HOVER });
          bg.setStrokeStyle({ width: 2, color: 0x555555 });
          bg.stroke();
        });
        btnContainer.on("pointerleave", () => {
          if (isDestroyedRef.current) return;
          bg.clear();
          bg.roundRect(0, 0, w, BUTTON_HEIGHT, 8);
          bg.fill({ color: COLORS.BTN_SECONDARY });
          bg.setStrokeStyle({ width: 2, color: COLORS.BTN_SECONDARY_BORDER });
          bg.stroke();
        });
      }

      btnContainer.on("pointerdown", () => {
        if (isDestroyedRef.current) return;
        btn.onClick();
      });

      panelContainer.addChild(btnContainer);

      if (btn.isPrimary) {
        confirmBtnRef.current = btnContainer;
      }

      buttonX += w + BUTTON_GAP;
    }

    // Fade in the panel
    panelContainer.alpha = 0;
    panelContainer.y = panelY + 20;
    animManager.animate("panel-entry", panelContainer, {
      endAlpha: 1,
      endY: panelY,
      duration: 250,
      easing: Easing.easeOutQuad,
    });

    // Cleanup
    return () => {
      isDestroyedRef.current = true;

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      cardContainersRef.current = [];
      confirmBtnRef.current = null;
      selectionTextRef.current = null;

      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Intentional: rebuild when these core props change
  }, [app, overlayLayer, cards, instruction, minSelect, maxSelect, canSkip, skipText, cardFilter, filterMessage, uniqueId]);

  // Keyboard handling (Escape for undo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "Escape" && onUndoRef.current) {
        e.preventDefault();
        onUndoRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return null;
}
