/**
 * Validation error code constants.
 *
 * These are used for programmatic handling of validation failures (UI, analytics, etc.).
 * Keep them centralized to avoid drift as we add more validators.
 */

export const NOT_YOUR_TURN = "NOT_YOUR_TURN" as const;
export const WRONG_PHASE = "WRONG_PHASE" as const;
export const IN_COMBAT = "IN_COMBAT" as const;
export const PLAYER_NOT_FOUND = "PLAYER_NOT_FOUND" as const;
export const ALREADY_ACTED = "ALREADY_ACTED" as const;
export const ALREADY_MOVED = "ALREADY_MOVED" as const;

export const NOT_ON_MAP = "NOT_ON_MAP" as const;
// NOTE: named `*_CODE` to avoid confusion with the shared `INVALID_ACTION` GameEvent type.
export const INVALID_ACTION_CODE = "INVALID_ACTION" as const;
export const NOT_ADJACENT = "NOT_ADJACENT" as const;
export const HEX_NOT_FOUND = "HEX_NOT_FOUND" as const;
export const IMPASSABLE = "IMPASSABLE" as const;
export const NOT_ENOUGH_MOVE_POINTS = "NOT_ENOUGH_MOVE_POINTS" as const;

// Explore validation codes
export const NOT_ON_EDGE = "NOT_ON_EDGE" as const;
export const INVALID_DIRECTION = "INVALID_DIRECTION" as const;
export const NO_TILES_AVAILABLE = "NO_TILES_AVAILABLE" as const;
export const SLOT_ALREADY_FILLED = "SLOT_ALREADY_FILLED" as const;
export const INVALID_WEDGE_DIRECTION = "INVALID_WEDGE_DIRECTION" as const;
export const CORE_TILE_ON_COASTLINE = "CORE_TILE_ON_COASTLINE" as const;
export const COLUMN_LIMIT_EXCEEDED = "COLUMN_LIMIT_EXCEEDED" as const;

// Card play validation codes
export const CARD_NOT_IN_HAND = "CARD_NOT_IN_HAND" as const;
export const CARD_NOT_FOUND = "CARD_NOT_FOUND" as const;
export const CANNOT_PLAY_WOUND = "CANNOT_PLAY_WOUND" as const;
export const CANNOT_PLAY_HEALING_IN_COMBAT = "CANNOT_PLAY_HEALING_IN_COMBAT" as const;
export const CARD_NOT_PLAYABLE = "CARD_NOT_PLAYABLE" as const;
export const CARD_NOT_PLAYABLE_IN_PHASE = "CARD_NOT_PLAYABLE_IN_PHASE" as const;
export const CARD_EFFECT_NOT_RESOLVABLE = "CARD_EFFECT_NOT_RESOLVABLE" as const;
export const CHOICE_REQUIRED_CODE = "CHOICE_REQUIRED" as const;

// Choice resolution validation codes
export const NO_PENDING_CHOICE = "NO_PENDING_CHOICE" as const;
export const INVALID_CHOICE_INDEX = "INVALID_CHOICE_INDEX" as const;
export const CHOICE_PENDING = "CHOICE_PENDING" as const;
export const TACTIC_DECISION_PENDING = "TACTIC_DECISION_PENDING" as const;

// Sideways play validation codes
export const SIDEWAYS_CHOICE_REQUIRED = "SIDEWAYS_CHOICE_REQUIRED" as const;

// Rest validation codes
export const REST_NO_DISCARD = "REST_NO_DISCARD" as const;
export const REST_NEEDS_NON_WOUND = "REST_NEEDS_NON_WOUND" as const;
export const CANNOT_REST = "CANNOT_REST" as const;
export const STANDARD_REST_ONE_NON_WOUND = "STANDARD_REST_ONE_NON_WOUND" as const;
export const SLOW_RECOVERY_INVALID = "SLOW_RECOVERY_INVALID" as const;
export const SLOW_RECOVERY_ONE_WOUND = "SLOW_RECOVERY_ONE_WOUND" as const;
export const SLOW_RECOVERY_MUST_BE_WOUND = "SLOW_RECOVERY_MUST_BE_WOUND" as const;

// Two-phase rest validation codes (new state-based resting)
export const CANNOT_MOVE_WHILE_RESTING = "CANNOT_MOVE_WHILE_RESTING" as const;
export const CANNOT_FIGHT_WHILE_RESTING = "CANNOT_FIGHT_WHILE_RESTING" as const;
export const CANNOT_INTERACT_WHILE_RESTING = "CANNOT_INTERACT_WHILE_RESTING" as const;
export const CANNOT_ENTER_SITE_WHILE_RESTING = "CANNOT_ENTER_SITE_WHILE_RESTING" as const;
export const MUST_COMPLETE_REST = "MUST_COMPLETE_REST" as const;
export const ALREADY_RESTING = "ALREADY_RESTING" as const;
export const NOT_RESTING = "NOT_RESTING" as const;
export const SLOW_RECOVERY_NO_DISCARD_ALLOWED = "SLOW_RECOVERY_NO_DISCARD_ALLOWED" as const;
export const CANNOT_REST_AFTER_MOVING = "CANNOT_REST_AFTER_MOVING" as const;

