/**
 * Pending state option helpers.
 *
 * Handles special pending states that require player resolution:
 * - Glade wound discard choices
 * - Deep mine crystal color choices
 * - Discard as cost choices
 * - Discard for attack choices (Sword of Justice)
 * - Crystal Joy reclaim choices
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  GladeWoundOptions,
  DeepMineOptions,
  BasicManaColor,
  DiscardCostOptions,
  DiscardForAttackOptions,
  DiscardForBonusOptions,
  DiscardForCrystalOptions,
  DecomposeOptions,
  MaximalEffectOptions,
  BookOfWisdomOptions,
  TrainingOptions,
  ArtifactCrystalColorOptions,
  CrystalJoyReclaimOptions,
  SteadyTempoOptions,
  BannerProtectionOptions,
  UnitMaintenanceOptions,
  MeditationOptions,
  CardId,
} from "@mage-knight/shared";
import { mineColorToBasicManaColor } from "../../types/map.js";
import { CARD_WOUND, hexKey, MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE } from "@mage-knight/shared";
import {
  hasPendingUnitMaintenance as checkHasPendingUnitMaintenance,
  getAvailableCrystalColorsForMaintenance,
} from "../rules/unitMaintenance.js";
import { SiteType } from "../../types/map.js";
import { getCardsEligibleForDiscardCost } from "../effects/discardEffects.js";
import { getCardsEligibleForDiscardForAttack } from "../effects/swordOfJusticeEffects.js";
import { getCardsEligibleForDiscardForBonus } from "../effects/stoutResolveEffects.js";
import { getCardsEligibleForDiscardForCrystal } from "../effects/discardForCrystalEffects.js";
import { getCardsEligibleForDecompose } from "../effects/decomposeEffects.js";
import { getCardsEligibleForMaximalEffect } from "../effects/maximalEffectEffects.js";
import { getCardsEligibleForBookOfWisdom } from "../effects/bookOfWisdomEffects.js";
import { getCardsEligibleForTraining } from "../effects/trainingEffects.js";
import { getCard } from "../helpers/cardLookup.js";
import { isCardEligibleForReclaim } from "../rules/crystalJoyReclaim.js";

/**
 * Get Magical Glade wound discard options for the player.
 * Returns options if player is on a glade and has wounds.
 */
export function getGladeWoundOptions(
  state: GameState,
  player: Player
): GladeWoundOptions | undefined {
  // Must be on the map
  if (!player.position) {
    return undefined;
  }

  // Check if on a Magical Glade
  const hex = state.map.hexes[hexKey(player.position)];
  if (!hex?.site || hex.site.type !== SiteType.MagicalGlade) {
    return undefined;
  }

  // Check for wounds in hand and discard
  const hasWoundsInHand = player.hand.some((c) => c === CARD_WOUND);
  const hasWoundsInDiscard = player.discard.some((c) => c === CARD_WOUND);

  // If no wounds anywhere, no options needed
  if (!hasWoundsInHand && !hasWoundsInDiscard) {
    return undefined;
  }

  return {
    hasWoundsInHand,
    hasWoundsInDiscard,
  };
}

/**
 * Get Deep Mine crystal color choice options for the player.
 * Returns options if player has a pending deep mine choice.
 */
export function getDeepMineOptions(
  _state: GameState,
  player: Player
): DeepMineOptions | undefined {
  // Check if player has a pending deep mine choice
  if (!player.pendingDeepMineChoice || player.pendingDeepMineChoice.length === 0) {
    return undefined;
  }

  // Convert mine colors to basic mana colors
  const availableColors: BasicManaColor[] = player.pendingDeepMineChoice.map(
    mineColorToBasicManaColor
  );

  return {
    availableColors,
  };
}

/**
 * Get discard cost options for the player.
 * Returns options if player has a pending discard cost to resolve.
 */
export function getDiscardCostOptions(
  _state: GameState,
  player: Player
): DiscardCostOptions | undefined {
  // Check if player has a pending discard cost
  if (!player.pendingDiscard) {
    return undefined;
  }

  const { sourceCardId, count, optional, filterWounds, colorMatters, allowNoColor } = player.pendingDiscard;

  // Get eligible cards from hand
  const availableCardIds = getCardsEligibleForDiscardCost(
    player.hand,
    filterWounds,
    colorMatters ?? false,
    allowNoColor ?? false
  );

  return {
    sourceCardId,
    availableCardIds,
    count,
    optional,
  };
}

