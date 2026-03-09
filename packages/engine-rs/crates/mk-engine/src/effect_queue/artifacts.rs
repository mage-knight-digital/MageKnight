//! Artifact card effect handlers and terrain cost reduction.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId, SkillId};
use mk_types::modifier::*;
use mk_types::pending::{
    ActivePending, ChoiceResolution, EffectMode,
};
use mk_types::state::*;

use super::ResolveResult;
use super::WOUND_CARD_ID;

// =============================================================================
// Artifact effect handlers
// =============================================================================

pub(super) fn apply_ready_all_units(state: &mut GameState, player_idx: usize) -> ResolveResult {
    for unit in &mut state.players[player_idx].units {
        if unit.state == UnitState::Spent {
            unit.state = UnitState::Ready;
        }
    }
    ResolveResult::Applied
}

pub(super) fn apply_heal_all_units(state: &mut GameState, player_idx: usize) -> ResolveResult {
    for unit in &mut state.players[player_idx].units {
        unit.wounded = false;
    }
    ResolveResult::Applied
}

pub(super) fn apply_fame_per_enemy_defeated(
    state: &mut GameState,
    player_idx: usize,
    amount: u32,
    exclude_summoned: bool,
) -> ResolveResult {
    // Apply as a combat-duration modifier that tracks fame per enemy defeated.
    let player_id = state.players[player_idx].id.clone();
    let source_card = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("unknown"));
    let mod_id = ModifierId::from(
        format!("fame_per_defeat_{}", state.active_modifiers.len()).as_str(),
    );
    state.active_modifiers.push(ActiveModifier {
        id: mod_id,
        effect: ModifierEffect::FamePerEnemyDefeated {
            fame_per_enemy: amount,
            exclude_summoned,
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        source: ModifierSource::Card {
            card_id: source_card,
            player_id: player_id.clone(),
        },
        created_at_round: state.round,
        created_by_player_id: player_id,
    });
    ResolveResult::Applied
}

pub(super) fn apply_roll_die_for_wound(
    state: &mut GameState,
    _player_idx: usize,
    die_count: u32,
) -> ResolveResult {
    // Roll dice: for each black or red result, take a wound.
    let mut wounds = 0u32;
    for _ in 0..die_count {
        let color = roll_mana_die_color(&mut state.rng);
        if matches!(color, ManaColor::Black | ManaColor::Red) {
            wounds += 1;
        }
    }
    if wounds > 0 {
        // Decompose into wound effects
        let effects: Vec<CardEffect> = (0..wounds).map(|_| CardEffect::TakeWound).collect();
        ResolveResult::Decomposed(effects)
    } else {
        ResolveResult::Applied
    }
}

pub(super) fn apply_choose_bonus_with_risk(
    state: &mut GameState,
    _player_idx: usize,
    bonus_per_roll: u32,
    combat_type: CombatType,
    element: Element,
    accumulated: u32,
    rolled: bool,
) -> ResolveResult {
    if !rolled {
        // First call: present choice to roll or skip (if accumulated > 0)
        let roll_option = CardEffect::ChooseBonusWithRisk {
            bonus_per_roll,
            combat_type,
            element,
            accumulated,
            rolled: true,
        };
        if accumulated > 0 {
            // Can stop: take what we have so far
            let stop_option = CardEffect::GainAttack {
                amount: accumulated,
                combat_type,
                element,
            };
            ResolveResult::NeedsChoice(vec![roll_option, stop_option])
        } else {
            // First roll: must roll at least once
            ResolveResult::Decomposed(vec![CardEffect::ChooseBonusWithRisk {
                bonus_per_roll,
                combat_type,
                element,
                accumulated: 0,
                rolled: true,
            }])
        }
    } else {
        // Execute the roll
        let color = roll_mana_die_color(&mut state.rng);
        if matches!(color, ManaColor::Black | ManaColor::Red) {
            // Wound! Lose all accumulated bonus.
            ResolveResult::Decomposed(vec![CardEffect::TakeWound])
        } else {
            let new_accumulated = accumulated + bonus_per_roll;
            // Offer choice: roll again or take current bonus
            ResolveResult::Decomposed(vec![CardEffect::ChooseBonusWithRisk {
                bonus_per_roll,
                combat_type,
                element,
                accumulated: new_accumulated,
                rolled: false,
            }])
        }
    }
}

