//! Static unit definitions for all base game units.
//!
//! Each unit is a `&'static UnitDefinition` returned by `get_unit(id)`.
//! Uses compile-time constants for zero-allocation lookups.

use mk_types::enums::{BasicManaColor, Element, RecruitSite, ResistanceElement, Terrain};
use mk_types::pending::SelectEnemyTemplate;

// =============================================================================
// Ability types
// =============================================================================

/// A unit ability that can be activated.
///
/// Complex abilities (cancel attack, coordinated fire, etc.) are represented
/// as `Other` and not yet activatable.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UnitAbility {
    Attack { value: u32, element: Element },
    Block { value: u32, element: Element },
    RangedAttack { value: u32, element: Element },
    SiegeAttack { value: u32, element: Element },
    Move { value: u32 },
    Influence { value: u32 },
    Heal { value: u32 },
    /// Gain a mana token of the specified color (e.g., Herbalist green mana).
    GainMana { color: BasicManaColor },
    /// Gain a crystal of the specified color (e.g., Illusionists white crystal).
    GainCrystal { color: BasicManaColor },
    /// Gain both a mana token and a crystal (e.g., Fire/Ice Mages).
    GainManaAndCrystal { color: BasicManaColor },
    /// Attack with a reputation cost (Thugs).
    AttackWithRepCost { value: u32, element: Element, rep_change: i8 },
    /// Influence with a reputation cost (Thugs).
    InfluenceWithRepCost { value: u32, rep_change: i8 },
    /// Choose: gain move or influence (Magic Familiars). Creates pending choice.
    MoveOrInfluence { value: u32 },
    /// Choose: attack or block, then wound self (Utem Swordsmen). Creates pending choice.
    AttackOrBlockWoundSelf { value: u32, element: Element },
    /// Ready a spent unit at or below max_level (Herbalist).
    ReadyUnit { max_level: u8 },
    /// Grant Physical/Fire/Ice resistances to all units for the turn (Altem Guardians).
    GrantAllResistances,
    /// Select a combat enemy and apply template effects (cancel, weaken, freeze, etc.).
    SelectCombatEnemy(SelectEnemyTemplate),
    /// Ranged attack + unit attack bonus modifier (Shocktroops coordinated fire).
    CoordinatedFire { ranged_value: u32, element: Element, unit_attack_bonus: i32 },
    /// Move + terrain cost reductions (Foresters).
    MoveWithTerrainReduction {
        move_value: u32,
        /// (terrain, cost_change, minimum_cost) — cost_change is negative for reductions.
        terrain_reductions: &'static [(Terrain, i32, u32)],
    },
    /// Complex ability not yet modeled.
    Other { description: &'static str },
}

/// An ability slot on a unit — the ability itself plus optional mana cost.
#[derive(Debug, Clone, Copy)]
pub struct UnitAbilitySlot {
    pub ability: UnitAbility,
    pub mana_cost: Option<BasicManaColor>,
}

impl UnitAbilitySlot {
    const fn free(ability: UnitAbility) -> Self {
        Self { ability, mana_cost: None }
    }
    const fn costed(ability: UnitAbility, color: BasicManaColor) -> Self {
        Self { ability, mana_cost: Some(color) }
    }
}

// =============================================================================
// Types
// =============================================================================

/// Complete static unit definition.
#[derive(Debug)]
pub struct UnitDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub level: u8,
    pub influence_cost: u32,
    pub armor: u32,
    pub recruit_sites: &'static [RecruitSite],
    pub copies: u32,
    /// Thugs: reputation modifier is reversed.
    pub reversed_reputation: bool,
    /// Magic Familiars: cannot be recruited for free.
    pub restricted_from_free_recruit: bool,
    /// Hero units (hero_blue, hero_red, hero_green, hero_white).
    pub is_hero: bool,
    /// Unit abilities (activatable slots).
    pub abilities: &'static [UnitAbilitySlot],
}

// =============================================================================
// Ability constants — helpers for conciseness
// =============================================================================

