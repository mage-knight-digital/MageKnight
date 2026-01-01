/**
 * Card definitions for Mage Knight
 */

import type { CardId, ManaColor } from "@mage-knight/shared";

// Card types in the game
export type DeedCardType =
  | "basic_action"
  | "advanced_action"
  | "spell"
  | "artifact"
  | "wound";

// Effect placeholder - we'll expand this later
// For now just describe what the effect does
export interface CardEffect {
  readonly description: string;
  // Future: structured effect types (move, influence, attack, block, heal, special)
}

// A deed card definition
export interface DeedCard {
  readonly id: CardId;
  readonly name: string;
  readonly type: DeedCardType;
  readonly color: ManaColor | null; // color needed to power it (null for wounds, some artifacts)
  readonly basicEffect: CardEffect;
  readonly strongEffect: CardEffect; // for artifacts: this is the "throw away" effect
}

// Recruitment site types - where a unit can be recruited (icons on unit cards)
export type RecruitmentSite = "village" | "keep" | "mage_tower" | "monastery" | "city";

// Unit tier - determines when units appear in the offer
// Silver units are available from the start, gold units after core tiles are revealed
export type UnitTier = "silver" | "gold";

// Unit ability placeholder - expand later
export interface UnitAbility {
  readonly name: string;
  readonly manaCost: ManaColor | null; // null = no mana needed
  readonly effect: CardEffect;
}

// Unit card (separate from deed cards - units don't go in your deck)
export interface UnitCard {
  readonly id: CardId;
  readonly name: string;
  readonly level: number; // 1-4, also determines healing cost
  readonly armor: number;
  readonly recruitCost: number; // influence needed
  readonly abilities: readonly UnitAbility[];
  readonly recruitmentSites: readonly RecruitmentSite[]; // where this unit can be recruited
  readonly tier: UnitTier; // silver = early game, gold = after core tiles
}
