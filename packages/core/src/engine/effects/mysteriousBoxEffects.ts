/**
 * Mysterious Box effect handlers.
 *
 * Flow:
 * 1. Reveal and temporarily remove top artifact from deck
 * 2. Choose how to use Mysterious Box this turn (unused/basic/powered/banner)
 * 3. End-of-turn cleanup is handled by endTurn command integration
 */

import type { CardId } from "@mage-knight/shared";
import { CARD_MYSTERIOUS_BOX } from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import type {
  CardEffect,
  ResolveMysteriousBoxUseEffect,
} from "../../types/cards.js";
import {
  CATEGORY_BANNER,
  DEED_CARD_TYPE_ARTIFACT,
} from "../../types/cards.js";
import {
  EFFECT_GAIN_FAME,
  EFFECT_MYSTERIOUS_BOX,
  EFFECT_NOOP,
  EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
} from "../../types/effectTypes.js";
import type { EffectResolutionResult } from "./types.js";
import type { EffectResolver } from "./compound.js";
import { registerEffect } from "./effectRegistry.js";
import { getPlayerContext } from "./effectHelpers.js";
import { updatePlayer } from "./atomicHelpers.js";
import { getCard } from "../helpers/cardLookup.js";

type MysteriousBoxMode = ResolveMysteriousBoxUseEffect["mode"];

function updateMysteriousBoxState(
  state: GameState,
  playerIndex: number,
  player: Player,
  revealedArtifactId: CardId,
  usedAs: MysteriousBoxMode,
  playedCardFromHandBeforePlay: boolean
): GameState {
  return updatePlayer(state, playerIndex, {
    ...player,
    mysteriousBoxState: {
      revealedArtifactId,
      usedAs,
      playedCardFromHandBeforePlay,
    },
  });
}

function buildUseOptions(
  state: GameState,
  player: Player,
  sourceCardId: CardId,
  revealedArtifactId: CardId,
  revealedArtifactName: string
): ResolveMysteriousBoxUseEffect[] {
  const revealedCard = getCard(revealedArtifactId);
  const options: ResolveMysteriousBoxUseEffect[] = [
    {
      type: EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
      sourceCardId,
      revealedArtifactId,
      revealedArtifactName,
      mode: "unused",
    },
  ];

  if (
    !revealedCard ||
    revealedCard.cardType !== DEED_CARD_TYPE_ARTIFACT ||
    revealedArtifactId === CARD_MYSTERIOUS_BOX
  ) {
    return options;
  }

  const isBanner = revealedCard.categories.includes(CATEGORY_BANNER);
  const basicIsNoop = revealedCard.basicEffect.type === EFFECT_NOOP;

  // For banner artifacts with no basic action text, prefer banner assignment option.
  if (!isBanner || !basicIsNoop) {
    options.push({
      type: EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
      sourceCardId,
      revealedArtifactId,
      revealedArtifactName,
      mode: "basic",
    });
  }

  if (revealedCard.poweredBy.length > 0) {
    options.push({
      type: EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
      sourceCardId,
      revealedArtifactId,
      revealedArtifactName,
      mode: "powered",
    });
  }

  if (isBanner && player.units.length > 0) {
    for (const unit of player.units) {
      const existingBanner = player.attachedBanners.find(
        (banner) => banner.unitInstanceId === unit.instanceId
      );
      options.push({
        type: EFFECT_RESOLVE_MYSTERIOUS_BOX_USE,
        sourceCardId,
        revealedArtifactId,
        revealedArtifactName,
        mode: "banner",
        unitInstanceId: unit.instanceId,
        replacedBannerId: existingBanner?.bannerId,
      });
    }
  }

  return options;
}

function handleMysteriousBox(
  state: GameState,
  playerId: string,
  sourceCardId: CardId
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  const revealedArtifactId = state.decks.artifacts[0];

  if (!revealedArtifactId) {
    return {
      state,
      description: "Mysterious Box: no artifacts left to reveal",
    };
  }

  const revealedArtifactName = getCard(revealedArtifactId)?.name ?? revealedArtifactId;
  const options = buildUseOptions(
    state,
    player,
    sourceCardId,
    revealedArtifactId,
    revealedArtifactName
  );

  const stateWithArtifactRevealed = {
    ...state,
    decks: {
      ...state.decks,
      artifacts: state.decks.artifacts.slice(1),
    },
  };

  const updatedState = updateMysteriousBoxState(
    stateWithArtifactRevealed,
    playerIndex,
    player,
    revealedArtifactId,
    "unused",
    player.playedCardFromHandThisTurn
  );

  return {
    state: updatedState,
    description: `Mysterious Box: revealed ${revealedArtifactName}`,
    requiresChoice: true,
    dynamicChoiceOptions: options as readonly CardEffect[],
  };
}

