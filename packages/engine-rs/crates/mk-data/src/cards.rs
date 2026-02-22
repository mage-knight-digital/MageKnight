//! Card definitions — basic action cards and advanced action cards with their effects.
//!
//! Each card has a basic effect (free play) and powered effect (costs 1 mana).
//! All basic action cards have sideways_value = 1.
//! All advanced action cards have sideways_value = 1.

use mk_types::effect::{CardEffect, EffectCondition, ScalingFactor};
use mk_types::enums::{
    BasicManaColor, CardColor, CombatType, DeedCardType, DiscardForBonusFilter, Element,
    EnemyAbilityType, ManaColor, ResistanceElement, Terrain,
};
use mk_types::effect::EffectType;
use mk_types::pending::{EffectMode, SelectEnemyTemplate};
use mk_types::modifier::{
    BurningShieldMode, CombatValueType, EnemyStat as ModEnemyStat, LearningDestination,
    ModifierDuration, ModifierEffect, ModifierScope, RuleOverride, TerrainOrAll,
};

/// How a card can be powered.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PoweredBy {
    /// Cannot be powered (wounds).
    None,
    /// Powered by a single specific mana color (most cards).
    Single(BasicManaColor),
    /// Powered by any basic mana color (Crystal Joy).
    AnyBasic,
}

impl PoweredBy {
    /// Return the single mana color if this is `Single`, else `None`.
    pub fn primary_color(&self) -> Option<BasicManaColor> {
        match self {
            PoweredBy::Single(c) => Some(*c),
            _ => None,
        }
    }
}

/// Static card definition.
pub struct CardDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub color: CardColor,
    pub card_type: DeedCardType,
    pub powered_by: PoweredBy,
    pub basic_effect: CardEffect,
    pub powered_effect: CardEffect,
    pub sideways_value: u32,
}

/// Look up any card by ID (basic action, hero-specific, advanced action, or spell).
pub fn get_card(id: &str) -> Option<CardDefinition> {
    get_basic_action_card(id)
        .or_else(|| get_hero_card(id))
        .or_else(|| get_advanced_action_card(id))
        .or_else(|| get_spell_card(id))
}

/// Get the basic mana color of an action card (basic or advanced, NOT spells).
/// Returns `None` for wounds, spells, or unknown cards.
pub fn get_card_color(id: &str) -> Option<BasicManaColor> {
    get_basic_action_card(id)
        .or_else(|| get_hero_card(id))
        .or_else(|| get_advanced_action_card(id))
        .and_then(|c| c.color.to_basic_mana_color())
}

/// Get the basic mana color of a spell card.
/// Returns `None` for non-spell cards.
pub fn get_spell_color(id: &str) -> Option<BasicManaColor> {
    get_spell_card(id).and_then(|c| c.color.to_basic_mana_color())
}

/// Look up a basic action card by ID.
pub fn get_basic_action_card(id: &str) -> Option<CardDefinition> {
    match id {
        "march" => Some(march()),
        "stamina" => Some(stamina()),
        "swiftness" => Some(swiftness()),
        "rage" => Some(rage()),
        "determination" => Some(determination()),
        "tranquility" => Some(tranquility()),
        "promise" => Some(promise()),
        "threaten" => Some(threaten()),
        "crystallize" => Some(crystallize()),
        "mana_draw" => Some(mana_draw()),
        "concentration" => Some(concentration()),
        "improvisation" => Some(improvisation()),
        "wound" => Some(wound()),
        _ => None,
    }
}

/// Look up a hero-specific basic action card by ID.
fn get_hero_card(id: &str) -> Option<CardDefinition> {
    match id {
        "arythea_battle_versatility" => Some(arythea_battle_versatility()),
        "tovak_cold_toughness" => Some(tovak_cold_toughness()),
        "goldyx_will_focus" => Some(goldyx_will_focus()),
        "norowas_noble_manners" => Some(norowas_noble_manners()),
        "wolfhawk_swift_reflexes" => Some(wolfhawk_swift_reflexes()),
        "wolfhawk_tirelessness" => Some(wolfhawk_tirelessness()),
        "krang_savage_harvesting" => Some(krang_savage_harvesting()),
        "krang_ruthless_coercion" => Some(krang_ruthless_coercion()),
        "krang_battle_rage" => Some(krang_battle_rage()),
        "braevalar_one_with_the_land" => Some(braevalar_one_with_the_land()),
        "braevalar_druidic_paths" => Some(braevalar_druidic_paths()),
        "tovak_instinct" => Some(tovak_instinct()),
        "goldyx_crystal_joy" => Some(goldyx_crystal_joy()),
        "norowas_rejuvenate" => Some(norowas_rejuvenate()),
        "axe_throw" => Some(axe_throw()),
        "arythea_mana_pull" => Some(arythea_mana_pull()),
        _ => None,
    }
}

// =============================================================================
// Standard basic action cards (12 cards)
// =============================================================================

fn march() -> CardDefinition {
    CardDefinition {
        id: "march",
        name: "March",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::GainMove { amount: 4 },
        sideways_value: 1,
    }
}

fn stamina() -> CardDefinition {
    CardDefinition {
        id: "stamina",
        name: "Stamina",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::GainMove { amount: 4 },
        sideways_value: 1,
    }
}

fn swiftness() -> CardDefinition {
    CardDefinition {
        id: "swiftness",
        name: "Swiftness",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::GainAttack {
            amount: 3,
            combat_type: CombatType::Ranged,
            element: Element::Physical,
        },
        sideways_value: 1,
    }
}

fn rage() -> CardDefinition {
    CardDefinition {
        id: "rage",
        name: "Rage",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::GainAttack {
            amount: 4,
            combat_type: CombatType::Melee,
            element: Element::Physical,
        },
        sideways_value: 1,
    }
}

fn determination() -> CardDefinition {
    CardDefinition {
        id: "determination",
        name: "Determination",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::GainBlock {
            amount: 5,
            element: Element::Physical,
        },
        sideways_value: 1,
    }
}

fn tranquility() -> CardDefinition {
    CardDefinition {
        id: "tranquility",
        name: "Tranquility",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainHealing { amount: 1 },
                CardEffect::DrawCards { count: 1 },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainHealing { amount: 2 },
                CardEffect::DrawCards { count: 2 },
            ],
        },
        sideways_value: 1,
    }
}

fn promise() -> CardDefinition {
    CardDefinition {
        id: "promise",
        name: "Promise",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainInfluence { amount: 2 },
        powered_effect: CardEffect::GainInfluence { amount: 4 },
        sideways_value: 1,
    }
}

fn threaten() -> CardDefinition {
    CardDefinition {
        id: "threaten",
        name: "Threaten",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::GainInfluence { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 5 },
                CardEffect::ChangeReputation { amount: -1 },
            ],
        },
        sideways_value: 1,
    }
}

fn crystallize() -> CardDefinition {
    CardDefinition {
        id: "crystallize",
        name: "Crystallize",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::ConvertManaToCrystal,
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Red),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Blue),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Green),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::White),
                },
            ],
        },
        sideways_value: 1,
    }
}

fn mana_draw() -> CardDefinition {
    CardDefinition {
        id: "mana_draw",
        name: "Mana Draw",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::ApplyModifier {
            effect: ModifierEffect::RuleOverride {
                rule: RuleOverride::ExtraSourceDie,
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
        },
        powered_effect: CardEffect::ManaDrawPowered {
            dice_count: 1,
            tokens_per_die: 2,
        },
        sideways_value: 1,
    }
}

fn concentration() -> CardDefinition {
    CardDefinition {
        id: "concentration",
        name: "Concentration",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::White,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
            ],
        },
        powered_effect: CardEffect::CardBoost { bonus: 2 },
        sideways_value: 1,
    }
}

fn improvisation() -> CardDefinition {
    CardDefinition {
        id: "improvisation",
        name: "Improvisation",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::DiscardCost {
            count: 1,
            filter_wounds: true,
            wounds_only: false,
            then_effect: Box::new(CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 3 },
                    CardEffect::GainInfluence { amount: 3 },
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainBlock {
                        amount: 3,
                        element: Element::Physical,
                    },
                ],
            }),
        },
        powered_effect: CardEffect::DiscardCost {
            count: 1,
            filter_wounds: true,
            wounds_only: false,
            then_effect: Box::new(CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 5 },
                    CardEffect::GainInfluence { amount: 5 },
                    CardEffect::GainAttack {
                        amount: 5,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                    CardEffect::GainBlock {
                        amount: 5,
                        element: Element::Physical,
                    },
                ],
            }),
        },
        sideways_value: 1,
    }
}

fn wound() -> CardDefinition {
    CardDefinition {
        id: "wound",
        name: "Wound",
        color: CardColor::Wound,
        card_type: DeedCardType::Wound,
        powered_by: PoweredBy::None,
        basic_effect: CardEffect::Noop,
        powered_effect: CardEffect::Noop,
        sideways_value: 0,
    }
}

// =============================================================================
// Hero-specific basic action cards
// =============================================================================

fn arythea_battle_versatility() -> CardDefinition {
    CardDefinition {
        id: "arythea_battle_versatility",
        name: "Battle Versatility",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 4,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 4,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn tovak_cold_toughness() -> CardDefinition {
    CardDefinition {
        id: "tovak_cold_toughness",
        name: "Cold Toughness",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainBlock {
                    amount: 5,
                    element: Element::Physical,
                },
                CardEffect::GainBlockElement {
                    amount: 3,
                    element: Element::Ice,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn goldyx_will_focus() -> CardDefinition {
    CardDefinition {
        id: "goldyx_will_focus",
        name: "Will Focus",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::White,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMana {
                    color: ManaColor::Blue,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::White,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Red,
                    amount: 1,
                },
                CardEffect::GainMana {
                    color: ManaColor::Gold,
                    amount: 1,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn norowas_noble_manners() -> CardDefinition {
    CardDefinition {
        id: "norowas_noble_manners",
        name: "Noble Manners",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainInfluence { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 4 },
                CardEffect::ChangeReputation { amount: 1 },
            ],
        },
        sideways_value: 1,
    }
}

fn wolfhawk_swift_reflexes() -> CardDefinition {
    CardDefinition {
        id: "wolfhawk_swift_reflexes",
        name: "Swift Reflexes",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 3,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn wolfhawk_tirelessness() -> CardDefinition {
    CardDefinition {
        id: "wolfhawk_tirelessness",
        name: "Tirelessness",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::DrawCards { count: 1 },
            ],
        },
        sideways_value: 1,
    }
}

fn krang_savage_harvesting() -> CardDefinition {
    CardDefinition {
        id: "krang_savage_harvesting",
        name: "Savage Harvesting",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ChangeReputation { amount: -1 },
            ],
        },
        sideways_value: 1,
    }
}

fn krang_ruthless_coercion() -> CardDefinition {
    CardDefinition {
        id: "krang_ruthless_coercion",
        name: "Ruthless Coercion",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::GainInfluence { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 7 },
                CardEffect::ChangeReputation { amount: -2 },
            ],
        },
        sideways_value: 1,
    }
}

fn krang_battle_rage() -> CardDefinition {
    CardDefinition {
        id: "krang_battle_rage",
        name: "Battle Rage",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::TakeWound,
            ],
        },
        sideways_value: 1,
    }
}

