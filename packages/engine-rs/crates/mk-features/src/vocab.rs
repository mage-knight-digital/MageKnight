//! Entity vocabularies for RL embedding layers.
//!
//! Each vocabulary maps known string IDs to integer indices (u16).
//! Index 0 is always reserved for unknown/unseen values (`<UNK>`).
//! Vocabularies use sorted static arrays with binary search for O(log n) lookups.

/// A vocabulary mapping string IDs → u16 indices for nn.Embedding lookups.
///
/// Index 0 is always `<UNK>`. Known values are indexed 1..=N.
pub struct Vocabulary {
    /// Name for debugging.
    pub name: &'static str,
    /// Sorted entries for binary search. Index in this array + 1 = vocab index.
    entries: &'static [&'static str],
    /// Original (insertion-order) entries for index → string lookup.
    ordered: &'static [&'static str],
}

impl Vocabulary {
    /// Create a new vocabulary from a sorted array and the original ordered array.
    pub const fn new(
        name: &'static str,
        sorted: &'static [&'static str],
        ordered: &'static [&'static str],
    ) -> Self {
        Self {
            name,
            entries: sorted,
            ordered,
        }
    }

    /// Encode a string to its vocabulary index. Returns 0 for unknown values.
    pub fn encode(&self, value: &str) -> u16 {
        // Binary search the sorted array
        match self.entries.binary_search(&value) {
            Ok(idx) => (idx + 1) as u16,
            Err(_) => 0,
        }
    }

    /// Total vocabulary size including the UNK token at index 0.
    pub const fn size(&self) -> usize {
        self.entries.len() + 1
    }

    /// Check if a value is in the vocabulary.
    pub fn contains(&self, value: &str) -> bool {
        self.entries.binary_search(&value).is_ok()
    }

    /// Get the string for a given index, or None if out of range or UNK.
    pub fn decode(&self, index: u16) -> Option<&'static str> {
        if index == 0 || index as usize > self.ordered.len() {
            None
        } else {
            Some(self.ordered[index as usize - 1])
        }
    }
}

// =============================================================================
// Macro to define vocabularies with compile-time sorted arrays
// =============================================================================

/// Build a vocabulary. The `ordered` list is the canonical insertion order
/// (matching Python). The `sorted` list must be the same entries sorted
/// lexicographically for binary search.
macro_rules! define_vocab {
    ($name:ident, $display:expr, ordered: [$($ordered:expr),* $(,)?], sorted: [$($sorted:expr),* $(,)?] $(,)?) => {
        pub static $name: Vocabulary = Vocabulary::new(
            $display,
            &[$($sorted),*],
            &[$($ordered),*],
        );
    };
}

// =============================================================================
// Card Vocabulary (98 entries)
// =============================================================================

define_vocab!(CARD_VOCAB, "card",
    ordered: [
        // Shared basic actions (13)
        "rage", "determination", "swiftness", "march", "stamina",
        "tranquility", "promise", "threaten", "crystallize", "mana_draw",
        "axe_throw", "concentration", "improvisation",
        // Hero-specific basic actions (15)
        "arythea_battle_versatility", "arythea_mana_pull",
        "goldyx_crystal_joy", "goldyx_will_focus",
        "norowas_noble_manners", "norowas_rejuvenate",
        "tovak_cold_toughness", "tovak_instinct",
        "wolfhawk_swift_reflexes", "wolfhawk_tirelessness",
        "krang_savage_harvesting", "krang_ruthless_coercion", "krang_battle_rage",
        "braevalar_druidic_paths", "braevalar_one_with_the_land",
        // Wound
        "wound",
        // Spells - red (7)
        "fireball", "flame_wall", "tremor", "mana_meltdown", "demolish",
        "burning_shield", "offering",
        // Spells - blue (6)
        "snowstorm", "chill", "mist_form", "mana_claim", "space_bending",
        "mana_bolt",
        // Spells - green (5)
        "restoration", "whirlwind", "energy_flow", "underground_travel",
        "meditation",
        // Spells - white (6)
        "expose", "cure", "call_to_arms", "mind_read", "wings_of_wind",
        "charm",
        // Artifacts - banners (6)
        "banner_of_glory", "banner_of_fear", "banner_of_protection",
        "banner_of_courage", "banner_of_command", "banner_of_fortitude",
        // Artifacts - rings (4)
        "ruby_ring", "sapphire_ring", "diamond_ring", "emerald_ring",
        // Artifacts - weapons (5)
        "sword_of_justice", "horn_of_wrath", "bow_of_starsdawn",
        "soul_harvester", "shield_of_the_fallen_kings",
        // Artifacts - amulets (2)
        "amulet_of_the_sun", "amulet_of_darkness",
        // Artifacts - other (8)
        "endless_bag_of_gold", "endless_gem_pouch", "golden_grail",
        "book_of_wisdom", "druidic_staff", "circlet_of_proficiency",
        "tome_of_all_spells", "mysterious_box",
        // Advanced actions - bolts (4)
        "fire_bolt", "ice_bolt", "crushing_bolt", "swift_bolt",
        // Advanced actions - red (10)
        "maximal_effect", "blood_of_ancients", "blood_rage", "intimidate",
        "explosive_bolt", "into_the_heat", "ritual_attack", "decompose",
        "blood_ritual", "counterattack",
        // Advanced actions - blue (9)
        "magic_talent", "crystal_mastery", "pure_magic", "steady_tempo",
        "shield_bash", "temporal_portal", "ice_shield", "spell_forge",
        "frost_bridge",
        // Advanced actions - green (10)
        "in_need", "mountain_lore", "ambush", "regeneration", "stout_resolve",
        "power_of_crystals", "refreshing_walk", "force_of_nature",
        "training", "path_finding",
        // Advanced actions - white (9)
        "peaceful_moment", "dodge_and_weave", "mana_storm", "chivalry",
        "heroic_tale", "diplomacy", "song_of_wind", "learning", "agility",
        // Advanced actions - dual (2)
        "chilling_stare", "rush_of_adrenaline",
        // Tactics - day (6)
        "early_bird", "rethink", "mana_steal", "planning", "great_start", "the_right_moment",
        // Tactics - night (6)
        "from_the_dusk", "long_night", "mana_search", "midnight_meditation", "preparation", "sparing_power",
    ],
    sorted: [
        "agility", "ambush", "amulet_of_darkness", "amulet_of_the_sun",
        "arythea_battle_versatility", "arythea_mana_pull", "axe_throw",
        "banner_of_command", "banner_of_courage", "banner_of_fear",
        "banner_of_fortitude", "banner_of_glory", "banner_of_protection",
        "blood_of_ancients", "blood_rage", "blood_ritual",
        "book_of_wisdom", "bow_of_starsdawn", "braevalar_druidic_paths",
        "braevalar_one_with_the_land", "burning_shield",
        "call_to_arms", "charm", "chill", "chilling_stare", "chivalry",
        "circlet_of_proficiency", "concentration", "counterattack",
        "crushing_bolt", "crystal_mastery", "crystallize", "cure",
        "decompose", "demolish", "determination", "diamond_ring", "diplomacy",
        "dodge_and_weave", "druidic_staff",
        "early_bird",
        "emerald_ring", "endless_bag_of_gold", "endless_gem_pouch",
        "energy_flow", "explosive_bolt", "expose",
        "fire_bolt", "fireball", "flame_wall", "force_of_nature",
        "from_the_dusk", "frost_bridge",
        "golden_grail", "goldyx_crystal_joy", "goldyx_will_focus",
        "great_start",
        "heroic_tale", "horn_of_wrath",
        "ice_bolt", "ice_shield", "improvisation", "in_need",
        "intimidate", "into_the_heat",
        "krang_battle_rage", "krang_ruthless_coercion", "krang_savage_harvesting",
        "learning", "long_night",
        "magic_talent", "mana_bolt", "mana_claim", "mana_draw",
        "mana_meltdown", "mana_search", "mana_steal", "mana_storm",
        "march", "maximal_effect",
        "meditation", "midnight_meditation", "mind_read", "mist_form", "mountain_lore",
        "mysterious_box",
        "norowas_noble_manners", "norowas_rejuvenate",
        "offering",
        "path_finding", "peaceful_moment", "planning", "power_of_crystals",
        "preparation", "promise", "pure_magic",
        "rage", "refreshing_walk", "regeneration", "restoration", "rethink",
        "ritual_attack", "ruby_ring", "rush_of_adrenaline",
        "sapphire_ring", "shield_bash", "shield_of_the_fallen_kings",
        "snowstorm", "song_of_wind", "soul_harvester", "space_bending",
        "sparing_power", "spell_forge", "stamina", "steady_tempo", "stout_resolve",
        "swift_bolt", "swiftness", "sword_of_justice",
        "temporal_portal", "the_right_moment", "threaten", "tome_of_all_spells",
        "tovak_cold_toughness", "tovak_instinct", "training",
        "tranquility", "tremor",
        "underground_travel",
        "whirlwind", "wings_of_wind",
        "wolfhawk_swift_reflexes", "wolfhawk_tirelessness",
        "wound",
    ],
);

