//! Complex skill handlers: puppet master, shapeshift, secret ways, regenerate,
//! dueling, invocation, polarization, curse, forked lightning, know your prey.

use mk_types::enums::*;
use mk_types::ids::{CardId, SkillId};
use mk_types::state::*;
use mk_types::pending::ActivePending;

use crate::combat_resolution;

use super::{ApplyError, ApplyResult};
use super::skills;


// =============================================================================
// Puppet Master + Shapeshift skill handlers
// =============================================================================

pub(super) fn apply_puppet_master(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    let player = &state.players[player_idx];
    if player.kept_enemy_tokens.is_empty() {
        return Err(ApplyError::InternalError(
            "Puppet Master: no kept enemy tokens".into(),
        ));
    }

    if player.kept_enemy_tokens.len() == 1 {
        // Auto-select the only token, go straight to use mode
        setup_puppet_master_use_mode(state, player_idx, skill_id, 0);
    } else {
        // Multiple tokens: present selection
        let token_indices: Vec<usize> = (0..player.kept_enemy_tokens.len()).collect();
        let options: Vec<mk_types::effect::CardEffect> = token_indices
            .iter()
            .map(|_| mk_types::effect::CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(mk_types::pending::PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: mk_types::pending::ChoiceResolution::PuppetMasterSelectToken {
                    token_indices,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn setup_puppet_master_use_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    token_index: usize,
) {
    let player = &state.players[player_idx];
    let token = &player.kept_enemy_tokens[token_index];

    let attack_value = token.attack.div_ceil(2);
    let attack_element = token.attack_element;
    let block_value = token.armor.div_ceil(2);

    // Derive block element from enemy resistances
    let block_element = derive_block_element_from_enemy(token.enemy_id.as_str());

    let options = vec![
        mk_types::effect::CardEffect::Noop, // Attack
        mk_types::effect::CardEffect::Noop, // Block
    ];

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: mk_types::pending::ChoiceResolution::PuppetMasterUseMode {
                token_index,
                attack_value,
                attack_element,
                block_value,
                block_element,
            },
        }));
}


/// Derive block element from enemy resistances.
pub(super) fn derive_block_element_from_enemy(enemy_id: &str) -> Element {
    let def = mk_data::enemies::get_enemy(enemy_id);
    let resistances = def.map(|d| d.resistances).unwrap_or(&[]);

    let has_fire = resistances.contains(&ResistanceElement::Fire);
    let has_ice = resistances.contains(&ResistanceElement::Ice);

    match (has_fire, has_ice) {
        (true, true) => Element::ColdFire,
        (true, false) => Element::Ice,
        (false, true) => Element::Fire,
        (false, false) => Element::Physical,
    }
}


pub(crate) fn execute_puppet_master_select_token(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    token_index: usize,
) {
    setup_puppet_master_use_mode(state, player_idx, skill_id, token_index);
}


#[allow(clippy::too_many_arguments)]
pub(crate) fn execute_puppet_master_use_mode(
    state: &mut GameState,
    player_idx: usize,
    token_index: usize,
    choice_index: usize,
    attack_value: u32,
    attack_element: Element,
    block_value: u32,
    block_element: Element,
) {
    // Remove the token from kept_enemy_tokens
    let player = &mut state.players[player_idx];
    if token_index < player.kept_enemy_tokens.len() {
        player.kept_enemy_tokens.remove(token_index);
    }

    if choice_index == 0 {
        // Attack: add melee attack to combat accumulator
        let acc = &mut state.players[player_idx].combat_accumulator.attack;
        acc.normal += attack_value;
        match attack_element {
            Element::Physical => acc.normal_elements.physical += attack_value,
            Element::Fire => acc.normal_elements.fire += attack_value,
            Element::Ice => acc.normal_elements.ice += attack_value,
            Element::ColdFire => acc.normal_elements.cold_fire += attack_value,
        }
    } else {
        // Block: add block value to combat accumulator
        let acc = &mut state.players[player_idx].combat_accumulator;
        acc.block += block_value;
        match block_element {
            Element::Physical => acc.block_elements.physical += block_value,
            Element::Fire => acc.block_elements.fire += block_value,
            Element::Ice => acc.block_elements.ice += block_value,
            Element::ColdFire => acc.block_elements.cold_fire += block_value,
        }
    }
}


pub(super) fn apply_shapeshift(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ShapeshiftCardOption, ChoiceResolution, PendingChoice};

    let player = &state.players[player_idx];
    let mut options: Vec<ShapeshiftCardOption> = Vec::new();

    for (hand_index, card_id) in player.hand.iter().enumerate() {
        if let Some(opt) = classify_basic_action_for_shapeshift(card_id.as_str()) {
            options.push(ShapeshiftCardOption {
                hand_index,
                card_id: card_id.clone(),
                original_type: opt.0,
                amount: opt.1,
                element: opt.2,
            });
        }
    }

    if options.is_empty() {
        return Err(ApplyError::InternalError(
            "Shapeshift: no eligible basic action cards in hand".into(),
        ));
    }

    if options.len() == 1 {
        // Single card: go straight to type selection
        let opt = options[0].clone();
        setup_shapeshift_type_select(state, player_idx, skill_id, &opt);
    } else {
        let choice_options: Vec<mk_types::effect::CardEffect> = options
            .iter()
            .map(|_| mk_types::effect::CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::ShapeshiftCardSelect { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Classify a card as a basic action eligible for Shapeshift.
/// Returns (original_type, amount, element) or None if not eligible.
///
/// Eligible: cards whose basic effect is GainMove, GainAttack, GainBlock,
/// or a Choice where the first option is GainAttack/GainBlock (rage, determination).
pub(super) fn classify_basic_action_for_shapeshift(card_id: &str) -> Option<(mk_types::modifier::ShapeshiftTarget, u32, Option<Element>)> {
    let def = mk_data::cards::get_basic_action_card(card_id)?;
    if def.card_type != DeedCardType::BasicAction {
        return None;
    }

    classify_effect_for_shapeshift(&def.basic_effect)
}


pub(super) fn classify_effect_for_shapeshift(effect: &mk_types::effect::CardEffect) -> Option<(mk_types::modifier::ShapeshiftTarget, u32, Option<Element>)> {
    use mk_types::modifier::ShapeshiftTarget;

    match effect {
        mk_types::effect::CardEffect::GainMove { amount } => {
            Some((ShapeshiftTarget::Move, *amount, None))
        }
        mk_types::effect::CardEffect::GainAttack { amount, element, .. } => {
            Some((ShapeshiftTarget::Attack, *amount, Some(*element)))
        }
        mk_types::effect::CardEffect::GainBlock { amount, element } => {
            Some((ShapeshiftTarget::Block, *amount, Some(*element)))
        }
        mk_types::effect::CardEffect::Choice { options } => {
            // For Choice cards like Rage (Attack 2 or Block 2), classify by first option
            options.first().and_then(classify_effect_for_shapeshift)
        }
        _ => None,
    }
}


pub(super) fn setup_shapeshift_type_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    card_opt: &mk_types::pending::ShapeshiftCardOption,
) {
    use mk_types::modifier::ShapeshiftTarget;

    // Build 2 options: the two types other than the original
    let all_types = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
    let target_types: Vec<ShapeshiftTarget> = all_types
        .iter()
        .filter(|t| **t != card_opt.original_type)
        .copied()
        .collect();

    let options: Vec<mk_types::effect::CardEffect> = target_types
        .iter()
        .map(|_| mk_types::effect::CardEffect::Noop)
        .collect();

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(mk_types::pending::PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: mk_types::pending::ChoiceResolution::ShapeshiftTypeSelect {
                card_id: card_opt.card_id.clone(),
                hand_index: card_opt.hand_index,
                original_type: card_opt.original_type,
                amount: card_opt.amount,
                element: card_opt.element,
            },
        }));
}


pub(crate) fn execute_shapeshift_card_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    options: &[mk_types::pending::ShapeshiftCardOption],
    choice_index: usize,
) {
    if choice_index < options.len() {
        let opt = options[choice_index].clone();
        setup_shapeshift_type_select(state, player_idx, skill_id, &opt);
    }
}