pub(super) fn apply_roll_for_crystals(
    state: &mut GameState,
    _player_idx: usize,
    die_count: u32,
) -> ResolveResult {
    let mut effects = Vec::new();
    for _ in 0..die_count {
        let color = roll_mana_die_color(&mut state.rng);
        match color {
            ManaColor::Red => effects.push(CardEffect::GainCrystal {
                color: Some(BasicManaColor::Red),
            }),
            ManaColor::Blue => effects.push(CardEffect::GainCrystal {
                color: Some(BasicManaColor::Blue),
            }),
            ManaColor::Green => effects.push(CardEffect::GainCrystal {
                color: Some(BasicManaColor::Green),
            }),
            ManaColor::White => effects.push(CardEffect::GainCrystal {
                color: Some(BasicManaColor::White),
            }),
            ManaColor::Gold => effects.push(CardEffect::GainCrystal {
                color: Some(BasicManaColor::White), // Gold → White crystal
            }),
            ManaColor::Black => effects.push(CardEffect::GainFame { amount: 1 }),
        }
    }
    if effects.is_empty() {
        ResolveResult::Applied
    } else {
        ResolveResult::Decomposed(effects)
    }
}

/// Roll a random mana die color using RNG.
pub(super) fn roll_mana_die_color(rng: &mut mk_types::rng::RngState) -> ManaColor {
    let roll = rng.next_int(0, 5);
    match roll {
        0 => ManaColor::Red,
        1 => ManaColor::Blue,
        2 => ManaColor::Green,
        3 => ManaColor::White,
        4 => ManaColor::Gold,
        _ => ManaColor::Black,
    }
}

pub(super) fn apply_book_of_wisdom(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    use mk_types::pending::{BookOfWisdomPhase, PendingBookOfWisdom};

    // Find eligible hand cards: non-wound, non-self action cards with a color
    let eligible: Vec<(usize, CardId)> = state.players[player_idx]
        .hand
        .iter()
        .enumerate()
        .filter(|(_, c)| {
            c.as_str() != WOUND_CARD_ID
                && c.as_str() != "book_of_wisdom"
                && mk_data::cards::get_card_color(c.as_str()).is_some()
        })
        .map(|(i, c)| (i, c.clone()))
        .collect();

    if eligible.is_empty() {
        return ResolveResult::Skipped;
    }

    // Set pending for card selection
    let source_card = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("book_of_wisdom"));
    state.players[player_idx].pending.active =
        Some(ActivePending::BookOfWisdom(PendingBookOfWisdom {
            source_card_id: source_card,
            mode,
            phase: BookOfWisdomPhase::SelectCard,
            thrown_card_color: None,
            available_offer_cards: arrayvec::ArrayVec::new(),
        }));
    ResolveResult::PendingSet
}

pub(super) fn apply_tome_of_all_spells(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    use mk_types::pending::{PendingTomeOfAllSpells, TomeOfAllSpellsPhase};

    // Eligible: any colored (non-wound, non-self) card in hand
    let has_eligible = state.players[player_idx]
        .hand
        .iter()
        .any(|c| {
            c.as_str() != WOUND_CARD_ID
                && c.as_str() != "tome_of_all_spells"
                && mk_data::cards::get_card_color(c.as_str()).is_some()
        });

    if !has_eligible {
        return ResolveResult::Skipped;
    }

    let source_card = state.players[player_idx]
        .play_area
        .last()
        .cloned()
        .unwrap_or_else(|| CardId::from("tome_of_all_spells"));

    state.players[player_idx].pending.active =
        Some(ActivePending::TomeOfAllSpells(PendingTomeOfAllSpells {
            source_card_id: source_card,
            mode,
            phase: TomeOfAllSpellsPhase::SelectCard,
            discarded_color: None,
            available_spells: Vec::new(),
        }));
    ResolveResult::PendingSet
}