// Mana validation codes
export const DIE_ALREADY_USED = "DIE_ALREADY_USED" as const;
export const DIE_NOT_FOUND = "DIE_NOT_FOUND" as const;
export const DIE_DEPLETED = "DIE_DEPLETED" as const;
export const DIE_COLOR_MISMATCH = "DIE_COLOR_MISMATCH" as const;
export const DIE_TAKEN = "DIE_TAKEN" as const;
export const NO_CRYSTAL = "NO_CRYSTAL" as const;
export const NO_MANA_TOKEN = "NO_MANA_TOKEN" as const;
export const INVALID_MANA_SOURCE = "INVALID_MANA_SOURCE" as const;
export const MANA_COLOR_MISMATCH = "MANA_COLOR_MISMATCH" as const;
export const BLACK_MANA_INVALID = "BLACK_MANA_INVALID" as const;
export const BLACK_MANA_DAY = "BLACK_MANA_DAY" as const;
export const GOLD_MANA_NIGHT = "GOLD_MANA_NIGHT" as const;
export const POWERED_WITHOUT_MANA = "POWERED_WITHOUT_MANA" as const;
export const SPELL_REQUIRES_TWO_MANA = "SPELL_REQUIRES_TWO_MANA" as const;
export const SPELL_BASIC_REQUIRES_MANA = "SPELL_BASIC_REQUIRES_MANA" as const;
export const MANA_CANNOT_POWER_SPELLS = "MANA_CANNOT_POWER_SPELLS" as const;

// Unit recruitment mana payment codes
export const RECRUIT_REQUIRES_MANA = "RECRUIT_REQUIRES_MANA" as const;
export const RECRUIT_REQUIRES_MANA_TOKEN_COLOR = "RECRUIT_REQUIRES_MANA_TOKEN_COLOR" as const;

// Unit maintenance codes
export const UNIT_MAINTENANCE_PENDING = "UNIT_MAINTENANCE_PENDING" as const;
export const NO_MAINTENANCE_PENDING = "NO_MAINTENANCE_PENDING" as const;
export const UNIT_NOT_IN_MAINTENANCE = "UNIT_NOT_IN_MAINTENANCE" as const;
export const MAINTENANCE_REQUIRES_CRYSTAL = "MAINTENANCE_REQUIRES_CRYSTAL" as const;
export const MAINTENANCE_REQUIRES_TOKEN_COLOR = "MAINTENANCE_REQUIRES_TOKEN_COLOR" as const;

// Combat validation codes
export const ALREADY_IN_COMBAT = "ALREADY_IN_COMBAT" as const;
export const NOT_IN_COMBAT = "NOT_IN_COMBAT" as const;
export const WRONG_COMBAT_PHASE = "WRONG_COMBAT_PHASE" as const;
export const ENEMY_NOT_FOUND = "ENEMY_NOT_FOUND" as const;
export const ENEMY_ALREADY_BLOCKED = "ENEMY_ALREADY_BLOCKED" as const;
export const ENEMY_ALREADY_DEFEATED = "ENEMY_ALREADY_DEFEATED" as const;
export const INVALID_ATTACK_TYPE = "INVALID_ATTACK_TYPE" as const;
export const DAMAGE_NOT_ASSIGNED = "DAMAGE_NOT_ASSIGNED" as const;
export const FORTIFIED_NEEDS_SIEGE = "FORTIFIED_NEEDS_SIEGE" as const;
export const NO_SIEGE_ATTACK_ACCUMULATED = "NO_SIEGE_ATTACK_ACCUMULATED" as const;
export const RANGED_ATTACK_ALL_FORTIFIED = "RANGED_ATTACK_ALL_FORTIFIED" as const;
export const ALREADY_COMBATTED = "ALREADY_COMBATTED" as const;
// Incremental attack assignment validation codes
export const INSUFFICIENT_ATTACK = "INSUFFICIENT_ATTACK" as const;
export const NOTHING_TO_UNASSIGN = "NOTHING_TO_UNASSIGN" as const;
export const INVALID_ASSIGNMENT_AMOUNT = "INVALID_ASSIGNMENT_AMOUNT" as const;
// Incremental block assignment validation codes
export const INSUFFICIENT_BLOCK = "INSUFFICIENT_BLOCK" as const;
export const NOTHING_TO_UNASSIGN_BLOCK = "NOTHING_TO_UNASSIGN_BLOCK" as const;
// Summon ability validation codes
export const SUMMONER_HIDDEN = "SUMMONER_HIDDEN" as const;
// Assassination ability validation codes
export const ASSASSINATION_REQUIRES_HERO_TARGET = "ASSASSINATION_REQUIRES_HERO_TARGET" as const;
// Damage redirect (Taunt) validation codes
export const DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET = "DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET" as const;
// Into the Heat: cannot assign damage to units
export const UNITS_CANNOT_ABSORB_DAMAGE = "UNITS_CANNOT_ABSORB_DAMAGE" as const;
// Multi-attack validation codes
export const INVALID_ATTACK_INDEX = "INVALID_ATTACK_INDEX" as const;
export const ATTACK_ALREADY_BLOCKED = "ATTACK_ALREADY_BLOCKED" as const;
export const ATTACK_DAMAGE_ALREADY_ASSIGNED = "ATTACK_DAMAGE_ALREADY_ASSIGNED" as const;
// Cumbersome ability validation codes
export const CUMBERSOME_NOT_ACTIVE = "CUMBERSOME_NOT_ACTIVE" as const;
export const CUMBERSOME_INVALID_AMOUNT = "CUMBERSOME_INVALID_AMOUNT" as const;
// Move-to-attack conversion validation codes (Agility card)
export const NO_CONVERSION_MODIFIER = "NO_CONVERSION_MODIFIER" as const;
export const CONVERSION_INVALID_AMOUNT = "CONVERSION_INVALID_AMOUNT" as const;

