/**
 * SitePanel - Detailed site information panel
 *
 * Shows comprehensive site info in a slide-in panel on the right side.
 * Used for:
 * - Scouting: Click into tooltip to see full details
 * - Arrival: Auto-opens when landing on an interactive site
 */

import { useEffect, useState } from "react";
import type { SiteOptions, TimeOfDay, ClientHexEnemy, EnemyAbilityType, UnitId } from "@mage-knight/shared";
import type { ClientHexState, ClientSite, RecruitSite } from "@mage-knight/shared";
import {
  TIME_OF_DAY_NIGHT,
  ENEMIES,
  ABILITY_DESCRIPTIONS,
  RESISTANCE_DESCRIPTIONS,
  ATTACK_ELEMENT_DESCRIPTIONS,
  getSitePanelInfo,
  UNITS,
  canRecruitAt,
  RECRUIT_SITE_VILLAGE,
  RECRUIT_SITE_KEEP,
  RECRUIT_SITE_MAGE_TOWER,
  RECRUIT_SITE_MONASTERY,
  RECRUIT_SITE_CITY,
  type Element,
} from "@mage-knight/shared";
import { useGame } from "../../hooks/useGame";
import { SiteIcon, GameIcon, type SiteIconType, type GameIconType } from "../Icons";
import "./SitePanel.css";

// =============================================================================
// Unit Recruitment Helpers
// =============================================================================

/**
 * Map site type string to RecruitSite constant
 */
function getRecruitSiteFromType(siteType: string): RecruitSite | null {
  switch (siteType) {
    case "village": return RECRUIT_SITE_VILLAGE;
    case "keep": return RECRUIT_SITE_KEEP;
    case "mage_tower": return RECRUIT_SITE_MAGE_TOWER;
    case "monastery": return RECRUIT_SITE_MONASTERY;
    case "city": return RECRUIT_SITE_CITY;
    default: return null;
  }
}

/**
 * Get units from the offer that can be recruited at the given site
 */
function getUnitsRecruitableAtSite(
  unitOffer: readonly UnitId[],
  recruitSite: RecruitSite
): Array<{ id: UnitId; name: string }> {
  return unitOffer
    .map((unitId) => UNITS[unitId])
    .filter((unit) => unit && canRecruitAt(unit, recruitSite))
    .map((unit) => ({ id: unit.id, name: unit.name }));
}

// =============================================================================
// Enemy Details Component
// =============================================================================

// Token back images by color
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
  const parts = tokenId.split("_");
  parts.pop();
  return parts.join("_");
}

interface EnemyDetailsProps {
  enemies: readonly ClientHexEnemy[];
}

/** Collect unique abilities, resistances, and attack elements from all enemies for the reference section */
function collectUniqueTraits(enemies: readonly ClientHexEnemy[]): {
  abilities: Set<string>;
  resistances: Set<string>;
  attackElements: Set<string>;
} {
  const abilities = new Set<string>();
  const resistances = new Set<string>();
  const attackElements = new Set<string>();

  for (const enemy of enemies) {
    if (!enemy.isRevealed || !enemy.tokenId) continue;
    const enemyId = getEnemyIdFromToken(enemy.tokenId);
    const definition = ENEMIES[enemyId as keyof typeof ENEMIES];
    if (!definition) continue;

    for (const ability of definition.abilities) {
      abilities.add(ability);
    }
    for (const resistance of definition.resistances) {
      resistances.add(resistance);
    }
    // Track non-physical attack elements for reference section
    if (definition.attackElement && definition.attackElement !== "physical") {
      attackElements.add(definition.attackElement);
    }
  }

  return { abilities, resistances, attackElements };
}