// =============================================================================
// Unit Vocabulary (31 entries)
// =============================================================================

define_vocab!(UNIT_VOCAB, "unit",
    ordered: [
        // Regular units (15)
        "peasants", "foresters", "herbalist", "scouts", "thugs",
        "utem_crossbowmen", "utem_guardsmen", "utem_swordsmen",
        "guardian_golems", "illusionists", "shocktroops",
        "red_cape_monks", "northern_monks", "savage_monks", "magic_familiars",
        // Elite units (16)
        "fire_mages", "ice_mages", "fire_golems", "ice_golems",
        "sorcerers", "catapults", "amotep_gunners", "amotep_freezers",
        "heroes", "hero_blue", "hero_red", "hero_green", "hero_white",
        "altem_mages", "altem_guardians", "delphana_masters",
    ],
    sorted: [
        "altem_guardians", "altem_mages", "amotep_freezers", "amotep_gunners",
        "catapults", "delphana_masters",
        "fire_golems", "fire_mages", "foresters",
        "guardian_golems",
        "herbalist", "hero_blue", "hero_green", "hero_red", "hero_white", "heroes",
        "ice_golems", "ice_mages", "illusionists",
        "magic_familiars",
        "northern_monks",
        "peasants",
        "red_cape_monks",
        "savage_monks", "scouts", "shocktroops", "sorcerers",
        "thugs",
        "utem_crossbowmen", "utem_guardsmen", "utem_swordsmen",
    ],
);

// =============================================================================
// Enemy Vocabulary (78 entries)
// =============================================================================

define_vocab!(ENEMY_VOCAB, "enemy",
    ordered: [
        // Green - marauding orcs (20)
        "diggers", "prowlers", "cursed_hags", "wolf_riders", "ironclads",
        "orc_summoners", "centaur_outriders", "orc_skirmishers",
        "orc_war_beasts", "orc_stonethrowers", "orc_tracker",
        "skeletal_warriors", "shrouded_necromancers", "corrupted_priests",
        "gibbering_ghouls", "elemental_priests", "elven_protectors",
        "crystal_sprites", "zombie_horde", "cloud_griffons",
        // Gray - keep garrison (6)
        "crossbowmen", "guardsmen", "swordsmen", "golems",
        "thugs_gray", "shocktroops_gray",
        // Brown - dungeon monsters (16)
        "air_elemental", "minotaur", "gargoyle", "medusa", "crypt_worm",
        "werewolf", "shadow", "fire_elemental", "earth_elemental",
        "mummy", "hydra", "manticore", "water_elemental", "vampire",
        "pain_wraith", "blood_demon",
        // Violet - mage tower (8)
        "monks", "ice_mages", "fire_mages", "ice_golems", "fire_golems",
        "sorcerers", "magic_familiars", "illusionists",
        // White - city garrison (10)
        "thugs", "shocktroops", "freezers", "gunners",
        "fire_catapult", "ice_catapult", "altem_guardsmen", "altem_mages",
        "delphana_masters", "grim_legionnaries",
        // Red - draconum (11)
        "swamp_dragon", "fire_dragon", "ice_dragon", "high_dragon",
        "death_dragon", "lava_dragon", "savage_dragon", "dragon_summoner",
        "lightning_dragon", "vampire_dragon", "storm_dragon",
        // Gray extras
        "heroes",
    ],
    sorted: [
        "air_elemental", "altem_guardsmen", "altem_mages",
        "blood_demon",
        "centaur_outriders", "cloud_griffons", "corrupted_priests",
        "crossbowmen", "crypt_worm", "crystal_sprites", "cursed_hags",
        "death_dragon", "delphana_masters", "diggers", "dragon_summoner",
        "earth_elemental", "elemental_priests", "elven_protectors",
        "fire_catapult", "fire_dragon", "fire_elemental",
        "fire_golems", "fire_mages", "freezers",
        "gargoyle", "gibbering_ghouls", "golems", "grim_legionnaries",
        "guardsmen", "gunners",
        "heroes", "high_dragon", "hydra",
        "ice_catapult", "ice_dragon", "ice_golems", "ice_mages",
        "illusionists", "ironclads",
        "lava_dragon", "lightning_dragon",
        "magic_familiars", "manticore", "medusa", "minotaur",
        "monks", "mummy",
        "orc_skirmishers", "orc_stonethrowers", "orc_summoners",
        "orc_tracker", "orc_war_beasts",
        "pain_wraith", "prowlers",
        "savage_dragon", "shadow", "shocktroops", "shocktroops_gray",
        "shrouded_necromancers", "skeletal_warriors", "sorcerers",
        "storm_dragon", "swamp_dragon", "swordsmen",
        "thugs", "thugs_gray",
        "vampire", "vampire_dragon",
        "water_elemental", "werewolf", "wolf_riders",
        "zombie_horde",
    ],
);