#[allow(clippy::too_many_arguments)]
pub(crate) fn execute_shapeshift_type_select(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    card_id: &CardId,
    _hand_index: usize,
    original_type: mk_types::modifier::ShapeshiftTarget,
    _amount: u32,
    element: Option<Element>,
    choice_index: usize,
) {
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, ShapeshiftTarget};

    let all_types = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
    let target_types: Vec<ShapeshiftTarget> = all_types
        .iter()
        .filter(|t| **t != original_type)
        .copied()
        .collect();

    if choice_index >= target_types.len() {
        return;
    }

    let target_type = target_types[choice_index];

    // Determine combat_type and element for the new type
    let (combat_type, new_element) = match target_type {
        ShapeshiftTarget::Move => (None, None),
        ShapeshiftTarget::Attack => (
            Some(CombatType::Melee),
            Some(element.unwrap_or(Element::Physical)),
        ),
        ShapeshiftTarget::Block => (
            None,
            Some(element.unwrap_or(Element::Physical)),
        ),
    };

    skills::push_skill_modifier(
        state,
        player_idx,
        skill_id,
        ModifierDuration::Turn,
        ModifierScope::SelfScope,
        ModifierEffect::ShapeshiftActive {
            target_card_id: card_id.clone(),
            target_type,
            choice_index: None,
            combat_type,
            element: new_element,
        },
    );
}


/// Check if the player has any basic action card in hand eligible for Shapeshift.
pub(crate) fn has_shapeshift_eligible_cards(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    player.hand.iter().any(|card_id| {
        classify_basic_action_for_shapeshift(card_id.as_str()).is_some()
    })
}


// =============================================================================
// Secret Ways, Regenerate, Dueling skill handlers
// =============================================================================

