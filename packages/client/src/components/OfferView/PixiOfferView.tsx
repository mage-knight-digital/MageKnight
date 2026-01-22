/**
 * PixiOfferView - Pure PixiJS offer panel
 *
 * Renders the entire offer view (overlay, tray, tabs, cards) in PixiJS,
 * avoiding DOM/Pixi coordination issues.
 *
 * Features:
 * - Dark overlay with click-to-close
 * - Tray that slides down from top
 * - Tab buttons for Units/Spells/Advanced Actions (Q/W/E)
 * - Card display with hover effects
 * - Acquire button on hoverable cards
 */

import { useEffect, useRef, useCallback, useId } from "react";
import { Container, Graphics, Text, Sprite } from "pixi.js";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { useGame } from "../../hooks/useGame";
import { useMyPlayer } from "../../hooks/useMyPlayer";
import { getOfferCardTexture } from "../../utils/pixiTextureLoader";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import {
  UNITS,
  UNIT_TYPE_ELITE,
  RECRUIT_UNIT_ACTION,
  BUY_SPELL_ACTION,
  SELECT_REWARD_ACTION,
  LEARN_ADVANCED_ACTION_ACTION,
  SITE_REWARD_SPELL,
  SITE_REWARD_ADVANCED_ACTION,
  type UnitId,
  type CardId,
} from "@mage-knight/shared";

// ============================================
// Types
// ============================================

type OfferPane = "units" | "spells" | "advancedActions";

interface PixiOfferViewProps {
  isVisible: boolean;
  onClose: () => void;
}

interface CardData {
  id: string;
  canAcquire: boolean;
  acquireLabel: string;
  isElite?: boolean;
  onAcquire?: () => void;
}

// ============================================
// Constants
// ============================================

const COLORS = {
  OVERLAY: 0x0f0c0a,
  TRAY_BG: 0x1a1815,
  TRAY_BORDER: 0x3d3530,
  TAB_BG: 0x2a2520,
  TAB_ACTIVE: 0x3d3530,
  TAB_HOVER: 0x4a4540,
  TEXT: 0xf0e6d2,
  TEXT_DIM: 0x888888,
  TEXT_HINT: 0x555555,
  ACQUIRE_BG: 0x27ae60,
  ACQUIRE_HOVER: 0x2ecc71,
  ACQUIRE_DISABLED: 0x555555,
  BORDER_UNIT: 0x7f8c8d,
  BORDER_UNIT_ELITE: 0xf39c12,
  BORDER_SPELL: 0x9b59b6,
  BORDER_AA: 0xe67e22,
  CARD_GLOW: 0x3498db,
};

const SPELL_PURCHASE_COST = 7;
const MONASTERY_AA_COST = 6;

// Card dimensions
const CARD_ASPECT = 0.714;
const CARD_GAP = 24;

/**
 * Generate a pseudo-random rotation based on card ID and index
 */