// =============================================================================
// Action Type Vocabulary (88 entries)
// =============================================================================

define_vocab!(ACTION_TYPE_VOCAB, "action_type",
    ordered: [
        "ACTIVATE_TACTIC", "ACTIVATE_UNIT", "ALTAR_TRIBUTE",
        "ANNOUNCE_END_OF_ROUND", "ASSIGN_ATTACK", "ASSIGN_BANNER",
        "ASSIGN_BLOCK", "ASSIGN_DAMAGE", "BEGIN_INTERACTION", "BURN_MONASTERY",
        "BUY_SPELL",
        "CANCEL_COOPERATIVE_PROPOSAL", "CHALLENGE_RAMPAGING",
        "CHOOSE_LEVEL_UP_REWARDS", "COMPLETE_REST",
        "CONVERT_INFLUENCE_TO_BLOCK", "CONVERT_MOVE_TO_ATTACK",
        "DEBUG_ADD_FAME", "DEBUG_TRIGGER_LEVEL_UP",
        "DECLARE_ATTACK", "DECLARE_ATTACK_TARGETS", "DECLARE_BLOCK", "DECLARE_BLOCK_TARGET", "DECLARE_REST",
        "DISBAND_UNIT", "DISBAND_UNIT_FOR_REWARD",
        "END_COMBAT_PHASE", "END_TURN",
        "ENTER_COMBAT", "ENTER_SITE", "EXPLORE",
        "FINALIZE_ATTACK", "FINALIZE_BLOCK", "FORFEIT_TURN", "FORFEIT_UNIT_REWARD",
        "INTERACT",
        "LEARN_ADVANCED", "LEARN_ADVANCED_ACTION", "MOVE",
        "PAY_HEROES_ASSAULT_INFLUENCE", "PAY_THUGS_DAMAGE_INFLUENCE",
        "DECLINE_PLUNDER",
        "PLAY_CARD", "PLAY_CARD_SIDEWAYS", "PLUNDER_VILLAGE",
        "PROPOSE_COOPERATIVE_ASSAULT", "RECRUIT_UNIT",
        "REROLL_SOURCE_DICE",
        "RESOLVE_ATTACK",
        "RESOLVE_BANNER_PROTECTION",
        "RESOLVE_BOOK_OF_WISDOM", "RESOLVE_CHOICE",
        "RESOLVE_CRYSTAL_JOY_RECLAIM", "RESOLVE_CRYSTAL_ROLL_COLOR",
        "RESOLVE_DECOMPOSE",
        "RESOLVE_DEEP_MINE", "RESOLVE_DISCARD",
        "RESOLVE_DISCARD_FOR_BONUS",
        "RESOLVE_DISCARD_FOR_CRYSTAL", "RESOLVE_GLADE_WOUND",
        "RESOLVE_HEX_COST_REDUCTION", "RESOLVE_MAXIMAL_EFFECT",
        "RESOLVE_MEDITATION", "RESOLVE_SOURCE_OPENING_REROLL",
        "RESOLVE_STEADY_TEMPO", "RESOLVE_TACTIC_DECISION",
        "RESOLVE_TERRAIN_COST_REDUCTION", "RESOLVE_TRAINING",
        "RESOLVE_UNIT_MAINTENANCE",
        "RESPOND_TO_COOPERATIVE_PROPOSAL",
        "REST", "RETURN_INTERACTIVE_SKILL",
        "SELECT_ARTIFACT", "SELECT_REWARD", "SELECT_TACTIC",
        "SPEND_MOVE_ON_CUMBERSOME", "UNASSIGN_ATTACK", "UNASSIGN_BLOCK",
        "UNDO", "USE_BANNER_FEAR", "USE_SKILL",
        // Added: emitted by derive_action_type() but previously missing
        "ADD_ELITE_TO_OFFER", "BUY_ARTIFACT",
        "BUY_CITY_ADVANCED_ACTION", "BUY_CITY_ADVANCED_ACTION_FROM_DECK",
        "RESOLVE_CIRCLET_OF_PROFICIENCY", "RESOLVE_TOME_OF_ALL_SPELLS",
        "USE_BANNER_COURAGE",
    ],
    sorted: [
        "ACTIVATE_TACTIC", "ACTIVATE_UNIT", "ADD_ELITE_TO_OFFER",
        "ALTAR_TRIBUTE",
        "ANNOUNCE_END_OF_ROUND", "ASSIGN_ATTACK", "ASSIGN_BANNER",
        "ASSIGN_BLOCK", "ASSIGN_DAMAGE", "BEGIN_INTERACTION",
        "BURN_MONASTERY", "BUY_ARTIFACT",
        "BUY_CITY_ADVANCED_ACTION", "BUY_CITY_ADVANCED_ACTION_FROM_DECK",
        "BUY_SPELL",
        "CANCEL_COOPERATIVE_PROPOSAL", "CHALLENGE_RAMPAGING",
        "CHOOSE_LEVEL_UP_REWARDS", "COMPLETE_REST",
        "CONVERT_INFLUENCE_TO_BLOCK", "CONVERT_MOVE_TO_ATTACK",
        "DEBUG_ADD_FAME", "DEBUG_TRIGGER_LEVEL_UP",
        "DECLARE_ATTACK", "DECLARE_ATTACK_TARGETS", "DECLARE_BLOCK",
        "DECLARE_BLOCK_TARGET", "DECLARE_REST",
        "DECLINE_PLUNDER", "DISBAND_UNIT", "DISBAND_UNIT_FOR_REWARD",
        "END_COMBAT_PHASE", "END_TURN",
        "ENTER_COMBAT", "ENTER_SITE", "EXPLORE",
        "FINALIZE_ATTACK", "FINALIZE_BLOCK", "FORFEIT_TURN", "FORFEIT_UNIT_REWARD",
        "INTERACT",
        "LEARN_ADVANCED", "LEARN_ADVANCED_ACTION",
        "MOVE",
        "PAY_HEROES_ASSAULT_INFLUENCE", "PAY_THUGS_DAMAGE_INFLUENCE",
        "PLAY_CARD", "PLAY_CARD_SIDEWAYS", "PLUNDER_VILLAGE",
        "PROPOSE_COOPERATIVE_ASSAULT",
        "RECRUIT_UNIT",
        "REROLL_SOURCE_DICE",
        "RESOLVE_ATTACK",
        "RESOLVE_BANNER_PROTECTION",
        "RESOLVE_BOOK_OF_WISDOM", "RESOLVE_CHOICE",
        "RESOLVE_CIRCLET_OF_PROFICIENCY",
        "RESOLVE_CRYSTAL_JOY_RECLAIM", "RESOLVE_CRYSTAL_ROLL_COLOR",
        "RESOLVE_DECOMPOSE",
        "RESOLVE_DEEP_MINE", "RESOLVE_DISCARD",
        "RESOLVE_DISCARD_FOR_BONUS",
        "RESOLVE_DISCARD_FOR_CRYSTAL", "RESOLVE_GLADE_WOUND",
        "RESOLVE_HEX_COST_REDUCTION", "RESOLVE_MAXIMAL_EFFECT",
        "RESOLVE_MEDITATION", "RESOLVE_SOURCE_OPENING_REROLL",
        "RESOLVE_STEADY_TEMPO", "RESOLVE_TACTIC_DECISION",
        "RESOLVE_TERRAIN_COST_REDUCTION",
        "RESOLVE_TOME_OF_ALL_SPELLS",
        "RESOLVE_TRAINING",
        "RESOLVE_UNIT_MAINTENANCE",
        "RESPOND_TO_COOPERATIVE_PROPOSAL",
        "REST", "RETURN_INTERACTIVE_SKILL",
        "SELECT_ARTIFACT", "SELECT_REWARD", "SELECT_TACTIC",
        "SPEND_MOVE_ON_CUMBERSOME",
        "UNASSIGN_ATTACK", "UNASSIGN_BLOCK",
        "UNDO", "USE_BANNER_COURAGE", "USE_BANNER_FEAR", "USE_SKILL",
    ],
);

