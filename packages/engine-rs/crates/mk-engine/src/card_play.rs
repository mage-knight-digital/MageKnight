//! Card play commands — PLAY_CARD (basic/powered) and PLAY_CARD_SIDEWAYS.
//!
//! Matches TS `playCardCommand.ts` and `playCardSidewaysCommand.ts`.

use mk_data::cards::{get_card, PoweredBy};
use mk_types::action::ManaSourceInfo;
use mk_types::enums::*;
use mk_types::modifier::{ModifierEffect, ModifierSource, RuleOverride, SidewaysCondition};
use mk_types::pending::{ActivePending, ChoiceResolution, ContinuationEntry, PendingChoice};
use mk_types::state::*;

use crate::effect_queue::{DrainResult, EffectQueue};

// =============================================================================
// Error types
// =============================================================================

/// Errors from card play validation/execution.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CardPlayError {
    CardNotInHand,
    InvalidHandIndex,
    CardNotFound,
    NotPowerable,
    ManaSourceRequired,
    InvalidManaSource,
    NotInCombat,
}

// =============================================================================
// Card play result
// =============================================================================

/// Result of playing a card.
#[derive(Debug)]
pub enum CardPlayResult {
    /// Effect resolved completely (no pending choice).
    Complete,
    /// Effect paused — player.pending.active is now set with a choice.
    /// Caller should check state.players[idx].pending.has_active().
    PendingChoice,
}

// =============================================================================
// Play card (basic or powered)
// =============================================================================

/// Play a card from hand (basic or powered mode).
///
/// Steps:
/// 1. Validate card is in hand at the given index
/// 2. Look up card definition
/// 3. If powered, validate and consume mana (token or crystal)
/// 4. Move card from hand to play area
/// 5. Resolve the card's effect via effect queue
pub fn play_card(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    powered: bool,
    override_mana_color: Option<BasicManaColor>,
) -> Result<CardPlayResult, CardPlayError> {
    let player = &state.players[player_idx];

    // Validate hand index
    if hand_index >= player.hand.len() {
        return Err(CardPlayError::InvalidHandIndex);
    }

    let card_id = player.hand[hand_index].clone();

    // Look up card definition
    let card_def = get_card(card_id.as_str()).ok_or(CardPlayError::CardNotFound)?;

    // Determine which effect to use and handle mana payment
    let (effect, consumed_color, mana_choice) = if powered {
        // Validate the card can be powered
        let required_color = override_mana_color
            .or_else(|| match card_def.powered_by {
                PoweredBy::Single(c) => Some(c),
                _ => None,
            })
            .ok_or(CardPlayError::NotPowerable)?;

        // Collect all available mana sources
        let sources = collect_mana_sources(state, player_idx, required_color);
        if sources.is_empty() {
            return Err(CardPlayError::ManaSourceRequired);
        }

        if sources.len() == 1 {
            // Single source — auto-consume immediately
            let consumed = consume_specific_mana_source(state, player_idx, &sources[0]);
            (card_def.powered_effect.clone(), Some(consumed), None)
        } else {
            // Multiple sources — defer to pending choice
            (card_def.powered_effect.clone(), None, Some(sources))
        }
    } else {
        (card_def.basic_effect.clone(), None, None)
    };

    // Move card from hand to play area
    let player = &mut state.players[player_idx];
    player.hand.remove(hand_index);
    player.play_area.push(card_id.clone());
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Track artifact end-turn flags (consumed by end_turn artifact steps)
    match card_id.as_str() {
        "goldyx_crystal_joy" => {
            player.crystal_joy_reclaim_version = Some(if powered {
                mk_types::pending::EffectMode::Powered
            } else {
                mk_types::pending::EffectMode::Basic
            });
        }
        "steady_tempo" => {
            player.steady_tempo_version = Some(if powered {
                mk_types::pending::EffectMode::Powered
            } else {
                mk_types::pending::EffectMode::Basic
            });
        }
        _ => {}
    }

    // If multiple mana sources: set pending choice and return early
    if let Some(sources) = mana_choice {
        let options: Vec<mk_types::effect::CardEffect> = sources
            .iter()
            .map(|_| mk_types::effect::CardEffect::Noop)
            .collect();
        state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(card_id),
            skill_id: None,
            unit_instance_id: None,
            options,
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::ManaSourceSelect {
                sources,
                powered_effect: effect,
            },
        }));
        return Ok(CardPlayResult::PendingChoice);
    }

    // Resolve the effect via effect queue
    let powered_effect_for_trigger = if powered { Some(card_def.powered_effect.clone()) } else { None };
    let mut queue = EffectQueue::new();
    queue.push(effect, Some(card_id.clone()));
    let result = match queue.drain(state, player_idx) {
        DrainResult::Complete => Ok(CardPlayResult::Complete),
        DrainResult::NeedsChoice {
            options,
            continuation,
            resolution,
        } => {
            // Store the choice in player pending state
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: Some(card_id),
                skill_id: None,
                unit_instance_id: None,
                options,
                continuation: continuation
                    .into_iter()
                    .map(|q| ContinuationEntry {
                        effect: q.effect,
                        source_card_id: q.source_card_id,
                    })
                    .collect(),
                movement_bonus_applied: false,
                resolution,
            }));
            Ok(CardPlayResult::PendingChoice)
        }
        DrainResult::PendingSet => {
            // A custom pending (e.g., DiscardForBonus) was set directly on the player.
            Ok(CardPlayResult::PendingChoice)
        }
    };

    // Mana trigger hooks after powered card play
    if let Some(consumed) = consumed_color {
        if let Some(ref powered_eff) = powered_effect_for_trigger {
            check_mana_overload_trigger(state, player_idx, consumed, powered_eff);
        }
        check_mana_enhancement_trigger(state, player_idx, consumed);
    }

    result
}

// =============================================================================
// Mana source collection (for pending choice)
// =============================================================================

/// Collect all available mana sources that can pay for the given color.
///
/// Returns a deduplicated list: at most one entry per source type/color combo.
/// Token sources are fungible (we pick the first matching index at consumption time).
pub(crate) fn collect_mana_sources(
    state: &GameState,
    player_idx: usize,
    required_color: BasicManaColor,
) -> Vec<ManaSourceInfo> {
    let target_mana = ManaColor::from(required_color);
    let player = &state.players[player_idx];
    let mut sources = Vec::new();

    // 1. Matching-color mana token
    if player.pure_mana.iter().any(|t| t.color == target_mana) {
        sources.push(ManaSourceInfo {
            source_type: ManaSourceType::Token,
            color: target_mana,
            die_id: None,
        });
    }

    // 2. Gold mana token (wild)
    if player
        .pure_mana
        .iter()
        .any(|t| t.color == ManaColor::Gold)
    {
        sources.push(ManaSourceInfo {
            source_type: ManaSourceType::Token,
            color: ManaColor::Gold,
            die_id: None,
        });
    }

    // 3. Matching-color crystal
    let crystal_count = match required_color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    if crystal_count > 0 {
        sources.push(ManaSourceInfo {
            source_type: ManaSourceType::Crystal,
            color: target_mana,
            die_id: None,
        });
    }

    // 4. Mana source dice (1 per turn limit)
    if !player
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE)
    {
        for die in &state.source.dice {
            if die.is_depleted || die.taken_by_player_id.is_some() {
                continue;
            }
            if die.color == target_mana || die.color == ManaColor::Gold {
                sources.push(ManaSourceInfo {
                    source_type: ManaSourceType::Die,
                    color: die.color,
                    die_id: Some(die.id.as_str().to_string()),
                });
            }
        }
    }

    sources
}