pub(super) fn apply_secret_ways(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::modifier::{ModifierDuration, ModifierEffect, ModifierScope, TerrainOrAll};
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Always grant Move 1
    state.players[player_idx].move_points += 1;

    // Check if player can afford Blue mana (token > crystal > die)
    let player = &state.players[player_idx];
    let has_blue_token = player.pure_mana.iter().any(|t| t.color == ManaColor::Blue);
    let has_blue_crystal = player.crystals.blue > 0;
    let has_blue_die = state
        .source
        .dice
        .iter()
        .any(|d| {
            d.color == ManaColor::Blue
                && !d.is_depleted
                && d.taken_by_player_id.is_none()
        });

    if has_blue_token || has_blue_crystal || has_blue_die {
        // Present choice: Noop (decline) or Lake modifiers (pay blue mana)
        let options = vec![
            CardEffect::Noop,
            CardEffect::Compound {
                effects: vec![
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::TerrainCost {
                            terrain: TerrainOrAll::Specific(mk_types::enums::Terrain::Lake),
                            amount: 0,
                            minimum: 0,
                            replace_cost: Some(2),
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                    CardEffect::ApplyModifier {
                        effect: ModifierEffect::TerrainSafe {
                            terrain: TerrainOrAll::Specific(mk_types::enums::Terrain::Lake),
                        },
                        duration: ModifierDuration::Turn,
                        scope: ModifierScope::SelfScope,
                    },
                ],
            },
        ];

        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::SecretWaysLake,
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_regenerate(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    bonus_color: BasicManaColor,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Collect available mana colors the player can spend
    let player = &state.players[player_idx];
    let mut available_colors: Vec<ManaColor> = Vec::new();
    let mut seen = [false; 6]; // R, B, G, W, Gold, Black

    // Check tokens
    for token in &player.pure_mana {
        let idx = mana_color_to_index(token.color);
        if let Some(i) = idx {
            if !seen[i] {
                seen[i] = true;
                available_colors.push(token.color);
            }
        }
    }

    // Check crystals (basic colors only)
    for (color, count) in [
        (BasicManaColor::Red, player.crystals.red),
        (BasicManaColor::Blue, player.crystals.blue),
        (BasicManaColor::Green, player.crystals.green),
        (BasicManaColor::White, player.crystals.white),
    ] {
        if count > 0 {
            let mc = ManaColor::from(color);
            let idx = mana_color_to_index(mc);
            if let Some(i) = idx {
                if !seen[i] {
                    seen[i] = true;
                    available_colors.push(mc);
                }
            }
        }
    }

    // Check source dice (respecting time-of-day restrictions)
    for die in &state.source.dice {
        if !die.is_depleted && die.taken_by_player_id.is_none() {
            let idx = mana_color_to_index(die.color);
            if let Some(i) = idx {
                if !seen[i] {
                    seen[i] = true;
                    available_colors.push(die.color);
                }
            }
        }
    }

    if available_colors.is_empty() {
        return Err(ApplyError::InternalError(
            "Regenerate: no mana available".into(),
        ));
    }

    if available_colors.len() == 1 {
        // Auto-consume the single option
        execute_regenerate(state, player_idx, available_colors[0], bonus_color)?;
    } else {
        // Multiple options: set pending choice
        let options: Vec<CardEffect> = available_colors
            .iter()
            .map(|_| CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::RegenerateMana {
                    available_colors,
                    bonus_color,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn mana_color_to_index(color: ManaColor) -> Option<usize> {
    match color {
        ManaColor::Red => Some(0),
        ManaColor::Blue => Some(1),
        ManaColor::Green => Some(2),
        ManaColor::White => Some(3),
        ManaColor::Gold => Some(4),
        ManaColor::Black => Some(5),
    }
}


/// Execute the regenerate effect: consume mana, remove wound, conditionally draw.
pub(crate) fn execute_regenerate(
    state: &mut GameState,
    player_idx: usize,
    mana_color: ManaColor,
    bonus_color: BasicManaColor,
) -> Result<(), ApplyError> {
    // Consume 1 mana of the chosen color (token > crystal > die)
    let player = &mut state.players[player_idx];

    // Try token first
    if let Some(pos) = player.pure_mana.iter().position(|t| t.color == mana_color) {
        player.pure_mana.remove(pos);
    } else if let Some(basic) = mana_color.to_basic() {
        // Try crystal
        let crystal_count = match basic {
            BasicManaColor::Red => &mut player.crystals.red,
            BasicManaColor::Blue => &mut player.crystals.blue,
            BasicManaColor::Green => &mut player.crystals.green,
            BasicManaColor::White => &mut player.crystals.white,
        };
        if *crystal_count > 0 {
            *crystal_count -= 1;
            match basic {
                BasicManaColor::Red => player.spent_crystals_this_turn.red += 1,
                BasicManaColor::Blue => player.spent_crystals_this_turn.blue += 1,
                BasicManaColor::Green => player.spent_crystals_this_turn.green += 1,
                BasicManaColor::White => player.spent_crystals_this_turn.white += 1,
            }
        } else {
            return Err(ApplyError::InternalError(
                "Regenerate: cannot consume mana".into(),
            ));
        }
    } else {
        // Gold/Black — try source die
        if let Some(die) = state.source.dice.iter_mut().find(|d| {
            d.color == mana_color && !d.is_depleted && d.taken_by_player_id.is_none()
        }) {
            die.taken_by_player_id = Some(state.players[player_idx].id.clone());
            die.is_depleted = true;
        } else {
            return Err(ApplyError::InternalError(
                "Regenerate: cannot consume mana".into(),
            ));
        }
    }

    // Remove first wound from hand
    let player = &mut state.players[player_idx];
    if let Some(pos) = player.hand.iter().position(|c| c.as_str() == "wound") {
        player.hand.remove(pos);
        state.wound_pile_count = Some(state.wound_pile_count.unwrap_or(0) + 1);
    }

    // Check bonus draw: mana color matches bonus_color OR strictly lowest fame
    let is_bonus_color = mana_color.to_basic() == Some(bonus_color);
    let is_lowest = has_strictly_lowest_fame(state, player_idx);

    if is_bonus_color || is_lowest {
        let player = &mut state.players[player_idx];
        if !player.deck.is_empty() {
            let card = player.deck.remove(0);
            player.hand.push(card);
        }
    }

    Ok(())
}


/// Check if a player has strictly the lowest fame among all players.
/// In solo (1 player): always false.
pub(super) fn has_strictly_lowest_fame(state: &GameState, player_idx: usize) -> bool {
    if state.players.len() <= 1 {
        return false;
    }
    let my_fame = state.players[player_idx].fame;
    state.players.iter().enumerate().all(|(i, p)| {
        i == player_idx || p.fame > my_fame
    })
}


pub(super) fn apply_dueling(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Dueling: not in combat".into()))?;

    // Filter eligible enemies: alive AND attacks this combat (not skip_attack)
    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !combat_resolution::is_enemy_attacks_skipped(
                    &state.active_modifiers,
                    e.instance_id.as_str(),
                )
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Dueling: no eligible enemies".into(),
        ));
    }

    // Grant Block 1 Physical
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.block += 1;
    accumulator.block_elements.physical += 1;

    if eligible.len() == 1 {
        // Auto-target the single enemy
        apply_dueling_target(state, player_idx, skill_id, &eligible[0]);
    } else {
        // Multiple targets: set pending choice
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::DuelingTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Apply the DuelingTarget modifier for a chosen enemy (public wrapper for effect_queue).
pub(crate) fn apply_dueling_target_pub(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    apply_dueling_target(state, player_idx, skill_id, enemy_instance_id);
}


/// Apply the DuelingTarget modifier for a chosen enemy.
pub(super) fn apply_dueling_target(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    skills::push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::SelfScope,
        mk_types::modifier::ModifierEffect::DuelingTarget {
            enemy_instance_id: enemy_instance_id.to_string(),
            attack_applied: false,
            unit_involved: false,
        },
    );
}


/// Apply the dueling attack bonus at Block→Attack transition.
/// Called from apply_end_combat_phase when transitioning to Attack phase.
pub(crate) fn apply_dueling_attack_bonus(
    state: &mut GameState,
    player_idx: usize,
) {
    // Find active DuelingTarget modifier for this player
    let player_id = &state.players[player_idx].id;
    let modifier_idx = state.active_modifiers.iter().position(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, mk_types::modifier::ModifierEffect::DuelingTarget { .. })
    });

    let Some(idx) = modifier_idx else { return };

    // Check if already applied
    if let mk_types::modifier::ModifierEffect::DuelingTarget {
        attack_applied: true,
        ..
    } = &state.active_modifiers[idx].effect
    {
        return;
    }

    // Check if target enemy is still alive
    let target_id = if let mk_types::modifier::ModifierEffect::DuelingTarget {
        enemy_instance_id,
        ..
    } = &state.active_modifiers[idx].effect
    {
        enemy_instance_id.clone()
    } else {
        return;
    };

    let target_alive = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .any(|e| e.instance_id.as_str() == target_id && !e.is_defeated)
        })
        .unwrap_or(false);

    if !target_alive {
        return;
    }

    // Mark attack_applied = true
    if let mk_types::modifier::ModifierEffect::DuelingTarget {
        ref mut attack_applied,
        ..
    } = state.active_modifiers[idx].effect
    {
        *attack_applied = true;
    }

    // Grant Attack 1 Physical
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.attack.normal += 1;
    accumulator.attack.normal_elements.physical += 1;
}


/// Resolve dueling fame bonus at combat end.
/// Returns the fame gained (0 or 1).
pub(crate) fn resolve_dueling_fame_bonus(
    state: &mut GameState,
    player_idx: usize,
) -> u32 {
    let player_id = &state.players[player_idx].id;

    // Find DuelingTarget modifier
    let modifier = state.active_modifiers.iter().find(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, mk_types::modifier::ModifierEffect::DuelingTarget { .. })
    });

    let Some(m) = modifier else { return 0 };

    let (target_id, unit_involved) =
        if let mk_types::modifier::ModifierEffect::DuelingTarget {
            enemy_instance_id,
            unit_involved,
            ..
        } = &m.effect
        {
            (enemy_instance_id.clone(), *unit_involved)
        } else {
            return 0;
        };

    // Target must be defeated
    let target_defeated = state
        .combat
        .as_ref()
        .map(|c| {
            c.enemies
                .iter()
                .any(|e| e.instance_id.as_str() == target_id && e.is_defeated)
        })
        .unwrap_or(false);

    if !target_defeated || unit_involved {
        return 0;
    }

    state.players[player_idx].fame += 1;
    1
}