// =============================================================================
// Mode Vocabulary (28 entries)
// =============================================================================

define_vocab!(MODE_VOCAB, "mode",
    ordered: [
        "cannot_act", "combat", "normal_turn",
        "pending_artifact_selection",
        "pending_banner_protection",
        "pending_book_of_wisdom", "pending_choice",
        "pending_crystal_joy_reclaim", "pending_crystal_roll",
        "pending_decompose",
        "pending_deep_mine", "pending_discard_cost",
        "pending_discard_for_bonus",
        "pending_discard_for_crystal", "pending_glade_wound",
        "pending_hex_cost_reduction", "pending_level_up",
        "pending_maximal_effect", "pending_meditation",
        "pending_plunder_decision",
        "pending_reward",
        "pending_source_opening_reroll", "pending_steady_tempo",
        "pending_tactic_decision", "pending_terrain_cost_reduction",
        "pending_training", "pending_unit_maintenance",
        "tactics_selection",
    ],
    sorted: [
        "cannot_act", "combat", "normal_turn",
        "pending_artifact_selection",
        "pending_banner_protection",
        "pending_book_of_wisdom", "pending_choice",
        "pending_crystal_joy_reclaim", "pending_crystal_roll",
        "pending_decompose",
        "pending_deep_mine", "pending_discard_cost",
        "pending_discard_for_bonus",
        "pending_discard_for_crystal", "pending_glade_wound",
        "pending_hex_cost_reduction", "pending_level_up",
        "pending_maximal_effect", "pending_meditation",
        "pending_plunder_decision",
        "pending_reward",
        "pending_source_opening_reroll", "pending_steady_tempo",
        "pending_tactic_decision", "pending_terrain_cost_reduction",
        "pending_training", "pending_unit_maintenance",
        "tactics_selection",
    ],
);

// =============================================================================
// Source Vocabulary (150 entries)
// =============================================================================