fn braevalar_one_with_the_land() -> CardDefinition {
    CardDefinition {
        id: "braevalar_one_with_the_land",
        name: "One With The Land",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::GainHealing { amount: 1 },
            ],
        },
        sideways_value: 1,
    }
}

fn braevalar_druidic_paths() -> CardDefinition {
    CardDefinition {
        id: "braevalar_druidic_paths",
        name: "Druidic Paths",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::Compound {
                    effects: vec![
                        CardEffect::GainMove { amount: 2 },
                        CardEffect::GainHealing { amount: 2 },
                    ],
                },
            ],
        },
        sideways_value: 1,
    }
}

fn tovak_instinct() -> CardDefinition {
    CardDefinition {
        id: "tovak_instinct",
        name: "Instinct",
        color: CardColor::Red,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::GainInfluence { amount: 4 },
                CardEffect::GainAttack {
                    amount: 4,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 4,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn goldyx_crystal_joy() -> CardDefinition {
    CardDefinition {
        id: "goldyx_crystal_joy",
        name: "Crystal Joy",
        color: CardColor::Blue,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::AnyBasic,
        basic_effect: CardEffect::ConvertManaToCrystal,
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Red),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Blue),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Green),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::White),
                },
            ],
        },
        sideways_value: 1,
    }
}

fn norowas_rejuvenate() -> CardDefinition {
    CardDefinition {
        id: "norowas_rejuvenate",
        name: "Rejuvenate",
        color: CardColor::Green,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainHealing { amount: 1 },
                CardEffect::DrawCards { count: 1 },
                CardEffect::GainMana {
                    color: ManaColor::Green,
                    amount: 1,
                },
                CardEffect::ReadyUnit { max_level: 2 },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainHealing { amount: 2 },
                CardEffect::DrawCards { count: 2 },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Green),
                },
                CardEffect::ReadyUnit { max_level: 3 },
            ],
        },
        sideways_value: 1,
    }
}

fn axe_throw() -> CardDefinition {
    CardDefinition {
        id: "axe_throw",
        name: "Axe Throw",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainAttack {
                    amount: 1,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                },
            ],
        },
        powered_effect: CardEffect::AttackWithDefeatBonus {
            amount: 3,
            combat_type: CombatType::Ranged,
            element: Element::Physical,
            reputation_per_defeat: 0,
            fame_per_defeat: 1,
            armor_reduction_per_defeat: 0,
        },
        sideways_value: 1,
    }
}

fn arythea_mana_pull() -> CardDefinition {
    CardDefinition {
        id: "arythea_mana_pull",
        name: "Mana Pull",
        color: CardColor::White,
        card_type: DeedCardType::BasicAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::ExtraSourceDie,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::BlackAsAnyColor,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::ManaDrawPowered {
            dice_count: 2,
            tokens_per_die: 1,
        },
        sideways_value: 1,
    }
}

// =============================================================================
// Advanced action cards
// =============================================================================

/// Look up an advanced action card by ID.
pub fn get_advanced_action_card(id: &str) -> Option<CardDefinition> {
    match id {
        // Red (10)
        "blood_rage" => Some(blood_rage()),
        "intimidate" => Some(intimidate()),
        "blood_ritual" => Some(blood_ritual()),
        "counterattack" => Some(counterattack()),
        "fire_bolt" => Some(fire_bolt()),
        "into_the_heat" => Some(into_the_heat()),
        "explosive_bolt" => Some(explosive_bolt()),
        "decompose" => Some(decompose()),
        "ritual_attack" => Some(ritual_attack()),
        "maximal_effect" => Some(maximal_effect()),
        "blood_of_ancients" => Some(blood_of_ancients()),
        // Blue (10)
        "ice_bolt" => Some(ice_bolt()),
        "steady_tempo" => Some(steady_tempo()),
        "frost_bridge" => Some(frost_bridge()),
        "ice_shield" => Some(ice_shield()),
        "temporal_portal" => Some(temporal_portal()),
        "pure_magic" => Some(pure_magic()),
        "shield_bash" => Some(shield_bash()),
        "crystal_mastery" => Some(crystal_mastery()),
        "magic_talent" => Some(magic_talent()),
        "spell_forge" => Some(spell_forge()),
        // Green (11)
        "refreshing_walk" => Some(refreshing_walk()),
        "in_need" => Some(in_need()),
        "crushing_bolt" => Some(crushing_bolt()),
        "ambush" => Some(ambush()),
        "path_finding" => Some(path_finding()),
        "mountain_lore" => Some(mountain_lore()),
        "force_of_nature" => Some(force_of_nature()),
        "regeneration" => Some(regeneration()),
        "stout_resolve" => Some(stout_resolve()),
        "training" => Some(training()),
        "power_of_crystals" => Some(power_of_crystals()),
        // White (10)
        "swift_bolt" => Some(swift_bolt()),
        "agility" => Some(agility()),
        "diplomacy" => Some(diplomacy()),
        "song_of_wind" => Some(song_of_wind()),
        "heroic_tale" => Some(heroic_tale()),
        "learning" => Some(learning()),
        "chivalry" => Some(chivalry()),
        "mana_storm" => Some(mana_storm()),
        "peaceful_moment" => Some(peaceful_moment()),
        "dodge_and_weave" => Some(dodge_and_weave()),
        // Dual (3)
        "rush_of_adrenaline" => Some(rush_of_adrenaline()),
        "chilling_stare" => Some(chilling_stare()),
        _ => None,
    }
}

/// Helper: Choice of any mana color (red, blue, green, white, gold, black).
fn gain_mana_any_color() -> CardEffect {
    CardEffect::Choice {
        options: vec![
            CardEffect::GainMana { color: ManaColor::Red, amount: 1 },
            CardEffect::GainMana { color: ManaColor::Blue, amount: 1 },
            CardEffect::GainMana { color: ManaColor::Green, amount: 1 },
            CardEffect::GainMana { color: ManaColor::White, amount: 1 },
            CardEffect::GainMana { color: ManaColor::Gold, amount: 1 },
            CardEffect::GainMana { color: ManaColor::Black, amount: 1 },
        ],
    }
}

// --- Red Advanced Actions ---

fn blood_rage() -> CardDefinition {
    CardDefinition {
        id: "blood_rage",
        name: "Blood Rage",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::Compound {
                    effects: vec![
                        CardEffect::TakeWound,
                        CardEffect::GainAttack {
                            amount: 5,
                            combat_type: CombatType::Melee,
                            element: Element::Physical,
                        },
                    ],
                },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 4,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::Compound {
                    effects: vec![
                        CardEffect::TakeWound,
                        CardEffect::GainAttack {
                            amount: 9,
                            combat_type: CombatType::Melee,
                            element: Element::Physical,
                        },
                    ],
                },
            ],
        },
        sideways_value: 1,
    }
}

fn intimidate() -> CardDefinition {
    CardDefinition {
        id: "intimidate",
        name: "Intimidate",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::Choice {
                    options: vec![
                        CardEffect::GainInfluence { amount: 4 },
                        CardEffect::GainAttack {
                            amount: 3,
                            combat_type: CombatType::Melee,
                            element: Element::Physical,
                        },
                    ],
                },
                CardEffect::ChangeReputation { amount: -1 },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::Choice {
                    options: vec![
                        CardEffect::GainInfluence { amount: 8 },
                        CardEffect::GainAttack {
                            amount: 7,
                            combat_type: CombatType::Melee,
                            element: Element::Physical,
                        },
                    ],
                },
                CardEffect::ChangeReputation { amount: -2 },
            ],
        },
        sideways_value: 1,
    }
}

fn blood_ritual() -> CardDefinition {
    CardDefinition {
        id: "blood_ritual",
        name: "Blood Ritual",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                CardEffect::GainCrystal { color: Some(BasicManaColor::Red) },
                gain_mana_any_color(),
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                gain_mana_any_color(),
                gain_mana_any_color(),
                gain_mana_any_color(),
                CardEffect::Choice {
                    options: vec![
                        CardEffect::ConvertManaToCrystal,
                        CardEffect::Noop,
                    ],
                },
            ],
        },
        sideways_value: 1,
    }
}

fn counterattack() -> CardDefinition {
    CardDefinition {
        id: "counterattack",
        name: "Counterattack",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Scaling {
            factor: ScalingFactor::PerEnemyBlocked,
            base_effect: Box::new(CardEffect::GainAttack {
                amount: 2,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            }),
            bonus_per_count: Some(2),
            maximum: None,
        },
        powered_effect: CardEffect::Scaling {
            factor: ScalingFactor::PerEnemyBlocked,
            base_effect: Box::new(CardEffect::GainAttack {
                amount: 4,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            }),
            bonus_per_count: Some(3),
            maximum: None,
        },
        sideways_value: 1,
    }
}

fn fire_bolt() -> CardDefinition {
    CardDefinition {
        id: "fire_bolt",
        name: "Fire Bolt",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::GainCrystal { color: Some(BasicManaColor::Red) },
        powered_effect: CardEffect::GainAttack {
            amount: 3,
            combat_type: CombatType::Ranged,
            element: Element::Fire,
        },
        sideways_value: 1,
    }
}

fn into_the_heat() -> CardDefinition {
    CardDefinition {
        id: "into_the_heat",
        name: "Into the Heat",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::UnitCombatBonus {
                        attack_bonus: 2,
                        block_bonus: 2,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::AllUnits,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::UnitsCannotAbsorbDamage,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::UnitCombatBonus {
                        attack_bonus: 3,
                        block_bonus: 3,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::AllUnits,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::UnitsCannotAbsorbDamage,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- Blue Advanced Actions ---

fn ice_bolt() -> CardDefinition {
    CardDefinition {
        id: "ice_bolt",
        name: "Ice Bolt",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainCrystal { color: Some(BasicManaColor::Blue) },
        powered_effect: CardEffect::GainAttack {
            amount: 3,
            combat_type: CombatType::Ranged,
            element: Element::Ice,
        },
        sideways_value: 1,
    }
}

fn steady_tempo() -> CardDefinition {
    // Note: deck placement (basic: bottom, powered: top) is handled by
    // the play card command, not by the effect itself.
    CardDefinition {
        id: "steady_tempo",
        name: "Steady Tempo",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainMove { amount: 2 },
        powered_effect: CardEffect::GainMove { amount: 4 },
        sideways_value: 1,
    }
}

fn frost_bridge() -> CardDefinition {
    CardDefinition {
        id: "frost_bridge",
        name: "Frost Bridge",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Swamp),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Lake),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Swamp),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- Green Advanced Actions ---

fn refreshing_walk() -> CardDefinition {
    CardDefinition {
        id: "refreshing_walk",
        name: "Refreshing Walk",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Conditional {
            condition: EffectCondition::InCombat,
            then_effect: Box::new(CardEffect::GainMove { amount: 2 }),
            else_effect: Some(Box::new(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainHealing { amount: 1 },
                ],
            })),
        },
        powered_effect: CardEffect::Conditional {
            condition: EffectCondition::InCombat,
            then_effect: Box::new(CardEffect::GainMove { amount: 4 }),
            else_effect: Some(Box::new(CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 4 },
                    CardEffect::GainHealing { amount: 2 },
                ],
            })),
        },
        sideways_value: 1,
    }
}

