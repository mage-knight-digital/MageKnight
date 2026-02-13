/**
 * Wound lockout rules.
 *
 * When a player's hand is all wounds and they have no "escape hatch" skills
 * (skills that draw cards), they are effectively stuck. This module provides
 * the shared rule logic used by both validators and validActions to restrict
 * actions to: slow recovery, end turn, announce end of round, undo, and skills.
 *
 * Escape hatch skills (skills that can draw cards when hand is all wounds):
 * - Motivation (all hero variants) — draw 2 cards, once per round (flip)
 * - I Feel No Pain (Tovak) — discard 1 wound + draw 1, once per turn
 * - Regenerate (Krang/Braevalar) — pay mana + discard wound, draw 1 if bonus
 *   color used or player has strictly lowest fame
 *
 * Regenerate draw condition:
 * - Braevalar: green mana OR strictly lowest fame
 * - Krang: red mana OR strictly lowest fame
 *
 * To determine if the bonus color is obtainable, we check:
 * 1. Direct mana sources (tokens, crystals, source dice)
 * 2. Polarization skill (convert opposite/black to bonus color)
 * 3. Mana-granting skills (Shamanic Ritual, Mana Overload, Crystal Crafts, etc.)
 * 4. Mana-granting units (Fire Mages, Herbalist, Altem Mages, etc.)
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type { BasicManaColor, SkillId } from "@mage-knight/shared";
import {
  CARD_WOUND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_BLACK,
  TIME_OF_DAY_DAY,
  UNIT_STATE_READY,
  UNIT_FIRE_MAGES,
  UNIT_ICE_MAGES,
  UNIT_HERBALIST,
  UNIT_ALTEM_MAGES,
} from "@mage-knight/shared";
import { isHandAllWounds } from "./turnStructure.js";
import { isSkillFaceUp } from "./skillPhasing.js";
import {
  ALL_MOTIVATION_SKILLS,
  isMotivationCooldownActive,
} from "./motivation.js";
import {
  SKILL_TOVAK_I_FEEL_NO_PAIN,
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
  SKILL_KRANG_SHAMANIC_RITUAL,
  SKILL_TOVAK_MANA_OVERLOAD,
  SKILL_GOLDYX_RED_CRYSTAL_CRAFT,
  SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT,
  SKILL_ARYTHEA_DARK_FIRE_MAGIC,
  SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS,
  SKILL_BRAEVALAR_THUNDERSTORM,
  SKILL_BRAEVALAR_LIGHTNING_STORM,
  SKILL_ARYTHEA_POLARIZATION,
} from "../../data/skills/index.js";
import {
  canActivateRegenerate,
  hasStrictlyLowestFame,
} from "../commands/skills/regenerateEffect.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Map from Regenerate skill ID to the mana color that triggers the bonus draw.
 * Braevalar → green, Krang → red.
 */
const REGENERATE_BONUS_COLOR: Partial<Record<SkillId, BasicManaColor>> = {
  [SKILL_BRAEVALAR_REGENERATE]: MANA_GREEN,
  [SKILL_KRANG_REGENERATE]: MANA_RED,
};

/**
 * All Regenerate skill IDs across heroes.
 */
const ALL_REGENERATE_SKILLS: readonly SkillId[] = [
  SKILL_BRAEVALAR_REGENERATE,
  SKILL_KRANG_REGENERATE,
];

/**
 * Opposite basic mana colors for Polarization conversion.
 * Red ↔ Blue, Green ↔ White.
 */
const OPPOSITE_BASIC: Record<BasicManaColor, BasicManaColor> = {
  [MANA_RED]: MANA_BLUE,
  [MANA_BLUE]: MANA_RED,
  [MANA_GREEN]: MANA_WHITE,
  [MANA_WHITE]: MANA_GREEN,
};

/**
 * Skills that grant mana tokens, mapped to basic colors they can produce.
 * Availability is checked via isSkillFaceUp (face-down = already used this round).
 */
const MANA_GRANTING_SKILLS: ReadonlyArray<{
  readonly skillId: SkillId;
  readonly producesColors: readonly BasicManaColor[];
}> = [
  // Shamanic Ritual: choose any color (gold/black too, but only basic matters here)
  { skillId: SKILL_KRANG_SHAMANIC_RITUAL, producesColors: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] },
  // Mana Overload: choose non-gold mana (basic + black, but only basic matters here)
  { skillId: SKILL_TOVAK_MANA_OVERLOAD, producesColors: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] },
  // Red Crystal Craft: gain red mana token + blue crystal
  { skillId: SKILL_GOLDYX_RED_CRYSTAL_CRAFT, producesColors: [MANA_RED] },
  // Green Crystal Craft: gain green mana token + blue crystal
  { skillId: SKILL_GOLDYX_GREEN_CRYSTAL_CRAFT, producesColors: [MANA_GREEN] },
  // Dark Fire Magic: gain red or black mana + red crystal (only red is basic)
  { skillId: SKILL_ARYTHEA_DARK_FIRE_MAGIC, producesColors: [MANA_RED] },
  // Whispers in the Treetops: gain green mana + white crystal
  { skillId: SKILL_NOROWAS_WHISPERS_IN_THE_TREETOPS, producesColors: [MANA_GREEN] },
  // Thunderstorm: gain (green|blue) + (green|white) = can produce green, blue, white
  { skillId: SKILL_BRAEVALAR_THUNDERSTORM, producesColors: [MANA_GREEN, MANA_BLUE, MANA_WHITE] },
  // Lightning Storm: gain (blue|green) + (blue|red) = can produce blue, green, red
  { skillId: SKILL_BRAEVALAR_LIGHTNING_STORM, producesColors: [MANA_BLUE, MANA_GREEN, MANA_RED] },
];

