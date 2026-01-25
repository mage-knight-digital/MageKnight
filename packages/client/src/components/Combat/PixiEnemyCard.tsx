/**
 * PixiEnemyCard - PixiJS-based interactive UI for each enemy during combat
 *
 * Renders the allocation UI below each enemy token using PixiJS.
 * Replaces the HTML EnemyCard component to eliminate z-index conflicts.
 *
 * Features:
 * - Enemy name with click handler for detail panel
 * - Status badges (DEFEATED, BLOCKED)
 * - Block allocation UI (+/- buttons, progress, commit button)
 * - Attack allocation UI (+/- buttons, progress, resistance warnings)
 * - Damage assignment button
 * - Crack effect for enemies that can be defeated
 */

import { useEffect, useRef, useCallback, useId } from "react";
import { Container, Graphics, Text } from "pixi.js";
import "@pixi/layout"; // Side-effect import for layout types on Container
import type {
  ClientCombatEnemy,
  EnemyBlockState,
  EnemyAttackState,
  AssignBlockOption,
  UnassignBlockOption,
  AssignAttackOption,
  UnassignAttackOption,
  DamageAssignmentOption,
  AttackElement,
} from "@mage-knight/shared";
import { usePixiApp } from "../../contexts/PixiAppContext";
import { AnimationManager, Easing } from "../GameBoard/pixi/animations";
import { PIXI_Z_INDEX } from "../../utils/pixiLayers";
import {
  ENEMY_CARD_CONSTANTS,
  enemyCardRootLayout,
  enemyCardBadgeLayout,
} from "../../utils/pixiLayout";

// ============================================================================
// Constants
// ============================================================================

const COLORS = {
  // Backgrounds
  CARD_BG: 0x1a1d2e,
  CARD_BG_ALPHA: 0.94,
  CARD_BORDER: 0xb87333, // Bronze

  // Status badges
  BADGE_DEFEATED_BG: 0x000000,
  BADGE_DEFEATED_TEXT: 0x888888,
  BADGE_BLOCKED_BG: 0x2e6b5a,
  BADGE_BLOCKED_TEXT: 0xe8e0d0,

  // Buttons
  BTN_READY_BG: 0x3a6a58, // Verdigris
  BTN_READY_HOVER: 0x4a7a68,
  BTN_DISABLED_BG: 0x28262d,
  BTN_DISABLED_TEXT: 0x707580,
  BTN_DAMAGE_BG: 0x8b4030, // Rust
  BTN_DAMAGE_HOVER: 0x9b5040,
  BTN_PLUS_BG: 0x3a6a58,
  BTN_MINUS_BG: 0x323038,
  BTN_WARNING_BG: 0xa07040, // Burnt sienna

  // Text
  TEXT_PRIMARY: 0xffffff,
  TEXT_SECONDARY: 0xb0a090,
  TEXT_MUTED: 0x888888,
  TEXT_SUCCESS: 0x8ba06a, // Moss green
  TEXT_WARNING: 0xc08050, // Burnt sienna
  TEXT_GOLD: 0xd4a574, // Antique gold

  // Elements
  ELEMENT_BG: {
    physical: 0x323037,
    fire: 0x46231e,
    ice: 0x233246,
    coldFire: 0x32233c,
  } as Record<AttackElement, number>,

  // Can defeat glow
  CAN_DEFEAT_GLOW: 0x5a8a70,

  // Progress bar
  PROGRESS_BG: 0x232630,
  PROGRESS_FILL: 0x3a6a58,
  PROGRESS_FILL_FULL: 0x4a8a68,
};

// Element icons (using text emojis for now - could be replaced with sprites)
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "\u2694", // Crossed swords
  fire: "\uD83D\uDD25", // Fire emoji
  ice: "\u2744", // Snowflake
  coldFire: "\uD83D\uDC9C", // Purple heart (cold fire)
};

// Layout constants - use shared constants from pixiLayout.ts
const { CARD_WIDTH, CARD_PADDING, BTN_SIZE, BTN_RADIUS, BADGE_HEIGHT, COMMIT_BTN_HEIGHT } =
  ENEMY_CARD_CONSTANTS;

// ============================================================================
// Types
// ============================================================================

interface EnemyCardData {
  enemy: ClientCombatEnemy;
  position: { x: number; y: number };
  tokenRadius: number;