fn in_need() -> CardDefinition {
    CardDefinition {
        id: "in_need",
        name: "In Need",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Scaling {
            factor: ScalingFactor::PerWoundTotal,
            base_effect: Box::new(CardEffect::GainInfluence { amount: 3 }),
            bonus_per_count: Some(1),
            maximum: None,
        },
        powered_effect: CardEffect::Scaling {
            factor: ScalingFactor::PerWoundTotal,
            base_effect: Box::new(CardEffect::GainInfluence { amount: 5 }),
            bonus_per_count: Some(2),
            maximum: None,
        },
        sideways_value: 1,
    }
}

fn crushing_bolt() -> CardDefinition {
    CardDefinition {
        id: "crushing_bolt",
        name: "Crushing Bolt",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::GainCrystal { color: Some(BasicManaColor::Green) },
        powered_effect: CardEffect::GainAttack {
            amount: 3,
            combat_type: CombatType::Siege,
            element: Element::Physical,
        },
        sideways_value: 1,
    }
}

fn ambush() -> CardDefinition {
    CardDefinition {
        id: "ambush",
        name: "Ambush",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::AttackBlockCardBonus {
                        attack_bonus: 1,
                        block_bonus: 2,
                        ranged_siege_attack_bonus: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::AttackBlockCardBonus {
                        attack_bonus: 2,
                        block_bonus: 4,
                        ranged_siege_attack_bonus: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn path_finding() -> CardDefinition {
    CardDefinition {
        id: "path_finding",
        name: "Path Finding",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: -1,
                        minimum: 2,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Plains),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Hills),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Forest),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Wasteland),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Desert),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Swamp),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(2),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn mountain_lore() -> CardDefinition {
    CardDefinition {
        id: "mountain_lore",
        name: "Mountain Lore",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 3 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::MountainLoreHandLimit {
                        hills_bonus: 1,
                        mountain_bonus: 0,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 5 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Mountain),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(5),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainSafe {
                        terrain: TerrainOrAll::Specific(Terrain::Mountain),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::MountainLoreHandLimit {
                        hills_bonus: 1,
                        mountain_bonus: 2,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Regeneration: Heal 1 + Ready unit (level ≤ 2) / Heal 2 + Ready unit (level ≤ 3)
fn regeneration() -> CardDefinition {
    CardDefinition {
        id: "regeneration",
        name: "Regeneration",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainHealing { amount: 1 },
                CardEffect::ReadyUnit { max_level: 2 },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainHealing { amount: 2 },
                CardEffect::ReadyUnit { max_level: 3 },
            ],
        },
        sideways_value: 1,
    }
}

/// Force of Nature: Grant unit Physical resistance / Choice(Siege 3, Block 6)
fn force_of_nature() -> CardDefinition {
    CardDefinition {
        id: "force_of_nature",
        name: "Force of Nature",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        // Basic: Select unit, grant Physical resistance (needs SelectUnitForModifier)
        basic_effect: CardEffect::Other {
            effect_type: EffectType::SelectUnitForModifier,
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 6,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- White Advanced Actions ---

fn swift_bolt() -> CardDefinition {
    CardDefinition {
        id: "swift_bolt",
        name: "Swift Bolt",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainCrystal { color: Some(BasicManaColor::White) },
        powered_effect: CardEffect::GainAttack {
            amount: 4,
            combat_type: CombatType::Ranged,
            element: Element::Physical,
        },
        sideways_value: 1,
    }
}

fn agility() -> CardDefinition {
    CardDefinition {
        id: "agility",
        name: "Agility",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::MoveToAttackConversion {
                        cost_per_point: 1,
                        attack_type: CombatValueType::Attack,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::MoveCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::MoveToAttackConversion {
                        cost_per_point: 1,
                        attack_type: CombatValueType::Attack,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::MoveToAttackConversion {
                        cost_per_point: 2,
                        attack_type: CombatValueType::Ranged,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::MoveCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

fn diplomacy() -> CardDefinition {
    CardDefinition {
        id: "diplomacy",
        name: "Diplomacy",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::InfluenceToBlockConversion {
                        cost_per_point: 1,
                        element: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::InfluenceCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 4 },
                CardEffect::Choice {
                    options: vec![
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::InfluenceToBlockConversion {
                                cost_per_point: 1,
                                element: Some(Element::Ice),
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::InfluenceToBlockConversion {
                                cost_per_point: 1,
                                element: Some(Element::Fire),
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                    ],
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::InfluenceCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- Red/White Dual Advanced Actions ---

/// Explosive Bolt: Take wound + gain 2 crystals / Ranged 3 with armor reduction on defeat
fn explosive_bolt() -> CardDefinition {
    CardDefinition {
        id: "explosive_bolt",
        name: "Explosive Bolt",
        color: CardColor::Red, // dual Red/White
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red), // or White
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::White),
                },
                CardEffect::GainCrystal {
                    color: Some(BasicManaColor::Red),
                },
            ],
        },
        // Powered: Ranged 3. For each enemy defeated, another enemy gets Armor -1.
        powered_effect: CardEffect::AttackWithDefeatBonus {
            amount: 3,
            combat_type: CombatType::Ranged,
            element: Element::Physical,
            reputation_per_defeat: 0,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 1,
        },
        sideways_value: 1,
    }
}

// --- Blue Advanced Actions (continued) ---

/// Ice Shield: Block 3 ice / Block 3 ice + reduce enemy armor by 3
fn ice_shield() -> CardDefinition {
    CardDefinition {
        id: "ice_shield",
        name: "Ice Shield",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainBlock {
            amount: 3,
            element: Element::Ice,
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainBlock {
                    amount: 3,
                    element: Element::Ice,
                },
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        exclude_resistance: Some(ResistanceElement::Ice),
                        armor_change: -3,
                        armor_minimum: 1,
                        ..SelectEnemyTemplate::new()
                    },
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Temporal Portal: Move 1, all terrain costs 1, no rampaging provoke, +1 hand limit /
///   Choice(Move 2 + same + HL 1, Move 1 + same + HL 2)
fn temporal_portal() -> CardDefinition {
    CardDefinition {
        id: "temporal_portal",
        name: "Temporal Portal",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 1 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreRampagingProvoke,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::HandLimitBonus { bonus: 1 },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::Compound {
                    effects: vec![
                        CardEffect::GainMove { amount: 2 },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::TerrainCost {
                                terrain: TerrainOrAll::All,
                                amount: 0,
                                minimum: 0,
                                replace_cost: Some(1),
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::RuleOverride {
                                rule: RuleOverride::IgnoreRampagingProvoke,
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                        CardEffect::HandLimitBonus { bonus: 1 },
                    ],
                },
                CardEffect::Compound {
                    effects: vec![
                        CardEffect::GainMove { amount: 1 },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::TerrainCost {
                                terrain: TerrainOrAll::All,
                                amount: 0,
                                minimum: 0,
                                replace_cost: Some(1),
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::RuleOverride {
                                rule: RuleOverride::IgnoreRampagingProvoke,
                            },
                            duration: ModifierDuration::Turn,
                            scope: ModifierScope::SelfScope,
                        },
                        CardEffect::HandLimitBonus { bonus: 2 },
                    ],
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- White Advanced Actions (continued) ---

/// Song of Wind: Move 2 + reduce plains/desert/wasteland costs /
///   Move 2 + deeper reductions + optional mana pay for lake traversal
fn song_of_wind() -> CardDefinition {
    CardDefinition {
        id: "song_of_wind",
        name: "Song of Wind",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Plains),
                        amount: -1,
                        minimum: 0,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Desert),
                        amount: -1,
                        minimum: 0,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Wasteland),
                        amount: -1,
                        minimum: 0,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        // Powered: Same but -2 reductions + optional blue mana pay for lake cost 0 (needs PayMana)
        powered_effect: CardEffect::Other {
            effect_type: EffectType::PayMana,
        },
        sideways_value: 1,
    }
}

/// Heroic Tale: Influence 3 + rep per recruit / Influence 6 + rep+fame per recruit
fn heroic_tale() -> CardDefinition {
    CardDefinition {
        id: "heroic_tale",
        name: "Heroic Tale",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 3 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RecruitmentBonus {
                        reputation_per_recruit: 1,
                        fame_per_recruit: 0,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 6 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RecruitmentBonus {
                        reputation_per_recruit: 1,
                        fame_per_recruit: 1,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Learning: Influence 2 + recruit AA at cost 6 to discard / Influence 4 + recruit AA at cost 9 to hand
fn learning() -> CardDefinition {
    CardDefinition {
        id: "learning",
        name: "Learning",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::LearningDiscount {
                        cost: 6,
                        destination: LearningDestination::Discard,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainInfluence { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::LearningDiscount {
                        cost: 9,
                        destination: LearningDestination::Hand,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Chivalry: Attack 3 or Attack 2 + rep +1/defeat / Attack 6 or Attack 4 + rep +1 + fame +1/defeat
fn stout_resolve() -> CardDefinition {
    CardDefinition {
        id: "stout_resolve",
        name: "Stout Resolve",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        // Basic: DiscardForBonus(Move2/Inf2/Atk2/Blk2, bonus=1, max=1, WoundOnly)
        basic_effect: CardEffect::DiscardForBonus {
            choice_options: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
            ],
            bonus_per_card: 1,
            max_discards: 1,
            discard_filter: DiscardForBonusFilter::WoundOnly,
        },
        // Powered: DiscardForBonus(Move3/Inf3/Atk3/Blk3, bonus=2, max=u32::MAX, AnyMaxOneWound)
        powered_effect: CardEffect::DiscardForBonus {
            choice_options: vec![
                CardEffect::GainMove { amount: 3 },
                CardEffect::GainInfluence { amount: 3 },
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::GainBlock {
                    amount: 3,
                    element: Element::Physical,
                },
            ],
            bonus_per_card: 2,
            max_discards: u32::MAX, // Infinity — unlimited discards
            discard_filter: DiscardForBonusFilter::AnyMaxOneWound,
        },
        sideways_value: 1,
    }
}

// --- Blue Advanced Actions (continued) ---

fn shield_bash() -> CardDefinition {
    CardDefinition {
        id: "shield_bash",
        name: "Shield Bash",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        // Basic: Block 3 (Physical). countsTwiceAgainstSwift handled in combat resolution.
        basic_effect: CardEffect::GainBlock {
            amount: 3,
            element: Element::Physical,
        },
        // Powered: Block 5 + on successful block, excess block reduces enemy armor (min 1)
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainBlock {
                    amount: 5,
                    element: Element::Physical,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::ShieldBashArmorReduction,
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

// --- Blue Advanced Actions (continued) ---

/// Pure Magic: pay a mana token, gain effect based on color.
/// Basic: value 4. Powered: value 7.
fn pure_magic() -> CardDefinition {
    CardDefinition {
        id: "pure_magic",
        name: "Pure Magic",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::PureMagic { amount: 4 },
        powered_effect: CardEffect::PureMagic { amount: 7 },
        sideways_value: 1,
    }
}

// --- Red Advanced Actions (continued) ---

/// Decompose: discard action card → gain crystals based on card color.
/// Basic: gain 2 crystals of matching color. Powered: gain 1 crystal of each non-matching.
fn decompose() -> CardDefinition {
    CardDefinition {
        id: "decompose",
        name: "Decompose",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Decompose {
            mode: EffectMode::Basic,
        },
        powered_effect: CardEffect::Decompose {
            mode: EffectMode::Powered,
        },
        sideways_value: 1,
    }
}

/// Ritual Attack: discard action card → color-based attack.
/// Basic: Red→Attack 5, Blue→Ice 3, White→Ranged 3, Green→Siege 2.
/// Powered: Red→Fire 6, Blue→ColdFire 4, White→Ranged Fire 4, Green→Siege Fire 3.
fn ritual_attack() -> CardDefinition {
    CardDefinition {
        id: "ritual_attack",
        name: "Ritual Attack",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::DiscardForAttack {
            attacks_by_color: vec![
                (
                    BasicManaColor::Red,
                    CardEffect::GainAttack {
                        amount: 5,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ),
                (
                    BasicManaColor::Blue,
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Ice,
                    },
                ),
                (
                    BasicManaColor::White,
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Ranged,
                        element: Element::Physical,
                    },
                ),
                (
                    BasicManaColor::Green,
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Siege,
                        element: Element::Physical,
                    },
                ),
            ],
        },
        powered_effect: CardEffect::DiscardForAttack {
            attacks_by_color: vec![
                (
                    BasicManaColor::Red,
                    CardEffect::GainAttack {
                        amount: 6,
                        combat_type: CombatType::Melee,
                        element: Element::Fire,
                    },
                ),
                (
                    BasicManaColor::Blue,
                    CardEffect::GainAttack {
                        amount: 4,
                        combat_type: CombatType::Melee,
                        element: Element::ColdFire,
                    },
                ),
                (
                    BasicManaColor::White,
                    CardEffect::GainAttack {
                        amount: 4,
                        combat_type: CombatType::Ranged,
                        element: Element::Fire,
                    },
                ),
                (
                    BasicManaColor::Green,
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Siege,
                        element: Element::Fire,
                    },
                ),
            ],
        },
        sideways_value: 1,
    }
}

// --- White Advanced Actions ---

fn chivalry() -> CardDefinition {
    CardDefinition {
        id: "chivalry",
        name: "Chivalry",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        // Basic: Choice(Attack 3, AttackWithDefeatBonus(2, rep+1/defeat))
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::AttackWithDefeatBonus {
                    amount: 2,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                    reputation_per_defeat: 1,
                    fame_per_defeat: 0,
                    armor_reduction_per_defeat: 0,
                },
            ],
        },
        // Powered: Choice(Attack 6, AttackWithDefeatBonus(4, rep+1/defeat, fame+1/defeat))
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 6,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
                CardEffect::AttackWithDefeatBonus {
                    amount: 4,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                    reputation_per_defeat: 1,
                    fame_per_defeat: 1,
                    armor_reduction_per_defeat: 0,
                },
            ],
        },
        sideways_value: 1,
    }
}

// =============================================================================
// Missing Advanced Actions (12 new)
// =============================================================================

/// Maximal Effect: Choose basic effect of any card in hand, play at double value.
fn maximal_effect() -> CardDefinition {
    CardDefinition {
        id: "maximal_effect",
        name: "Maximal Effect",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::MaximalEffect,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::MaximalEffect,
        },
        sideways_value: 1,
    }
}

/// Blood of Ancients: Basic: select AA from offer, play basic for free.
/// Powered: take wound, select AA from offer, play powered for free.
fn blood_of_ancients() -> CardDefinition {
    CardDefinition {
        id: "blood_of_ancients",
        name: "Blood of Ancients",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::BloodOfAncientsBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::BloodOfAncientsPowered,
        },
        sideways_value: 1,
    }
}

/// Crystal Mastery: Basic: convert crystal to 2 mana tokens of that color.
/// Powered: activate crystal mastery powered flag (crystals not consumed when used).
fn crystal_mastery() -> CardDefinition {
    CardDefinition {
        id: "crystal_mastery",
        name: "Crystal Mastery",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::CrystalMasteryBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::CrystalMasteryPowered,
        },
        sideways_value: 1,
    }
}

/// Magic Talent: Basic: play a spell from offer at half cost.
/// Powered: gain a spell from offer to hand.
fn magic_talent() -> CardDefinition {
    CardDefinition {
        id: "magic_talent",
        name: "Magic Talent",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::MagicTalentBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::MagicTalentPowered,
        },
        sideways_value: 1,
    }
}

/// Spell Forge: Basic: gain spell from offer to discard.
/// Powered: gain spell from offer to hand + gain crystal of spell color.
fn spell_forge() -> CardDefinition {
    CardDefinition {
        id: "spell_forge",
        name: "Spell Forge",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::SpellForgeBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::SpellForgePowered,
        },
        sideways_value: 1,
    }
}

/// Training: Gain AA from offer to discard (cost 0).
fn training() -> CardDefinition {
    CardDefinition {
        id: "training",
        name: "Training",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::Training,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::Training,
        },
        sideways_value: 1,
    }
}

/// Power of Crystals: Basic: spend crystal → gain 3 of that effect.
/// Powered: spend crystal → gain 5 of that effect.
fn power_of_crystals() -> CardDefinition {
    CardDefinition {
        id: "power_of_crystals",
        name: "Power of Crystals",
        color: CardColor::Green,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::PowerOfCrystalsBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::PowerOfCrystalsPowered,
        },
        sideways_value: 1,
    }
}

/// Mana Storm: Basic: select die from source, gain 2 mana tokens of that color.
/// Powered: replace entire mana source with chosen colors.
fn mana_storm() -> CardDefinition {
    CardDefinition {
        id: "mana_storm",
        name: "Mana Storm",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::ManaStormBasic,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::ManaStormPowered,
        },
        sideways_value: 1,
    }
}

/// Peaceful Moment: Multiple non-combat utility options (convert mana, heal, refresh).
fn peaceful_moment() -> CardDefinition {
    CardDefinition {
        id: "peaceful_moment",
        name: "Peaceful Moment",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::PeacefulMomentAction,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::PeacefulMomentAction,
        },
        sideways_value: 1,
    }
}

/// Dodge and Weave: Move 2 + block 2 / Move 4 + block 4, move usable in combat.
fn dodge_and_weave() -> CardDefinition {
    CardDefinition {
        id: "dodge_and_weave",
        name: "Dodge and Weave",
        color: CardColor::White,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::GainBlock {
                    amount: 2,
                    element: Element::Physical,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::MoveCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::GainBlock {
                    amount: 4,
                    element: Element::Physical,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::MoveCardsInCombat,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Rush of Adrenaline: Dual Red card. Compound(TakeWound, GainMove 4, Attack cards gain +2).
fn rush_of_adrenaline() -> CardDefinition {
    CardDefinition {
        id: "rush_of_adrenaline",
        name: "Rush of Adrenaline",
        color: CardColor::Red,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Red), // or White
        basic_effect: CardEffect::Other {
            effect_type: EffectType::RushOfAdrenaline,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::RushOfAdrenaline,
        },
        sideways_value: 1,
    }
}

/// Chilling Stare: Dual Blue card. Select enemy, reduce armor / paralyze.
fn chilling_stare() -> CardDefinition {
    CardDefinition {
        id: "chilling_stare",
        name: "Chilling Stare",
        color: CardColor::Blue,
        card_type: DeedCardType::AdvancedAction,
        powered_by: PoweredBy::Single(BasicManaColor::Blue), // or White
        // Basic: Influence 3 OR select non-ice-resistant enemy → nullify all attack abilities
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainInfluence { amount: 3 },
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        exclude_resistance: Some(ResistanceElement::Ice),
                        nullify_all_attack_abilities: true,
                        ..SelectEnemyTemplate::new()
                    },
                },
            ],
        },
        // Powered: Influence 5 OR select non-AI non-ice-resistant enemy → skip attack
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainInfluence { amount: 5 },
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        exclude_arcane_immune: true,
                        exclude_resistance: Some(ResistanceElement::Ice),
                        skip_attack: true,
                        ..SelectEnemyTemplate::new()
                    },
                },
            ],
        },
        sideways_value: 1,
    }
}

// =============================================================================
// Spell cards (24)
// =============================================================================

/// Look up a spell card by ID.
pub fn get_spell_card(id: &str) -> Option<CardDefinition> {
    match id {
        // Red (7)
        "fireball" => Some(fireball()),
        "flame_wall" => Some(flame_wall()),
        "tremor" => Some(tremor()),
        "mana_meltdown" => Some(mana_meltdown()),
        "demolish" => Some(demolish()),
        "burning_shield" => Some(burning_shield()),
        "offering" => Some(offering()),
        // Blue (6)
        "snowstorm" => Some(snowstorm()),
        "chill" => Some(chill()),
        "mist_form" => Some(mist_form()),
        "mana_claim" => Some(mana_claim()),
        "space_bending" => Some(space_bending()),
        "mana_bolt" => Some(mana_bolt()),
        // Green (4)
        "restoration" => Some(restoration()),
        "energy_flow" => Some(energy_flow()),
        "underground_travel" => Some(underground_travel()),
        "meditation" => Some(meditation()),
        // White (7)
        "whirlwind" => Some(whirlwind()),
        "expose" => Some(expose()),
        "cure" => Some(cure()),
        "call_to_arms" => Some(call_to_arms()),
        "mind_read" => Some(mind_read()),
        "wings_of_wind" => Some(wings_of_wind()),
        "charm" => Some(charm()),
        _ => None,
    }
}

// --- Red Spells ---

/// Fireball: Ranged Fire 5 / Compound(TakeWound, Siege Fire 8)
fn fireball() -> CardDefinition {
    CardDefinition {
        id: "fireball",
        name: "Fireball",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::GainAttack {
            amount: 5,
            combat_type: CombatType::Ranged,
            element: Element::Fire,
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                CardEffect::GainAttack {
                    amount: 8,
                    combat_type: CombatType::Siege,
                    element: Element::Fire,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Flame Wall: Choice(Fire Attack 5, Fire Block 7) / Choice(Fire Attack 7, Fire Block 9)
fn flame_wall() -> CardDefinition {
    CardDefinition {
        id: "flame_wall",
        name: "Flame Wall",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
                    element: Element::Fire,
                },
                CardEffect::GainBlock {
                    amount: 7,
                    element: Element::Fire,
                },
            ],
        },
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::GainAttack {
                    amount: 7,
                    combat_type: CombatType::Melee,
                    element: Element::Fire,
                },
                CardEffect::GainBlock {
                    amount: 9,
                    element: Element::Fire,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Tremor: Armor reduction (complex targeting)
fn tremor() -> CardDefinition {
    CardDefinition {
        id: "tremor",
        name: "Tremor",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        // Basic: one enemy −3 armor (min 1) OR all enemies −2 armor (min 1)
        basic_effect: CardEffect::Choice {
            options: vec![
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        armor_change: -3,
                        armor_minimum: 1,
                        ..SelectEnemyTemplate::new()
                    },
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::EnemyStat {
                        stat: ModEnemyStat::Armor,
                        amount: -2,
                        minimum: 1,
                        attack_index: None,
                        per_resistance: false,
                        fortified_amount: None,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::AllEnemies,
                },
            ],
        },
        // Powered: one enemy −3/−6 armor (min 1) OR all enemies −2/−4 armor (min 1)
        powered_effect: CardEffect::Choice {
            options: vec![
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        armor_change: -3,
                        armor_minimum: 1,
                        fortified_armor_change: Some(-6),
                        ..SelectEnemyTemplate::new()
                    },
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::EnemyStat {
                        stat: ModEnemyStat::Armor,
                        amount: -2,
                        minimum: 1,
                        attack_index: None,
                        per_resistance: false,
                        fortified_amount: Some(-4),
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::AllEnemies,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Mana Meltdown: Crystal manipulation spell
fn mana_meltdown() -> CardDefinition {
    CardDefinition {
        id: "mana_meltdown",
        name: "Mana Meltdown",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::ManaMeltdown,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::ManaMeltdown,
        },
        sideways_value: 1,
    }
}

/// Demolish: Fortification removal / destruction
fn demolish() -> CardDefinition {
    CardDefinition {
        id: "demolish",
        name: "Demolish",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::GainAttack {
            amount: 5,
            combat_type: CombatType::Siege,
            element: Element::Physical,
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                CardEffect::GainAttack {
                    amount: 12,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Burning Shield: Fire block + conditional fire attack
fn burning_shield() -> CardDefinition {
    CardDefinition {
        id: "burning_shield",
        name: "Burning Shield",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainBlock {
                    amount: 4,
                    element: Element::Fire,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::BurningShieldActive {
                        mode: BurningShieldMode::Attack,
                        block_value: 4,
                        attack_value: 4,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainBlock {
                    amount: 4,
                    element: Element::Fire,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::BurningShieldActive {
                        mode: BurningShieldMode::Destroy,
                        block_value: 4,
                        attack_value: 0,
                    },
                    duration: ModifierDuration::Combat,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Offering: Sacrifice crystal for benefits
fn offering() -> CardDefinition {
    CardDefinition {
        id: "offering",
        name: "Offering",
        color: CardColor::Red,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Red),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::Sacrifice,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::Sacrifice,
        },
        sideways_value: 1,
    }
}

// --- Blue Spells ---

/// Snowstorm: Ranged Ice 5 / Compound(TakeWound, Siege Ice 8)
fn snowstorm() -> CardDefinition {
    CardDefinition {
        id: "snowstorm",
        name: "Snowstorm",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::GainAttack {
            amount: 5,
            combat_type: CombatType::Ranged,
            element: Element::Ice,
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::TakeWound,
                CardEffect::GainAttack {
                    amount: 8,
                    combat_type: CombatType::Siege,
                    element: Element::Ice,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Chill: Freeze target enemy
fn chill() -> CardDefinition {
    CardDefinition {
        id: "chill",
        name: "Chill",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        // Basic: select non-AI non-ice-resistant enemy → skip attack + remove fire resistance
        basic_effect: CardEffect::SelectCombatEnemy {
            template: SelectEnemyTemplate {
                exclude_arcane_immune: true,
                exclude_resistance: Some(ResistanceElement::Ice),
                skip_attack: true,
                remove_fire_resistance: true,
                ..SelectEnemyTemplate::new()
            },
        },
        // Powered: select non-AI non-ice-resistant enemy → skip attack + −4 armor (min 1)
        powered_effect: CardEffect::SelectCombatEnemy {
            template: SelectEnemyTemplate {
                exclude_arcane_immune: true,
                exclude_resistance: Some(ResistanceElement::Ice),
                skip_attack: true,
                armor_change: -4,
                armor_minimum: 1,
                ..SelectEnemyTemplate::new()
            },
        },
        sideways_value: 1,
    }
}

/// Mist Form: All terrain costs 1 this turn
fn mist_form() -> CardDefinition {
    CardDefinition {
        id: "mist_form",
        name: "Mist Form",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 2 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreRampagingProvoke,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Mana Claim: Claim a die from the source
fn mana_claim() -> CardDefinition {
    CardDefinition {
        id: "mana_claim",
        name: "Mana Claim",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::ManaClaim,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::ManaClaim,
        },
        sideways_value: 1,
    }
}

/// Space Bending: Long-distance movement
fn space_bending() -> CardDefinition {
    CardDefinition {
        id: "space_bending",
        name: "Space Bending",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::SpaceBendingAdjacency,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreRampagingProvoke,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::TimeBendingActive,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::Noop,
            ],
        },
        sideways_value: 1,
    }
}

/// Mana Bolt: Pay mana tokens for ice attacks
fn mana_bolt() -> CardDefinition {
    CardDefinition {
        id: "mana_bolt",
        name: "Mana Bolt",
        color: CardColor::Blue,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Blue),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::ManaBolt,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::ManaBolt,
        },
        sideways_value: 1,
    }
}

// --- Green Spells ---

/// Restoration: Healing 3 / Conditional(forest: Healing 5, else: Healing 3)
fn restoration() -> CardDefinition {
    CardDefinition {
        id: "restoration",
        name: "Restoration",
        color: CardColor::Green,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::GainHealing { amount: 3 },
        powered_effect: CardEffect::Conditional {
            condition: EffectCondition::OnTerrain {
                terrain: vec![Terrain::Forest],
            },
            then_effect: Box::new(CardEffect::GainHealing { amount: 5 }),
            else_effect: Some(Box::new(CardEffect::GainHealing { amount: 3 })),
        },
        sideways_value: 1,
    }
}

/// Energy Flow: Ready a unit
fn energy_flow() -> CardDefinition {
    CardDefinition {
        id: "energy_flow",
        name: "Energy Flow",
        color: CardColor::Green,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::EnergyFlow,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::EnergyFlow,
        },
        sideways_value: 1,
    }
}

/// Underground Travel: Move 3 + swamp/lake cost 1 / all terrain cost 1
fn underground_travel() -> CardDefinition {
    CardDefinition {
        id: "underground_travel",
        name: "Underground Travel",
        color: CardColor::Green,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 3 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainProhibition {
                        prohibited_terrains: vec![Terrain::Swamp, Terrain::Lake],
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreRampagingProvoke,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 3 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(1),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainProhibition {
                        prohibited_terrains: vec![Terrain::Swamp, Terrain::Lake],
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreRampagingProvoke,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::RuleOverride {
                        rule: RuleOverride::IgnoreFortification,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Meditation: Discard cards from hand to place on top of deck
fn meditation() -> CardDefinition {
    CardDefinition {
        id: "meditation",
        name: "Meditation",
        color: CardColor::Green,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::Green),
        basic_effect: CardEffect::Noop,
        powered_effect: CardEffect::Noop,
        sideways_value: 1,
    }
}

// --- White Spells ---

/// Whirlwind: Target enemy doesn't attack this combat
fn whirlwind() -> CardDefinition {
    CardDefinition {
        id: "whirlwind",
        name: "Whirlwind",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        // Basic: select enemy → skip its attack
        basic_effect: CardEffect::SelectCombatEnemy {
            template: SelectEnemyTemplate {
                skip_attack: true,
                ..SelectEnemyTemplate::new()
            },
        },
        // Powered: select enemy → defeat it outright
        powered_effect: CardEffect::SelectCombatEnemy {
            template: SelectEnemyTemplate {
                defeat: true,
                ..SelectEnemyTemplate::new()
            },
        },
        sideways_value: 1,
    }
}

/// Expose: Enemies lose fortification and resistances
fn expose() -> CardDefinition {
    CardDefinition {
        id: "expose",
        name: "Expose",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        // Basic: select one enemy → nullify fortification + remove resistances, then Ranged 2
        basic_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::SelectCombatEnemy {
                    template: SelectEnemyTemplate {
                        nullify_fortified: true,
                        remove_resistances: true,
                        ..SelectEnemyTemplate::new()
                    },
                },
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                },
            ],
        },
        // Powered: ALL enemies lose fortification OR resistances, then Ranged 3
        powered_effect: CardEffect::Compound {
            effects: vec![
                CardEffect::Choice {
                    options: vec![
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::AbilityNullifier {
                                ability: Some(EnemyAbilityType::Fortified),
                                ignore_arcane_immunity: false,
                            },
                            duration: ModifierDuration::Combat,
                            scope: ModifierScope::AllEnemies,
                        },
                        CardEffect::ApplyModifier {
                            effect: ModifierEffect::RemoveResistances,
                            duration: ModifierDuration::Combat,
                            scope: ModifierScope::AllEnemies,
                        },
                    ],
                },
                CardEffect::GainAttack {
                    amount: 3,
                    combat_type: CombatType::Ranged,
                    element: Element::Physical,
                },
            ],
        },
        sideways_value: 1,
    }
}

/// Cure: Heal wounds and draw cards
fn cure() -> CardDefinition {
    CardDefinition {
        id: "cure",
        name: "Cure",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        // Basic (Cure): heal up to 2 wounds from hand, draw 1 card per wound healed
        basic_effect: CardEffect::Cure { amount: 2 },
        // Powered (Disease): set armor to 1 for all fully-blocked enemies
        powered_effect: CardEffect::Disease,
        sideways_value: 1,
    }
}

/// Call to Arms: Borrow a unit temporarily
fn call_to_arms() -> CardDefinition {
    CardDefinition {
        id: "call_to_arms",
        name: "Call to Arms",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::CallToArms,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::CallToArms,
        },
        sideways_value: 1,
    }
}

/// Mind Read: Gain crystals based on opponent's crystals
fn mind_read() -> CardDefinition {
    CardDefinition {
        id: "mind_read",
        name: "Mind Read",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Other {
            effect_type: EffectType::MindRead,
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::MindRead,
        },
        sideways_value: 1,
    }
}

/// Flight option helper: Move N + all terrain costs 1 + no provoke + no exploration.
fn flight_option(move_amount: u32) -> CardEffect {
    CardEffect::Compound {
        effects: vec![
            CardEffect::GainMove { amount: move_amount },
            CardEffect::ApplyModifier {
                effect: ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All,
                    amount: 0,
                    minimum: 0,
                    replace_cost: Some(1),
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
            CardEffect::ApplyModifier {
                effect: ModifierEffect::RuleOverride {
                    rule: RuleOverride::IgnoreRampagingProvoke,
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
            CardEffect::ApplyModifier {
                effect: ModifierEffect::RuleOverride {
                    rule: RuleOverride::NoExploration,
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
        ],
    }
}

/// Wings of Wind: Flight (choose 1-5 move) / Wings of Night (custom)
fn wings_of_wind() -> CardDefinition {
    CardDefinition {
        id: "wings_of_wind",
        name: "Wings of Wind",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::Choice {
            options: vec![
                flight_option(1),
                flight_option(2),
                flight_option(3),
                flight_option(4),
                flight_option(5),
            ],
        },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::WingsOfNight,
        },
        sideways_value: 1,
    }
}

/// Charm: Influence 4 / Choose(Influence 8, GainUnit)
fn charm() -> CardDefinition {
    CardDefinition {
        id: "charm",
        name: "Charm",
        color: CardColor::White,
        card_type: DeedCardType::Spell,
        powered_by: PoweredBy::Single(BasicManaColor::White),
        basic_effect: CardEffect::GainInfluence { amount: 4 },
        powered_effect: CardEffect::Other {
            effect_type: EffectType::PossessEnemy,
        },
        sideways_value: 1,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_basic_cards_lookup() {
        let ids = [
            "march",
            "stamina",
            "swiftness",
            "rage",
            "determination",
            "tranquility",
            "promise",
            "threaten",
            "crystallize",
            "mana_draw",
            "concentration",
            "improvisation",
            "wound",
        ];
        for id in ids {
            assert!(
                get_basic_action_card(id).is_some(),
                "Missing basic card: {}",
                id
            );
        }
    }

    #[test]
    fn all_hero_cards_lookup() {
        let ids = [
            "arythea_battle_versatility",
            "tovak_cold_toughness",
            "goldyx_will_focus",
            "norowas_noble_manners",
            "wolfhawk_swift_reflexes",
            "wolfhawk_tirelessness",
            "krang_savage_harvesting",
            "krang_ruthless_coercion",
            "krang_battle_rage",
            "braevalar_one_with_the_land",
            "braevalar_druidic_paths",
        ];
        for id in ids {
            assert!(get_card(id).is_some(), "Missing hero card: {}", id);
        }
    }

    #[test]
    fn march_basic_is_gain_move_2() {
        let card = get_card("march").unwrap();
        assert!(matches!(
            card.basic_effect,
            CardEffect::GainMove { amount: 2 }
        ));
        assert!(matches!(
            card.powered_effect,
            CardEffect::GainMove { amount: 4 }
        ));
        assert_eq!(card.sideways_value, 1);
    }

    #[test]
    fn rage_basic_is_choice() {
        let card = get_card("rage").unwrap();
        assert!(matches!(card.basic_effect, CardEffect::Choice { .. }));
        assert!(matches!(
            card.powered_effect,
            CardEffect::GainAttack { amount: 4, .. }
        ));
    }

    #[test]
    fn threaten_powered_is_compound() {
        let card = get_card("threaten").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(
                    effects[0],
                    CardEffect::GainInfluence { amount: 5 }
                ));
                assert!(matches!(
                    effects[1],
                    CardEffect::ChangeReputation { amount: -1 }
                ));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn wound_has_noop_effects() {
        let card = get_card("wound").unwrap();
        assert!(matches!(card.basic_effect, CardEffect::Noop));
        assert_eq!(card.sideways_value, 0);
    }

    #[test]
    fn unknown_card_returns_none() {
        assert!(get_card("nonexistent").is_none());
    }

    // =========================================================================
    // Advanced action card tests
    // =========================================================================

    #[test]
    fn all_44_advanced_action_cards_lookup() {
        let ids = crate::offers::all_advanced_action_ids();
        assert_eq!(ids.len(), 44);
        for id in ids {
            let card = get_card(id);
            assert!(card.is_some(), "Missing advanced action card: {}", id);
            let card = card.unwrap();
            assert_eq!(card.card_type, DeedCardType::AdvancedAction, "Card '{}' is not AA", id);
            assert_eq!(card.sideways_value, 1, "Card '{}' sideways_value != 1", id);
        }
    }

    #[test]
    fn all_24_spell_cards_lookup() {
        let ids = crate::offers::all_spell_ids();
        assert_eq!(ids.len(), 24);
        for id in ids {
            let card = get_card(id);
            assert!(card.is_some(), "Missing spell card: {}", id);
            let card = card.unwrap();
            assert_eq!(card.card_type, DeedCardType::Spell, "Card '{}' is not Spell", id);
            assert_eq!(card.sideways_value, 1, "Spell '{}' sideways_value != 1", id);
            assert!(matches!(card.powered_by, PoweredBy::Single(_)), "Spell '{}' has no powered_by", id);
        }
    }

    #[test]
    fn blood_rage_effects() {
        let card = get_card("blood_rage").unwrap();
        assert_eq!(card.color, CardColor::Red);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Red));
        // Basic: Choice(Attack 2, Compound(TakeWound, Attack 5))
        match &card.basic_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainAttack { amount: 2, .. }));
                match &options[1] {
                    CardEffect::Compound { effects } => {
                        assert_eq!(effects.len(), 2);
                        assert!(matches!(effects[0], CardEffect::TakeWound));
                        assert!(matches!(effects[1], CardEffect::GainAttack { amount: 5, .. }));
                    }
                    _ => panic!("Expected Compound"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn intimidate_effects() {
        let card = get_card("intimidate").unwrap();
        assert_eq!(card.color, CardColor::Red);
        // Basic: Compound(Choice(Influence 4, Attack 3), ChangeRep -1)
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::Choice { .. }));
                assert!(matches!(effects[1], CardEffect::ChangeReputation { amount: -1 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn blood_ritual_basic_has_take_wound_and_crystal() {
        let card = get_card("blood_ritual").unwrap();
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3);
                assert!(matches!(effects[0], CardEffect::TakeWound));
                assert!(matches!(effects[1], CardEffect::GainCrystal { color: Some(BasicManaColor::Red) }));
                // 3rd is gain_mana_any_color (6-option choice)
                match &effects[2] {
                    CardEffect::Choice { options } => assert_eq!(options.len(), 6),
                    _ => panic!("Expected Choice for mana"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn blood_ritual_powered_has_three_mana_choices() {
        let card = get_card("blood_ritual").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 5); // TakeWound + 3 mana choices + crystallize choice
                assert!(matches!(effects[0], CardEffect::TakeWound));
                for i in 1..=3 {
                    match &effects[i] {
                        CardEffect::Choice { options } => assert_eq!(options.len(), 6),
                        _ => panic!("Expected Choice for mana at index {}", i),
                    }
                }
                // Last is Choice(ConvertManaToCrystal, Noop)
                match &effects[4] {
                    CardEffect::Choice { options } => {
                        assert_eq!(options.len(), 2);
                        assert!(matches!(options[0], CardEffect::ConvertManaToCrystal));
                        assert!(matches!(options[1], CardEffect::Noop));
                    }
                    _ => panic!("Expected crystallize choice"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn counterattack_is_scaling() {
        let card = get_card("counterattack").unwrap();
        match &card.basic_effect {
            CardEffect::Scaling { factor, base_effect, bonus_per_count, .. } => {
                assert!(matches!(factor, ScalingFactor::PerEnemyBlocked));
                assert!(matches!(**base_effect, CardEffect::GainAttack { amount: 2, .. }));
                assert_eq!(*bonus_per_count, Some(2));
            }
            _ => panic!("Expected Scaling"),
        }
        match &card.powered_effect {
            CardEffect::Scaling { factor, base_effect, bonus_per_count, .. } => {
                assert!(matches!(factor, ScalingFactor::PerEnemyBlocked));
                assert!(matches!(**base_effect, CardEffect::GainAttack { amount: 4, .. }));
                assert_eq!(*bonus_per_count, Some(3));
            }
            _ => panic!("Expected Scaling"),
        }
    }

    #[test]
    fn bolt_cards_basic_crystal_powered_attack() {
        let bolts = [
            ("fire_bolt", BasicManaColor::Red, CombatType::Ranged, Element::Fire, 3),
            ("ice_bolt", BasicManaColor::Blue, CombatType::Ranged, Element::Ice, 3),
            ("crushing_bolt", BasicManaColor::Green, CombatType::Siege, Element::Physical, 3),
            ("swift_bolt", BasicManaColor::White, CombatType::Ranged, Element::Physical, 4),
        ];
        for (id, color, ct, elem, amt) in bolts {
            let card = get_card(id).unwrap();
            assert!(matches!(card.basic_effect, CardEffect::GainCrystal { color: Some(c) } if c == color),
                "{} basic should be GainCrystal", id);
            match &card.powered_effect {
                CardEffect::GainAttack { amount, combat_type, element } => {
                    assert_eq!(*amount, amt, "{} powered amount", id);
                    assert_eq!(*combat_type, ct, "{} powered combat_type", id);
                    assert_eq!(*element, elem, "{} powered element", id);
                }
                _ => panic!("{} powered should be GainAttack", id),
            }
        }
    }

    #[test]
    fn refreshing_walk_is_conditional() {
        let card = get_card("refreshing_walk").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Conditional { condition, then_effect, else_effect } => {
                assert!(matches!(condition, EffectCondition::InCombat));
                assert!(matches!(**then_effect, CardEffect::GainMove { amount: 2 }));
                let else_eff = else_effect.as_ref().unwrap();
                match else_eff.as_ref() {
                    CardEffect::Compound { effects } => {
                        assert_eq!(effects.len(), 2);
                        assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                        assert!(matches!(effects[1], CardEffect::GainHealing { amount: 1 }));
                    }
                    _ => panic!("Expected Compound in else branch"),
                }
            }
            _ => panic!("Expected Conditional"),
        }
    }

    #[test]
    fn in_need_is_scaling() {
        let card = get_card("in_need").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Scaling { factor, base_effect, bonus_per_count, .. } => {
                assert!(matches!(factor, ScalingFactor::PerWoundTotal));
                assert!(matches!(**base_effect, CardEffect::GainInfluence { amount: 3 }));
                assert_eq!(*bonus_per_count, Some(1));
            }
            _ => panic!("Expected Scaling"),
        }
    }

    #[test]
    fn steady_tempo_is_simple_move() {
        let card = get_card("steady_tempo").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        assert!(matches!(card.basic_effect, CardEffect::GainMove { amount: 2 }));
        assert!(matches!(card.powered_effect, CardEffect::GainMove { amount: 4 }));
    }

    // =========================================================================
    // Modifier-based advanced action card tests
    // =========================================================================

    #[test]
    fn into_the_heat_has_unit_combat_bonus_and_rule() {
        let card = get_card("into_the_heat").unwrap();
        assert_eq!(card.color, CardColor::Red);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                // First: UnitCombatBonus +2/+2 scoped to AllUnits
                match &effects[0] {
                    CardEffect::ApplyModifier { effect, duration, scope } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::UnitCombatBonus {
                                attack_bonus: 2,
                                block_bonus: 2
                            }
                        ));
                        assert_eq!(*duration, ModifierDuration::Combat);
                        assert!(matches!(scope, ModifierScope::AllUnits));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
                // Second: RuleOverride UnitsCannotAbsorbDamage
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::RuleOverride {
                                rule: RuleOverride::UnitsCannotAbsorbDamage
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn frost_bridge_has_terrain_cost_modifiers() {
        let card = get_card("frost_bridge").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        // Basic: Move 2 + swamp costs 1
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::TerrainCost {
                                terrain: TerrainOrAll::Specific(Terrain::Swamp),
                                replace_cost: Some(1),
                                ..
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
        // Powered: Move 4 + lake costs 1 + swamp costs 1
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 4 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn ambush_has_attack_block_card_bonus() {
        let card = get_card("ambush").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::AttackBlockCardBonus {
                                attack_bonus: 1,
                                block_bonus: 2,
                                ..
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn agility_has_move_to_attack_conversion() {
        let card = get_card("agility").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3); // Move + MoveToAttack + MoveCardsInCombat
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
            }
            _ => panic!("Expected Compound"),
        }
        // Powered has 4 effects (Move + 2 conversions + rule)
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 4);
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn diplomacy_basic_has_influence_to_block() {
        let card = get_card("diplomacy").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3); // Influence + conversion + rule
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 2 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn diplomacy_powered_has_element_choice() {
        let card = get_card("diplomacy").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3); // Influence + Choice(ice/fire) + rule
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 4 }));
                // Second is a Choice between ice and fire conversions
                assert!(matches!(effects[1], CardEffect::Choice { .. }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn path_finding_basic_has_terrain_reduction() {
        let card = get_card("path_finding").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::TerrainCost {
                                terrain: TerrainOrAll::All,
                                amount: -1,
                                minimum: 2,
                                ..
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn path_finding_powered_has_six_terrain_replacements() {
        let card = get_card("path_finding").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                // Move 4 + 6 terrain cost modifiers
                assert_eq!(effects.len(), 7);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 4 }));
                for eff in &effects[1..] {
                    assert!(matches!(eff, CardEffect::ApplyModifier { .. }));
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn mountain_lore_basic_has_hand_limit_bonus() {
        let card = get_card("mountain_lore").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 3 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::MountainLoreHandLimit {
                                hills_bonus: 1,
                                mountain_bonus: 0
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn mountain_lore_powered_has_terrain_safe_and_cost() {
        let card = get_card("mountain_lore").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                // Move 5 + TerrainCost(mountain) + TerrainSafe(mountain) + HandLimit
                assert_eq!(effects.len(), 4);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 5 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    // =========================================================================
    // Batch 2: HandLimitBonus + modifier-producing + partial cards
    // =========================================================================

    #[test]
    fn explosive_bolt_basic_is_wound_plus_crystals() {
        let card = get_card("explosive_bolt").unwrap();
        assert_eq!(card.card_type, DeedCardType::AdvancedAction);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 3);
                assert!(matches!(effects[0], CardEffect::TakeWound));
                assert!(matches!(
                    effects[1],
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::White)
                    }
                ));
                assert!(matches!(
                    effects[2],
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Red)
                    }
                ));
            }
            _ => panic!("Expected Compound"),
        }
        // Powered: Ranged Attack 3 with armor reduction per defeat
        match &card.powered_effect {
            CardEffect::AttackWithDefeatBonus {
                amount,
                combat_type,
                element,
                armor_reduction_per_defeat,
                ..
            } => {
                assert_eq!(*amount, 3);
                assert_eq!(*combat_type, CombatType::Ranged);
                assert_eq!(*element, Element::Physical);
                assert_eq!(*armor_reduction_per_defeat, 1);
            }
            _ => panic!("Expected AttackWithDefeatBonus"),
        }
    }

    #[test]
    fn ice_shield_basic_is_ice_block() {
        let card = get_card("ice_shield").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        match &card.basic_effect {
            CardEffect::GainBlock { amount, element } => {
                assert_eq!(*amount, 3);
                assert_eq!(*element, Element::Ice);
            }
            _ => panic!("Expected GainBlock"),
        }
        // Powered: Block 3 Ice + SelectCombatEnemy (armor -3, min 1, exclude ice resistant)
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(&effects[0], CardEffect::GainBlock { amount: 3, element: Element::Ice }));
                assert!(matches!(&effects[1], CardEffect::SelectCombatEnemy { .. }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn temporal_portal_basic_has_terrain_and_hand_limit() {
        let card = get_card("temporal_portal").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 4);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 1 }));
                // TerrainCost all = 1
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::TerrainCost {
                                terrain: TerrainOrAll::All,
                                replace_cost: Some(1),
                                ..
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier for terrain"),
                }
                // RuleOverride: IgnoreRampagingProvoke
                match &effects[2] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::RuleOverride {
                                rule: RuleOverride::IgnoreRampagingProvoke
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier for rule"),
                }
                // HandLimitBonus
                assert!(matches!(effects[3], CardEffect::HandLimitBonus { bonus: 1 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn temporal_portal_powered_is_choice_of_two_compounds() {
        let card = get_card("temporal_portal").unwrap();
        match &card.powered_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                // First option: Move 2 + modifiers + HL 1
                match &options[0] {
                    CardEffect::Compound { effects } => {
                        assert_eq!(effects.len(), 4);
                        assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                        assert!(matches!(effects[3], CardEffect::HandLimitBonus { bonus: 1 }));
                    }
                    _ => panic!("Expected Compound in option 0"),
                }
                // Second option: Move 1 + modifiers + HL 2
                match &options[1] {
                    CardEffect::Compound { effects } => {
                        assert_eq!(effects.len(), 4);
                        assert!(matches!(effects[0], CardEffect::GainMove { amount: 1 }));
                        assert!(matches!(effects[3], CardEffect::HandLimitBonus { bonus: 2 }));
                    }
                    _ => panic!("Expected Compound in option 1"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn song_of_wind_basic_has_terrain_reductions() {
        let card = get_card("song_of_wind").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 4);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 2 }));
                // 3 terrain cost modifiers for plains/desert/wasteland
                for i in 1..=3 {
                    match &effects[i] {
                        CardEffect::ApplyModifier { effect, .. } => {
                            assert!(matches!(
                                effect,
                                ModifierEffect::TerrainCost { amount: -1, .. }
                            ));
                        }
                        _ => panic!("Expected ApplyModifier at index {}", i),
                    }
                }
            }
            _ => panic!("Expected Compound"),
        }
        // Powered is placeholder (PayMana)
        assert!(matches!(card.powered_effect, CardEffect::Other { .. }));
    }

    #[test]
    fn heroic_tale_basic_has_recruitment_bonus() {
        let card = get_card("heroic_tale").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 3 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, duration, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::RecruitmentBonus {
                                reputation_per_recruit: 1,
                                fame_per_recruit: 0
                            }
                        ));
                        assert_eq!(*duration, ModifierDuration::Turn);
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn heroic_tale_powered_has_fame_per_recruit() {
        let card = get_card("heroic_tale").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 6 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::RecruitmentBonus {
                                reputation_per_recruit: 1,
                                fame_per_recruit: 1
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn learning_basic_has_learning_discount_to_discard() {
        let card = get_card("learning").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 2 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::LearningDiscount {
                                cost: 6,
                                destination: LearningDestination::Discard
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn learning_powered_has_learning_discount_to_hand() {
        let card = get_card("learning").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainInfluence { amount: 4 }));
                match &effects[1] {
                    CardEffect::ApplyModifier { effect, .. } => {
                        assert!(matches!(
                            effect,
                            ModifierEffect::LearningDiscount {
                                cost: 9,
                                destination: LearningDestination::Hand
                            }
                        ));
                    }
                    _ => panic!("Expected ApplyModifier"),
                }
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn regeneration_basic_has_heal_and_ready_unit() {
        let card = get_card("regeneration").unwrap();
        assert_eq!(card.color, CardColor::Green);
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainHealing { amount: 1 }));
                assert!(matches!(effects[1], CardEffect::ReadyUnit { max_level: 2 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn regeneration_powered_has_heal_and_ready_unit_level3() {
        let card = get_card("regeneration").unwrap();
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainHealing { amount: 2 }));
                assert!(matches!(effects[1], CardEffect::ReadyUnit { max_level: 3 }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn force_of_nature_powered_is_choice() {
        let card = get_card("force_of_nature").unwrap();
        assert_eq!(card.color, CardColor::Green);
        // Basic is placeholder (SelectUnitForModifier)
        assert!(matches!(card.basic_effect, CardEffect::Other { .. }));
        // Powered: Choice(Siege 3, Block 6)
        match &card.powered_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                match &options[0] {
                    CardEffect::GainAttack {
                        amount,
                        combat_type,
                        ..
                    } => {
                        assert_eq!(*amount, 3);
                        assert_eq!(*combat_type, CombatType::Siege);
                    }
                    _ => panic!("Expected GainAttack"),
                }
                assert!(matches!(
                    options[1],
                    CardEffect::GainBlock {
                        amount: 6,
                        element: Element::Physical
                    }
                ));
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn all_new_batch2_and_3_cards_exist() {
        let cards = [
            "explosive_bolt",
            "ice_shield",
            "temporal_portal",
            "song_of_wind",
            "heroic_tale",
            "learning",
            "force_of_nature",
            "regeneration",
            "chivalry",
            "stout_resolve",
            "shield_bash",
        ];
        for id in cards {
            assert!(
                get_card(id).is_some(),
                "Card '{}' should be defined",
                id
            );
            let card = get_card(id).unwrap();
            assert_eq!(card.card_type, DeedCardType::AdvancedAction);
            assert_eq!(card.sideways_value, 1);
        }
    }

    #[test]
    fn chivalry_basic_is_choice_attack_or_defeat_bonus() {
        let card = get_card("chivalry").unwrap();
        assert_eq!(card.color, CardColor::White);
        match &card.basic_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                // Option 1: Attack 3 melee
                match &options[0] {
                    CardEffect::GainAttack {
                        amount,
                        combat_type,
                        ..
                    } => {
                        assert_eq!(*amount, 3);
                        assert_eq!(*combat_type, CombatType::Melee);
                    }
                    _ => panic!("Expected GainAttack"),
                }
                // Option 2: AttackWithDefeatBonus(2, rep+1)
                match &options[1] {
                    CardEffect::AttackWithDefeatBonus {
                        amount,
                        combat_type,
                        reputation_per_defeat,
                        fame_per_defeat,
                        ..
                    } => {
                        assert_eq!(*amount, 2);
                        assert_eq!(*combat_type, CombatType::Melee);
                        assert_eq!(*reputation_per_defeat, 1);
                        assert_eq!(*fame_per_defeat, 0);
                    }
                    _ => panic!("Expected AttackWithDefeatBonus"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn chivalry_powered_has_fame_per_defeat() {
        let card = get_card("chivalry").unwrap();
        match &card.powered_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                // Option 1: Attack 6
                assert!(matches!(
                    &options[0],
                    CardEffect::GainAttack { amount: 6, .. }
                ));
                // Option 2: AttackWithDefeatBonus(4, rep+1, fame+1)
                match &options[1] {
                    CardEffect::AttackWithDefeatBonus {
                        amount,
                        reputation_per_defeat,
                        fame_per_defeat,
                        ..
                    } => {
                        assert_eq!(*amount, 4);
                        assert_eq!(*reputation_per_defeat, 1);
                        assert_eq!(*fame_per_defeat, 1);
                    }
                    _ => panic!("Expected AttackWithDefeatBonus"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    // =========================================================================
    // Batch 6: DiscardForBonus cards
    // =========================================================================

    #[test]
    fn stout_resolve_basic_is_discard_for_bonus_wound_only() {
        let card = get_card("stout_resolve").unwrap();
        assert_eq!(card.color, CardColor::Green);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Green));
        match &card.basic_effect {
            CardEffect::DiscardForBonus {
                choice_options,
                bonus_per_card,
                max_discards,
                discard_filter,
            } => {
                assert_eq!(choice_options.len(), 4);
                assert!(matches!(choice_options[0], CardEffect::GainMove { amount: 2 }));
                assert!(matches!(choice_options[1], CardEffect::GainInfluence { amount: 2 }));
                assert!(matches!(
                    choice_options[2],
                    CardEffect::GainAttack { amount: 2, combat_type: CombatType::Melee, .. }
                ));
                assert!(matches!(
                    choice_options[3],
                    CardEffect::GainBlock { amount: 2, element: Element::Physical }
                ));
                assert_eq!(*bonus_per_card, 1);
                assert_eq!(*max_discards, 1);
                assert_eq!(*discard_filter, DiscardForBonusFilter::WoundOnly);
            }
            _ => panic!("Expected DiscardForBonus"),
        }
    }

    #[test]
    fn stout_resolve_powered_is_discard_for_bonus_any() {
        let card = get_card("stout_resolve").unwrap();
        match &card.powered_effect {
            CardEffect::DiscardForBonus {
                choice_options,
                bonus_per_card,
                max_discards,
                discard_filter,
            } => {
                assert_eq!(choice_options.len(), 4);
                assert!(matches!(choice_options[0], CardEffect::GainMove { amount: 3 }));
                assert!(matches!(choice_options[1], CardEffect::GainInfluence { amount: 3 }));
                assert!(matches!(
                    choice_options[2],
                    CardEffect::GainAttack { amount: 3, combat_type: CombatType::Melee, .. }
                ));
                assert!(matches!(
                    choice_options[3],
                    CardEffect::GainBlock { amount: 3, element: Element::Physical }
                ));
                assert_eq!(*bonus_per_card, 2);
                assert_eq!(*max_discards, u32::MAX);
                assert_eq!(*discard_filter, DiscardForBonusFilter::AnyMaxOneWound);
            }
            _ => panic!("Expected DiscardForBonus"),
        }
    }

    #[test]
    fn shield_bash_basic_is_block() {
        let card = get_card("shield_bash").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Blue));
        match &card.basic_effect {
            CardEffect::GainBlock { amount, element } => {
                assert_eq!(*amount, 3);
                assert_eq!(*element, Element::Physical);
            }
            _ => panic!("Expected GainBlock"),
        }
        // Powered: Block 5 + ShieldBashArmorReduction modifier
        match &card.powered_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(&effects[0], CardEffect::GainBlock { amount: 5, element: Element::Physical }));
                assert!(matches!(&effects[1], CardEffect::ApplyModifier {
                    effect: ModifierEffect::ShieldBashArmorReduction, ..
                }));
            }
            _ => panic!("Expected Compound"),
        }
    }

    // =========================================================================
    // Batch 7: Decompose, Ritual Attack, Pure Magic
    // =========================================================================

    #[test]
    fn decompose_basic_is_decompose_basic_mode() {
        let card = get_card("decompose").unwrap();
        assert_eq!(card.color, CardColor::Red);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Red));
        match &card.basic_effect {
            CardEffect::Decompose { mode } => {
                assert_eq!(*mode, EffectMode::Basic);
            }
            _ => panic!("Expected Decompose"),
        }
    }

    #[test]
    fn decompose_powered_is_decompose_powered_mode() {
        let card = get_card("decompose").unwrap();
        match &card.powered_effect {
            CardEffect::Decompose { mode } => {
                assert_eq!(*mode, EffectMode::Powered);
            }
            _ => panic!("Expected Decompose"),
        }
    }

    #[test]
    fn ritual_attack_basic_has_four_color_attacks() {
        let card = get_card("ritual_attack").unwrap();
        assert_eq!(card.color, CardColor::Red);
        match &card.basic_effect {
            CardEffect::DiscardForAttack { attacks_by_color } => {
                assert_eq!(attacks_by_color.len(), 4);
                // Red → Attack 5 Melee Physical
                let (c, eff) = &attacks_by_color[0];
                assert_eq!(*c, BasicManaColor::Red);
                assert!(matches!(eff, CardEffect::GainAttack { amount: 5, .. }));
                // Blue → Attack 3 Melee Ice
                let (c, eff) = &attacks_by_color[1];
                assert_eq!(*c, BasicManaColor::Blue);
                assert!(matches!(eff, CardEffect::GainAttack { amount: 3, element: Element::Ice, .. }));
            }
            _ => panic!("Expected DiscardForAttack"),
        }
    }

    #[test]
    fn ritual_attack_powered_has_fire_attacks() {
        let card = get_card("ritual_attack").unwrap();
        match &card.powered_effect {
            CardEffect::DiscardForAttack { attacks_by_color } => {
                assert_eq!(attacks_by_color.len(), 4);
                // Red → Fire Attack 6
                let (_, eff) = &attacks_by_color[0];
                assert!(matches!(eff, CardEffect::GainAttack { amount: 6, element: Element::Fire, .. }));
                // Blue → ColdFire Attack 4
                let (_, eff) = &attacks_by_color[1];
                assert!(matches!(eff, CardEffect::GainAttack { amount: 4, element: Element::ColdFire, .. }));
            }
            _ => panic!("Expected DiscardForAttack"),
        }
    }

    #[test]
    fn pure_magic_basic_is_amount_4() {
        let card = get_card("pure_magic").unwrap();
        assert_eq!(card.color, CardColor::Blue);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Blue));
        match &card.basic_effect {
            CardEffect::PureMagic { amount } => {
                assert_eq!(*amount, 4);
            }
            _ => panic!("Expected PureMagic"),
        }
    }

    #[test]
    fn pure_magic_powered_is_amount_7() {
        let card = get_card("pure_magic").unwrap();
        match &card.powered_effect {
            CardEffect::PureMagic { amount } => {
                assert_eq!(*amount, 7);
            }
            _ => panic!("Expected PureMagic"),
        }
    }

    // =========================================================================
    // Lost Legion hero-specific basic action cards
    // =========================================================================

    #[test]
    fn tovak_instinct_card_definition() {
        let card = get_card("tovak_instinct").unwrap();
        assert_eq!(card.id, "tovak_instinct");
        assert_eq!(card.color, CardColor::Red);
        assert_eq!(card.card_type, DeedCardType::BasicAction);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Red));
        assert_eq!(card.sideways_value, 1);
        match &card.basic_effect {
            CardEffect::Choice { options } => assert_eq!(options.len(), 4),
            _ => panic!("Expected Choice with 4 options"),
        }
        match &card.powered_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 4);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
            }
            _ => panic!("Expected Choice with 4 options"),
        }
    }

    #[test]
    fn goldyx_crystal_joy_card_definition() {
        let card = get_card("goldyx_crystal_joy").unwrap();
        assert_eq!(card.id, "goldyx_crystal_joy");
        assert_eq!(card.color, CardColor::Blue);
        assert_eq!(card.card_type, DeedCardType::BasicAction);
        assert_eq!(card.powered_by, PoweredBy::AnyBasic);
        assert_eq!(card.sideways_value, 1);
        assert!(matches!(card.basic_effect, CardEffect::ConvertManaToCrystal));
        match &card.powered_effect {
            CardEffect::Choice { options } => assert_eq!(options.len(), 4),
            _ => panic!("Expected Choice with 4 crystal options"),
        }
    }

    #[test]
    fn norowas_rejuvenate_card_definition() {
        let card = get_card("norowas_rejuvenate").unwrap();
        assert_eq!(card.id, "norowas_rejuvenate");
        assert_eq!(card.color, CardColor::Green);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::Green));
        assert_eq!(card.sideways_value, 1);
        match &card.basic_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 4);
                assert!(matches!(options[0], CardEffect::GainHealing { amount: 1 }));
                assert!(matches!(options[3], CardEffect::ReadyUnit { max_level: 2 }));
            }
            _ => panic!("Expected Choice with 4 options"),
        }
        match &card.powered_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 4);
                assert!(matches!(options[0], CardEffect::GainHealing { amount: 2 }));
                assert!(matches!(options[3], CardEffect::ReadyUnit { max_level: 3 }));
            }
            _ => panic!("Expected Choice with 4 options"),
        }
    }

    #[test]
    fn axe_throw_card_definition() {
        let card = get_card("axe_throw").unwrap();
        assert_eq!(card.id, "axe_throw");
        assert_eq!(card.color, CardColor::White);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::White));
        assert_eq!(card.sideways_value, 1);
        match &card.basic_effect {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 2 }));
            }
            _ => panic!("Expected Choice with 2 options"),
        }
        match &card.powered_effect {
            CardEffect::AttackWithDefeatBonus {
                amount,
                combat_type,
                element,
                fame_per_defeat,
                ..
            } => {
                assert_eq!(*amount, 3);
                assert_eq!(*combat_type, CombatType::Ranged);
                assert_eq!(*element, Element::Physical);
                assert_eq!(*fame_per_defeat, 1);
            }
            _ => panic!("Expected AttackWithDefeatBonus"),
        }
    }

    #[test]
    fn arythea_mana_pull_card_definition() {
        let card = get_card("arythea_mana_pull").unwrap();
        assert_eq!(card.id, "arythea_mana_pull");
        assert_eq!(card.color, CardColor::White);
        assert_eq!(card.powered_by, PoweredBy::Single(BasicManaColor::White));
        assert_eq!(card.sideways_value, 1);
        // Basic: Compound(ExtraSourceDie, BlackAsAnyColor)
        match &card.basic_effect {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
            }
            _ => panic!("Expected Compound with 2 modifiers"),
        }
        // Powered: ManaDrawPowered { dice_count: 2, tokens_per_die: 1 }
        match &card.powered_effect {
            CardEffect::ManaDrawPowered {
                dice_count,
                tokens_per_die,
            } => {
                assert_eq!(*dice_count, 2);
                assert_eq!(*tokens_per_die, 1);
            }
            _ => panic!("Expected ManaDrawPowered"),
        }
    }
}