const fn atk(value: u32, element: Element) -> UnitAbility { UnitAbility::Attack { value, element } }
const fn blk(value: u32, element: Element) -> UnitAbility { UnitAbility::Block { value, element } }
const fn rng(value: u32, element: Element) -> UnitAbility { UnitAbility::RangedAttack { value, element } }
const fn siege(value: u32, element: Element) -> UnitAbility { UnitAbility::SiegeAttack { value, element } }
const fn mov(value: u32) -> UnitAbility { UnitAbility::Move { value } }
const fn inf(value: u32) -> UnitAbility { UnitAbility::Influence { value } }
const fn heal(value: u32) -> UnitAbility { UnitAbility::Heal { value } }
const fn other(description: &'static str) -> UnitAbility { UnitAbility::Other { description } }

const P: Element = Element::Physical;
const F: Element = Element::Fire;
const I: Element = Element::Ice;
const CF: Element = Element::ColdFire;

// =============================================================================
// SelectCombatEnemy templates (10 const values)
// =============================================================================

/// Illusionists: cancel attack (white mana). Excludes fortified + arcane immune.
const CANCEL_ATTACK_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: true,
    exclude_arcane_immune: true,
    exclude_resistance: None,
    skip_attack: true,
    armor_change: 0, armor_minimum: 0,
    attack_change: 0, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: false, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Shocktroops: weaken (armor -1 min 1, attack -1 min 0).
const WEAKEN_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: -1, armor_minimum: 1,
    attack_change: -1, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: false, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Shocktroops: taunt (attack -3 min 0, damage redirect).
const TAUNT_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: 0, armor_minimum: 0,
    attack_change: -3, attack_minimum: 0,
    nullify_fortified: false, remove_resistances: false,
    fortified_armor_change: None,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    remove_fire_resistance: false,
    damage_redirect_from_unit: true, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Sorcerers: strip fortification + ranged 3 (white mana).
const STRIP_FORT_RANGED_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: 0, armor_minimum: 0, fortified_armor_change: None,
    attack_change: 0, attack_minimum: 0,
    nullify_fortified: true, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 3,
    armor_per_resistance: false,
};

/// Sorcerers: strip resistances + ranged 3 (green mana).
const STRIP_RESIST_RANGED_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: 0, armor_minimum: 0, fortified_armor_change: None,
    attack_change: 0, attack_minimum: 0,
    nullify_fortified: false, remove_resistances: true, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 3,
    armor_per_resistance: false,
};

/// Amotep Freezers: freeze (skip attack + armor -3 min 1, blue mana).
/// Excludes ice-resistant enemies.
const FREEZE_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: Some(ResistanceElement::Ice),
    skip_attack: true,
    armor_change: -3, armor_minimum: 1,
    attack_change: 0, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: false, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Delphana Masters: cancel (blue mana). Excludes arcane immune + ice resistant.
const DELPHANA_CANCEL_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: true,
    exclude_resistance: Some(ResistanceElement::Ice),
    skip_attack: true,
    armor_change: 0, armor_minimum: 0,
    attack_change: 0, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: false, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Delphana Masters: destroy if blocked (red mana). Excludes arcane immune + fire resistant.
const DESTROY_IF_BLOCKED_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: true,
    exclude_resistance: Some(ResistanceElement::Fire),
    skip_attack: false,
    armor_change: 0, armor_minimum: 0,
    attack_change: 0, attack_minimum: 0,
    nullify_fortified: false, remove_resistances: false,
    fortified_armor_change: None,
    defeat_if_blocked: true, defeat: false, nullify_all_attack_abilities: false,
    remove_fire_resistance: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Delphana Masters: armor -5 (green mana).
const ARMOR_MINUS_5_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: -5, armor_minimum: 1,
    attack_change: 0, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: false, remove_resistances: false, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

/// Delphana Masters: strip defenses (white mana). Nullify fortified + remove resistances.
const STRIP_DEFENSES_TEMPLATE: SelectEnemyTemplate = SelectEnemyTemplate {
    exclude_fortified: false, exclude_arcane_immune: false,
    exclude_resistance: None,
    skip_attack: false,
    armor_change: 0, armor_minimum: 0,
    attack_change: 0, attack_minimum: 0,
    fortified_armor_change: None,
    nullify_fortified: true, remove_resistances: true, remove_fire_resistance: false,
    defeat_if_blocked: false, defeat: false, nullify_all_attack_abilities: false,
    damage_redirect_from_unit: false, bundled_ranged_attack: 0,
    armor_per_resistance: false,
};

// =============================================================================
// Regular units (Level 1-2) — 15 entries
// =============================================================================

