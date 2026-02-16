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
    "pending_reward",
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
    "combat.play_card.basic", "combat.play_card.powered", "combat.play_card.sideways",
    "combat.play_card.sideways.move", "combat.play_card.sideways.influence",
    "combat.play_card.sideways.attack", "combat.play_card.sideways.block",
    "combat.skills.activate", "combat.units.activate",
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
    "normal.play_card.basic", "normal.play_card.powered", "normal.play_card.sideways",
    "normal.play_card.sideways.move", "normal.play_card.sideways.influence",
    "normal.play_card.sideways.attack", "normal.play_card.sideways.block",
    "normal.site.burn_monastery", "normal.site.buy_aa",
    "normal.site.buy_spell", "normal.site.enter",
    "normal.site.heal", "normal.site.interact",
    "normal.skills.activate", "normal.skills.return",
    "normal.tactic.activate", "normal.tactic.pending",
    "normal.tactic.reroll",
    "normal.turn.announce_end_round", "normal.turn.complete_rest",
    "normal.turn.declare_rest", "normal.turn.end_turn",
    "normal.units.activate", "normal.units.recruit", "normal.units.recruit.disband",
    "plunder_decision.decline", "plunder_decision.plunder",
    "pending_choice.index",
    # Effect types for RESOLVE_CHOICE option enrichment
    "pending_choice.gain_move", "pending_choice.gain_attack",
    "pending_choice.gain_block", "pending_choice.gain_healing",
    "pending_choice.gain_influence", "pending_choice.gain_mana",
    "pending_choice.draw_cards", "pending_choice.gain_fame",
    "pending_choice.gain_crystal", "pending_choice.apply_modifier",
    "pending_choice.change_reputation", "pending_choice.noop",
    "pending_choice.card_boost", "pending_choice.ready_unit",
    "pending_choice.compound", "pending_choice.conditional",
    "pending_choice.scaling",
    "pending_reward.auto", "pending_reward.card",
    "pending_reward.unit", "pending_reward.unit.disband",
    "source_opening.keep", "source_opening.reroll",
    "steady_tempo.place", "steady_tempo.skip",
    "pending_tactic_decision.card", "pending_tactic_decision.cards.0",
    "pending_tactic_decision.cards.1", "pending_tactic_decision.cards.2",
    "pending_tactic_decision.cards.3",
    "pending_tactic_decision.die",
    "pending_tactic_decision.sparing.stash", "pending_tactic_decision.sparing.take",
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

# ---------------------------------------------------------------------------
# Terrain type IDs
# ---------------------------------------------------------------------------

_TERRAIN_IDS: tuple[str, ...] = (
    "plains", "hills", "forest", "wasteland", "desert",
    "swamp", "lake", "mountain", "ocean",
)

TERRAIN_VOCAB: Vocabulary = _build_vocab("terrain", _TERRAIN_IDS)

# ---------------------------------------------------------------------------
# Skill IDs  (70 skills: 10 per hero × 7 heroes)
# ---------------------------------------------------------------------------

_SKILL_IDS: tuple[str, ...] = (
    # Arythea (10)
    "arythea_dark_paths", "arythea_burning_power", "arythea_hot_swordsmanship",
    "arythea_dark_negotiation", "arythea_dark_fire_magic", "arythea_power_of_pain",
    "arythea_invocation", "arythea_polarization", "arythea_motivation",
    "arythea_ritual_of_pain",
    # Tovak (10)
    "tovak_double_time", "tovak_night_sharpshooting", "tovak_cold_swordsmanship",
    "tovak_shield_mastery", "tovak_resistance_break", "tovak_i_feel_no_pain",
    "tovak_i_dont_give_a_damn", "tovak_who_needs_magic", "tovak_motivation",
    "tovak_mana_overload",
    # Goldyx (10)
    "goldyx_freezing_power", "goldyx_potion_making", "goldyx_white_crystal_craft",
    "goldyx_green_crystal_craft", "goldyx_red_crystal_craft",
    "goldyx_glittering_fortune", "goldyx_flight", "goldyx_universal_power",
    "goldyx_motivation", "goldyx_source_opening",
    # Norowas (10)
    "norowas_forward_march", "norowas_day_sharpshooting", "norowas_inspiration",
    "norowas_bright_negotiation", "norowas_leaves_in_the_wind",
    "norowas_whispers_in_the_treetops", "norowas_leadership",
    "norowas_bonds_of_loyalty", "norowas_motivation", "norowas_prayer_of_weather",
    # Wolfhawk (10)
    "wolfhawk_refreshing_bath", "wolfhawk_refreshing_breeze", "wolfhawk_hawk_eyes",
    "wolfhawk_on_her_own", "wolfhawk_deadly_aim", "wolfhawk_know_your_prey",
    "wolfhawk_taunt", "wolfhawk_dueling", "wolfhawk_motivation",
    "wolfhawk_wolfs_howl",
    # Krang (10)
    "krang_spirit_guides", "krang_battle_hardened", "krang_battle_frenzy",
    "krang_shamanic_ritual", "krang_regenerate", "krang_arcane_disguise",
    "krang_puppet_master", "krang_master_of_chaos", "krang_curse",
    "krang_mana_enhancement",
    # Braevalar (10)
    "braevalar_elemental_resistance", "braevalar_feral_allies",
    "braevalar_thunderstorm", "braevalar_lightning_storm", "braevalar_beguile",
    "braevalar_forked_lightning", "braevalar_shapeshift", "braevalar_secret_ways",
    "braevalar_regenerate", "braevalar_natures_vengeance",
)

SKILL_VOCAB: Vocabulary = _build_vocab("skill", _SKILL_IDS)
