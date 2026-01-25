/**
 * EnemyCard - Displays a single enemy during combat using token artwork
 *
 * Click shows full rulebook details panel.
 * Phase 5: Now uses incremental attack allocation with EnemyAttackState.
 * Drop target highlighting handled by PixiEnemyTokens.
 */

import { useState, useRef } from "react";
import type {
  ClientCombatEnemy,
  BlockOption,
  DamageAssignmentOption,
  EnemyId,
  EnemyAttackState,
  AssignAttackOption,
  UnassignAttackOption,
  EnemyBlockState,
  AssignBlockOption,
  UnassignBlockOption,
} from "@mage-knight/shared";
import { EnemyDetailPanel } from "./EnemyDetailPanel";
import { CrackEffect } from "./CrackEffect";
import { useOverlay } from "../../contexts/OverlayContext";
import "./EnemyCard.css";
import "./CrackEffect.css";

// Get enemy token image URL
function getEnemyImageUrl(enemyId: EnemyId): string {
  return `/assets/enemies/${enemyId}.jpg`;
}

interface EnemyCardProps {
  enemy: ClientCombatEnemy;
  isTargetable?: boolean;
  onClick?: () => void;
  isBlockPhase?: boolean;
  blockOption?: BlockOption;
  accumulatedBlock?: number;
  /** Enemy state with pending block from incremental allocation */
  enemyBlockState?: EnemyBlockState;
  /** Valid assign block options for this enemy */
  assignableBlocks?: readonly AssignBlockOption[];
  /** Valid unassign block options for this enemy */
  unassignableBlocks?: readonly UnassignBlockOption[];
  /** Callback to incrementally assign block */
  onAssignBlockIncremental?: (option: AssignBlockOption) => void;
  /** Callback to unassign block */
  onUnassignBlock?: (option: UnassignBlockOption) => void;
  /** Callback to commit block (DECLARE_BLOCK) */
  onCommitBlock?: (enemyInstanceId: string) => void;
  isDamagePhase?: boolean;
  damageOption?: DamageAssignmentOption;
  onAssignDamage?: (enemyInstanceId: string) => void;
  isAttackPhase?: boolean;
  /** Enemy state with pending damage from incremental allocation */
  enemyAttackState?: EnemyAttackState;
  /** Valid assign attack options for this enemy */
  assignableAttacks?: readonly AssignAttackOption[];
  /** Valid unassign attack options for this enemy */
  unassignableAttacks?: readonly UnassignAttackOption[];
  /** Callback to assign attack */
  onAssignAttack?: (option: AssignAttackOption) => void;
  /** Callback to unassign attack */
  onUnassignAttack?: (option: UnassignAttackOption) => void;
  isRangedSiegePhase?: boolean;
  isStriking?: boolean;
  strikeKey?: number;
  hasAttacked?: boolean;
  isAtFortifiedSite?: boolean;
  /** Whether drag-and-drop mode is active (vs +/- buttons) */
  useDragDrop?: boolean;
}