// Unit validation codes
export const NO_COMMAND_SLOTS = "NO_COMMAND_SLOTS" as const;
export const INSUFFICIENT_INFLUENCE = "INSUFFICIENT_INFLUENCE" as const;
export const UNIT_NOT_FOUND = "UNIT_NOT_FOUND" as const;
export const UNIT_NOT_READY = "UNIT_NOT_READY" as const;
export const UNIT_IS_WOUNDED = "UNIT_IS_WOUNDED" as const;
export const UNIT_WOUNDED_NO_DAMAGE = "UNIT_WOUNDED_NO_DAMAGE" as const;
export const UNIT_USED_RESISTANCE = "UNIT_USED_RESISTANCE" as const;
export const INVALID_ABILITY_INDEX = "INVALID_ABILITY_INDEX" as const;
export const WRONG_PHASE_FOR_ABILITY = "WRONG_PHASE_FOR_ABILITY" as const;
export const NON_COMBAT_ABILITY = "NON_COMBAT_ABILITY" as const;
export const PASSIVE_ABILITY = "PASSIVE_ABILITY" as const;
export const SIEGE_REQUIRED = "SIEGE_REQUIRED" as const;
export const UNIT_ABILITY_REQUIRES_MANA = "UNIT_ABILITY_REQUIRES_MANA" as const;
export const UNIT_ABILITY_MANA_UNAVAILABLE = "UNIT_ABILITY_MANA_UNAVAILABLE" as const;
// Reputation recruitment restriction
export const REPUTATION_TOO_LOW_TO_RECRUIT = "REPUTATION_TOO_LOW_TO_RECRUIT" as const;
// Heroes unit special rules
export const HEROES_THUGS_EXCLUSION = "HEROES_THUGS_EXCLUSION" as const;
export const HEROES_ASSAULT_INFLUENCE_NOT_PAID = "HEROES_ASSAULT_INFLUENCE_NOT_PAID" as const;
export const HEROES_ASSAULT_INFLUENCE_ALREADY_PAID = "HEROES_ASSAULT_INFLUENCE_ALREADY_PAID" as const;
export const HEROES_ASSAULT_NOT_APPLICABLE = "HEROES_ASSAULT_NOT_APPLICABLE" as const;
// Thugs unit special rules
export const THUGS_DAMAGE_INFLUENCE_ALREADY_PAID = "THUGS_DAMAGE_INFLUENCE_ALREADY_PAID" as const;
export const THUGS_DAMAGE_NOT_THUGS_UNIT = "THUGS_DAMAGE_NOT_THUGS_UNIT" as const;
export const THUGS_DAMAGE_INFLUENCE_NOT_PAID = "THUGS_DAMAGE_INFLUENCE_NOT_PAID" as const;

// Site interaction validation codes
export const NO_SITE = "NO_SITE" as const;
export const NOT_INHABITED = "NOT_INHABITED" as const;
export const SITE_NOT_CONQUERED = "SITE_NOT_CONQUERED" as const;
export const NOT_YOUR_KEEP = "NOT_YOUR_KEEP" as const;
export const MONASTERY_BURNED = "MONASTERY_BURNED" as const;
export const NOT_AT_MONASTERY = "NOT_AT_MONASTERY" as const;
export const NOT_AT_VILLAGE = "NOT_AT_VILLAGE" as const;
export const ALREADY_PLUNDERED = "ALREADY_PLUNDERED" as const;
export const NO_HEALING_HERE = "NO_HEALING_HERE" as const;
export const CANNOT_RECRUIT_HERE = "CANNOT_RECRUIT_HERE" as const;
export const UNIT_TYPE_MISMATCH = "UNIT_TYPE_MISMATCH" as const;

// Adventure site validation codes
export const NOT_ADVENTURE_SITE = "NOT_ADVENTURE_SITE" as const;
export const SITE_ALREADY_CONQUERED = "SITE_ALREADY_CONQUERED" as const;
export const NO_ENEMIES_AT_SITE = "NO_ENEMIES_AT_SITE" as const;

// Dungeon/Tomb combat restriction codes
export const UNITS_NOT_ALLOWED = "UNITS_NOT_ALLOWED" as const;
export const GOLD_MANA_NOT_ALLOWED = "GOLD_MANA_NOT_ALLOWED" as const;

// Round end validation codes
export const DECK_NOT_EMPTY = "DECK_NOT_EMPTY" as const;
export const ALREADY_ANNOUNCED = "ALREADY_ANNOUNCED" as const;
export const MUST_ANNOUNCE_END_OF_ROUND = "MUST_ANNOUNCE_END_OF_ROUND" as const;

// Minimum turn validation codes
export const MUST_PLAY_OR_DISCARD_CARD = "MUST_PLAY_OR_DISCARD_CARD" as const;

