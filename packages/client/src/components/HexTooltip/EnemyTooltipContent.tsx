/**
 * EnemyTooltipContent - Shows enemy information in the hex tooltip
 *
 * Displays for each enemy:
 * - Name and color
 * - Attack value and element
 * - Armor value
 * - Fame reward
 * - Abilities (swift, poison, etc.)
 * - Resistances
 */

import type { ClientHexEnemy } from "@mage-knight/shared";
import { ENEMIES } from "@mage-knight/shared";

export interface EnemyTooltipContentProps {
  enemies: readonly ClientHexEnemy[];
  isAnimating: boolean;
  /** Whether to show "Guarded by:" header (when shown with site) */
  showHeader?: boolean;
  /** Starting index for animation delay (for chaining with other content) */
  startIndex?: number;
}

// Element display names
const ELEMENT_NAMES: Record<string, string> = {
  physical: "",
  fire: "Fire",
  ice: "Ice",
  cold_fire: "ColdFire",
};

// Ability display with icons
const ABILITY_DISPLAY: Record<string, { icon: string; name: string }> = {
  swift: { icon: "⚡", name: "Swift" },
  brutal: { icon: "💀", name: "Brutal" },
  poison: { icon: "☠️", name: "Poison" },
  paralyze: { icon: "🔒", name: "Paralyze" },
  fortified: { icon: "🛡️", name: "Fortified" },
  summon: { icon: "✨", name: "Summon" },
  cumbersome: { icon: "🐢", name: "Cumbersome" },
  unfortified: { icon: "📍", name: "Unfortified" },
};

// Enemy color display
const COLOR_EMOJI: Record<string, string> = {
  green: "🟢",
  gray: "⚪",
  brown: "🟤",
  violet: "🟣",
  red: "🔴",
  white: "⬜",
};

function getEnemyIdFromToken(tokenId: string): string {
  // Token ID format: "enemyId_instanceNumber" e.g., "swamp_dragon_0"
  const parts = tokenId.split("_");
  // Remove the last part (instance number)
  parts.pop();
  return parts.join("_");
}

export function EnemyTooltipContent({
  enemies,
  isAnimating,
  showHeader = false,
  startIndex = 0,
}: EnemyTooltipContentProps) {
  let lineIndex = startIndex;

  const getLineStyle = () => {
    const delay = isAnimating ? `${lineIndex++ * 0.08}s` : "0s";
    return { animationDelay: delay };
  };

  // Filter to only revealed enemies with token IDs
  const revealedEnemies = enemies.filter((e) => e.isRevealed && e.tokenId);
  const unrevealedCount = enemies.filter((e) => !e.isRevealed).length;

  return (
    <div className="enemy-tooltip">
      {showHeader && (
        <div className="enemy-tooltip__header" style={getLineStyle()}>
          GUARDED BY
        </div>
      )}

      {revealedEnemies.map((enemy, idx) => {
        if (!enemy.tokenId) return null;

        const enemyId = getEnemyIdFromToken(enemy.tokenId);
        const definition = ENEMIES[enemyId as keyof typeof ENEMIES];

        if (!definition) {
          // Unknown enemy - show just the color
          return (
            <div key={idx} className="enemy-tooltip__enemy" style={getLineStyle()}>
              <div className="enemy-tooltip__enemy-header">
                <span className="enemy-tooltip__enemy-color">
                  {COLOR_EMOJI[enemy.color] || "❓"}
                </span>
                <span className="enemy-tooltip__enemy-name">Unknown Enemy</span>
              </div>
            </div>
          );
        }

        const elementName = ELEMENT_NAMES[definition.attackElement] || "";
        const hasResistances =
          definition.resistances.physical ||
          definition.resistances.fire ||
          definition.resistances.ice;

        return (
          <div key={idx} className="enemy-tooltip__enemy" style={getLineStyle()}>
            <div className="enemy-tooltip__enemy-header">
              <span className="enemy-tooltip__enemy-color">
                {COLOR_EMOJI[definition.color] || "❓"}
              </span>
              <span className="enemy-tooltip__enemy-name">{definition.name}</span>
            </div>

            <div className="enemy-tooltip__enemy-stats">
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">⚔️</span>
                <span className="enemy-tooltip__stat-value">{definition.attack}</span>
                {elementName && (
                  <span className="enemy-tooltip__stat-element">{elementName}</span>
                )}
              </span>
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">🛡️</span>
                <span className="enemy-tooltip__stat-value">{definition.armor}</span>
              </span>
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">⭐</span>
                <span className="enemy-tooltip__stat-value">{definition.fame}</span>
              </span>
            </div>

            {definition.abilities.length > 0 && (
              <div className="enemy-tooltip__abilities">
                {definition.abilities.map((ability) => {
                  const display = ABILITY_DISPLAY[ability];
                  return (
                    <span key={ability} className="enemy-tooltip__ability">
                      {display?.icon || "•"} {display?.name || ability}
                    </span>
                  );
                })}
              </div>
            )}

            {hasResistances && (
              <div className="enemy-tooltip__resistances">
                <span className="enemy-tooltip__resistance-label">Resists:</span>
                {definition.resistances.physical && (
                  <span className="enemy-tooltip__resistance">Physical</span>
                )}
                {definition.resistances.fire && (
                  <span className="enemy-tooltip__resistance enemy-tooltip__resistance--fire">
                    Fire
                  </span>
                )}
                {definition.resistances.ice && (
                  <span className="enemy-tooltip__resistance enemy-tooltip__resistance--ice">
                    Ice
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {unrevealedCount > 0 && (
        <div className="enemy-tooltip__unrevealed" style={getLineStyle()}>
          {unrevealedCount} unrevealed {unrevealedCount === 1 ? "enemy" : "enemies"}
        </div>
      )}
    </div>
  );
}