/// Mark unit involvement on the DuelingTarget modifier.
/// Called when any unit combat ability is activated.
pub(crate) fn mark_dueling_unit_involvement(
    state: &mut GameState,
    player_idx: usize,
) {
    let player_id = &state.players[player_idx].id;
    for m in &mut state.active_modifiers {
        if m.created_by_player_id == *player_id {
            if let mk_types::modifier::ModifierEffect::DuelingTarget {
                ref mut unit_involved,
                ..
            } = m.effect
            {
                *unit_involved = true;
            }
        }
    }
}


// =============================================================================
// Invocation skill handler
// =============================================================================

pub(super) fn apply_invocation(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, InvocationOption, PendingChoice};

    let player = &state.players[player_idx];
    if player.hand.is_empty() {
        return Err(ApplyError::InternalError(
            "Invocation: hand is empty".into(),
        ));
    }

    // Build deduplicated options: per unique card_id, 2 color choices
    let mut seen_card_ids = Vec::new();
    let mut options = Vec::new();

    for card_id in &player.hand {
        if seen_card_ids.contains(card_id) {
            continue;
        }
        seen_card_ids.push(card_id.clone());
        let is_wound = card_id.as_str() == "wound";
        if is_wound {
            // Wounds → Red or Black
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: true,
                mana_color: ManaColor::Red,
            });
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: true,
                mana_color: ManaColor::Black,
            });
        } else {
            // Non-wounds → White or Green
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: false,
                mana_color: ManaColor::White,
            });
            options.push(InvocationOption {
                card_id: card_id.clone(),
                is_wound: false,
                mana_color: ManaColor::Green,
            });
        }
    }

    if options.len() == 1 {
        // Auto-resolve single option
        execute_invocation(state, player_idx, &options[0]);
    } else {
        let choice_options: Vec<CardEffect> = options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::InvocationDiscard { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Execute invocation: discard card, gain mana token.
pub(crate) fn execute_invocation(
    state: &mut GameState,
    player_idx: usize,
    opt: &mk_types::pending::InvocationOption,
) {
    let player = &mut state.players[player_idx];

    // Remove first matching card from hand
    if let Some(pos) = player.hand.iter().position(|c| *c == opt.card_id) {
        player.hand.remove(pos);
        if opt.is_wound {
            state.wound_pile_count = Some(state.wound_pile_count.unwrap_or(0) + 1);
        } else {
            state.players[player_idx].discard.push(opt.card_id.clone());
        }
    }

    // Gain mana token
    state.players[player_idx].pure_mana.push(ManaToken {
        color: opt.mana_color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: false,
    });
}


// =============================================================================
// Polarization skill handler
// =============================================================================

pub(super) fn apply_polarization(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice, PolarizationOption, PolarizationSourceType};

    let is_day = state.time_of_day == TimeOfDay::Day;

    fn opposite_basic(c: ManaColor) -> Option<ManaColor> {
        match c {
            ManaColor::Red => Some(ManaColor::Blue),
            ManaColor::Blue => Some(ManaColor::Red),
            ManaColor::Green => Some(ManaColor::White),
            ManaColor::White => Some(ManaColor::Green),
            _ => None,
        }
    }

    let mut options: Vec<PolarizationOption> = Vec::new();
    let mut seen = std::collections::HashSet::new();

    // 1. Tokens
    let player = &state.players[player_idx];
    for (idx, token) in player.pure_mana.iter().enumerate() {
        // Basic color → opposite
        if let Some(target) = opposite_basic(token.color) {
            let key = (PolarizationSourceType::Token, token.color, target);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Token,
                    source_color: token.color,
                    target_color: target,
                    cannot_power_spells: false,
                    token_index: Some(idx),
                    die_id: None,
                });
            }
        }
        // Black (day) → any basic (cannot_power_spells)
        if token.color == ManaColor::Black && is_day {
            for target in &[ManaColor::Red, ManaColor::Blue, ManaColor::Green, ManaColor::White] {
                let key = (PolarizationSourceType::Token, ManaColor::Black, *target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Token,
                        source_color: ManaColor::Black,
                        target_color: *target,
                        cannot_power_spells: true,
                        token_index: Some(idx),
                        die_id: None,
                    });
                }
            }
        }
        // Gold (night) → Black
        if token.color == ManaColor::Gold && !is_day {
            let key = (PolarizationSourceType::Token, ManaColor::Gold, ManaColor::Black);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Token,
                    source_color: ManaColor::Gold,
                    target_color: ManaColor::Black,
                    cannot_power_spells: false,
                    token_index: Some(idx),
                    die_id: None,
                });
            }
        }
    }

    // 2. Crystals
    for (basic, count) in [
        (BasicManaColor::Red, player.crystals.red),
        (BasicManaColor::Blue, player.crystals.blue),
        (BasicManaColor::Green, player.crystals.green),
        (BasicManaColor::White, player.crystals.white),
    ] {
        if count > 0 {
            let src = ManaColor::from(basic);
            if let Some(target) = opposite_basic(src) {
                let key = (PolarizationSourceType::Crystal, src, target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Crystal,
                        source_color: src,
                        target_color: target,
                        cannot_power_spells: false,
                        token_index: None,
                        die_id: None,
                    });
                }
            }
        }
    }

    // 3. Source dice
    for die in &state.source.dice {
        if die.is_depleted || die.taken_by_player_id.is_some() {
            continue;
        }
        // Basic → opposite
        if let Some(target) = opposite_basic(die.color) {
            let key = (PolarizationSourceType::Die, die.color, target);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Die,
                    source_color: die.color,
                    target_color: target,
                    cannot_power_spells: false,
                    token_index: None,
                    die_id: Some(die.id.clone()),
                });
            }
        }
        // Black (day) → any basic
        if die.color == ManaColor::Black && is_day {
            for target in &[ManaColor::Red, ManaColor::Blue, ManaColor::Green, ManaColor::White] {
                let key = (PolarizationSourceType::Die, ManaColor::Black, *target);
                if seen.insert(key) {
                    options.push(PolarizationOption {
                        source_type: PolarizationSourceType::Die,
                        source_color: ManaColor::Black,
                        target_color: *target,
                        cannot_power_spells: true,
                        token_index: None,
                        die_id: Some(die.id.clone()),
                    });
                }
            }
        }
        // Gold (night) → Black
        if die.color == ManaColor::Gold && !is_day {
            let key = (PolarizationSourceType::Die, ManaColor::Gold, ManaColor::Black);
            if seen.insert(key) {
                options.push(PolarizationOption {
                    source_type: PolarizationSourceType::Die,
                    source_color: ManaColor::Gold,
                    target_color: ManaColor::Black,
                    cannot_power_spells: false,
                    token_index: None,
                    die_id: Some(die.id.clone()),
                });
            }
        }
    }

    if options.is_empty() {
        return Err(ApplyError::InternalError(
            "Polarization: no conversion options available".into(),
        ));
    }

    if options.len() == 1 {
        execute_polarization(state, player_idx, &options[0]);
    } else {
        let choice_options: Vec<CardEffect> = options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options: choice_options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::PolarizationConvert { options },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Execute polarization: consume source mana, gain target mana.
pub(crate) fn execute_polarization(
    state: &mut GameState,
    player_idx: usize,
    opt: &mk_types::pending::PolarizationOption,
) {
    use mk_types::pending::PolarizationSourceType;

    match opt.source_type {
        PolarizationSourceType::Token => {
            // Remove the token at the given index (or first matching color)
            let player = &mut state.players[player_idx];
            if let Some(idx) = opt.token_index {
                if idx < player.pure_mana.len() && player.pure_mana[idx].color == opt.source_color {
                    player.pure_mana.remove(idx);
                } else if let Some(pos) = player.pure_mana.iter().position(|t| t.color == opt.source_color) {
                    player.pure_mana.remove(pos);
                }
            }
        }
        PolarizationSourceType::Crystal => {
            let player = &mut state.players[player_idx];
            if let Some(basic) = opt.source_color.to_basic() {
                let crystal = match basic {
                    BasicManaColor::Red => &mut player.crystals.red,
                    BasicManaColor::Blue => &mut player.crystals.blue,
                    BasicManaColor::Green => &mut player.crystals.green,
                    BasicManaColor::White => &mut player.crystals.white,
                };
                if *crystal > 0 {
                    *crystal -= 1;
                    match basic {
                        BasicManaColor::Red => player.spent_crystals_this_turn.red += 1,
                        BasicManaColor::Blue => player.spent_crystals_this_turn.blue += 1,
                        BasicManaColor::Green => player.spent_crystals_this_turn.green += 1,
                        BasicManaColor::White => player.spent_crystals_this_turn.white += 1,
                    }
                }
            }
            // Gain target crystal (polarization crystal→crystal keeps it as crystal)
            if let Some(target_basic) = opt.target_color.to_basic() {
                let target_crystal = match target_basic {
                    BasicManaColor::Red => &mut state.players[player_idx].crystals.red,
                    BasicManaColor::Blue => &mut state.players[player_idx].crystals.blue,
                    BasicManaColor::Green => &mut state.players[player_idx].crystals.green,
                    BasicManaColor::White => &mut state.players[player_idx].crystals.white,
                };
                if *target_crystal < 3 {
                    *target_crystal += 1;
                }
            }
            return; // Crystal→Crystal, no token added
        }
        PolarizationSourceType::Die => {
            if let Some(ref die_id) = opt.die_id {
                let player_id = state.players[player_idx].id.clone();
                if let Some(die) = state.source.dice.iter_mut().find(|d| d.id == *die_id) {
                    die.taken_by_player_id = Some(player_id);
                    die.is_depleted = true;
                }
            }
        }
    }

    // Gain target mana token (for Token and Die sources)
    state.players[player_idx].pure_mana.push(ManaToken {
        color: opt.target_color,
        source: ManaTokenSource::Effect,
        cannot_power_spells: opt.cannot_power_spells,
    });
}


// =============================================================================
// Curse skill handler (3-step)
// =============================================================================

pub(super) fn apply_curse(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Curse: not in combat".into()))?;

    let is_ranged_siege = combat.phase == CombatPhase::RangedSiege;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && (!is_ranged_siege || !is_enemy_fortified(e.enemy_id.as_str()))
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Curse: no eligible enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        // Auto-target
        setup_curse_mode(state, player_idx, skill_id, &eligible[0]);
    } else {
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::CurseTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Set up the mode choice for Curse (Attack -2 or Armor -1).
pub(crate) fn setup_curse_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state.combat.as_ref().unwrap();
    let enemy = combat
        .enemies
        .iter()
        .find(|e| e.instance_id.as_str() == enemy_instance_id)
        .unwrap();

    let enemy_def = mk_data::enemies::get_enemy(enemy.enemy_id.as_str());
    let has_ai = enemy_def
        .map(|d| d.abilities.contains(&EnemyAbilityType::ArcaneImmunity))
        .unwrap_or(false);
    let num_attacks = enemy_def
        .map(mk_data::enemies::attack_count)
        .unwrap_or(1);
    let has_multi_attack = num_attacks > 1;

    // Build options: always Attack -2, optionally Armor -1 (blocked by AI)
    let mut options = vec![CardEffect::Noop]; // index 0 = Attack -2
    if !has_ai {
        options.push(CardEffect::Noop); // index 1 = Armor -1
    }

    if options.len() == 1 && !has_multi_attack {
        // Only Attack -2, single attack → auto-apply
        skills::push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Combat,
            mk_types::modifier::ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            mk_types::modifier::ModifierEffect::EnemyStat {
                stat: mk_types::modifier::EnemyStat::Attack,
                amount: -2,
                minimum: 0,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
                exclude_resistance: None,
            },
        );
    } else {
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::CurseMode {
                    enemy_instance_id: enemy_instance_id.to_string(),
                    has_arcane_immunity: has_ai,
                    has_multi_attack,
                },
            }));
    }
}