  // Block phase
  isBlockPhase?: boolean;
  enemyBlockState?: EnemyBlockState;
  assignableBlocks?: readonly AssignBlockOption[];
  unassignableBlocks?: readonly UnassignBlockOption[];

  // Damage phase
  isDamagePhase?: boolean;
  damageOption?: DamageAssignmentOption;

  // Attack phase
  isAttackPhase?: boolean;
  isRangedSiegePhase?: boolean;
  enemyAttackState?: EnemyAttackState;
  assignableAttacks?: readonly AssignAttackOption[];
  unassignableAttacks?: readonly UnassignAttackOption[];

  // State
  canDefeat?: boolean;
  useDragDrop?: boolean;
}

interface PixiEnemyCardProps {
  enemies: EnemyCardData[];
  onEnemyClick?: (instanceId: string) => void;
  onAssignBlockIncremental?: (option: AssignBlockOption) => void;
  onUnassignBlock?: (option: UnassignBlockOption) => void;
  onCommitBlock?: (enemyInstanceId: string) => void;
  onAssignDamage?: (enemyInstanceId: string) => void;
  onAssignAttack?: (option: AssignAttackOption) => void;
  onUnassignAttack?: (option: UnassignAttackOption) => void;
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
  /** Legacy positioning - omit when using layout */
  x?: number;
  /** Legacy positioning - omit when using layout */
  y?: number;
  /** When true, container gets layout property for flex participation */
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
    x,
    y,
    useLayout = false,
  } = options;

  const container = new Container();

  // Legacy positioning (for gradual migration)
  if (x !== undefined) container.x = x;
  if (y !== undefined) container.y = y;

  // Layout mode: set fixed dimensions for flex participation
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

interface CreatePlusMinusOptions {
  type: "plus" | "minus";
  onClick: () => void;
  isWarning?: boolean;
  /** Legacy positioning - omit when using layout */
  x?: number;
  /** Legacy positioning - omit when using layout */
  y?: number;
  /** When true, container gets layout property for flex participation */
  useLayout?: boolean;
}

function createPlusMinus(options: CreatePlusMinusOptions): Container {
  const { type, onClick, isWarning = false, x, y, useLayout = false } = options;

  const container = new Container();

  // Legacy positioning (for gradual migration)
  if (x !== undefined) container.x = x;
  if (y !== undefined) container.y = y;

  // Layout mode: set fixed dimensions for flex participation
  if (useLayout) {
    container.layout = { width: BTN_SIZE, height: BTN_SIZE };
  }

  const bgColor =
    type === "plus"
      ? isWarning
        ? COLORS.BTN_WARNING_BG
        : COLORS.BTN_PLUS_BG
      : COLORS.BTN_MINUS_BG;

  const bg = new Graphics();
  createRoundedRect(bg, 0, 0, BTN_SIZE, BTN_SIZE, BTN_RADIUS, bgColor);
  container.addChild(bg);

  const text = new Text({
    text: type === "plus" ? "+" : "\u2212", // Unicode minus
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize: 16,
      fontWeight: "bold",
      fill: COLORS.TEXT_PRIMARY,
    },
  });
  text.anchor.set(0.5);
  text.position.set(BTN_SIZE / 2, BTN_SIZE / 2);
  container.addChild(text);

  container.eventMode = "static";
  container.cursor = "pointer";
  container.on("pointertap", (e) => {
    e.stopPropagation();
    onClick();
  });
  container.on("pointerenter", () => {
    container.scale.set(1.1);
  });
  container.on("pointerleave", () => {
    container.scale.set(1);
  });

  return container;
}

// ============================================================================
// Component
// ============================================================================

