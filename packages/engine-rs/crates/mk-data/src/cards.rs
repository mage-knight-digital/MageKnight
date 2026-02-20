//! Card definitions — basic action cards with their effects.
//!
//! Each card has a basic effect (free play) and powered effect (costs 1 mana).
//! All basic action cards have sideways_value = 1.

use mk_types::effect::CardEffect;
use mk_types::enums::{BasicManaColor, CardColor, CombatType, DeedCardType, Element, ManaColor};
use mk_types::modifier::RuleOverride;

/// Static card definition.
pub struct CardDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub color: CardColor,
    pub card_type: DeedCardType,
    pub powered_by: Option<BasicManaColor>,
    pub basic_effect: CardEffect,
    pub powered_effect: CardEffect,
    pub sideways_value: u32,
}

/// Look up any card by ID (basic action or hero-specific).
pub fn get_card(id: &str) -> Option<CardDefinition> {
    get_basic_action_card(id).or_else(|| get_hero_card(id))
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::Blue),
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
        powered_by: Some(BasicManaColor::White),
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
        powered_by: Some(BasicManaColor::Red),
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
        powered_by: Some(BasicManaColor::Blue),
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::White),
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
        powered_by: Some(BasicManaColor::Red),
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
        powered_by: Some(BasicManaColor::Blue),
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
        powered_by: Some(BasicManaColor::White),
        basic_effect: CardEffect::ApplyModifier {
            rule: RuleOverride::ExtraSourceDie,
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::Red),
        basic_effect: CardEffect::DiscardCost {
            count: 1,
            filter_wounds: true,
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
        powered_by: None,
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
        powered_by: Some(BasicManaColor::Red),
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
        powered_by: Some(BasicManaColor::Blue),
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::White),
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
        powered_by: Some(BasicManaColor::White),
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
        powered_by: Some(BasicManaColor::Blue),
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::Red),
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
        powered_by: Some(BasicManaColor::Red),
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
        powered_by: Some(BasicManaColor::Green),
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
        powered_by: Some(BasicManaColor::Blue),
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
}