export function EnemyCard({
  enemy,
  isTargetable,
  onClick,
  isBlockPhase,
  blockOption,
  accumulatedBlock = 0,
  enemyBlockState,
  assignableBlocks = [],
  unassignableBlocks = [],
  onAssignBlockIncremental,
  onUnassignBlock,
  onCommitBlock,
  isDamagePhase,
  damageOption,
  onAssignDamage,
  isAttackPhase,
  enemyAttackState,
  assignableAttacks = [],
  unassignableAttacks = [],
  onAssignAttack,
  onUnassignAttack,
  isRangedSiegePhase = false,
  isStriking = false,
  strikeKey,
  hasAttacked = false,
  isAtFortifiedSite: _isAtFortifiedSite = false,
  useDragDrop = false,
}: EnemyCardProps) {
  // Detail panel state (click to show)
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Check if an overlay (like pie menu) is active - don't respond to clicks if so
  const { isOverlayActive } = useOverlay();

  const handleCardClick = () => {
    // Don't show detail panel if an overlay (pie menu) is active
    if (isOverlayActive) return;
    setShowDetailPanel(true);
  };
  // ========================================
  // Incremental Block Allocation (Phase 6)
  // ========================================

  // Show block allocation UI when:
  // - In block phase
  // - Enemy is not defeated
  // - Enemy is not already blocked
  // - We have enemy block state from server
  const showBlockAllocation =
    isBlockPhase &&
    enemyBlockState &&
    !enemy.isDefeated &&
    !enemy.isBlocked;

  // Get values from server-computed enemy block state
  const pendingBlock = enemyBlockState?.pendingBlock;
  const effectiveBlock = enemyBlockState?.effectiveBlock ?? 0;
  const requiredBlock = enemyBlockState?.requiredBlock ?? blockOption?.requiredBlock ?? 0;
  const canBlock = enemyBlockState?.canBlock ?? false;
  const isSwift = enemyBlockState?.isSwift ?? blockOption?.isSwift ?? false;
  const attackElement = enemyBlockState?.attackElement ?? "physical";

  // Group assignable blocks by element for the +/- buttons
  const hasAssignableBlocks = assignableBlocks.length > 0;
  const hasUnassignableBlocks = unassignableBlocks.length > 0;
  const hasPendingBlock =
    pendingBlock &&
    (pendingBlock.physical > 0 || pendingBlock.fire > 0 || pendingBlock.ice > 0 || pendingBlock.coldFire > 0);

  // Handle assigning +1 block of a given element
  const handleAssignBlockIncremental = (e: React.MouseEvent, option: AssignBlockOption) => {
    e.stopPropagation();
    if (onAssignBlockIncremental) {
      onAssignBlockIncremental(option);
    }
  };

  // Handle unassigning -1 block of a given element
  const handleUnassignBlock = (e: React.MouseEvent, option: UnassignBlockOption) => {
    e.stopPropagation();
    if (onUnassignBlock) {
      onUnassignBlock(option);
    }
  };

  // Handle committing block (DECLARE_BLOCK)
  const handleCommitBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCommitBlock) {
      onCommitBlock(enemy.instanceId);
    }
  };

  // Fallback: Show old-style block button if no incremental data
  // (for backward compatibility during transition)
  const showLegacyBlockButton =
    isBlockPhase &&
    blockOption &&
    !enemy.isDefeated &&
    !enemy.isBlocked &&
    accumulatedBlock > 0 &&
    !enemyBlockState;

  const canBlockLegacy = showLegacyBlockButton && accumulatedBlock >= (blockOption?.requiredBlock ?? 0);

  // Show assign damage button when:
  // - In damage phase
  // - Enemy has unassigned damage
  const showAssignDamage = isDamagePhase && damageOption && damageOption.unassignedDamage > 0;

  const handleAssignDamage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignDamage) {
      onAssignDamage(enemy.instanceId);
    }
  };

  // ========================================
  // Incremental Attack Allocation (Phase 5)
  // ========================================

  // Show attack allocation UI when:
  // - In attack phase (ranged/siege or melee)
  // - Enemy is not defeated
  // - We have enemy attack state from server
  const showAttackAllocation =
    isAttackPhase &&
    enemyAttackState &&
    !enemy.isDefeated;

  // Get values from server-computed enemy attack state
  const pendingDamage = enemyAttackState?.pendingDamage;
  const effectiveDamage = enemyAttackState?.effectiveDamage;
  const totalEffectiveDamage = enemyAttackState?.totalEffectiveDamage ?? 0;
  const canDefeat = enemyAttackState?.canDefeat ?? false;
  const armor = enemyAttackState?.armor ?? enemy.armor;
  const resistances = enemyAttackState?.resistances;
  const requiresSiege = enemyAttackState?.requiresSiege ?? false;

  // Group assignable attacks by element for the +/- buttons
  const hasAssignableAttacks = assignableAttacks.length > 0;
  const hasUnassignableAttacks = unassignableAttacks.length > 0;

  // Handle assigning +1 attack of a given type
  const handleAssignAttack = (e: React.MouseEvent, option: AssignAttackOption) => {
    e.stopPropagation();
    if (onAssignAttack) {
      onAssignAttack(option);
    }
  };

  // Handle unassigning -1 attack of a given type
  const handleUnassignAttack = (e: React.MouseEvent, option: UnassignAttackOption) => {
    e.stopPropagation();
    if (onUnassignAttack) {
      onUnassignAttack(option);
    }
  };

  const classNames = [
    "enemy-token",
    enemy.isDefeated && "enemy-token--defeated",
    enemy.isBlocked && "enemy-token--blocked",
    isTargetable && "enemy-token--targetable",
    isStriking && "enemy-token--striking",
    hasAttacked && !isStriking && "enemy-token--has-attacked",
    canDefeat && !enemy.isDefeated && "enemy-token--can-defeat",
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={cardRef}
      className={classNames}
      onClick={isTargetable ? onClick : handleCardClick}
      data-testid={`enemy-card-${enemy.instanceId}`}
      data-strike-key={strikeKey}
      role="button"
      tabIndex={0}
      style={{ cursor: "pointer" }}
    >
      {/* Token image */}
      <div className="enemy-token__image-wrapper">
        <img
          src={getEnemyImageUrl(enemy.enemyId)}
          alt={enemy.name}
          className="enemy-token__image"
          draggable={false}
        />

        {/* Crack effect overlay - shows when enemy can be defeated */}
        <CrackEffect active={canDefeat && !enemy.isDefeated} />

        {/* Status overlay */}
        {enemy.isDefeated && (
          <div className="enemy-token__overlay enemy-token__overlay--defeated">
            <span>DEFEATED</span>
          </div>
        )}
        {enemy.isBlocked && !enemy.isDefeated && (
          <div
            className="enemy-token__overlay enemy-token__overlay--blocked"
            data-testid={`enemy-${enemy.instanceId}-status`}
          >
            <span>BLOCKED</span>
          </div>
        )}

      </div>

      {/* Enemy name below token */}
      <div className="enemy-token__name">
        {enemy.name}
        <span className="enemy-token__click-hint">click for details</span>
      </div>

      {/* Action buttons */}
      <div className="enemy-token__actions">
        {/* Incremental Block Allocation UI (Phase 6) */}
        {showBlockAllocation && (
          <div
            className={`enemy-token__block-allocation ${canBlock ? "enemy-token__block-allocation--can-block" : ""}`}
            data-testid={`block-allocation-${enemy.instanceId}`}
          >
            {/* Header: Block progress */}
            <div className="enemy-token__block-header">
              <span className="enemy-token__block-label">Block</span>
              <span className="enemy-token__block-progress">
                {effectiveBlock} / {requiredBlock}
                {isSwift && <span className="enemy-token__swift-note">(2× Swift)</span>}
              </span>
              {canBlock && (
                <span className="enemy-token__can-block">✓ Can Block!</span>
              )}
            </div>

            {/* Enemy attack element info */}
            {attackElement !== "physical" && (
              <div className="enemy-token__attack-element">
                Enemy attacks with: {attackElement === "fire" ? "🔥 Fire" : attackElement === "ice" ? "❄️ Ice" : "💜 Cold Fire"}
              </div>
            )}

            {/* Pending block breakdown by element */}
            {hasPendingBlock && pendingBlock && (
              <div className="enemy-token__pending-block">
                {pendingBlock.physical > 0 && (
                  <div className="enemy-token__block-row">
                    <span className="enemy-token__block-icon">⚔️</span>
                    <span className="enemy-token__block-value">{pendingBlock.physical}</span>
                  </div>
                )}
                {pendingBlock.fire > 0 && (
                  <div className="enemy-token__block-row">
                    <span className="enemy-token__block-icon">🔥</span>
                    <span className="enemy-token__block-value">{pendingBlock.fire}</span>
                    {attackElement === "ice" && <span className="enemy-token__block-bonus">×2!</span>}
                  </div>
                )}
                {pendingBlock.ice > 0 && (
                  <div className="enemy-token__block-row">
                    <span className="enemy-token__block-icon">❄️</span>
                    <span className="enemy-token__block-value">{pendingBlock.ice}</span>
                    {attackElement === "fire" && <span className="enemy-token__block-bonus">×2!</span>}
                  </div>
                )}
                {pendingBlock.coldFire > 0 && (
                  <div className="enemy-token__block-row">
                    <span className="enemy-token__block-icon">💜</span>
                    <span className="enemy-token__block-value">{pendingBlock.coldFire}</span>
                  </div>
                )}
              </div>
            )}

            {/* +/- buttons for available block assignments */}
            {(hasAssignableBlocks || hasUnassignableBlocks) && (
              <div className="enemy-token__block-controls">
                {/* Group buttons by element */}
                {["physical", "fire", "ice", "coldFire"].map((element) => {
                  const assignOptions = assignableBlocks.filter(b => b.element === element);
                  const unassignOptions = unassignableBlocks.filter(u => u.element === element);

                  if (assignOptions.length === 0 && unassignOptions.length === 0) return null;

                  const icon = element === "physical" ? "⚔️" :
                               element === "fire" ? "🔥" :
                               element === "ice" ? "❄️" : "💜";
                  // Show bonus indicator if this element is effective vs enemy attack
                  const isBonus = (element === "fire" && attackElement === "ice") ||
                                  (element === "ice" && attackElement === "fire");

                  const firstUnassign = unassignOptions[0];
                  const firstAssign = assignOptions[0];

                  return (
                    <div
                      key={element}
                      className={`enemy-token__element-control ${isBonus ? "enemy-token__element-control--bonus" : ""}`}
                    >
                      <span className="enemy-token__element-icon">{icon}</span>
                      {firstUnassign && (
                        <button
                          className="enemy-token__control-btn enemy-token__control-btn--minus"
                          onClick={(e) => handleUnassignBlock(e, firstUnassign)}
                          title={`Remove ${element} block`}
                        >
                          −
                        </button>
                      )}
                      {firstAssign && (
                        <button
                          className={`enemy-token__control-btn enemy-token__control-btn--plus ${isBonus ? "enemy-token__control-btn--bonus" : ""}`}
                          onClick={(e) => handleAssignBlockIncremental(e, firstAssign)}
                          title={`Add ${element} block${isBonus ? " (×2 effective!)" : ""}`}
                        >
                          +
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Commit Block button */}
            {hasPendingBlock && (
              <button
                className={`enemy-token__commit-block ${canBlock ? "enemy-token__commit-block--ready" : "enemy-token__commit-block--insufficient"}`}
                onClick={handleCommitBlock}
                disabled={!canBlock}
              >
                {canBlock ? "✓ Block Enemy" : `Need ${requiredBlock - effectiveBlock} more`}
              </button>
            )}

            {/* No block assigned yet message */}
            {!hasPendingBlock && hasAssignableBlocks && (
              <div className="enemy-token__block-hint">
                Use +/- to assign block
              </div>
            )}
          </div>
        )}

        {/* Legacy Block button (fallback if no incremental data) */}
        {showLegacyBlockButton && blockOption && (
          <button
            className={`enemy-token__action-btn ${canBlockLegacy ? "enemy-token__action-btn--ready" : "enemy-token__action-btn--insufficient"}`}
            data-testid={`assign-block-${enemy.instanceId}`}
            onClick={handleCommitBlock}
            disabled={!canBlockLegacy}
          >
            <span className="enemy-token__action-label">Block</span>
            <span className="enemy-token__action-values">
              {accumulatedBlock} / {blockOption.requiredBlock}
              {blockOption.isSwift && <span className="enemy-token__swift-note">(2×)</span>}
            </span>
            {canBlockLegacy && <span className="enemy-token__action-result">✓ Blocked</span>}
            {!canBlockLegacy && accumulatedBlock > 0 && (
              <span className="enemy-token__action-result enemy-token__action-result--need">
                Need {blockOption.requiredBlock - accumulatedBlock} more
              </span>
            )}
          </button>
        )}

        {/* Assign Damage button during damage phase */}
        {showAssignDamage && damageOption && (
          <button
            className="enemy-token__action-btn enemy-token__action-btn--damage"
            data-testid={`assign-damage-${enemy.instanceId}`}
            onClick={handleAssignDamage}
          >
            Take {damageOption.unassignedDamage} Damage
          </button>
        )}

        {/* Incremental Attack Allocation UI (Phase 5) */}
        {showAttackAllocation && (
          <div
            className={`enemy-token__attack-allocation ${canDefeat ? "enemy-token__attack-allocation--can-defeat" : ""}`}
            data-testid={`attack-allocation-${enemy.instanceId}`}
          >
            {/* Header: Attack type and progress */}
            <div className="enemy-token__attack-header">
              <span className="enemy-token__attack-label">
                {isRangedSiegePhase
                  ? (requiresSiege ? "Siege" : "Ranged/Siege")
                  : "Attack"
                }
              </span>
              <span className="enemy-token__attack-progress">
                {totalEffectiveDamage} / {armor}
              </span>
              {canDefeat && (
                <span className="enemy-token__can-defeat">✓ Can Defeat!</span>
              )}
            </div>

            {/* Resistance warnings */}
            {resistances && (resistances.fire || resistances.ice || resistances.physical) && (
              <div className="enemy-token__resistances">
                {resistances.physical && <span className="enemy-token__resistance">⚔️½</span>}
                {resistances.fire && <span className="enemy-token__resistance">🔥½</span>}
                {resistances.ice && <span className="enemy-token__resistance">❄️½</span>}
              </div>
            )}

            {/* Pending damage breakdown by element */}
            {pendingDamage && (pendingDamage.physical > 0 || pendingDamage.fire > 0 || pendingDamage.ice > 0 || pendingDamage.coldFire > 0) && (
              <div className="enemy-token__pending-damage">
                {pendingDamage.physical > 0 && (
                  <div className="enemy-token__damage-row">
                    <span className="enemy-token__damage-icon">⚔️</span>
                    <span className="enemy-token__damage-raw">{pendingDamage.physical}</span>
                    {effectiveDamage && pendingDamage.physical !== effectiveDamage.physical && (
                      <span className="enemy-token__damage-effective">→{effectiveDamage.physical}</span>
                    )}
                  </div>
                )}
                {pendingDamage.fire > 0 && (
                  <div className={`enemy-token__damage-row ${resistances?.fire ? "enemy-token__damage-row--resisted" : ""}`}>
                    <span className="enemy-token__damage-icon">🔥</span>
                    <span className="enemy-token__damage-raw">{pendingDamage.fire}</span>
                    {effectiveDamage && pendingDamage.fire !== effectiveDamage.fire && (
                      <span className="enemy-token__damage-effective">→{effectiveDamage.fire}</span>
                    )}
                  </div>
                )}
                {pendingDamage.ice > 0 && (
                  <div className={`enemy-token__damage-row ${resistances?.ice ? "enemy-token__damage-row--resisted" : ""}`}>
                    <span className="enemy-token__damage-icon">❄️</span>
                    <span className="enemy-token__damage-raw">{pendingDamage.ice}</span>
                    {effectiveDamage && pendingDamage.ice !== effectiveDamage.ice && (
                      <span className="enemy-token__damage-effective">→{effectiveDamage.ice}</span>
                    )}
                  </div>
                )}
                {pendingDamage.coldFire > 0 && (
                  <div className="enemy-token__damage-row">
                    <span className="enemy-token__damage-icon">💜</span>
                    <span className="enemy-token__damage-raw">{pendingDamage.coldFire}</span>
                    {effectiveDamage && pendingDamage.coldFire !== effectiveDamage.coldFire && (
                      <span className="enemy-token__damage-effective">→{effectiveDamage.coldFire}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* +/- buttons for available attack assignments (hidden in DnD mode) */}
            {!useDragDrop && (hasAssignableAttacks || hasUnassignableAttacks) && (
              <div className="enemy-token__attack-controls">
                {/* Group buttons by element */}
                {["physical", "fire", "ice", "coldFire"].map((element) => {
                  const assignOptions = assignableAttacks.filter(a => a.element === element);
                  const unassignOptions = unassignableAttacks.filter(u => u.element === element);

                  if (assignOptions.length === 0 && unassignOptions.length === 0) return null;

                  const icon = element === "physical" ? "⚔️" :
                               element === "fire" ? "🔥" :
                               element === "ice" ? "❄️" : "💜";
                  const isResisted = (element === "fire" && resistances?.fire) ||
                                    (element === "ice" && resistances?.ice) ||
                                    (element === "physical" && resistances?.physical);

                  const firstUnassign = unassignOptions[0];
                  const firstAssign = assignOptions[0];

                  return (
                    <div
                      key={element}
                      className={`enemy-token__element-control ${isResisted ? "enemy-token__element-control--resisted" : ""}`}
                    >
                      <span className="enemy-token__element-icon">{icon}</span>
                      {firstUnassign && (
                        <button
                          className="enemy-token__control-btn enemy-token__control-btn--minus"
                          onClick={(e) => handleUnassignAttack(e, firstUnassign)}
                          title={`Remove ${element} damage`}
                        >
                          −
                        </button>
                      )}
                      {firstAssign && (
                        <button
                          className={`enemy-token__control-btn enemy-token__control-btn--plus ${isResisted ? "enemy-token__control-btn--warning" : ""}`}
                          onClick={(e) => handleAssignAttack(e, firstAssign)}
                          title={`Add ${element} damage${isResisted ? " (halved!)" : ""}`}
                        >
                          +
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Insufficient attack message */}
            {!hasAssignableAttacks && totalEffectiveDamage > 0 && totalEffectiveDamage < armor && (
              <div className="enemy-token__attack-insufficient">
                Need {armor - totalEffectiveDamage} more
              </div>
            )}

            {/* DnD hint when no damage assigned yet */}
            {useDragDrop && totalEffectiveDamage === 0 && (
              <div className="enemy-token__dnd-hint">
                Drag damage here
              </div>
            )}
          </div>
        )}

      </div>

      {/* Detail panel - full rulebook details on click */}
      {showDetailPanel && (
        <EnemyDetailPanel
          enemy={enemy}
          onClose={() => setShowDetailPanel(false)}
        />
      )}
    </div>
  );
}