/// Execute curse mode choice.
pub(crate) fn execute_curse_mode(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    has_multi_attack: bool,
    choice_index: usize,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    if choice_index == 0 {
        // Attack -2
        if has_multi_attack {
            // Need to choose which attack index
            let enemy_def = {
                let combat = state.combat.as_ref().unwrap();
                let enemy = combat
                    .enemies
                    .iter()
                    .find(|e| e.instance_id.as_str() == enemy_instance_id)
                    .unwrap();
                mk_data::enemies::get_enemy(enemy.enemy_id.as_str())
            };
            let num_attacks = enemy_def.map(mk_data::enemies::attack_count).unwrap_or(1);
            let options: Vec<CardEffect> = (0..num_attacks).map(|_| CardEffect::Noop).collect();
            state.players[player_idx].pending.active =
                Some(ActivePending::Choice(PendingChoice {
                    card_id: None,
                    skill_id: Some(skill_id.clone()),
                    unit_instance_id: None,
                    options,
                    continuation: vec![],
                    movement_bonus_applied: false,
                    resolution: ChoiceResolution::CurseAttackIndex {
                        enemy_instance_id: enemy_instance_id.to_string(),
                        attack_count: num_attacks,
                    },
                }));
        } else {
            // Single attack: apply directly
            skills::push_skill_modifier(
                state,
                player_idx,
                skill_id,
                mk_types::modifier::ModifierDuration::Combat,
                mk_types::modifier::ModifierScope::OneEnemy {
                    enemy_id: enemy_instance_id.to_string(),
                },
                mk_types::modifier::ModifierEffect::EnemyStat {
                    stat: mk_types::modifier::EnemyStat::Attack,
                    amount: -2,
                    minimum: 0,
                    attack_index: None,
                    per_resistance: false,
                    fortified_amount: None,
                    exclude_resistance: None,
                },
            );
        }
    } else {
        // Armor -1 (choice_index == 1)
        skills::push_skill_modifier(
            state,
            player_idx,
            skill_id,
            mk_types::modifier::ModifierDuration::Combat,
            mk_types::modifier::ModifierScope::OneEnemy {
                enemy_id: enemy_instance_id.to_string(),
            },
            mk_types::modifier::ModifierEffect::EnemyStat {
                stat: mk_types::modifier::EnemyStat::Armor,
                amount: -1,
                minimum: 1,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
                exclude_resistance: None,
            },
        );
    }
}


