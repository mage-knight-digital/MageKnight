"""Entity vocabularies for RL embedding layers.

Each Vocabulary maps known string IDs to integer indices.
Index 0 is always reserved for unknown/unseen values (<UNK>).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Vocabulary:
    """Maps string IDs → integer indices for nn.Embedding lookups."""

    name: str
    _str_to_idx: dict[str, int]
    size: int  # len(values) + 1 for <UNK> at index 0

    def encode(self, value: str) -> int:
        """Return the integer index for *value*, or 0 (<UNK>) if unknown."""
        return self._str_to_idx.get(value, 0)

    def __contains__(self, value: str) -> bool:
        return value in self._str_to_idx


def _build_vocab(name: str, values: tuple[str, ...]) -> Vocabulary:
    """Build a Vocabulary from a tuple of known string values."""
    mapping = {v: i + 1 for i, v in enumerate(values)}
    return Vocabulary(name=name, _str_to_idx=mapping, size=len(values) + 1)


# ---------------------------------------------------------------------------
# Card IDs  (~120 cards: basic actions, hero-specific, spells, artifacts, AAs)
# ---------------------------------------------------------------------------

_CARD_IDS: tuple[str, ...] = (
    # Shared basic actions (13)
    "rage", "determination", "swiftness", "march", "stamina",
    "tranquility", "promise", "threaten", "crystallize", "mana_draw",
    "axe_throw", "concentration", "improvisation",
    # Hero-specific basic actions (15)
    "arythea_battle_versatility", "arythea_mana_pull",
    "goldyx_crystal_joy", "goldyx_will_focus",
    "norowas_noble_manners", "norowas_rejuvenate",
    "tovak_cold_toughness", "tovak_instinct",
    "wolfhawk_swift_reflexes", "wolfhawk_tirelessness",
    "krang_savage_harvesting", "krang_ruthless_coercion", "krang_battle_rage",
    "braevalar_druidic_paths", "braevalar_one_with_the_land",
    # Wound
    "wound",
    # Spells - red (7)
    "fireball", "flame_wall", "tremor", "mana_meltdown", "demolish",
    "burning_shield", "offering",
    # Spells - blue (6)
    "snowstorm", "chill", "mist_form", "mana_claim", "space_bending",
    "mana_bolt",
    # Spells - green (5)
    "restoration", "whirlwind", "energy_flow", "underground_travel",
    "meditation",
    # Spells - white (6)
    "expose", "cure", "call_to_arms", "mind_read", "wings_of_wind",
    "charm",
    # Artifacts - banners (6)
    "banner_of_glory", "banner_of_fear", "banner_of_protection",
    "banner_of_courage", "banner_of_command", "banner_of_fortitude",
    # Artifacts - rings (4)
    "ruby_ring", "sapphire_ring", "diamond_ring", "emerald_ring",
    # Artifacts - weapons (5)
    "sword_of_justice", "horn_of_wrath", "bow_of_starsdawn",
    "soul_harvester", "shield_of_the_fallen_kings",
    # Artifacts - amulets (2)
    "amulet_of_the_sun", "amulet_of_darkness",
    # Artifacts - other (8)
    "endless_bag_of_gold", "endless_gem_pouch", "golden_grail",
    "book_of_wisdom", "druidic_staff", "circlet_of_proficiency",
    "tome_of_all_spells", "mysterious_box",
    # Advanced actions - bolts (4)
    "fire_bolt", "ice_bolt", "crushing_bolt", "swift_bolt",
    # Advanced actions - red (10)
    "maximal_effect", "blood_of_ancients", "blood_rage", "intimidate",
    "explosive_bolt", "into_the_heat", "ritual_attack", "decompose",
    "blood_ritual", "counterattack",
    # Advanced actions - blue (9)
    "magic_talent", "crystal_mastery", "pure_magic", "steady_tempo",
    "shield_bash", "temporal_portal", "ice_shield", "spell_forge",
    "frost_bridge",
    # Advanced actions - green (10)
    "in_need", "mountain_lore", "ambush", "regeneration", "stout_resolve",
    "power_of_crystals", "refreshing_walk", "force_of_nature",
    "training", "path_finding",
    # Advanced actions - white (9)
    "peaceful_moment", "dodge_and_weave", "mana_storm", "chivalry",
    "heroic_tale", "diplomacy", "song_of_wind", "learning", "agility",
    # Advanced actions - dual (2)
    "chilling_stare", "rush_of_adrenaline",
)

CARD_VOCAB: Vocabulary = _build_vocab("card", _CARD_IDS)

# ---------------------------------------------------------------------------
# Unit IDs  (~32 units)
# ---------------------------------------------------------------------------

_UNIT_IDS: tuple[str, ...] = (
    # Regular units (15)
    "peasants", "foresters", "herbalist", "scouts", "thugs",
    "utem_crossbowmen", "utem_guardsmen", "utem_swordsmen",
    "guardian_golems", "illusionists", "shocktroops",
    "red_cape_monks", "northern_monks", "savage_monks", "magic_familiars",
    # Elite units (17)
    "fire_mages", "ice_mages", "fire_golems", "ice_golems",
    "sorcerers", "catapults", "amotep_gunners", "amotep_freezers",
    "heroes", "hero_blue", "hero_red", "hero_green", "hero_white",
    "altem_mages", "altem_guardians", "delphana_masters",
)

UNIT_VOCAB: Vocabulary = _build_vocab("unit", _UNIT_IDS)

# ---------------------------------------------------------------------------
# Enemy IDs  (~78 enemies)
# ---------------------------------------------------------------------------

_ENEMY_IDS: tuple[str, ...] = (
    # Green - marauding orcs (18)
    "diggers", "prowlers", "cursed_hags", "wolf_riders", "ironclads",
    "orc_summoners", "centaur_outriders", "orc_skirmishers",
    "orc_war_beasts", "orc_stonethrowers", "orc_tracker",
    "skeletal_warriors", "shrouded_necromancers", "corrupted_priests",
    "gibbering_ghouls", "elemental_priests", "elven_protectors",
    "crystal_sprites", "zombie_horde", "cloud_griffons",
    # Gray - keep garrison (7)
    "crossbowmen", "guardsmen", "swordsmen", "golems",
    "thugs_gray", "shocktroops_gray",
    # Brown - dungeon monsters (15)
    "air_elemental", "minotaur", "gargoyle", "medusa", "crypt_worm",
    "werewolf", "shadow", "fire_elemental", "earth_elemental",
    "mummy", "hydra", "manticore", "water_elemental", "vampire",
    "pain_wraith", "blood_demon",
    # Violet - mage tower (8)
    "monks", "ice_mages", "fire_mages", "ice_golems", "fire_golems",
    "sorcerers", "magic_familiars", "illusionists",
    # White - city garrison (10)
    "thugs", "shocktroops", "freezers", "gunners",
    "fire_catapult", "ice_catapult", "altem_guardsmen", "altem_mages",
    "delphana_masters", "grim_legionnaries",
    # Red - draconum (11)
    "swamp_dragon", "fire_dragon", "ice_dragon", "high_dragon",
    "death_dragon", "lava_dragon", "savage_dragon", "dragon_summoner",
    "lightning_dragon", "vampire_dragon", "storm_dragon",
    # Gray extras
    "heroes",
)

ENEMY_VOCAB: Vocabulary = _build_vocab("enemy", _ENEMY_IDS)

# ---------------------------------------------------------------------------
# Action type IDs  (from action_constants.ALL_ACTIONS)
# ---------------------------------------------------------------------------

_ACTION_TYPE_IDS: tuple[str, ...] = (
    "ACTIVATE_TACTIC", "ACTIVATE_UNIT", "ALTAR_TRIBUTE",
    "ANNOUNCE_END_OF_ROUND", "ASSIGN_ATTACK", "ASSIGN_BANNER",
    "ASSIGN_BLOCK", "ASSIGN_DAMAGE", "BURN_MONASTERY",
    "BUY_HEALING", "BUY_SPELL",
    "CANCEL_COOPERATIVE_PROPOSAL", "CHALLENGE_RAMPAGING",
    "CHOOSE_LEVEL_UP_REWARDS", "COMPLETE_REST",
    "CONVERT_INFLUENCE_TO_BLOCK", "CONVERT_MOVE_TO_ATTACK",
    "DEBUG_ADD_FAME", "DEBUG_TRIGGER_LEVEL_UP",
    "DECLARE_ATTACK", "DECLARE_BLOCK", "DECLARE_REST",
    "DISBAND_UNIT", "END_COMBAT_PHASE", "END_TURN",
    "ENTER_COMBAT", "ENTER_SITE", "EXPLORE", "INTERACT",
    "LEARN_ADVANCED", "LEARN_ADVANCED_ACTION", "MOVE",
    "PAY_HEROES_ASSAULT_INFLUENCE", "PAY_THUGS_DAMAGE_INFLUENCE",
    "DECLINE_PLUNDER",
    "PLAY_CARD", "PLAY_CARD_SIDEWAYS", "PLUNDER_VILLAGE",
    "PROPOSE_COOPERATIVE_ASSAULT", "RECRUIT_UNIT",
    "REROLL_SOURCE_DICE",
    "RESOLVE_ARTIFACT_CRYSTAL_COLOR", "RESOLVE_BANNER_PROTECTION",
    "RESOLVE_BOOK_OF_WISDOM", "RESOLVE_CHOICE",
    "RESOLVE_CRYSTAL_JOY_RECLAIM", "RESOLVE_DECOMPOSE",
    "RESOLVE_DEEP_MINE", "RESOLVE_DISCARD",
    "RESOLVE_DISCARD_FOR_ATTACK", "RESOLVE_DISCARD_FOR_BONUS",
    "RESOLVE_DISCARD_FOR_CRYSTAL", "RESOLVE_GLADE_WOUND",
    "RESOLVE_HEX_COST_REDUCTION", "RESOLVE_MAXIMAL_EFFECT",
    "RESOLVE_MEDITATION", "RESOLVE_SOURCE_OPENING_REROLL",
    "RESOLVE_STEADY_TEMPO", "RESOLVE_TACTIC_DECISION",
    "RESOLVE_TERRAIN_COST_REDUCTION", "RESOLVE_TRAINING",
    "RESOLVE_UNIT_MAINTENANCE",
    "RESPOND_TO_COOPERATIVE_PROPOSAL",
    "REST", "RETURN_INTERACTIVE_SKILL",
    "SELECT_REWARD", "SELECT_TACTIC",
    "SPEND_MOVE_ON_CUMBERSOME", "UNASSIGN_ATTACK", "UNASSIGN_BLOCK",
    "UNDO", "USE_BANNER_FEAR", "USE_SKILL",
)

ACTION_TYPE_VOCAB: Vocabulary = _build_vocab("action_type", _ACTION_TYPE_IDS)

# ---------------------------------------------------------------------------
# Mode IDs  (from generated_action_enumerator.KNOWN_VALID_ACTION_MODES)
# ---------------------------------------------------------------------------

_MODE_IDS: tuple[str, ...] = (
    "cannot_act", "combat", "normal_turn",
    "pending_artifact_crystal_color", "pending_banner_protection",
    "pending_book_of_wisdom", "pending_choice",
    "pending_crystal_joy_reclaim", "pending_decompose",
    "pending_deep_mine", "pending_discard_cost",
    "pending_discard_for_attack", "pending_discard_for_bonus",
    "pending_discard_for_crystal", "pending_glade_wound",
    "pending_hex_cost_reduction", "pending_level_up",
    "pending_maximal_effect", "pending_meditation",
    "pending_plunder_decision",
    "pending_source_opening_reroll", "pending_steady_tempo",
    "pending_tactic_decision", "pending_terrain_cost_reduction",
    "pending_training", "pending_unit_maintenance",
    "tactics_selection",
)

MODE_VOCAB: Vocabulary = _build_vocab("mode", _MODE_IDS)

# ---------------------------------------------------------------------------
# Source strings  (from CandidateAction source fields in generated enumerator)
# ---------------------------------------------------------------------------

_SOURCE_IDS: tuple[str, ...] = (
    "artifact_crystal_color",
    "banner_protection.remove", "banner_protection.skip",
    "book_of_wisdom.card",
    "combat.assign_attack", "combat.assign_block",
    "combat.assign_damage", "combat.banner_fear",
    "combat.convert_influence_to_block", "combat.convert_move_to_attack",
    "combat.cumbersome", "combat.declare_block",
    "combat.end_phase", "combat.heroes_assault_payment",
    "combat.thugs_payment",
    "crystal_joy.card", "crystal_joy.skip",
    "decompose.card", "deep_mine.color",
    "discard_cost.optional_skip", "discard_cost.required",
    "discard_for_attack.none", "discard_for_attack.one",
    "discard_for_bonus.choice",
    "discard_for_crystal.card", "discard_for_crystal.skip",
    "glade.discard", "glade.hand", "glade.skip",
    "hex_cost_reduction.coordinate",
    "level_up.common", "level_up.drawn",
    "maximal_effect.card",
    "meditation.place.bottom", "meditation.place.top", "meditation.select",
    "normal.banners.assign", "normal.challenge", "normal.explore",
    "normal.learning_aa", "normal.move",
    "normal.play_card.basic", "normal.play_card.sideways",
    "normal.site.burn_monastery", "normal.site.buy_aa",
    "normal.site.buy_spell", "normal.site.enter",
    "normal.site.heal", "normal.site.interact",
    "normal.skills.activate", "normal.skills.return",
    "normal.tactic.activate", "normal.tactic.pending",
    "normal.tactic.reroll",
    "normal.turn.announce_end_round", "normal.turn.complete_rest",
    "normal.turn.declare_rest", "normal.turn.end_turn",
    "normal.units.activate", "normal.units.recruit",
    "plunder_decision.decline", "plunder_decision.plunder",
    "pending_choice.index",
    "source_opening.keep", "source_opening.reroll",
    "steady_tempo.place", "steady_tempo.skip",
    "tactics.available",
    "terrain_cost_reduction.terrain",
    "training.card",
    "turn.end_turn", "turn.undo",
    "unit_maintenance.disband", "unit_maintenance.keep",
)

SOURCE_VOCAB: Vocabulary = _build_vocab("source", _SOURCE_IDS)

# ---------------------------------------------------------------------------
# Site type IDs
# ---------------------------------------------------------------------------

_SITE_IDS: tuple[str, ...] = (
    "village", "monastery", "magical_glade",
    "keep", "mage_tower",
    "ancient_ruins", "dungeon", "tomb", "monster_den", "spawning_grounds",
    "mine", "deep_mine", "portal",
    "city",
    "maze", "labyrinth", "refugee_camp", "volkares_camp",
)

SITE_VOCAB: Vocabulary = _build_vocab("site", _SITE_IDS)