function EnemyDetails({ enemies }: EnemyDetailsProps) {
  const revealedEnemies = enemies.filter((e) => e.isRevealed && e.tokenId);
  const unrevealedCount = enemies.filter((e) => !e.isRevealed).length;

  if (revealedEnemies.length === 0 && unrevealedCount === 0) {
    return null;
  }

  // Collect unique traits for reference section
  const { abilities: uniqueAbilities, resistances: uniqueResistances, attackElements: uniqueAttackElements } = collectUniqueTraits(enemies);

  return (
    <div className="site-panel__enemies">
      {revealedEnemies.map((enemy, idx) => {
        if (!enemy.tokenId) return null;
        const enemyId = getEnemyIdFromToken(enemy.tokenId);
        const definition = ENEMIES[enemyId as keyof typeof ENEMIES];

        if (!definition) {
          const tokenBackPath = TOKEN_BACK_PATHS[enemy.color];
          return (
            <div key={idx} className="site-panel__enemy">
              <div className="site-panel__enemy-header">
                {tokenBackPath && (
                  <img src={tokenBackPath} alt={enemy.color} className="site-panel__enemy-token" />
                )}
                <span className="site-panel__enemy-name">Unknown Enemy</span>
              </div>
            </div>
          );
        }

        const tokenBackPath = TOKEN_BACK_PATHS[definition.color];
        const hasResistances = definition.resistances.length > 0;
        const hasSummon = definition.abilities.includes("summon");

        return (
          <div key={idx} className="site-panel__enemy">
            <div className="site-panel__enemy-header">
              {tokenBackPath && (
                <img src={tokenBackPath} alt={definition.color} className="site-panel__enemy-token" />
              )}
              <span className="site-panel__enemy-name">{definition.name}</span>
            </div>

            <div className="site-panel__enemy-stats">
              <span className="site-panel__enemy-stat">
                <GameIcon type={definition.attackElement === "physical" ? "attack" : definition.attackElement as GameIconType} size={18} />
                <span>{hasSummon ? "?" : definition.attack}</span>
              </span>
              <span className="site-panel__enemy-stat">
                <GameIcon type="armor" size={18} />
                <span>{definition.armor}</span>
              </span>
              <span className="site-panel__enemy-stat">
                <GameIcon type="fame" size={18} />
                <span>{definition.fame}</span>
              </span>
            </div>

            {/* Show ability names inline (short) */}
            {definition.abilities.length > 0 && (
              <div className="site-panel__enemy-traits">
                {definition.abilities.map((ability) => {
                  const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
                  const iconType = desc?.icon as GameIconType | undefined;
                  return (
                    <span key={ability} className="site-panel__enemy-trait">
                      {iconType && <GameIcon type={iconType} size={16} />}
                      {desc?.name || ability}
                    </span>
                  );
                })}
              </div>
            )}

            {/* Show resistance names inline (short) */}
            {hasResistances && (
              <div className="site-panel__enemy-resistances">
                <span className="site-panel__enemy-resist-label">Resists:</span>
                {definition.resistances.includes("physical") && (
                  <span className="site-panel__enemy-resist">
                    <GameIcon type="physical_resist" size={14} /> Physical
                  </span>
                )}
                {definition.resistances.includes("fire") && (
                  <span className="site-panel__enemy-resist site-panel__enemy-resist--fire">
                    <GameIcon type="fire_resist" size={14} /> Fire
                  </span>
                )}
                {definition.resistances.includes("ice") && (
                  <span className="site-panel__enemy-resist site-panel__enemy-resist--ice">
                    <GameIcon type="ice_resist" size={14} /> Ice
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

      {unrevealedCount > 0 && (
        <div className="site-panel__enemy-unrevealed">
          {unrevealedCount} unrevealed {unrevealedCount === 1 ? "enemy" : "enemies"}
        </div>
      )}

      {/* Reference section: full descriptions for all unique abilities, resistances, and attack elements */}
      {(uniqueAbilities.size > 0 || uniqueResistances.size > 0 || uniqueAttackElements.size > 0) && (
        <div className="site-panel__traits-reference">
          <div className="site-panel__traits-reference-title">Ability & Resistance Reference</div>

          {Array.from(uniqueAbilities).map((ability) => {
            const desc = ABILITY_DESCRIPTIONS[ability as EnemyAbilityType];
            if (!desc) return null;
            const iconType = desc.icon as GameIconType;
            return (
              <div key={ability} className="site-panel__trait-entry">
                <span className="site-panel__trait-entry-header">
                  <GameIcon type={iconType} size={18} /> {desc.name}
                </span>
                <span className="site-panel__trait-entry-desc">{desc.fullDesc}</span>
              </div>
            );
          })}

          {Array.from(uniqueResistances).map((resist) => {
            const desc = RESISTANCE_DESCRIPTIONS[resist as keyof typeof RESISTANCE_DESCRIPTIONS];
            if (!desc) return null;
            const iconType = `${resist}_resist` as GameIconType;
            return (
              <div key={resist} className="site-panel__trait-entry">
                <span className="site-panel__trait-entry-header site-panel__trait-entry-header--resist">
                  <GameIcon type={iconType} size={18} /> {desc.name}
                </span>
                <span className="site-panel__trait-entry-desc">{desc.fullDesc}</span>
              </div>
            );
          })}

          {Array.from(uniqueAttackElements).map((element) => {
            const desc = ATTACK_ELEMENT_DESCRIPTIONS[element as Element];
            if (!desc) return null;
            const iconType = desc.icon as GameIconType;
            return (
              <div key={element} className="site-panel__trait-entry">
                <span className="site-panel__trait-entry-header site-panel__trait-entry-header--element">
                  <GameIcon type={iconType} size={18} /> {desc.name}
                </span>
                <span className="site-panel__trait-entry-desc">{desc.fullDesc}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Fortification Summary Component
// =============================================================================

interface FortificationInfo {
  siteIsFortified: boolean;
  hasDoubleFortifiedEnemy: boolean; // Enemy with fortified ability at a fortified site
  hasFortifiedEnemy: boolean; // Enemy with fortified ability (anywhere)
  summary: string;
  details: string[];
}

function computeFortificationInfo(
  siteType: string,
  enemies: readonly ClientHexEnemy[] | undefined,
  isConquered: boolean
): FortificationInfo | null {
  // Fortified sites: keep, mage_tower, city (when not conquered)
  const fortifiedSiteTypes = ["keep", "mage_tower", "city"];
  const siteIsFortified = fortifiedSiteTypes.includes(siteType) && !isConquered;

  // Check if any revealed enemy has the fortified ability
  let hasFortifiedEnemy = false;
  if (enemies) {
    for (const enemy of enemies) {
      if (enemy.isRevealed && enemy.tokenId) {
        const enemyId = getEnemyIdFromToken(enemy.tokenId);
        const definition = ENEMIES[enemyId as keyof typeof ENEMIES];
        if (definition?.abilities.includes("fortified")) {
          hasFortifiedEnemy = true;
          break;
        }
      }
    }
  }

  // If neither site nor enemy is fortified, no special info needed
  if (!siteIsFortified && !hasFortifiedEnemy) {
    return null;
  }

  const hasDoubleFortifiedEnemy = siteIsFortified && hasFortifiedEnemy;
  const details: string[] = [];
  let summary: string;

  if (hasDoubleFortifiedEnemy) {
    summary = "Double Fortified";
    details.push("Site is fortified: Ranged attacks require Siege");
    details.push("Enemy is also fortified: Cannot be targeted in Ranged phase at all");
    details.push("You must defeat this enemy in Block/Attack phase only");
  } else if (siteIsFortified) {
    summary = "Fortified Site";
    details.push("Only Siege attacks can target enemies in Ranged phase");
    details.push("Regular Ranged attacks have no effect");
  } else {
    // hasFortifiedEnemy only (at non-fortified site)
    summary = "Fortified Enemy";
    details.push("Only Siege attacks can target this enemy in Ranged phase");
    details.push("At a non-fortified site, Siege attacks still work");
  }

  return {
    siteIsFortified,
    hasDoubleFortifiedEnemy,
    hasFortifiedEnemy,
    summary,
    details,
  };
}

interface FortificationSummaryProps {
  info: FortificationInfo;
}

function FortificationSummary({ info }: FortificationSummaryProps) {
  const alertClass = info.hasDoubleFortifiedEnemy
    ? "site-panel__fortification--double"
    : "site-panel__fortification--single";

  return (
    <div className={`site-panel__fortification ${alertClass}`}>
      <div className="site-panel__fortification-header">
        <GameIcon type="fortified" size={24} />
        <span className="site-panel__fortification-title">{info.summary}</span>
      </div>
      <ul className="site-panel__fortification-details">
        {info.details.map((detail, idx) => (
          <li key={idx}>{detail}</li>
        ))}
      </ul>
    </div>
  );
}

// =============================================================================
// Site Info Computation (for scouting mode when siteOptions is unavailable)
// =============================================================================

interface ComputedSiteInfo {
  /** What you'll fight */
  fight?: string;
  /** Conquest reward */
  reward?: string;
  /** Special rules/restrictions */
  special?: string[];
  /** Services available (for inhabited sites) */
  services?: string[];
  /** Is this site fortified? */
  isFortified?: boolean;
  /** Optional deep-dive sections */
  sections?: { title: string; body: string[] }[];
}

/**
 * Compute site info client-side when siteOptions isn't available (scouting mode).
 * This mirrors the logic in SiteTooltipContent but structured for the panel.
 */
function computeSiteInfo(
  site: ClientSite,
  enemies?: readonly ClientHexEnemy[],
  timeOfDay?: TimeOfDay
): ComputedSiteInfo {
  const isNight = timeOfDay === TIME_OF_DAY_NIGHT;
  const hasUnrevealedEnemies = enemies?.some(e => !e.isRevealed) ?? false;
  const enemyRevealNote = hasUnrevealedEnemies && isNight ? " (revealed on assault)" : "";
  const sharedInfo = getSitePanelInfo({
    siteType: site.type,
    isConquered: site.isConquered,
    timeOfDay,
    hasUnrevealedEnemies,
    mineColor: site.mineColor as "white" | "green" | "red" | "blue" | undefined,
  });
  if (sharedInfo) {
    return sharedInfo;
  }

  switch (site.type) {
    case "dungeon":
      return {
        fight: `1 Brown enemy${enemyRevealNote}`,
        reward: site.isConquered ? "Fame only" : "Spell (gold/black die) or Artifact (color die)",
        special: ["Night mana rules (no gold, black available)", "No units allowed"],
      };

    case "tomb":
      return {
        fight: `1 Red Draconum${enemyRevealNote}`,
        reward: site.isConquered ? "Fame only" : "1 Spell + 1 Artifact",
        special: ["Night mana rules (no gold, black available)", "No units allowed"],
      };

    case "monster_den":
      return {
        fight: `1 Brown enemy${enemyRevealNote}`,
        reward: "2 Crystal rolls",
        special: ["Undefeated enemy remains"],
      };

    case "spawning_grounds":
      return {
        fight: `2 Brown enemies${enemyRevealNote}`,
        reward: "1 Artifact + 3 Crystal rolls",
        special: ["Undefeated enemies remain"],
      };

    case "ancient_ruins":
      return {
        fight: "Draw yellow token: Altar or Enemies",
        reward: "Varies by token",
        special: ["Altar: Pay 3 mana for 7 Fame"],
      };

    case "monastery":
      return {
        services: ["Buy Advanced Action: 6 Influence", "Heal: 2 Influence = 1 HP"],
        special: ["Burn: Fight violet enemy, no units, −3 Reputation"],
      };

    case "keep":
      if (site.isConquered) {
        return {
          services: ["Recruit units"],
          special: ["+1 Hand limit when ending turn here"],
        };
      }
      return {
        fight: `1 Grey enemy${enemyRevealNote}`,
        isFortified: true,
        special: ["Assault: −1 Reputation"],
      };

    case "mage_tower":
      if (site.isConquered) {
        return {
          services: ["Buy Spells: 7 Influence + mana matching spell color"],
        };
      }
      return {
        fight: `1 Violet enemy${enemyRevealNote}`,
        reward: "1 Spell",
        isFortified: true,
        special: ["Assault: −1 Reputation"],
      };

    case "city": {
      if (site.isConquered) {
        return {
          services: ["Full city services available"],
        };
      }
      return {
        fight: `City garrison${enemyRevealNote}`,
        isFortified: true,
        special: ["Assault: −1 Reputation"],
      };
    }

    case "mine": {
      const color = site.mineColor || "white";
      return {
        services: [`End turn here: Gain 1 ${color} crystal`],
      };
    }

    case "deep_mine":
      return {
        services: ["End turn here: Gain 1 crystal (choose color)"],
      };

    case "magical_glade":
      return {
        services: [
          "Start of turn: Gain gold mana (day) or black mana (night)",
          "End of turn: Discard 1 Wound from hand",
        ],
      };

    case "maze":
      return {
        fight: `1 Brown enemy${enemyRevealNote}`,
        reward: "Varies by path (2/4/6 Move cost)",
        special: ["One unit allowed", "Enemy discarded after combat"],
      };

    case "labyrinth":
      return {
        fight: `1 Red Draconum${enemyRevealNote}`,
        reward: "Varies by path + Advanced Action",
        special: ["One unit allowed", "Enemy discarded after combat"],
      };

    default:
      return {};
  }
}

export interface SitePanelProps {
  /** Whether the panel is open */
  isOpen: boolean;
  /** The site options data */
  siteOptions: SiteOptions | null;
  /** The hex state (for enemy info) */
  hex: ClientHexState | null;
  /** Callback when panel is closed */
  onClose: () => void;
  /** Whether this is arrival mode (shows action buttons) vs scouting mode */
  isArrivalMode?: boolean;
  /** Current time of day (for enemy reveal info) */
  timeOfDay?: TimeOfDay;
  /** Callback to navigate to unit offer panel */
  onNavigateToUnitOffer?: () => void;
}

// Helper to format site name from type when siteOptions not available
function formatSiteName(siteType: string, site?: { cityColor?: string; mineColor?: string } | null): string {
  // Handle special cases with colors
  if (siteType === "city" && site?.cityColor) {
    return `${capitalize(site.cityColor)} City`;
  }
  if (siteType === "mine" && site?.mineColor) {
    return `${capitalize(site.mineColor)} Mine`;
  }
  // Default: convert snake_case to Title Case
  return siteType
    .split("_")
    .map(capitalize)
    .join(" ");
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Map site type string to SiteIconType for sprite rendering
// Cities use color-specific sprites
function getSiteIconType(siteType: string, cityColor?: string): SiteIconType | null {
  switch (siteType) {
    case "dungeon": return "dungeon";
    case "tomb": return "tomb";
    case "monster_den": return "monster_den";
    case "spawning_grounds": return "spawning_grounds";
    case "ancient_ruins": return "ancient_ruins";
    case "village": return "village";
    case "monastery": return "monastery";
    case "keep": return "keep";
    case "mage_tower": return "mage_tower";
    case "mine": return "mine";
    case "magical_glade": return "magical_glade";
    case "deep_mine": return "mine"; // Use mine sprite
    case "maze": return "maze";
    case "labyrinth": return "labyrinth";
    case "city":
      // Return color-specific city sprite
      if (cityColor === "blue") return "blue_city";
      if (cityColor === "green") return "green_city";
      if (cityColor === "red") return "red_city";
      if (cityColor === "white") return "white_city";
      return "blue_city"; // Default fallback
    default:
      return null;
  }
}

export function SitePanel({
  isOpen,
  siteOptions,
  hex,
  onClose,
  isArrivalMode = false,
  timeOfDay,
  onNavigateToUnitOffer,
}: SitePanelProps) {
  // Track animation state
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  // Get game state for unit offer
  const { state } = useGame();

  // Handle open/close animation
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true);
        });
      });
    } else {
      setIsAnimating(false);
      // Wait for animation to finish before unmounting
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 300); // Match CSS transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle escape key to close panel
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Can render with either siteOptions (detailed) or hex.site (basic)
  const site = hex?.site;
  if (!shouldRender || (!siteOptions && !site)) {
    return null;
  }

  // Use siteOptions if available, otherwise fall back to basic site info
  const siteType = siteOptions?.siteType ?? site?.type ?? "unknown";
  const siteName = siteOptions?.siteName ?? formatSiteName(siteType, site);
  const isConquered = siteOptions?.isConquered ?? site?.isConquered ?? false;
  const siteIconType = getSiteIconType(siteType, site?.cityColor);

  // Compute site info for scouting mode (when siteOptions is unavailable)
  const computedInfo = site && !siteOptions
    ? computeSiteInfo(site, hex?.enemies, timeOfDay)
    : null;
  const sharedPanelInfo = site
    ? getSitePanelInfo({
      siteType: site.type,
      isConquered: site.isConquered,
      timeOfDay,
      hasUnrevealedEnemies: hex?.enemies?.some(e => !e.isRevealed) ?? false,
      mineColor: site.mineColor as "white" | "green" | "red" | "blue" | undefined,
    })
    : null;
  const panelSections = computedInfo?.sections ?? sharedPanelInfo?.sections ?? null;
  const shouldShowSpecial = !panelSections || panelSections.length === 0;

  // Compute fortification info (both modes)
  const fortificationInfo = computeFortificationInfo(siteType, hex?.enemies, isConquered);

  // Compute recruitable units from the current offer
  const recruitSite = getRecruitSiteFromType(siteType);
  const recruitableUnits = recruitSite && state?.offers.units
    ? getUnitsRecruitableAtSite(state.offers.units, recruitSite)
    : null;

  return (
    <div className={`site-panel ${isAnimating ? "site-panel--open" : ""}`}>
      {/* Header */}
      <div className="site-panel__header">
        <div className="site-panel__title">
          {siteIconType ? (
            <SiteIcon site={siteIconType} size={32} className="site-panel__icon" />
          ) : (
            <span className="site-panel__icon">📍</span>
          )}
          <span className="site-panel__name">{siteName}</span>
          {isConquered && (
            <span className="site-panel__status">Conquered</span>
          )}
        </div>
        <button
          className="site-panel__close"
          onClick={onClose}
          aria-label="Close panel"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="site-panel__content">
        {/* Site Artwork */}
        <div className="site-panel__artwork">
          {siteIconType ? (
            <SiteIcon site={siteIconType} size={160} className="site-panel__artwork-sprite" />
          ) : (
            <div className="site-panel__artwork-placeholder">
              <span className="site-panel__artwork-icon">📍</span>
              <span className="site-panel__artwork-text">Site Artwork</span>
            </div>
          )}
        </div>

        {/* Fortification Summary - shown prominently when applicable */}
        {fortificationInfo && (
          <FortificationSummary info={fortificationInfo} />
        )}

        {/* === SCOUTING MODE: Show computed info when siteOptions unavailable === */}
        {computedInfo && (
          <>
            {/* Combat/Fight Section */}
            {computedInfo.fight && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="combat" size={20} className="site-panel__section-icon" />
                  Combat
                </h3>
                <div className="site-panel__section-content">
                  <p className="site-panel__description">{computedInfo.fight}</p>
                  {hex?.enemies && hex.enemies.length > 0 && (
                    <EnemyDetails enemies={hex.enemies} />
                  )}
                </div>
              </section>
            )}

            {/* Reward Section */}
            {computedInfo.reward && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="fame" size={20} className="site-panel__section-icon" />
                  Reward
                </h3>
                <div className="site-panel__section-content">
                  <p className="site-panel__description">{computedInfo.reward}</p>
                </div>
              </section>
            )}

            {/* Services Section */}
            {computedInfo.services && computedInfo.services.length > 0 && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="influence" size={20} className="site-panel__section-icon" />
                  Services
                </h3>
                <div className="site-panel__section-content">
                  {computedInfo.services.map((service, i) => {
                    // Check if this is the "Recruit units" service
                    const isRecruitService = service.toLowerCase().includes("recruit");
                    if (isRecruitService && recruitableUnits) {
                      return (
                        <div
                          key={i}
                          className={`site-panel__service ${onNavigateToUnitOffer ? "site-panel__service--clickable" : ""}`}
                          onClick={onNavigateToUnitOffer}
                        >
                          <GameIcon type="block" size={20} className="site-panel__service-icon" />
                          <div className="site-panel__service-text">
                            <strong>Recruit Units</strong>
                            {recruitableUnits.length > 0 ? (
                              <>
                                <span>{recruitableUnits.length} unit{recruitableUnits.length !== 1 ? "s" : ""} available</span>
                                <ul className="site-panel__unit-list">
                                  {recruitableUnits.map((unit) => (
                                    <li key={unit.id}>{unit.name}</li>
                                  ))}
                                </ul>
                                {onNavigateToUnitOffer && (
                                  <span className="site-panel__view-offer-link">View in Offer</span>
                                )}
                              </>
                            ) : (
                              <span className="site-panel__no-units">No matching units in current offer</span>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return <p key={i} className="site-panel__description">{service}</p>;
                  })}
                </div>
              </section>
            )}

            {/* Special Rules Section */}
            {shouldShowSpecial && computedInfo.special && computedInfo.special.length > 0 && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="fortified" size={20} className="site-panel__section-icon" />
                  Rules
                </h3>
                <div className="site-panel__section-content">
                  {computedInfo.special.map((rule, i) => (
                    <p key={i} className="site-panel__description">{rule}</p>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* === ARRIVAL MODE: Show siteOptions when available === */}
        {siteOptions && (
          <>
            {/* Combat Section (for adventure sites) */}
            {siteOptions.canEnter && siteOptions.enterDescription && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="combat" size={20} className="site-panel__section-icon" />
                  Combat
                </h3>
                <div className="site-panel__section-content">
                  <p className="site-panel__description">
                    {siteOptions.enterDescription}
                  </p>
                  {hex?.enemies && hex.enemies.length > 0 && (
                    <EnemyDetails enemies={hex.enemies} />
                  )}
                </div>
              </section>
            )}

            {/* Restrictions Section */}
            {siteOptions.enterRestrictions && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="fortified" size={20} className="site-panel__section-icon" />
                  Restrictions
                </h3>
                <div className="site-panel__section-content">
                  {siteOptions.enterRestrictions.nightManaRules && (
                    <div className="site-panel__restriction">
                      <GameIcon type="spell" size={24} className="site-panel__restriction-icon" />
                      <div className="site-panel__restriction-text">
                        <strong>Night Rules</strong>
                        <span>No gold mana, black mana available</span>
                      </div>
                    </div>
                  )}
                  {siteOptions.enterRestrictions.unitsAllowed === false && (
                    <div className="site-panel__restriction">
                      <GameIcon type="block" size={24} className="site-panel__restriction-icon" />
                      <div className="site-panel__restriction-text">
                        <strong>No Units</strong>
                        <span>You must fight alone</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Rewards Section */}
            {siteOptions.conquestReward && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="fame" size={20} className="site-panel__section-icon" />
                  Reward
                </h3>
                <div className="site-panel__section-content">
                  <p className="site-panel__description">
                    {siteOptions.conquestReward}
                  </p>
                </div>
              </section>
            )}

            {/* Services Section (for inhabited sites) */}
            {siteOptions.canInteract && siteOptions.interactOptions && (
              <section className="site-panel__section">
                <h3 className="site-panel__section-title">
                  <GameIcon type="influence" size={20} className="site-panel__section-icon" />
                  Services
                </h3>
                <div className="site-panel__section-content">
                  {siteOptions.interactOptions.canHeal && (
                    <div className="site-panel__service">
                      <GameIcon type="heal" size={20} className="site-panel__service-icon" />
                      <div className="site-panel__service-text">
                        <strong>Healing</strong>
                        <span>
                          {siteOptions.interactOptions.healCost} Influence = 1 HP
                        </span>
                      </div>
                    </div>
                  )}
                  {siteOptions.interactOptions.canRecruit && (
                    <div
                      className={`site-panel__service ${onNavigateToUnitOffer ? "site-panel__service--clickable" : ""}`}
                      onClick={onNavigateToUnitOffer}
                    >
                      <GameIcon type="block" size={20} className="site-panel__service-icon" />
                      <div className="site-panel__service-text">
                        <strong>Recruit Units</strong>
                        {recruitableUnits && recruitableUnits.length > 0 ? (
                          <>
                            <span>{recruitableUnits.length} unit{recruitableUnits.length !== 1 ? "s" : ""} available</span>
                            <ul className="site-panel__unit-list">
                              {recruitableUnits.map((unit) => (
                                <li key={unit.id}>{unit.name}</li>
                              ))}
                            </ul>
                            {onNavigateToUnitOffer && (
                              <span className="site-panel__view-offer-link">View in Offer</span>
                            )}
                          </>
                        ) : recruitableUnits ? (
                          <span className="site-panel__no-units">No matching units in current offer</span>
                        ) : (
                          <span>Units available for hire</span>
                        )}
                      </div>
                    </div>
                  )}
                  {siteOptions.interactOptions.canBuySpells && (
                    <div className="site-panel__service">
                      <GameIcon type="spell" size={20} className="site-panel__service-icon" />
                      <div className="site-panel__service-text">
                        <strong>Buy Spells</strong>
                        <span>{siteOptions.interactOptions.spellCost ?? 7} Influence + matching mana</span>
                      </div>
                    </div>
                  )}
                  {siteOptions.interactOptions.canBuyAdvancedActions && (
                    <div className="site-panel__service">
                      <GameIcon type="attack" size={20} className="site-panel__service-icon" />
                      <div className="site-panel__service-text">
                        <strong>Buy Advanced Action</strong>
                        <span>{siteOptions.interactOptions.advancedActionCost ?? 6} Influence</span>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </>
        )}

        {/* Passive Effects Section */}
        {(siteOptions?.endOfTurnEffect || siteOptions?.startOfTurnEffect) && (
          <section className="site-panel__section">
            <h3 className="site-panel__section-title">
              <GameIcon type="spell" size={20} className="site-panel__section-icon" />
              Effects
            </h3>
            <div className="site-panel__section-content">
              {siteOptions.startOfTurnEffect && (
                <div className="site-panel__effect">
                  <span className="site-panel__effect-timing">Start of turn:</span>
                  <span>{siteOptions.startOfTurnEffect}</span>
                </div>
              )}
              {siteOptions.endOfTurnEffect && (
                <div className="site-panel__effect">
                  <span className="site-panel__effect-timing">End of turn:</span>
                  <span>{siteOptions.endOfTurnEffect}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Deep-dive Sections (shared rules detail) */}
        {panelSections && panelSections.map((section, idx) => (
          <section key={idx} className="site-panel__section">
            <h3 className="site-panel__section-title">
              {section.title}
            </h3>
            <div className="site-panel__section-content">
              {section.body.map((line, lineIdx) => (
                <p key={lineIdx} className="site-panel__description">{line}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Footer with mode indicator (placeholder for action buttons) */}
      <div className="site-panel__footer">
        {isArrivalMode ? (
          <div className="site-panel__mode-indicator">
            Use radial menu to select action
          </div>
        ) : (
          <div className="site-panel__mode-indicator">
            Scouting mode - move here to interact
          </div>
        )}
      </div>
    </div>
  );
}