static PEASANTS: UnitDefinition = UnitDefinition {
    id: "peasants", name: "Peasants", level: 1, influence_cost: 4, armor: 3,
    recruit_sites: &[RecruitSite::Village],
    copies: 3, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(2, P)),
        UnitAbilitySlot::free(blk(2, P)),
        UnitAbilitySlot::free(inf(2)),
        UnitAbilitySlot::free(mov(2)),
    ],
};

static FORESTERS: UnitDefinition = UnitDefinition {
    id: "foresters", name: "Foresters", level: 1, influence_cost: 5, armor: 4,
    recruit_sites: &[RecruitSite::Village],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::free(UnitAbility::MoveWithTerrainReduction {
            move_value: 2,
            terrain_reductions: &[
                (Terrain::Forest, -1, 0),
                (Terrain::Hills, -1, 0),
                (Terrain::Swamp, -1, 0),
            ],
        }),
    ],
};

static HERBALIST: UnitDefinition = UnitDefinition {
    id: "herbalist", name: "Herbalist", level: 1, influence_cost: 3, armor: 2,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Monastery],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::costed(heal(2), BasicManaColor::Green),
        UnitAbilitySlot::free(UnitAbility::ReadyUnit { max_level: 2 }),
        UnitAbilitySlot::free(UnitAbility::GainMana { color: BasicManaColor::Green }),
    ],
};

static SCOUTS: UnitDefinition = UnitDefinition {
    id: "scouts", name: "Scouts", level: 1, influence_cost: 4, armor: 2,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::MageTower, RecruitSite::Monastery, RecruitSite::City],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(siege(1, P)),
        UnitAbilitySlot::free(other("scout peek")),
        UnitAbilitySlot::free(other("move 2 + explore")),
    ],
};

static THUGS: UnitDefinition = UnitDefinition {
    id: "thugs", name: "Thugs", level: 1, influence_cost: 5, armor: 5,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep],
    copies: 2, reversed_reputation: true, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::free(UnitAbility::AttackWithRepCost { value: 3, element: P, rep_change: -1 }),
        UnitAbilitySlot::free(UnitAbility::InfluenceWithRepCost { value: 4, rep_change: -1 }),
    ],
};

static UTEM_CROSSBOWMEN: UnitDefinition = UnitDefinition {
    id: "utem_crossbowmen", name: "Utem Crossbowmen", level: 2, influence_cost: 6, armor: 4,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::free(rng(2, P)),
    ],
};

static UTEM_GUARDSMEN: UnitDefinition = UnitDefinition {
    id: "utem_guardsmen", name: "Utem Guardsmen", level: 2, influence_cost: 5, armor: 5,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(2, P)),
        UnitAbilitySlot::free(blk(4, P)),
    ],
};

static UTEM_SWORDSMEN: UnitDefinition = UnitDefinition {
    id: "utem_swordsmen", name: "Utem Swordsmen", level: 2, influence_cost: 6, armor: 4,
    recruit_sites: &[RecruitSite::Keep],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::free(UnitAbility::AttackOrBlockWoundSelf { value: 6, element: P }),
    ],
};

static GUARDIAN_GOLEMS: UnitDefinition = UnitDefinition {
    id: "guardian_golems", name: "Guardian Golems", level: 2, influence_cost: 7, armor: 3,
    recruit_sites: &[RecruitSite::MageTower, RecruitSite::Keep],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(2, P)),
        UnitAbilitySlot::free(blk(2, P)),
        UnitAbilitySlot::costed(blk(4, F), BasicManaColor::Red),
        UnitAbilitySlot::costed(blk(4, I), BasicManaColor::Blue),
    ],
};

static ILLUSIONISTS: UnitDefinition = UnitDefinition {
    id: "illusionists", name: "Illusionists", level: 2, influence_cost: 7, armor: 2,
    recruit_sites: &[RecruitSite::MageTower, RecruitSite::Monastery],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(inf(4)),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(CANCEL_ATTACK_TEMPLATE), BasicManaColor::White),
        UnitAbilitySlot::free(UnitAbility::GainCrystal { color: BasicManaColor::White }),
    ],
};

