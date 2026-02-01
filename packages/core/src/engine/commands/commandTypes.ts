/**
 * Command type constants.
 *
 * These are NOT GameEvent types (those live in @mage-knight/shared).
 * They identify engine commands for the command stack / undo checkpoints.
 */

export const MOVE_COMMAND = "MOVE" as const;
export const REVEAL_TILE_COMMAND = "REVEAL_TILE" as const;
export const END_TURN_COMMAND = "END_TURN" as const;
export const EXPLORE_COMMAND = "EXPLORE" as const;
export const PLAY_CARD_COMMAND = "PLAY_CARD" as const;
export const PLAY_CARD_SIDEWAYS_COMMAND = "PLAY_CARD_SIDEWAYS" as const;
export const RESOLVE_CHOICE_COMMAND = "RESOLVE_CHOICE" as const;
export const REST_COMMAND = "REST" as const;

// Two-phase rest commands (new state-based resting)
export const DECLARE_REST_COMMAND = "DECLARE_REST" as const;
export const COMPLETE_REST_COMMAND = "COMPLETE_REST" as const;

// Round lifecycle commands
export const ANNOUNCE_END_OF_ROUND_COMMAND = "ANNOUNCE_END_OF_ROUND" as const;
export const END_ROUND_COMMAND = "END_ROUND" as const;

// Tactics selection command
export const SELECT_TACTIC_COMMAND = "SELECT_TACTIC" as const;

// Tactic effect commands
export const ACTIVATE_TACTIC_COMMAND = "ACTIVATE_TACTIC" as const;
export const RESOLVE_TACTIC_DECISION_COMMAND = "RESOLVE_TACTIC_DECISION" as const;
export const REROLL_SOURCE_DICE_COMMAND = "REROLL_SOURCE_DICE" as const;

// Conquest commands
export const CONQUER_SITE_COMMAND = "CONQUER_SITE" as const;

// Adventure site commands
export const ENTER_SITE_COMMAND = "ENTER_SITE" as const;

// Challenge rampaging command
export const CHALLENGE_RAMPAGING_COMMAND = "CHALLENGE_RAMPAGING" as const;

// Reward selection command
export const SELECT_REWARD_COMMAND = "SELECT_REWARD" as const;

// Magical Glade command
export const RESOLVE_GLADE_WOUND_COMMAND = "RESOLVE_GLADE_WOUND" as const;

// Deep Mine command
export const RESOLVE_DEEP_MINE_COMMAND = "RESOLVE_DEEP_MINE" as const;

// Discard as cost command
export const RESOLVE_DISCARD_COMMAND = "RESOLVE_DISCARD" as const;

// Burn monastery command
export const BURN_MONASTERY_COMMAND = "BURN_MONASTERY" as const;

// Plunder village command
export const PLUNDER_VILLAGE_COMMAND = "PLUNDER_VILLAGE" as const;

// Cooperative assault commands
export const PROPOSE_COOPERATIVE_ASSAULT_COMMAND = "PROPOSE_COOPERATIVE_ASSAULT" as const;
export const RESPOND_TO_COOPERATIVE_PROPOSAL_COMMAND = "RESPOND_TO_COOPERATIVE_PROPOSAL" as const;
export const CANCEL_COOPERATIVE_PROPOSAL_COMMAND = "CANCEL_COOPERATIVE_PROPOSAL" as const;

// Skill usage command
export const USE_SKILL_COMMAND = "USE_SKILL" as const;

// Reserved / upcoming command types used by undo checkpointing.
export const DRAW_ENEMY_COMMAND = "DRAW_ENEMY" as const;
export const DRAW_CARD_COMMAND = "DRAW_CARD" as const;
export const ROLL_DIE_COMMAND = "ROLL_DIE" as const;


