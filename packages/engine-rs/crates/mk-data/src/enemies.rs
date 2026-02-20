//! Static enemy definitions for all base game + Lost Legion enemies.
//!
//! Each enemy is a `&'static EnemyDefinition` returned by `get_enemy(id)`.
//! Uses compile-time constants for zero-allocation lookups.

use mk_types::enums::{EnemyAbilityType, EnemyColor, Element, ResistanceElement};

// =============================================================================
// Types
// =============================================================================

/// A single attack instance for enemies with multiple attacks.
#[derive(Debug, Clone, Copy)]
pub struct EnemyAttack {
    pub damage: u32,
    pub element: Element,
    pub ability: Option<EnemyAbilityType>,
}

/// Complete static enemy definition.
#[derive(Debug)]
pub struct EnemyDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub color: EnemyColor,
    pub attack: u32,
    pub attack_element: Element,
    pub armor: u32,
    pub fame: u32,
    pub resistances: &'static [ResistanceElement],
    pub abilities: &'static [EnemyAbilityType],
    /// Multi-attack: overrides single attack/attack_element when present.
    pub attacks: Option<&'static [EnemyAttack]>,
    pub reputation_penalty: Option<u32>,
    pub reputation_bonus: Option<u32>,
    /// Higher armor for Elusive enemies.
    pub armor_elusive: Option<u32>,
    /// Defend bonus value.
    pub defend: Option<u32>,
}

// =============================================================================
// GREEN enemies (20) — Marauding Orcs
// =============================================================================