static SHOCKTROOPS: UnitDefinition = UnitDefinition {
    id: "shocktroops", name: "Shocktroops", level: 2, influence_cost: 6, armor: 3,
    recruit_sites: &[RecruitSite::Keep],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(UnitAbility::CoordinatedFire { ranged_value: 1, element: P, unit_attack_bonus: 1 }),
        UnitAbilitySlot::free(UnitAbility::SelectCombatEnemy(WEAKEN_TEMPLATE)),
        UnitAbilitySlot::free(UnitAbility::SelectCombatEnemy(TAUNT_TEMPLATE)),
    ],
};

static RED_CAPE_MONKS: UnitDefinition = UnitDefinition {
    id: "red_cape_monks", name: "Red Cape Monks", level: 2, influence_cost: 7, armor: 4,
    recruit_sites: &[RecruitSite::Monastery],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::costed(atk(4, F), BasicManaColor::Red),
        UnitAbilitySlot::costed(blk(4, F), BasicManaColor::Red),
    ],
};

static NORTHERN_MONKS: UnitDefinition = UnitDefinition {
    id: "northern_monks", name: "Northern Monks", level: 2, influence_cost: 7, armor: 4,
    recruit_sites: &[RecruitSite::Monastery],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::costed(atk(4, I), BasicManaColor::Blue),
        UnitAbilitySlot::costed(blk(4, I), BasicManaColor::Blue),
    ],
};

static SAVAGE_MONKS: UnitDefinition = UnitDefinition {
    id: "savage_monks", name: "Savage Monks", level: 2, influence_cost: 7, armor: 4,
    recruit_sites: &[RecruitSite::Monastery],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::costed(siege(4, P), BasicManaColor::Green),
    ],
};

static MAGIC_FAMILIARS: UnitDefinition = UnitDefinition {
    id: "magic_familiars", name: "Magic Familiars", level: 2, influence_cost: 6, armor: 5,
    recruit_sites: &[RecruitSite::Monastery, RecruitSite::MageTower, RecruitSite::MagicalGlade],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: true, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(4, P)),
        UnitAbilitySlot::free(UnitAbility::MoveOrInfluence { value: 3 }),
        UnitAbilitySlot::free(heal(2)),
    ],
};

// =============================================================================
// Elite units (Level 3-4) — 16 entries
// =============================================================================

static FIRE_MAGES: UnitDefinition = UnitDefinition {
    id: "fire_mages", name: "Fire Mages", level: 3, influence_cost: 9, armor: 3,
    recruit_sites: &[RecruitSite::MageTower, RecruitSite::Monastery],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(rng(3, F)),
        UnitAbilitySlot::costed(atk(6, F), BasicManaColor::Red),
        UnitAbilitySlot::costed(blk(6, F), BasicManaColor::Red),
        UnitAbilitySlot::free(UnitAbility::GainManaAndCrystal { color: BasicManaColor::Red }),
    ],
};

static ICE_MAGES: UnitDefinition = UnitDefinition {
    id: "ice_mages", name: "Ice Mages", level: 3, influence_cost: 9, armor: 4,
    recruit_sites: &[RecruitSite::MageTower, RecruitSite::Monastery],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(4, I)),
        UnitAbilitySlot::free(blk(4, I)),
        UnitAbilitySlot::costed(siege(4, I), BasicManaColor::Blue),
        UnitAbilitySlot::free(UnitAbility::GainManaAndCrystal { color: BasicManaColor::Blue }),
    ],
};

static FIRE_GOLEMS: UnitDefinition = UnitDefinition {
    id: "fire_golems", name: "Fire Golems", level: 3, influence_cost: 8, armor: 4,
    recruit_sites: &[RecruitSite::Keep, RecruitSite::MageTower],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, P)),
        UnitAbilitySlot::free(blk(3, P)),
        UnitAbilitySlot::costed(rng(4, F), BasicManaColor::Red),
    ],
};

static ICE_GOLEMS: UnitDefinition = UnitDefinition {
    id: "ice_golems", name: "Ice Golems", level: 3, influence_cost: 8, armor: 4,
    recruit_sites: &[RecruitSite::Keep, RecruitSite::MageTower],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(3, I)),
        UnitAbilitySlot::free(blk(3, I)),
        UnitAbilitySlot::costed(atk(6, I), BasicManaColor::Blue),
    ],
};

