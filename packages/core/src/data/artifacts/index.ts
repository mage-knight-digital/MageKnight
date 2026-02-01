/**
 * Artifact card definitions for Mage Knight
 *
 * Artifacts are powerful cards that can be gained from conquering sites.
 * Some artifacts have a "destroyOnPowered" flag, meaning they are
 * permanently removed from the game after using their powered effect.
 *
 * Each artifact is defined in its own file to minimize merge conflicts
 * when implementing multiple artifacts in parallel.
 */

import type { DeedCard } from "../../types/cards.js";
import type { CardId } from "@mage-knight/shared";

// Banners
import { BANNER_OF_GLORY_CARDS } from "./bannerOfGlory.js";
import { BANNER_OF_FEAR_CARDS } from "./bannerOfFear.js";
import { BANNER_OF_PROTECTION_CARDS } from "./bannerOfProtection.js";
import { BANNER_OF_COURAGE_CARDS } from "./bannerOfCourage.js";
import { BANNER_OF_COMMAND_CARDS } from "./bannerOfCommand.js";
import { BANNER_OF_FORTITUDE_CARDS } from "./bannerOfFortitude.js";

// Rings
import { RUBY_RING_CARDS } from "./rubyRing.js";
import { SAPPHIRE_RING_CARDS } from "./sapphireRing.js";
import { DIAMOND_RING_CARDS } from "./diamondRing.js";
import { EMERALD_RING_CARDS } from "./emeraldRing.js";

// Weapons
import { SWORD_OF_JUSTICE_CARDS } from "./swordOfJustice.js";
import { HORN_OF_WRATH_CARDS } from "./hornOfWrath.js";
import { BOW_OF_STARSDAWN_CARDS } from "./bowOfStarsdawn.js";
import { SOUL_HARVESTER_CARDS } from "./soulHarvester.js";
import { SHIELD_OF_THE_FALLEN_KINGS_CARDS } from "./shieldOfTheFallenKings.js";

// Amulets
import { AMULET_OF_THE_SUN_CARDS } from "./amuletOfTheSun.js";
import { AMULET_OF_DARKNESS_CARDS } from "./amuletOfDarkness.js";

// Other Artifacts
import { ENDLESS_BAG_OF_GOLD_CARDS } from "./endlessBagOfGold.js";
import { ENDLESS_GEM_POUCH_CARDS } from "./endlessGemPouch.js";
import { GOLDEN_GRAIL_CARDS } from "./goldenGrail.js";
import { BOOK_OF_WISDOM_CARDS } from "./bookOfWisdom.js";
import { DRUIDIC_STAFF_CARDS } from "./druidicStaff.js";
import { CIRCLET_OF_PROFICIENCY_CARDS } from "./circletOfProficiency.js";
import { TOME_OF_ALL_SPELLS_CARDS } from "./tomeOfAllSpells.js";
import { MYSTERIOUS_BOX_CARDS } from "./mysteriousBox.js";

// === Artifact Registry ===

export const ARTIFACT_CARDS: Record<CardId, DeedCard> = {
  // Banners
  ...BANNER_OF_GLORY_CARDS,
  ...BANNER_OF_FEAR_CARDS,
  ...BANNER_OF_PROTECTION_CARDS,
  ...BANNER_OF_COURAGE_CARDS,
  ...BANNER_OF_COMMAND_CARDS,
  ...BANNER_OF_FORTITUDE_CARDS,

  // Rings
  ...RUBY_RING_CARDS,
  ...SAPPHIRE_RING_CARDS,
  ...DIAMOND_RING_CARDS,
  ...EMERALD_RING_CARDS,

  // Weapons
  ...SWORD_OF_JUSTICE_CARDS,
  ...HORN_OF_WRATH_CARDS,
  ...BOW_OF_STARSDAWN_CARDS,
  ...SOUL_HARVESTER_CARDS,
  ...SHIELD_OF_THE_FALLEN_KINGS_CARDS,

  // Amulets
  ...AMULET_OF_THE_SUN_CARDS,
  ...AMULET_OF_DARKNESS_CARDS,

  // Other Artifacts
  ...ENDLESS_BAG_OF_GOLD_CARDS,
  ...ENDLESS_GEM_POUCH_CARDS,
  ...GOLDEN_GRAIL_CARDS,
  ...BOOK_OF_WISDOM_CARDS,
  ...DRUIDIC_STAFF_CARDS,
  ...CIRCLET_OF_PROFICIENCY_CARDS,
  ...TOME_OF_ALL_SPELLS_CARDS,
  ...MYSTERIOUS_BOX_CARDS,
};

/**
 * Get an artifact card by ID
 */
export function getArtifactCard(id: CardId): DeedCard | undefined {
  return ARTIFACT_CARDS[id];
}

/**
 * Get all artifact card IDs (for deck creation)
 */
export function getAllArtifactCardIds(): CardId[] {
  return Object.keys(ARTIFACT_CARDS) as CardId[];
}