/// Consume a specific mana source identified by `ManaSourceInfo`.
///
/// Called when the player selects which mana source to use (from pending choice
/// or auto-selected when only one source is available).
pub(crate) fn consume_specific_mana_source(
    state: &mut GameState,
    player_idx: usize,
    source: &ManaSourceInfo,
) -> ManaColor {
    match source.source_type {
        ManaSourceType::Token => {
            let player = &mut state.players[player_idx];
            if let Some(idx) = player
                .pure_mana
                .iter()
                .position(|t| t.color == source.color)
            {
                player.pure_mana.remove(idx);
            }
            source.color
        }
        ManaSourceType::Crystal => {
            if let Some(basic) = to_basic_mana_color(source.color) {
                let player = &mut state.players[player_idx];
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
            source.color
        }
        ManaSourceType::Die => {
            let player_id = state.players[player_idx].id.clone();
            if let Some(ref die_id_str) = source.die_id {
                if let Some(die) = state
                    .source
                    .dice
                    .iter_mut()
                    .find(|d| d.id.as_str() == die_id_str.as_str())
                {
                    let die_id = die.id.clone();
                    die.taken_by_player_id = Some(player_id);
                    let player = &mut state.players[player_idx];
                    player.used_die_ids.push(die_id);
                    player.flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
                }
            }
            source.color
        }
    }
}

// =============================================================================
// Sideways value resolution
// =============================================================================

/// Check if a rule override is active for the given player.
pub fn is_rule_active(state: &GameState, player_idx: usize, rule: RuleOverride) -> bool {
    let player_id = &state.players[player_idx].id;
    state.active_modifiers.iter().any(|m| {
        m.created_by_player_id == *player_id
            && matches!(&m.effect, ModifierEffect::RuleOverride { rule: r } if *r == rule)
    })
}

/// Compute the effective sideways value for a card, considering active modifiers.
///
/// Base value: 0 for wounds, `card_def.sideways_value` for others.
/// Modifiers can increase the value via `ModifierEffect::SidewaysValue`.
pub fn get_effective_sideways_value(
    state: &GameState,
    player_idx: usize,
    is_wound: bool,
    card_type: DeedCardType,
    card_powered_by: Option<BasicManaColor>,
) -> u32 {
    let base_value: u32 = if is_wound { 0 } else { 1 };
    let player_id = &state.players[player_idx].id;
    let used_mana = state.players[player_idx]
        .flags
        .contains(PlayerFlags::USED_MANA_FROM_SOURCE);
    let mut best = base_value;
    for m in &state.active_modifiers {
        if m.created_by_player_id != *player_id {
            continue;
        }
        if let ModifierEffect::SidewaysValue {
            new_value,
            for_wounds,
            condition,
            mana_color,
            ref for_card_types,
        } = m.effect
        {
            if is_wound && !for_wounds {
                continue;
            }
            if !is_wound && for_wounds {
                continue;
            }
            if !for_card_types.is_empty() && !for_card_types.contains(&card_type) {
                continue;
            }
            match condition {
                Some(SidewaysCondition::NoManaUsed) if used_mana => continue,
                Some(SidewaysCondition::WithManaMatchingColor) => {
                    if card_powered_by != mana_color {
                        continue;
                    }
                }
                _ => {}
            }
            best = best.max(new_value);
        }
    }
    best
}

// =============================================================================
// Play card sideways
// =============================================================================

/// Play a card sideways from hand for 1 move/influence/attack/block.
///
/// Steps:
/// 1. Validate card is in hand at the given index
/// 2. Move card from hand to play area
/// 3. Apply sideways resource (move/influence/attack/block points)
pub fn play_card_sideways(
    state: &mut GameState,
    player_idx: usize,
    hand_index: usize,
    sideways_as: SidewaysAs,
) -> Result<(), CardPlayError> {
    let player = &state.players[player_idx];

    // Validate hand index
    if hand_index >= player.hand.len() {
        return Err(CardPlayError::InvalidHandIndex);
    }

    let card_id = player.hand[hand_index].clone();

    // Look up card definition for sideways value
    let card_def = get_card(card_id.as_str()).ok_or(CardPlayError::CardNotFound)?;
    let is_wound = card_id.as_str() == "wound";
    let value = get_effective_sideways_value(
        state,
        player_idx,
        is_wound,
        card_def.card_type,
        card_def.powered_by.primary_color(),
    );

    // Move card from hand to play area
    let player = &mut state.players[player_idx];
    player.hand.remove(hand_index);
    player.play_area.push(card_id);
    player
        .flags
        .insert(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN);

    // Consume bonus modifiers for sideways plays (Ambush/Deadly Aim, Path Finding, etc.)
    let bonus = consume_sideways_bonus(state, player_idx, sideways_as);
    let total_value = value + bonus;

    // Apply sideways effect
    apply_sideways_effect(state, player_idx, sideways_as, total_value);

    // Power of Pain: one-shot consumption after wound sideways play
    if is_wound {
        let pid = state.players[player_idx].id.clone();
        state.active_modifiers.retain(|m| {
            !matches!(&m.source, ModifierSource::Skill { skill_id, player_id }
                if skill_id.as_str() == "arythea_power_of_pain" && *player_id == pid)
        });
    }

    Ok(())
}

/// Consume one-shot bonus modifiers for sideways plays.
///
/// - `AttackBlockCardBonus` (from Ambush, Deadly Aim): consumed on sideways Attack or Block
/// - `MovementCardBonus` (from Path Finding etc.): consumed on sideways Move
///
/// Returns the bonus amount to add to the sideways value.
fn consume_sideways_bonus(
    state: &mut GameState,
    player_idx: usize,
    sideways_as: SidewaysAs,
) -> u32 {
    let pid = state.players[player_idx].id.clone();

    match sideways_as {
        SidewaysAs::Attack | SidewaysAs::Block => {
            let idx = state.active_modifiers.iter().position(|m| {
                matches!(&m.effect, ModifierEffect::AttackBlockCardBonus { .. })
                    && matches!(
                        &m.source,
                        ModifierSource::Card { player_id, .. } if *player_id == pid
                    )
            });
            if let Some(idx) = idx {
                let bonus = match &state.active_modifiers[idx].effect {
                    ModifierEffect::AttackBlockCardBonus {
                        attack_bonus,
                        block_bonus,
                        ranged_siege_attack_bonus,
                    } => match sideways_as {
                        SidewaysAs::Attack => {
                            // Use ranged_siege_attack_bonus if in ranged/siege phase
                            if let Some(rsb) = ranged_siege_attack_bonus {
                                if state.combat.as_ref().is_some_and(|c| {
                                    matches!(c.phase, CombatPhase::RangedSiege)
                                }) {
                                    (*rsb).max(0) as u32
                                } else {
                                    (*attack_bonus).max(0) as u32
                                }
                            } else {
                                (*attack_bonus).max(0) as u32
                            }
                        }
                        SidewaysAs::Block => (*block_bonus).max(0) as u32,
                        _ => 0,
                    },
                    _ => 0,
                };
                state.active_modifiers.remove(idx); // one-shot consumption
                bonus
            } else {
                0
            }
        }
        SidewaysAs::Move => {
            let idx = state.active_modifiers.iter().position(|m| {
                matches!(&m.effect, ModifierEffect::MovementCardBonus { .. })
                    && matches!(
                        &m.source,
                        ModifierSource::Card { player_id, .. } if *player_id == pid
                    )
            });
            if let Some(idx) = idx {
                let bonus = match &state.active_modifiers[idx].effect {
                    ModifierEffect::MovementCardBonus { amount, .. } => (*amount).max(0) as u32,
                    _ => 0,
                };
                state.active_modifiers.remove(idx); // one-shot consumption
                bonus
            } else {
                0
            }
        }
        SidewaysAs::Influence => 0, // no bonus modifiers for influence
    }
}

/// Apply the sideways resource gain to the player.
fn apply_sideways_effect(
    state: &mut GameState,
    player_idx: usize,
    sideways_as: SidewaysAs,
    value: u32,
) {
    let player = &mut state.players[player_idx];
    match sideways_as {
        SidewaysAs::Move => {
            player.move_points += value;
        }
        SidewaysAs::Influence => {
            player.influence_points += value;
        }
        SidewaysAs::Attack => {
            // Sideways attack is always physical melee
            player.combat_accumulator.attack.normal += value;
            player.combat_accumulator.attack.normal_elements.physical += value;
        }
        SidewaysAs::Block => {
            // Sideways block is always physical
            player.combat_accumulator.block += value;
            player.combat_accumulator.block_elements.physical += value;
        }
    }
}

// =============================================================================
// Mana trigger hooks
// =============================================================================

/// Convert a ManaColor to BasicManaColor (None for Gold/Black).
pub(crate) fn to_basic_mana_color(color: ManaColor) -> Option<BasicManaColor> {
    match color {
        ManaColor::Red => Some(BasicManaColor::Red),
        ManaColor::Blue => Some(BasicManaColor::Blue),
        ManaColor::Green => Some(BasicManaColor::Green),
        ManaColor::White => Some(BasicManaColor::White),
        _ => None,
    }
}

/// Detect which bonus type (Move/Influence/Attack/Block) the effect provides first.
#[derive(Debug, Clone, Copy)]
enum BonusType {
    Move,
    Influence,
    Attack,
    Block,
}

pub(crate) fn effect_has_move(effect: &mk_types::effect::CardEffect) -> bool {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainMove { .. } => true,
        CardEffect::Compound { effects } => effects.iter().any(effect_has_move),
        CardEffect::Choice { options } => options.iter().any(effect_has_move),
        CardEffect::Conditional { then_effect, else_effect, .. } => {
            effect_has_move(then_effect)
                || else_effect.as_ref().is_some_and(|e| effect_has_move(e))
        }
        CardEffect::Scaling { base_effect, .. } => effect_has_move(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => effect_has_move(then_effect),
        _ => false,
    }
}

pub(crate) fn effect_has_influence(effect: &mk_types::effect::CardEffect) -> bool {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainInfluence { .. } => true,
        CardEffect::Compound { effects } => effects.iter().any(effect_has_influence),
        CardEffect::Choice { options } => options.iter().any(effect_has_influence),
        CardEffect::Conditional { then_effect, else_effect, .. } => {
            effect_has_influence(then_effect)
                || else_effect.as_ref().is_some_and(|e| effect_has_influence(e))
        }
        CardEffect::Scaling { base_effect, .. } => effect_has_influence(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => effect_has_influence(then_effect),
        _ => false,
    }
}

pub(crate) fn effect_has_attack(effect: &mk_types::effect::CardEffect) -> bool {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainAttack { .. }
        | CardEffect::AttackWithDefeatBonus { .. }
        | CardEffect::PureMagic { .. } => true,
        CardEffect::Compound { effects } => effects.iter().any(effect_has_attack),
        CardEffect::Choice { options } => options.iter().any(effect_has_attack),
        CardEffect::Conditional { then_effect, else_effect, .. } => {
            effect_has_attack(then_effect)
                || else_effect.as_ref().is_some_and(|e| effect_has_attack(e))
        }
        CardEffect::Scaling { base_effect, .. } => effect_has_attack(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => effect_has_attack(then_effect),
        _ => false,
    }
}

pub(crate) fn effect_has_block(effect: &mk_types::effect::CardEffect) -> bool {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainBlock { .. } | CardEffect::GainBlockElement { .. } => true,
        CardEffect::Compound { effects } => effects.iter().any(effect_has_block),
        CardEffect::Choice { options } => options.iter().any(effect_has_block),
        CardEffect::Conditional { then_effect, else_effect, .. } => {
            effect_has_block(then_effect)
                || else_effect.as_ref().is_some_and(|e| effect_has_block(e))
        }
        CardEffect::Scaling { base_effect, .. } => effect_has_block(base_effect),
        CardEffect::DiscardCost { then_effect, .. } => effect_has_block(then_effect),
        _ => false,
    }
}