pub(super) fn apply_circlet_of_proficiency(
    state: &mut GameState,
    player_idx: usize,
    mode: EffectMode,
) -> ResolveResult {
    use mk_data::skills::{get_skill, SkillUsageType};
    use mk_types::pending::PendingCircletOfProficiency;

    // Build available skills: common + player skills, filtered to non-interactive, non-passive
    let mut available_skills: Vec<SkillId> = Vec::new();

    // Common skills
    for skill_id in &state.offers.common_skills {
        if let Some(def) = get_skill(skill_id.as_str()) {
            if matches!(def.usage_type, SkillUsageType::OncePerTurn | SkillUsageType::OncePerRound)
                && def.effect.is_some()
            {
                available_skills.push(skill_id.clone());
            }
        }
    }

    // Player skills
    for skill_id in &state.players[player_idx].skills {
        if let Some(def) = get_skill(skill_id.as_str()) {
            if matches!(def.usage_type, SkillUsageType::OncePerTurn | SkillUsageType::OncePerRound)
                && def.effect.is_some()
                && !available_skills.contains(skill_id)
            {
                available_skills.push(skill_id.clone());
            }
        }
    }

    if available_skills.is_empty() {
        return ResolveResult::Skipped;
    }

    state.players[player_idx].pending.active =
        Some(ActivePending::CircletOfProficiency(PendingCircletOfProficiency {
            mode,
            available_skills,
        }));
    ResolveResult::PendingSet
}

pub(super) fn apply_mysterious_box(
    state: &mut GameState,
    _player_idx: usize,
) -> ResolveResult {
    // Reveal top artifact from artifact deck/offer.
    // If artifact available, use its basic effect.
    if state.offers.artifacts.is_empty() {
        return ResolveResult::Skipped;
    }

    // Reveal the top artifact (first in offer)
    let artifact_id = state.offers.artifacts[0].clone();

    // Look up the artifact's basic effect
    if let Some(card_def) = mk_data::cards::get_card(artifact_id.as_str()) {
        ResolveResult::Decomposed(vec![card_def.basic_effect])
    } else {
        ResolveResult::Skipped
    }
}

pub(super) fn apply_druidic_staff_basic(
    state: &mut GameState,
    player_idx: usize,
) -> ResolveResult {
    // Discard a non-wound card from hand → effect based on card color.
    // White → Move 2 + all terrain replace_cost=1, Blue → 2 crystals (any color),
    // Red → ReadyUnit, Green → Heal 3.
    let eligible: Vec<(usize, CardId)> = state.players[player_idx]
        .hand
        .iter()
        .enumerate()
        .filter(|(_, c)| {
            c.as_str() != WOUND_CARD_ID && c.as_str() != "druidic_staff"
        })
        .map(|(i, c)| (i, c.clone()))
        .collect();

    if eligible.is_empty() {
        return ResolveResult::Skipped;
    }

    // Build color-based options for each eligible card
    let options: Vec<CardEffect> = eligible.iter().map(|(_, card_id)| {
        let color = mk_data::cards::get_card_color(card_id.as_str());
        match color {
            Some(BasicManaColor::White) => CardEffect::Compound {
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
            Some(BasicManaColor::Blue) => CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal { color: None },
                    CardEffect::GainCrystal { color: None },
                ],
            },
            Some(BasicManaColor::Red) => CardEffect::ReadyUnit { max_level: 255 },
            Some(BasicManaColor::Green) => CardEffect::GainHealing { amount: 3 },
            None => CardEffect::Noop, // Colorless/wound → no effect
        }
    }).collect();
    let eligible_indices: Vec<usize> = eligible.iter().map(|(i, _)| *i).collect();

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::DiscardThenContinue {
            eligible_indices,
        },
    )
}

