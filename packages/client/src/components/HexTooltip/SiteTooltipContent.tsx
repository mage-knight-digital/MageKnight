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
  /** Starting index for animation delay (for chaining with other content) */
  startIndex?: number;
  /** Callback to report how many lines were rendered (for chaining) */
  onLineCount?: (count: number) => void;
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
        reward: site.isConquered
          ? "Fame only"
          : "Spell (gold/black) or Artifact (color)",
        special: ["Night rules", "No units"],
      };

    case SITE_TOMB:
      return {
        name: "Tomb",
        icon: "🪦",
        fight: "1 Red Draconum",
        reward: site.isConquered ? "Fame only" : "Spell + Artifact",
        special: ["Night rules", "No units"],
      };

    case SITE_MONSTER_DEN:
      return {
        name: "Monster Den",
        icon: "🕳️",
        fight: "1 Brown Enemy",
        reward: "2 Crystals (roll for color)",
        special: ["Undefeated enemy stays"],
      };

    case SITE_SPAWNING_GROUNDS:
      return {
        name: "Spawning Grounds",
        icon: "🥚",
        fight: "2 Brown Enemies",
        reward: "Artifact + 3 Crystals",
        special: ["Undefeated enemies stay"],
      };

    case SITE_ANCIENT_RUINS:
      return {
        name: "Ancient Ruins",
        icon: "🏛️",
        fight: "Yellow token: Altar or Enemies",
        reward: "Varies by token",
        special: ["Altar: Pay 3 mana for 7 Fame"],
      };

    case SITE_VILLAGE:
      return {
        name: "Village",
        icon: "🏘️",
        interaction: "Recruit, Heal (3 Inf = 1 HP)",
        special: ["Plunder: Draw 2, -1 Rep"],
      };

    case SITE_MONASTERY:
      return {
        name: "Monastery",
        icon: "⛪",
        interaction: "Buy AA (6 Inf), Heal (2 Inf = 1 HP)",
        special: ["Burn: Fight violet, no units, -3 Rep"],
      };

    case SITE_KEEP:
      if (site.isConquered) {
        return {
          name: "Keep",
          icon: "🏰",
          interaction: "Recruit units",
          special: ["+1 Hand limit (end turn here)"],
        };
      }
      return {
        name: "Keep",
        icon: "🏰",
        fight: "1 Grey Enemy (fortified)",
        special: ["Siege required", "-1 Rep on assault"],
      };

    case SITE_MAGE_TOWER:
      if (site.isConquered) {
        return {
          name: "Mage Tower",
          icon: "🗼",
          interaction: "Buy Spells (7 Inf + matching mana)",
        };
      }
      return {
        name: "Mage Tower",
        icon: "🗼",
        fight: "1 Violet Enemy (fortified)",
        reward: "1 Spell",
        special: ["Siege required", "-1 Rep on assault"],
      };

    case SITE_CITY: {
      const cityColor = site.cityColor || "Unknown";
      const capitalizedColor = cityColor.charAt(0).toUpperCase() + cityColor.slice(1);
      if (site.isConquered) {
        return {
          name: `${capitalizedColor} City`,
          icon: "🏙️",
          interaction: "Full city services",
        };
      }
      return {
        name: `${capitalizedColor} City`,
        icon: "🏙️",
        fight: "City garrison (fortified)",
        special: ["Siege required", "-1 Rep on assault"],
      };
    }

    case SITE_MINE: {
      const mineColor = site.mineColor || "crystal";
      const capitalizedMineColor = mineColor.charAt(0).toUpperCase() + mineColor.slice(1);
      return {
        name: `${capitalizedMineColor} Mine`,
        icon: "⛏️",
        interaction: `End turn: Gain 1 ${mineColor} crystal`,
      };
    }

    case SITE_MAGICAL_GLADE:
      return {
        name: "Magical Glade",
        icon: "✨",
        interaction: "Start: Gold/black mana. End: Discard wound",
      };

    case SITE_DEEP_MINE:
      return {
        name: "Deep Mine",
        icon: "💎",
        interaction: "End turn: Gain 1 crystal (choose color)",
      };

    case SITE_MAZE:
      return {
        name: "Maze",
        icon: "🌀",
        fight: "1 Brown Enemy",
        reward: "Path reward (2/4/6 Move cost)",
        special: ["One unit allowed", "Enemy discarded after"],
      };

    case SITE_LABYRINTH:
      return {
        name: "Labyrinth",
        icon: "🔮",
        fight: "1 Red Draconum",
        reward: "Path reward + AA (2/4/6 Move)",
        special: ["One unit allowed", "Enemy discarded after"],
      };

    default:
      return {
        name: site.type,
        icon: "📍",
      };
  }
}

export function SiteTooltipContent({ site, isAnimating, startIndex = 0 }: SiteTooltipContentProps) {
  const info = getSiteInfo(site);
  let lineIndex = startIndex;

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

      <div className="site-tooltip__divider" style={getLineStyle()} />

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
