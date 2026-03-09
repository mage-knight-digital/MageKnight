//! Spell card effect handlers.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::modifier::*;
use mk_types::pending::{
    ActivePending, ChoiceResolution, EffectMode, PendingChoice,
};
use mk_types::state::*;

use super::ResolveResult;
use super::utils::*;
use super::{MAX_CRYSTALS_PER_COLOR, WOUND_CARD_ID};

// =============================================================================
// Spell effect handlers
// =============================================================================

/// Energy Flow: ready a spent unit (any level). If heal=true, also heal if wounded.
pub(super) fn apply_energy_flow(state: &mut GameState, player_idx: usize, heal: bool) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find spent units (all levels)
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.state == UnitState::Spent)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            let unit_idx = eligible[0];
            let unit = &mut state.players[player_idx].units[unit_idx];
            unit.state = UnitState::Ready;
            if heal {
                unit.wounded = false;
            }
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::EnergyFlowTarget {
                    eligible_unit_indices: eligible,
                    heal,
                },
            )
        }
    }
}

/// Mana Bolt: pay 1 mana token → attack based on token color.
/// Blue=Melee Ice base, Red=Melee ColdFire base-1, White=Ranged Ice base-2, Green=Siege Ice base-3.
pub(super) fn apply_mana_bolt(state: &mut GameState, player_idx: usize, base_value: u32) -> ResolveResult {
    if state.combat.is_none() {
        return ResolveResult::Skipped;
    }

    let player = &state.players[player_idx];

    // Collect unique basic colors from tokens
    let mut available_basics: Vec<BasicManaColor> = Vec::new();
    let mut has_gold = false;
    for token in &player.pure_mana {
        match token.color {
            ManaColor::Gold => {
                has_gold = true;
            }
            ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White => {
                if let Some(basic) = to_basic_mana_color(token.color) {
                    if !available_basics.contains(&basic) {
                        available_basics.push(basic);
                    }
                }
            }
            _ => {} // Black: not usable for mana bolt
        }
    }

    // Build options: (token_color, combat_type, element, attack_value)
    let mut options: Vec<CardEffect> = Vec::new();
    let mut token_opts: Vec<(ManaColor, CombatType, AttackElement, u32)> = Vec::new();

    for &basic_color in &available_basics {
        let (ct, elem, value) = mana_bolt_params(basic_color, base_value);
        options.push(CardEffect::GainAttack {
            amount: value,
            combat_type: ct,
            element: attack_element_to_element(elem),
        });
        token_opts.push((ManaColor::from(basic_color), ct, elem, value));
    }

    // Gold: pick best option not already covered by basic tokens
    if has_gold {
        for &basic_color in &ALL_BASIC_MANA_COLORS {
            if available_basics.contains(&basic_color) {
                continue;
            }
            let (ct, elem, value) = mana_bolt_params(basic_color, base_value);
            options.push(CardEffect::GainAttack {
                amount: value,
                combat_type: ct,
                element: attack_element_to_element(elem),
            });
            token_opts.push((ManaColor::Gold, ct, elem, value));
        }
    }

    match options.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-select: consume the token
            let color = token_opts[0].0;
            let player = &mut state.players[player_idx];
            if let Some(idx) = player.pure_mana.iter().position(|t| t.color == color) {
                player.pure_mana.remove(idx);
            }
            ResolveResult::Decomposed(options)
        }
        _ => ResolveResult::NeedsChoiceWith(
            options,
            ChoiceResolution::ManaBoltTokenSelect {
                token_options: token_opts,
            },
        ),
    }
}

/// Get Mana Bolt parameters for a given color.
pub(super) fn mana_bolt_params(color: BasicManaColor, base: u32) -> (CombatType, AttackElement, u32) {
    match color {
        BasicManaColor::Blue => (CombatType::Melee, AttackElement::Ice, base),
        BasicManaColor::Red => (
            CombatType::Melee,
            AttackElement::ColdFire,
            base.saturating_sub(1),
        ),
        BasicManaColor::White => (
            CombatType::Ranged,
            AttackElement::Ice,
            base.saturating_sub(2),
        ),
        BasicManaColor::Green => (
            CombatType::Siege,
            AttackElement::Ice,
            base.saturating_sub(3),
        ),
    }
}

/// Convert AttackElement to Element.
pub(super) fn attack_element_to_element(ae: AttackElement) -> Element {
    match ae {
        AttackElement::Physical => Element::Physical,
        AttackElement::Fire => Element::Fire,
        AttackElement::Ice => Element::Ice,
        AttackElement::ColdFire => Element::ColdFire,
    }
}