pub(super) fn apply_druidic_staff_powered(
    _state: &mut GameState,
    _player_idx: usize,
) -> ResolveResult {
    // Choice of 6 dual-color combinations:
    // White+Blue: Move 4 + crystals, White+Red: Move 4 + ReadyUnit,
    // White+Green: Move 4 + Heal 3, Blue+Red: 2 crystals + ReadyUnit,
    // Blue+Green: 2 crystals + Heal 3, Red+Green: ReadyUnit + Heal 3
    ResolveResult::NeedsChoice(vec![
        // White+Blue
        CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: -1,
                        minimum: 1,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::GainCrystal { color: None },
                CardEffect::GainCrystal { color: None },
            ],
        },
        // White+Red
        CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: -1,
                        minimum: 1,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::ReadyUnit { max_level: 255 },
            ],
        },
        // White+Green
        CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 4 },
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::All,
                        amount: -1,
                        minimum: 1,
                        replace_cost: None,
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
                CardEffect::GainHealing { amount: 3 },
            ],
        },
        // Blue+Red
        CardEffect::Compound {
            effects: vec![
                CardEffect::GainCrystal { color: None },
                CardEffect::GainCrystal { color: None },
                CardEffect::ReadyUnit { max_level: 255 },
            ],
        },
        // Blue+Green
        CardEffect::Compound {
            effects: vec![
                CardEffect::GainCrystal { color: None },
                CardEffect::GainCrystal { color: None },
                CardEffect::GainHealing { amount: 3 },
            ],
        },
        // Red+Green
        CardEffect::Compound {
            effects: vec![
                CardEffect::ReadyUnit { max_level: 255 },
                CardEffect::GainHealing { amount: 3 },
            ],
        },
    ])
}

// =============================================================================
// Terrain cost reduction handlers (Druidic Paths)
// =============================================================================

pub(super) fn apply_select_hex_for_cost_reduction(
    state: &mut GameState,
    player_idx: usize,
) -> ResolveResult {
    use mk_types::pending::{PendingTerrainCostReduction, TerrainCostReductionMode};

    // Collect reachable hexes from current position — any hex the player
    // could potentially move to with current move_points
    let player_pos = match state.players[player_idx].position {
        Some(pos) => pos,
        None => return ResolveResult::Skipped,
    };

    // Gather all map hexes that are adjacent or nearby
    let available_coordinates: Vec<_> = state
        .map
        .hexes
        .values()
        .filter(|h| {
            h.coord != player_pos
                && h.terrain != Terrain::Ocean
                && h.terrain != Terrain::Lake
        })
        .map(|h| h.coord)
        .collect();

    if available_coordinates.is_empty() {
        return ResolveResult::Skipped;
    }

    state.players[player_idx].pending.active =
        Some(ActivePending::TerrainCostReduction(PendingTerrainCostReduction {
            mode: TerrainCostReductionMode::Hex,
            reduction: -2,
            minimum_cost: 2,
            available_coordinates,
            available_terrains: Vec::new(),
        }));

    ResolveResult::PendingSet
}

pub(super) fn apply_select_terrain_for_cost_reduction(
    state: &mut GameState,
    player_idx: usize,
) -> ResolveResult {
    use mk_types::pending::{PendingTerrainCostReduction, TerrainCostReductionMode};

    let available_terrains = vec![
        Terrain::Hills,
        Terrain::Forest,
        Terrain::Desert,
        Terrain::Swamp,
        Terrain::Wasteland,
    ];

    state.players[player_idx].pending.active =
        Some(ActivePending::TerrainCostReduction(PendingTerrainCostReduction {
            mode: TerrainCostReductionMode::Terrain,
            reduction: -2,
            minimum_cost: 2,
            available_coordinates: Vec::new(),
            available_terrains,
        }));

    ResolveResult::PendingSet
}