/**
 * Units with mana-granting abilities, mapped to the basic colors they produce.
 */
const MANA_GRANTING_UNITS: ReadonlyArray<{
  readonly unitId: string;
  readonly abilityIndex: number;
  readonly producesColors: readonly BasicManaColor[];
}> = [
  // Fire Mages: ability[2] = red mana + red crystal
  { unitId: UNIT_FIRE_MAGES, abilityIndex: 2, producesColors: [MANA_RED] },
  // Ice Mages: ability[2] = blue mana + blue crystal
  { unitId: UNIT_ICE_MAGES, abilityIndex: 2, producesColors: [MANA_BLUE] },
  // Herbalist: ability[2] = green mana
  { unitId: UNIT_HERBALIST, abilityIndex: 2, producesColors: [MANA_GREEN] },
  // Altem Mages: ability[0] = choose any 2 mana
  { unitId: UNIT_ALTEM_MAGES, abilityIndex: 0, producesColors: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE] },
];

// ============================================================================
// Direct mana source checks
// ============================================================================

/**
 * Check if the player has a direct mana source of a specific basic color.
 * Checks tokens, crystals, and available source dice.
 */
function hasDirectManaOfColor(
  state: GameState,
  player: Player,
  color: BasicManaColor
): boolean {
  // Pure mana tokens
  if (player.pureMana.some((t) => t.color === color)) return true;

  // Crystals (basic colors only)
  if (player.crystals[color] > 0) return true;

  // Source dice (not taken, not depleted)
  if (!player.usedManaFromSource) {
    for (const die of state.source.dice) {
      if (
        die.takenByPlayerId === null &&
        !die.isDepleted &&
        die.color === color
      ) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Polarization check
// ============================================================================

/**
 * Check if Polarization can convert an existing mana source to the target color.
 *
 * Polarization converts: Red↔Blue, Green↔White (always).
 * Day: Black → any basic color (cannot power spells, but fine for Regenerate).
 * Night: Gold → Black (not useful for red/green).
 *
 * Polarization sources include tokens, crystals, and source dice (including
 * depleted dice per FAQ S1, and current player's taken dice).
 */
function canPolarizeToColor(
  state: GameState,
  player: Player,
  targetColor: BasicManaColor
): boolean {
  if (!player.skills.includes(SKILL_ARYTHEA_POLARIZATION)) return false;
  if (!isSkillFaceUp(player, SKILL_ARYTHEA_POLARIZATION)) return false;
  if (
    player.skillCooldowns.usedThisTurn.includes(SKILL_ARYTHEA_POLARIZATION)
  ) {
    return false;
  }

  const oppositeColor = OPPOSITE_BASIC[targetColor];

  // Check tokens for opposite color
  if (player.pureMana.some((t) => t.color === oppositeColor)) return true;

  // Check crystals for opposite color
  if (player.crystals[oppositeColor] > 0) return true;

  // Check source dice for opposite color (including depleted, per FAQ S1)
  for (const die of state.source.dice) {
    if (
      (die.takenByPlayerId === null || die.takenByPlayerId === player.id) &&
      die.color === oppositeColor
    ) {
      return true;
    }
  }

  // Day: black sources can be converted to any basic color
  if (state.timeOfDay === TIME_OF_DAY_DAY) {
    // Black tokens
    if (player.pureMana.some((t) => t.color === MANA_BLACK)) return true;

    // Black source dice (including depleted)
    for (const die of state.source.dice) {
      if (
        (die.takenByPlayerId === null || die.takenByPlayerId === player.id) &&
        die.color === MANA_BLACK
      ) {
        return true;
      }
    }
  }

  return false;
}

// ============================================================================
// Mana-granting skill/unit checks
// ============================================================================

/**
 * Check if the player has an available mana-granting skill that can produce
 * the target color.
 *
 * All mana-granting skills are once-per-round (flip) or interactive.
 * Availability = player has skill + skill is face-up.
 */
function hasManaGrantingSkillForColor(
  player: Player,
  color: BasicManaColor
): boolean {
  for (const entry of MANA_GRANTING_SKILLS) {
    if (
      entry.producesColors.includes(color) &&
      player.skills.includes(entry.skillId) &&
      isSkillFaceUp(player, entry.skillId)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if the player has an available mana-granting unit that can produce
 * the target color.
 *
 * Unit must be ready and not wounded. For multi-ability units, the specific
 * ability index must not have been used.
 */
function hasManaGrantingUnitForColor(
  player: Player,
  color: BasicManaColor
): boolean {
  for (const entry of MANA_GRANTING_UNITS) {
    if (!entry.producesColors.includes(color)) continue;

    for (const unit of player.units) {
      if (unit.unitId !== entry.unitId) continue;
      if (unit.wounded) continue;

      // Check if the specific ability is available
      const usedIndices = unit.usedAbilityIndices ?? [];
      if (usedIndices.includes(entry.abilityIndex)) continue;

      // For non-multi-ability units, also check ready state
      if (unit.state !== UNIT_STATE_READY) continue;

      return true;
    }
  }
  return false;
}

// ============================================================================
// Regenerate draw check
// ============================================================================

/**
 * Check if a player can obtain a specific mana color to trigger Regenerate's
 * bonus card draw.
 *
 * Checks (in order):
 * 1. Direct mana sources (tokens, crystals, source dice)
 * 2. Polarization conversion (opposite color or day-black → target)
 * 3. Mana-granting skills that produce the color
 * 4. Mana-granting units that produce the color
 */
function canObtainColorForRegenerateDraw(
  state: GameState,
  player: Player,
  bonusColor: BasicManaColor
): boolean {
  if (hasDirectManaOfColor(state, player, bonusColor)) return true;
  if (canPolarizeToColor(state, player, bonusColor)) return true;
  if (hasManaGrantingSkillForColor(player, bonusColor)) return true;
  if (hasManaGrantingUnitForColor(player, bonusColor)) return true;
  return false;
}

/**
 * Check if a specific Regenerate skill can serve as an escape hatch.
 *
 * Regenerate is an escape hatch only if the card draw will trigger:
 * - Strictly lowest fame → any mana works (draw always triggers)
 * - Otherwise → must be able to obtain the bonus color (green/red)
 */
function canRegenerateDrawCard(
  state: GameState,
  player: Player,
  skillId: SkillId
): boolean {
  // Basic activation prereqs
  if (!player.skills.includes(skillId)) return false;
  if (!isSkillFaceUp(player, skillId)) return false;
  if (player.skillCooldowns.usedThisTurn.includes(skillId)) return false;
  if (!player.hand.some((c) => c === CARD_WOUND)) return false;
  if (state.combat !== null) return false;

  const bonusColor = REGENERATE_BONUS_COLOR[skillId];
  if (!bonusColor) return false;

  // If strictly lowest fame, any mana triggers the draw
  if (hasStrictlyLowestFame(state, player.id)) {
    return canActivateRegenerate(state, player);
  }

  // Otherwise, need the specific bonus color
  return canObtainColorForRegenerateDraw(state, player, bonusColor);
}

// ============================================================================
// Main escape hatch check
// ============================================================================

/**
 * Check if the player has an activatable card-drawing escape hatch skill.
 *
 * Returns true if ANY of the following skills is currently activatable
 * AND will draw at least one card:
 * - Motivation (any hero variant): face-up, cooldown not active → draws 2
 * - I Feel No Pain (Tovak): face-up, not on turn cooldown, not in combat → draws 1
 * - Regenerate (Krang/Braevalar): face-up, not on turn cooldown, not in combat,
 *   AND (bonus color obtainable OR strictly lowest fame) → draws 1
 */
export function hasCardDrawEscapeHatch(
  state: GameState,
  player: Player
): boolean {
  // Check Motivation skills
  if (!isMotivationCooldownActive(player)) {
    for (const skillId of ALL_MOTIVATION_SKILLS) {
      if (
        player.skills.includes(skillId) &&
        isSkillFaceUp(player, skillId)
      ) {
        return true;
      }
    }
  }

  // Check I Feel No Pain (Tovak) — once per turn, requires wound in hand, not in combat
  if (
    player.skills.includes(SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    isSkillFaceUp(player, SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    !player.skillCooldowns.usedThisTurn.includes(SKILL_TOVAK_I_FEEL_NO_PAIN) &&
    state.combat === null &&
    player.hand.some((c) => c === CARD_WOUND)
  ) {
    return true;
  }

  // Check Regenerate (Braevalar/Krang) — only if the draw will trigger
  for (const skillId of ALL_REGENERATE_SKILLS) {
    if (canRegenerateDrawCard(state, player, skillId)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the player is locked into slow recovery.
 *
 * A player is locked when their hand is all wounds AND they have no
 * activatable card-drawing escape hatch skill.
 */
export function isLockedIntoSlowRecovery(
  state: GameState,
  player: Player
): boolean {
  return isHandAllWounds(player) && !hasCardDrawEscapeHatch(state, player);
}