/// DiscardForCrystal: discard a non-wound card from hand to gain a crystal of card's color.
pub(super) fn apply_discard_for_crystal(
    state: &mut GameState,
    player_idx: usize,
    optional: bool,
) -> ResolveResult {
    let player = &state.players[player_idx];

    // Find non-wound cards in hand
    let eligible: Vec<CardId> = player
        .hand
        .iter()
        .filter(|c| c.as_str() != WOUND_CARD_ID)
        .cloned()
        .collect();

    if eligible.is_empty() {
        // No eligible cards — skip (whether optional or not, nothing to discard)
        return ResolveResult::Skipped;
    }

    // Build options: one Noop per eligible card, plus skip if optional
    let mut options: Vec<CardEffect> = Vec::new();
    let mut card_ids: Vec<CardId> = Vec::new();

    if optional {
        options.push(CardEffect::Noop); // index 0 = skip
    }

    for cid in &eligible {
        options.push(CardEffect::Noop);
        card_ids.push(cid.clone());
    }

    if options.len() == 1 && !optional {
        // Only one card, auto-select
        let cid = &card_ids[0];
        let player = &mut state.players[player_idx];
        if let Some(idx) = player.hand.iter().position(|c| c == cid) {
            let removed = player.hand.remove(idx);
            player.discard.push(removed);
            player
                .flags
                .insert(PlayerFlags::DISCARDED_CARD_THIS_TURN);
        }
        if let Some(def) = mk_data::cards::get_card(cid.as_str()) {
            if let Some(basic) = def.color.to_basic_mana_color() {
                crate::mana::gain_crystal(&mut state.players[player_idx], basic);
            } else {
                // Colorless artifact — need color choice
                let crystal_options = vec![
                    CardEffect::GainCrystal { color: Some(BasicManaColor::Red) },
                    CardEffect::GainCrystal { color: Some(BasicManaColor::Blue) },
                    CardEffect::GainCrystal { color: Some(BasicManaColor::Green) },
                    CardEffect::GainCrystal { color: Some(BasicManaColor::White) },
                ];
                return ResolveResult::NeedsChoice(crystal_options);
            }
        }
        return ResolveResult::Applied;
    }

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::DiscardForCrystalSelect {
            eligible_card_ids: card_ids,
            optional,
        },
    )
}

/// Sacrifice (Offering powered): choose crystal pair combo → convert to tokens + attack per pair.
pub(super) fn apply_sacrifice(state: &mut GameState, player_idx: usize) -> ResolveResult {
    if state.combat.is_none() {
        // Sacrifice produces attacks — only in combat
        return ResolveResult::Skipped;
    }

    let player = &state.players[player_idx];
    let c = &player.crystals;

    // Build pair options: (color_a, color_b, combat_type, element, attack_per_pair, pair_count)
    let mut pair_options: Vec<(
        BasicManaColor,
        BasicManaColor,
        CombatType,
        AttackElement,
        u32,
        u32,
    )> = Vec::new();

    let pairs = [
        (
            BasicManaColor::Green,
            BasicManaColor::Red,
            CombatType::Siege,
            AttackElement::Fire,
            4u32,
        ),
        (
            BasicManaColor::Green,
            BasicManaColor::Blue,
            CombatType::Siege,
            AttackElement::Ice,
            4,
        ),
        (
            BasicManaColor::White,
            BasicManaColor::Red,
            CombatType::Ranged,
            AttackElement::Fire,
            6,
        ),
        (
            BasicManaColor::White,
            BasicManaColor::Blue,
            CombatType::Ranged,
            AttackElement::Ice,
            6,
        ),
    ];

    for &(a, b, ct, elem, atk) in &pairs {
        let count_a = crystal_count(c, a);
        let count_b = crystal_count(c, b);
        let pair_count = count_a.min(count_b) as u32;
        if pair_count > 0 {
            pair_options.push((a, b, ct, elem, atk, pair_count));
        }
    }

    if pair_options.is_empty() {
        return ResolveResult::Skipped;
    }

    // Build choice options — one per valid pair type
    let options: Vec<CardEffect> = pair_options
        .iter()
        .map(|&(_, _, ct, elem, atk, count)| CardEffect::GainAttack {
            amount: atk * count,
            combat_type: ct,
            element: attack_element_to_element(elem),
        })
        .collect();

    if options.len() == 1 {
        // Auto-select: convert crystals + apply attack
        let (a, b, _ct, _elem, _atk, count) = pair_options[0];
        execute_sacrifice_pair(state, player_idx, a, b, count);
        ResolveResult::Decomposed(options)
    } else {
        ResolveResult::NeedsChoiceWith(
            options,
            ChoiceResolution::SacrificePairSelect { pair_options },
        )
    }
}

