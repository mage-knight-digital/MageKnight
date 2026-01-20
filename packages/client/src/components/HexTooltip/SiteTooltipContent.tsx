/**
 * SiteTooltipContent - Shows site information in the hex tooltip
 *
 * Displays:
 * - Site name and icon
 * - What you'll fight (enemy type/count)
 * - What you'll get (rewards)
 * - Special rules (night mana, no units, etc.)
 */

import type { ClientSite, ClientHexEnemy, TimeOfDay } from "@mage-knight/shared";
import { TIME_OF_DAY_NIGHT } from "@mage-knight/shared";
import { CrystalIcon, SiteIcon, GameIcon, type SiteIconType } from "../Icons";
import type { CrystalColor } from "../../utils/cardAtlas";

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
  /** Current time of day (affects reveal rules display) */
  timeOfDay?: TimeOfDay;
  /** Enemies on this hex (for showing enemy info) */
  enemies?: readonly ClientHexEnemy[];
}

interface SiteInfo {
  name: string;
  /** Site icon type for SiteIcon component, or null for fallback */
  siteIcon: SiteIconType | null;
  fight?: string | React.ReactNode;
  reward?: string | React.ReactNode;
  special?: string[];
  interaction?: string | React.ReactNode;
}

interface GetSiteInfoOptions {
  site: ClientSite;
  timeOfDay?: TimeOfDay;
  enemies?: readonly ClientHexEnemy[];
}

function getSiteInfo({ site, timeOfDay, enemies }: GetSiteInfoOptions): SiteInfo {
  const isNight = timeOfDay === TIME_OF_DAY_NIGHT;
  // Check if any enemies on this hex are unrevealed
  const hasUnrevealedEnemies = enemies?.some(e => !e.isRevealed) ?? false;

  // Helper to get city icon type based on color
  const getCityIconType = (color?: string): SiteIconType => {
    switch (color) {
      case "blue": return "blue_city";
      case "green": return "green_city";
      case "red": return "red_city";
      case "white": return "white_city";
      default: return "blue_city";
    }
  };

  switch (site.type) {
    case SITE_DUNGEON:
      return {
        name: "Dungeon",
        siteIcon: "dungeon",
        fight: "1 Brown Enemy",
        reward: site.isConquered
          ? "Fame only"
          : "Spell (gold/black) or Artifact (color)",
        special: ["Night rules", "No units"],
      };

    case SITE_TOMB:
      return {
        name: "Tomb",
        siteIcon: "tomb",
        fight: "1 Red Draconum",
        reward: site.isConquered ? "Fame only" : "Spell + Artifact",
        special: ["Night rules", "No units"],
      };

    case SITE_MONSTER_DEN:
      return {
        name: "Monster Den",
        siteIcon: "monster_den",
        fight: "1 Brown Enemy",
        reward: (
          <>
            2{" "}
            <CrystalIcon color="white" size={16} />
            <CrystalIcon color="green" size={16} />
            <CrystalIcon color="red" size={16} />
            <CrystalIcon color="blue" size={16} />
            {" "}(roll)
          </>
        ),
        special: ["Undefeated enemy stays"],
      };

    case SITE_SPAWNING_GROUNDS:
      return {
        name: "Spawning Grounds",
        siteIcon: "spawning_grounds",
        fight: "2 Brown Enemies",
        reward: (
          <>
            Artifact + 3{" "}
            <CrystalIcon color="white" size={16} />
            <CrystalIcon color="green" size={16} />
            <CrystalIcon color="red" size={16} />
            <CrystalIcon color="blue" size={16} />
          </>
        ),
        special: ["Undefeated enemies stay"],
      };

    case SITE_ANCIENT_RUINS:
      return {
        name: "Ancient Ruins",
        siteIcon: "ancient_ruins",
        fight: "Yellow token: Altar or Enemies",
        reward: "Varies by token",
        special: ["Altar: Pay 3 mana for 7 Fame"],
      };

    case SITE_VILLAGE:
      return {
        name: "Village",
        siteIcon: "village",
        interaction: "Recruit, Heal (3 Inf = 1 HP)",
        special: ["Plunder: Draw 2, -1 Rep"],
      };

    case SITE_MONASTERY:
      return {
        name: "Monastery",
        siteIcon: "monastery",
        interaction: "Buy AA (6 Inf), Heal (2 Inf = 1 HP)",
        special: ["Burn: Fight violet, no units, -3 Rep"],
      };

    case SITE_KEEP:
      if (site.isConquered) {
        return {
          name: "Keep",
          siteIcon: "keep",
          interaction: "Recruit units",
          special: ["+1 Hand limit (end turn here)"],
        };
      }
      // Unconquered keep
      return {
        name: "Keep",
        siteIcon: "keep",
        fight: hasUnrevealedEnemies
          ? isNight
            ? "1 Grey enemy (revealed on assault)"
            : "1 Grey enemy"
          : "1 Grey enemy",
        special: ["Fortified (Siege required)", "Assault: −1 Reputation"],
      };

    case SITE_MAGE_TOWER:
      if (site.isConquered) {
        return {
          name: "Mage Tower",
          siteIcon: "mage_tower",
          interaction: "Buy Spells: 7 Influence + mana matching spell",
        };
      }
      // Unconquered mage tower
      return {
        name: "Mage Tower",
        siteIcon: "mage_tower",
        fight: hasUnrevealedEnemies
          ? isNight
            ? "1 Violet enemy (revealed on assault)"
            : "1 Violet enemy"
          : "1 Violet enemy",
        reward: "1 Spell",
        special: ["Fortified (Siege required)", "Assault: −1 Reputation"],
      };

    case SITE_CITY: {
      const cityColor = site.cityColor || "blue";
      const capitalizedColor = cityColor.charAt(0).toUpperCase() + cityColor.slice(1);
      if (site.isConquered) {
        return {
          name: `${capitalizedColor} City`,
          siteIcon: getCityIconType(cityColor),
          interaction: "Full city services",
        };
      }
      // Unconquered city
      return {
        name: `${capitalizedColor} City`,
        siteIcon: getCityIconType(cityColor),
        fight: hasUnrevealedEnemies
          ? isNight
            ? "City garrison (revealed on assault)"
            : "City garrison"
          : "City garrison",
        special: ["Fortified (Siege required)", "Assault: −1 Reputation"],
      };
    }

    case SITE_MINE: {
      const mineColor = site.mineColor || "white";
      const capitalizedMineColor = mineColor.charAt(0).toUpperCase() + mineColor.slice(1);
      // Map mine color to crystal color (handle any edge cases)
      const crystalColor = (["white", "green", "red", "blue"].includes(mineColor) ? mineColor : "white") as CrystalColor;
      return {
        name: `${capitalizedMineColor} Mine`,
        siteIcon: "mine",
        interaction: (
          <>End turn: Gain <CrystalIcon color={crystalColor} size={16} /></>
        ),
      };
    }

    case SITE_MAGICAL_GLADE:
      return {
        name: "Magical Glade",
        siteIcon: "magical_glade",
        interaction: "Start: Gold/black mana. End: Discard wound",
      };

    case SITE_DEEP_MINE:
      return {
        name: "Deep Mine",
        siteIcon: "mine", // Uses mine sprite
        interaction: (
          <>
            End turn: Gain{" "}
            <CrystalIcon color="white" size={16} />
            <CrystalIcon color="green" size={16} />
            <CrystalIcon color="red" size={16} />
            <CrystalIcon color="blue" size={16} />
          </>
        ),
      };

    case SITE_MAZE:
      return {
        name: "Maze",
        siteIcon: "maze",
        fight: "1 Brown Enemy",
        reward: "Path reward (2/4/6 Move cost)",
        special: ["One unit allowed", "Enemy discarded after"],
      };

    case SITE_LABYRINTH:
      return {
        name: "Labyrinth",
        siteIcon: "labyrinth",
        fight: "1 Red Draconum",
        reward: "Path reward + AA (2/4/6 Move)",
        special: ["One unit allowed", "Enemy discarded after"],
      };

    default:
      return {
        name: site.type,
        siteIcon: null,
      };
  }
}