fn detect_first_bonus_type(effect: &mk_types::effect::CardEffect) -> Option<BonusType> {
    if effect_has_move(effect) { return Some(BonusType::Move); }
    if effect_has_influence(effect) { return Some(BonusType::Influence); }
    if effect_has_attack(effect) { return Some(BonusType::Attack); }
    if effect_has_block(effect) { return Some(BonusType::Block); }
    None
}

/// Apply the +4 bonus from Mana Overload trigger.
fn apply_mana_overload_bonus(state: &mut GameState, player_idx: usize, bonus_type: BonusType) {
    let player = &mut state.players[player_idx];
    match bonus_type {
        BonusType::Move => player.move_points += 4,
        BonusType::Influence => player.influence_points += 4,
        BonusType::Attack => {
            player.combat_accumulator.attack.normal += 4;
            player.combat_accumulator.attack.normal_elements.physical += 4;
        }
        BonusType::Block => {
            player.combat_accumulator.block += 4;
            player.combat_accumulator.block_elements.physical += 4;
        }
    }
}

/// Check and trigger Mana Overload after a powered card play.
/// If the consumed mana color matches the marked color, apply +4 bonus and clear center.
pub(crate) fn check_mana_overload_trigger(
    state: &mut GameState,
    player_idx: usize,
    consumed_color: ManaColor,
    powered_effect: &mk_types::effect::CardEffect,
) {
    let center = match &state.mana_overload_center {
        Some(c) => c.clone(),
        None => return,
    };
    // Check: consumed color matches marked color
    if consumed_color != center.marked_color {
        return;
    }
    // Check: effect provides Move/Influence/Attack/Block
    let bonus_type = match detect_first_bonus_type(powered_effect) {
        Some(bt) => bt,
        None => return,
    };
    // Apply +4 to first applicable type
    apply_mana_overload_bonus(state, player_idx, bonus_type);
    // Clear center — skill stays flipped on owner
    state.mana_overload_center = None;
}