/// Execute a Sacrifice pair: convert crystals to tokens.
pub(super) fn execute_sacrifice_pair(
    state: &mut GameState,
    player_idx: usize,
    color_a: BasicManaColor,
    color_b: BasicManaColor,
    pair_count: u32,
) {
    let player = &mut state.players[player_idx];
    for _ in 0..pair_count {
        // Remove crystals
        decrement_crystal(&mut player.crystals, color_a);
        decrement_crystal(&mut player.crystals, color_b);
        // Add mana tokens
        player.pure_mana.push(ManaToken {
            color: ManaColor::from(color_a),
            source: ManaTokenSource::Crystal,
            cannot_power_spells: false,
        });
        player.pure_mana.push(ManaToken {
            color: ManaColor::from(color_b),
            source: ManaTokenSource::Crystal,
            cannot_power_spells: false,
        });
    }
}

/// Mana Claim: select an unclaimed basic-color die from the source.
pub(super) fn apply_mana_claim(state: &mut GameState, player_idx: usize, with_curse: bool) -> ResolveResult {
    // Find unclaimed basic-color dice
    let mut die_ids: Vec<mk_types::ids::SourceDieId> = Vec::new();
    let mut die_colors: Vec<BasicManaColor> = Vec::new();

    for die in &state.source.dice {
        if die.taken_by_player_id.is_none()
            && !die.is_depleted
            && matches!(
                die.color,
                ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White
            )
        {
            if let Some(basic) = to_basic_mana_color(die.color) {
                die_ids.push(die.id.clone());
                die_colors.push(basic);
            }
        }
    }

    match die_ids.len() {
        0 => ResolveResult::Skipped,
        1 => {
            // Auto-select die → go to mode choice
            let die_id = die_ids[0].clone();
            let color = die_colors[0];
            setup_mana_claim_mode_choice(state, player_idx, die_id, color, with_curse);
            ResolveResult::PendingSet
        }
        _ => {
            let options: Vec<CardEffect> = die_ids.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::ManaClaimDieSelect {
                    with_curse,
                    die_ids,
                    die_colors,
                },
            )
        }
    }
}

/// Set up the Mana Claim mode choice (burst vs sustained) as a pending choice.
pub(super) fn setup_mana_claim_mode_choice(
    state: &mut GameState,
    player_idx: usize,
    die_id: mk_types::ids::SourceDieId,
    color: BasicManaColor,
    with_curse: bool,
) {
    // Option 0: Burst (3 tokens)
    // Option 1: Sustained (1 token/turn)
    let options = vec![CardEffect::Noop, CardEffect::Noop];
    state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
        card_id: None,
        skill_id: None,
        unit_instance_id: None,
        options,
        continuation: Vec::new(),
        movement_bonus_applied: false,
        resolution: ChoiceResolution::ManaClaimModeSelect {
            die_id,
            color,
            with_curse,
        },
    }));
}

/// Execute Mana Claim mode choice.
/// Index 0 = Burst (3 tokens), Index 1 = Sustained (1 token/turn modifier).
pub(super) fn execute_mana_claim_mode(
    state: &mut GameState,
    player_idx: usize,
    die_id: &mk_types::ids::SourceDieId,
    color: BasicManaColor,
    with_curse: bool,
    choice_index: usize,
) {
    let player_id = state.players[player_idx].id.clone();

    // Mark die as claimed
    if let Some(die) = state.source.dice.iter_mut().find(|d| &d.id == die_id) {
        die.taken_by_player_id = Some(player_id.clone());
    }

    match choice_index {
        0 => {
            // Burst: gain 3 mana tokens of the die's color
            let mana_color = ManaColor::from(color);
            let player = &mut state.players[player_idx];
            for _ in 0..3 {
                player.pure_mana.push(ManaToken {
                    color: mana_color,
                    source: ManaTokenSource::Die,
                    cannot_power_spells: false,
                });
            }
        }
        1 => {
            // Sustained: add modifier that grants 1 token per turn
            let modifier = ActiveModifier {
                id: ModifierId::from(
                    format!("mana_claim_sustained_{}", die_id.as_str()).as_str(),
                ),
                effect: ModifierEffect::ManaClaimSustained {
                    color,
                    claimed_die_id: die_id.clone(),
                },
                source: ModifierSource::Card {
                    card_id: CardId::from("mana_claim"),
                    player_id: player_id.clone(),
                },
                duration: ModifierDuration::Round,
                scope: ModifierScope::SelfScope,
                created_at_round: state.round,
                created_by_player_id: player_id.clone(),
            };
            state.active_modifiers.push(modifier);

            // Also grant 1 immediate token (sustained starts producing this turn)
            let mana_color = ManaColor::from(color);
            state.players[player_idx].pure_mana.push(ManaToken {
                color: mana_color,
                source: ManaTokenSource::Die,
                cannot_power_spells: false,
            });
        }
        _ => {} // Invalid index, ignore
    }

    // with_curse: In solo mode, the curse part is a no-op (no other players).
    // In multiplayer it would apply ManaCurse modifiers to other players.
    let _ = with_curse;
}

// =============================================================================
// Cure / Disease resolvers
// =============================================================================