static DIGGERS: EnemyDefinition = EnemyDefinition {
    id: "diggers", name: "Diggers", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 3, fame: 2,
    resistances: &[], abilities: &[EnemyAbilityType::Fortified],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static PROWLERS: EnemyDefinition = EnemyDefinition {
    id: "prowlers", name: "Prowlers", color: EnemyColor::Green,
    attack: 4, attack_element: Element::Physical, armor: 3, fame: 2,
    resistances: &[], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static CURSED_HAGS: EnemyDefinition = EnemyDefinition {
    id: "cursed_hags", name: "Cursed Hags", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 5, fame: 3,
    resistances: &[], abilities: &[EnemyAbilityType::Poison],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static WOLF_RIDERS: EnemyDefinition = EnemyDefinition {
    id: "wolf_riders", name: "Wolf Riders", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 4, fame: 3,
    resistances: &[], abilities: &[EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static IRONCLADS: EnemyDefinition = EnemyDefinition {
    id: "ironclads", name: "Ironclads", color: EnemyColor::Green,
    attack: 4, attack_element: Element::Physical, armor: 3, fame: 4,
    resistances: &[ResistanceElement::Physical], abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ORC_SUMMONERS: EnemyDefinition = EnemyDefinition {
    id: "orc_summoners", name: "Orc Summoners", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 4, fame: 4,
    resistances: &[], abilities: &[EnemyAbilityType::Summon],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static CENTAUR_OUTRIDERS: EnemyDefinition = EnemyDefinition {
    id: "centaur_outriders", name: "Centaur Outriders", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 5, fame: 2,
    resistances: &[], abilities: &[EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ORC_SKIRMISHERS_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 1, element: Element::Physical, ability: None },
    EnemyAttack { damage: 1, element: Element::Physical, ability: None },
];

static ORC_SKIRMISHERS: EnemyDefinition = EnemyDefinition {
    id: "orc_skirmishers", name: "Orc Skirmishers", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 4, fame: 2,
    resistances: &[], abilities: &[],
    attacks: Some(&ORC_SKIRMISHERS_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ORC_WAR_BEASTS: EnemyDefinition = EnemyDefinition {
    id: "orc_war_beasts", name: "Orc War Beasts", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 5, fame: 3,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Unfortified, EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ORC_STONETHROWERS: EnemyDefinition = EnemyDefinition {
    id: "orc_stonethrowers", name: "Orc Stonethrowers", color: EnemyColor::Green,
    attack: 7, attack_element: Element::Physical, armor: 2, fame: 4,
    resistances: &[ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::Cumbersome],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ORC_TRACKER: EnemyDefinition = EnemyDefinition {
    id: "orc_tracker", name: "Orc Tracker", color: EnemyColor::Green,
    attack: 4, attack_element: Element::Physical, armor: 3, fame: 3,
    resistances: &[],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Assassination],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(6), defend: None,
};

static SKELETAL_WARRIORS: EnemyDefinition = EnemyDefinition {
    id: "skeletal_warriors", name: "Skeletal Warriors", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 4, fame: 1,
    resistances: &[ResistanceElement::Fire], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SHROUDED_NECROMANCERS: EnemyDefinition = EnemyDefinition {
    id: "shrouded_necromancers", name: "Shrouded Necromancers", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 5, fame: 3,
    resistances: &[],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::SummonGreen],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static CORRUPTED_PRIESTS: EnemyDefinition = EnemyDefinition {
    id: "corrupted_priests", name: "Corrupted Priests", color: EnemyColor::Green,
    attack: 4, attack_element: Element::ColdFire, armor: 5, fame: 3,
    resistances: &[], abilities: &[EnemyAbilityType::Defend],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: Some(1),
};

static GIBBERING_GHOULS: EnemyDefinition = EnemyDefinition {
    id: "gibbering_ghouls", name: "Gibbering Ghouls", color: EnemyColor::Green,
    attack: 4, attack_element: Element::Physical, armor: 4, fame: 2,
    resistances: &[], abilities: &[EnemyAbilityType::Vampiric],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ELEMENTAL_PRIESTS_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 3, element: Element::Fire, ability: None },
    EnemyAttack { damage: 3, element: Element::Ice, ability: None },
];

static ELEMENTAL_PRIESTS: EnemyDefinition = EnemyDefinition {
    id: "elemental_priests", name: "Elemental Priests", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 4, fame: 3,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice], abilities: &[],
    attacks: Some(&ELEMENTAL_PRIESTS_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ELVEN_PROTECTORS: EnemyDefinition = EnemyDefinition {
    id: "elven_protectors", name: "Elven Protectors", color: EnemyColor::Green,
    attack: 3, attack_element: Element::Physical, armor: 4, fame: 2,
    resistances: &[ResistanceElement::Fire], abilities: &[EnemyAbilityType::Defend],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: Some(2),
};

static CLOUD_GRIFFONS: EnemyDefinition = EnemyDefinition {
    id: "cloud_griffons", name: "Cloud Griffons", color: EnemyColor::Green,
    attack: 4, attack_element: Element::Physical, armor: 4, fame: 3,
    resistances: &[],
    abilities: &[EnemyAbilityType::Unfortified, EnemyAbilityType::Swift, EnemyAbilityType::Elusive],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static CRYSTAL_SPRITES_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 1, element: Element::Ice, ability: None },
    EnemyAttack { damage: 1, element: Element::Ice, ability: None },
];

static CRYSTAL_SPRITES: EnemyDefinition = EnemyDefinition {
    id: "crystal_sprites", name: "Crystal Sprites", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 1, fame: 1,
    resistances: &[ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Defend],
    attacks: Some(&CRYSTAL_SPRITES_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(2), defend: Some(1),
};

static ZOMBIE_HORDE_ATTACKS: [EnemyAttack; 3] = [
    EnemyAttack { damage: 1, element: Element::Physical, ability: None },
    EnemyAttack { damage: 1, element: Element::Physical, ability: None },
    EnemyAttack { damage: 1, element: Element::Physical, ability: None },
];

static ZOMBIE_HORDE: EnemyDefinition = EnemyDefinition {
    id: "zombie_horde", name: "Zombie Horde", color: EnemyColor::Green,
    attack: 0, attack_element: Element::Physical, armor: 5, fame: 2,
    resistances: &[ResistanceElement::Ice], abilities: &[EnemyAbilityType::Cumbersome],
    attacks: Some(&ZOMBIE_HORDE_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

// =============================================================================
// GRAY enemies (7) — Keep Garrison
// =============================================================================

static CROSSBOWMEN: EnemyDefinition = EnemyDefinition {
    id: "crossbowmen", name: "Crossbowmen", color: EnemyColor::Gray,
    attack: 4, attack_element: Element::Physical, armor: 4, fame: 3,
    resistances: &[], abilities: &[EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static GUARDSMEN: EnemyDefinition = EnemyDefinition {
    id: "guardsmen", name: "Guardsmen", color: EnemyColor::Gray,
    attack: 3, attack_element: Element::Physical, armor: 7, fame: 3,
    resistances: &[], abilities: &[EnemyAbilityType::Fortified],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SWORDSMEN: EnemyDefinition = EnemyDefinition {
    id: "swordsmen", name: "Swordsmen", color: EnemyColor::Gray,
    attack: 6, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static GOLEMS: EnemyDefinition = EnemyDefinition {
    id: "golems", name: "Golems", color: EnemyColor::Gray,
    attack: 2, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[ResistanceElement::Physical], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static HEROES_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 5, element: Element::Physical, ability: None },
    EnemyAttack { damage: 3, element: Element::Physical, ability: None },
];

static HEROES_ENEMY: EnemyDefinition = EnemyDefinition {
    id: "heroes", name: "Heroes", color: EnemyColor::Gray,
    attack: 5, attack_element: Element::Physical, armor: 4, fame: 5,
    resistances: &[], abilities: &[EnemyAbilityType::Fortified],
    attacks: Some(&HEROES_ATTACKS),
    reputation_penalty: Some(1), reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static THUGS_GRAY: EnemyDefinition = EnemyDefinition {
    id: "thugs_gray", name: "Thugs", color: EnemyColor::Gray,
    attack: 3, attack_element: Element::Physical, armor: 5, fame: 2,
    resistances: &[], abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: Some(1),
    armor_elusive: None, defend: None,
};

static SHOCKTROOPS_GRAY: EnemyDefinition = EnemyDefinition {
    id: "shocktroops_gray", name: "Shocktroops", color: EnemyColor::Gray,
    attack: 5, attack_element: Element::Physical, armor: 3, fame: 3,
    resistances: &[],
    abilities: &[EnemyAbilityType::Unfortified, EnemyAbilityType::Elusive],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(6), defend: None,
};

// =============================================================================
// BROWN enemies (16) — Dungeon Monsters
// =============================================================================

static AIR_ELEMENTAL: EnemyDefinition = EnemyDefinition {
    id: "air_elemental", name: "Air Elemental", color: EnemyColor::Brown,
    attack: 3, attack_element: Element::ColdFire, armor: 4, fame: 4,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Swift, EnemyAbilityType::Elusive],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(8), defend: None,
};

static MINOTAUR: EnemyDefinition = EnemyDefinition {
    id: "minotaur", name: "Minotaur", color: EnemyColor::Brown,
    attack: 5, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[], abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static GARGOYLE: EnemyDefinition = EnemyDefinition {
    id: "gargoyle", name: "Gargoyle", color: EnemyColor::Brown,
    attack: 5, attack_element: Element::Physical, armor: 4, fame: 4,
    resistances: &[ResistanceElement::Physical], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static MEDUSA: EnemyDefinition = EnemyDefinition {
    id: "medusa", name: "Medusa", color: EnemyColor::Brown,
    attack: 6, attack_element: Element::Physical, armor: 4, fame: 5,
    resistances: &[], abilities: &[EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static CRYPT_WORM: EnemyDefinition = EnemyDefinition {
    id: "crypt_worm", name: "Crypt Worm", color: EnemyColor::Brown,
    attack: 6, attack_element: Element::Physical, armor: 6, fame: 5,
    resistances: &[], abilities: &[EnemyAbilityType::Fortified],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static WEREWOLF: EnemyDefinition = EnemyDefinition {
    id: "werewolf", name: "Werewolf", color: EnemyColor::Brown,
    attack: 7, attack_element: Element::Physical, armor: 5, fame: 5,
    resistances: &[], abilities: &[EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SHADOW: EnemyDefinition = EnemyDefinition {
    id: "shadow", name: "Shadow", color: EnemyColor::Brown,
    attack: 4, attack_element: Element::ColdFire, armor: 4, fame: 4,
    resistances: &[],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::ArcaneImmunity],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(8), defend: None,
};

static FIRE_ELEMENTAL: EnemyDefinition = EnemyDefinition {
    id: "fire_elemental", name: "Fire Elemental", color: EnemyColor::Brown,
    attack: 7, attack_element: Element::Physical, armor: 6, fame: 4,
    resistances: &[ResistanceElement::Fire], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static EARTH_ELEMENTAL: EnemyDefinition = EnemyDefinition {
    id: "earth_elemental", name: "Earth Elemental", color: EnemyColor::Brown,
    attack: 4, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::Cumbersome, EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static MUMMY: EnemyDefinition = EnemyDefinition {
    id: "mummy", name: "Mummy", color: EnemyColor::Brown,
    attack: 4, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[ResistanceElement::Ice, ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Poison],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static HYDRA_ATTACKS: [EnemyAttack; 3] = [
    EnemyAttack { damage: 2, element: Element::Physical, ability: None },
    EnemyAttack { damage: 2, element: Element::Physical, ability: None },
    EnemyAttack { damage: 2, element: Element::Physical, ability: None },
];

static HYDRA: EnemyDefinition = EnemyDefinition {
    id: "hydra", name: "Hydra", color: EnemyColor::Brown,
    attack: 0, attack_element: Element::Physical, armor: 6, fame: 5,
    resistances: &[ResistanceElement::Ice], abilities: &[],
    attacks: Some(&HYDRA_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static MANTICORE: EnemyDefinition = EnemyDefinition {
    id: "manticore", name: "Manticore", color: EnemyColor::Brown,
    attack: 4, attack_element: Element::Physical, armor: 6, fame: 5,
    resistances: &[ResistanceElement::Fire],
    abilities: &[EnemyAbilityType::Swift, EnemyAbilityType::Assassination, EnemyAbilityType::Poison],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static WATER_ELEMENTAL: EnemyDefinition = EnemyDefinition {
    id: "water_elemental", name: "Water Elemental", color: EnemyColor::Brown,
    attack: 6, attack_element: Element::Physical, armor: 7, fame: 4,
    resistances: &[ResistanceElement::Ice], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static VAMPIRE: EnemyDefinition = EnemyDefinition {
    id: "vampire", name: "Vampire", color: EnemyColor::Brown,
    attack: 5, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Vampiric],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(10), defend: None,
};

static BLOOD_DEMON: EnemyDefinition = EnemyDefinition {
    id: "blood_demon", name: "Blood Demon", color: EnemyColor::Brown,
    attack: 6, attack_element: Element::Physical, armor: 6, fame: 5,
    resistances: &[ResistanceElement::Fire],
    abilities: &[EnemyAbilityType::Brutal, EnemyAbilityType::Assassination, EnemyAbilityType::ArcaneImmunity],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static PAIN_WRAITH: EnemyDefinition = EnemyDefinition {
    id: "pain_wraith", name: "Pain Wraith", color: EnemyColor::Brown,
    attack: 4, attack_element: Element::Physical, armor: 4, fame: 3,
    resistances: &[],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(8), defend: None,
};

// =============================================================================
// VIOLET enemies (8) — Mage Tower Defenders
// =============================================================================

static MONKS: EnemyDefinition = EnemyDefinition {
    id: "monks", name: "Monks", color: EnemyColor::Violet,
    attack: 5, attack_element: Element::Physical, armor: 5, fame: 4,
    resistances: &[], abilities: &[EnemyAbilityType::Poison],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ILLUSIONISTS: EnemyDefinition = EnemyDefinition {
    id: "illusionists", name: "Illusionists", color: EnemyColor::Violet,
    attack: 0, attack_element: Element::Physical, armor: 3, fame: 4,
    resistances: &[ResistanceElement::Physical], abilities: &[EnemyAbilityType::Summon],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ICE_MAGES: EnemyDefinition = EnemyDefinition {
    id: "ice_mages", name: "Ice Mages", color: EnemyColor::Violet,
    attack: 5, attack_element: Element::Ice, armor: 6, fame: 5,
    resistances: &[ResistanceElement::Ice], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static FIRE_MAGES: EnemyDefinition = EnemyDefinition {
    id: "fire_mages", name: "Fire Mages", color: EnemyColor::Violet,
    attack: 6, attack_element: Element::Fire, armor: 5, fame: 5,
    resistances: &[ResistanceElement::Fire], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ICE_GOLEMS: EnemyDefinition = EnemyDefinition {
    id: "ice_golems", name: "Ice Golems", color: EnemyColor::Violet,
    attack: 2, attack_element: Element::Ice, armor: 4, fame: 5,
    resistances: &[ResistanceElement::Ice, ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static FIRE_GOLEMS: EnemyDefinition = EnemyDefinition {
    id: "fire_golems", name: "Fire Golems", color: EnemyColor::Violet,
    attack: 3, attack_element: Element::Fire, armor: 4, fame: 5,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SORCERERS: EnemyDefinition = EnemyDefinition {
    id: "sorcerers", name: "Sorcerers", color: EnemyColor::Violet,
    attack: 6, attack_element: Element::Physical, armor: 6, fame: 5,
    resistances: &[],
    abilities: &[EnemyAbilityType::Assassination, EnemyAbilityType::Poison, EnemyAbilityType::ArcaneImmunity],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static MAGIC_FAMILIARS_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 3, element: Element::Physical, ability: None },
    EnemyAttack { damage: 3, element: Element::Physical, ability: None },
];

static MAGIC_FAMILIARS: EnemyDefinition = EnemyDefinition {
    id: "magic_familiars", name: "Magic Familiars", color: EnemyColor::Violet,
    attack: 0, attack_element: Element::Physical, armor: 7, fame: 5,
    resistances: &[],
    abilities: &[EnemyAbilityType::Unfortified, EnemyAbilityType::Brutal],
    attacks: Some(&MAGIC_FAMILIARS_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

// =============================================================================
// WHITE enemies (10) — City Garrison
// =============================================================================

static THUGS: EnemyDefinition = EnemyDefinition {
    id: "thugs", name: "Thugs", color: EnemyColor::White,
    attack: 6, attack_element: Element::Physical, armor: 5, fame: 5,
    resistances: &[], abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SHOCKTROOPS: EnemyDefinition = EnemyDefinition {
    id: "shocktroops", name: "Shocktroops", color: EnemyColor::White,
    attack: 5, attack_element: Element::Physical, armor: 5, fame: 5,
    resistances: &[], abilities: &[EnemyAbilityType::Swift, EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static FREEZERS: EnemyDefinition = EnemyDefinition {
    id: "freezers", name: "Freezers", color: EnemyColor::White,
    attack: 3, attack_element: Element::Ice, armor: 7, fame: 7,
    resistances: &[ResistanceElement::Fire],
    abilities: &[EnemyAbilityType::Paralyze, EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static GUNNERS: EnemyDefinition = EnemyDefinition {
    id: "gunners", name: "Gunners", color: EnemyColor::White,
    attack: 6, attack_element: Element::Fire, armor: 6, fame: 7,
    resistances: &[ResistanceElement::Ice], abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static FIRE_CATAPULT: EnemyDefinition = EnemyDefinition {
    id: "fire_catapult", name: "Fire Catapult", color: EnemyColor::White,
    attack: 8, attack_element: Element::Fire, armor: 7, fame: 7,
    resistances: &[],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::Cumbersome],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ICE_CATAPULT: EnemyDefinition = EnemyDefinition {
    id: "ice_catapult", name: "Ice Catapult", color: EnemyColor::White,
    attack: 9, attack_element: Element::Ice, armor: 6, fame: 7,
    resistances: &[],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::Cumbersome],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ALTEM_GUARDSMEN: EnemyDefinition = EnemyDefinition {
    id: "altem_guardsmen", name: "Altem Guardsmen", color: EnemyColor::White,
    attack: 5, attack_element: Element::Physical, armor: 7, fame: 8,
    resistances: &[ResistanceElement::Physical, ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Fortified],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ALTEM_MAGES: EnemyDefinition = EnemyDefinition {
    id: "altem_mages", name: "Altem Mages", color: EnemyColor::White,
    attack: 4, attack_element: Element::ColdFire, armor: 8, fame: 8,
    resistances: &[ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::Brutal, EnemyAbilityType::Poison],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static DELPHANA_MASTERS: EnemyDefinition = EnemyDefinition {
    id: "delphana_masters", name: "Delphana Masters", color: EnemyColor::White,
    attack: 5, attack_element: Element::ColdFire, armor: 8, fame: 9,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Assassination, EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static GRIM_LEGIONNARIES: EnemyDefinition = EnemyDefinition {
    id: "grim_legionnaries", name: "Grim Legionnaries", color: EnemyColor::White,
    attack: 11, attack_element: Element::Physical, armor: 10, fame: 8,
    resistances: &[],
    abilities: &[EnemyAbilityType::Unfortified, EnemyAbilityType::ArcaneImmunity],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

// =============================================================================
// RED enemies (11) — Draconum
// =============================================================================

static SWAMP_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "swamp_dragon", name: "Swamp Dragon", color: EnemyColor::Red,
    attack: 5, attack_element: Element::Physical, armor: 9, fame: 7,
    resistances: &[], abilities: &[EnemyAbilityType::Swift, EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static FIRE_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "fire_dragon", name: "Fire Dragon", color: EnemyColor::Red,
    attack: 9, attack_element: Element::Fire, armor: 7, fame: 8,
    resistances: &[ResistanceElement::Physical, ResistanceElement::Fire],
    abilities: &[],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static ICE_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "ice_dragon", name: "Ice Dragon", color: EnemyColor::Red,
    attack: 6, attack_element: Element::Ice, armor: 7, fame: 8,
    resistances: &[ResistanceElement::Physical, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static HIGH_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "high_dragon", name: "High Dragon", color: EnemyColor::Red,
    attack: 6, attack_element: Element::ColdFire, armor: 9, fame: 9,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static DEATH_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "death_dragon", name: "Death Dragon", color: EnemyColor::Red,
    attack: 7, attack_element: Element::Physical, armor: 9, fame: 6,
    resistances: &[],
    abilities: &[EnemyAbilityType::Assassination, EnemyAbilityType::Paralyze],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static LAVA_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "lava_dragon", name: "Lava Dragon", color: EnemyColor::Red,
    attack: 6, attack_element: Element::Fire, armor: 8, fame: 8,
    resistances: &[ResistanceElement::Fire],
    abilities: &[EnemyAbilityType::Fortified, EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static SAVAGE_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "savage_dragon", name: "Savage Dragon", color: EnemyColor::Red,
    attack: 5, attack_element: Element::Physical, armor: 7, fame: 6,
    resistances: &[ResistanceElement::Physical], abilities: &[EnemyAbilityType::Brutal],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static DRAGON_SUMMONER_ATTACKS: [EnemyAttack; 2] = [
    EnemyAttack { damage: 0, element: Element::Physical, ability: Some(EnemyAbilityType::Summon) },
    EnemyAttack { damage: 0, element: Element::Physical, ability: Some(EnemyAbilityType::Summon) },
];

static DRAGON_SUMMONER: EnemyDefinition = EnemyDefinition {
    id: "dragon_summoner", name: "Dragon Summoner", color: EnemyColor::Red,
    attack: 0, attack_element: Element::Physical, armor: 8, fame: 9,
    resistances: &[ResistanceElement::Physical],
    abilities: &[EnemyAbilityType::ArcaneImmunity],
    attacks: Some(&DRAGON_SUMMONER_ATTACKS),
    reputation_penalty: None, reputation_bonus: None,
    armor_elusive: None, defend: None,
};

static LIGHTNING_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "lightning_dragon", name: "Lightning Dragon", color: EnemyColor::Red,
    attack: 6, attack_element: Element::ColdFire, armor: 7, fame: 7,
    resistances: &[ResistanceElement::Fire, ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Elusive],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(14), defend: None,
};

static VAMPIRE_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "vampire_dragon", name: "Vampire Dragon", color: EnemyColor::Red,
    attack: 8, attack_element: Element::Physical, armor: 8, fame: 7,
    resistances: &[],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Vampiric],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(16), defend: None,
};

static STORM_DRAGON: EnemyDefinition = EnemyDefinition {
    id: "storm_dragon", name: "Storm Dragon", color: EnemyColor::Red,
    attack: 4, attack_element: Element::Ice, armor: 7, fame: 7,
    resistances: &[ResistanceElement::Ice],
    abilities: &[EnemyAbilityType::Elusive, EnemyAbilityType::Swift],
    attacks: None, reputation_penalty: None, reputation_bonus: None,
    armor_elusive: Some(14), defend: None,
};

// =============================================================================
// Lookup functions
// =============================================================================

/// Look up an enemy definition by ID. Returns `None` for unknown IDs.
pub fn get_enemy(id: &str) -> Option<&'static EnemyDefinition> {
    match id {
        // Green (20)
        "diggers" => Some(&DIGGERS),
        "prowlers" => Some(&PROWLERS),
        "cursed_hags" => Some(&CURSED_HAGS),
        "wolf_riders" => Some(&WOLF_RIDERS),
        "ironclads" => Some(&IRONCLADS),
        "orc_summoners" => Some(&ORC_SUMMONERS),
        "centaur_outriders" => Some(&CENTAUR_OUTRIDERS),
        "orc_skirmishers" => Some(&ORC_SKIRMISHERS),
        "orc_war_beasts" => Some(&ORC_WAR_BEASTS),
        "orc_stonethrowers" => Some(&ORC_STONETHROWERS),
        "orc_tracker" => Some(&ORC_TRACKER),
        "skeletal_warriors" => Some(&SKELETAL_WARRIORS),
        "shrouded_necromancers" => Some(&SHROUDED_NECROMANCERS),
        "corrupted_priests" => Some(&CORRUPTED_PRIESTS),
        "gibbering_ghouls" => Some(&GIBBERING_GHOULS),
        "elemental_priests" => Some(&ELEMENTAL_PRIESTS),
        "elven_protectors" => Some(&ELVEN_PROTECTORS),
        "cloud_griffons" => Some(&CLOUD_GRIFFONS),
        "crystal_sprites" => Some(&CRYSTAL_SPRITES),
        "zombie_horde" => Some(&ZOMBIE_HORDE),
        // Gray (7)
        "crossbowmen" => Some(&CROSSBOWMEN),
        "guardsmen" => Some(&GUARDSMEN),
        "swordsmen" => Some(&SWORDSMEN),
        "golems" => Some(&GOLEMS),
        "heroes" => Some(&HEROES_ENEMY),
        "thugs_gray" => Some(&THUGS_GRAY),
        "shocktroops_gray" => Some(&SHOCKTROOPS_GRAY),
        // Brown (16)
        "air_elemental" => Some(&AIR_ELEMENTAL),
        "minotaur" => Some(&MINOTAUR),
        "gargoyle" => Some(&GARGOYLE),
        "medusa" => Some(&MEDUSA),
        "crypt_worm" => Some(&CRYPT_WORM),
        "werewolf" => Some(&WEREWOLF),
        "shadow" => Some(&SHADOW),
        "fire_elemental" => Some(&FIRE_ELEMENTAL),
        "earth_elemental" => Some(&EARTH_ELEMENTAL),
        "mummy" => Some(&MUMMY),
        "hydra" => Some(&HYDRA),
        "manticore" => Some(&MANTICORE),
        "water_elemental" => Some(&WATER_ELEMENTAL),
        "vampire" => Some(&VAMPIRE),
        "blood_demon" => Some(&BLOOD_DEMON),
        "pain_wraith" => Some(&PAIN_WRAITH),
        // Violet (8)
        "monks" => Some(&MONKS),
        "illusionists" => Some(&ILLUSIONISTS),
        "ice_mages" => Some(&ICE_MAGES),
        "fire_mages" => Some(&FIRE_MAGES),
        "ice_golems" => Some(&ICE_GOLEMS),
        "fire_golems" => Some(&FIRE_GOLEMS),
        "sorcerers" => Some(&SORCERERS),
        "magic_familiars" => Some(&MAGIC_FAMILIARS),
        // White (10)
        "thugs" => Some(&THUGS),
        "shocktroops" => Some(&SHOCKTROOPS),
        "freezers" => Some(&FREEZERS),
        "gunners" => Some(&GUNNERS),
        "fire_catapult" => Some(&FIRE_CATAPULT),
        "ice_catapult" => Some(&ICE_CATAPULT),
        "altem_guardsmen" => Some(&ALTEM_GUARDSMEN),
        "altem_mages" => Some(&ALTEM_MAGES),
        "delphana_masters" => Some(&DELPHANA_MASTERS),
        "grim_legionnaries" => Some(&GRIM_LEGIONNARIES),
        // Red (11)
        "swamp_dragon" => Some(&SWAMP_DRAGON),
        "fire_dragon" => Some(&FIRE_DRAGON),
        "ice_dragon" => Some(&ICE_DRAGON),
        "high_dragon" => Some(&HIGH_DRAGON),
        "death_dragon" => Some(&DEATH_DRAGON),
        "lava_dragon" => Some(&LAVA_DRAGON),
        "savage_dragon" => Some(&SAVAGE_DRAGON),
        "dragon_summoner" => Some(&DRAGON_SUMMONER),
        "lightning_dragon" => Some(&LIGHTNING_DRAGON),
        "vampire_dragon" => Some(&VAMPIRE_DRAGON),
        "storm_dragon" => Some(&STORM_DRAGON),
        _ => None,
    }
}

/// All enemy IDs for a given color.
pub fn all_enemy_ids_for_color(color: EnemyColor) -> &'static [&'static str] {
    match color {
        EnemyColor::Green => &[
            "diggers", "prowlers", "cursed_hags", "wolf_riders", "ironclads",
            "orc_summoners", "centaur_outriders", "orc_skirmishers", "orc_war_beasts",
            "orc_stonethrowers", "orc_tracker", "skeletal_warriors", "shrouded_necromancers",
            "corrupted_priests", "gibbering_ghouls", "elemental_priests", "elven_protectors",
            "cloud_griffons", "crystal_sprites", "zombie_horde",
        ],
        EnemyColor::Gray => &[
            "crossbowmen", "guardsmen", "swordsmen", "golems", "heroes",
            "thugs_gray", "shocktroops_gray",
        ],
        EnemyColor::Brown => &[
            "air_elemental", "minotaur", "gargoyle", "medusa", "crypt_worm",
            "werewolf", "shadow", "fire_elemental", "earth_elemental", "mummy",
            "hydra", "manticore", "water_elemental", "vampire", "blood_demon",
            "pain_wraith",
        ],
        EnemyColor::Violet => &[
            "monks", "illusionists", "ice_mages", "fire_mages", "ice_golems",
            "fire_golems", "sorcerers", "magic_familiars",
        ],
        EnemyColor::White => &[
            "thugs", "shocktroops", "freezers", "gunners", "fire_catapult",
            "ice_catapult", "altem_guardsmen", "altem_mages", "delphana_masters",
            "grim_legionnaries",
        ],
        EnemyColor::Red => &[
            "swamp_dragon", "fire_dragon", "ice_dragon", "high_dragon",
            "death_dragon", "lava_dragon", "savage_dragon", "dragon_summoner",
            "lightning_dragon", "vampire_dragon", "storm_dragon",
        ],
    }
}

/// Number of attacks for an enemy. If multi-attack, returns attacks.len(); otherwise 1.
pub fn attack_count(def: &EnemyDefinition) -> usize {
    match def.attacks {
        Some(attacks) => attacks.len(),
        None => 1,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_enemy_diggers() {
        let e = get_enemy("diggers").unwrap();
        assert_eq!(e.id, "diggers");
        assert_eq!(e.name, "Diggers");
        assert_eq!(e.color, EnemyColor::Green);
        assert_eq!(e.attack, 3);
        assert_eq!(e.armor, 3);
        assert_eq!(e.fame, 2);
        assert!(e.abilities.contains(&EnemyAbilityType::Fortified));
    }

    #[test]
    fn get_enemy_nonexistent_returns_none() {
        assert!(get_enemy("nonexistent").is_none());
    }

    #[test]
    fn green_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::Green);
        assert_eq!(ids.len(), 20);
    }

    #[test]
    fn gray_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::Gray);
        assert_eq!(ids.len(), 7);
    }

    #[test]
    fn brown_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::Brown);
        assert_eq!(ids.len(), 16);
    }

    #[test]
    fn violet_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::Violet);
        assert_eq!(ids.len(), 8);
    }

    #[test]
    fn white_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::White);
        assert_eq!(ids.len(), 10);
    }

    #[test]
    fn red_enemies_count() {
        let ids = all_enemy_ids_for_color(EnemyColor::Red);
        assert_eq!(ids.len(), 11);
    }

    #[test]
    fn total_enemy_count() {
        let total: usize = [
            EnemyColor::Green, EnemyColor::Gray, EnemyColor::Brown,
            EnemyColor::Violet, EnemyColor::White, EnemyColor::Red,
        ].iter().map(|c| all_enemy_ids_for_color(*c).len()).sum();
        assert_eq!(total, 72);
    }

    #[test]
    fn all_ids_resolve() {
        for color in [
            EnemyColor::Green, EnemyColor::Gray, EnemyColor::Brown,
            EnemyColor::Violet, EnemyColor::White, EnemyColor::Red,
        ] {
            for &id in all_enemy_ids_for_color(color) {
                let def = get_enemy(id).unwrap_or_else(|| panic!("Missing enemy: {}", id));
                assert_eq!(def.id, id);
                assert_eq!(def.color, color);
            }
        }
    }

    #[test]
    fn multi_attack_enemy_orc_skirmishers() {
        let e = get_enemy("orc_skirmishers").unwrap();
        let attacks = e.attacks.unwrap();
        assert_eq!(attacks.len(), 2);
        assert_eq!(attacks[0].damage, 1);
        assert_eq!(attacks[1].damage, 1);
    }

    #[test]
    fn multi_attack_enemy_heroes() {
        let e = get_enemy("heroes").unwrap();
        let attacks = e.attacks.unwrap();
        assert_eq!(attacks.len(), 2);
        assert_eq!(attacks[0].damage, 5);
        assert_eq!(attacks[1].damage, 3);
        assert_eq!(e.reputation_penalty, Some(1));
    }

    #[test]
    fn elusive_enemy_orc_tracker() {
        let e = get_enemy("orc_tracker").unwrap();
        assert_eq!(e.armor, 3);
        assert_eq!(e.armor_elusive, Some(6));
        assert!(e.abilities.contains(&EnemyAbilityType::Elusive));
    }

    #[test]
    fn dragon_summoner_has_summon_attacks() {
        let e = get_enemy("dragon_summoner").unwrap();
        let attacks = e.attacks.unwrap();
        assert_eq!(attacks.len(), 2);
        assert_eq!(attacks[0].ability, Some(EnemyAbilityType::Summon));
        assert_eq!(attacks[1].ability, Some(EnemyAbilityType::Summon));
    }

    #[test]
    fn defend_enemy_corrupted_priests() {
        let e = get_enemy("corrupted_priests").unwrap();
        assert_eq!(e.defend, Some(1));
        assert_eq!(e.attack_element, Element::ColdFire);
    }

    #[test]
    fn attack_count_single() {
        let e = get_enemy("diggers").unwrap();
        assert_eq!(attack_count(e), 1);
    }

    #[test]
    fn attack_count_multi() {
        let e = get_enemy("hydra").unwrap();
        assert_eq!(attack_count(e), 3);
    }

    #[test]
    fn strongest_enemy_grim_legionnaries() {
        let e = get_enemy("grim_legionnaries").unwrap();
        assert_eq!(e.attack, 11);
        assert_eq!(e.armor, 10);
        assert_eq!(e.fame, 8);
    }
}