function getHoverRotation(cardId: string, index: number): number {
  let hash = 0;
  const str = `${cardId}-${index}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const positive = Math.abs(hash);
  const sign = hash >= 0 ? 1 : -1;
  const magnitude = 0.5 + (positive % 16) / 10;
  return sign * magnitude * (Math.PI / 180);
}

// ============================================
// Component
// ============================================

export function PixiOfferView({ isVisible, onClose }: PixiOfferViewProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();
  const { state, sendAction } = useGame();
  const player = useMyPlayer();

  const rootContainerRef = useRef<Container | null>(null);
  const trayContainerRef = useRef<Container | null>(null);
  const cardsContainerRef = useRef<Container | null>(null);
  const tabContainersRef = useRef<Map<OfferPane, Container>>(new Map());
  const cardSpritesRef = useRef<Map<number, Container>>(new Map());
  const acquireButtonRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const isDestroyedRef = useRef(false);
  const currentPaneRef = useRef<OfferPane>("units");
  const hoveredCardIndexRef = useRef<number | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Calculate sizes based on viewport
  const screenWidth = typeof window !== "undefined" ? window.innerWidth : 1920;
  const screenHeight = typeof window !== "undefined" ? window.innerHeight : 1080;
  const cardHeight = Math.min(Math.max(screenHeight * 0.4, 250), 500);
  const cardWidth = Math.round(cardHeight * CARD_ASPECT);
  const trayWidth = Math.min(screenWidth * 0.9, 1200);
  const trayPadding = 24;

  // Get card data for current pane
  const getCardsForPane = useCallback((pane: OfferPane): CardData[] => {
    if (!state || !player) return [];

    if (pane === "units") {
      const recruitableUnits = state.validActions?.units?.recruitable ?? [];
      const recruitableMap = new Map(recruitableUnits.map((r) => [r.unitId, r]));

      return state.offers.units.map((unitId) => {
        const unit = UNITS[unitId];
        const recruitInfo = recruitableMap.get(unitId);
        const canRecruit = recruitInfo?.canAfford ?? false;
        const isElite = unit?.type === UNIT_TYPE_ELITE;

        return {
          id: unitId,
          canAcquire: canRecruit,
          acquireLabel: recruitInfo
            ? canRecruit ? `Recruit (${recruitInfo.cost})` : `Need ${recruitInfo.cost}`
            : "",
          isElite,
          onAcquire: recruitInfo
            ? () => sendAction({ type: RECRUIT_UNIT_ACTION, unitId: unitId as UnitId, influenceSpent: recruitInfo.cost })
            : undefined,
        };
      });
    }

    if (pane === "spells") {
      const pendingSpellReward = player.pendingRewards?.find((r) => r.type === SITE_REWARD_SPELL);
      const pendingIndex = pendingSpellReward
        ? player.pendingRewards?.indexOf(pendingSpellReward) ?? -1
        : -1;

      // Check if at conquered mage tower
      const playerPos = player.position;
      const hexKey = playerPos ? `${playerPos.q},${playerPos.r}` : "";
      const hex = hexKey ? state.map.hexes[hexKey] : null;
      const canBuySpells = hex?.site?.type === "mage_tower" && hex.site.isConquered;
      const playerInfluence = player.influencePoints ?? 0;

      return state.offers.spells.cards.map((spellId) => {
        let canAcquire = false;
        let acquireLabel = "";
        let onAcquire: (() => void) | undefined;

        if (pendingSpellReward && pendingIndex >= 0) {
          canAcquire = true;
          acquireLabel = "Select";
          onAcquire = () => sendAction({ type: SELECT_REWARD_ACTION, cardId: spellId as CardId, rewardIndex: pendingIndex });
        } else if (canBuySpells) {
          const canAfford = playerInfluence >= SPELL_PURCHASE_COST;
          canAcquire = canAfford;
          acquireLabel = canAfford ? `Buy (${SPELL_PURCHASE_COST})` : `Need ${SPELL_PURCHASE_COST}`;
          onAcquire = () => sendAction({ type: BUY_SPELL_ACTION, cardId: spellId as CardId });
        }

        return { id: spellId, canAcquire, acquireLabel, onAcquire };
      });
    }

    if (pane === "advancedActions") {
      const pendingAAReward = player.pendingRewards?.find((r) => r.type === SITE_REWARD_ADVANCED_ACTION);
      const pendingIndex = pendingAAReward
        ? player.pendingRewards?.indexOf(pendingAAReward) ?? -1
        : -1;

      // Check if at monastery
      const playerPos = player.position;
      const hexKey = playerPos ? `${playerPos.q},${playerPos.r}` : "";
      const hex = hexKey ? state.map.hexes[hexKey] : null;
      const canBuyFromMonastery = hex?.site?.type === "monastery" && !hex.site.isBurned;
      const playerInfluence = player.influencePoints ?? 0;

      // Combine regular and monastery AAs
      const regularAAs = state.offers.advancedActions.cards.map((aaId) => {
        let canAcquire = false;
        let acquireLabel = "Level-up only";
        let onAcquire: (() => void) | undefined;

        if (pendingAAReward && pendingIndex >= 0) {
          canAcquire = true;
          acquireLabel = "Select";
          onAcquire = () => sendAction({ type: SELECT_REWARD_ACTION, cardId: aaId as CardId, rewardIndex: pendingIndex });
        }

        return { id: aaId, canAcquire, acquireLabel, onAcquire };
      });

      const monasteryAAs = (state.offers.monasteryAdvancedActions ?? []).map((aaId) => {
        let canAcquire = false;
        let acquireLabel = "Monastery only";
        let onAcquire: (() => void) | undefined;

        if (canBuyFromMonastery) {
          const canAfford = playerInfluence >= MONASTERY_AA_COST;
          canAcquire = canAfford;
          acquireLabel = canAfford ? `Buy (${MONASTERY_AA_COST})` : `Need ${MONASTERY_AA_COST}`;
          onAcquire = () => sendAction({ type: LEARN_ADVANCED_ACTION_ACTION, cardId: aaId as CardId, fromMonastery: true });
        }

        return { id: aaId, canAcquire, acquireLabel, onAcquire };
      });

      return [...regularAAs, ...monasteryAAs];
    }

    return [];
  }, [state, player, sendAction]);

  // Get border color for card type
  const getBorderColor = useCallback((pane: OfferPane, isElite?: boolean): number => {
    if (pane === "units") return isElite ? COLORS.BORDER_UNIT_ELITE : COLORS.BORDER_UNIT;
    if (pane === "spells") return COLORS.BORDER_SPELL;
    return COLORS.BORDER_AA;
  }, []);

  // Show acquire button
  const showAcquireButton = useCallback((cardContainer: Container, card: CardData) => {
    if (!card.onAcquire || !acquireButtonRef.current) return;

    const btn = acquireButtonRef.current;
    btn.visible = true;

    // Position below the card
    const globalPos = cardContainer.getGlobalPosition();
    btn.position.set(
      globalPos.x - cardWidth / 2 + 10,
      globalPos.y + cardHeight / 2 - 40
    );

    // Update button appearance
    const bg = btn.getChildAt(0) as Graphics;
    const text = btn.getChildAt(1) as Text;

    bg.clear();
    bg.roundRect(0, 0, cardWidth - 20, 28, 4);
    bg.fill({ color: card.canAcquire ? COLORS.ACQUIRE_BG : COLORS.ACQUIRE_DISABLED });

    text.text = card.acquireLabel;
    text.style.fill = card.canAcquire ? 0xffffff : 0xaaaaaa;

    // Store callback for click
    (btn as Container & { _onClick?: () => void })._onClick = card.canAcquire ? card.onAcquire : undefined;
  }, [cardWidth, cardHeight]);

  // Hide acquire button
  const hideAcquireButton = useCallback(() => {
    if (acquireButtonRef.current) {
      acquireButtonRef.current.visible = false;
    }
  }, []);

  // Build cards for a pane
  const buildCards = useCallback(async (
    container: Container,
    pane: OfferPane,
    animManager: AnimationManager
  ) => {
    // Clear existing cards
    container.removeChildren();
    cardSpritesRef.current.clear();
    hoveredCardIndexRef.current = null;

    const cards = getCardsForPane(pane);
    if (cards.length === 0) {
      // Show empty message
      const emptyText = new Text({
        text: `No ${pane === "advancedActions" ? "advanced actions" : pane} available`,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fill: COLORS.TEXT_DIM,
        },
      });
      emptyText.anchor.set(0.5);
      emptyText.position.set(trayWidth / 2 - trayPadding, cardHeight / 2);
      container.addChild(emptyText);
      return;
    }

    // Calculate card positions
    const totalWidth = cards.length * cardWidth + (cards.length - 1) * CARD_GAP;
    const startX = (trayWidth - trayPadding * 2 - totalWidth) / 2 + cardWidth / 2;
    const cardY = cardHeight / 2 + 20;

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card) continue;

      const textureType = pane === "advancedActions" ? "aa" : pane === "spells" ? "spell" : "unit";
      const texture = await getOfferCardTexture(card.id, textureType);

      const cardContainer = new Container();
      cardContainer.position.set(startX + i * (cardWidth + CARD_GAP), cardY);
      cardContainer.pivot.set(cardWidth / 2, cardHeight / 2);

      // Card sprite
      const sprite = new Sprite(texture);
      sprite.width = cardWidth;
      sprite.height = cardHeight;
      cardContainer.addChild(sprite);

      // Border
      const borderColor = getBorderColor(pane, card.isElite);
      const border = new Graphics();
      border.setStrokeStyle({ width: 3, color: borderColor });
      border.roundRect(0, 0, cardWidth, cardHeight, cardWidth * 0.04);
      border.stroke();
      cardContainer.addChild(border);

      // Glow effect (hidden by default)
      const glow = new Graphics();
      glow.setStrokeStyle({ width: 8, color: COLORS.CARD_GLOW, alpha: 0.5 });
      glow.roundRect(-4, -4, cardWidth + 8, cardHeight + 8, cardWidth * 0.05);
      glow.stroke();
      glow.alpha = 0;
      cardContainer.addChildAt(glow, 0);

      // Store original position for hover animation
      const baseY = cardY;
      const cardIndex = i;

      // Make interactive
      cardContainer.eventMode = "static";
      cardContainer.cursor = card.onAcquire ? "pointer" : "default";

      cardContainer.on("pointerenter", () => {
        if (isDestroyedRef.current) return;
        hoveredCardIndexRef.current = cardIndex;

        const rotation = getHoverRotation(card.id, cardIndex);
        const liftY = card.canAcquire ? -20 : -10;

        animManager.animate(`card-hover-${cardIndex}`, cardContainer, {
          endY: baseY + liftY,
          endScale: card.canAcquire ? 1.08 : 1.02,
          endRotation: rotation,
          duration: 150,
          easing: Easing.easeOutQuad,
        });

        cardContainer.zIndex = 100;
        container.sortChildren();

        if (card.canAcquire) {
          glow.alpha = 0.6;
        }

        // Show acquire button
        showAcquireButton(cardContainer, card);
      });

      cardContainer.on("pointerleave", () => {
        if (isDestroyedRef.current) return;
        hoveredCardIndexRef.current = null;

        animManager.animate(`card-hover-${cardIndex}`, cardContainer, {
          endY: baseY,
          endScale: 1,
          endRotation: 0,
          duration: 150,
          easing: Easing.easeOutQuad,
        });

        cardContainer.zIndex = cardIndex;
        container.sortChildren();
        glow.alpha = 0;

        hideAcquireButton();
      });

      cardContainer.on("pointerdown", () => {
        if (isDestroyedRef.current || !card.canAcquire || !card.onAcquire) return;
        card.onAcquire();
      });

      cardContainer.zIndex = i;
      container.addChild(cardContainer);
      cardSpritesRef.current.set(i, cardContainer);

      // Stagger animation on entry
      cardContainer.alpha = 0;
      cardContainer.y = baseY - 30;
      setTimeout(() => {
        if (isDestroyedRef.current || !cardContainer.parent) return;
        animManager.animate(`card-entry-${i}`, cardContainer, {
          endY: baseY,
          endAlpha: 1,
          duration: 200,
          easing: Easing.easeOutQuad,
        });
      }, 100 + i * 50);
    }
  }, [getCardsForPane, getBorderColor, cardWidth, cardHeight, trayWidth, trayPadding, showAcquireButton, hideAcquireButton]);

  // Switch pane
  const switchPane = useCallback((pane: OfferPane) => {
    if (currentPaneRef.current === pane) return;
    currentPaneRef.current = pane;

    // Update tab visuals
    tabContainersRef.current.forEach((tabContainer, tabPane) => {
      const bg = tabContainer.getChildAt(0) as Graphics;
      bg.clear();
      bg.roundRect(0, 0, 100, 32, 4);
      bg.fill({ color: tabPane === pane ? COLORS.TAB_ACTIVE : COLORS.TAB_BG });
    });

    // Rebuild cards for new pane
    const cardsContainer = cardsContainerRef.current;
    const animManager = animManagerRef.current;
    if (cardsContainer && animManager) {
      buildCards(cardsContainer, pane, animManager);
    }
  }, [buildCards]);

  // Build the entire offer view
  useEffect(() => {
    if (!app || !overlayLayer || !isVisible) return;
    if (!state || !player) return;

    isDestroyedRef.current = false;

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `offer-view-${uniqueId}`;
    overlayLayer.addChild(rootContainer);
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // === Overlay ===
    const overlay = new Graphics();
    overlay.rect(0, 0, screenWidth, screenHeight);
    overlay.fill({ color: COLORS.OVERLAY, alpha: 0.9 });
    overlay.eventMode = "static";
    overlay.cursor = "default";
    overlay.on("pointerdown", () => onCloseRef.current());
    overlay.alpha = 0;
    rootContainer.addChild(overlay);

    animManager.animate("overlay-fade", overlay, {
      endAlpha: 1,
      duration: 300,
      easing: Easing.easeOutQuad,
    });

    // === Tray container ===
    const trayHeight = cardHeight + 150;
    const trayX = (screenWidth - trayWidth) / 2;
    const trayY = 40;

    const trayContainer = new Container();
    trayContainer.position.set(trayX, -trayHeight); // Start above screen
    trayContainerRef.current = trayContainer;
    rootContainer.addChild(trayContainer);

    // Tray background
    const trayBg = new Graphics();
    trayBg.roundRect(0, 0, trayWidth, trayHeight, 12);
    trayBg.fill({ color: COLORS.TRAY_BG });
    trayBg.setStrokeStyle({ width: 3, color: COLORS.TRAY_BORDER });
    trayBg.stroke();
    trayBg.eventMode = "static"; // Prevent clicks through to overlay
    trayContainer.addChild(trayBg);

    // Slide tray in
    animManager.animate("tray-slide", trayContainer, {
      endY: trayY,
      duration: 350,
      easing: Easing.easeOutBack,
    });

    // === Tabs ===
    const tabY = 16;
    const tabWidth = 100;
    const tabGap = 12;
    const tabs: { pane: OfferPane; label: string; key: string }[] = [
      { pane: "units", label: "Units", key: "Q" },
      { pane: "spells", label: "Spells", key: "W" },
      { pane: "advancedActions", label: "Actions", key: "E" },
    ];

    const tabsStartX = (trayWidth - tabs.length * tabWidth - (tabs.length - 1) * tabGap) / 2;

    tabs.forEach((tab, index) => {
      const tabContainer = new Container();
      tabContainer.position.set(tabsStartX + index * (tabWidth + tabGap), tabY);

      const tabBg = new Graphics();
      tabBg.roundRect(0, 0, tabWidth, 32, 4);
      tabBg.fill({ color: tab.pane === "units" ? COLORS.TAB_ACTIVE : COLORS.TAB_BG });
      tabContainer.addChild(tabBg);

      const tabText = new Text({
        text: `${tab.key} ${tab.label}`,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 12,
          fontWeight: "bold",
          fill: COLORS.TEXT,
        },
      });
      tabText.anchor.set(0.5);
      tabText.position.set(tabWidth / 2, 16);
      tabContainer.addChild(tabText);

      tabContainer.eventMode = "static";
      tabContainer.cursor = "pointer";

      tabContainer.on("pointerenter", () => {
        if (currentPaneRef.current !== tab.pane) {
          tabBg.clear();
          tabBg.roundRect(0, 0, tabWidth, 32, 4);
          tabBg.fill({ color: COLORS.TAB_HOVER });
        }
      });

      tabContainer.on("pointerleave", () => {
        tabBg.clear();
        tabBg.roundRect(0, 0, tabWidth, 32, 4);
        tabBg.fill({ color: currentPaneRef.current === tab.pane ? COLORS.TAB_ACTIVE : COLORS.TAB_BG });
      });

      tabContainer.on("pointerdown", () => switchPane(tab.pane));

      trayContainer.addChild(tabContainer);
      tabContainersRef.current.set(tab.pane, tabContainer);
    });

    // === Cards container ===
    const cardsContainer = new Container();
    cardsContainer.position.set(trayPadding, 60);
    cardsContainer.sortableChildren = true;
    trayContainer.addChild(cardsContainer);
    cardsContainerRef.current = cardsContainer;

    // === Acquire button (shared, repositioned on hover) ===
    const acquireBtn = new Container();
    acquireBtn.visible = false;
    acquireBtn.eventMode = "static";
    acquireBtn.cursor = "pointer";

    const btnBg = new Graphics();
    btnBg.roundRect(0, 0, cardWidth - 20, 28, 4);
    btnBg.fill({ color: COLORS.ACQUIRE_BG });
    acquireBtn.addChild(btnBg);

    const btnText = new Text({
      text: "Acquire",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 12,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    btnText.anchor.set(0.5);
    btnText.position.set((cardWidth - 20) / 2, 14);
    acquireBtn.addChild(btnText);

    acquireBtn.on("pointerdown", () => {
      const onClick = (acquireBtn as Container & { _onClick?: () => void })._onClick;
      if (onClick) onClick();
    });

    rootContainer.addChild(acquireBtn);
    acquireButtonRef.current = acquireBtn;

    // === Navigation hint ===
    const hintText = new Text({
      text: "Q/W/E to switch  |  2 to close",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 11,
        fill: COLORS.TEXT_HINT,
      },
    });
    hintText.anchor.set(0.5);
    hintText.position.set(trayWidth / 2, trayHeight - 20);
    trayContainer.addChild(hintText);

    // Build initial cards
    currentPaneRef.current = "units";
    buildCards(cardsContainer, "units", animManager);

    // Capture refs for cleanup
    const tabContainers = tabContainersRef.current;
    const cardSprites = cardSpritesRef.current;

    // Cleanup
    return () => {
      isDestroyedRef.current = true;

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      tabContainers.clear();
      cardSprites.clear();
      acquireButtonRef.current = null;
      cardsContainerRef.current = null;
      trayContainerRef.current = null;

      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }
    };
  }, [app, overlayLayer, isVisible, state, player, uniqueId, screenWidth, screenHeight, cardWidth, cardHeight, trayWidth, trayPadding, buildCards, switchPane]);

  // Keyboard handling
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      const key = e.key.toLowerCase();

      if (key === "q") {
        switchPane("units");
      } else if (key === "w") {
        switchPane("spells");
      } else if (key === "e") {
        switchPane("advancedActions");
      } else if (key === "2" || key === "s" || key === "escape") {
        onCloseRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, switchPane]);

  // No DOM element needed - everything renders in Pixi
  return null;
}
