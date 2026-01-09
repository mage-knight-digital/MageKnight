/**
 * Site reward granting helpers
 *
 * Functions to grant rewards when conquering or exploring sites.
 */

import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { randomElement } from "../../utils/rng.js";
import {
  SiteReward,
  SITE_REWARD_SPELL,
  SITE_REWARD_ARTIFACT,
  SITE_REWARD_CRYSTAL_ROLL,
  SITE_REWARD_ADVANCED_ACTION,
  SITE_REWARD_FAME,
  SITE_REWARD_COMPOUND,
  GameEvent,
  CARD_GAINED,
  CARD_GAIN_SOURCE_REWARD,
  FAME_GAINED,
  REWARD_QUEUED,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  MANA_GOLD,
  MANA_BLACK,
  BasicManaColor,
} from "@mage-knight/shared";

// =============================================================================
// TYPES
// =============================================================================

export interface RewardResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

// The 6 die faces for crystal rolls
const DIE_FACES = [MANA_RED, MANA_BLUE, MANA_GREEN, MANA_WHITE, MANA_GOLD, MANA_BLACK] as const;

// =============================================================================
// QUEUE REWARD FUNCTION
// =============================================================================

/**
 * Queue a site reward for the player to select at end of turn.
 *
 * Rewards that require player choice (spells, artifacts, advanced actions)
 * are queued for selection. Immediate rewards (fame, crystal rolls) are granted
 * immediately.
 */
export function queueSiteReward(
  state: GameState,
  playerId: string,
  reward: SiteReward
): RewardResult {
  // Some rewards can be granted immediately (no choice required)
  if (reward.type === SITE_REWARD_FAME) {
    return grantFameReward(state, playerId, reward.amount);
  }

  if (reward.type === SITE_REWARD_CRYSTAL_ROLL) {
    return grantCrystalRollReward(state, playerId, reward.count);
  }

  // Compound rewards: queue each sub-reward
  if (reward.type === SITE_REWARD_COMPOUND) {
    let currentState = state;
    const allEvents: GameEvent[] = [];

    for (const subReward of reward.rewards) {
      const { state: newState, events } = queueSiteReward(
        currentState,
        playerId,
        subReward
      );
      currentState = newState;
      allEvents.push(...events);
    }

    return { state: currentState, events: allEvents };
  }

  // Queue rewards that require player choice
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, events: [] };
  }

  const updatedPlayer: Player = {
    ...player,
    pendingRewards: [...player.pendingRewards, reward],
  };

  const updatedState: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? updatedPlayer : p
    ),
  };

  const events: GameEvent[] = [
    {
      type: REWARD_QUEUED,
      playerId,
      rewardType: reward.type,
    },
  ];

  return { state: updatedState, events };
}

// =============================================================================
// MAIN REWARD FUNCTION
// =============================================================================

/**
 * Grant a site reward to a player.
 * Handles all reward types: spells, artifacts, crystals, advanced actions, fame.
 *
 * Note: For spell and artifact rewards, we draw from the top of the deck.
 * In a full implementation, players might choose from the offer instead.
 */
export function grantSiteReward(
  state: GameState,
  playerId: string,
  reward: SiteReward
): RewardResult {
  switch (reward.type) {
    case SITE_REWARD_SPELL:
      return grantSpellReward(state, playerId, reward.count);

    case SITE_REWARD_ARTIFACT:
      return grantArtifactReward(state, playerId, reward.count);

    case SITE_REWARD_CRYSTAL_ROLL:
      return grantCrystalRollReward(state, playerId, reward.count);

    case SITE_REWARD_ADVANCED_ACTION:
      return grantAdvancedActionReward(state, playerId, reward.count);

    case SITE_REWARD_FAME:
      return grantFameReward(state, playerId, reward.amount);

    case SITE_REWARD_COMPOUND:
      return grantCompoundReward(state, playerId, reward.rewards);
  }
}

// =============================================================================
// INDIVIDUAL REWARD HANDLERS
// =============================================================================

function grantSpellReward(
  state: GameState,
  playerId: string,
  count: number
): RewardResult {
  let currentState = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    // Draw from spell offer (take first available)
    const spellOffer = currentState.offers.spells.cards;
    if (spellOffer.length === 0) {
      // No spells available - could replenish from deck
      // For now, skip if no spells
      continue;
    }

    const cardId = spellOffer[0];
    if (!cardId) continue;

    // Add spell to player's hand
    const player = currentState.players.find((p) => p.id === playerId);
    if (!player) continue;

    const updatedPlayer: Player = {
      ...player,
      hand: [...player.hand, cardId],
    };

    // Remove from offer
    const updatedOffer = {
      cards: spellOffer.slice(1),
    };

    // Replenish offer from deck if available
    let updatedDeck = currentState.decks.spells;
    let finalOffer = updatedOffer;
    if (updatedDeck.length > 0) {
      const newCard = updatedDeck[0];
      if (newCard) {
        finalOffer = {
          cards: [...updatedOffer.cards, newCard],
        };
        updatedDeck = updatedDeck.slice(1);
      }
    }

    currentState = {
      ...currentState,
      players: currentState.players.map((p) =>
        p.id === playerId ? updatedPlayer : p
      ),
      offers: {
        ...currentState.offers,
        spells: finalOffer,
      },
      decks: {
        ...currentState.decks,
        spells: updatedDeck,
      },
    };

    events.push({
      type: CARD_GAINED,
      playerId,
      cardId,
      source: CARD_GAIN_SOURCE_REWARD,
    });
  }

  return { state: currentState, events };
}