define_vocab!(SOURCE_VOCAB, "source",
    ordered: [
        "artifact_crystal_color", "artifact_selection.card",
        "banner_protection.remove", "banner_protection.skip",
        "book_of_wisdom.card",
        "circlet_of_proficiency.card",
        "combat.assign_attack", "combat.assign_block",
        "combat.assign_damage", "combat.banner_fear",
        "combat.convert_influence_to_block", "combat.convert_move_to_attack",
        "combat.cumbersome", "combat.declare_block",
        "combat.declare_block_target", "combat.declare_targets",
        "combat.end_phase",
        "combat.finalize_attack", "combat.finalize_block",
        "combat.heroes_assault_payment",
        "combat.play_card.basic", "combat.play_card.powered", "combat.play_card.sideways",
        "combat.play_card.sideways.move", "combat.play_card.sideways.influence",
        "combat.play_card.sideways.attack", "combat.play_card.sideways.block",
        "combat.resolve_attack",
        "combat.skills.activate", "combat.units.activate",
        "combat.thugs_payment",
        "combat.use_banner_courage",
        "cooperative.cancel", "cooperative.propose", "cooperative.respond",
        "crystal_joy.card", "crystal_joy.skip",
        "crystal_roll.color",
        "decompose.card", "deep_mine.color",
        "discard_cost.optional_skip", "discard_cost.required",
        "discard_for_attack.none", "discard_for_attack.one",
        "discard_for_bonus.choice",
        "discard_for_crystal.card", "discard_for_crystal.skip",
        "glade.discard", "glade.hand", "glade.skip",
        "hex_cost_reduction.coordinate",
        "level_up.common", "level_up.drawn",
        "maximal_effect.card",
        "meditation.done",
        "meditation.place.bottom", "meditation.place.top", "meditation.select",
        "normal.assign_banner",
        "normal.banners.assign", "normal.challenge", "normal.explore",
        "normal.learning_aa", "normal.move",
        "normal.play_card.basic", "normal.play_card.powered", "normal.play_card.sideways",
        "normal.play_card.sideways.move", "normal.play_card.sideways.influence",
        "normal.play_card.sideways.attack", "normal.play_card.sideways.block",
        "normal.site.add_elite_to_offer", "normal.site.altar_tribute",
        "normal.site.begin_interaction",
        "normal.site.burn_monastery", "normal.site.buy_aa",
        "normal.site.buy_artifact", "normal.site.buy_city_aa",
        "normal.site.buy_city_aa_deck",
        "normal.site.buy_spell", "normal.site.enter",
        "normal.site.heal", "normal.site.interact",
        "normal.skills.activate", "normal.skills.return",
        "normal.tactic.activate", "normal.tactic.pending",
        "normal.tactic.reroll",
        "normal.turn.announce_end_round", "normal.turn.complete_rest",
        "normal.turn.declare_rest", "normal.turn.end_turn", "normal.turn.forfeit",
        "normal.units.activate", "normal.units.recruit", "normal.units.recruit.disband",
        "pending.select_artifact",
        "plunder_decision.decline", "plunder_decision.plunder",
        "pending_choice.index",
        "pending_choice.gain_move", "pending_choice.gain_attack",
        "pending_choice.gain_block", "pending_choice.gain_healing",
        "pending_choice.gain_influence", "pending_choice.gain_mana",
        "pending_choice.draw_cards", "pending_choice.gain_fame",
        "pending_choice.gain_crystal", "pending_choice.apply_modifier",
        "pending_choice.change_reputation", "pending_choice.noop",
        "pending_choice.card_boost", "pending_choice.ready_unit",
        "pending_choice.compound", "pending_choice.conditional",
        "pending_choice.scaling",
        "pending_choice.scout_peek_hex", "pending_choice.scout_peek_pile",
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
        "tome_of_all_spells.card",
        "training.card",
        "turn.end_turn", "turn.undo",
        "unit_maintenance.disband", "unit_maintenance.keep",
        "unit_reward.disband", "unit_reward.forfeit",
        // Added: emitted by source_derivation for unit ability choices
        "pending_choice.add_siege_to_attacks",
        "pending_choice.gain_coldfire_attack",
        "pending_choice.gain_coldfire_block",
        "pending_choice.gain_mana_token",
        "pending_choice.transform_attacks_coldfire",
    ],
    sorted: [
        "artifact_crystal_color", "artifact_selection.card",
        "banner_protection.remove", "banner_protection.skip",
        "book_of_wisdom.card",
        "circlet_of_proficiency.card",
        "combat.assign_attack", "combat.assign_block",
        "combat.assign_damage", "combat.banner_fear",
        "combat.convert_influence_to_block", "combat.convert_move_to_attack",
        "combat.cumbersome",
        "combat.declare_block", "combat.declare_block_target", "combat.declare_targets",
        "combat.end_phase",
        "combat.finalize_attack", "combat.finalize_block",
        "combat.heroes_assault_payment",
        "combat.play_card.basic", "combat.play_card.powered", "combat.play_card.sideways",
        "combat.play_card.sideways.attack", "combat.play_card.sideways.block",
        "combat.play_card.sideways.influence", "combat.play_card.sideways.move",
        "combat.resolve_attack",
        "combat.skills.activate",
        "combat.thugs_payment",
        "combat.units.activate",
        "combat.use_banner_courage",
        "cooperative.cancel", "cooperative.propose", "cooperative.respond",
        "crystal_joy.card", "crystal_joy.skip",
        "crystal_roll.color",
        "decompose.card", "deep_mine.color",
        "discard_cost.optional_skip", "discard_cost.required",
        "discard_for_attack.none", "discard_for_attack.one",
        "discard_for_bonus.choice",
        "discard_for_crystal.card", "discard_for_crystal.skip",
        "glade.discard", "glade.hand", "glade.skip",
        "hex_cost_reduction.coordinate",
        "level_up.common", "level_up.drawn",
        "maximal_effect.card",
        "meditation.done",
        "meditation.place.bottom", "meditation.place.top", "meditation.select",
        "normal.assign_banner",
        "normal.banners.assign", "normal.challenge", "normal.explore",
        "normal.learning_aa", "normal.move",
        "normal.play_card.basic", "normal.play_card.powered", "normal.play_card.sideways",
        "normal.play_card.sideways.attack", "normal.play_card.sideways.block",
        "normal.play_card.sideways.influence", "normal.play_card.sideways.move",
        "normal.site.add_elite_to_offer", "normal.site.altar_tribute",
        "normal.site.begin_interaction",
        "normal.site.burn_monastery", "normal.site.buy_aa",
        "normal.site.buy_artifact", "normal.site.buy_city_aa",
        "normal.site.buy_city_aa_deck",
        "normal.site.buy_spell", "normal.site.enter",
        "normal.site.heal", "normal.site.interact",
        "normal.skills.activate", "normal.skills.return",
        "normal.tactic.activate", "normal.tactic.pending",
        "normal.tactic.reroll",
        "normal.turn.announce_end_round", "normal.turn.complete_rest",
        "normal.turn.declare_rest", "normal.turn.end_turn", "normal.turn.forfeit",
        "normal.units.activate", "normal.units.recruit", "normal.units.recruit.disband",
        "pending.select_artifact",
        "pending_choice.add_siege_to_attacks",
        "pending_choice.apply_modifier",
        "pending_choice.card_boost",
        "pending_choice.change_reputation",
        "pending_choice.compound",
        "pending_choice.conditional",
        "pending_choice.draw_cards",
        "pending_choice.gain_attack",
        "pending_choice.gain_block",
        "pending_choice.gain_coldfire_attack",
        "pending_choice.gain_coldfire_block",
        "pending_choice.gain_crystal",
        "pending_choice.gain_fame",
        "pending_choice.gain_healing",
        "pending_choice.gain_influence",
        "pending_choice.gain_mana",
        "pending_choice.gain_mana_token",
        "pending_choice.gain_move",
        "pending_choice.index",
        "pending_choice.noop",
        "pending_choice.ready_unit",
        "pending_choice.scaling",
        "pending_choice.scout_peek_hex", "pending_choice.scout_peek_pile",
        "pending_choice.transform_attacks_coldfire",
        "pending_reward.auto", "pending_reward.card",
        "pending_reward.unit", "pending_reward.unit.disband",
        "pending_tactic_decision.card",
        "pending_tactic_decision.cards.0",
        "pending_tactic_decision.cards.1",
        "pending_tactic_decision.cards.2",
        "pending_tactic_decision.cards.3",
        "pending_tactic_decision.die",
        "pending_tactic_decision.sparing.stash", "pending_tactic_decision.sparing.take",
        "plunder_decision.decline", "plunder_decision.plunder",
        "source_opening.keep", "source_opening.reroll",
        "steady_tempo.place", "steady_tempo.skip",
        "tactics.available",
        "terrain_cost_reduction.terrain",
        "tome_of_all_spells.card",
        "training.card",
        "turn.end_turn", "turn.undo",
        "unit_maintenance.disband", "unit_maintenance.keep",
        "unit_reward.disband", "unit_reward.forfeit",
    ],
);