export function PixiEnemyCard({
  enemies,
  onEnemyClick,
  onAssignBlockIncremental,
  onUnassignBlock,
  onCommitBlock,
  onAssignDamage,
  onAssignAttack,
  onUnassignAttack,
}: PixiEnemyCardProps) {
  const uniqueId = useId();
  const { app, overlayLayer } = usePixiApp();

  const rootContainerRef = useRef<Container | null>(null);
  const animManagerRef = useRef<AnimationManager | null>(null);
  const cardContainersRef = useRef<Map<string, Container>>(new Map());
  const isDestroyedRef = useRef(false);

  // Stable callback refs
  const onEnemyClickRef = useRef(onEnemyClick);
  const onAssignBlockRef = useRef(onAssignBlockIncremental);
  const onUnassignBlockRef = useRef(onUnassignBlock);
  const onCommitBlockRef = useRef(onCommitBlock);
  const onAssignDamageRef = useRef(onAssignDamage);
  const onAssignAttackRef = useRef(onAssignAttack);
  const onUnassignAttackRef = useRef(onUnassignAttack);

  // Update refs
  useEffect(() => {
    onEnemyClickRef.current = onEnemyClick;
    onAssignBlockRef.current = onAssignBlockIncremental;
    onUnassignBlockRef.current = onUnassignBlock;
    onCommitBlockRef.current = onCommitBlock;
    onAssignDamageRef.current = onAssignDamage;
    onAssignAttackRef.current = onAssignAttack;
    onUnassignAttackRef.current = onUnassignAttack;
  });

  // Build UI for a single enemy card
  const buildEnemyCard = useCallback(
    (data: EnemyCardData, animManager: AnimationManager): Container => {
      const { enemy, position, tokenRadius } = data;
      const container = new Container();
      container.label = `enemy-card-${enemy.instanceId}`;
      container.sortableChildren = true;

      // Position below the token, centered horizontally
      // Offset by -CARD_WIDTH/2 so the layout container is centered under the token
      container.x = position.x - CARD_WIDTH / 2;
      container.y = position.y + tokenRadius + 8;

      // Enable layout for children - vertical stack, centered
      // Set width so alignItems: "center" has a reference
      container.layout = {
        ...enemyCardRootLayout(),
        width: CARD_WIDTH,
      };

      // ========================================
      // Enemy Name (clickable) - LAYOUT MANAGED
      // ========================================
      const nameContainer = new Container();
      nameContainer.label = "name-section";
      // Layout: fixed height, centered content
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
      // Note: anchor is ignored in layout mode - centering handled by container layout
      nameText.layout = {}; // Opt into layout (intrinsic sizing)
      nameText.eventMode = "static";
      nameText.cursor = "pointer";
      nameText.on("pointertap", () => {
        onEnemyClickRef.current?.(enemy.instanceId);
      });
      nameContainer.addChild(nameText);

      container.addChild(nameContainer);

      // ========================================
      // Status Badges - LAYOUT MANAGED
      // ========================================
      if (enemy.isDefeated) {
        const badge = new Container();
        badge.label = "defeated-badge";
        badge.layout = enemyCardBadgeLayout();

        const bg = new Graphics();
        // Draw at 0,0 - layout handles positioning
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
        // Center text manually within the badge (internal positioning)
        text.anchor.set(0.5);
        text.position.set(40, BADGE_HEIGHT / 2);
        badge.addChild(text);

        container.addChild(badge);
      } else if (enemy.isBlocked) {
        const badge = new Container();
        badge.label = "blocked-badge";
        badge.layout = enemyCardBadgeLayout();

        const bg = new Graphics();
        // Draw at 0,0 - layout handles positioning
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
        // Center text manually within the badge (internal positioning)
        text.anchor.set(0.5);
        text.position.set(40, BADGE_HEIGHT / 2);
        badge.addChild(text);

        container.addChild(badge);
      }

      // ========================================
      // Damage Phase UI - LAYOUT MANAGED
      // ========================================
      if (data.isDamagePhase && data.damageOption && data.damageOption.unassignedDamage > 0) {
        const damageBtn = createButton({
          label: `Take ${data.damageOption.unassignedDamage} Damage`,
          width: CARD_WIDTH,
          height: COMMIT_BTN_HEIGHT,
          bgColor: COLORS.BTN_DAMAGE_BG,
          textColor: COLORS.TEXT_PRIMARY,
          onClick: () => onAssignDamageRef.current?.(enemy.instanceId),
          disabled: false,
          fontSize: 13,
          useLayout: true, // Layout manages positioning
        });
        container.addChild(damageBtn);
      }

      // ========================================
      // Block Allocation UI - LAYOUT MANAGED (outer container)
      // ========================================
      const showBlockAllocation =
        data.isBlockPhase &&
        data.enemyBlockState &&
        !enemy.isDefeated &&
        !enemy.isBlocked;

      if (showBlockAllocation && data.enemyBlockState) {
        const blockState = data.enemyBlockState;
        const assignableBlocks = data.assignableBlocks ?? [];
        const unassignableBlocks = data.unassignableBlocks ?? [];

        const blockContainer = new Container();
        blockContainer.label = "block-section";

        // Calculate background height (still needed for bg sizing)
        // Base: padding + label(14) + progress(20) + padding = ~54
        let bgHeight = 54;
        if (blockState.canBlock) {
          bgHeight += 16; // "Can Block!" row
        }
        if (blockState.isSwift) {
          bgHeight += 14; // Swift indicator
        }
        if (blockState.attackElement !== "physical") {
          bgHeight += 14; // Attack element info
        }
        if (assignableBlocks.length > 0 || unassignableBlocks.length > 0) {
          bgHeight += BTN_SIZE + 8; // +/- buttons row
        }
        // Add space for commit button if there's pending block
        const hasPendingBlock =
          blockState.pendingBlock &&
          (blockState.pendingBlock.physical > 0 ||
            blockState.pendingBlock.fire > 0 ||
            blockState.pendingBlock.ice > 0 ||
            blockState.pendingBlock.coldFire > 0);
        if (hasPendingBlock) {
          bgHeight += COMMIT_BTN_HEIGHT + CARD_PADDING;
        }

        // Layout: fixed size box, participates in root flex
        blockContainer.layout = {
          width: CARD_WIDTH,
          height: bgHeight,
        };

        // Background - draw at 0,0 since layout handles positioning
        const bg = new Graphics();
        createRoundedRect(
          bg,
          0,
          0,
          CARD_WIDTH,
          bgHeight,
          6,
          COLORS.CARD_BG,
          COLORS.CARD_BG_ALPHA,
          blockState.canBlock ? COLORS.BTN_READY_BG : COLORS.CARD_BORDER,
          1.5
        );
        blockContainer.addChild(bg);

        // Internal elements use manual positioning (relative to blockContainer origin)
        let blockY = CARD_PADDING;

        // Label row (centered)
        const blockLabel = new Text({
          text: "Block",
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 10,
            fontWeight: "600",
            fill: COLORS.TEXT_MUTED,
            letterSpacing: 0.5,
          },
        });
        blockLabel.anchor.set(0.5, 0);
        blockLabel.x = CARD_WIDTH / 2;
        blockLabel.y = blockY;
        blockContainer.addChild(blockLabel);
        blockY += 14;

        // Progress row (centered)
        const progressText = new Text({
          text: `${blockState.effectiveBlock} / ${blockState.requiredBlock}`,
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 16,
            fontWeight: "700",
            fill: COLORS.TEXT_PRIMARY,
          },
        });
        progressText.anchor.set(0.5, 0);
        progressText.x = CARD_WIDTH / 2;
        progressText.y = blockY;
        blockContainer.addChild(progressText);
        blockY += 20;

        // "Can Block!" indicator (own row, centered)
        if (blockState.canBlock) {
          const canBlockText = new Text({
            text: "\u2713 Can Block!",
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: "700",
              fill: COLORS.TEXT_SUCCESS,
            },
          });
          canBlockText.anchor.set(0.5, 0);
          canBlockText.x = CARD_WIDTH / 2;
          canBlockText.y = blockY;
          blockContainer.addChild(canBlockText);
          blockY += 16;
        }

        // Swift indicator
        if (blockState.isSwift) {
          const swiftText = new Text({
            text: "(2\u00D7 Swift)",
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 9,
              fill: COLORS.TEXT_GOLD,
            },
          });
          swiftText.x = CARD_PADDING;
          swiftText.y = blockY;
          blockContainer.addChild(swiftText);
          blockY += 14;
        }

        // Attack element info
        if (blockState.attackElement !== "physical") {
          const elementNames: Record<string, string> = {
            fire: "\uD83D\uDD25 Fire",
            ice: "\u2744 Ice",
            coldFire: "\uD83D\uDC9C Cold Fire",
          };
          const elementText = new Text({
            text: `Enemy attacks with: ${elementNames[blockState.attackElement] ?? blockState.attackElement}`,
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 9,
              fill: COLORS.TEXT_SECONDARY,
            },
          });
          elementText.x = CARD_PADDING;
          elementText.y = blockY;
          blockContainer.addChild(elementText);
          blockY += 14;
        }

        // +/- controls
        if (assignableBlocks.length > 0 || unassignableBlocks.length > 0) {
          const controlsRow = new Container();
          controlsRow.y = blockY;
          controlsRow.x = CARD_PADDING;

          let controlX = 0;
          const elements: AttackElement[] = ["physical", "fire", "ice", "coldFire"];

          for (const element of elements) {
            const assignOpts = assignableBlocks.filter((b) => b.element === element);
            const unassignOpts = unassignableBlocks.filter((u) => u.element === element);

            if (assignOpts.length === 0 && unassignOpts.length === 0) continue;

            // Element icon
            const iconText = new Text({
              text: ELEMENT_ICONS[element],
              style: {
                fontFamily: "Arial, sans-serif",
                fontSize: 12,
              },
            });
            iconText.x = controlX;
            iconText.y = 4;
            controlsRow.addChild(iconText);
            controlX += 18;

            // Minus button
            const firstUnassign = unassignOpts[0];
            if (firstUnassign) {
              const minusBtn = createPlusMinus({
                type: "minus",
                x: controlX,
                y: 0,
                onClick: () => {
                  onUnassignBlockRef.current?.(firstUnassign);
                },
              });
              controlsRow.addChild(minusBtn);
              controlX += BTN_SIZE + 2;
            }

            // Plus button
            const firstAssign = assignOpts[0];
            if (firstAssign) {
              const isBonus =
                (element === "fire" && blockState.attackElement === "ice") ||
                (element === "ice" && blockState.attackElement === "fire");
              const plusBtn = createPlusMinus({
                type: "plus",
                x: controlX,
                y: 0,
                onClick: () => {
                  onAssignBlockRef.current?.(firstAssign);
                },
                isWarning: isBonus,
              });
              controlsRow.addChild(plusBtn);
              controlX += BTN_SIZE + 8;
            }
          }

          blockContainer.addChild(controlsRow);
          blockY += BTN_SIZE + 4;
        }

        // Commit button (hasPendingBlock already calculated above for bgHeight)
        if (hasPendingBlock) {
          const commitLabel = blockState.canBlock
            ? "\u2713 Block Enemy"
            : `Need ${blockState.requiredBlock - blockState.effectiveBlock} more`;

          const commitBtn = createButton({
            label: commitLabel,
            x: CARD_PADDING,
            y: blockY,
            width: CARD_WIDTH - CARD_PADDING * 2,
            height: COMMIT_BTN_HEIGHT,
            bgColor: blockState.canBlock ? COLORS.BTN_READY_BG : COLORS.BTN_DISABLED_BG,
            textColor: blockState.canBlock ? COLORS.TEXT_PRIMARY : COLORS.BTN_DISABLED_TEXT,
            onClick: () => onCommitBlockRef.current?.(enemy.instanceId),
            disabled: !blockState.canBlock,
            fontSize: 12,
          });
          blockContainer.addChild(commitBtn);
          blockY += COMMIT_BTN_HEIGHT + CARD_PADDING;
        }

        container.addChild(blockContainer);
      }

      // ========================================
      // Attack Allocation UI - LAYOUT MANAGED (outer container)
      // ========================================
      const showAttackAllocation =
        data.isAttackPhase && data.enemyAttackState && !enemy.isDefeated;

      if (showAttackAllocation && data.enemyAttackState) {
        const attackState = data.enemyAttackState;
        const assignableAttacks = data.assignableAttacks ?? [];
        const unassignableAttacks = data.unassignableAttacks ?? [];
        const hasControls =
          !data.useDragDrop && (assignableAttacks.length > 0 || unassignableAttacks.length > 0);

        const attackContainer = new Container();
        attackContainer.label = "attack-section";

        // Calculate background height (still needed for bg sizing)
        // Base: padding + label(14) + progress(20) + padding = ~54
        let bgHeight = 54;
        if (attackState.canDefeat) {
          bgHeight += 16; // "Can Defeat!" row
        }
        if (attackState.resistances?.fire || attackState.resistances?.ice || attackState.resistances?.physical) {
          bgHeight += 18; // Resistances row
        }
        if (hasControls) {
          bgHeight += BTN_SIZE + 10; // +/- buttons row
        }

        // Layout: fixed size box, participates in root flex
        attackContainer.layout = {
          width: CARD_WIDTH,
          height: bgHeight,
        };

        // Background - draw at 0,0 since layout handles positioning
        const bg = new Graphics();
        createRoundedRect(
          bg,
          0,
          0,
          CARD_WIDTH,
          bgHeight,
          6,
          COLORS.CARD_BG,
          COLORS.CARD_BG_ALPHA,
          attackState.canDefeat ? COLORS.CAN_DEFEAT_GLOW : COLORS.CARD_BORDER,
          1.5
        );
        attackContainer.addChild(bg);

        let attackY = CARD_PADDING;

        // Label row (centered)
        const attackLabel = new Text({
          text: data.isRangedSiegePhase
            ? attackState.requiresSiege
              ? "Siege"
              : "Ranged/Siege"
            : "Attack",
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 10,
            fontWeight: "600",
            fill: COLORS.TEXT_MUTED,
            letterSpacing: 0.5,
          },
        });
        attackLabel.anchor.set(0.5, 0);
        attackLabel.x = CARD_WIDTH / 2;
        attackLabel.y = attackY;
        attackContainer.addChild(attackLabel);
        attackY += 14;

        // Progress row (centered)
        const progressText = new Text({
          text: `${attackState.totalEffectiveDamage} / ${attackState.armor}`,
          style: {
            fontFamily: "Arial, sans-serif",
            fontSize: 16,
            fontWeight: "700",
            fill: COLORS.TEXT_PRIMARY,
          },
        });
        progressText.anchor.set(0.5, 0);
        progressText.x = CARD_WIDTH / 2;
        progressText.y = attackY;
        attackContainer.addChild(progressText);
        attackY += 20;

        // "Can Defeat!" indicator (own row, centered)
        if (attackState.canDefeat) {
          const canDefeatText = new Text({
            text: "\u2713 Can Defeat!",
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 11,
              fontWeight: "700",
              fill: COLORS.TEXT_SUCCESS,
            },
          });
          canDefeatText.anchor.set(0.5, 0);
          canDefeatText.x = CARD_WIDTH / 2;
          canDefeatText.y = attackY;
          attackContainer.addChild(canDefeatText);

          // Pulse animation on "Can Defeat!" text
          const pulseCanDefeat = () => {
            if (isDestroyedRef.current || !canDefeatText.parent) return;
            animManager.animate(`can-defeat-pulse-${enemy.instanceId}`, canDefeatText, {
              endAlpha: 0.6,
              duration: 800,
              easing: Easing.easeInOutQuad,
              onComplete: () => {
                if (isDestroyedRef.current || !canDefeatText.parent) return;
                animManager.animate(`can-defeat-pulse-back-${enemy.instanceId}`, canDefeatText, {
                  endAlpha: 1,
                  duration: 800,
                  easing: Easing.easeInOutQuad,
                  onComplete: pulseCanDefeat,
                });
              },
            });
          };
          pulseCanDefeat();
          attackY += 16;
        }

        // Resistance warnings
        const resistances = attackState.resistances;
        if (resistances && (resistances.fire || resistances.ice || resistances.physical)) {
          const resistRow = new Container();
          resistRow.y = attackY;
          resistRow.x = CARD_PADDING;

          let resistX = 0;
          if (resistances.physical) {
            const physResist = new Text({
              text: `${ELEMENT_ICONS.physical}\u00BD`,
              style: { fontFamily: "Arial, sans-serif", fontSize: 11 },
            });
            physResist.x = resistX;
            resistRow.addChild(physResist);
            resistX += 28;
          }
          if (resistances.fire) {
            const fireResist = new Text({
              text: `${ELEMENT_ICONS.fire}\u00BD`,
              style: { fontFamily: "Arial, sans-serif", fontSize: 11 },
            });
            fireResist.x = resistX;
            resistRow.addChild(fireResist);
            resistX += 28;
          }
          if (resistances.ice) {
            const iceResist = new Text({
              text: `${ELEMENT_ICONS.ice}\u00BD`,
              style: { fontFamily: "Arial, sans-serif", fontSize: 11 },
            });
            iceResist.x = resistX;
            resistRow.addChild(iceResist);
          }

          attackContainer.addChild(resistRow);
          attackY += 16;
        }

        // +/- controls (only in non-DnD mode)
        if (hasControls) {
          const controlsRow = new Container();
          controlsRow.y = attackY;
          controlsRow.x = CARD_PADDING;

          let controlX = 0;
          const elements: AttackElement[] = ["physical", "fire", "ice", "coldFire"];

          for (const element of elements) {
            const assignOpts = assignableAttacks.filter((a) => a.element === element);
            const unassignOpts = unassignableAttacks.filter((u) => u.element === element);

            if (assignOpts.length === 0 && unassignOpts.length === 0) continue;

            // Element icon
            const iconText = new Text({
              text: ELEMENT_ICONS[element],
              style: {
                fontFamily: "Arial, sans-serif",
                fontSize: 12,
              },
            });
            iconText.x = controlX;
            iconText.y = 4;
            controlsRow.addChild(iconText);
            controlX += 18;

            // Minus button
            const firstUnassignAttack = unassignOpts[0];
            if (firstUnassignAttack) {
              const minusBtn = createPlusMinus({
                type: "minus",
                x: controlX,
                y: 0,
                onClick: () => {
                  onUnassignAttackRef.current?.(firstUnassignAttack);
                },
              });
              controlsRow.addChild(minusBtn);
              controlX += BTN_SIZE + 2;
            }

            // Plus button
            const firstAssignAttack = assignOpts[0];
            if (firstAssignAttack) {
              const isResisted =
                (element === "fire" && resistances?.fire) ||
                (element === "ice" && resistances?.ice) ||
                (element === "physical" && resistances?.physical);
              const plusBtn = createPlusMinus({
                type: "plus",
                x: controlX,
                y: 0,
                onClick: () => {
                  onAssignAttackRef.current?.(firstAssignAttack);
                },
                isWarning: isResisted,
              });
              controlsRow.addChild(plusBtn);
              controlX += BTN_SIZE + 8;
            }
          }

          attackContainer.addChild(controlsRow);
          attackY += BTN_SIZE + 8;
        }

        // Insufficient damage message
        if (
          assignableAttacks.length === 0 &&
          attackState.totalEffectiveDamage > 0 &&
          attackState.totalEffectiveDamage < attackState.armor
        ) {
          const insufficientText = new Text({
            text: `Need ${attackState.armor - attackState.totalEffectiveDamage} more`,
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 10,
              fill: COLORS.TEXT_WARNING,
            },
          });
          insufficientText.anchor.set(0.5, 0);
          insufficientText.x = CARD_WIDTH / 2;
          insufficientText.y = attackY;
          attackContainer.addChild(insufficientText);
        }

        // DnD hint when no damage assigned
        if (data.useDragDrop && attackState.totalEffectiveDamage === 0) {
          const dndHint = new Text({
            text: "Drag damage here",
            style: {
              fontFamily: "Arial, sans-serif",
              fontSize: 10,
              fill: COLORS.TEXT_MUTED,
              letterSpacing: 0.5,
            },
          });
          dndHint.anchor.set(0.5, 0);
          dndHint.x = CARD_WIDTH / 2;
          dndHint.y = attackY;
          attackContainer.addChild(dndHint);
        }

        container.addChild(attackContainer);
      }

      return container;
    },
    []
  );

  // Main effect to build all enemy cards
  useEffect(() => {
    if (!app || !overlayLayer) return;
    isDestroyedRef.current = false;

    // Capture refs for cleanup
    const cardContainers = cardContainersRef.current;

    // Create root container
    const rootContainer = new Container();
    rootContainer.label = `enemy-cards-${uniqueId}`;
    rootContainer.zIndex = PIXI_Z_INDEX.ENEMY_CARDS;
    rootContainer.sortableChildren = true;

    overlayLayer.addChild(rootContainer);
    overlayLayer.sortChildren();
    rootContainerRef.current = rootContainer;

    // Create animation manager
    const animManager = new AnimationManager();
    animManager.attach(app.ticker);
    animManagerRef.current = animManager;

    // Build card for each enemy
    enemies.forEach((data) => {
      const card = buildEnemyCard(data, animManager);
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

  // This component renders to PixiJS canvas, not DOM
  return null;
}
