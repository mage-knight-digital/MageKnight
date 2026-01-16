/**
 * EnemyCard - Displays a single enemy during combat using token artwork
 *
 * Hover shows a tooltip with stats and abilities.
 */

import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import type { ClientCombatEnemy, BlockOption, DamageAssignmentOption, AttackOption, EnemyId, EnemyAbilityType } from "@mage-knight/shared";
import { ABILITY_DESCRIPTIONS } from "@mage-knight/shared";
import "./EnemyCard.css";

// Get enemy token image URL
function getEnemyImageUrl(enemyId: EnemyId): string {
  return `/assets/enemies/${enemyId}.jpg`;
}

// Element display names
const ELEMENT_NAMES: Record<string, string> = {
  physical: "",
  fire: "Fire",
  ice: "Ice",
  cold_fire: "ColdFire",
};

// Tooltip for enemy stats/abilities
function EnemyTooltip({ enemy, position }: { enemy: ClientCombatEnemy; position: { x: number; y: number } }) {
  const elementName = ELEMENT_NAMES[enemy.attackElement] || "";
  const hasResistances = enemy.resistances.physical || enemy.resistances.fire || enemy.resistances.ice;

  return (
    <div
      className="enemy-combat-tooltip"
      style={{ left: position.x, top: position.y }}
    >
      <div className="enemy-combat-tooltip__content">
        {/* Stats row */}
        <div className="enemy-combat-tooltip__stats">
          <span className="enemy-combat-tooltip__stat">
            <span className="enemy-combat-tooltip__stat-icon">⚔️</span>
            <span className="enemy-combat-tooltip__stat-value">{enemy.attack}</span>
            {elementName && <span className="enemy-combat-tooltip__stat-element">{elementName}</span>}
          </span>
          <span className="enemy-combat-tooltip__stat">
            <span className="enemy-combat-tooltip__stat-icon">🛡️</span>
            <span className="enemy-combat-tooltip__stat-value">{enemy.armor}</span>
          </span>
        </div>

        {/* Abilities */}
        {enemy.abilities.length > 0 && (
          <div className="enemy-combat-tooltip__abilities">
            {enemy.abilities.map((ability) => {
              const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
              return (
                <div key={ability} className="enemy-combat-tooltip__ability">
                  <span className="enemy-combat-tooltip__ability-icon">{desc?.icon || "•"}</span>
                  <span className="enemy-combat-tooltip__ability-name">{desc?.name || ability}</span>
                  <span className="enemy-combat-tooltip__ability-desc">{desc?.shortDesc}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Resistances */}
        {hasResistances && (
          <div className="enemy-combat-tooltip__resistances">
            <span className="enemy-combat-tooltip__resistance-label">Resists:</span>
            {enemy.resistances.physical && <span className="enemy-combat-tooltip__resistance">Physical</span>}
            {enemy.resistances.fire && <span className="enemy-combat-tooltip__resistance enemy-combat-tooltip__resistance--fire">Fire</span>}
            {enemy.resistances.ice && <span className="enemy-combat-tooltip__resistance enemy-combat-tooltip__resistance--ice">Ice</span>}
          </div>
        )}
      </div>
    </div>
  );
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
  attackOption?: AttackOption;
  accumulatedAttack?: number;
  onAssignAttack?: (enemyInstanceId: string) => void;
  isRangedSiegePhase?: boolean;
  isStriking?: boolean;
  strikeKey?: number;
  hasAttacked?: boolean;
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
  onAssignAttack,
  isRangedSiegePhase = false,
  isStriking = false,
  strikeKey,
  hasAttacked = false,
}: EnemyCardProps) {
  // Tooltip hover state
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hoverTimerRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    // Show tooltip after brief delay
    hoverTimerRef.current = window.setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        setTooltipPosition({
          x: rect.right + 12,
          y: rect.top,
        });
        setShowTooltip(true);
      }
    }, 300);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowTooltip(false);
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

  // Show assign attack button when:
  // - In attack phase
  // - Enemy is not defeated
  // - We have some accumulated attack
  const showAssignAttack =
    isAttackPhase &&
    attackOption &&
    !enemy.isDefeated &&
    accumulatedAttack > 0;

  const canDefeat = showAssignAttack && accumulatedAttack >= (attackOption?.enemyArmor ?? 0);

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
      onClick={isTargetable ? onClick : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      data-testid={`enemy-card-${enemy.instanceId}`}
      data-strike-key={strikeKey}
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
      <div className="enemy-token__name">{enemy.name}</div>

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
            Block ({accumulatedBlock}/{blockOption.requiredBlock})
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
            {isRangedSiegePhase
              ? (attackOption.requiresSiege ? "Siege" : "Ranged")
              : "Attack"
            } ({accumulatedAttack}/{attackOption.enemyArmor})
          </button>
        )}

        {/* Show warning if enemy requires siege but we don't have siege attacks */}
        {isRangedSiegePhase && attackOption?.requiresSiege && accumulatedAttack > 0 && !canDefeat && (
          <div className="enemy-token__warning">
            Requires Siege
          </div>
        )}
      </div>

      {/* Hover tooltip - rendered via portal to escape transform context */}
      {showTooltip && createPortal(
        <EnemyTooltip enemy={enemy} position={tooltipPosition} />,
        document.body
      )}
    </div>
  );
}