/**
 * Get discard for attack options for the player.
 * Returns options if player has a pending discard-for-attack state (Sword of Justice).
 */
export function getDiscardForAttackOptions(
  _state: GameState,
  player: Player
): DiscardForAttackOptions | undefined {
  // Check if player has a pending discard-for-attack
  if (!player.pendingDiscardForAttack) {
    return undefined;
  }

  const { sourceCardId, attackPerCard, combatType } = player.pendingDiscardForAttack;

  // Get eligible cards from hand (non-wound cards)
  const availableCardIds = getCardsEligibleForDiscardForAttack(player.hand);

  return {
    sourceCardId,
    availableCardIds,
    attackPerCard,
    combatType,
  };
}

/**
 * Get discard for bonus options for the player.
 * Returns options if player has a pending discard-for-bonus state (Stout Resolve).
 */
export function getDiscardForBonusOptions(
  _state: GameState,
  player: Player
): DiscardForBonusOptions | undefined {
  if (!player.pendingDiscardForBonus) {
    return undefined;
  }

  const { sourceCardId, bonusPerCard, maxDiscards, discardFilter, choiceOptions } =
    player.pendingDiscardForBonus;

  // Get eligible cards from hand
  const availableCardIds = getCardsEligibleForDiscardForBonus(
    player.hand,
    discardFilter
  );

  return {
    sourceCardId,
    availableCardIds,
    bonusPerCard,
    maxDiscards,
    discardFilter,
    choiceCount: choiceOptions.length,
  };
}

/**
 * Get discard for crystal options for the player.
 * Returns options if player has a pending discard-for-crystal state (Savage Harvesting).
 */
export function getDiscardForCrystalOptions(
  _state: GameState,
  player: Player
): DiscardForCrystalOptions | undefined {
  // Check if player has a pending discard-for-crystal (not awaiting color choice)
  if (!player.pendingDiscardForCrystal || player.pendingDiscardForCrystal.awaitingColorChoice) {
    return undefined;
  }

  const { sourceCardId, optional } = player.pendingDiscardForCrystal;

  // Get eligible cards from hand (non-wound cards)
  const availableCardIds = getCardsEligibleForDiscardForCrystal(player.hand);

  return {
    sourceCardId,
    availableCardIds,
    optional,
  };
}

/**
 * Get artifact crystal color options for the player.
 * Returns options if player has a pending artifact color choice (Savage Harvesting).
 */
export function getArtifactCrystalColorOptions(
  _state: GameState,
  player: Player
): ArtifactCrystalColorOptions | undefined {
  // Check if player is awaiting color choice after artifact discard
  if (!player.pendingDiscardForCrystal?.awaitingColorChoice) {
    return undefined;
  }

  return {
    availableColors: [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE],
  };
}

/**
 * Get decompose options for the player.
 * Returns options if player has a pending decompose state (Decompose card).
 */
export function getDecomposeOptions(
  _state: GameState,
  player: Player
): DecomposeOptions | undefined {
  if (!player.pendingDecompose) {
    return undefined;
  }

  const { sourceCardId, mode } = player.pendingDecompose;
  const availableCardIds = getCardsEligibleForDecompose(player.hand, sourceCardId);

  return {
    sourceCardId,
    availableCardIds,
    mode,
  };
}

/**
 * Get Maximal Effect options for the player.
 * Returns options if player has a pending maximal effect state (Maximal Effect card).
 */
export function getMaximalEffectOptions(
  _state: GameState,
  player: Player
): MaximalEffectOptions | undefined {
  if (!player.pendingMaximalEffect) {
    return undefined;
  }

  const { sourceCardId, multiplier, effectKind } = player.pendingMaximalEffect;
  const availableCardIds = getCardsEligibleForMaximalEffect(player.hand, sourceCardId, effectKind, multiplier);

  return {
    sourceCardId,
    availableCardIds,
    multiplier,
    effectKind,
  };
}

/**
 * Get Crystal Joy reclaim options for the player.
 * Returns eligible cards from discard pile if player has a pending reclaim choice.
 */