/// Execute curse attack index selection (multi-attack enemy).
pub(crate) fn execute_curse_attack_index(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    choice_index: usize,
) {
    skills::push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy {
            enemy_id: enemy_instance_id.to_string(),
        },
        mk_types::modifier::ModifierEffect::EnemyStat {
            stat: mk_types::modifier::EnemyStat::Attack,
            amount: -2,
            minimum: 0,
            attack_index: Some(choice_index as u32),
            per_resistance: false,
            fortified_amount: None,
            exclude_resistance: None,
        },
    );
}


// =============================================================================
// Forked Lightning skill handler (iterative loop)
// =============================================================================

pub(super) fn apply_forked_lightning(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Forked Lightning: not in combat".into()))?;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| !e.is_defeated)
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Forked Lightning: no alive enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        // Auto-target the single enemy
        apply_forked_lightning_hit(state, player_idx, &eligible[0]);
        // Only 1 enemy, can't pick more
    } else {
        // First pick: no "Done" option
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::ForkedLightningTarget {
                    remaining: 3,
                    already_targeted: vec![],
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


pub(super) fn apply_forked_lightning_hit(
    state: &mut GameState,
    player_idx: usize,
    _enemy_instance_id: &str,
) {
    // +1 Ranged ColdFire Attack
    let accumulator = &mut state.players[player_idx].combat_accumulator;
    accumulator.attack.ranged += 1;
    accumulator.attack.ranged_elements.cold_fire += 1;
}


/// Execute forked lightning target selection.
pub(crate) fn execute_forked_lightning_target(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    remaining: u32,
    already_targeted: &[String],
    choice_index: usize,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    // Build eligible list (alive, not already targeted)
    let eligible: Vec<String> = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .filter(|e| !e.is_defeated && !already_targeted.contains(&e.instance_id.as_str().to_string()))
            .map(|e| e.instance_id.as_str().to_string())
            .collect()
    };

    // If not first pick (remaining < 3), last option is "Done"
    let has_done = remaining < 3;

    // Check if "Done" was chosen
    if has_done && choice_index == eligible.len() {
        // "Done" chosen — no more targets
        return;
    }

    if choice_index >= eligible.len() {
        return;
    }

    // Apply the hit
    let target_id = eligible[choice_index].clone();
    apply_forked_lightning_hit(state, player_idx, &target_id);

    let mut new_targeted = already_targeted.to_vec();
    new_targeted.push(target_id);

    let new_remaining = remaining - 1;

    // Check if we can pick more
    let next_eligible: Vec<String> = {
        let combat = state.combat.as_ref().unwrap();
        combat
            .enemies
            .iter()
            .filter(|e| !e.is_defeated && !new_targeted.contains(&e.instance_id.as_str().to_string()))
            .map(|e| e.instance_id.as_str().to_string())
            .collect()
    };

    if new_remaining == 0 || next_eligible.is_empty() {
        // Done
        return;
    }

    // More picks available: present next choice with "Done" option
    let mut options: Vec<CardEffect> = next_eligible.iter().map(|_| CardEffect::Noop).collect();
    options.push(CardEffect::Noop); // "Done" option at the end

    state.players[player_idx].pending.active =
        Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: Some(skill_id.clone()),
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::ForkedLightningTarget {
                remaining: new_remaining,
                already_targeted: new_targeted,
            },
        }));
}