/// Cure: remove up to `amount` wounds from hand, draw 1 card per wound removed.
pub(super) fn resolve_cure(state: &mut GameState, player_idx: usize, amount: u32) -> ResolveResult {
    let player = &mut state.players[player_idx];

    // Remove wounds from hand (up to amount)
    let mut wounds_removed = 0u32;
    let mut i = 0;
    while i < player.hand.len() && wounds_removed < amount {
        if player.hand[i].as_str() == WOUND_CARD_ID {
            player.hand.remove(i);
            wounds_removed += 1;
        } else {
            i += 1;
        }
    }

    if wounds_removed == 0 {
        return ResolveResult::Skipped;
    }

    // Draw 1 card per wound healed
    let actual_draw = (wounds_removed as usize).min(player.deck.len());
    let drawn: Vec<CardId> = player.deck.drain(..actual_draw).collect();
    player.hand.extend(drawn);

    ResolveResult::Applied
}

/// Disease: for each fully-blocked enemy, set armor to 1 for rest of combat.
pub(super) fn resolve_disease(state: &mut GameState, player_idx: usize) -> ResolveResult {
    use mk_types::modifier::{
        ActiveModifier, EnemyStat as ModEnemyStat, ModifierDuration, ModifierEffect,
        ModifierScope, ModifierSource,
    };
    use mk_types::ids::ModifierId;

    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    let player_id = state.players[player_idx].id.clone();

    // Find all enemies where ALL attacks are blocked (is_blocked = true)
    let blocked_enemy_ids: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| !e.is_defeated && !e.is_summoner_hidden && e.is_blocked)
        .map(|e| e.instance_id.as_str().to_string())
        .collect();

    if blocked_enemy_ids.is_empty() {
        return ResolveResult::Skipped;
    }

    // For each blocked enemy, push a modifier that sets armor to minimum 0 with a
    // large negative change (effectively reducing to 1).
    // We model this as EnemyStat Armor with a very large negative amount and minimum 1.
    for enemy_id in &blocked_enemy_ids {
        let modifier_count = state.active_modifiers.len();
        let modifier_id = format!(
            "mod_{}_r{}_t{}",
            modifier_count, state.round, state.current_player_index
        );
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from(modifier_id.as_str()),
            source: ModifierSource::Card {
                card_id: CardId::from("cure"),
                player_id: player_id.clone(),
            },
            duration: ModifierDuration::Combat,
            scope: ModifierScope::OneEnemy {
                enemy_id: enemy_id.clone(),
            },
            effect: ModifierEffect::EnemyStat {
                stat: ModEnemyStat::Armor,
                amount: -100, // large enough to reduce any armor to minimum
                minimum: 1,
                attack_index: None,
                per_resistance: false,
                fortified_amount: None,
                exclude_resistance: None,
            },
            created_at_round: state.round,
            created_by_player_id: player_id.clone(),
        });
    }

    ResolveResult::Applied
}

// =============================================================================
// SelectCombatEnemy resolver (card-sourced)
// =============================================================================

/// Resolve a SelectCombatEnemy effect from a card.
/// Filters eligible enemies, auto-resolves if 0 or 1, or signals pending if N.
pub(super) fn resolve_select_combat_enemy(
    state: &mut GameState,
    player_idx: usize,
    template: &mk_types::pending::SelectEnemyTemplate,
) -> ResolveResult {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    // Filter eligible enemies (same logic as unit-ability version in action_pipeline)
    let mut eligible_ids: Vec<String> = Vec::new();
    for enemy in &combat.enemies {
        if enemy.is_defeated || enemy.is_summoner_hidden {
            continue;
        }

        let def = match mk_data::enemies::get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        // Apply template filters
        if template.exclude_fortified
            && crate::combat_resolution::is_effectively_fortified(
                def,
                enemy.instance_id.as_str(),
                combat.is_at_fortified_site,
                &state.active_modifiers,
            )
        {
            continue;
        }

        if template.exclude_arcane_immune
            && crate::combat_resolution::has_ability(def, EnemyAbilityType::ArcaneImmunity)
        {
            continue;
        }

        if let Some(resist) = template.exclude_resistance {
            if def.resistances.contains(&resist) {
                continue;
            }
        }

        eligible_ids.push(enemy.instance_id.as_str().to_string());
    }

    match eligible_ids.len() {
        0 => {
            // No eligible enemies — effect fizzles
            ResolveResult::Skipped
        }
        1 => {
            // Auto-resolve with the single eligible enemy
            let uid: Option<mk_types::ids::UnitInstanceId> = None;
            if crate::action_pipeline::apply_select_enemy_effects_pub(
                state, player_idx, &uid, &eligible_ids[0], template,
            ).is_err() {
                return ResolveResult::Skipped;
            }
            ResolveResult::Applied
        }
        _ => {
            // Multiple eligible — need player to choose
            ResolveResult::NeedsSelectCombatEnemy {
                eligible_enemy_ids: eligible_ids,
                template: *template,
            }
        }
    }
}