static SORCERERS: UnitDefinition = UnitDefinition {
    id: "sorcerers", name: "Sorcerers", level: 3, influence_cost: 9, armor: 4,
    recruit_sites: &[RecruitSite::MageTower, RecruitSite::Monastery],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(rng(3, P)),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(STRIP_FORT_RANGED_TEMPLATE), BasicManaColor::White),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(STRIP_RESIST_RANGED_TEMPLATE), BasicManaColor::Green),
    ],
};

static CATAPULTS: UnitDefinition = UnitDefinition {
    id: "catapults", name: "Catapults", level: 3, influence_cost: 9, armor: 4,
    recruit_sites: &[RecruitSite::Keep, RecruitSite::City],
    copies: 3, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(siege(3, P)),
        UnitAbilitySlot::costed(siege(5, F), BasicManaColor::Red),
        UnitAbilitySlot::costed(siege(5, I), BasicManaColor::Blue),
    ],
};

static AMOTEP_GUNNERS: UnitDefinition = UnitDefinition {
    id: "amotep_gunners", name: "Amotep Gunners", level: 3, influence_cost: 8, armor: 6,
    recruit_sites: &[RecruitSite::Keep, RecruitSite::City],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::costed(rng(6, F), BasicManaColor::Red),
    ],
};

static AMOTEP_FREEZERS: UnitDefinition = UnitDefinition {
    id: "amotep_freezers", name: "Amotep Freezers", level: 3, influence_cost: 8, armor: 6,
    recruit_sites: &[RecruitSite::Keep, RecruitSite::City],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(FREEZE_TEMPLATE), BasicManaColor::Blue),
    ],
};

static HEROES: UnitDefinition = UnitDefinition {
    id: "heroes", name: "Heroes", level: 3, influence_cost: 9, armor: 5,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::City],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::free(inf(5)),
    ],
};

static HERO_BLUE: UnitDefinition = UnitDefinition {
    id: "hero_blue", name: "Hero (Blue)", level: 3, influence_cost: 9, armor: 4,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::City],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: true,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::free(inf(5)),
        UnitAbilitySlot::costed(blk(8, CF), BasicManaColor::Blue),
    ],
};

static HERO_RED: UnitDefinition = UnitDefinition {
    id: "hero_red", name: "Hero (Red)", level: 3, influence_cost: 9, armor: 4,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::City],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: true,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::free(inf(5)),
        UnitAbilitySlot::costed(atk(6, CF), BasicManaColor::Red),
    ],
};

static HERO_GREEN: UnitDefinition = UnitDefinition {
    id: "hero_green", name: "Hero (Green)", level: 3, influence_cost: 9, armor: 3,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::City],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: true,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::free(inf(5)),
        UnitAbilitySlot::costed(heal(4), BasicManaColor::Green),
    ],
};

static HERO_WHITE: UnitDefinition = UnitDefinition {
    id: "hero_white", name: "Hero (White)", level: 3, influence_cost: 9, armor: 6,
    recruit_sites: &[RecruitSite::Village, RecruitSite::Keep, RecruitSite::City],
    copies: 1, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: true,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(5, P)),
        UnitAbilitySlot::free(inf(5)),
        UnitAbilitySlot::costed(rng(7, P), BasicManaColor::White),
    ],
};

static ALTEM_MAGES: UnitDefinition = UnitDefinition {
    id: "altem_mages", name: "Altem Mages", level: 4, influence_cost: 12, armor: 5,
    recruit_sites: &[RecruitSite::City],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(other("gain 2 mana")),
        UnitAbilitySlot::free(other("coldfire 5-9")),
        UnitAbilitySlot::free(other("attack modifier")),
    ],
};

static ALTEM_GUARDIANS: UnitDefinition = UnitDefinition {
    id: "altem_guardians", name: "Altem Guardians", level: 4, influence_cost: 11, armor: 7,
    recruit_sites: &[RecruitSite::City],
    copies: 3, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::free(atk(5, P)),
        UnitAbilitySlot::free(blk(8, P)),
        UnitAbilitySlot::free(UnitAbility::GrantAllResistances),
    ],
};