// Rampaging enemy validation codes
export const RAMPAGING_ENEMY_BLOCKS = "RAMPAGING_ENEMY_BLOCKS" as const;

// Challenge rampaging validation codes
export const NOT_ADJACENT_TO_TARGET = "NOT_ADJACENT_TO_TARGET" as const;
export const TARGET_NOT_RAMPAGING = "TARGET_NOT_RAMPAGING" as const;

// Scenario validation codes
export const CANNOT_ENTER_CITY = "CANNOT_ENTER_CITY" as const;
export const TERRAIN_PROHIBITED = "TERRAIN_PROHIBITED" as const;

// Reward selection validation codes
export const NO_PENDING_REWARDS = "NO_PENDING_REWARDS" as const;
export const INVALID_REWARD_INDEX = "INVALID_REWARD_INDEX" as const;
export const CARD_NOT_IN_OFFER = "CARD_NOT_IN_OFFER" as const;
export const PENDING_REWARDS_NOT_RESOLVED = "PENDING_REWARDS_NOT_RESOLVED" as const;

// Magical Glade validation codes
export const GLADE_WOUND_CHOICE_REQUIRED = "GLADE_WOUND_CHOICE_REQUIRED" as const;
export const GLADE_WOUND_NO_WOUNDS_IN_HAND = "GLADE_WOUND_NO_WOUNDS_IN_HAND" as const;
export const GLADE_WOUND_NO_WOUNDS_IN_DISCARD = "GLADE_WOUND_NO_WOUNDS_IN_DISCARD" as const;

// Deep Mine validation codes
export const DEEP_MINE_CHOICE_REQUIRED = "DEEP_MINE_CHOICE_REQUIRED" as const;
export const DEEP_MINE_INVALID_COLOR = "DEEP_MINE_INVALID_COLOR" as const;

// Crystal Joy reclaim validation codes
export const CRYSTAL_JOY_RECLAIM_REQUIRED = "CRYSTAL_JOY_RECLAIM_REQUIRED" as const;
export const CRYSTAL_JOY_CARD_NOT_IN_DISCARD = "CRYSTAL_JOY_CARD_NOT_IN_DISCARD" as const;
export const CRYSTAL_JOY_CARD_NOT_ELIGIBLE = "CRYSTAL_JOY_CARD_NOT_ELIGIBLE" as const;

// Steady Tempo deck placement validation codes
export const STEADY_TEMPO_PLACEMENT_REQUIRED = "STEADY_TEMPO_PLACEMENT_REQUIRED" as const;
export const STEADY_TEMPO_CANNOT_PLACE_BASIC = "STEADY_TEMPO_CANNOT_PLACE_BASIC" as const;

// Banner of Protection wound removal validation codes
export const BANNER_PROTECTION_CHOICE_REQUIRED = "BANNER_PROTECTION_CHOICE_REQUIRED" as const;

// Discard as cost validation codes
export const DISCARD_COST_REQUIRED = "DISCARD_COST_REQUIRED" as const;
export const DISCARD_COST_INVALID_COUNT = "DISCARD_COST_INVALID_COUNT" as const;
export const DISCARD_COST_CARD_NOT_ELIGIBLE = "DISCARD_COST_CARD_NOT_ELIGIBLE" as const;
export const DISCARD_COST_CANNOT_SKIP = "DISCARD_COST_CANNOT_SKIP" as const;

// Discard for attack validation codes (Sword of Justice)
export const DISCARD_FOR_ATTACK_REQUIRED = "DISCARD_FOR_ATTACK_REQUIRED" as const;
export const DISCARD_FOR_ATTACK_CARD_NOT_ELIGIBLE = "DISCARD_FOR_ATTACK_CARD_NOT_ELIGIBLE" as const;

// Discard for crystal validation codes (Savage Harvesting)
export const DISCARD_FOR_CRYSTAL_REQUIRED = "DISCARD_FOR_CRYSTAL_REQUIRED" as const;
export const DISCARD_FOR_CRYSTAL_CARD_NOT_ELIGIBLE = "DISCARD_FOR_CRYSTAL_CARD_NOT_ELIGIBLE" as const;
export const DISCARD_FOR_CRYSTAL_CANNOT_SKIP = "DISCARD_FOR_CRYSTAL_CANNOT_SKIP" as const;
export const ARTIFACT_CRYSTAL_COLOR_REQUIRED = "ARTIFACT_CRYSTAL_COLOR_REQUIRED" as const;
export const ARTIFACT_CRYSTAL_INVALID_COLOR = "ARTIFACT_CRYSTAL_INVALID_COLOR" as const;

// Decompose validation codes
export const DECOMPOSE_REQUIRED = "DECOMPOSE_REQUIRED" as const;
export const DECOMPOSE_CARD_NOT_ELIGIBLE = "DECOMPOSE_CARD_NOT_ELIGIBLE" as const;

// Spell purchase validation codes
export const SPELL_NOT_IN_OFFER = "SPELL_NOT_IN_OFFER" as const;
export const NOT_AT_SPELL_SITE = "NOT_AT_SPELL_SITE" as const;
export const INSUFFICIENT_INFLUENCE_FOR_SPELL = "INSUFFICIENT_INFLUENCE_FOR_SPELL" as const;