// =============================================================================
// Know Your Prey skill handler (2-step)
// =============================================================================

pub(super) fn apply_know_your_prey(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, PendingChoice};

    let combat = state
        .combat
        .as_ref()
        .ok_or_else(|| ApplyError::InternalError("Know Your Prey: not in combat".into()))?;

    let eligible: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !is_enemy_arcane_immune(e.enemy_id.as_str())
                && has_strippable_attributes(e.enemy_id.as_str())
        })
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if eligible.is_empty() {
        return Err(ApplyError::InternalError(
            "Know Your Prey: no eligible enemies".into(),
        ));
    }

    if eligible.len() == 1 {
        setup_know_your_prey_options(state, player_idx, skill_id, &eligible[0]);
    } else {
        let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::KnowYourPreyTarget {
                    eligible_enemy_ids: eligible,
                },
            }));
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: Vec::new(),
    })
}


/// Build options for Know Your Prey after target selection.
pub(crate) fn setup_know_your_prey_options(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
) {
    use mk_types::effect::CardEffect;
    use mk_types::pending::{ChoiceResolution, KnowYourPreyApplyOption, PendingChoice};

    let combat = state.combat.as_ref().unwrap();
    let enemy = combat
        .enemies
        .iter()
        .find(|e| e.instance_id.as_str() == enemy_instance_id)
        .unwrap();
    let enemy_def = mk_data::enemies::get_enemy(enemy.enemy_id.as_str());

    let mut strip_options: Vec<KnowYourPreyApplyOption> = Vec::new();

    if let Some(def) = enemy_def {
        // Removable abilities
        let removable = [
            EnemyAbilityType::Assassination,
            EnemyAbilityType::Brutal,
            EnemyAbilityType::Paralyze,
            EnemyAbilityType::Poison,
            EnemyAbilityType::Swift,
            EnemyAbilityType::Vampiric,
            EnemyAbilityType::Elusive,
            EnemyAbilityType::Fortified,
        ];
        for ability in &removable {
            if def.abilities.contains(ability) {
                strip_options.push(KnowYourPreyApplyOption::NullifyAbility {
                    ability: *ability,
                });
            }
        }

        // Resistances
        for r in def.resistances {
            strip_options.push(KnowYourPreyApplyOption::RemoveResistance {
                element: *r,
            });
        }

        // Element conversions (attack element)
        let attack_element = def.attack_element;
        add_element_conversions(&mut strip_options, attack_element);

        // Multi-attack element conversions
        if let Some(attacks) = def.attacks {
            for atk in attacks {
                add_element_conversions(&mut strip_options, atk.element);
            }
        }
    }

    // Deduplicate conversions
    strip_options.dedup_by(|a, b| {
        match (a, b) {
            (
                KnowYourPreyApplyOption::ConvertElement { from: f1, to: t1 },
                KnowYourPreyApplyOption::ConvertElement { from: f2, to: t2 },
            ) => *f1 == *f2 && *t1 == *t2,
            _ => false,
        }
    });

    if strip_options.len() == 1 {
        // Auto-apply
        execute_know_your_prey_option(
            state, player_idx, skill_id, enemy_instance_id, &strip_options[0],
        );
    } else if !strip_options.is_empty() {
        let options: Vec<CardEffect> = strip_options.iter().map(|_| CardEffect::Noop).collect();
        state.players[player_idx].pending.active =
            Some(ActivePending::Choice(PendingChoice {
                card_id: None,
                skill_id: Some(skill_id.clone()),
                unit_instance_id: None,
                options,
                continuation: vec![],
                movement_bonus_applied: false,
                resolution: ChoiceResolution::KnowYourPreyOption {
                    enemy_instance_id: enemy_instance_id.to_string(),
                    options: strip_options,
                },
            }));
    }
}


