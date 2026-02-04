/**
 * EnemyDetailPanel - Full rulebook details for an enemy
 *
 * Shows when player clicks an enemy token during combat.
 * Displays actual rulebook text for abilities and resistances.
 * Uses actual game icons instead of emojis.
 */

import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ClientCombatEnemy, EnemyAbilityType, Element } from "@mage-knight/shared";
import { ABILITY_DESCRIPTIONS, RESISTANCE_DESCRIPTIONS, ENEMIES } from "@mage-knight/shared";
import type { ResistanceType } from "@mage-knight/shared";
import { GameIcon, type GameIconType } from "../Icons";
import { getEnemyAttackElements, getEnemyAttacks, groupEnemyAttacks } from "../../utils/enemyAttacks";
import "./EnemyDetailPanel.css";

// Icon paths for abilities (fallback for abilities without GameIcon support)
const ABILITY_ICONS: Record<string, string> = {
  fortified: "/assets/icons/fortified.png",
  unfortified: "/assets/icons/unfortified.png",
  swift: "/assets/icons/swift.png",
  brutal: "/assets/icons/brutal.png",
  poison: "/assets/icons/poison.png",
  paralyze: "/assets/icons/paralyze.png",
  summon: "/assets/icons/summon.png",
  cumbersome: "/assets/icons/cumbersome.png",
};

// Icon paths for resistances
const RESISTANCE_ICONS: Record<string, GameIconType> = {
  physical: "physical_resist",
  fire: "fire_resist",
  ice: "ice_resist",
};

// Element display info
interface ElementInfoEntry {
  name: string;
  color: string;
  blockTip: string;
}

const ELEMENT_INFO: Record<string, ElementInfoEntry> = {
  physical: {
    name: "Physical",
    color: "#9ca3af",
    blockTip: "Any Block type is fully efficient.",
  },
  fire: {
    name: "Fire",
    color: "#ef4444",
    blockTip: "Ice or ColdFire Block is fully efficient. Other Block types are halved.",
  },
  ice: {
    name: "Ice",
    color: "#3b82f6",
    blockTip: "Fire or ColdFire Block is fully efficient. Other Block types are halved.",
  },
  cold_fire: {
    name: "ColdFire",
    color: "#a855f7",
    blockTip: "Only ColdFire Block is fully efficient. All other Block types are halved.",
  },
};

const DEFAULT_ELEMENT_INFO: ElementInfoEntry = {
  name: "Physical",
  color: "#9ca3af",
  blockTip: "Any Block type is fully efficient.",
};

function getAttackIconType(element: Element): GameIconType {
  return element === "physical" ? "attack" : (element as GameIconType);
}

interface EnemyDetailPanelProps {
  enemy: ClientCombatEnemy;
  onClose: () => void;
}