// =============================================================================
// Site Vocabulary (18 entries)
// =============================================================================

define_vocab!(SITE_VOCAB, "site",
    ordered: [
        "village", "monastery", "magical_glade",
        "keep", "mage_tower",
        "ancient_ruins", "dungeon", "tomb", "monster_den", "spawning_grounds",
        "mine", "deep_mine", "portal",
        "city",
        "maze", "labyrinth", "refugee_camp", "volkares_camp",
    ],
    sorted: [
        "ancient_ruins", "city", "deep_mine", "dungeon",
        "keep", "labyrinth",
        "mage_tower", "magical_glade", "maze", "mine", "monastery", "monster_den",
        "portal",
        "refugee_camp",
        "spawning_grounds",
        "tomb",
        "village", "volkares_camp",
    ],
);

// =============================================================================
// Terrain Vocabulary (9 entries)
// =============================================================================

define_vocab!(TERRAIN_VOCAB, "terrain",
    ordered: [
        "plains", "hills", "forest", "wasteland", "desert",
        "swamp", "lake", "mountain", "ocean",
    ],
    sorted: [
        "desert", "forest", "hills", "lake", "mountain",
        "ocean", "plains", "swamp", "wasteland",
    ],
);

// =============================================================================
// Skill Vocabulary (70 entries)
// =============================================================================

