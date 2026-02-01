/**
 * Shared string constants for non-discriminator unions ("sub-unions").
 *
 * We keep these centralized to avoid drift across engine/server/client.
 */

// === Generic "source of a mana token" (where it came from) ===
export const MANA_TOKEN_SOURCE_DIE = "die" as const;
export const MANA_TOKEN_SOURCE_CARD = "card" as const;
export const MANA_TOKEN_SOURCE_SKILL = "skill" as const;
export const MANA_TOKEN_SOURCE_SITE = "site" as const;
export const MANA_TOKEN_SOURCE_TACTIC = "tactic" as const;

export type ManaTokenSource =
  | typeof MANA_TOKEN_SOURCE_DIE
  | typeof MANA_TOKEN_SOURCE_CARD
  | typeof MANA_TOKEN_SOURCE_SKILL
  | typeof MANA_TOKEN_SOURCE_SITE
  | typeof MANA_TOKEN_SOURCE_TACTIC;

// === Action sub-unions ===
export const MANA_SOURCE_DIE = "die" as const;
export const MANA_SOURCE_CRYSTAL = "crystal" as const;
export const MANA_SOURCE_TOKEN = "token" as const;
export const MANA_SOURCE_ENDLESS = "endless" as const;

export type ManaSourceType =
  | typeof MANA_SOURCE_DIE
  | typeof MANA_SOURCE_CRYSTAL
  | typeof MANA_SOURCE_TOKEN
  | typeof MANA_SOURCE_ENDLESS;

export const PLAY_SIDEWAYS_AS_MOVE = "move" as const;
export const PLAY_SIDEWAYS_AS_INFLUENCE = "influence" as const;
export const PLAY_SIDEWAYS_AS_ATTACK = "attack" as const;
export const PLAY_SIDEWAYS_AS_BLOCK = "block" as const;

// === Event sub-unions ===
export const CARD_GAIN_SOURCE_OFFER = "offer" as const;
export const CARD_GAIN_SOURCE_REWARD = "reward" as const;
export const CARD_GAIN_SOURCE_LEVEL_UP = "level_up" as const;

export const OFFER_TYPE_UNITS = "units" as const;
export const OFFER_TYPE_ADVANCED_ACTIONS = "advancedActions" as const;
export const OFFER_TYPE_SPELLS = "spells" as const;

export const UNIT_DESTROY_REASON_PARALYZE = "paralyze" as const;
export const UNIT_DESTROY_REASON_DISBANDED = "disbanded" as const;
export const UNIT_DESTROY_REASON_DOUBLE_WOUND = "double_wound" as const;
export const UNIT_DESTROY_REASON_POISON = "poison" as const;

export const UNDO_FAILED_NOTHING_TO_UNDO = "nothing_to_undo" as const;
export const UNDO_FAILED_CHECKPOINT_REACHED = "checkpoint_reached" as const;
export const UNDO_FAILED_NOT_YOUR_TURN = "not_your_turn" as const;

// === Client state sub-unions ===
// Back-compat aliases (prefer `MANA_TOKEN_SOURCE_*`)
export const CLIENT_MANA_TOKEN_SOURCE_DIE = MANA_TOKEN_SOURCE_DIE;
export const CLIENT_MANA_TOKEN_SOURCE_CARD = MANA_TOKEN_SOURCE_CARD;
export const CLIENT_MANA_TOKEN_SOURCE_SKILL = MANA_TOKEN_SOURCE_SKILL;
export const CLIENT_MANA_TOKEN_SOURCE_SITE = MANA_TOKEN_SOURCE_SITE;

// === Event sub-unions (targets) ===
export const WOUND_TARGET_HERO = "hero" as const;

// === Combat trigger types ===
export const COMBAT_TRIGGER_FORTIFIED_ASSAULT = "fortified_assault" as const;
export const COMBAT_TRIGGER_PROVOKE_RAMPAGING = "provoke_rampaging" as const;
export const COMBAT_TRIGGER_VOLUNTARY_EXPLORE = "voluntary_explore" as const;
export const COMBAT_TRIGGER_CHALLENGE = "challenge" as const;

export type CombatTriggerType =
  | typeof COMBAT_TRIGGER_FORTIFIED_ASSAULT
  | typeof COMBAT_TRIGGER_PROVOKE_RAMPAGING
  | typeof COMBAT_TRIGGER_VOLUNTARY_EXPLORE
  | typeof COMBAT_TRIGGER_CHALLENGE;

// === Reputation change reasons ===
export const REPUTATION_REASON_ASSAULT = "assault" as const;
export const REPUTATION_REASON_BURN_MONASTERY = "burn_monastery" as const;
export const REPUTATION_REASON_DEFEAT_RAMPAGING = "defeat_rampaging" as const;
export const REPUTATION_REASON_INTERACTION = "interaction" as const;
export const REPUTATION_REASON_PLUNDER_VILLAGE = "plunder_village" as const;
export const REPUTATION_REASON_DEFEAT_ENEMY = "defeat_enemy" as const;

export type ReputationChangeReason =
  | typeof REPUTATION_REASON_ASSAULT
  | typeof REPUTATION_REASON_BURN_MONASTERY
  | typeof REPUTATION_REASON_DEFEAT_RAMPAGING
  | typeof REPUTATION_REASON_INTERACTION
  | typeof REPUTATION_REASON_PLUNDER_VILLAGE
  | typeof REPUTATION_REASON_DEFEAT_ENEMY;

// === Combat exit reasons ===
export const COMBAT_EXIT_REASON_UNDO = "undo" as const;
export const COMBAT_EXIT_REASON_WITHDRAW = "withdraw" as const;
export const COMBAT_EXIT_REASON_FLED = "fled" as const;

export type CombatExitReason =
  | typeof COMBAT_EXIT_REASON_UNDO
  | typeof COMBAT_EXIT_REASON_WITHDRAW
  | typeof COMBAT_EXIT_REASON_FLED;

// === Tactic decision types (tactic-driven prompts/decisions) ===
export const TACTIC_DECISION_RETHINK = "rethink" as const;
export const TACTIC_DECISION_MANA_STEAL = "mana_steal" as const;
export const TACTIC_DECISION_PREPARATION = "preparation" as const;
export const TACTIC_DECISION_MIDNIGHT_MEDITATION = "midnight_meditation" as const;
export const TACTIC_DECISION_SPARING_POWER = "sparing_power" as const;

export type TacticDecisionType =
  | typeof TACTIC_DECISION_RETHINK
  | typeof TACTIC_DECISION_MANA_STEAL
  | typeof TACTIC_DECISION_PREPARATION
  | typeof TACTIC_DECISION_MIDNIGHT_MEDITATION
  | typeof TACTIC_DECISION_SPARING_POWER;

// === Tactic decision sub-unions ===
export const SPARING_POWER_CHOICE_STASH = "stash" as const;
export const SPARING_POWER_CHOICE_TAKE = "take" as const;

export type SparingPowerChoice =
  | typeof SPARING_POWER_CHOICE_STASH
  | typeof SPARING_POWER_CHOICE_TAKE;