// =============================================================================
// Spell resolvers (Batch 3)
// =============================================================================

/// Mana Meltdown basic (solo): no opponents → skip.
/// Mana Radiance powered (solo): choose color → take wounds = crystals of that color → gain 2 crystals.
pub(super) fn apply_mana_meltdown(
    state: &mut GameState,
    player_idx: usize,
    powered: bool,
) -> ResolveResult {
    if !powered {
        // Basic (Mana Meltdown): steal 1 crystal of each color from each opponent
        if state.players.len() <= 1 {
            return ResolveResult::Skipped;
        }
        let mut gained = Crystals::default();
        // Collect opponent indices (avoid borrowing state.players mutably during iteration)
        let opponent_indices: Vec<usize> = (0..state.players.len())
            .filter(|&i| i != player_idx)
            .collect();
        for &opp_idx in &opponent_indices {
            let opp = &mut state.players[opp_idx];
            for color in [BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White] {
                let opp_slot = match color {
                    BasicManaColor::Red => &mut opp.crystals.red,
                    BasicManaColor::Blue => &mut opp.crystals.blue,
                    BasicManaColor::Green => &mut opp.crystals.green,
                    BasicManaColor::White => &mut opp.crystals.white,
                };
                if *opp_slot > 0 {
                    *opp_slot -= 1;
                    let gained_slot = match color {
                        BasicManaColor::Red => &mut gained.red,
                        BasicManaColor::Blue => &mut gained.blue,
                        BasicManaColor::Green => &mut gained.green,
                        BasicManaColor::White => &mut gained.white,
                    };
                    *gained_slot += 1;
                }
            }
        }
        // Caster gains the stolen crystals (capped)
        let caster = &mut state.players[player_idx];
        for color in [BasicManaColor::Red, BasicManaColor::Blue, BasicManaColor::Green, BasicManaColor::White] {
            let amount = match color {
                BasicManaColor::Red => gained.red,
                BasicManaColor::Blue => gained.blue,
                BasicManaColor::Green => gained.green,
                BasicManaColor::White => gained.white,
            };
            let slot = match color {
                BasicManaColor::Red => &mut caster.crystals.red,
                BasicManaColor::Blue => &mut caster.crystals.blue,
                BasicManaColor::Green => &mut caster.crystals.green,
                BasicManaColor::White => &mut caster.crystals.white,
            };
            for _ in 0..amount {
                if *slot < MAX_CRYSTALS_PER_COLOR {
                    *slot += 1;
                }
            }
        }
        let any_gained = gained.red > 0 || gained.blue > 0 || gained.green > 0 || gained.white > 0;
        return if any_gained { ResolveResult::Applied } else { ResolveResult::Skipped };
    }
    // Powered (Mana Radiance): choose crystal color
    let player = &state.players[player_idx];
    let mut available_colors = Vec::new();
    if player.crystals.red > 0 {
        available_colors.push(BasicManaColor::Red);
    }
    if player.crystals.blue > 0 {
        available_colors.push(BasicManaColor::Blue);
    }
    if player.crystals.green > 0 {
        available_colors.push(BasicManaColor::Green);
    }
    if player.crystals.white > 0 {
        available_colors.push(BasicManaColor::White);
    }
    match available_colors.len() {
        0 => ResolveResult::Skipped,
        1 => {
            resolve_mana_radiance(state, player_idx, available_colors[0]);
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = available_colors.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::ManaMeltdownColorSelect { available_colors },
            )
        }
    }
}

/// Execute Mana Radiance: take wounds = crystals of chosen color, gain 2 crystals of that color.
pub(super) fn resolve_mana_radiance(state: &mut GameState, player_idx: usize, color: BasicManaColor) {
    let player = &mut state.players[player_idx];
    let crystal_count = match color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    // Take wounds = number of crystals of that color
    for _ in 0..crystal_count {
        player.hand.push(CardId::from(WOUND_CARD_ID));
    }
    // Gain 2 crystals of chosen color (capped at max)
    let slot = match color {
        BasicManaColor::Red => &mut state.players[player_idx].crystals.red,
        BasicManaColor::Blue => &mut state.players[player_idx].crystals.blue,
        BasicManaColor::Green => &mut state.players[player_idx].crystals.green,
        BasicManaColor::White => &mut state.players[player_idx].crystals.white,
    };
    for _ in 0..2 {
        if *slot < MAX_CRYSTALS_PER_COLOR {
            *slot += 1;
        }
    }
}