define_vocab!(SKILL_VOCAB, "skill",
    ordered: [
        // Arythea (10)
        "arythea_dark_paths", "arythea_burning_power", "arythea_hot_swordsmanship",
        "arythea_dark_negotiation", "arythea_dark_fire_magic", "arythea_power_of_pain",
        "arythea_invocation", "arythea_polarization", "arythea_motivation",
        "arythea_ritual_of_pain",
        // Tovak (10)
        "tovak_double_time", "tovak_night_sharpshooting", "tovak_cold_swordsmanship",
        "tovak_shield_mastery", "tovak_resistance_break", "tovak_i_feel_no_pain",
        "tovak_i_dont_give_a_damn", "tovak_who_needs_magic", "tovak_motivation",
        "tovak_mana_overload",
        // Goldyx (10)
        "goldyx_freezing_power", "goldyx_potion_making", "goldyx_white_crystal_craft",
        "goldyx_green_crystal_craft", "goldyx_red_crystal_craft",
        "goldyx_glittering_fortune", "goldyx_flight", "goldyx_universal_power",
        "goldyx_motivation", "goldyx_source_opening",
        // Norowas (10)
        "norowas_forward_march", "norowas_day_sharpshooting", "norowas_inspiration",
        "norowas_bright_negotiation", "norowas_leaves_in_the_wind",
        "norowas_whispers_in_the_treetops", "norowas_leadership",
        "norowas_bonds_of_loyalty", "norowas_motivation", "norowas_prayer_of_weather",
        // Wolfhawk (10)
        "wolfhawk_refreshing_bath", "wolfhawk_refreshing_breeze", "wolfhawk_hawk_eyes",
        "wolfhawk_on_her_own", "wolfhawk_deadly_aim", "wolfhawk_know_your_prey",
        "wolfhawk_taunt", "wolfhawk_dueling", "wolfhawk_motivation",
        "wolfhawk_wolfs_howl",
        // Krang (10)
        "krang_spirit_guides", "krang_battle_hardened", "krang_battle_frenzy",
        "krang_shamanic_ritual", "krang_regenerate", "krang_arcane_disguise",
        "krang_puppet_master", "krang_master_of_chaos", "krang_curse",
        "krang_mana_enhancement",
        // Braevalar (10)
        "braevalar_elemental_resistance", "braevalar_feral_allies",
        "braevalar_thunderstorm", "braevalar_lightning_storm", "braevalar_beguile",
        "braevalar_forked_lightning", "braevalar_shapeshift", "braevalar_secret_ways",
        "braevalar_regenerate", "braevalar_natures_vengeance",
    ],
    sorted: [
        "arythea_burning_power", "arythea_dark_fire_magic", "arythea_dark_negotiation",
        "arythea_dark_paths", "arythea_hot_swordsmanship", "arythea_invocation",
        "arythea_motivation", "arythea_polarization", "arythea_power_of_pain",
        "arythea_ritual_of_pain",
        "braevalar_beguile", "braevalar_elemental_resistance", "braevalar_feral_allies",
        "braevalar_forked_lightning", "braevalar_lightning_storm",
        "braevalar_natures_vengeance", "braevalar_regenerate",
        "braevalar_secret_ways", "braevalar_shapeshift", "braevalar_thunderstorm",
        "goldyx_flight", "goldyx_freezing_power", "goldyx_glittering_fortune",
        "goldyx_green_crystal_craft", "goldyx_motivation", "goldyx_potion_making",
        "goldyx_red_crystal_craft", "goldyx_source_opening",
        "goldyx_universal_power", "goldyx_white_crystal_craft",
        "krang_arcane_disguise", "krang_battle_frenzy", "krang_battle_hardened",
        "krang_curse", "krang_mana_enhancement", "krang_master_of_chaos",
        "krang_puppet_master", "krang_regenerate", "krang_shamanic_ritual",
        "krang_spirit_guides",
        "norowas_bonds_of_loyalty", "norowas_bright_negotiation",
        "norowas_day_sharpshooting", "norowas_forward_march",
        "norowas_inspiration", "norowas_leadership",
        "norowas_leaves_in_the_wind", "norowas_motivation",
        "norowas_prayer_of_weather", "norowas_whispers_in_the_treetops",
        "tovak_cold_swordsmanship", "tovak_double_time",
        "tovak_i_dont_give_a_damn", "tovak_i_feel_no_pain",
        "tovak_mana_overload", "tovak_motivation",
        "tovak_night_sharpshooting", "tovak_resistance_break",
        "tovak_shield_mastery", "tovak_who_needs_magic",
        "wolfhawk_deadly_aim", "wolfhawk_dueling",
        "wolfhawk_hawk_eyes", "wolfhawk_know_your_prey",
        "wolfhawk_motivation", "wolfhawk_on_her_own",
        "wolfhawk_refreshing_bath", "wolfhawk_refreshing_breeze",
        "wolfhawk_taunt", "wolfhawk_wolfs_howl",
    ],
);

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_vocab_size() {
        assert_eq!(CARD_VOCAB.size(), 135); // 134 entries + UNK
    }

    #[test]
    fn unit_vocab_size() {
        assert_eq!(UNIT_VOCAB.size(), 32); // 31 entries + UNK
    }

    #[test]
    fn enemy_vocab_size() {
        assert_eq!(ENEMY_VOCAB.size(), 73); // 72 entries + UNK
    }

    #[test]
    fn action_type_vocab_size() {
        assert_eq!(ACTION_TYPE_VOCAB.size(), 89); // 88 entries + UNK
    }

    #[test]
    fn mode_vocab_size() {
        assert_eq!(MODE_VOCAB.size(), 29); // 28 entries + UNK
    }

    #[test]
    fn source_vocab_size() {
        // Count the ordered entries
        assert_eq!(SOURCE_VOCAB.size(), 151); // 150 entries + UNK
    }

    #[test]
    fn site_vocab_size() {
        assert_eq!(SITE_VOCAB.size(), 19); // 18 entries + UNK
    }

    #[test]
    fn terrain_vocab_size() {
        assert_eq!(TERRAIN_VOCAB.size(), 10); // 9 entries + UNK
    }

    #[test]
    fn skill_vocab_size() {
        assert_eq!(SKILL_VOCAB.size(), 71); // 70 entries + UNK
    }

    #[test]
    fn encode_known_card() {
        let idx = CARD_VOCAB.encode("march");
        assert!(idx > 0, "march should be in CARD_VOCAB");
    }

    #[test]
    fn encode_unknown_returns_zero() {
        assert_eq!(CARD_VOCAB.encode("nonexistent_card"), 0);
        assert_eq!(UNIT_VOCAB.encode(""), 0);
        assert_eq!(ENEMY_VOCAB.encode("unknown_enemy"), 0);
    }

    #[test]
    fn encode_known_unit() {
        let idx = UNIT_VOCAB.encode("peasants");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_enemy() {
        let idx = ENEMY_VOCAB.encode("fire_dragon");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_action_type() {
        let idx = ACTION_TYPE_VOCAB.encode("PLAY_CARD");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_mode() {
        let idx = MODE_VOCAB.encode("combat");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_source() {
        let idx = SOURCE_VOCAB.encode("normal.move");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_site() {
        let idx = SITE_VOCAB.encode("village");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_terrain() {
        let idx = TERRAIN_VOCAB.encode("plains");
        assert!(idx > 0);
    }

    #[test]
    fn encode_known_skill() {
        let idx = SKILL_VOCAB.encode("arythea_dark_paths");
        assert!(idx > 0);
    }

    #[test]
    fn contains_check() {
        assert!(CARD_VOCAB.contains("wound"));
        assert!(!CARD_VOCAB.contains("fake_card"));
    }

    #[test]
    fn sorted_arrays_match_ordered_lengths() {
        // Each vocab's sorted and ordered arrays must have the same length
        assert_eq!(CARD_VOCAB.entries.len(), CARD_VOCAB.ordered.len());
        assert_eq!(UNIT_VOCAB.entries.len(), UNIT_VOCAB.ordered.len());
        assert_eq!(ENEMY_VOCAB.entries.len(), ENEMY_VOCAB.ordered.len());
        assert_eq!(ACTION_TYPE_VOCAB.entries.len(), ACTION_TYPE_VOCAB.ordered.len());
        assert_eq!(MODE_VOCAB.entries.len(), MODE_VOCAB.ordered.len());
        assert_eq!(SOURCE_VOCAB.entries.len(), SOURCE_VOCAB.ordered.len());
        assert_eq!(SITE_VOCAB.entries.len(), SITE_VOCAB.ordered.len());
        assert_eq!(TERRAIN_VOCAB.entries.len(), TERRAIN_VOCAB.ordered.len());
        assert_eq!(SKILL_VOCAB.entries.len(), SKILL_VOCAB.ordered.len());
    }

    #[test]
    fn sorted_arrays_are_actually_sorted() {
        fn check_sorted(vocab: &Vocabulary) {
            for window in vocab.entries.windows(2) {
                assert!(
                    window[0] < window[1],
                    "{}: '{}' >= '{}' — sorted array is not sorted!",
                    vocab.name,
                    window[0],
                    window[1],
                );
            }
        }
        check_sorted(&CARD_VOCAB);
        check_sorted(&UNIT_VOCAB);
        check_sorted(&ENEMY_VOCAB);
        check_sorted(&ACTION_TYPE_VOCAB);
        check_sorted(&MODE_VOCAB);
        check_sorted(&SOURCE_VOCAB);
        check_sorted(&SITE_VOCAB);
        check_sorted(&TERRAIN_VOCAB);
        check_sorted(&SKILL_VOCAB);
    }

    #[test]
    fn sorted_arrays_contain_same_entries_as_ordered() {
        fn check_same_entries(vocab: &Vocabulary) {
            let mut sorted_copy: Vec<&str> = vocab.ordered.to_vec();
            sorted_copy.sort();
            let sorted_arr: Vec<&str> = vocab.entries.to_vec();
            assert_eq!(
                sorted_copy, sorted_arr,
                "{}: sorted and ordered arrays don't contain the same entries",
                vocab.name,
            );
        }
        check_same_entries(&CARD_VOCAB);
        check_same_entries(&UNIT_VOCAB);
        check_same_entries(&ENEMY_VOCAB);
        check_same_entries(&ACTION_TYPE_VOCAB);
        check_same_entries(&MODE_VOCAB);
        check_same_entries(&SOURCE_VOCAB);
        check_same_entries(&SITE_VOCAB);
        check_same_entries(&TERRAIN_VOCAB);
        check_same_entries(&SKILL_VOCAB);
    }

    /// Every string emitted by `derive_action_type()` in action_encoder.rs must
    /// resolve to a non-UNK index. This catches new action types added to the
    /// encoder but not to the vocab.
    #[test]
    fn action_type_vocab_covers_all_encoder_strings() {
        let encoder_strings = [
            "ACTIVATE_TACTIC", "ACTIVATE_UNIT", "ADD_ELITE_TO_OFFER",
            "ALTAR_TRIBUTE", "ANNOUNCE_END_OF_ROUND", "ASSIGN_BANNER",
            "ASSIGN_DAMAGE", "BEGIN_INTERACTION", "BURN_MONASTERY",
            "BUY_ARTIFACT", "BUY_CITY_ADVANCED_ACTION",
            "BUY_CITY_ADVANCED_ACTION_FROM_DECK", "BUY_SPELL",
            "CANCEL_COOPERATIVE_PROPOSAL", "CHALLENGE_RAMPAGING",
            "CHOOSE_LEVEL_UP_REWARDS", "COMPLETE_REST",
            "CONVERT_INFLUENCE_TO_BLOCK", "CONVERT_MOVE_TO_ATTACK",
            "DECLARE_ATTACK", "DECLARE_ATTACK_TARGETS", "DECLARE_BLOCK",
            "DECLARE_REST", "DECLINE_PLUNDER",
            "DISBAND_UNIT_FOR_REWARD",
            "END_COMBAT_PHASE", "END_TURN",
            "ENTER_SITE", "EXPLORE",
            "FINALIZE_ATTACK", "FINALIZE_BLOCK",
            "FORFEIT_TURN", "FORFEIT_UNIT_REWARD",
            "INTERACT",
            "LEARN_ADVANCED_ACTION", "MOVE",
            "PAY_HEROES_ASSAULT_INFLUENCE", "PAY_THUGS_DAMAGE_INFLUENCE",
            "PLAY_CARD", "PLAY_CARD_SIDEWAYS", "PLUNDER_VILLAGE",
            "PROPOSE_COOPERATIVE_ASSAULT",
            "RECRUIT_UNIT", "REROLL_SOURCE_DICE",
            "RESOLVE_ATTACK", "RESOLVE_BANNER_PROTECTION",
            "RESOLVE_BOOK_OF_WISDOM", "RESOLVE_CHOICE",
            "RESOLVE_CIRCLET_OF_PROFICIENCY",
            "RESOLVE_CRYSTAL_JOY_RECLAIM", "RESOLVE_CRYSTAL_ROLL_COLOR",
            "RESOLVE_DECOMPOSE", "RESOLVE_DISCARD_FOR_BONUS",
            "RESOLVE_DISCARD_FOR_CRYSTAL", "RESOLVE_GLADE_WOUND",
            "RESOLVE_HEX_COST_REDUCTION", "RESOLVE_MAXIMAL_EFFECT",
            "RESOLVE_MEDITATION", "RESOLVE_SOURCE_OPENING_REROLL",
            "RESOLVE_STEADY_TEMPO", "RESOLVE_TACTIC_DECISION",
            "RESOLVE_TERRAIN_COST_REDUCTION",
            "RESOLVE_TOME_OF_ALL_SPELLS",
            "RESOLVE_TRAINING", "RESOLVE_UNIT_MAINTENANCE",
            "RESPOND_TO_COOPERATIVE_PROPOSAL",
            "SELECT_ARTIFACT", "SELECT_REWARD", "SELECT_TACTIC",
            "SPEND_MOVE_ON_CUMBERSOME",
            "UNDO", "USE_BANNER_COURAGE", "USE_BANNER_FEAR", "USE_SKILL",
            "RETURN_INTERACTIVE_SKILL",
        ];
        for s in &encoder_strings {
            assert!(
                ACTION_TYPE_VOCAB.encode(s) > 0,
                "derive_action_type() emits '{}' but it maps to UNK (index 0) in ACTION_TYPE_VOCAB",
                s,
            );
        }
    }

    /// Every source string emitted by source_derivation.rs must resolve to a
    /// non-UNK index. This catches new sources added to the derivation logic
    /// but not to the vocab.
    #[test]
    fn source_vocab_covers_all_derivation_strings() {
        let derivation_strings = [
            // Unit ability choice sources
            "pending_choice.gain_mana_token",
            "pending_choice.gain_coldfire_attack",
            "pending_choice.gain_coldfire_block",
            "pending_choice.transform_attacks_coldfire",
            "pending_choice.add_siege_to_attacks",
            // Scout peek sources
            "pending_choice.scout_peek_hex",
            "pending_choice.scout_peek_pile",
            // Combat resolve attack
            "combat.resolve_attack",
        ];
        for s in &derivation_strings {
            assert!(
                SOURCE_VOCAB.encode(s) > 0,
                "source_derivation emits '{}' but it maps to UNK (index 0) in SOURCE_VOCAB",
                s,
            );
        }
    }
}
