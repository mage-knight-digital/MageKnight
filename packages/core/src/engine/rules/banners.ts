/**
 * Banner rules.
 *
 * Pure functions defining banner-related game mechanics.
 * Shared by validators, validActions, and commands.
 */

import type { DeedCard } from "../../types/cards.js";
import type { Player, BannerAttachment } from "../../types/player.js";
import type { PlayerUnit } from "../../types/unit.js";
import type { CardId } from "@mage-knight/shared";
import {
  ABILITY_ARCANE_IMMUNITY,
  CARD_BANNER_OF_FEAR,
  CARD_BANNER_OF_GLORY,
  getUnit,
  UNIT_ABILITY_ATTACK,
  UNIT_ABILITY_RANGED_ATTACK,
  UNIT_ABILITY_SIEGE_ATTACK,
  UNIT_ABILITY_BLOCK,
  UNIT_STATE_READY,
} from "@mage-knight/shared";
import { DEED_CARD_TYPE_ARTIFACT, CATEGORY_BANNER } from "../../types/cards.js";
import type { CombatEnemy } from "../../types/combat.js";
import { getEnemyAttackCount, isAttackCancelled } from "../combat/enemyAttackHelpers.js";

/**
 * Check if a card is a banner artifact (artifact with banner category).
 */
export function isBannerArtifact(card: DeedCard): boolean {
  return (
    card.cardType === DEED_CARD_TYPE_ARTIFACT &&
    card.categories.includes(CATEGORY_BANNER)
  );
}

/**
 * Get the banner attachment for a specific unit, if any.
 */
export function getBannerForUnit(
  player: Player,
  unitInstanceId: string
): BannerAttachment | undefined {
  return player.attachedBanners.find(
    (b) => b.unitInstanceId === unitInstanceId
  );
}

/**
 * Check if a banner has been used this round.
 */
export function isBannerUsedThisRound(
  player: Player,
  bannerId: CardId
): boolean {
  const attachment = player.attachedBanners.find(
    (b) => b.bannerId === bannerId
  );
  return attachment?.isUsedThisRound ?? false;
}

/**
 * Mark a banner as used this round. Returns the updated attachedBanners array.
 */
export function markBannerUsed(
  attachedBanners: readonly BannerAttachment[],
  bannerId: CardId
): readonly BannerAttachment[] {
  return attachedBanners.map((b) =>
    b.bannerId === bannerId ? { ...b, isUsedThisRound: true } : b
  );
}

// ============================================================================
// Banner of Glory: Armor Bonus
// ============================================================================

/**
 * Get the effective armor for a unit, including Banner of Glory bonus.
 * Banner of Glory grants +1 armor while attached to a unit.
 */
export function getEffectiveUnitArmor(
  player: Player,
  unit: PlayerUnit
): number {
  const unitDef = getUnit(unit.unitId);
  let armor = unitDef.armor;

  const banner = getBannerForUnit(player, unit.instanceId);
  if (banner && banner.bannerId === CARD_BANNER_OF_GLORY) {
    armor += 1;
  }

  return armor;
}

// ============================================================================
// Banner of Glory: Attack/Block Tack-On Bonus
// ============================================================================

/**
 * Check if a unit has a base attack ability (melee, ranged, or siege).
 * Used by Banner of Glory tack-on bonus: +1 only applies if unit has base attack.
 */
export function unitHasBaseAttack(unit: PlayerUnit): boolean {
  const unitDef = getUnit(unit.unitId);
  return unitDef.abilities.some(
    (a) =>
      (a.type === UNIT_ABILITY_ATTACK ||
        a.type === UNIT_ABILITY_RANGED_ATTACK ||
        a.type === UNIT_ABILITY_SIEGE_ATTACK) &&
      (a.value ?? 0) > 0
  );
}

/**
 * Check if a unit has a base block ability.
 * Used by Banner of Glory tack-on bonus: +1 only applies if unit has base block.
 */
export function unitHasBaseBlock(unit: PlayerUnit): boolean {
  const unitDef = getUnit(unit.unitId);
  return unitDef.abilities.some(
    (a) => a.type === UNIT_ABILITY_BLOCK && (a.value ?? 0) > 0
  );
}