/// Mind Read basic/powered: choose color → gain crystal.
///
/// In multiplayer, the basic reveals opponents' hands (informational) and powered
/// forces each opponent to discard a non-wound. For RL training, the crystal gain
/// is the meaningful mechanical effect; hand reveals/forced discard are simplified
/// to just the crystal gain in the current implementation.
pub(super) fn apply_mind_read(
    state: &mut GameState,
    player_idx: usize,
    _powered: bool,
) -> ResolveResult {
    // Both basic and powered: gain a crystal of chosen color
    let player = &state.players[player_idx];
    let mut eligible = Vec::new();
    if player.crystals.red < MAX_CRYSTALS_PER_COLOR {
        eligible.push(BasicManaColor::Red);
    }
    if player.crystals.blue < MAX_CRYSTALS_PER_COLOR {
        eligible.push(BasicManaColor::Blue);
    }
    if player.crystals.green < MAX_CRYSTALS_PER_COLOR {
        eligible.push(BasicManaColor::Green);
    }
    if player.crystals.white < MAX_CRYSTALS_PER_COLOR {
        eligible.push(BasicManaColor::White);
    }
    match eligible.len() {
        0 => ResolveResult::Skipped,
        1 => {
            apply_gain_crystal_color(state, player_idx, eligible[0]);
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = eligible.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(options, ChoiceResolution::MindReadColorSelect)
        }
    }
}

/// Call to Arms basic: borrow unit ability from offer (or opponent units in multiplayer).
pub(super) fn apply_call_to_arms(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Find eligible units in offer (exclude Magic Familiars, need activatable abilities)
    let mut eligible_indices = Vec::new();
    for (i, unit_id) in state.offers.units.iter().enumerate() {
        if let Some(unit_def) = mk_data::units::get_unit(unit_id.as_str()) {
            if unit_def.restricted_from_free_recruit {
                continue; // Skip Magic Familiars
            }
            // Check if unit has at least one activatable ability (free slot)
            let has_ability = unit_def.abilities.iter().any(|slot| {
                slot.mana_cost.is_none()
            });
            if has_ability {
                eligible_indices.push(i);
            }
        }
    }

    // In multiplayer: also scan opponent units for borrowable abilities
    // Opponent unit indices are encoded as offer_size + flat_index to distinguish them
    let offer_size = state.offers.units.len();
    let mut opponent_unit_indices = Vec::new();
    for (p_idx, player) in state.players.iter().enumerate() {
        if p_idx == player_idx {
            continue;
        }
        for (u_idx, unit) in player.units.iter().enumerate() {
            if let Some(unit_def) = mk_data::units::get_unit(unit.unit_id.as_str()) {
                let has_ability = unit_def.abilities.iter().any(|slot| slot.mana_cost.is_none());
                if has_ability {
                    // Encode as offset index: offer_size + sequential index
                    opponent_unit_indices.push((p_idx, u_idx, offer_size + opponent_unit_indices.len()));
                }
            }
        }
    }

    // For now, only use offer indices in the choice resolution (opponent units would
    // need a new ChoiceResolution variant). Extend eligible_indices to include offer units.
    // Opponent unit borrowing is informational for RL — skip complex resolution for now.
    let _ = opponent_unit_indices;

    match eligible_indices.len() {
        0 => ResolveResult::Skipped,
        _ => {
            let options: Vec<CardEffect> = eligible_indices.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::CallToArmsUnitSelect {
                    eligible_unit_indices: eligible_indices,
                },
            )
        }
    }
}

/// Free Recruit (Call to Arms powered): recruit any unit from offer for free.
pub(super) fn apply_free_recruit(state: &mut GameState, player_idx: usize) -> ResolveResult {
    // Find eligible units (exclude restricted_from_free_recruit, check command limit)
    let player = &state.players[player_idx];
    let command_slots = player.command_tokens;
    let used_slots = player.units.len() as u32;
    let has_room = used_slots < command_slots;

    let mut eligible_indices = Vec::new();
    for (i, unit_id) in state.offers.units.iter().enumerate() {
        if let Some(unit_def) = mk_data::units::get_unit(unit_id.as_str()) {
            if unit_def.restricted_from_free_recruit {
                continue;
            }
            // For now, require room (skip disband logic for solo RL simplicity)
            if has_room {
                eligible_indices.push(i);
            }
        }
    }
    match eligible_indices.len() {
        0 => ResolveResult::Skipped,
        1 => {
            execute_free_recruit(state, player_idx, eligible_indices[0]);
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> = eligible_indices.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::FreeRecruitTarget {
                    eligible_unit_indices: eligible_indices,
                },
            )
        }
    }
}

/// Execute free recruit: add unit to player, remove from offer, replenish.
pub(super) fn execute_free_recruit(state: &mut GameState, player_idx: usize, offer_index: usize) {
    let unit_id = state.offers.units.remove(offer_index);
    let unit_def = mk_data::units::get_unit(unit_id.as_str());
    let instance_id = mk_types::ids::UnitInstanceId::from(
        format!("unit_{}", state.next_instance_counter).as_str(),
    );
    state.next_instance_counter += 1;
    state.players[player_idx].units.push(mk_types::state::PlayerUnit {
        unit_id: unit_id.clone(),
        instance_id,
        level: unit_def.map_or(1, |d| d.level),
        state: UnitState::Ready,
        wounded: false,
        used_resistance_this_combat: false,
        used_ability_indices: Vec::new(),
        mana_token: None,
    });
    state.players[player_idx]
        .flags
        .insert(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN);
    // Replenish offer from unit deck
    if let Some(next_unit) = state.decks.unit_deck.pop() {
        state.offers.units.push(next_unit);
    }
}

