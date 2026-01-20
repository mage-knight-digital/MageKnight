/**
 * EnemyCard - Displays a single enemy during combat using token artwork
 *
 * Click shows full rulebook details panel.
 * Phase 5: Now uses incremental attack allocation with EnemyAttackState.
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
} from "@mage-knight/shared";
import { EnemyDetailPanel } from "./EnemyDetailPanel";
import "./EnemyCard.css";

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
  onAssignBlock?: (enemyInstanceId: string) => void;
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
}

export function EnemyCard({
  enemy,
  isTargetable,
  onClick,
  isBlockPhase,
  blockOption,
  accumulatedBlock = 0,
  onAssignBlock,
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
}: EnemyCardProps) {
  // Detail panel state (click to show)
  const [showDetailPanel, setShowDetailPanel] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleCardClick = () => {
    // Show detail panel on click
    setShowDetailPanel(true);
  };
  // Show assign block button when:
  // - In block phase
  // - Enemy is not defeated
  // - Enemy is not already blocked
  // - We have some accumulated block
  const showAssignBlock =
    isBlockPhase &&
    blockOption &&
    !enemy.isDefeated &&
    !enemy.isBlocked &&
    accumulatedBlock > 0;

  const canBlock = showAssignBlock && accumulatedBlock >= (blockOption?.requiredBlock ?? 0);

  const handleAssignBlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignBlock) {
      onAssignBlock(enemy.instanceId);
    }
  };

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
        {/* Assign Block button during block phase */}
        {showAssignBlock && blockOption && (
          <button
            className={`enemy-token__action-btn ${canBlock ? "enemy-token__action-btn--ready" : "enemy-token__action-btn--insufficient"}`}
            data-testid={`assign-block-${enemy.instanceId}`}
            onClick={handleAssignBlock}
            disabled={!canBlock}
          >
            <span className="enemy-token__action-label">Block</span>
            <span className="enemy-token__action-values">
              {accumulatedBlock} / {blockOption.requiredBlock}
              {blockOption.isSwift && <span className="enemy-token__swift-note">(2×)</span>}
            </span>
            {canBlock && <span className="enemy-token__action-result">✓ Blocked</span>}
            {!canBlock && accumulatedBlock > 0 && (
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

            {/* +/- buttons for available attack assignments */}
            {(hasAssignableAttacks || hasUnassignableAttacks) && (
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