function resolveMysteriousBoxUse(
  state: GameState,
  playerId: string,
  effect: ResolveMysteriousBoxUseEffect,
  resolveEffect: EffectResolver
): EffectResolutionResult {
  const { playerIndex, player } = getPlayerContext(state, playerId);
  const boxState = player.mysteriousBoxState;

  if (!boxState || boxState.revealedArtifactId !== effect.revealedArtifactId) {
    return {
      state,
      description: "Mysterious Box is not currently active",
    };
  }

  if (effect.mode === "unused") {
    const stateWithUnused = updateMysteriousBoxState(
      state,
      playerIndex,
      player,
      effect.revealedArtifactId,
      "unused",
      boxState.playedCardFromHandBeforePlay
    );
    const stateWithTurnRequirementRestored = updatePlayer(
      stateWithUnused,
      playerIndex,
      {
        ...stateWithUnused.players[playerIndex]!,
        playedCardFromHandThisTurn: boxState.playedCardFromHandBeforePlay,
      }
    );
    return {
      state: stateWithTurnRequirementRestored,
      description: `Mysterious Box remains unused as ${effect.revealedArtifactName}`,
    };
  }

  if (effect.mode === "banner") {
    if (!effect.unitInstanceId) {
      return {
        state,
        description: "Mysterious Box banner use requires a unit target",
      };
    }

    const targetUnitExists = player.units.some(
      (unit) => unit.instanceId === effect.unitInstanceId
    );
    if (!targetUnitExists) {
      return {
        state,
        description: "Selected unit is no longer available for Mysterious Box banner use",
      };
    }

    // Replace banner on target unit if one exists, then attach Mysterious Box.
    const existingBanner = player.attachedBanners.find(
      (banner) => banner.unitInstanceId === effect.unitInstanceId
    );
    const attachedBannersWithoutTarget = player.attachedBanners.filter(
      (banner) => banner.unitInstanceId !== effect.unitInstanceId
    );
    const attachedBanners = [
      ...attachedBannersWithoutTarget.filter(
        (banner) => banner.bannerId !== CARD_MYSTERIOUS_BOX
      ),
      {
        bannerId: effect.sourceCardId,
        unitInstanceId: effect.unitInstanceId,
        isUsedThisRound: false,
      },
    ];

    const discard = existingBanner
      ? [...player.discard, existingBanner.bannerId]
      : player.discard;

    const stateWithBanner = updatePlayer(state, playerIndex, {
      ...player,
      discard,
      attachedBanners,
      mysteriousBoxState: {
        revealedArtifactId: effect.revealedArtifactId,
        usedAs: "banner",
        playedCardFromHandBeforePlay: boxState.playedCardFromHandBeforePlay,
      },
    });

    const fameResult = resolveEffect(
      stateWithBanner,
      playerId,
      { type: EFFECT_GAIN_FAME, amount: 1 },
      effect.sourceCardId
    );

    return {
      ...fameResult,
      description: `Mysterious Box used as ${effect.revealedArtifactName} banner (Fame +1)`,
    };
  }

  const revealedArtifact = getCard(effect.revealedArtifactId);
  if (
    !revealedArtifact ||
    revealedArtifact.cardType !== DEED_CARD_TYPE_ARTIFACT ||
    effect.revealedArtifactId === CARD_MYSTERIOUS_BOX
  ) {
    return {
      state,
      description: `Mysterious Box cannot copy ${effect.revealedArtifactName}`,
    };
  }

  const copiedEffect = effect.mode === "powered"
    ? revealedArtifact.poweredEffect
    : revealedArtifact.basicEffect;

  const copiedResult = resolveEffect(
    state,
    playerId,
    copiedEffect,
    effect.sourceCardId
  );

  const { player: playerAfterCopy, playerIndex: playerIndexAfterCopy } = getPlayerContext(
    copiedResult.state,
    playerId
  );

  const stateWithUsage = updateMysteriousBoxState(
    copiedResult.state,
    playerIndexAfterCopy,
    playerAfterCopy,
    effect.revealedArtifactId,
    effect.mode,
    boxState.playedCardFromHandBeforePlay
  );

  const fameResult = resolveEffect(
    stateWithUsage,
    playerId,
    { type: EFFECT_GAIN_FAME, amount: 1 },
    effect.sourceCardId
  );

  return {
    state: fameResult.state,
    description: `Mysterious Box used ${effect.mode} effect of ${effect.revealedArtifactName} (Fame +1)`,
    requiresChoice: copiedResult.requiresChoice,
    dynamicChoiceOptions: copiedResult.dynamicChoiceOptions,
    resolvedEffect: copiedResult.resolvedEffect,
  };
}

export function registerMysteriousBoxEffects(resolver: EffectResolver): void {
  registerEffect(EFFECT_MYSTERIOUS_BOX, (state, playerId, _effect, sourceCardId) => {
    const sourceId = sourceCardId as CardId | undefined;
    if (!sourceId) {
      throw new Error("Mysterious Box effect requires sourceCardId");
    }
    return handleMysteriousBox(state, playerId, sourceId);
  });

  registerEffect(EFFECT_RESOLVE_MYSTERIOUS_BOX_USE, (state, playerId, effect) => {
    return resolveMysteriousBoxUse(
      state,
      playerId,
      effect as ResolveMysteriousBoxUseEffect,
      resolver
    );
  });
}