pub(super) fn add_element_conversions(
    strip_options: &mut Vec<mk_types::pending::KnowYourPreyApplyOption>,
    element: Element,
) {
    use mk_types::pending::KnowYourPreyApplyOption;
    match element {
        Element::Fire => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::Fire,
                to: Element::Physical,
            });
        }
        Element::Ice => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::Ice,
                to: Element::Physical,
            });
        }
        Element::ColdFire => {
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::ColdFire,
                to: Element::Fire,
            });
            strip_options.push(KnowYourPreyApplyOption::ConvertElement {
                from: Element::ColdFire,
                to: Element::Ice,
            });
        }
        _ => {} // Physical has no conversion
    }
}


/// Execute Know Your Prey option: push modifier.
pub(crate) fn execute_know_your_prey_option(
    state: &mut GameState,
    player_idx: usize,
    skill_id: &SkillId,
    enemy_instance_id: &str,
    opt: &mk_types::pending::KnowYourPreyApplyOption,
) {
    use mk_types::pending::KnowYourPreyApplyOption;

    let effect = match opt {
        KnowYourPreyApplyOption::NullifyAbility { ability } => {
            mk_types::modifier::ModifierEffect::AbilityNullifier {
                ability: Some(*ability),
                ignore_arcane_immunity: false,
            }
        }
        KnowYourPreyApplyOption::RemoveResistance { element } => {
            match element {
                ResistanceElement::Physical => mk_types::modifier::ModifierEffect::RemovePhysicalResistance,
                ResistanceElement::Fire => mk_types::modifier::ModifierEffect::RemoveFireResistance,
                ResistanceElement::Ice => mk_types::modifier::ModifierEffect::RemoveIceResistance,
            }
        }
        KnowYourPreyApplyOption::ConvertElement { from, to } => {
            mk_types::modifier::ModifierEffect::ConvertAttackElement {
                from_element: *from,
                to_element: *to,
            }
        }
    };

    skills::push_skill_modifier(
        state,
        player_idx,
        skill_id,
        mk_types::modifier::ModifierDuration::Combat,
        mk_types::modifier::ModifierScope::OneEnemy {
            enemy_id: enemy_instance_id.to_string(),
        },
        effect,
    );
}


// =============================================================================
// Enemy helpers
// =============================================================================

pub(super) fn is_enemy_fortified(enemy_id: &str) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|d| d.abilities.contains(&EnemyAbilityType::Fortified))
        .unwrap_or(false)
}


pub(super) fn is_enemy_arcane_immune(enemy_id: &str) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|d| d.abilities.contains(&EnemyAbilityType::ArcaneImmunity))
        .unwrap_or(false)
}


pub(super) fn has_strippable_attributes(enemy_id: &str) -> bool {
    let Some(def) = mk_data::enemies::get_enemy(enemy_id) else {
        return false;
    };

    // Has removable abilities?
    let removable = [
        EnemyAbilityType::Assassination,
        EnemyAbilityType::Brutal,
        EnemyAbilityType::Paralyze,
        EnemyAbilityType::Poison,
        EnemyAbilityType::Swift,
        EnemyAbilityType::Vampiric,
        EnemyAbilityType::Elusive,
        EnemyAbilityType::Fortified,
    ];
    if def.abilities.iter().any(|a| removable.contains(a)) {
        return true;
    }

    // Has resistances?
    if !def.resistances.is_empty() {
        return true;
    }

    // Has non-physical attack element?
    if !matches!(def.attack_element, Element::Physical) {
        return true;
    }

    // Multi-attack non-physical?
    if let Some(attacks) = def.attacks {
        if attacks.iter().any(|a| !matches!(a.element, Element::Physical)) {
            return true;
        }
    }

    false
}


/// Public wrapper for `has_strippable_attributes` (used by enumeration).
pub(crate) fn has_strippable_attributes_pub(enemy_id: &str) -> bool {
    has_strippable_attributes(enemy_id)
}


/// Short-circuit check for polarization options (used by enumeration gate).
pub(crate) fn has_polarization_options(state: &GameState, player_idx: usize) -> bool {
    let player = &state.players[player_idx];
    let is_day = state.time_of_day == TimeOfDay::Day;

    fn is_basic(c: ManaColor) -> bool {
        matches!(c, ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White)
    }

    // Check tokens
    for token in &player.pure_mana {
        if is_basic(token.color) { return true; }
        if token.color == ManaColor::Black && is_day { return true; }
        if token.color == ManaColor::Gold && !is_day { return true; }
    }

    // Check crystals
    if player.crystals.red > 0 || player.crystals.blue > 0
        || player.crystals.green > 0 || player.crystals.white > 0
    {
        return true;
    }

    // Check source dice
    for die in &state.source.dice {
        if die.is_depleted || die.taken_by_player_id.is_some() { continue; }
        if is_basic(die.color) { return true; }
        if die.color == ManaColor::Black && is_day { return true; }
        if die.color == ManaColor::Gold && !is_day { return true; }
    }

    false
}