/// Wings of Night: iterative enemy targeting (skip attack for scaling move cost).
pub(super) fn apply_wings_of_night(state: &mut GameState, player_idx: usize) -> ResolveResult {
    resolve_wings_of_night_step(state, player_idx, 0)
}

/// Wings of Night step: find eligible enemies, present choice with "Done" option.
pub(super) fn resolve_wings_of_night_step(
    state: &mut GameState,
    player_idx: usize,
    targets_so_far: u32,
) -> ResolveResult {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    // Move cost for the next target: 0, 1, 2, 3, ...
    let move_cost = targets_so_far;
    let player = &state.players[player_idx];
    if targets_so_far > 0 && player.move_points < move_cost {
        return ResolveResult::Applied; // Can't afford more targets
    }

    // Find eligible enemies: not arcane immune, not already targeted by Wings of Night
    let already_targeted: Vec<String> = state
        .active_modifiers
        .iter()
        .filter(|m| {
            matches!(&m.effect, ModifierEffect::EnemySkipAttack)
                && matches!(&m.source, ModifierSource::Card { card_id, .. } if card_id.as_str() == "wings_of_wind")
        })
        .filter_map(|m| {
            if let ModifierScope::OneEnemy { enemy_id } = &m.scope {
                Some(enemy_id.clone())
            } else {
                None
            }
        })
        .collect();

    let eligible_enemy_ids: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !is_enemy_arcane_immune_by_id(e.enemy_id.as_str())
                && !already_targeted.contains(&e.instance_id.to_string())
        })
        .map(|e| e.instance_id.to_string())
        .collect();

    if eligible_enemy_ids.is_empty() {
        return ResolveResult::Applied; // No more valid targets
    }

    // Build options: "Done" (if targets_so_far > 0) + one per eligible enemy
    let mut options = Vec::new();
    if targets_so_far > 0 {
        options.push(CardEffect::Noop); // "Done"
    }
    for _ in &eligible_enemy_ids {
        options.push(CardEffect::Noop);
    }

    ResolveResult::NeedsChoiceWith(
        options,
        ChoiceResolution::WingsOfNightTarget {
            eligible_enemy_ids,
            targets_so_far,
        },
    )
}

/// Possess Enemy: target enemy → skip attack + gain melee attack equal to enemy's attack.
pub(super) fn apply_possess_enemy(state: &mut GameState, player_idx: usize) -> ResolveResult {
    let combat = match state.combat.as_ref() {
        Some(c) => c,
        None => return ResolveResult::Skipped,
    };

    let eligible_enemy_ids: Vec<String> = combat
        .enemies
        .iter()
        .filter(|e| {
            !e.is_defeated
                && !is_enemy_arcane_immune_by_id(e.enemy_id.as_str())
        })
        .map(|e| e.instance_id.to_string())
        .collect();

    match eligible_enemy_ids.len() {
        0 => ResolveResult::Skipped,
        1 => {
            execute_possess_enemy(state, player_idx, &eligible_enemy_ids[0]);
            ResolveResult::Applied
        }
        _ => {
            let options: Vec<CardEffect> =
                eligible_enemy_ids.iter().map(|_| CardEffect::Noop).collect();
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::PossessEnemyTarget { eligible_enemy_ids },
            )
        }
    }
}

