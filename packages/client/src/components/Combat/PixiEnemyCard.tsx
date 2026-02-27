/**
 * PixiEnemyCard - PixiJS-based interactive UI for each enemy during combat
 *
 * Renders the allocation UI below each enemy token using PixiJS.
 * Wired to Rust LegalActions — each enemy card receives pre-filtered
 * legal actions and sends them directly via onSendAction().
 *
 * Features:
 * - Enemy name with click handler for detail panel
 * - Status badges (DEFEATED, BLOCKED)
 * - Block: DeclareBlock buttons per enemy
 * - Attack: SubsetSelect toggles per enemy during target selection
 * - Damage: "Take Damage" button per enemy (delegates to hero/unit panel)
 */

import { useEffect, useRef, useCallback, useId } from "react";
import { Container, Graphics, Text } from "pixi.js";
import "@pixi/layout";
import type { ClientCombatEnemy } from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";
import {
  ENEMY_CARD_CONSTANTS,
  enemyCardRootLayout,
  enemyCardBadgeLayout,
} from "../../utils/pixiLayout";
import type { LegalAction } from "../../rust/types";
import type {
  BlockActionOption,
  CumbersomeActionOption,
  BannerFearActionOption,
  DamageToHeroOption,
  DamageToUnitOption,
  SubsetSelectOption,
} from "../../rust/legalActionUtils";

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  // Backgrounds
  CARD_BG: 0x1a1d2e,
  CARD_BG_ALPHA: 0.94,
  CARD_BORDER: 0xb87333,

  // Status badges
  BADGE_DEFEATED_BG: 0x000000,
  BADGE_DEFEATED_TEXT: 0x888888,
  BADGE_BLOCKED_BG: 0x2e6b5a,
  BADGE_BLOCKED_TEXT: 0xe8e0d0,

  // Buttons
  BTN_READY_BG: 0x3a6a58,
  BTN_DISABLED_BG: 0x28262d,
  BTN_DISABLED_TEXT: 0x707580,
  BTN_DAMAGE_BG: 0x8b4030,
  BTN_WARNING_BG: 0xa07040,
  BTN_TARGET_BG: 0x3a5a8a,
  BTN_TARGET_ACTIVE_BG: 0x4a7aaa,

  // Text
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xb0a090,
  TEXT_MUTED: 0x888888,

  // Can defeat glow
  CAN_DEFEAT_GLOW: 0x5a8a70,
};

// Layout constants
const { CARD_WIDTH, BTN_RADIUS, BADGE_HEIGHT, COMMIT_BTN_HEIGHT } =
  ENEMY_CARD_CONSTANTS;

// ============================================================================
// Types
// ============================================================================

export interface EnemyCardData {
  enemy: ClientCombatEnemy;
  position: { x: number; y: number };
  tokenRadius: number;

  // Block phase
  isBlockPhase?: boolean;
  blockActions: BlockActionOption[];
  cumbersomeAction?: CumbersomeActionOption;
  bannerFearActions: BannerFearActionOption[];

  // Damage phase
  isDamagePhase?: boolean;
  damageToHeroAction?: DamageToHeroOption;
  damageToUnitActions: DamageToUnitOption[];

  // Attack phase
  isAttackPhase?: boolean;
  isRangedSiegePhase?: boolean;

  // Target selection (SubsetSelect/SubsetConfirm)
  isSelectingTargets?: boolean;
  subsetSelectAction?: SubsetSelectOption;

  canDefeat?: boolean;
}

interface PixiEnemyCardProps {
  enemies: EnemyCardData[];
  onEnemyClick?: (instanceId: string) => void;
  onSendAction?: (action: LegalAction) => void;
  onAssignDamage?: (enemyIndex: number) => void;
  onTriggerEffect?: (effect: "damage" | "block" | "attack") => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

function createRoundedRect(
  g: Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor: number,
  fillAlpha = 1,
  strokeColor?: number,
  strokeWidth?: number
): void {
  g.roundRect(x, y, width, height, radius);
  g.fill({ color: fillColor, alpha: fillAlpha });
  if (strokeColor !== undefined && strokeWidth !== undefined) {
    g.stroke({ color: strokeColor, width: strokeWidth });
  }
}

interface CreateButtonOptions {
  label: string;
  width: number;
  height: number;
  bgColor: number;
  textColor: number;
  onClick: () => void;
  disabled?: boolean;
  fontSize?: number;
  useLayout?: boolean;
}

function createButton(options: CreateButtonOptions): Container {
  const {
    label,
    width,
    height,
    bgColor,
    textColor,
    onClick,
    disabled = false,
    fontSize = 12,
    useLayout = false,
  } = options;

  const container = new Container();

  if (useLayout) {
    container.layout = { width, height };
  }

  const bg = new Graphics();
  createRoundedRect(bg, 0, 0, width, height, BTN_RADIUS, bgColor, disabled ? 0.6 : 1);
  container.addChild(bg);

  const text = new Text({
    text: label,
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize,
      fontWeight: "bold",
      fill: textColor,
    },
  });
  text.anchor.set(0.5);
  text.position.set(width / 2, height / 2);
  if (disabled) text.alpha = 0.6;
  container.addChild(text);