static DELPHANA_MASTERS: UnitDefinition = UnitDefinition {
    id: "delphana_masters", name: "Delphana Masters", level: 4, influence_cost: 13, armor: 3,
    recruit_sites: &[RecruitSite::City],
    copies: 2, reversed_reputation: false, restricted_from_free_recruit: false, is_hero: false,
    abilities: &[
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(DELPHANA_CANCEL_TEMPLATE), BasicManaColor::Blue),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(DESTROY_IF_BLOCKED_TEMPLATE), BasicManaColor::Red),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(ARMOR_MINUS_5_TEMPLATE), BasicManaColor::Green),
        UnitAbilitySlot::costed(UnitAbility::SelectCombatEnemy(STRIP_DEFENSES_TEMPLATE), BasicManaColor::White),
    ],
};

// =============================================================================
// Registry
// =============================================================================

/// All unit definitions indexed by ID.
static ALL_UNITS: &[&UnitDefinition] = &[
    // Regular (15)
    &PEASANTS, &FORESTERS, &HERBALIST, &SCOUTS, &THUGS,
    &UTEM_CROSSBOWMEN, &UTEM_GUARDSMEN, &UTEM_SWORDSMEN,
    &GUARDIAN_GOLEMS, &ILLUSIONISTS, &SHOCKTROOPS,
    &RED_CAPE_MONKS, &NORTHERN_MONKS, &SAVAGE_MONKS,
    &MAGIC_FAMILIARS,
    // Elite (16)
    &FIRE_MAGES, &ICE_MAGES, &FIRE_GOLEMS, &ICE_GOLEMS,
    &SORCERERS, &CATAPULTS, &AMOTEP_GUNNERS, &AMOTEP_FREEZERS,
    &HEROES, &HERO_BLUE, &HERO_RED, &HERO_GREEN, &HERO_WHITE,
    &ALTEM_MAGES, &ALTEM_GUARDIANS, &DELPHANA_MASTERS,
];

/// Look up a unit by ID.
pub fn get_unit(id: &str) -> Option<&'static UnitDefinition> {
    ALL_UNITS.iter().find(|u| u.id == id).copied()
}

/// All regular unit IDs (level 1-2).
pub fn all_regular_unit_ids() -> &'static [&'static str] {
    static IDS: &[&str] = &[
        "peasants", "foresters", "herbalist", "scouts", "thugs",
        "utem_crossbowmen", "utem_guardsmen", "utem_swordsmen",
        "guardian_golems", "illusionists", "shocktroops",
        "red_cape_monks", "northern_monks", "savage_monks",
        "magic_familiars",
    ];
    IDS
}

/// All elite unit IDs (level 3-4).
pub fn all_elite_unit_ids() -> &'static [&'static str] {
    static IDS: &[&str] = &[
        "fire_mages", "ice_mages", "fire_golems", "ice_golems",
        "sorcerers", "catapults", "amotep_gunners", "amotep_freezers",
        "heroes", "hero_blue", "hero_red", "hero_green", "hero_white",
        "altem_mages", "altem_guardians", "delphana_masters",
    ];
    IDS
}

/// Check if a unit ID is a hero unit.
pub fn is_hero_unit(id: &str) -> bool {
    get_unit(id).is_some_and(|u| u.is_hero)
}

/// Check if a unit ability is a combat ability (usable during combat).
pub fn is_combat_ability(ability: &UnitAbility) -> bool {
    matches!(
        ability,
        UnitAbility::Attack { .. }
            | UnitAbility::Block { .. }
            | UnitAbility::RangedAttack { .. }
            | UnitAbility::SiegeAttack { .. }
            | UnitAbility::AttackWithRepCost { .. }
            | UnitAbility::AttackOrBlockWoundSelf { .. }
            | UnitAbility::SelectCombatEnemy(_)
            | UnitAbility::CoordinatedFire { .. }
    )
}

