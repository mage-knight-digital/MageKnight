/**
 * Site interaction valid actions computation.
 *
 * Computes what site-related actions are available to a player
 * based on their current position and the site's state.
 */

import type { SiteOptions, InteractOptions } from "@mage-knight/shared";
import {
  hexKey,
  TIME_OF_DAY_DAY,
  CARD_WOUND,
  getRuinsTokenDefinition,
  isAltarToken,
  isEnemyToken,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { HexState, Site } from "../../types/map.js";
import { SiteType, mineColorToBasicManaColor } from "../../types/map.js";
import {
  HEALING_COSTS,
  SPELL_PURCHASE_COST,
  MONASTERY_AA_PURCHASE_COST,
} from "../../data/siteProperties.js";
import { mustAnnounceEndOfRound } from "./helpers.js";
import {
  canInteractWithSite,
  hasCombatRestrictions,
  canEnterAdventureSite,
} from "../rules/siteInteraction.js";

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Compute site options for the player's current hex.
 * Returns undefined if player is not on a hex with a site.
 */
export function getSiteOptions(
  state: GameState,
  player: Player
): SiteOptions | undefined {
  if (!player.position) return undefined;

  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site) return undefined;

  const site = hex.site;

  // For Ancient Ruins, check what kind of token is present
  let ruinsHasAltarToken = false;
  if (site.type === SiteType.AncientRuins && hex.ruinsToken?.isRevealed) {
    const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
    if (tokenDef) {
      ruinsHasAltarToken = isAltarToken(tokenDef);
    }
  }

  // Determine if can enter (adventure sites)
  // For ruins: ENTER_SITE is only valid for enemy tokens
  const canEnter =
    !player.isResting &&
    !mustAnnounceEndOfRound(state, player) &&
    canEnterAdventureSite(site) &&
    !player.hasTakenActionThisTurn &&
    !(site.type === SiteType.AncientRuins && ruinsHasAltarToken);

  // Build enter description
  const enterDescription = canEnter
    ? getEnterDescription(site.type, site.isConquered, hex)
    : undefined;

  // Combat restrictions
  const enterRestrictions =
    canEnter && hasCombatRestrictions(site.type)
      ? { nightManaRules: true, unitsAllowed: false }
      : undefined;

  // Conquest reward
  const conquestReward = !site.isConquered
    ? getConquestRewardDescription(site.type, hex)
    : undefined;

  // Interaction options (inhabited sites)
  const canInteract =
    !player.isResting &&
    !mustAnnounceEndOfRound(state, player) &&
    !player.hasTakenActionThisTurn &&
    canInteractWithSite(site);
  const interactOptions = canInteract
    ? getInteractOptions(state, player, site)
    : undefined;

  // Passive effects
  const endOfTurnEffect = getEndOfTurnEffectDescription(site.type, site);
  const startOfTurnEffect = getStartOfTurnEffectDescription(
    site.type,
    state.timeOfDay
  );

  // Build result with required properties
  const result: SiteOptions = {
    siteType: site.type,
    siteName: getSiteName(site.type),
    isConquered: site.isConquered,
    owner: site.owner,
    canEnter,
    canInteract,
  };

  // Only add optional properties if they have values
  if (enterDescription !== undefined) {
    (result as { enterDescription?: string }).enterDescription = enterDescription;
  }
  if (enterRestrictions !== undefined) {
    (result as { enterRestrictions?: typeof enterRestrictions }).enterRestrictions = enterRestrictions;
  }
  if (conquestReward !== undefined) {
    (result as { conquestReward?: string }).conquestReward = conquestReward;
  }
  if (interactOptions !== undefined) {
    (result as { interactOptions?: typeof interactOptions }).interactOptions = interactOptions;
  }
  if (endOfTurnEffect !== undefined) {
    (result as { endOfTurnEffect?: string }).endOfTurnEffect = endOfTurnEffect;
  }
  if (startOfTurnEffect !== undefined) {
    (result as { startOfTurnEffect?: string }).startOfTurnEffect = startOfTurnEffect;
  }

  // Altar tribute info for Ancient Ruins with altar token
  if (
    ruinsHasAltarToken &&
    hex.ruinsToken?.isRevealed &&
    !site.isConquered &&
    !player.hasTakenActionThisTurn &&
    !player.isResting &&
    !mustAnnounceEndOfRound(state, player)
  ) {
    const altarTokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
    if (altarTokenDef && isAltarToken(altarTokenDef)) {
      const mutableResult = result as {
        canTribute?: boolean;
        altarManaColor?: string;
        altarManaCost?: number;
        altarFameReward?: number;
      };
      mutableResult.canTribute = true;
      mutableResult.altarManaColor = altarTokenDef.manaColor;
      mutableResult.altarManaCost = altarTokenDef.manaCost;
      mutableResult.altarFameReward = altarTokenDef.fameReward;
    }
  }

  return result;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================



/**
 * Get human-readable site name.
 */
function getSiteName(siteType: SiteType): string {
  const names: Record<SiteType, string> = {
    [SiteType.Village]: "Village",
    [SiteType.Monastery]: "Monastery",
    [SiteType.MagicalGlade]: "Magical Glade",
    [SiteType.Keep]: "Keep",
    [SiteType.MageTower]: "Mage Tower",
    [SiteType.AncientRuins]: "Ancient Ruins",
    [SiteType.Dungeon]: "Dungeon",
    [SiteType.Tomb]: "Tomb",
    [SiteType.MonsterDen]: "Monster Den",
    [SiteType.SpawningGrounds]: "Spawning Grounds",
    [SiteType.Mine]: "Crystal Mine",
    [SiteType.DeepMine]: "Deep Mine",
    [SiteType.Portal]: "Portal",
    [SiteType.City]: "City",
    [SiteType.Maze]: "Maze",
    [SiteType.Labyrinth]: "Labyrinth",
    [SiteType.RefugeeCamp]: "Refugee Camp",
    [SiteType.VolkaresCamp]: "Volkare's Camp",
  };
  return names[siteType] ?? siteType;
}

/**
 * Get description of what happens when entering a site.
 */
function getEnterDescription(
  siteType: SiteType,
  isConquered: boolean,
  hex: HexState
): string | undefined {
  switch (siteType) {
    case SiteType.Dungeon:
      return isConquered
        ? "Fight 1 brown enemy (fame only)"
        : "Fight 1 brown enemy";

    case SiteType.Tomb:
      return isConquered
        ? "Fight 1 Draconum (fame only)"
        : "Fight 1 Draconum";

    case SiteType.MonsterDen:
      if (hex.enemies.length > 0) {
        return "Fight the monster";
      }
      return "Fight 1 brown enemy";

    case SiteType.SpawningGrounds:
      if (hex.enemies.length > 0) {
        return `Fight ${hex.enemies.length} ${hex.enemies.length === 1 ? "enemy" : "enemies"}`;
      }
      return "Fight 2 brown enemies";

    case SiteType.AncientRuins: {
      // Describe enemies from token definition
      if (hex.ruinsToken?.isRevealed) {
        const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
        if (tokenDef && isEnemyToken(tokenDef)) {
          const enemyCount = tokenDef.enemies.length;
          const colorDescriptions = tokenDef.enemies.map((c) =>
            c.charAt(0).toUpperCase() + c.slice(1)
          );
          return `Fight ${enemyCount} ${enemyCount === 1 ? "enemy" : "enemies"} (${colorDescriptions.join(", ")})`;
        }
      }
      if (hex.enemies.length > 0) {
        return `Fight ${hex.enemies.length} ${hex.enemies.length === 1 ? "enemy" : "enemies"}`;
      }
      return "Explore the ruins";
    }

    case SiteType.Maze:
      return "Choose path (2/4/6 Move) and fight";

    case SiteType.Labyrinth:
      return "Choose path (2/4/6 Move) and fight Draconum";

    default:
      return undefined;
  }
}

/**
 * Get description of conquest reward.
 */
function getConquestRewardDescription(siteType: SiteType, hex?: HexState): string | undefined {
  switch (siteType) {
    case SiteType.Dungeon:
      return "Spell or Artifact (die roll)";

    case SiteType.Tomb:
      return "Spell + Artifact";

    case SiteType.MonsterDen:
      return "2 random crystals";

    case SiteType.SpawningGrounds:
      return "Artifact + 3 random crystals";

    case SiteType.MageTower:
      return "Spell";

    case SiteType.AncientRuins: {
      if (hex?.ruinsToken?.isRevealed) {
        const tokenDef = getRuinsTokenDefinition(hex.ruinsToken.tokenId);
        if (tokenDef && isEnemyToken(tokenDef)) {
          const rewardNames = tokenDef.rewards.map((r) => {
            switch (r) {
              case "artifact": return "Artifact";
              case "spell": return "Spell";
              case "advanced_action": return "Advanced Action";
              case "unit": return "Free Unit";
              case "4_crystals": return "4 Crystals (1 each)";
              default: return r;
            }
          });
          return rewardNames.join(" + ");
        }
        if (tokenDef && isAltarToken(tokenDef)) {
          return `${tokenDef.fameReward} Fame`;
        }
      }
      return "Depends on token";
    }

    case SiteType.Maze:
      return "Crystals / Spell / Artifact (by path)";

    case SiteType.Labyrinth:
      return "Crystals / Spell / Artifact + Advanced Action";

    default:
      return undefined;
  }
}

/**
 * Get interaction options for inhabited sites.
 */
function getInteractOptions(
  state: GameState,
  player: Player,
  site: Site
): InteractOptions {
  const healCost = HEALING_COSTS[site.type];
  const woundsInHand = player.hand.filter((cardId) => cardId === CARD_WOUND).length;
  const canHeal =
    healCost !== undefined &&
    !site.isBurned &&
    player.influencePoints >= healCost &&
    woundsInHand > 0;

  // Check if can recruit (needs units in offer, site not burned)
  const canRecruit = state.offers.units.length > 0 && !site.isBurned;

  // Check if can buy spells (conquered Mage Tower, not after combat)
  // Spell purchase is part of interaction — players can buy multiple things
  // during a single interaction, only combat blocks further purchases
  const canBuySpells =
    site.type === SiteType.MageTower &&
    site.isConquered &&
    !player.hasCombattedThisTurn &&
    state.offers.spells.cards.length > 0;

  // Check if can buy advanced actions (Monastery)
  const canBuyAdvancedActions =
    site.type === SiteType.Monastery &&
    !site.isBurned &&
    state.offers.advancedActions.cards.length > 0;

  // Check if can burn monastery
  const canBurnMonastery =
    site.type === SiteType.Monastery &&
    !site.isBurned &&
    !player.hasTakenActionThisTurn &&
    !player.hasCombattedThisTurn;

  // Check if can plunder village (before-turn action - must be before any action or movement)
  const canPlunderVillage =
    site.type === SiteType.Village &&
    !player.hasPlunderedThisTurn &&
    !player.hasTakenActionThisTurn &&
    !player.hasMovedThisTurn;

  const result: InteractOptions = {
    canHeal,
    canRecruit,
    canBuySpells,
    canBuyAdvancedActions,
  };

  // Only add optional properties if they have values
  if (healCost !== undefined && !site.isBurned) {
    (result as { healCost?: number }).healCost = healCost;
  }
  if (canBuySpells) {
    (result as { spellCost?: number }).spellCost = SPELL_PURCHASE_COST;
  }
  if (canBuyAdvancedActions) {
    (result as { advancedActionCost?: number }).advancedActionCost =
      MONASTERY_AA_PURCHASE_COST;
  }
  if (canBurnMonastery) {
    (result as { canBurnMonastery?: boolean }).canBurnMonastery = canBurnMonastery;
  }
  if (canPlunderVillage) {
    (result as { canPlunderVillage?: boolean }).canPlunderVillage = canPlunderVillage;
  }

  return result;
}

/**
 * Get end-of-turn passive effect description.
 */
function getEndOfTurnEffectDescription(
  siteType: SiteType,
  site: Site
): string | undefined {
  switch (siteType) {
    case SiteType.Mine: {
      if (site.mineColor) {
        const manaColor = mineColorToBasicManaColor(site.mineColor);
        const colorName = manaColor.charAt(0).toUpperCase() + manaColor.slice(1);
        return `+1 ${colorName} Crystal`;
      }
      return "+1 Crystal";
    }

    case SiteType.DeepMine:
      return "Choose crystal color";

    case SiteType.MagicalGlade:
      return "Discard 1 Wound";

    default:
      return undefined;
  }
}

/**
 * Get start-of-turn passive effect description.
 */
function getStartOfTurnEffectDescription(
  siteType: SiteType,
  timeOfDay: string
): string | undefined {
  switch (siteType) {
    case SiteType.MagicalGlade:
      return timeOfDay === TIME_OF_DAY_DAY ? "+1 Gold Mana" : "+1 Black Mana";

    default:
      return undefined;
  }
}