export function SiteTooltipContent({ site, isAnimating, startIndex = 0, timeOfDay, enemies }: SiteTooltipContentProps) {
  const info = getSiteInfo({ site, timeOfDay, enemies });
  let lineIndex = startIndex;

  const getLineStyle = () => {
    const delay = isAnimating ? `${lineIndex++ * 0.08}s` : "0s";
    return { animationDelay: delay };
  };

  return (
    <div className="site-tooltip">
      <div className="site-tooltip__header" style={getLineStyle()}>
        <span className="site-tooltip__icon">
          {info.siteIcon ? (
            <SiteIcon site={info.siteIcon} size={32} />
          ) : (
            "📍"
          )}
        </span>
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
          <span className="site-tooltip__line-icon">
            <GameIcon type="combat" size={20} />
          </span>
          <span className="site-tooltip__line-text">{info.fight}</span>
        </div>
      )}

      {info.reward && (
        <div className="site-tooltip__line" style={getLineStyle()}>
          <span className="site-tooltip__line-icon">
            <GameIcon type="fame" size={20} />
          </span>
          <span className="site-tooltip__line-text">{info.reward}</span>
        </div>
      )}

      {info.interaction && (
        <div className="site-tooltip__line" style={getLineStyle()}>
          <span className="site-tooltip__line-icon">
            <GameIcon type="influence" size={20} />
          </span>
          <span className="site-tooltip__line-text">{info.interaction}</span>
        </div>
      )}

      {info.special && info.special.map((rule, i) => (
        <div
          key={i}
          className="site-tooltip__line site-tooltip__line--special"
          style={getLineStyle()}
        >
          <span className="site-tooltip__line-icon">
            <GameIcon type="fortified" size={20} />
          </span>
          <span className="site-tooltip__line-text">{rule}</span>
        </div>
      ))}
    </div>
  );
}