  if (!disabled) {
    container.eventMode = "static";
    container.cursor = "pointer";
    container.on("pointertap", (e) => {
      e.stopPropagation();
      onClick();
    });
    container.on("pointerenter", () => {
      container.scale.set(1.05);
    });
    container.on("pointerleave", () => {
      container.scale.set(1);
    });
  }

  return container;
}

// ============================================================================
// Component
// ============================================================================

export function PixiEnemyCard({
  enemies,
  onEnemyClick,
  onSendAction,
  onAssignDamage,
  onTriggerEffect,
}: PixiEnemyCardProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const cardContainersRef = useRef<Map<string, Container>>(new Map());
  const isDestroyedRef = useRef(false);

  // Stable callback refs
  const onEnemyClickRef = useRef(onEnemyClick);
  const onSendActionRef = useRef(onSendAction);
  const onAssignDamageRef = useRef(onAssignDamage);
  const onTriggerEffectRef = useRef(onTriggerEffect);

  useEffect(() => {
    onEnemyClickRef.current = onEnemyClick;
    onSendActionRef.current = onSendAction;
    onAssignDamageRef.current = onAssignDamage;
    onTriggerEffectRef.current = onTriggerEffect;
  });

  // Build UI for a single enemy card
  const buildEnemyCard = useCallback(
    (data: EnemyCardData, animManager: AnimationManager, enemyIndex: number): Container => {
      const { enemy, position, tokenRadius } = data;
      const container = new Container();
      container.label = `enemy-card-${enemy.instanceId}`;
      container.sortableChildren = true;

      container.x = position.x - CARD_WIDTH / 2;
      container.y = position.y + tokenRadius + 8;

      container.layout = {
        ...enemyCardRootLayout(),
        width: CARD_WIDTH,
      };

      // ========================================
      // Enemy Name (clickable)
      // ========================================
      const nameContainer = new Container();
      nameContainer.label = "name-section";
      nameContainer.layout = {
        height: 20,
        alignItems: "center",
        justifyContent: "center",
      };

      const nameText = new Text({
        text: enemy.name,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 14,
          fontWeight: "600",
          fill: COLORS.TEXT_PRIMARY,
        },
      });
      nameText.layout = {};
      nameText.eventMode = "static";
      nameText.cursor = "pointer";
      nameText.on("pointertap", () => {
        onEnemyClickRef.current?.(enemy.instanceId);
      });
      nameContainer.addChild(nameText);
      container.addChild(nameContainer);

      // ========================================
      // Status Badges
      // ========================================
      if (enemy.isDefeated) {
        const badge = new Container();
        badge.label = "defeated-badge";
        badge.layout = enemyCardBadgeLayout();

        const bg = new Graphics();
        createRoundedRect(bg, 0, 0, 80, BADGE_HEIGHT, 4, COLORS.BADGE_DEFEATED_BG, 0.8);
        badge.addChild(bg);

        const text = new Text({
          text: "DEFEATED",
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 11,
            fontWeight: "700",
            fill: COLORS.BADGE_DEFEATED_TEXT,
            letterSpacing: 1,
          },
        });
        text.anchor.set(0.5);
        text.position.set(40, BADGE_HEIGHT / 2);
        badge.addChild(text);
        container.addChild(badge);
      } else if (enemy.isBlocked) {
        const badge = new Container();
        badge.label = "blocked-badge";
        badge.layout = enemyCardBadgeLayout();

        const bg = new Graphics();
        createRoundedRect(bg, 0, 0, 80, BADGE_HEIGHT, 4, COLORS.BADGE_BLOCKED_BG, 0.9);
        badge.addChild(bg);

        const text = new Text({
          text: "BLOCKED",
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 11,
            fontWeight: "700",
            fill: COLORS.BADGE_BLOCKED_TEXT,
            letterSpacing: 1,
          },
        });
        text.anchor.set(0.5);
        text.position.set(40, BADGE_HEIGHT / 2);
        badge.addChild(text);
        container.addChild(badge);
      }

      // ========================================
      // Block Phase: DeclareBlock buttons
      // ========================================
      if (data.isBlockPhase && !enemy.isDefeated && !enemy.isBlocked) {
        for (const blockAction of data.blockActions) {
          const btn = createButton({
            label: `Block (attack #${blockAction.attackIndex + 1})`,
            width: CARD_WIDTH,
            height: COMMIT_BTN_HEIGHT,
            bgColor: COLORS.BTN_READY_BG,
            textColor: COLORS.TEXT_PRIMARY,
            onClick: () => {
              onTriggerEffectRef.current?.("block");
              onSendActionRef.current?.(blockAction.action);
            },
            fontSize: 12,
            useLayout: true,
          });
          container.addChild(btn);
        }

        // Single-attack shortcut: show "Block" instead of "Block (attack #1)"
        // Handled above — if there's only 1 attack, the label is fine

        // Cumbersome button
        if (data.cumbersomeAction) {
          const cumbAction = data.cumbersomeAction;
          const cumbBtn = createButton({
            label: "Spend Move (Cumbersome)",
            width: CARD_WIDTH,
            height: COMMIT_BTN_HEIGHT,
            bgColor: COLORS.BTN_WARNING_BG,
            textColor: COLORS.TEXT_PRIMARY,
            onClick: () => onSendActionRef.current?.(cumbAction.action),
            fontSize: 11,
            useLayout: true,
          });
          container.addChild(cumbBtn);
        }

        // Banner Fear buttons
        for (const bannerAction of data.bannerFearActions) {
          const btn = createButton({
            label: `Banner Fear (attack #${bannerAction.attackIndex + 1})`,
            width: CARD_WIDTH,
            height: COMMIT_BTN_HEIGHT,
            bgColor: COLORS.BTN_READY_BG,
            textColor: COLORS.TEXT_PRIMARY,
            onClick: () => {
              onTriggerEffectRef.current?.("block");
              onSendActionRef.current?.(bannerAction.action);
            },
            fontSize: 11,
            useLayout: true,
          });
          container.addChild(btn);
        }
      }

      // ========================================
      // Damage Phase: "Take N Damage" button
      // ========================================
      if (data.isDamagePhase && data.damageToHeroAction && !enemy.isDefeated) {
        const damageBtn = createButton({
          label: "Take Damage",
          width: CARD_WIDTH,
          height: COMMIT_BTN_HEIGHT,
          bgColor: COLORS.BTN_DAMAGE_BG,
          textColor: COLORS.TEXT_PRIMARY,
          onClick: () => onAssignDamageRef.current?.(enemyIndex),
          fontSize: 13,
          useLayout: true,
        });
        container.addChild(damageBtn);
      }

      // ========================================
      // Attack Phase: SubsetSelect toggle
      // ========================================
      if (data.isSelectingTargets && data.subsetSelectAction && !enemy.isDefeated) {
        const ssAction = data.subsetSelectAction;
        const toggleBtn = createButton({
          label: "Select Target",
          width: CARD_WIDTH,
          height: COMMIT_BTN_HEIGHT,
          bgColor: COLORS.BTN_TARGET_BG,
          textColor: COLORS.TEXT_PRIMARY,
          onClick: () => {
            onSendActionRef.current?.(ssAction.action);
          },
          fontSize: 12,
          useLayout: true,
        });
        container.addChild(toggleBtn);
      }

      return container;
    },
    []
  );

  // Main effect to build all enemy cards
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;

    const cardContainers = cardContainersRef.current;

    const rootContainer = new Container();
    rootContainer.label = `enemy-cards-${uniqueId}`;
    rootContainer.zIndex = PIXI_Z_INDEX.ENEMY_CARDS;
    rootContainer.sortableChildren = true;

    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    enemies.forEach((data, index) => {
      const card = buildEnemyCard(data, animManager, index);
      rootContainer.addChild(card);
      cardContainers.set(data.enemy.instanceId, card);

      // Entry animation
      card.alpha = 0;
      card.scale.set(0.9);
      setTimeout(() => {
        if (isDestroyedRef.current || !card.parent) return;
        animManager.animate(`card-entry-${data.enemy.instanceId}`, card, {
          endAlpha: 1,
          endScale: 1,
          duration: 300,
          easing: Easing.easeOutQuad,
        });
      }, 200);
    });

    return () => {
      isDestroyedRef.current = true;

      if (animManagerRef.current) {
        animManagerRef.current.cancelAll();
        animManagerRef.current.detach();
        animManagerRef.current = null;
      }

      if (rootContainerRef.current) {
        if (rootContainerRef.current.parent) {
          rootContainerRef.current.parent.removeChild(rootContainerRef.current);
        }
        rootContainerRef.current.destroy({ children: true });
        rootContainerRef.current = null;
      }

      cardContainers.clear();
    };
  }, [app, overlayLayer, uniqueId, enemies, buildEnemyCard]);

  return null;
}