export function getCrystalJoyReclaimOptions(
  _state: GameState,
  player: Player
): CrystalJoyReclaimOptions {
  const { version } = player.pendingCrystalJoyReclaim!;

  const eligibleCardIds: CardId[] = [];

  for (const cardId of player.discard) {
    const card = getCard(cardId);
    if (card && isCardEligibleForReclaim(card, version)) {
      eligibleCardIds.push(cardId);
    }
  }

  return {
    version,
    eligibleCardIds,
  };
}

/**
 * Get Steady Tempo deck placement options for the player.
 * Returns options if player has a pending Steady Tempo placement choice.
 */
export function getSteadyTempoOptions(
  _state: GameState,
  player: Player
): SteadyTempoOptions {
  const { version } = player.pendingSteadyTempoDeckPlacement!;
  const position = version === "powered" ? "top" : "bottom";

  // Basic version: cannot place on bottom of empty deck
  const canPlace = version === "powered" || player.deck.length > 0;

  return {
    position,
    canPlace,
  };
}

/**
 * Get Banner of Protection wound removal options for the player.
 * Returns options showing how many wounds were received in hand and discard.
 */
export function getBannerProtectionOptions(
  player: Player
): BannerProtectionOptions {
  return {
    woundsInHand: player.woundsReceivedThisTurn.hand,
    woundsInDiscard: player.woundsReceivedThisTurn.discard,
  };
}

/**
 * Get unit maintenance options for the player.
 * Returns options if player has Magic Familiars requiring round-start maintenance.
 */
export function getUnitMaintenanceOptions(
  player: Player
): UnitMaintenanceOptions | undefined {
  if (!checkHasPendingUnitMaintenance(player)) {
    return undefined;
  }

  const units = player.pendingUnitMaintenance!.map((m) => {
    const availableCrystalColors = getAvailableCrystalColorsForMaintenance(player);
    return {
      unitInstanceId: m.unitInstanceId,
      unitId: m.unitId,
      availableCrystalColors,
    };
  });

  return { units };
}

/**
 * Get Book of Wisdom options for the player.
 * Returns options if player has a pending Book of Wisdom state.
 */
export function getBookOfWisdomOptions(
  state: GameState,
  player: Player
): BookOfWisdomOptions | undefined {
  if (!player.pendingBookOfWisdom) {
    return undefined;
  }

  const { sourceCardId, mode, phase, availableOfferCards } = player.pendingBookOfWisdom;

  if (phase === "select_card") {
    // Phase 1: show eligible action cards from hand
    const availableCardIds = getCardsEligibleForBookOfWisdom(player.hand, sourceCardId);
    return {
      sourceCardId,
      mode,
      phase,
      availableCardIds,
      availableOfferCards: [],
    };
  }

  // Phase 2: show available offer cards
  return {
    sourceCardId,
    mode,
    phase,
    availableCardIds: [],
    availableOfferCards,
  };
}

/**
 * Get Training options for the player.
 * Returns options if player has a pending Training state.
 */
export function getTrainingOptions(
  state: GameState,
  player: Player
): TrainingOptions | undefined {
  if (!player.pendingTraining) {
    return undefined;
  }

  const { sourceCardId, mode, phase, availableOfferCards } = player.pendingTraining;

  if (phase === "select_card") {
    // Phase 1: show eligible action cards from hand
    const availableCardIds = getCardsEligibleForTraining(player.hand, sourceCardId);
    return {
      sourceCardId,
      mode,
      phase,
      availableCardIds,
      availableOfferCards: [],
    };
  }

  // Phase 2: show available offer cards
  return {
    sourceCardId,
    mode,
    phase,
    availableCardIds: [],
    availableOfferCards,
  };
}

/**
 * Get Meditation options for the player.
 * Returns options based on current phase (select_cards or place_cards).
 */
export function getMeditationOptions(
  _state: GameState,
  player: Player
): MeditationOptions {
  const pending = player.pendingMeditation!;

  if (pending.phase === "select_cards") {
    // Phase 1: player selects cards from discard (powered mode)
    const selectCount = Math.min(2, player.discard.length);
    return {
      phase: "select_cards",
      version: pending.version,
      eligibleCardIds: [...player.discard],
      selectCount,
    };
  }

  // Phase 2: player chooses top or bottom
  return {
    phase: "place_cards",
    version: pending.version,
    selectedCardIds: pending.selectedCardIds,
  };
}