/// Execute possess: skip attack + gain melee attack = enemy attack + restrict.
pub(super) fn execute_possess_enemy(state: &mut GameState, player_idx: usize, enemy_id: &str) {
    let player_id = state.players[player_idx].id.clone();

    // Find enemy and get its attack value + element from enemy definition
    let (attack_amount, attack_element) = if let Some(combat) = state.combat.as_ref() {
        if let Some(enemy) = combat.enemies.iter().find(|e| e.instance_id.as_str() == enemy_id) {
            if let Some(def) = mk_data::enemies::get_enemy(enemy.enemy_id.as_str()) {
                (def.attack, def.attack_element)
            } else {
                (0, Element::Physical)
            }
        } else {
            (0, Element::Physical)
        }
    } else {
        (0, Element::Physical)
    };

    // Apply skip attack modifier
    let mod_id = mk_types::ids::ModifierId::from(
        format!("possess_skip_{}", enemy_id).as_str(),
    );
    state.active_modifiers.push(ActiveModifier {
        id: mod_id,
        source: ModifierSource::Card {
            card_id: CardId::from("charm"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::OneEnemy {
            enemy_id: enemy_id.to_string(),
        },
        effect: ModifierEffect::EnemySkipAttack,
        created_at_round: state.round,
        created_by_player_id: player_id.clone(),
    });

    // Grant melee attack + restrict attack on possessed enemy
    let mod_id2 = mk_types::ids::ModifierId::from(
        format!("possess_attack_{}", enemy_id).as_str(),
    );
    state.active_modifiers.push(ActiveModifier {
        id: mod_id2,
        source: ModifierSource::Card {
            card_id: CardId::from("charm"),
            player_id: player_id.clone(),
        },
        duration: ModifierDuration::Combat,
        scope: ModifierScope::SelfScope,
        effect: ModifierEffect::PossessAttackRestriction {
            possessed_enemy_id: enemy_id.to_string(),
            attack_amount,
        },
        created_at_round: state.round,
        created_by_player_id: player_id.clone(),
    });

    // Add the actual melee attack to player's combat accumulator
    let acc = &mut state.players[player_idx].combat_accumulator.attack;
    acc.normal += attack_amount;
    add_to_elemental(&mut acc.normal_elements, attack_element, attack_amount);
}

/// Meditation: set pending meditation state.
pub(super) fn apply_meditation(
    state: &mut GameState,
    player_idx: usize,
    powered: bool,
) -> ResolveResult {
    use mk_types::pending::{MeditationPhase, PendingMeditation};

    let player = &mut state.players[player_idx];
    let discard = &player.discard;

    if discard.is_empty() {
        return ResolveResult::Skipped;
    }

    let version = if powered {
        EffectMode::Powered
    } else {
        EffectMode::Basic
    };

    if powered {
        // Powered (Trance): player chooses 2 cards from discard
        player.pending.active = Some(ActivePending::Meditation(PendingMeditation {
            version,
            phase: MeditationPhase::SelectCards,
            selected_card_ids: Vec::new(),
        }));
    } else {
        // Basic: randomly pick 2 cards from discard
        let discard_len = player.discard.len();
        let max_picks = std::cmp::min(2, discard_len);
        let mut selected = Vec::new();

        // Use RNG to pick random cards
        for _ in 0..max_picks {
            let remaining = player.discard.len() - selected.len();
            if remaining == 0 {
                break;
            }
            let idx = match state.rng.random_index(remaining) {
                Some(i) => i,
                None => break,
            };
            // Find the idx-th non-selected card
            let mut count = 0;
            for (i, _card_id) in player.discard.iter().enumerate() {
                if !selected.contains(&i) {
                    if count == idx {
                        selected.push(i);
                        break;
                    }
                    count += 1;
                }
            }
        }

        // We need to re-borrow player after rng mutation
        let player = &mut state.players[player_idx];
        let selected_card_ids: Vec<CardId> = selected
            .iter()
            .map(|&i| player.discard[i].clone())
            .collect();

        player.pending.active = Some(ActivePending::Meditation(PendingMeditation {
            version,
            phase: MeditationPhase::PlaceCards,
            selected_card_ids,
        }));
    }

    ResolveResult::PendingSet
}

/// Ready Units Budget: iteratively ready spent units up to total_levels.
pub(super) fn apply_ready_units_budget(
    state: &mut GameState,
    player_idx: usize,
    total_levels: u32,
) -> ResolveResult {
    resolve_ready_units_budget_step(state, player_idx, total_levels)
}

/// Ready Units Budget step: find eligible spent units within remaining budget.
pub(super) fn resolve_ready_units_budget_step(
    state: &mut GameState,
    player_idx: usize,
    remaining_levels: u32,
) -> ResolveResult {
    let player = &state.players[player_idx];
    let eligible: Vec<usize> = player
        .units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.state == UnitState::Spent && (u.level as u32) <= remaining_levels)
        .map(|(i, _)| i)
        .collect();

    match eligible.len() {
        0 => ResolveResult::Applied, // No more eligible units
        1 => {
            // Auto-ready the only option
            let unit_level = state.players[player_idx].units[eligible[0]].level as u32;
            state.players[player_idx].units[eligible[0]].state = UnitState::Ready;
            let new_remaining = remaining_levels - unit_level;
            if new_remaining > 0 {
                // Check for more eligible units
                resolve_ready_units_budget_step(state, player_idx, new_remaining)
            } else {
                ResolveResult::Applied
            }
        }
        _ => {
            // Present choice: "Done" + one per eligible unit
            let mut options = vec![CardEffect::Noop]; // "Done"
            for _ in &eligible {
                options.push(CardEffect::Noop);
            }
            ResolveResult::NeedsChoiceWith(
                options,
                ChoiceResolution::ReadyUnitsBudgetSelect {
                    eligible_unit_indices: eligible,
                    remaining_levels,
                },
            )
        }
    }
}