export function EnemyDetailPanel({ enemy, onClose }: EnemyDetailPanelProps) {
  const definition = ENEMIES[enemy.enemyId as keyof typeof ENEMIES];
  const attackSource = definition ?? enemy;
  const attacks = getEnemyAttacks(attackSource);
  const attackGroups = groupEnemyAttacks(attacks);
  const attackElements = getEnemyAttackElements(attackSource);
  const nonPhysicalElements = attackElements.filter((element) => element !== "physical");
  const hasResistances = enemy.resistances.length > 0;
  const hasElementalAttacks = nonPhysicalElements.length > 0;
  const hasMultipleAttacks = attacks.length > 1;
  const primaryElement = attacks[0]?.element ?? enemy.attackElement;
  const primaryElementInfo = ELEMENT_INFO[primaryElement] ?? DEFAULT_ELEMENT_INFO;

  // Get list of active resistances (resistances is already an array)
  const activeResistances: ResistanceType[] = [...enemy.resistances];

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="enemy-detail-backdrop" onClick={onClose}>
      <div className="enemy-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header with enemy image */}
        <div className="enemy-detail-header">
          <div className="enemy-detail-header-content">
            <img
              src={`/assets/enemies/${enemy.enemyId}.jpg`}
              alt={enemy.name}
              className="enemy-detail-portrait"
            />
            <div className="enemy-detail-header-text">
              <h2 className="enemy-detail-name">{enemy.name}</h2>
              <span className="enemy-detail-esc-hint">Press ESC to close</span>
            </div>
          </div>
          <button className="enemy-detail-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>

        {/* Stats */}
        <div className="enemy-detail-stats">
          <div className="enemy-detail-stat enemy-detail-stat--attacks">
            <div className="enemy-detail-stat-content enemy-detail-stat-content--attacks">
              <div className="enemy-detail-attack-groups">
                {attackGroups.map((group, groupIndex) => {
                  const elementInfo = ELEMENT_INFO[group.element] ?? DEFAULT_ELEMENT_INFO;
                  return (
                    <span
                      key={`${group.element}-${group.damage}-${groupIndex}`}
                      className="enemy-detail-attack-group"
                    >
                      <GameIcon
                        type={getAttackIconType(group.element)}
                        className="enemy-detail-stat-icon"
                      />
                      <span className="enemy-detail-stat-value" style={{ color: elementInfo.color }}>
                        {group.damage}
                        {group.count > 1 ? `×${group.count}` : ""}
                      </span>
                      {groupIndex < attackGroups.length - 1 && (
                        <span className="enemy-detail-attack-separator">+</span>
                      )}
                    </span>
                  );
                })}
              </div>
              <span className="enemy-detail-stat-label">
                {hasMultipleAttacks
                  ? "Attacks"
                  : primaryElement !== "physical"
                    ? primaryElementInfo.name
                    : "Attack"}
              </span>
            </div>
          </div>
          <div className="enemy-detail-stat">
            <GameIcon type="armor" className="enemy-detail-stat-icon" />
            <div className="enemy-detail-stat-content">
              <span className="enemy-detail-stat-value">{enemy.armor}</span>
              <span className="enemy-detail-stat-label">Armor</span>
            </div>
          </div>
          <div className="enemy-detail-stat">
            <GameIcon type="fame" className="enemy-detail-stat-icon" />
            <div className="enemy-detail-stat-content">
              <span className="enemy-detail-stat-value">{enemy.fame}</span>
              <span className="enemy-detail-stat-label">Fame</span>
            </div>
          </div>
        </div>

        {/* Attack Element Info */}
        {nonPhysicalElements.length > 0 && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">
              {nonPhysicalElements.length > 1 ? "Attack Elements" : "Attack"}
            </h3>
            {nonPhysicalElements.map((element) => {
              const elementInfo = ELEMENT_INFO[element] ?? DEFAULT_ELEMENT_INFO;
              return (
                <div key={element} className="enemy-detail-element-entry">
                  <div className="enemy-detail-section-header">
                    <span className="enemy-detail-element-badge" style={{ background: elementInfo.color }}>
                      {elementInfo.name}
                    </span>
                  </div>
                  <p className="enemy-detail-rule">{elementInfo.blockTip}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Abilities */}
        {enemy.abilities.length > 0 && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">Abilities</h3>
            <div className="enemy-detail-abilities">
              {enemy.abilities.map((ability) => {
                const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
                if (!desc) return null;
                // Try to use GameIcon first, fallback to image path, then to text
                const iconType = desc.icon as GameIconType | undefined;
                const iconPath = ABILITY_ICONS[ability] || null;
                return (
                  <div key={ability} className="enemy-detail-ability">
                    <div className="enemy-detail-ability-header">
                      {iconType ? (
                        <GameIcon type={iconType} className="enemy-detail-ability-icon" />
                      ) : iconPath ? (
                        <img src={iconPath} alt={desc.name} className="enemy-detail-ability-icon" />
                      ) : (
                        <span className="enemy-detail-ability-icon-fallback">{desc.icon}</span>
                      )}
                      <span className="enemy-detail-ability-name">{desc.name}</span>
                    </div>
                    <p className="enemy-detail-rule">{desc.fullDesc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resistances */}
        {hasResistances && (
          <div className="enemy-detail-section">
            <h3 className="enemy-detail-section-title">Resistances</h3>
            <div className="enemy-detail-resistances">
              {activeResistances.map((resistance) => {
                const desc = RESISTANCE_DESCRIPTIONS[resistance];
                const iconType = RESISTANCE_ICONS[resistance] || null;
                return (
                  <div key={resistance} className="enemy-detail-resistance">
                    <div className="enemy-detail-resistance-header">
                      {iconType ? (
                        <GameIcon type={iconType} className="enemy-detail-resistance-icon" />
                      ) : (
                        <span className="enemy-detail-resistance-icon-fallback">{desc.icon}</span>
                      )}
                      <span className="enemy-detail-resistance-name">{desc.name}</span>
                    </div>
                    <p className="enemy-detail-rule">{desc.fullDesc}</p>
                    <p className="enemy-detail-tip">{desc.counter}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No special traits */}
        {enemy.abilities.length === 0 && !hasResistances && !hasElementalAttacks && (
          <div className="enemy-detail-section">
            <p className="enemy-detail-note">
              This enemy has no special abilities or resistances. Standard attacks and blocks are fully effective.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
