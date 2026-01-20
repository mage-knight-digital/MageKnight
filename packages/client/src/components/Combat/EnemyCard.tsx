/**
 * EnemyCard - Displays a single enemy during combat using token artwork
 *
 * Click shows full rulebook details panel.
 */

import { useState, useRef } from "react";
import type { ClientCombatEnemy, BlockOption, DamageAssignmentOption, EnemyId } from "@mage-knight/shared";

// Temporary placeholder for AttackOption until Phase 5 UI migration
// Phase 5 will use the new EnemyAttackState from incremental allocation
interface LegacyAttackOption {
  enemyInstanceId: string;
  enemyName: string;
  enemyArmor: number;
  isDefeated: boolean;
  isFortified: boolean;
  requiresSiege: boolean;
}
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
  attackOption?: LegacyAttackOption;
  accumulatedAttack?: number;
  accumulatedSiege?: number;
  accumulatedRangedSiege?: number;
  onAssignAttack?: (enemyInstanceId: string) => void;
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
  attackOption,
  accumulatedAttack = 0,
  accumulatedSiege = 0,
  accumulatedRangedSiege = 0,
  onAssignAttack,
  isRangedSiegePhase = false,
  isStriking = false,
  strikeKey,
  hasAttacked = false,
  isAtFortifiedSite: _isAtFortifiedSite = false, // Unused until Phase 5 UI migration
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

  // Determine the effective attack value based on phase and fortification
  // - If enemy requires siege (fortified), only siege attacks count
  // - In ranged/siege phase (non-fortified), ranged + siege attacks count
  // - In normal attack phase, all attack types count
  const effectiveAttack = (() => {
    if (!attackOption) return 0;
    if (attackOption.requiresSiege) {
      // Fortified enemy - only siege attacks work
      return accumulatedSiege;
    }
    if (isRangedSiegePhase) {
      // Ranged/siege phase, non-fortified - ranged + siege attacks work
      return accumulatedRangedSiege;
    }
    // Normal attack phase - all attack types work
    return accumulatedAttack;
  })();

  // Show assign attack button when:
  // - In attack phase
  // - Enemy is not defeated
  // - We have some relevant accumulated attack for this target
  const showAssignAttack =
    isAttackPhase &&
    attackOption &&
    !enemy.isDefeated &&
    effectiveAttack > 0;

  const canDefeat = showAssignAttack && effectiveAttack >= (attackOption?.enemyArmor ?? 0);

  const handleAssignAttack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAssignAttack) {
      onAssignAttack(enemy.instanceId);
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

        {/* Assign Attack button during attack or ranged/siege phase */}
        {showAssignAttack && attackOption && (
          <button
            className={`enemy-token__action-btn ${canDefeat ? "enemy-token__action-btn--ready" : "enemy-token__action-btn--insufficient"}`}
            data-testid={`assign-attack-${enemy.instanceId}`}
            onClick={handleAssignAttack}
            disabled={!canDefeat}
          >
            <span className="enemy-token__action-label">
              {isRangedSiegePhase
                ? (attackOption.requiresSiege ? "Siege" : "Ranged")
                : "Attack"
              }
            </span>
            <span className="enemy-token__action-values">
              {effectiveAttack} / {attackOption.enemyArmor}
            </span>
            {canDefeat && <span className="enemy-token__action-result">✓ Defeat</span>}
            {!canDefeat && effectiveAttack > 0 && (
              <span className="enemy-token__action-result enemy-token__action-result--need">
                Need {attackOption.enemyArmor - effectiveAttack} more
              </span>
            )}
          </button>
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