/**
 * Get the Banner of Glory tack-on bonus for an attack ability.
 * Returns +1 if the unit has Banner of Glory attached AND has a base attack ability.
 * Returns 0 otherwise (tack-on bonus requires base value).
 */
export function getBannerAttackTackOn(
  player: Player,
  unit: PlayerUnit
): number {
  const banner = getBannerForUnit(player, unit.instanceId);
  if (!banner || banner.bannerId !== CARD_BANNER_OF_GLORY) return 0;
  return unitHasBaseAttack(unit) ? 1 : 0;
}

/**
 * Get the Banner of Glory tack-on bonus for a block ability.
 * Returns +1 if the unit has Banner of Glory attached AND has a base block ability.
 * Returns 0 otherwise (tack-on bonus requires base value).
 */
export function getBannerBlockTackOn(
  player: Player,
  unit: PlayerUnit
): number {
  const banner = getBannerForUnit(player, unit.instanceId);
  if (!banner || banner.bannerId !== CARD_BANNER_OF_GLORY) return 0;
  return unitHasBaseBlock(unit) ? 1 : 0;
}

// ============================================================================
// Banner of Glory: Fame on Combat Action
// ============================================================================

/**
 * Check if a unit should grant fame when it attacks or blocks,
 * due to Banner of Glory being attached.
 */
export function shouldBannerGrantFame(
  player: Player,
  unitInstanceId: string
): boolean {
  const banner = getBannerForUnit(player, unitInstanceId);
  return banner !== undefined && banner.bannerId === CARD_BANNER_OF_GLORY;
}

// ============================================================================
// Banner of Fear: Cancel Attack
// ============================================================================

/**
 * Check if a unit has Banner of Fear attached.
 */
export function hasBannerOfFear(
  player: Player,
  unitInstanceId: string
): boolean {
  const banner = getBannerForUnit(player, unitInstanceId);
  return banner !== undefined && banner.bannerId === CARD_BANNER_OF_FEAR;
}

/**
 * Check if a unit can use Banner of Fear's cancel attack ability.
 * Requirements:
 * - Unit must have Banner of Fear attached
 * - Unit must be ready (not spent)
 * - Unit must not be wounded
 *
 * Note: Banner of Fear usage is tied to unit ready state, NOT isUsedThisRound.
 * If unit is re-readied (e.g. via Song of Wind), Banner can be used again.
 */
export function canUseBannerFear(
  player: Player,
  unitInstanceId: string
): boolean {
  const banner = getBannerForUnit(player, unitInstanceId);
  if (!banner || banner.bannerId !== CARD_BANNER_OF_FEAR) return false;

  const unit = player.units.find((u) => u.instanceId === unitInstanceId);
  if (!unit) return false;

  // Must be ready and unwounded
  return unit.state === UNIT_STATE_READY && !unit.wounded;
}

/**
 * Check if an enemy's attack can be cancelled by Banner of Fear.
 * Cannot cancel attacks from Arcane Immune enemies.
 */
export function canCancelEnemyAttack(
  enemy: CombatEnemy,
  attackIndex: number
): boolean {
  // Cannot target Arcane Immune enemies
  if (enemy.definition.abilities.includes(ABILITY_ARCANE_IMMUNITY)) return false;

  // Cannot cancel already-cancelled attacks
  if (isAttackCancelled(enemy, attackIndex)) return false;

  // Attack index must be valid
  const attackCount = getEnemyAttackCount(enemy);
  if (attackIndex < 0 || attackIndex >= attackCount) return false;

  return true;
}

/**
 * Get all (enemy, attackIndex) pairs that can be targeted by Banner of Fear.
 * Used by validActions to show available cancel targets during block phase.
 */
export function getCancellableAttacks(
  enemies: readonly CombatEnemy[]
): readonly { enemyInstanceId: string; attackIndex: number }[] {
  const targets: { enemyInstanceId: string; attackIndex: number }[] = [];

  for (const enemy of enemies) {
    if (enemy.isDefeated) continue;

    const attackCount = getEnemyAttackCount(enemy);
    for (let i = 0; i < attackCount; i++) {
      if (canCancelEnemyAttack(enemy, i)) {
        targets.push({ enemyInstanceId: enemy.instanceId, attackIndex: i });
      }
    }
  }

  return targets;
}