// Advanced action learning validation codes
export const AA_NOT_IN_OFFER = "AA_NOT_IN_OFFER" as const;
export const NOT_AT_AA_SITE = "NOT_AT_AA_SITE" as const;
export const AA_NOT_IN_MONASTERY_OFFER = "AA_NOT_IN_MONASTERY_OFFER" as const;
export const INSUFFICIENT_INFLUENCE_FOR_AA = "INSUFFICIENT_INFLUENCE_FOR_AA" as const;
export const NOT_IN_LEVEL_UP_CONTEXT = "NOT_IN_LEVEL_UP_CONTEXT" as const;

// Level up rewards validation codes
export const LEVEL_UP_REWARDS_PENDING = "LEVEL_UP_REWARDS_PENDING" as const;
export const NO_PENDING_LEVEL_UP_REWARDS = "NO_PENDING_LEVEL_UP_REWARDS" as const;
export const INVALID_LEVEL_UP_LEVEL = "INVALID_LEVEL_UP_LEVEL" as const;
export const SKILL_NOT_AVAILABLE = "SKILL_NOT_AVAILABLE" as const;
export const SKILL_ALREADY_OWNED = "SKILL_ALREADY_OWNED" as const;

// Debug validation codes
export const DEV_MODE_REQUIRED = "DEV_MODE_REQUIRED" as const;
export const NO_PENDING_LEVEL_UPS = "NO_PENDING_LEVEL_UPS" as const;

// Cooperative assault validation codes
export const NOT_ADJACENT_TO_CITY = "NOT_ADJACENT_TO_CITY" as const;
export const SCENARIO_END_FULFILLED = "SCENARIO_END_FULFILLED" as const;
export const OTHER_HERO_ON_SPACE = "OTHER_HERO_ON_SPACE" as const;
export const INVITEE_NOT_ADJACENT = "INVITEE_NOT_ADJACENT" as const;
export const INVITEE_TOKEN_FLIPPED = "INVITEE_TOKEN_FLIPPED" as const;
export const INVITEE_NO_CARDS = "INVITEE_NO_CARDS" as const;
export const INVALID_ENEMY_DISTRIBUTION = "INVALID_ENEMY_DISTRIBUTION" as const;
export const NO_PENDING_PROPOSAL = "NO_PENDING_PROPOSAL" as const;
export const NOT_AN_INVITEE = "NOT_AN_INVITEE" as const;
export const ALREADY_RESPONDED = "ALREADY_RESPONDED" as const;
export const NOT_PROPOSAL_INITIATOR = "NOT_PROPOSAL_INITIATOR" as const;
export const CITY_NOT_FOUND = "CITY_NOT_FOUND" as const;
export const MUST_INVITE_AT_LEAST_ONE = "MUST_INVITE_AT_LEAST_ONE" as const;
export const INITIATOR_TOKEN_FLIPPED = "INITIATOR_TOKEN_FLIPPED" as const;

// Terrain cost reduction validation codes (Druidic Paths)
export const TERRAIN_COST_REDUCTION_REQUIRED = "TERRAIN_COST_REDUCTION_REQUIRED" as const;
export const TERRAIN_COST_REDUCTION_INVALID_COORDINATE = "TERRAIN_COST_REDUCTION_INVALID_COORDINATE" as const;
export const TERRAIN_COST_REDUCTION_INVALID_TERRAIN = "TERRAIN_COST_REDUCTION_INVALID_TERRAIN" as const;

// Banner validation codes
export const BANNER_NOT_IN_HAND = "BANNER_NOT_IN_HAND" as const;
export const BANNER_NOT_A_BANNER = "BANNER_NOT_A_BANNER" as const;
export const BANNER_TARGET_UNIT_NOT_FOUND = "BANNER_TARGET_UNIT_NOT_FOUND" as const;
export const BANNER_NO_UNITS = "BANNER_NO_UNITS" as const;
// Banner of Fear validation codes
export const BANNER_FEAR_NOT_IN_COMBAT = "BANNER_FEAR_NOT_IN_COMBAT" as const;
export const BANNER_FEAR_NOT_BLOCK_PHASE = "BANNER_FEAR_NOT_BLOCK_PHASE" as const;
export const BANNER_FEAR_UNIT_NOT_FOUND = "BANNER_FEAR_UNIT_NOT_FOUND" as const;
export const BANNER_FEAR_NO_BANNER = "BANNER_FEAR_NO_BANNER" as const;
export const BANNER_FEAR_UNIT_NOT_READY = "BANNER_FEAR_UNIT_NOT_READY" as const;
export const BANNER_FEAR_UNIT_WOUNDED = "BANNER_FEAR_UNIT_WOUNDED" as const;
export const BANNER_FEAR_ENEMY_NOT_FOUND = "BANNER_FEAR_ENEMY_NOT_FOUND" as const;
export const BANNER_FEAR_ENEMY_ARCANE_IMMUNE = "BANNER_FEAR_ENEMY_ARCANE_IMMUNE" as const;
export const BANNER_FEAR_ATTACK_ALREADY_CANCELLED = "BANNER_FEAR_ATTACK_ALREADY_CANCELLED" as const;
export const BANNER_FEAR_INVALID_ATTACK_INDEX = "BANNER_FEAR_INVALID_ATTACK_INDEX" as const;

