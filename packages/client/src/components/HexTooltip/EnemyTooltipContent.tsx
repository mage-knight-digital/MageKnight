/**
 * EnemyTooltipContent - Shows enemy information in the hex tooltip
 *
 * Displays for each enemy:
 * - Name and color
 * - Attack value and element
 * - Armor value
 * - Fame reward
 * - Abilities (swift, poison, etc.) with short descriptions
 * - Resistances
 * - Rampaging indicator if applicable
 */

import type { ClientHexEnemy, EnemyAbilityType } from "@mage-knight/shared";
import { ENEMIES, ABILITY_DESCRIPTIONS } from "@mage-knight/shared";
import { GameIcon, type GameIconType } from "../Icons";

export interface EnemyTooltipContentProps {
  enemies: readonly ClientHexEnemy[];
  isAnimating: boolean;
  /** Whether to show "Guarded by:" header (when shown with site) */
  showHeader?: boolean;
  /** Starting index for animation delay (for chaining with other content) */
  startIndex?: number;
  /** Whether these are rampaging enemies */
  isRampaging?: boolean;
}

// Enemy token back images by color
const TOKEN_BACK_PATHS: Record<string, string> = {
  green: "/assets/enemies/backs/green.png",
  gray: "/assets/enemies/backs/grey.png",
  grey: "/assets/enemies/backs/grey.png",
  brown: "/assets/enemies/backs/brown.png",
  violet: "/assets/enemies/backs/violet.png",
  red: "/assets/enemies/backs/red.png",
  white: "/assets/enemies/backs/white.png",
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
  isRampaging = false,
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
          const tokenBackPath = TOKEN_BACK_PATHS[enemy.color];
          return (
            <div
              key={idx}
              className={`enemy-tooltip__enemy ${isRampaging ? "enemy-tooltip__enemy--rampaging" : ""}`}
              style={getLineStyle()}
            >
              <div className="enemy-tooltip__enemy-header">
                {tokenBackPath && (
                  <img
                    src={tokenBackPath}
                    alt={`${enemy.color} enemy`}
                    className="enemy-tooltip__token-back"
                  />
                )}
                <span className="enemy-tooltip__enemy-name">Unknown Enemy</span>
                {isRampaging && (
                  <span className="enemy-tooltip__rampaging-badge">Rampaging</span>
                )}
              </div>
            </div>
          );
        }

        const hasResistances = definition.resistances.length > 0;
        const tokenBackPath = TOKEN_BACK_PATHS[definition.color];
        const hasSummon = definition.abilities.includes("summon");

        return (
          <div
            key={idx}
            className={`enemy-tooltip__enemy ${isRampaging ? "enemy-tooltip__enemy--rampaging" : ""}`}
            style={getLineStyle()}
          >
            <div className="enemy-tooltip__enemy-header">
              {tokenBackPath && (
                <img
                  src={tokenBackPath}
                  alt={`${definition.color} enemy`}
                  className="enemy-tooltip__token-back"
                />
              )}
              <span className="enemy-tooltip__enemy-name">{definition.name}</span>
              {isRampaging && (
                <span className="enemy-tooltip__rampaging-badge">Rampaging</span>
              )}
            </div>

            <div className="enemy-tooltip__enemy-stats">
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">
                  <GameIcon type={definition.attackElement === "physical" ? "attack" : definition.attackElement as GameIconType} size={20} title="Attack" />
                </span>
                <span className="enemy-tooltip__stat-value">{hasSummon ? "?" : definition.attack}</span>
              </span>
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">
                  <GameIcon type="armor" size={20} title="Armor" />
                </span>
                <span className="enemy-tooltip__stat-value">{definition.armor}</span>
              </span>
              <span className="enemy-tooltip__stat">
                <span className="enemy-tooltip__stat-icon">
                  <GameIcon type="fame" size={20} title="Fame" />
                </span>
                <span className="enemy-tooltip__stat-value">{definition.fame}</span>
              </span>
            </div>

            {definition.abilities.length > 0 && (
              <div className="enemy-tooltip__abilities">
                {definition.abilities.map((ability) => {
                  const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
                  if (!desc) return null;
                  // Try to use GameIcon if the icon type exists, otherwise show fallback
                  const iconType = desc.icon as GameIconType | undefined;
                  return (
                    <span key={ability} className="enemy-tooltip__ability" title={desc.fullDesc}>
                      <span className="enemy-tooltip__ability-icon">
                        {iconType ? (
                          <GameIcon type={iconType} size={20} />
                        ) : (
                          <span>{desc.icon || "•"}</span>
                        )}
                      </span>
                      <span className="enemy-tooltip__ability-name">{desc.name}</span>
                      <span className="enemy-tooltip__ability-desc">{desc.shortDesc}</span>
                    </span>
                  );
                })}
              </div>
            )}

            {hasResistances && (
              <div className="enemy-tooltip__resistances">
                <span className="enemy-tooltip__resistance-label">Resists:</span>
                {definition.resistances.includes("physical") && (
                  <span className="enemy-tooltip__resistance">Physical</span>
                )}
                {definition.resistances.includes("fire") && (
                  <span className="enemy-tooltip__resistance enemy-tooltip__resistance--fire">
                    Fire
                  </span>
                )}
                {definition.resistances.includes("ice") && (
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