/// Check if a unit ability is a non-combat ability (usable outside combat).
pub fn is_noncombat_ability(ability: &UnitAbility) -> bool {
    matches!(
        ability,
        UnitAbility::Move { .. }
            | UnitAbility::Influence { .. }
            | UnitAbility::Heal { .. }
            | UnitAbility::GainMana { .. }
            | UnitAbility::GainCrystal { .. }
            | UnitAbility::GainManaAndCrystal { .. }
            | UnitAbility::InfluenceWithRepCost { .. }
            | UnitAbility::MoveOrInfluence { .. }
            | UnitAbility::ReadyUnit { .. }
            | UnitAbility::GrantAllResistances
            | UnitAbility::MoveWithTerrainReduction { .. }
    )
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_unit_known() {
        let u = get_unit("peasants").unwrap();
        assert_eq!(u.name, "Peasants");
        assert_eq!(u.level, 1);
        assert_eq!(u.influence_cost, 4);
        assert_eq!(u.armor, 3);
        assert_eq!(u.copies, 3);
    }

    #[test]
    fn get_unit_unknown() {
        assert!(get_unit("nonexistent").is_none());
    }

    #[test]
    fn all_regular_count() {
        assert_eq!(all_regular_unit_ids().len(), 15);
    }

    #[test]
    fn all_elite_count() {
        assert_eq!(all_elite_unit_ids().len(), 16);
    }

    #[test]
    fn all_regular_resolve() {
        for id in all_regular_unit_ids() {
            assert!(get_unit(id).is_some(), "Regular unit '{}' not found", id);
            let u = get_unit(id).unwrap();
            assert!(u.level <= 2, "Regular unit '{}' has level {}", id, u.level);
        }
    }

    #[test]
    fn all_elite_resolve() {
        for id in all_elite_unit_ids() {
            assert!(get_unit(id).is_some(), "Elite unit '{}' not found", id);
            let u = get_unit(id).unwrap();
            assert!(u.level >= 3, "Elite unit '{}' has level {}", id, u.level);
        }
    }

    #[test]
    fn is_hero_checks() {
        assert!(is_hero_unit("hero_blue"));
        assert!(is_hero_unit("hero_red"));
        assert!(is_hero_unit("hero_green"));
        assert!(is_hero_unit("hero_white"));
        assert!(!is_hero_unit("heroes")); // generic Heroes unit is NOT a hero
        assert!(!is_hero_unit("peasants"));
        assert!(!is_hero_unit("thugs"));
    }

    #[test]
    fn thugs_have_reversed_reputation() {
        let u = get_unit("thugs").unwrap();
        assert!(u.reversed_reputation);
    }

    #[test]
    fn magic_familiars_restricted() {
        let u = get_unit("magic_familiars").unwrap();
        assert!(u.restricted_from_free_recruit);
    }

    #[test]
    fn total_unit_count() {
        assert_eq!(
            all_regular_unit_ids().len() + all_elite_unit_ids().len(),
            31,
            "Should have 31 total units"
        );
    }

    #[test]
    fn no_duplicate_ids() {
        let mut all_ids: Vec<&str> = Vec::new();
        all_ids.extend_from_slice(all_regular_unit_ids());
        all_ids.extend_from_slice(all_elite_unit_ids());
        let original_len = all_ids.len();
        all_ids.sort();
        all_ids.dedup();
        assert_eq!(all_ids.len(), original_len, "Duplicate unit IDs found");
    }

    // --- Ability tests ---

    #[test]
    fn peasants_have_four_abilities() {
        let u = get_unit("peasants").unwrap();
        assert_eq!(u.abilities.len(), 4);
        assert!(matches!(u.abilities[0].ability, UnitAbility::Attack { value: 2, element: Element::Physical }));
        assert!(matches!(u.abilities[1].ability, UnitAbility::Block { value: 2, element: Element::Physical }));
        assert!(matches!(u.abilities[2].ability, UnitAbility::Influence { value: 2 }));
        assert!(matches!(u.abilities[3].ability, UnitAbility::Move { value: 2 }));
        // All free (no mana cost)
        assert!(u.abilities.iter().all(|a| a.mana_cost.is_none()));
    }

    #[test]
    fn guardian_golems_mana_costed_abilities() {
        let u = get_unit("guardian_golems").unwrap();
        assert_eq!(u.abilities.len(), 4);
        assert!(u.abilities[0].mana_cost.is_none()); // Attack 2 free
        assert!(u.abilities[1].mana_cost.is_none()); // Block 2 free
        assert_eq!(u.abilities[2].mana_cost, Some(BasicManaColor::Red)); // Block 4 Fire (red)
        assert_eq!(u.abilities[3].mana_cost, Some(BasicManaColor::Blue)); // Block 4 Ice (blue)
    }

    #[test]
    fn catapults_all_siege() {
        let u = get_unit("catapults").unwrap();
        assert_eq!(u.abilities.len(), 3);
        for slot in u.abilities {
            assert!(matches!(slot.ability, UnitAbility::SiegeAttack { .. }));
        }
        assert!(u.abilities[0].mana_cost.is_none());
        assert_eq!(u.abilities[1].mana_cost, Some(BasicManaColor::Red));
        assert_eq!(u.abilities[2].mana_cost, Some(BasicManaColor::Blue));
    }

    #[test]
    fn hero_white_ranged_ability() {
        let u = get_unit("hero_white").unwrap();
        assert_eq!(u.abilities.len(), 4);
        let slot = &u.abilities[3];
        assert!(matches!(slot.ability, UnitAbility::RangedAttack { value: 7, element: Element::Physical }));
        assert_eq!(slot.mana_cost, Some(BasicManaColor::White));
    }

    #[test]
    fn all_units_have_abilities() {
        for id in all_regular_unit_ids().iter().chain(all_elite_unit_ids().iter()) {
            let u = get_unit(id).unwrap();
            assert!(!u.abilities.is_empty(), "Unit '{}' has no abilities", id);
        }
    }

    #[test]
    fn shocktroops_abilities() {
        let u = get_unit("shocktroops").unwrap();
        assert_eq!(u.abilities.len(), 3);
        assert!(matches!(u.abilities[0].ability, UnitAbility::CoordinatedFire { .. }));
        assert!(matches!(u.abilities[1].ability, UnitAbility::SelectCombatEnemy(_)));
        assert!(matches!(u.abilities[2].ability, UnitAbility::SelectCombatEnemy(_)));
    }

    #[test]
    fn combat_noncombat_classification() {
        assert!(is_combat_ability(&UnitAbility::Attack { value: 3, element: Element::Physical }));
        assert!(is_combat_ability(&UnitAbility::Block { value: 3, element: Element::Physical }));
        assert!(is_combat_ability(&UnitAbility::RangedAttack { value: 2, element: Element::Fire }));
        assert!(is_combat_ability(&UnitAbility::SiegeAttack { value: 1, element: Element::Physical }));
        assert!(is_combat_ability(&UnitAbility::AttackWithRepCost { value: 3, element: Element::Physical, rep_change: -1 }));
        assert!(is_combat_ability(&UnitAbility::AttackOrBlockWoundSelf { value: 6, element: Element::Physical }));
        assert!(!is_combat_ability(&UnitAbility::Move { value: 2 }));
        assert!(!is_combat_ability(&UnitAbility::Influence { value: 2 }));
        assert!(!is_combat_ability(&UnitAbility::Heal { value: 2 }));
        assert!(!is_combat_ability(&UnitAbility::GainMana { color: BasicManaColor::Green }));

        assert!(is_noncombat_ability(&UnitAbility::Move { value: 2 }));
        assert!(is_noncombat_ability(&UnitAbility::Influence { value: 2 }));
        assert!(is_noncombat_ability(&UnitAbility::Heal { value: 2 }));
        assert!(is_noncombat_ability(&UnitAbility::GainMana { color: BasicManaColor::Green }));
        assert!(is_noncombat_ability(&UnitAbility::GainCrystal { color: BasicManaColor::White }));
        assert!(is_noncombat_ability(&UnitAbility::GainManaAndCrystal { color: BasicManaColor::Red }));
        assert!(is_noncombat_ability(&UnitAbility::InfluenceWithRepCost { value: 4, rep_change: -1 }));
        assert!(is_noncombat_ability(&UnitAbility::MoveOrInfluence { value: 3 }));
        assert!(is_noncombat_ability(&UnitAbility::ReadyUnit { max_level: 2 }));
        assert!(is_noncombat_ability(&UnitAbility::GrantAllResistances));
        assert!(!is_noncombat_ability(&UnitAbility::Attack { value: 3, element: Element::Physical }));

        // New combat abilities
        assert!(is_combat_ability(&UnitAbility::SelectCombatEnemy(SelectEnemyTemplate::new())));
        assert!(is_combat_ability(&UnitAbility::CoordinatedFire { ranged_value: 1, element: Element::Physical, unit_attack_bonus: 1 }));
        assert!(!is_noncombat_ability(&UnitAbility::SelectCombatEnemy(SelectEnemyTemplate::new())));
        assert!(!is_noncombat_ability(&UnitAbility::CoordinatedFire { ranged_value: 1, element: Element::Physical, unit_attack_bonus: 1 }));
    }
}