// Time Bending chain prevention validation codes
export const TIME_BENDING_CHAIN_PREVENTED = "TIME_BENDING_CHAIN_PREVENTED" as const;

// Skill usage validation codes
export const SKILL_NOT_LEARNED = "SKILL_NOT_LEARNED" as const;
export const SKILL_NOT_FOUND = "SKILL_NOT_FOUND" as const;
export const SKILL_ON_COOLDOWN = "SKILL_ON_COOLDOWN" as const;
export const SKILL_REQUIRES_NOT_IN_COMBAT = "SKILL_REQUIRES_NOT_IN_COMBAT" as const;
export const SKILL_REQUIRES_WOUND_IN_HAND = "SKILL_REQUIRES_WOUND_IN_HAND" as const;
export const SKILL_REQUIRES_INTERACTION = "SKILL_REQUIRES_INTERACTION" as const;
export const SKILL_NOT_IN_CENTER = "SKILL_NOT_IN_CENTER" as const;
export const SKILL_REQUIRES_MANA = "SKILL_REQUIRES_MANA" as const;
export const SKILL_CONFLICTS_WITH_ACTIVE = "SKILL_CONFLICTS_WITH_ACTIVE" as const;
export const CANNOT_RETURN_OWN_SKILL = "CANNOT_RETURN_OWN_SKILL" as const;