function grantArtifactReward(
  state: GameState,
  playerId: string,
  count: number
): RewardResult {
  let currentState = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    // Artifacts are drawn from deck (not offer)
    const artifactDeck = currentState.decks.artifacts;
    if (artifactDeck.length === 0) {
      // No artifacts available
      continue;
    }

    const cardId = artifactDeck[0];
    if (!cardId) continue;

    // Add artifact to player's hand
    const player = currentState.players.find((p) => p.id === playerId);
    if (!player) continue;

    const updatedPlayer: Player = {
      ...player,
      hand: [...player.hand, cardId],
    };

    currentState = {
      ...currentState,
      players: currentState.players.map((p) =>
        p.id === playerId ? updatedPlayer : p
      ),
      decks: {
        ...currentState.decks,
        artifacts: artifactDeck.slice(1),
      },
    };

    events.push({
      type: CARD_GAINED,
      playerId,
      cardId,
      source: CARD_GAIN_SOURCE_REWARD,
    });
  }

  return { state: currentState, events };
}

function grantCrystalRollReward(
  state: GameState,
  playerId: string,
  count: number
): RewardResult {
  let currentState = state;
  const events: GameEvent[] = [];
  let currentRng = state.rng;

  const player = currentState.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, events: [] };
  }

  let crystals = { ...player.crystals };
  let fameGained = 0;

  for (let i = 0; i < count; i++) {
    // Roll the die (pick random from 6 faces)
    const { value: rolledColor, rng: newRng } = randomElement(DIE_FACES, currentRng);
    currentRng = newRng;

    if (!rolledColor) continue;

    if (rolledColor === MANA_BLACK) {
      // Black = +1 fame instead of crystal
      fameGained += 1;
    } else if (rolledColor === MANA_GOLD) {
      // Gold = player chooses color
      // For now, we'll auto-pick green (in real game, needs choice prompt)
      // TODO: Implement choice mechanism for gold rolls
      crystals = { ...crystals, green: crystals.green + 1 };
    } else {
      // Basic color - grant that crystal
      const colorKey = rolledColor as BasicManaColor;
      crystals = { ...crystals, [colorKey]: crystals[colorKey] + 1 };
    }
  }

  // Update player with new crystals and fame
  const updatedPlayer: Player = {
    ...player,
    crystals,
    fame: player.fame + fameGained,
  };

  currentState = {
    ...currentState,
    players: currentState.players.map((p) =>
      p.id === playerId ? updatedPlayer : p
    ),
    rng: currentRng,
  };

  // Emit fame event if any gained
  if (fameGained > 0) {
    events.push({
      type: FAME_GAINED,
      playerId,
      amount: fameGained,
      newTotal: updatedPlayer.fame,
      source: "crystal_roll_black",
    });
  }

  // TODO: Emit crystal gained events when we add them

  return { state: currentState, events };
}

function grantAdvancedActionReward(
  state: GameState,
  playerId: string,
  count: number
): RewardResult {
  let currentState = state;
  const events: GameEvent[] = [];

  for (let i = 0; i < count; i++) {
    // Draw from advanced action offer (take first available)
    const aaOffer = currentState.offers.advancedActions.cards;
    if (aaOffer.length === 0) {
      continue;
    }

    const cardId = aaOffer[0];
    if (!cardId) continue;

    const player = currentState.players.find((p) => p.id === playerId);
    if (!player) continue;

    const updatedPlayer: Player = {
      ...player,
      hand: [...player.hand, cardId],
    };

    // Remove from offer and replenish from deck
    const updatedOffer = { cards: aaOffer.slice(1) };
    let updatedDeck = currentState.decks.advancedActions;
    let finalOffer = updatedOffer;

    if (updatedDeck.length > 0) {
      const newCard = updatedDeck[0];
      if (newCard) {
        finalOffer = { cards: [...updatedOffer.cards, newCard] };
        updatedDeck = updatedDeck.slice(1);
      }
    }

    currentState = {
      ...currentState,
      players: currentState.players.map((p) =>
        p.id === playerId ? updatedPlayer : p
      ),
      offers: {
        ...currentState.offers,
        advancedActions: finalOffer,
      },
      decks: {
        ...currentState.decks,
        advancedActions: updatedDeck,
      },
    };

    events.push({
      type: CARD_GAINED,
      playerId,
      cardId,
      source: CARD_GAIN_SOURCE_REWARD,
    });
  }

  return { state: currentState, events };
}

function grantFameReward(
  state: GameState,
  playerId: string,
  amount: number
): RewardResult {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) {
    return { state, events: [] };
  }

  const updatedPlayer: Player = {
    ...player,
    fame: player.fame + amount,
  };

  const updatedState: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? updatedPlayer : p
    ),
  };

  const events: GameEvent[] = [
    {
      type: FAME_GAINED,
      playerId,
      amount,
      newTotal: updatedPlayer.fame,
      source: "site_reward",
    },
  ];

  return { state: updatedState, events };
}

function grantCompoundReward(
  state: GameState,
  playerId: string,
  rewards: readonly SiteReward[]
): RewardResult {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  for (const reward of rewards) {
    const { state: newState, events } = grantSiteReward(
      currentState,
      playerId,
      reward
    );
    currentState = newState;
    allEvents.push(...events);
  }

  return { state: currentState, events: allEvents };
}
