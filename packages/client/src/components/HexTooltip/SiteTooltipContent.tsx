/**
 * SiteTooltipContent - Shows site information in the hex tooltip
 *
 * Displays:
 * - Site name and icon
 * - What you'll fight (enemy type/count)
 * - What you'll get (rewards)
 * - Special rules (night mana, no units, etc.)
 */

import type { ClientSite } from "@mage-knight/shared";

// Site type constants (matching core SiteType enum values)
const SITE_DUNGEON = "dungeon";
const SITE_TOMB = "tomb";
const SITE_MONSTER_DEN = "monster_den";
const SITE_SPAWNING_GROUNDS = "spawning_grounds";
const SITE_ANCIENT_RUINS = "ancient_ruins";
const SITE_VILLAGE = "village";
const SITE_MONASTERY = "monastery";
const SITE_KEEP = "keep";
const SITE_MAGE_TOWER = "mage_tower";
const SITE_CITY = "city";
const SITE_MINE = "mine";
const SITE_MAGICAL_GLADE = "magical_glade";
const SITE_DEEP_MINE = "deep_mine";
const SITE_MAZE = "maze";
const SITE_LABYRINTH = "labyrinth";

export interface SiteTooltipContentProps {
  site: ClientSite;
  isAnimating: boolean;
}

interface SiteInfo {
  name: string;
  icon: string;
  fight?: string;
  reward?: string;
  special?: string[];
  interaction?: string;
}

function getSiteInfo(site: ClientSite): SiteInfo {
  switch (site.type) {
    case SITE_DUNGEON:
      return {
        name: "Dungeon",
        icon: "🏚️",
        fight: "1 Brown Enemy",
        reward: site.isConquered ? "Fame only" : "Spell or Artifact (die roll)",
        special: ["Night mana rules", "No units allowed"],
      };

    case SITE_TOMB:
      return {
        name: "Tomb",
        icon: "🪦",
        fight: "1 Red Draconum",
        reward: site.isConquered ? "Fame only" : "Spell + Artifact",
        special: ["Night mana rules", "No units allowed"],
      };

    case SITE_MONSTER_DEN:
      return {
        name: "Monster Den",
        icon: "🕳️",
        fight: "1 Brown Enemy",
        reward: "2 Crystal Rolls",
      };

    case SITE_SPAWNING_GROUNDS:
      return {
        name: "Spawning Grounds",
        icon: "🥚",
        fight: "2 Brown Enemies",
        reward: "Artifact + 3 Crystal Rolls",
      };

    case SITE_ANCIENT_RUINS:
      return {
        name: "Ancient Ruins",
        icon: "🏛️",
        fight: "1 Brown Enemy (night only)",
        reward: "Yellow Token Reward",
        special: ["Day: Auto-conquest if empty"],
      };

    case SITE_VILLAGE:
      return {
        name: "Village",
        icon: "🏘️",
        interaction: "Recruit units, Heal (3 Inf = 1 HP)",
      };

    case SITE_MONASTERY:
      return {
        name: "Monastery",
        icon: "⛪",
        interaction: "Buy Advanced Action (6 Inf), Heal (2 Inf = 1 HP)",
      };

    case SITE_KEEP:
      return {
        name: "Keep",
        icon: "🏰",
        fight: site.isConquered ? undefined : "Garrison (fortified)",
        interaction: site.isConquered ? "Recruit units" : undefined,
        special: site.isConquered ? undefined : ["Fortified: Siege required"],
      };

    case SITE_MAGE_TOWER:
      return {
        name: "Mage Tower",
        icon: "🗼",
        fight: site.isConquered ? undefined : "Garrison (fortified)",
        reward: site.isConquered ? undefined : "1 Spell",
        interaction: site.isConquered ? "Buy spells (7 Inf each)" : undefined,
        special: site.isConquered ? undefined : ["Fortified: Siege required"],
      };

    case SITE_CITY:
      const cityColor = site.cityColor || "Unknown";
      return {
        name: `${cityColor} City`,
        icon: "🏙️",
        fight: site.isConquered ? undefined : "City garrison (fortified)",
        interaction: site.isConquered ? "Full city services" : undefined,
        special: site.isConquered ? undefined : ["Fortified: Siege required", "-1 Rep on assault"],
      };

    case SITE_MINE:
      const mineColor = site.mineColor || "crystal";
      return {
        name: `${mineColor.charAt(0).toUpperCase() + mineColor.slice(1)} Mine`,
        icon: "⛏️",
        interaction: `Gain 1 ${mineColor} mana (end of turn)`,
      };

    case SITE_MAGICAL_GLADE:
      return {
        name: "Magical Glade",
        icon: "✨",
        interaction: "Gain gold mana OR discard a wound",
      };

    case SITE_DEEP_MINE:
      return {
        name: "Deep Mine",
        icon: "💎",
        interaction: "Gain 1 crystal of chosen color (end of turn)",
      };

    case SITE_MAZE:
      return {
        name: "Maze",
        icon: "🌀",
        fight: "2/4/6 Green Enemies (path choice)",
        reward: "Crystals / Spell / Artifact",
        special: ["Choose your path difficulty"],
      };

    case SITE_LABYRINTH:
      return {
        name: "Labyrinth",
        icon: "🔮",
        fight: "2/4/6 Green Enemies (path choice)",
        reward: "Crystals / Spell / Artifact + AA",
        special: ["Choose your path difficulty"],
      };

    default:
      return {
        name: site.type,
        icon: "📍",
      };
  }
}

export function SiteTooltipContent({ site, isAnimating }: SiteTooltipContentProps) {
  const info = getSiteInfo(site);
  let lineIndex = 0;

  const getLineStyle = () => {
    const delay = isAnimating ? `${lineIndex++ * 0.08}s` : "0s";
    return { animationDelay: delay };
  };

  return (
    <div className="site-tooltip">
      <div className="site-tooltip__header" style={getLineStyle()}>
        <span className="site-tooltip__icon">{info.icon}</span>
        <span className="site-tooltip__name">{info.name}</span>
        {site.isConquered && (
          <span className="site-tooltip__status site-tooltip__status--conquered">
            Conquered
          </span>
        )}
      </div>

      <div className="site-tooltip__divider" />

      {info.fight && (
        <div className="site-tooltip__line" style={getLineStyle()}>
          <span className="site-tooltip__line-icon">⚔️</span>
          <span className="site-tooltip__line-text">{info.fight}</span>
        </div>
      )}

      {info.reward && (
        <div className="site-tooltip__line" style={getLineStyle()}>
          <span className="site-tooltip__line-icon">🎁</span>
          <span className="site-tooltip__line-text">{info.reward}</span>
        </div>
      )}

      {info.interaction && (
        <div className="site-tooltip__line" style={getLineStyle()}>
          <span className="site-tooltip__line-icon">💬</span>
          <span className="site-tooltip__line-text">{info.interaction}</span>
        </div>
      )}

      {info.special && info.special.map((rule, i) => (
        <div
          key={i}
          className="site-tooltip__line site-tooltip__line--special"
          style={getLineStyle()}
        >
          <span className="site-tooltip__line-icon">⚠️</span>
          <span className="site-tooltip__line-text">{rule}</span>
        </div>
      ))}
    </div>
  );
}