export type ValidationErrorCode =
  | typeof NOT_YOUR_TURN
  | typeof WRONG_PHASE
  | typeof IN_COMBAT
  | typeof PLAYER_NOT_FOUND
  | typeof ALREADY_ACTED
  | typeof ALREADY_MOVED
  | typeof NOT_ON_MAP
  | typeof INVALID_ACTION_CODE
  | typeof NOT_ADJACENT
  | typeof HEX_NOT_FOUND
  | typeof IMPASSABLE
  | typeof NOT_ENOUGH_MOVE_POINTS
  | typeof NOT_ON_EDGE
  | typeof INVALID_DIRECTION
  | typeof NO_TILES_AVAILABLE
  | typeof SLOT_ALREADY_FILLED
  | typeof INVALID_WEDGE_DIRECTION
  | typeof CORE_TILE_ON_COASTLINE
  | typeof COLUMN_LIMIT_EXCEEDED
  | typeof CARD_NOT_IN_HAND
  | typeof CARD_NOT_FOUND
  | typeof CANNOT_PLAY_WOUND
  | typeof CANNOT_PLAY_HEALING_IN_COMBAT
  | typeof CARD_NOT_PLAYABLE
  | typeof CARD_NOT_PLAYABLE_IN_PHASE
  | typeof CARD_EFFECT_NOT_RESOLVABLE
  | typeof CHOICE_REQUIRED_CODE
  | typeof NO_PENDING_CHOICE
  | typeof INVALID_CHOICE_INDEX
  | typeof CHOICE_PENDING
  | typeof TACTIC_DECISION_PENDING
  | typeof SIDEWAYS_CHOICE_REQUIRED
  // Rest validation
  | typeof REST_NO_DISCARD
  | typeof REST_NEEDS_NON_WOUND
  | typeof CANNOT_REST
  | typeof STANDARD_REST_ONE_NON_WOUND
  | typeof SLOW_RECOVERY_INVALID
  | typeof SLOW_RECOVERY_ONE_WOUND
  | typeof SLOW_RECOVERY_MUST_BE_WOUND
  // Two-phase rest validation (new state-based resting)
  | typeof CANNOT_MOVE_WHILE_RESTING
  | typeof CANNOT_FIGHT_WHILE_RESTING
  | typeof CANNOT_INTERACT_WHILE_RESTING
  | typeof CANNOT_ENTER_SITE_WHILE_RESTING
  | typeof MUST_COMPLETE_REST
  | typeof ALREADY_RESTING
  | typeof NOT_RESTING
  | typeof SLOW_RECOVERY_NO_DISCARD_ALLOWED
  | typeof CANNOT_REST_AFTER_MOVING
  // Mana validation
  | typeof DIE_ALREADY_USED
  | typeof DIE_NOT_FOUND
  | typeof DIE_DEPLETED
  | typeof DIE_COLOR_MISMATCH
  | typeof DIE_TAKEN
  | typeof NO_CRYSTAL
  | typeof NO_MANA_TOKEN
  | typeof INVALID_MANA_SOURCE
  | typeof MANA_COLOR_MISMATCH
  | typeof BLACK_MANA_INVALID
  | typeof BLACK_MANA_DAY
  | typeof GOLD_MANA_NIGHT
  | typeof POWERED_WITHOUT_MANA
  | typeof SPELL_REQUIRES_TWO_MANA
  | typeof SPELL_BASIC_REQUIRES_MANA
  | typeof MANA_CANNOT_POWER_SPELLS
  // Combat validation
  | typeof ALREADY_IN_COMBAT
  | typeof NOT_IN_COMBAT
  | typeof WRONG_COMBAT_PHASE
  | typeof ENEMY_NOT_FOUND
  | typeof ENEMY_ALREADY_BLOCKED
  | typeof ENEMY_ALREADY_DEFEATED
  | typeof INVALID_ATTACK_TYPE
  | typeof DAMAGE_NOT_ASSIGNED
  | typeof FORTIFIED_NEEDS_SIEGE
  | typeof NO_SIEGE_ATTACK_ACCUMULATED
  | typeof RANGED_ATTACK_ALL_FORTIFIED
  | typeof ALREADY_COMBATTED
  | typeof INSUFFICIENT_ATTACK
  | typeof NOTHING_TO_UNASSIGN
  | typeof INVALID_ASSIGNMENT_AMOUNT
  | typeof INSUFFICIENT_BLOCK
  | typeof NOTHING_TO_UNASSIGN_BLOCK
  | typeof SUMMONER_HIDDEN
  | typeof ASSASSINATION_REQUIRES_HERO_TARGET
  | typeof DAMAGE_REDIRECT_REQUIRES_UNIT_TARGET
  | typeof UNITS_CANNOT_ABSORB_DAMAGE
  | typeof INVALID_ATTACK_INDEX
  | typeof ATTACK_ALREADY_BLOCKED
  | typeof ATTACK_DAMAGE_ALREADY_ASSIGNED
  | typeof CUMBERSOME_NOT_ACTIVE
  | typeof CUMBERSOME_INVALID_AMOUNT
  | typeof NO_CONVERSION_MODIFIER
  | typeof CONVERSION_INVALID_AMOUNT
  // Unit validation
  | typeof NO_COMMAND_SLOTS
  | typeof INSUFFICIENT_INFLUENCE
  | typeof UNIT_NOT_FOUND
  | typeof UNIT_NOT_READY
  | typeof UNIT_IS_WOUNDED
  | typeof UNIT_WOUNDED_NO_DAMAGE
  | typeof UNIT_USED_RESISTANCE
  | typeof INVALID_ABILITY_INDEX
  | typeof WRONG_PHASE_FOR_ABILITY
  | typeof NON_COMBAT_ABILITY
  | typeof PASSIVE_ABILITY
  | typeof SIEGE_REQUIRED
  | typeof UNIT_ABILITY_REQUIRES_MANA
  | typeof UNIT_ABILITY_MANA_UNAVAILABLE
  // Reputation recruitment restriction
  | typeof REPUTATION_TOO_LOW_TO_RECRUIT
  // Heroes unit special rules
  | typeof HEROES_THUGS_EXCLUSION
  | typeof HEROES_ASSAULT_INFLUENCE_NOT_PAID
  | typeof HEROES_ASSAULT_INFLUENCE_ALREADY_PAID
  | typeof HEROES_ASSAULT_NOT_APPLICABLE
  // Thugs unit special rules
  | typeof THUGS_DAMAGE_INFLUENCE_ALREADY_PAID
  | typeof THUGS_DAMAGE_NOT_THUGS_UNIT
  | typeof THUGS_DAMAGE_INFLUENCE_NOT_PAID
  // Site interaction validation
  | typeof NO_SITE
  | typeof NOT_INHABITED
  | typeof SITE_NOT_CONQUERED
  | typeof NOT_YOUR_KEEP
  | typeof MONASTERY_BURNED
  | typeof NOT_AT_MONASTERY
  | typeof NOT_AT_VILLAGE
  | typeof ALREADY_PLUNDERED
  | typeof NO_HEALING_HERE
  | typeof CANNOT_RECRUIT_HERE
  | typeof UNIT_TYPE_MISMATCH
  // Adventure site validation
  | typeof NOT_ADVENTURE_SITE
  | typeof SITE_ALREADY_CONQUERED
  | typeof NO_ENEMIES_AT_SITE
  // Dungeon/Tomb combat restriction
  | typeof UNITS_NOT_ALLOWED
  | typeof GOLD_MANA_NOT_ALLOWED
  // Round end validation
  | typeof DECK_NOT_EMPTY
  | typeof ALREADY_ANNOUNCED
  | typeof MUST_ANNOUNCE_END_OF_ROUND
  // Minimum turn validation
  | typeof MUST_PLAY_OR_DISCARD_CARD
  // Rampaging enemy validation
  | typeof RAMPAGING_ENEMY_BLOCKS
  // Challenge rampaging validation
  | typeof NOT_ADJACENT_TO_TARGET
  | typeof TARGET_NOT_RAMPAGING
  // Scenario validation
  | typeof CANNOT_ENTER_CITY
  | typeof TERRAIN_PROHIBITED
  // Reward selection validation
  | typeof NO_PENDING_REWARDS
  | typeof INVALID_REWARD_INDEX
  | typeof CARD_NOT_IN_OFFER
  | typeof PENDING_REWARDS_NOT_RESOLVED
  // Magical Glade validation
  | typeof GLADE_WOUND_CHOICE_REQUIRED
  | typeof GLADE_WOUND_NO_WOUNDS_IN_HAND
  | typeof GLADE_WOUND_NO_WOUNDS_IN_DISCARD
  // Deep Mine validation
  | typeof DEEP_MINE_CHOICE_REQUIRED
  | typeof DEEP_MINE_INVALID_COLOR
  // Crystal Joy reclaim validation
  | typeof CRYSTAL_JOY_RECLAIM_REQUIRED
  | typeof CRYSTAL_JOY_CARD_NOT_IN_DISCARD
  | typeof CRYSTAL_JOY_CARD_NOT_ELIGIBLE
  // Steady Tempo deck placement validation
  | typeof STEADY_TEMPO_PLACEMENT_REQUIRED
  | typeof STEADY_TEMPO_CANNOT_PLACE_BASIC
  // Banner of Protection wound removal validation
  | typeof BANNER_PROTECTION_CHOICE_REQUIRED
  // Discard as cost validation
  | typeof DISCARD_COST_REQUIRED
  | typeof DISCARD_COST_INVALID_COUNT
  | typeof DISCARD_COST_CARD_NOT_ELIGIBLE
  | typeof DISCARD_COST_CANNOT_SKIP
  // Discard for attack validation (Sword of Justice)
  | typeof DISCARD_FOR_ATTACK_REQUIRED
  | typeof DISCARD_FOR_ATTACK_CARD_NOT_ELIGIBLE
  // Discard for crystal validation (Savage Harvesting)
  | typeof DISCARD_FOR_CRYSTAL_REQUIRED
  | typeof DISCARD_FOR_CRYSTAL_CARD_NOT_ELIGIBLE
  | typeof DISCARD_FOR_CRYSTAL_CANNOT_SKIP
  | typeof ARTIFACT_CRYSTAL_COLOR_REQUIRED
  | typeof ARTIFACT_CRYSTAL_INVALID_COLOR
  // Decompose validation
  | typeof DECOMPOSE_REQUIRED
  | typeof DECOMPOSE_CARD_NOT_ELIGIBLE
  // Spell purchase validation
  | typeof SPELL_NOT_IN_OFFER
  | typeof NOT_AT_SPELL_SITE
  | typeof INSUFFICIENT_INFLUENCE_FOR_SPELL
  // Advanced action learning validation
  | typeof AA_NOT_IN_OFFER
  | typeof NOT_AT_AA_SITE
  | typeof AA_NOT_IN_MONASTERY_OFFER
  | typeof INSUFFICIENT_INFLUENCE_FOR_AA
  | typeof NOT_IN_LEVEL_UP_CONTEXT
  // Level up rewards validation
  | typeof LEVEL_UP_REWARDS_PENDING
  | typeof NO_PENDING_LEVEL_UP_REWARDS
  | typeof INVALID_LEVEL_UP_LEVEL
  | typeof SKILL_NOT_AVAILABLE
  | typeof SKILL_ALREADY_OWNED
  // Debug validation
  | typeof DEV_MODE_REQUIRED
  | typeof NO_PENDING_LEVEL_UPS
  // Cooperative assault validation
  | typeof NOT_ADJACENT_TO_CITY
  | typeof SCENARIO_END_FULFILLED
  | typeof OTHER_HERO_ON_SPACE
  | typeof INVITEE_NOT_ADJACENT
  | typeof INVITEE_TOKEN_FLIPPED
  | typeof INVITEE_NO_CARDS
  | typeof INVALID_ENEMY_DISTRIBUTION
  | typeof NO_PENDING_PROPOSAL
  | typeof NOT_AN_INVITEE
  | typeof ALREADY_RESPONDED
  | typeof NOT_PROPOSAL_INITIATOR
  | typeof CITY_NOT_FOUND
  | typeof MUST_INVITE_AT_LEAST_ONE
  | typeof INITIATOR_TOKEN_FLIPPED
  // Terrain cost reduction validation (Druidic Paths)
  | typeof TERRAIN_COST_REDUCTION_REQUIRED
  | typeof TERRAIN_COST_REDUCTION_INVALID_COORDINATE
  | typeof TERRAIN_COST_REDUCTION_INVALID_TERRAIN
  // Banner validation
  | typeof BANNER_NOT_IN_HAND
  | typeof BANNER_NOT_A_BANNER
  | typeof BANNER_TARGET_UNIT_NOT_FOUND
  | typeof BANNER_NO_UNITS
  | typeof BANNER_FEAR_NOT_IN_COMBAT
  | typeof BANNER_FEAR_NOT_BLOCK_PHASE
  | typeof BANNER_FEAR_UNIT_NOT_FOUND
  | typeof BANNER_FEAR_NO_BANNER
  | typeof BANNER_FEAR_UNIT_NOT_READY
  | typeof BANNER_FEAR_UNIT_WOUNDED
  | typeof BANNER_FEAR_ENEMY_NOT_FOUND
  | typeof BANNER_FEAR_ENEMY_ARCANE_IMMUNE
  | typeof BANNER_FEAR_ATTACK_ALREADY_CANCELLED
  | typeof BANNER_FEAR_INVALID_ATTACK_INDEX
  // Skill usage validation
  | typeof SKILL_NOT_LEARNED
  | typeof SKILL_NOT_FOUND
  | typeof SKILL_ON_COOLDOWN
  | typeof SKILL_REQUIRES_NOT_IN_COMBAT
  | typeof SKILL_REQUIRES_WOUND_IN_HAND
  | typeof SKILL_REQUIRES_INTERACTION
  | typeof SKILL_REQUIRES_MANA
  | typeof SKILL_CONFLICTS_WITH_ACTIVE
  // Time Bending chain prevention
  | typeof TIME_BENDING_CHAIN_PREVENTED
  | typeof SKILL_NOT_IN_CENTER
  | typeof CANNOT_RETURN_OWN_SKILL;
