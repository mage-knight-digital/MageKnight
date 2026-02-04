/**
 * Card category helpers.
 *
 * Provides per-effect category resolution and healing category checks.
 */

import type { DeedCard, CardCategory } from "../../types/cards.js";
import { CATEGORY_HEALING } from "../../types/cards.js";

export type CardEffectKind = "basic" | "powered";

export function getEffectCategories(
  card: DeedCard,
  effectKind: CardEffectKind
): readonly CardCategory[] {
  if (effectKind === "basic" && card.basicEffectCategories?.length) {
    return card.basicEffectCategories;
  }

  if (effectKind === "powered" && card.poweredEffectCategories?.length) {
    return card.poweredEffectCategories;
  }

  return card.categories;
}

export function hasHealingCategory(categories: readonly CardCategory[]): boolean {
  return categories.includes(CATEGORY_HEALING);
}

export function isHealingOnlyCategories(categories: readonly CardCategory[]): boolean {
  return categories.length === 1 && categories[0] === CATEGORY_HEALING;
}