/// Check and trigger Mana Enhancement after a powered card play.
/// If Krang has the skill and spent basic mana, gain a crystal of that color.
pub(crate) fn check_mana_enhancement_trigger(
    state: &mut GameState,
    player_idx: usize,
    consumed_color: ManaColor,
) {
    use mk_types::ids::SkillId;

    // Must be basic color
    let basic_color = match to_basic_mana_color(consumed_color) {
        Some(c) => c,
        None => return,
    };
    let skill_id = SkillId::from("krang_mana_enhancement");
    let player = &state.players[player_idx];
    // Must have the skill
    if !player.skills.iter().any(|s| s.as_str() == "krang_mana_enhancement") {
        return;
    }
    // Must not be used this round
    if player.skill_cooldowns.used_this_round.iter().any(|s| s.as_str() == "krang_mana_enhancement") {
        return;
    }
    // Must not be flipped
    if player.skill_flip_state.flipped_skills.iter().any(|s| s.as_str() == "krang_mana_enhancement") {
        return;
    }

    // Gain crystal of consumed color
    crate::effect_queue::gain_crystal_color(state, player_idx, basic_color);
    // Mark used this round
    state.players[player_idx].skill_cooldowns.used_this_round.push(skill_id.clone());
    // Set center state
    state.mana_enhancement_center = Some(ManaEnhancementCenter {
        marked_color: basic_color,
        owner_id: state.players[player_idx].id.clone(),
        skill_id: skill_id.clone(),
    });
    // Place skill in center (flip + dummy marker for returnable_skills detection)
    crate::action_pipeline::place_skill_in_center_pub(state, player_idx, &skill_id);
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_types::ids::CardId;

    /// Helper to create a game state with one player holding specific cards.
    /// Source dice are cleared so powered tests use only explicit tokens/crystals.
    fn setup_game(hand: Vec<&str>) -> GameState {
        use crate::setup::create_solo_game;

        let mut state = create_solo_game(42, Hero::Arythea);
        // Replace hand with specified cards
        state.players[0].hand = hand.into_iter().map(CardId::from).collect();
        // Clear source dice so tests control mana sources explicitly
        state.source.dice.clear();
        state
    }

    /// Give the player a mana token of the specified color.
    fn give_mana(state: &mut GameState, color: ManaColor) {
        state.players[0].pure_mana.push(ManaToken {
            color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    }

    #[test]
    fn play_march_basic_gains_2_move() {
        let mut state = setup_game(vec!["march", "rage"]);
        assert_eq!(state.players[0].move_points, 0);

        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));

        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].hand.len(), 1); // rage remains
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "march");
    }

    #[test]
    fn play_march_powered_gains_4_move() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Green); // march powered by green

        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));

        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty()); // mana consumed
    }

    #[test]
    fn play_promise_basic_gains_2_influence() {
        let mut state = setup_game(vec!["promise"]);

        play_card(&mut state, 0, 0, false, None).unwrap();
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn play_threaten_basic_gains_2_influence() {
        let mut state = setup_game(vec!["threaten"]);

        play_card(&mut state, 0, 0, false, None).unwrap();
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn play_threaten_powered_gains_5_influence_minus_1_rep() {
        let mut state = setup_game(vec!["threaten"]);
        give_mana(&mut state, ManaColor::Red); // threaten powered by red

        play_card(&mut state, 0, 0, true, None).unwrap();
        assert_eq!(state.players[0].influence_points, 5);
        assert_eq!(state.players[0].reputation, -1);
    }

    #[test]
    fn play_rage_basic_returns_choice() {
        let mut state = setup_game(vec!["rage"]);
        // Rage basic is a choice (attack or block), but no combat
        // so attack isn't resolvable. Only block might be if in combat.
        // Actually: both attack and block require combat.
        // With no combat, neither is resolvable, so the choice may be skipped.

        // Without combat: GainAttack and GainBlock are only resolvable in combat.
        // The choice should skip (0 resolvable options).
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        // No combat = no options resolvable = skip
        assert!(matches!(result, CardPlayResult::Complete));
    }

    #[test]
    fn play_tranquility_basic_returns_choice() {
        let mut state = setup_game(vec!["tranquility"]);
        // Tranquility basic: choice of heal 1 or draw 1
        // Heal requires wounds in hand or wounded units (false here)
        // Draw requires cards in deck (true)
        // So 1 option resolvable → auto-resolve draw
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // Should have drawn 1 card
        assert_eq!(state.players[0].hand.len(), 1); // was 0 after play, drew 1
    }

    #[test]
    fn play_sideways_as_move() {
        let mut state = setup_game(vec!["rage", "march"]);
        assert_eq!(state.players[0].move_points, 0);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();

        assert_eq!(state.players[0].move_points, 1);
        assert_eq!(state.players[0].hand.len(), 1); // march remains
        assert_eq!(state.players[0].play_area[0].as_str(), "rage");
    }

    #[test]
    fn play_sideways_as_influence() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Influence).unwrap();
        assert_eq!(state.players[0].influence_points, 1);
    }

    #[test]
    fn play_sideways_as_attack_adds_physical_melee() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Attack).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 1);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .normal_elements
                .physical,
            1
        );
    }

    #[test]
    fn play_sideways_as_block_adds_physical() {
        let mut state = setup_game(vec!["march"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Block).unwrap();
        assert_eq!(state.players[0].combat_accumulator.block, 1);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.physical,
            1
        );
    }

    #[test]
    fn invalid_hand_index_returns_error() {
        let mut state = setup_game(vec!["march"]);

        let result = play_card(&mut state, 0, 5, false, None);
        assert_eq!(result.unwrap_err(), CardPlayError::InvalidHandIndex);
    }

    #[test]
    fn unknown_card_returns_error() {
        let mut state = setup_game(vec![]);
        state.players[0].hand.push(CardId::from("nonexistent_card"));

        let result = play_card(&mut state, 0, 0, false, None);
        assert_eq!(result.unwrap_err(), CardPlayError::CardNotFound);
    }

    #[test]
    fn card_moves_to_play_area() {
        let mut state = setup_game(vec!["march", "stamina", "rage"]);

        play_card(&mut state, 0, 1, false, None).unwrap(); // play stamina (index 1)

        assert_eq!(state.players[0].hand.len(), 2);
        assert_eq!(state.players[0].hand[0].as_str(), "march");
        assert_eq!(state.players[0].hand[1].as_str(), "rage");
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "stamina");
    }

    #[test]
    fn played_card_from_hand_flag_set() {
        let mut state = setup_game(vec!["march"]);
        assert!(!state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));

        play_card(&mut state, 0, 0, false, None).unwrap();

        assert!(state.players[0]
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN));
    }

    #[test]
    fn multiple_cards_can_be_played() {
        let mut state = setup_game(vec!["march", "stamina", "promise"]);

        play_card(&mut state, 0, 0, false, None).unwrap(); // play march
        play_card(&mut state, 0, 0, false, None).unwrap(); // play stamina (now at index 0)
        play_card(&mut state, 0, 0, false, None).unwrap(); // play promise (now at index 0)

        assert_eq!(state.players[0].hand.len(), 0);
        assert_eq!(state.players[0].play_area.len(), 3);
        assert_eq!(state.players[0].move_points, 4); // march(2) + stamina(2)
        assert_eq!(state.players[0].influence_points, 2); // promise(2)
    }

    #[test]
    fn concentration_basic_sets_pending_choice() {
        let mut state = setup_game(vec!["concentration"]);

        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        // Concentration basic: choice of blue/white/red mana
        // All 3 options are always resolvable (GainMana is always OK)
        // So it should set pending choice with 3 options
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 3);
        } else {
            panic!("Expected ActivePending::Choice");
        }
    }

    #[test]
    fn krang_ruthless_coercion_powered_compound() {
        let mut state = setup_game(vec!["krang_ruthless_coercion"]);
        give_mana(&mut state, ManaColor::Red); // krang_ruthless_coercion powered by red

        play_card(&mut state, 0, 0, true, None).unwrap();
        assert_eq!(state.players[0].influence_points, 7);
        assert_eq!(state.players[0].reputation, -2);
    }

    #[test]
    fn sideways_wound_has_zero_value() {
        let mut state = setup_game(vec!["wound"]);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        assert_eq!(state.players[0].move_points, 0); // wound sideways value = 0
    }

    // ---- P0 starting-deck card integration tests ----

    #[test]
    fn concentration_resolve_choice_gains_mana() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["concentration"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick blue mana (index 0)
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(
            state.players[0].pure_mana[0].color,
            mk_types::enums::ManaColor::Blue
        );
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn concentration_powered_card_boost_no_targets_skips() {
        // Only "concentration" in hand — after playing it, hand is empty → boost skips
        let mut state = setup_game(vec!["concentration"]);
        give_mana(&mut state, ManaColor::Green); // concentration powered by green
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert!(state.players[0].pure_mana.is_empty()); // mana consumed
    }

    #[test]
    fn concentration_powered_card_boost_with_target() {
        // "concentration" + "march" in hand — plays concentration powered,
        // CardBoost auto-selects march (only eligible), resolves march powered +2
        let mut state = setup_game(vec!["concentration", "march"]);
        give_mana(&mut state, ManaColor::Green);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // march powered_effect = GainMove{4}, boosted by 2 → GainMove{6}
        assert_eq!(state.players[0].move_points, 6);
        // Both cards in play area
        assert_eq!(state.players[0].play_area.len(), 2);
        assert!(state.players[0].hand.is_empty());
    }

    #[test]
    fn concentration_powered_card_boost_chains_to_pending_choice_in_combat() {
        use crate::effect_queue::resolve_pending_choice;
        use mk_types::effect::CardEffect;

        let mut state = setup_game(vec!["concentration", "wolfhawk_swift_reflexes"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        give_mana(&mut state, ManaColor::Green); // concentration powered by green

        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert_eq!(state.players[0].play_area.len(), 2);
        assert!(state.players[0].hand.is_empty());

        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
            let mut saw_attack = false;
            let mut saw_block = false;
            for opt in &choice.options {
                match opt {
                    CardEffect::GainAttack { amount, .. } => {
                        saw_attack = true;
                        assert_eq!(*amount, 5); // Swift Reflexes powered 3 + Concentration bonus 2
                    }
                    CardEffect::GainBlock { amount, .. } => {
                        saw_block = true;
                        assert_eq!(*amount, 5); // Swift Reflexes powered 3 + Concentration bonus 2
                    }
                    other => panic!("Unexpected boosted swift reflexes option: {:?}", other),
                }
            }
            assert!(saw_attack && saw_block);
        } else {
            panic!("Expected pending choice from boosted Swift Reflexes in combat");
        }

        // Resolve attack option and verify boosted value is applied.
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 5);
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn crystallize_basic_no_mana_skips() {
        let mut state = setup_game(vec!["crystallize"]);
        // No mana tokens → ConvertManaToCrystal skips
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
    }

    #[test]
    fn crystallize_basic_with_mana_crystallizes() {
        let mut state = setup_game(vec!["crystallize"]);
        state.players[0].pure_mana.push(mk_types::state::ManaToken {
            color: mk_types::enums::ManaColor::Red,
            source: mk_types::state::ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn crystallize_powered_offers_crystal_choice() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["crystallize"]);
        give_mana(&mut state, ManaColor::Blue); // crystallize powered by blue
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        // Powered crystallize: choice of 4 crystal colors
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick green (index 2)
        resolve_pending_choice(&mut state, 0, 2).unwrap();
        assert_eq!(state.players[0].crystals.green, 1);
    }

    #[test]
    fn mana_draw_basic_adds_rule_modifier() {
        let mut state = setup_game(vec!["mana_draw"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
    }

    #[test]
    fn mana_draw_powered_offers_color_choice() {
        use crate::effect_queue::resolve_pending_choice;

        let mut state = setup_game(vec!["mana_draw"]);
        // mana_draw powered effect needs source dice to take from
        state.source.dice = vec![mk_types::state::SourceDie {
            id: mk_types::ids::SourceDieId::from("die_0"),
            color: ManaColor::Green,
            is_depleted: false,
            taken_by_player_id: None,
        }];
        give_mana(&mut state, ManaColor::White); // mana_draw powered by white
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));

        // Resolve: pick red (index 0) — should gain 2 red mana tokens
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].pure_mana.len(), 2);
        assert_eq!(
            state.players[0].pure_mana[0].color,
            mk_types::enums::ManaColor::Red
        );
    }

    #[test]
    fn improvisation_basic_discard_and_choice() {
        let mut state = setup_game(vec!["improvisation", "march"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        // Improvisation: discard 1 non-wound, then choice of move/influence/attack/block
        // Only march left in hand → discard it → then present choice
        // Attack and block require combat → 2 of 4 options filtered
        // Move and influence both resolvable → pending choice
        assert!(matches!(result, CardPlayResult::PendingChoice));
        assert_eq!(state.players[0].hand.len(), 0); // march discarded + improvisation played
        assert_eq!(state.players[0].discard.len(), 1); // march discarded
    }

    #[test]
    fn improvisation_no_non_wound_cards_skips() {
        let mut state = setup_game(vec!["improvisation"]);
        // After improvisation is played from hand, hand is empty → can't discard
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete)); // skipped
    }

    // ---- Mana payment tests ----

    #[test]
    fn powered_without_mana_returns_error() {
        let mut state = setup_game(vec!["march"]);
        state.source.dice.clear(); // No source dice available
        let result = play_card(&mut state, 0, 0, true, None);
        assert_eq!(result.unwrap_err(), CardPlayError::ManaSourceRequired);
        // Card should still be in hand (not moved to play area)
        assert_eq!(state.players[0].hand.len(), 1);
        assert!(state.players[0].play_area.is_empty());
    }

    #[test]
    fn powered_with_gold_mana_succeeds() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Gold); // gold is wild
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        assert!(state.players[0].pure_mana.is_empty());
    }

    #[test]
    fn powered_with_crystal_payment() {
        let mut state = setup_game(vec!["march"]);
        state.players[0].crystals.green = 2; // march powered by green
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        assert_eq!(state.players[0].crystals.green, 1); // one spent
        assert_eq!(state.players[0].spent_crystals_this_turn.green, 1);
    }

    #[test]
    fn powered_with_multiple_sources_creates_pending_choice() {
        let mut state = setup_game(vec!["march"]);
        give_mana(&mut state, ManaColor::Green);
        state.players[0].crystals.green = 2;
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        // Two sources available (token + crystal) → pending choice
        assert!(matches!(result, CardPlayResult::PendingChoice));
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2); // token + crystal
            assert!(matches!(
                choice.resolution,
                mk_types::pending::ChoiceResolution::ManaSourceSelect { .. }
            ));
        } else {
            panic!("Expected pending ManaSourceSelect choice");
        }
    }

    #[test]
    fn powered_wrong_color_mana_fails() {
        let mut state = setup_game(vec!["march"]);
        state.source.dice.clear(); // No source dice available
        give_mana(&mut state, ManaColor::Red); // march needs green, not red
        let result = play_card(&mut state, 0, 0, true, None);
        assert_eq!(result.unwrap_err(), CardPlayError::ManaSourceRequired);
    }

    // ---- get_effective_sideways_value tests ----

    #[test]
    fn get_effective_sideways_value_base_returns_1() {
        let state = setup_game(vec!["march"]);
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 1);
    }

    #[test]
    fn get_effective_sideways_value_wound_returns_0() {
        let state = setup_game(vec!["wound"]);
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 0);
    }

    #[test]
    fn get_effective_sideways_value_with_modifier() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 2, for_wounds: false, condition: None, mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 2);
    }

    #[test]
    fn get_effective_sideways_value_wound_with_for_wounds() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["wound"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 2, for_wounds: true, condition: None, mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 2);
    }

    #[test]
    fn get_effective_sideways_value_card_type_filter() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        // Modifier only for AA/Spell/Artifact
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 3, for_wounds: false, condition: None, mana_color: None,
                for_card_types: vec![DeedCardType::AdvancedAction, DeedCardType::Spell, DeedCardType::Artifact],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        // BasicAction: doesn't match filter, stays at base 1
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, Some(BasicManaColor::Green));
        assert_eq!(val, 1);
        // AdvancedAction: matches filter, gets 3
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::AdvancedAction, Some(BasicManaColor::Red));
        assert_eq!(val, 3);
    }

    #[test]
    fn get_effective_sideways_value_no_mana_condition() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = setup_game(vec!["march"]);
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("test_1"),
            source: ModifierSource::Skill { skill_id: mk_types::ids::SkillId::from("test"), player_id: pid.clone() },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::SidewaysValue {
                new_value: 3, for_wounds: false, condition: Some(SidewaysCondition::NoManaUsed), mana_color: None, for_card_types: vec![],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });
        // No mana used: value = 3
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, None);
        assert_eq!(val, 3);
        // After mana used: value = 1 (base)
        state.players[0].flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
        let val = get_effective_sideways_value(&state, 0, false, DeedCardType::BasicAction, None);
        assert_eq!(val, 1);
    }

    #[test]
    fn power_of_pain_wound_sideways_enhanced() {
        use crate::action_pipeline;
        let mut state = setup_game(vec!["wound"]);
        let skill_id = mk_types::ids::SkillId::from("arythea_power_of_pain");
        state.players[0].skills.push(skill_id.clone());
        // Activate skill
        action_pipeline::apply_power_of_pain_pub(&mut state, 0, &skill_id);
        // Wound sideways value should now be 2
        let val = get_effective_sideways_value(&state, 0, true, DeedCardType::Wound, None);
        assert_eq!(val, 2);
        assert!(is_rule_active(&state, 0, RuleOverride::WoundsPlayableSideways));
    }

    #[test]
    fn power_of_pain_consumed_after_wound_play() {
        use crate::action_pipeline;
        let mut state = setup_game(vec!["wound"]);
        let skill_id = mk_types::ids::SkillId::from("arythea_power_of_pain");
        state.players[0].skills.push(skill_id.clone());
        // Activate skill
        action_pipeline::apply_power_of_pain_pub(&mut state, 0, &skill_id);
        assert_eq!(state.active_modifiers.len(), 2); // RuleOverride + SidewaysValue
        // Play wound sideways
        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();
        assert_eq!(state.players[0].move_points, 2); // wound sideways = 2
        // Modifiers consumed (one-shot)
        assert_eq!(state.active_modifiers.len(), 0);
    }

    // ====================================================================
    // Card integration tests — edge cases from TS audit
    // ====================================================================

    use mk_types::hex::HexCoord;
    use mk_types::ids::EnemyId;
    use mk_types::modifier::TerrainOrAll;

    /// Place the player on a hex with the specified terrain.
    fn place_player_on_terrain(state: &mut GameState, terrain: Terrain) {
        let coord = HexCoord { q: 5, r: 5 };
        state.map.hexes.insert(
            coord.key(),
            HexState {
                coord,
                terrain,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );
        state.players[0].position = Some(coord);
    }

    /// Set up combat state with specified real enemy IDs.
    fn setup_combat_with_enemies(state: &mut GameState, enemy_ids: &[&str]) {
        let enemies: Vec<CombatEnemy> = enemy_ids
            .iter()
            .enumerate()
            .map(|(i, id)| CombatEnemy {
                instance_id: format!("enemy_{}", i).into(),
                enemy_id: EnemyId::from(*id),
                is_blocked: false,
                is_defeated: false,
                damage_assigned: false,
                is_required_for_conquest: false,
                summoned_by_instance_id: None,
                is_summoner_hidden: false,
                attacks_blocked: vec![false],
                attacks_damage_assigned: vec![false],
                attacks_cancelled: vec![false],
            })
            .collect();
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            enemies,
            ..CombatState::default()
        }));
    }

    // ---- A. Conditional effect tests ----

    #[test]
    fn refreshing_walk_basic_outside_combat_heals() {
        // InCombat=false → else branch: Compound(Move 2, Heal 1)
        let mut state = setup_game(vec!["refreshing_walk", "wound"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        // Heal 1 removes the wound from hand
        assert_eq!(
            state.players[0]
                .hand
                .iter()
                .filter(|c| c.as_str() == "wound")
                .count(),
            0
        );
    }

    #[test]
    fn refreshing_walk_basic_in_combat_no_heal() {
        // InCombat=true → then branch: GainMove 2 only
        let mut state = setup_game(vec!["refreshing_walk", "wound"]);
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::RangedSiege,
            ..CombatState::default()
        }));
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        // Wound stays in hand — no healing in the combat branch
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
    }

    #[test]
    fn restoration_powered_on_forest_heals_5() {
        // OnTerrain{Forest} → then: Heal 5
        let mut state = setup_game(vec!["restoration"]);
        give_mana(&mut state, ManaColor::Green);
        // Add 5 wounds to hand
        for _ in 0..5 {
            state.players[0].hand.push(CardId::from("wound"));
        }
        place_player_on_terrain(&mut state, Terrain::Forest);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // All 5 wounds healed
        assert_eq!(
            state.players[0]
                .hand
                .iter()
                .filter(|c| c.as_str() == "wound")
                .count(),
            0
        );
    }

    #[test]
    fn restoration_powered_off_forest_heals_3() {
        // OnTerrain{Forest} condition false → else: Heal 3
        let mut state = setup_game(vec!["restoration"]);
        give_mana(&mut state, ManaColor::Green);
        // Add 5 wounds to hand
        for _ in 0..5 {
            state.players[0].hand.push(CardId::from("wound"));
        }
        place_player_on_terrain(&mut state, Terrain::Plains);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // Only 3 wounds healed, 2 remain
        assert_eq!(
            state.players[0]
                .hand
                .iter()
                .filter(|c| c.as_str() == "wound")
                .count(),
            2
        );
    }

    // ---- B. Combat card effect tests ----

    #[test]
    fn fireball_basic_fire_ranged_5_in_combat() {
        let mut state = setup_game(vec!["fireball"]);
        give_mana(&mut state, ManaColor::Red); // fireball is red spell
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 5);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .ranged_elements
                .fire,
            5
        );
    }

    #[test]
    fn fireball_powered_wound_and_siege_fire_8() {
        let mut state = setup_game(vec!["fireball"]);
        give_mana(&mut state, ManaColor::Red); // spell cost
        give_mana(&mut state, ManaColor::Red); // powered cost
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // Compound: TakeWound + Siege Fire 8
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 8);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .siege_elements
                .fire,
            8
        );
        // TakeWound added a wound
        assert!(state.players[0]
            .hand
            .iter()
            .any(|c| c.as_str() == "wound"));
    }

    #[test]
    fn fireball_basic_skips_without_combat() {
        // Ranged attack is only resolvable in combat → skips
        let mut state = setup_game(vec!["fireball"]);
        give_mana(&mut state, ManaColor::Red);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // No combat → attack was skipped, no effect
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 0);
    }

    #[test]
    fn rage_basic_in_combat_presents_choice() {
        // Rage basic: Choice(Attack 2 melee, Block 2) — both resolvable in combat
        let mut state = setup_game(vec!["rage"]);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::PendingChoice));
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
        } else {
            panic!("Expected ActivePending::Choice");
        }
    }

    #[test]
    fn rage_powered_in_combat_attack_4() {
        // Rage powered: GainAttack 4 melee (no choice)
        let mut state = setup_game(vec!["rage"]);
        give_mana(&mut state, ManaColor::Red);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
    }

    #[test]
    fn swiftness_powered_ranged_attack_3() {
        // Swiftness basic = Move 2, powered = Ranged Attack 3 (completely different!)
        let mut state = setup_game(vec!["swiftness"]);
        give_mana(&mut state, ManaColor::White);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
        assert_eq!(state.players[0].move_points, 0); // NOT move, it's attack
    }

    #[test]
    fn ice_shield_basic_ice_block_3() {
        let mut state = setup_game(vec!["ice_shield"]);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.block, 3);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.ice, 3
        );
    }

    #[test]
    fn ice_shield_powered_block_plus_select_enemy() {
        // Powered: Compound(Ice Block 3, SelectCombatEnemy{armor -3, min 1, exclude ice})
        let mut state = setup_game(vec!["ice_shield"]);
        give_mana(&mut state, ManaColor::Blue);
        // prowlers: no ice resistance → eligible
        // crystal_sprites: ice resistance → excluded
        setup_combat_with_enemies(&mut state, &["prowlers", "crystal_sprites"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        // Ice block 3 applied
        assert_eq!(state.players[0].combat_accumulator.block, 3);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.ice, 3
        );
        // SelectCombatEnemy: crystal_sprites excluded (ice resistant), prowlers only
        // Single eligible → auto-resolved
        assert!(matches!(result, CardPlayResult::Complete));
        // Armor modifier should have been applied to prowlers
        let has_armor_mod = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::EnemyStat {
                    stat: mk_types::modifier::EnemyStat::Armor,
                    ..
                }
            )
        });
        assert!(has_armor_mod, "Armor modifier should be applied to prowlers");
    }

    #[test]
    fn ice_shield_powered_all_ice_resistant_skips_targeting() {
        // If all enemies have ice resistance, SelectCombatEnemy fizzles
        let mut state = setup_game(vec!["ice_shield"]);
        give_mana(&mut state, ManaColor::Blue);
        setup_combat_with_enemies(&mut state, &["crystal_sprites", "orc_war_beasts"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.block, 3); // block still applied
        // No armor modifier — all targets were excluded
        let has_armor_mod = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::EnemyStat {
                    stat: mk_types::modifier::EnemyStat::Armor,
                    ..
                }
            )
        });
        assert!(!has_armor_mod, "No armor modifier when all enemies ice-resistant");
    }

    // ---- C. Modifier application tests ----

    #[test]
    fn ambush_basic_move_2_plus_modifier() {
        let mut state = setup_game(vec!["ambush"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        // AttackBlockCardBonus modifier was created
        let has_bonus = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::AttackBlockCardBonus {
                    attack_bonus: 1,
                    block_bonus: 2,
                    ..
                }
            )
        });
        assert!(has_bonus, "Ambush basic should apply AttackBlockCardBonus(1, 2)");
    }

    #[test]
    fn ambush_powered_move_4_plus_enhanced_modifier() {
        let mut state = setup_game(vec!["ambush"]);
        give_mana(&mut state, ManaColor::Green);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        let has_bonus = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::AttackBlockCardBonus {
                    attack_bonus: 2,
                    block_bonus: 4,
                    ..
                }
            )
        });
        assert!(has_bonus, "Ambush powered should apply AttackBlockCardBonus(2, 4)");
    }

    #[test]
    fn burning_shield_basic_fire_block_4_plus_modifier() {
        // Burning Shield: Compound(Fire Block 4, ApplyModifier BurningShieldActive{Attack})
        let mut state = setup_game(vec!["burning_shield"]);
        give_mana(&mut state, ManaColor::Red); // spell cost
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.block, 4);
        assert_eq!(
            state.players[0].combat_accumulator.block_elements.fire, 4
        );
        // BurningShieldActive modifier was applied
        let has_bs = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::BurningShieldActive {
                    mode: mk_types::modifier::BurningShieldMode::Attack,
                    block_value: 4,
                    attack_value: 4,
                }
            )
        });
        assert!(has_bs, "Burning Shield basic should apply BurningShieldActive(Attack)");
    }

    #[test]
    fn burning_shield_powered_destroy_mode_modifier() {
        let mut state = setup_game(vec!["burning_shield"]);
        give_mana(&mut state, ManaColor::Red); // spell cost
        give_mana(&mut state, ManaColor::Red); // powered cost
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.block, 4);
        let has_bs = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::BurningShieldActive {
                    mode: mk_types::modifier::BurningShieldMode::Destroy,
                    ..
                }
            )
        });
        assert!(has_bs, "Burning Shield powered should apply BurningShieldActive(Destroy)");
    }

    // ---- D. Terrain modifier card tests ----

    #[test]
    fn frost_bridge_basic_swamp_cost_modifier() {
        let mut state = setup_game(vec!["frost_bridge"]);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        // Swamp TerrainCost modifier with replace_cost=1
        let has_swamp = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::Specific(Terrain::Swamp),
                    replace_cost: Some(1),
                    ..
                }
            )
        });
        assert!(has_swamp, "Frost Bridge basic should apply swamp cost modifier");
        // No lake modifier in basic
        let has_lake = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::Specific(Terrain::Lake),
                    ..
                }
            )
        });
        assert!(!has_lake, "Frost Bridge basic should NOT apply lake modifier");
    }

    #[test]
    fn frost_bridge_powered_lake_and_swamp_modifiers() {
        let mut state = setup_game(vec!["frost_bridge"]);
        give_mana(&mut state, ManaColor::Blue);
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        let has_lake = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::Specific(Terrain::Lake),
                    replace_cost: Some(1),
                    ..
                }
            )
        });
        let has_swamp = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::Specific(Terrain::Swamp),
                    replace_cost: Some(1),
                    ..
                }
            )
        });
        assert!(has_lake, "Frost Bridge powered should apply lake modifier");
        assert!(has_swamp, "Frost Bridge powered should apply swamp modifier");
    }

    #[test]
    fn mist_form_basic_all_terrain_modifier() {
        let mut state = setup_game(vec!["mist_form"]);
        give_mana(&mut state, ManaColor::Blue); // spell cost
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        let has_all = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All,
                    replace_cost: Some(1),
                    ..
                }
            )
        });
        assert!(has_all, "Mist Form basic should apply all-terrain replace cost");
    }

    #[test]
    fn mist_form_powered_all_terrain_plus_ignore_rampaging() {
        let mut state = setup_game(vec!["mist_form"]);
        give_mana(&mut state, ManaColor::Blue); // spell cost
        give_mana(&mut state, ManaColor::Blue); // powered cost
        let result = play_card(&mut state, 0, 0, true, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].move_points, 4);
        let has_all = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::TerrainCost {
                    terrain: TerrainOrAll::All,
                    replace_cost: Some(1),
                    ..
                }
            )
        });
        let has_ignore = state.active_modifiers.iter().any(|m| {
            matches!(
                &m.effect,
                ModifierEffect::RuleOverride {
                    rule: RuleOverride::IgnoreRampagingProvoke,
                }
            )
        });
        assert!(has_all, "Mist Form powered should apply all-terrain modifier");
        assert!(has_ignore, "Mist Form powered should apply ignore rampaging");
    }

    // ---- E. Crystallize edge cases ----

    #[test]
    fn crystallize_multiple_same_color_auto_resolves() {
        // 3 green tokens → single color available → auto-resolves (no choice)
        let mut state = setup_game(vec!["crystallize"]);
        for _ in 0..3 {
            give_mana(&mut state, ManaColor::Green);
        }
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        assert_eq!(state.players[0].crystals.green, 1);
        assert_eq!(state.players[0].pure_mana.len(), 2); // one consumed
    }

    #[test]
    fn crystallize_only_black_mana_skips() {
        // Black mana is not crystallizable → ConvertManaToCrystal skips
        let mut state = setup_game(vec!["crystallize"]);
        give_mana(&mut state, ManaColor::Black);
        let result = play_card(&mut state, 0, 0, false, None).unwrap();
        assert!(matches!(result, CardPlayResult::Complete));
        // No crystal gained, black token still present
        assert_eq!(state.players[0].crystals.red, 0);
        assert_eq!(state.players[0].crystals.blue, 0);
        assert_eq!(state.players[0].crystals.green, 0);
        assert_eq!(state.players[0].crystals.white, 0);
        assert_eq!(state.players[0].pure_mana.len(), 1);
    }

    // ---- F. Terrain movement integration after card play ----

    #[test]
    fn frost_bridge_powered_makes_lake_passable() {
        use crate::movement::evaluate_move_entry;

        let mut state = setup_game(vec!["frost_bridge"]);
        give_mana(&mut state, ManaColor::Blue);
        play_card(&mut state, 0, 0, true, None).unwrap();

        // Set up a lake hex adjacent to player
        let lake_coord = HexCoord { q: 6, r: 5 };
        state.map.hexes.insert(
            lake_coord.key(),
            HexState {
                coord: lake_coord,
                terrain: Terrain::Lake,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        let result = evaluate_move_entry(&state, 0, lake_coord);
        assert!(
            result.cost.is_some(),
            "Lake should be passable with Frost Bridge powered"
        );
        assert_eq!(result.cost.unwrap(), 1);
    }

    #[test]
    fn frost_bridge_basic_lake_still_impassable() {
        use crate::movement::evaluate_move_entry;

        let mut state = setup_game(vec!["frost_bridge"]);
        play_card(&mut state, 0, 0, false, None).unwrap(); // basic only

        let lake_coord = HexCoord { q: 6, r: 5 };
        state.map.hexes.insert(
            lake_coord.key(),
            HexState {
                coord: lake_coord,
                terrain: Terrain::Lake,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        let result = evaluate_move_entry(&state, 0, lake_coord);
        assert!(
            result.cost.is_none(),
            "Lake should still be impassable with Frost Bridge basic"
        );
    }

    #[test]
    fn mist_form_basic_reduces_forest_to_1() {
        use crate::movement::evaluate_move_entry;

        let mut state = setup_game(vec!["mist_form"]);
        give_mana(&mut state, ManaColor::Blue);
        play_card(&mut state, 0, 0, false, None).unwrap();

        let forest_coord = HexCoord { q: 6, r: 5 };
        state.map.hexes.insert(
            forest_coord.key(),
            HexState {
                coord: forest_coord,
                terrain: Terrain::Forest,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        let result = evaluate_move_entry(&state, 0, forest_coord);
        assert!(result.cost.is_some());
        assert_eq!(result.cost.unwrap(), 1, "Forest should cost 1 with Mist Form");
    }

    #[test]
    fn mist_form_makes_lake_passable() {
        use crate::movement::evaluate_move_entry;

        let mut state = setup_game(vec!["mist_form"]);
        give_mana(&mut state, ManaColor::Blue);
        play_card(&mut state, 0, 0, false, None).unwrap();

        let lake_coord = HexCoord { q: 6, r: 5 };
        state.map.hexes.insert(
            lake_coord.key(),
            HexState {
                coord: lake_coord,
                terrain: Terrain::Lake,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        let result = evaluate_move_entry(&state, 0, lake_coord);
        assert!(
            result.cost.is_some(),
            "Lake should be passable with Mist Form"
        );
        assert_eq!(result.cost.unwrap(), 1);
    }

    #[test]
    fn mist_form_reduces_mountain_to_1() {
        use crate::movement::evaluate_move_entry;

        let mut state = setup_game(vec!["mist_form"]);
        give_mana(&mut state, ManaColor::Blue);
        play_card(&mut state, 0, 0, false, None).unwrap();

        let mtn_coord = HexCoord { q: 6, r: 5 };
        state.map.hexes.insert(
            mtn_coord.key(),
            HexState {
                coord: mtn_coord,
                terrain: Terrain::Mountain,
                tile_id: TileId::Countryside1,
                site: None,
                rampaging_enemies: Default::default(),
                enemies: Default::default(),
                ruins_token: None,
                shield_tokens: Vec::new(),
            },
        );

        let result = evaluate_move_entry(&state, 0, mtn_coord);
        assert!(result.cost.is_some());
        assert_eq!(
            result.cost.unwrap(),
            1,
            "Mountain should cost 1 with Mist Form"
        );
    }

    // ---- E. Sideways bonus consumption tests ----

    fn push_attack_block_bonus(
        state: &mut GameState,
        player_idx: usize,
        attack_bonus: i32,
        block_bonus: i32,
        ranged_siege_attack_bonus: Option<i32>,
    ) {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let pid = state.players[player_idx].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("attack_block_bonus_mod"),
            source: ModifierSource::Card {
                card_id: CardId::from("ambush"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::AttackBlockCardBonus {
                attack_bonus,
                block_bonus,
                ranged_siege_attack_bonus,
            },
            created_at_round: state.round,
            created_by_player_id: pid,
        });
    }

    fn push_movement_bonus(state: &mut GameState, player_idx: usize, amount: i32) {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let pid = state.players[player_idx].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("movement_bonus_mod"),
            source: ModifierSource::Card {
                card_id: CardId::from("path_finding"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::MovementCardBonus {
                amount,
                remaining: None,
            },
            created_at_round: state.round,
            created_by_player_id: pid,
        });
    }

    #[test]
    fn sideways_attack_consumes_attack_block_bonus() {
        let mut state = setup_game(vec!["march"]);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        push_attack_block_bonus(&mut state, 0, 1, 2, None);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Attack).unwrap();

        // Base sideways value 1 + attack_bonus 1 = 2 physical attack
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 2);
        assert_eq!(state.players[0].combat_accumulator.attack.normal_elements.physical, 2);
        // Modifier consumed
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::AttackBlockCardBonus { .. })
        ));
    }

    #[test]
    fn sideways_block_consumes_attack_block_bonus() {
        let mut state = setup_game(vec!["march"]);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        push_attack_block_bonus(&mut state, 0, 1, 2, None);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Block).unwrap();

        // Base sideways value 1 + block_bonus 2 = 3 physical block
        assert_eq!(state.players[0].combat_accumulator.block, 3);
        assert_eq!(state.players[0].combat_accumulator.block_elements.physical, 3);
        // Modifier consumed
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::AttackBlockCardBonus { .. })
        ));
    }

    #[test]
    fn sideways_move_does_not_consume_attack_block_bonus() {
        let mut state = setup_game(vec!["march"]);
        state.round_phase = RoundPhase::PlayerTurns;
        push_attack_block_bonus(&mut state, 0, 1, 2, None);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();

        // Base sideways value 1 (no movement bonus active)
        assert_eq!(state.players[0].move_points, 1);
        // AttackBlockCardBonus NOT consumed (only for attack/block)
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::AttackBlockCardBonus { .. })
        ));
    }

    #[test]
    fn sideways_attack_uses_ranged_siege_bonus_in_ranged_phase() {
        let mut state = setup_game(vec!["march"]);
        setup_combat_with_enemies(&mut state, &["prowlers"]);
        // ranged_siege_attack_bonus=3 vs normal attack_bonus=1
        push_attack_block_bonus(&mut state, 0, 1, 2, Some(3));

        // Combat is in RangedSiege phase by default from setup_combat_with_enemies
        assert_eq!(state.combat.as_ref().unwrap().phase, CombatPhase::RangedSiege);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Attack).unwrap();

        // Base 1 + ranged_siege_attack_bonus 3 = 4
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 4);
    }

    #[test]
    fn sideways_move_consumes_movement_bonus() {
        let mut state = setup_game(vec!["march"]);
        state.round_phase = RoundPhase::PlayerTurns;
        push_movement_bonus(&mut state, 0, 2);

        play_card_sideways(&mut state, 0, 0, SidewaysAs::Move).unwrap();

        // Base 1 + movement_bonus 2 = 3
        assert_eq!(state.players[0].move_points, 3);
        // Modifier consumed
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::MovementCardBonus { .. })
        ));
    }
}
