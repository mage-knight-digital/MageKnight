//! State filtering — convert `GameState` to `ClientGameState`.
//!
//! Hides private information (other players' hands, deck contents, unrevealed
//! enemies/tiles) and hydrates combat enemy definitions from `mk-data`.

use mk_data::enemies::get_enemy;
use mk_types::client_state::*;
use mk_types::enums::*;
use mk_types::ids::{PlayerId, TacticId};
use mk_types::pending::{ActivePending, ChoiceResolution};
use mk_types::state::*;

/// Convert full game state to a client-visible view for a specific player.
///
/// The `for_player_id` determines which player sees full hand cards vs counts.
pub fn to_client_state(state: &GameState, for_player_id: &PlayerId) -> ClientGameState {
    let current_player_id = resolve_current_player_id(state);

    ClientGameState {
        phase: state.phase,
        round_phase: state.round_phase,
        time_of_day: state.time_of_day,
        round: state.round,
        current_player_id,
        turn_order: state.turn_order.clone(),
        end_of_round_announced_by: state.end_of_round_announced_by.clone(),

        players: state
            .players
            .iter()
            .map(|p| to_client_player(p, p.id == *for_player_id, state))
            .collect(),

        map: to_client_map(&state.map),
        source: to_client_source(&state.source, &state.players),
        offers: to_client_offers(&state.offers),
        deck_counts: to_client_deck_counts(&state.decks),
        combat: state.combat.as_ref().map(|c| to_client_combat(c, state)),

        wound_pile_count: state.wound_pile_count,
        scenario_end_triggered: state.scenario_end_triggered,
        game_ended: state.game_ended,
        total_rounds: state.scenario_config.total_rounds,
        dummy_player: state.dummy_player.as_ref().map(|d| to_client_dummy(d, &state.dummy_player_tactic)),
    }
}

// =============================================================================
// Current player resolution
// =============================================================================

fn resolve_current_player_id(state: &GameState) -> PlayerId {
    match state.round_phase {
        RoundPhase::TacticsSelection => state
            .current_tactic_selector
            .clone()
            .unwrap_or_else(|| PlayerId::from("")),
        RoundPhase::PlayerTurns => {
            let idx = state.current_player_index as usize;
            state
                .turn_order
                .get(idx)
                .cloned()
                .unwrap_or_else(|| PlayerId::from(""))
        }
    }
}

// =============================================================================
// Player filtering
// =============================================================================

fn to_client_player(player: &PlayerState, is_self: bool, state: &GameState) -> ClientPlayer {
    let hand_count = player.hand.len();
    let hand = if is_self {
        player.hand.clone()
    } else {
        Vec::new()
    };

    ClientPlayer {
        id: player.id.clone(),
        hero: player.hero,
        position: player.position,

        fame: player.fame,
        level: player.level,
        reputation: player.reputation,
        armor: player.armor,
        hand_limit: player.hand_limit,
        command_tokens: player.command_tokens,

        hand,
        hand_count,
        deck_count: player.deck.len(),
        discard_count: player.discard.len(),
        play_area: player.play_area.clone(),

        units: player
            .units
            .iter()
            .map(|u| ClientPlayerUnit {
                instance_id: u.instance_id.clone(),
                unit_id: u.unit_id.clone(),
                level: u.level,
                state: u.state,
                wounded: u.wounded,
            })
            .collect(),
        attached_banners: player.attached_banners.to_vec(),

        skills: player.skills.clone(),

        crystals: player.crystals,
        mana_tokens: player
            .pure_mana
            .iter()
            .map(|t| ClientManaToken { color: t.color })
            .collect(),
        kept_enemy_tokens: player.kept_enemy_tokens.to_vec(),

        move_points: player.move_points,
        influence_points: player.influence_points,
        healing_points: player.healing_points,

        combat_accumulator: ClientCombatAccumulator {
            attack: player.combat_accumulator.attack,
            block: player.combat_accumulator.block,
            block_elements: player.combat_accumulator.block_elements,
        },

        selected_tactic: player.selected_tactic.clone(),
        tactic_flipped: player.flags.contains(PlayerFlags::TACTIC_FLIPPED),
        stolen_mana_die: player.tactic_state.stored_mana_die.as_ref().map(|d| {
            ClientStolenDie {
                die_id: d.die_id.clone(),
                color: d.color,
            }
        }),

        has_moved_this_turn: player.flags.contains(PlayerFlags::HAS_MOVED_THIS_TURN),
        has_taken_action_this_turn: player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN),
        has_combatted_this_turn: player
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN),
        used_mana_from_source: player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE),
        played_card_from_hand_this_turn: player
            .flags
            .contains(PlayerFlags::PLAYED_CARD_FROM_HAND_THIS_TURN),
        is_resting: player.flags.contains(PlayerFlags::IS_RESTING),
        knocked_out: player.flags.contains(PlayerFlags::KNOCKED_OUT),

        pending: player
            .pending
            .active
            .as_ref()
            .map(|active| to_client_pending(active, player, state)),
    }
}

// =============================================================================
// Pending state description
// =============================================================================

fn to_client_pending(
    active: &ActivePending,
    player: &PlayerState,
    state: &GameState,
) -> ClientPendingInfo {
    let kind = pending_kind(active).to_string();
    let label = pending_label(active).to_string();
    let options = pending_options(active, player, state);
    let selected = match active {
        ActivePending::SubsetSelection(ss) => ss.selected.clone(),
        _ => Vec::new(),
    };
    let level_up_data = match active {
        ActivePending::LevelUpReward(reward) => Some(ClientLevelUpData {
            level: reward.level,
            drawn_skills: reward.drawn_skills.to_vec(),
            common_pool_skills: state.offers.common_skills.clone(),
        }),
        _ => None,
    };
    ClientPendingInfo {
        kind,
        label,
        options,
        selected,
        level_up_data,
    }
}

fn pending_kind(active: &ActivePending) -> &'static str {
    match active {
        ActivePending::Choice(_) => "choice",
        ActivePending::Discard(_) => "discard",
        ActivePending::DiscardForBonus(_) => "discard_for_bonus",
        ActivePending::DiscardForCrystal(_) => "discard_for_crystal",
        ActivePending::Decompose(_) => "decompose",
        ActivePending::MaximalEffect(_) => "maximal_effect",
        ActivePending::BookOfWisdom(_) => "book_of_wisdom",
        ActivePending::Training(_) => "training",
        ActivePending::TacticDecision(_) => "tactic_decision",
        ActivePending::LevelUpReward(_) => "level_up_reward",
        ActivePending::DeepMineChoice { .. } => "deep_mine_choice",
        ActivePending::GladeWoundChoice => "glade_wound_choice",
        ActivePending::BannerProtectionChoice => "banner_protection",
        ActivePending::SourceOpeningReroll { .. } => "source_opening_reroll",
        ActivePending::Meditation(_) => "meditation",
        ActivePending::PlunderDecision => "plunder_decision",
        ActivePending::UnitMaintenance(_) => "unit_maintenance",
        ActivePending::TerrainCostReduction(_) => "terrain_cost_reduction",
        ActivePending::CrystalJoyReclaim(_) => "crystal_joy_reclaim",
        ActivePending::SteadyTempoDeckPlacement(_) => "steady_tempo_placement",
        ActivePending::UnitAbilityChoice { .. } => "unit_ability_choice",
        ActivePending::SubsetSelection(ss) => match &ss.kind {
            mk_types::pending::SubsetSelectionKind::Rethink => "rethink",
            mk_types::pending::SubsetSelectionKind::MidnightMeditation => "midnight_meditation",
            mk_types::pending::SubsetSelectionKind::ManaSearch { .. } => "mana_search",
            mk_types::pending::SubsetSelectionKind::AttackTargets { .. } => "attack_targets",
            mk_types::pending::SubsetSelectionKind::RestWoundDiscard { .. } => "rest_wound_discard",
        },
        ActivePending::SelectCombatEnemy { .. } => "select_combat_enemy",
        ActivePending::SiteRewardChoice { .. } => "site_reward_choice",
        ActivePending::TomeOfAllSpells(_) => "tome_of_all_spells",
        ActivePending::CircletOfProficiency(_) => "circlet_of_proficiency",
        ActivePending::ArtifactSelection(_) => "artifact_selection",
        ActivePending::CrystalRollColorChoice { .. } => "crystal_roll_color",
    }
}

fn pending_label(active: &ActivePending) -> &'static str {
    match active {
        ActivePending::Choice(choice) => {
            if matches!(choice.resolution, ChoiceResolution::DiscardThenContinue { .. }) {
                "Choose a card to discard"
            } else {
                "Choose an option"
            }
        }
        ActivePending::Discard(_) => "Discard cards",
        ActivePending::DiscardForBonus(_) => "Discard for bonus",
        ActivePending::DiscardForCrystal(_) => "Discard for crystal",
        ActivePending::Decompose(_) => "Decompose a card",
        ActivePending::MaximalEffect(_) => "Maximal effect choice",
        ActivePending::BookOfWisdom(_) => "Book of Wisdom",
        ActivePending::Training(_) => "Training",
        ActivePending::TacticDecision(_) => "Tactic decision",
        ActivePending::LevelUpReward(_) => "Level-up reward",
        ActivePending::DeepMineChoice { .. } => "Deep mine crystal",
        ActivePending::GladeWoundChoice => "Glade wound location",
        ActivePending::BannerProtectionChoice => "Banner protection",
        ActivePending::SourceOpeningReroll { .. } => "Source opening reroll",
        ActivePending::Meditation(_) => "Meditation",
        ActivePending::PlunderDecision => "Plunder decision",
        ActivePending::UnitMaintenance(_) => "Unit maintenance",
        ActivePending::TerrainCostReduction(_) => "Terrain cost reduction",
        ActivePending::CrystalJoyReclaim(_) => "Crystal joy reclaim",
        ActivePending::SteadyTempoDeckPlacement(_) => "Steady tempo placement",
        ActivePending::UnitAbilityChoice { .. } => "Unit ability choice",
        ActivePending::SubsetSelection(ss) => match &ss.kind {
            mk_types::pending::SubsetSelectionKind::ManaSearch { .. } => "Select dice to reroll",
            mk_types::pending::SubsetSelectionKind::AttackTargets { .. } => "Select attack targets",
            mk_types::pending::SubsetSelectionKind::RestWoundDiscard { .. } => "Select wounds to discard",
            _ => "Select cards",
        },
        ActivePending::SelectCombatEnemy { .. } => "Select combat enemy",
        ActivePending::SiteRewardChoice { .. } => "Select reward",
        ActivePending::TomeOfAllSpells(_) => "Tome of All Spells",
        ActivePending::CircletOfProficiency(_) => "Circlet of Proficiency",
        ActivePending::ArtifactSelection(_) => "Select artifact to keep",
        ActivePending::CrystalRollColorChoice { .. } => "Choose crystal color",
    }
}

fn pending_options(active: &ActivePending, player: &PlayerState, state: &GameState) -> Vec<String> {
    match active {
        ActivePending::Choice(choice) => {
            // For DiscardThenContinue, show card names instead of identical effect descriptions
            if let ChoiceResolution::DiscardThenContinue { eligible_indices } = &choice.resolution {
                return eligible_indices
                    .iter()
                    .map(|&idx| {
                        if idx < player.hand.len() {
                            format!("Discard {}", player.hand[idx])
                        } else {
                            "Discard card".to_string()
                        }
                    })
                    .collect();
            }
            // For color-picking resolutions, show meaningful labels instead of Noop
            if let ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors }
                | ChoiceResolution::CrystalMasteryGainColor { eligible_colors } = &choice.resolution
            {
                return eligible_colors
                    .iter()
                    .map(|c| format!("Gain {:?} crystal", c))
                    .collect();
            }
            if let ChoiceResolution::ManaMeltdownColorSelect { available_colors } = &choice.resolution {
                return available_colors
                    .iter()
                    .map(|c| format!("Sacrifice {:?} crystals", c))
                    .collect();
            }
            if let ChoiceResolution::UniversalPowerMana { available_colors } = &choice.resolution {
                return available_colors
                    .iter()
                    .map(|c| format!("Spend {:?} mana", c))
                    .collect();
            }
            if let ChoiceResolution::ManaStormDieSelect { die_colors, .. } = &choice.resolution {
                return die_colors
                    .iter()
                    .map(|c| format!("Take {:?} die", c))
                    .collect();
            }
            if let ChoiceResolution::ManaClaimDieSelect { die_colors, .. } = &choice.resolution {
                return die_colors
                    .iter()
                    .map(|c| format!("Claim {:?} die", c))
                    .collect();
            }
            if let ChoiceResolution::SpellForgeCrystal { spell_entries, .. } = &choice.resolution {
                return spell_entries
                    .iter()
                    .map(|(_, c)| format!("Gain {:?} crystal", c))
                    .collect();
            }
            // Unit-targeting resolutions (roster-indexed)
            if let ChoiceResolution::ReadyUnitTarget { eligible_unit_indices }
                | ChoiceResolution::EnergyFlowTarget { eligible_unit_indices, .. }
                | ChoiceResolution::SelectUnitModifier { eligible_unit_indices } = &choice.resolution
            {
                return eligible_unit_indices
                    .iter()
                    .filter_map(|&idx| player.units.get(idx))
                    .map(|u| format!("Select {}", u.unit_id))
                    .collect();
            }
            if let ChoiceResolution::HealUnitTarget { eligible_unit_indices } = &choice.resolution {
                return eligible_unit_indices
                    .iter()
                    .filter_map(|&idx| player.units.get(idx))
                    .map(|u| format!("Heal {}", u.unit_id))
                    .collect();
            }
            if let ChoiceResolution::ReadyUnitsBudgetSelect { eligible_unit_indices, remaining_levels } = &choice.resolution {
                let mut opts: Vec<String> = vec!["Done".to_string()];
                opts.extend(eligible_unit_indices.iter().filter_map(|&idx| {
                    player.units.get(idx).map(|u| format!("Ready {} (budget: {})", u.unit_id, remaining_levels))
                }));
                return opts;
            }
            // Unit-targeting resolutions (offer-indexed)
            if let ChoiceResolution::CallToArmsUnitSelect { eligible_unit_indices }
                | ChoiceResolution::FreeRecruitTarget { eligible_unit_indices } = &choice.resolution
            {
                return eligible_unit_indices
                    .iter()
                    .filter_map(|&idx| state.offers.units.get(idx))
                    .map(|uid| format!("Select {}", uid))
                    .collect();
            }
            if let ChoiceResolution::CallToArmsAbilitySelect { ability_entries } = &choice.resolution {
                return ability_entries
                    .iter()
                    .map(|(_, effect)| effect_summary(effect))
                    .collect();
            }
            // Enemy-targeting resolutions
            if let ChoiceResolution::DuelingTarget { eligible_enemy_ids }
                | ChoiceResolution::KnowYourPreyTarget { eligible_enemy_ids }
                | ChoiceResolution::NaturesVengeanceTarget { eligible_enemy_ids, .. } = &choice.resolution
            {
                return eligible_enemy_ids.iter()
                    .map(|id| format!("Target {}", enemy_name_from_instance(id, state)))
                    .collect();
            }
            if let ChoiceResolution::CurseTarget { eligible_enemy_ids } = &choice.resolution {
                return eligible_enemy_ids.iter()
                    .map(|id| format!("Curse {}", enemy_name_from_instance(id, state)))
                    .collect();
            }
            if let ChoiceResolution::PossessEnemyTarget { eligible_enemy_ids } = &choice.resolution {
                return eligible_enemy_ids.iter()
                    .map(|id| format!("Possess {}", enemy_name_from_instance(id, state)))
                    .collect();
            }
            if let ChoiceResolution::ForkedLightningTarget { remaining, already_targeted } = &choice.resolution {
                let mut opts: Vec<String> = Vec::new();
                if let Some(ref combat) = state.combat {
                    for e in combat.enemies.iter()
                        .filter(|e| !e.is_defeated && !already_targeted.contains(&e.instance_id.as_str().to_string()))
                    {
                        let name = get_enemy(e.enemy_id.as_str())
                            .map(|def| def.name.to_string())
                            .unwrap_or_else(|| e.instance_id.to_string());
                        opts.push(format!("Target {}", name));
                    }
                }
                if *remaining < 3 {
                    opts.push("Done".to_string());
                }
                return opts;
            }
            if let ChoiceResolution::WingsOfNightTarget { eligible_enemy_ids, targets_so_far } = &choice.resolution {
                let mut opts: Vec<String> = Vec::new();
                if *targets_so_far > 0 {
                    opts.push("Done".to_string());
                }
                for id in eligible_enemy_ids {
                    opts.push(format!("Target {}", enemy_name_from_instance(id, state)));
                }
                return opts;
            }
            // Card-targeting resolutions
            if let ChoiceResolution::BoostTarget { eligible_hand_indices } = &choice.resolution {
                return eligible_hand_indices.iter()
                    .filter_map(|&idx| player.hand.get(idx))
                    .map(|cid| format!("Boost {}", cid))
                    .collect();
            }
            if let ChoiceResolution::ShapeshiftCardSelect { options } = &choice.resolution {
                return options.iter()
                    .map(|opt| format!("Transform {} ({:?})", opt.card_id, opt.original_type))
                    .collect();
            }
            if let ChoiceResolution::DiscardForCrystalSelect { eligible_card_ids, optional } = &choice.resolution {
                let mut opts = Vec::new();
                if *optional {
                    opts.push("Skip".to_string());
                }
                for cid in eligible_card_ids {
                    opts.push(format!("Discard {}", cid));
                }
                return opts;
            }
            if let ChoiceResolution::InvocationDiscard { options } = &choice.resolution {
                return options.iter()
                    .map(|opt| format!("Discard {} for {:?} mana", opt.card_id, opt.mana_color))
                    .collect();
            }
            if matches!(choice.resolution, ChoiceResolution::MindReadColorSelect) {
                return ["Red", "Blue", "Green", "White"].iter()
                    .map(|c| format!("Gain {} crystal", c))
                    .collect();
            }
            if let ChoiceResolution::ManaClaimModeSelect { color, .. } = &choice.resolution {
                return vec![
                    format!("Burst: gain 3 {:?} tokens", color),
                    format!("Sustained: gain 1 {:?} token/turn", color),
                ];
            }
            if matches!(choice.resolution, ChoiceResolution::SecretWaysLake) {
                return vec!["Skip".to_string(), "Pay Blue mana for lake movement".to_string()];
            }
            if matches!(choice.resolution, ChoiceResolution::SongOfWindLake) {
                return vec!["Skip".to_string(), "Pay Blue mana for lake movement".to_string()];
            }
            if let ChoiceResolution::RitualOfPainDiscard { max_wounds } = &choice.resolution {
                return (0..=*max_wounds)
                    .map(|n| if n == 0 { "Skip".to_string() } else { format!("Discard {} wound(s)", n) })
                    .collect();
            }
            if matches!(choice.resolution, ChoiceResolution::BloodPoweredWoundSelect) {
                return vec!["Wound to hand".to_string(), "Wound to discard".to_string()];
            }
            if let ChoiceResolution::CurseMode { .. } = &choice.resolution {
                return vec!["Attack -2".to_string(), "Armor -1".to_string()];
            }
            if let ChoiceResolution::CurseAttackIndex { attack_count, .. } = &choice.resolution {
                return (0..*attack_count)
                    .map(|i| format!("Attack {}", i + 1))
                    .collect();
            }
            if let ChoiceResolution::PuppetMasterSelectToken { token_indices } = &choice.resolution {
                return token_indices.iter()
                    .filter_map(|&idx| player.kept_enemy_tokens.get(idx))
                    .map(|eid| format!("Use {} token", eid.name))
                    .collect();
            }
            if let ChoiceResolution::PuppetMasterUseMode { attack_value, attack_element, block_value, block_element, .. } = &choice.resolution {
                return vec![
                    format!("{} {:?} Attack", attack_value, attack_element),
                    format!("{} {:?} Block", block_value, block_element),
                ];
            }
            if let ChoiceResolution::ShapeshiftTypeSelect { original_type, amount, .. } = &choice.resolution {
                use mk_types::modifier::ShapeshiftTarget;
                let all = [ShapeshiftTarget::Move, ShapeshiftTarget::Attack, ShapeshiftTarget::Block];
                return all.iter()
                    .filter(|&&t| t != *original_type)
                    .map(|t| format!("{} {:?}", amount, t))
                    .collect();
            }
            if let ChoiceResolution::KnowYourPreyOption { options, .. } = &choice.resolution {
                return options.iter()
                    .map(|opt| match opt {
                        mk_types::pending::KnowYourPreyApplyOption::NullifyAbility { ability } => format!("Nullify {:?}", ability),
                        mk_types::pending::KnowYourPreyApplyOption::RemoveResistance { element } => format!("Remove {:?} resistance", element),
                        mk_types::pending::KnowYourPreyApplyOption::ConvertElement { from, to } => format!("Convert {:?} → {:?}", from, to),
                    })
                    .collect();
            }
            if let ChoiceResolution::SourceOpeningDieSelect { die_ids } = &choice.resolution {
                let mut opts = vec!["Skip".to_string()];
                for die_id in die_ids {
                    if let Some(die) = state.source.dice.iter().find(|d| d.id.as_str() == die_id.as_str()) {
                        opts.push(format!("Reroll {:?} die", die.color));
                    } else {
                        opts.push(format!("Reroll die {}", die_id));
                    }
                }
                return opts;
            }
            if let ChoiceResolution::PeacefulMomentConversion { option_map, .. } = &choice.resolution {
                return option_map.iter()
                    .map(|opt| match opt {
                        mk_types::pending::PeacefulMomentOption::Done => "Done".to_string(),
                        mk_types::pending::PeacefulMomentOption::HealWound => "Heal wound".to_string(),
                        mk_types::pending::PeacefulMomentOption::RefreshUnit => "Refresh unit".to_string(),
                        mk_types::pending::PeacefulMomentOption::HealUnit { unit_index } => {
                            player.units.get(*unit_index)
                                .map(|u| format!("Heal {}", u.unit_id))
                                .unwrap_or_else(|| "Heal unit".to_string())
                        }
                    })
                    .collect();
            }
            if let ChoiceResolution::BloodBasicAaSelect { color } = &choice.resolution {
                return state.offers.advanced_actions.iter()
                    .filter(|cid| mk_data::cards::get_card_color(cid.as_str()) == Some(*color))
                    .map(|cid| format!("Gain {}", cid))
                    .collect();
            }
            if matches!(choice.resolution, ChoiceResolution::BloodPoweredAaSelect) {
                return state.offers.advanced_actions.iter()
                    .map(|cid| format!("Use {}", cid))
                    .collect();
            }
            if let ChoiceResolution::MagicTalentSpellSelect { spell_entries } = &choice.resolution {
                return spell_entries.iter()
                    .map(|(_, spell_id, color)| format!("Cast {} ({:?})", spell_id, color))
                    .collect();
            }
            if let ChoiceResolution::MagicTalentGainSelect { gain_entries } = &choice.resolution {
                return gain_entries.iter()
                    .map(|(_, spell_id, color)| format!("Gain {} (spend {:?})", spell_id, color))
                    .collect();
            }
            // Mana/token-targeting resolutions
            if let ChoiceResolution::PureMagicConsume { token_colors } = &choice.resolution {
                return token_colors.iter()
                    .map(|c| format!("Spend {:?} mana", c))
                    .collect();
            }
            if let ChoiceResolution::ManaBoltTokenSelect { token_options } = &choice.resolution {
                return token_options.iter()
                    .map(|(color, combat_type, _, amount)| format!("Spend {:?} → {} {:?} Attack", color, amount, combat_type))
                    .collect();
            }
            if let ChoiceResolution::SacrificePairSelect { pair_options } = &choice.resolution {
                return pair_options.iter()
                    .map(|(a, b, ct, _, val, count)| format!("Sacrifice {:?}+{:?} → {} {:?} Attack (x{})", a, b, val, ct, count))
                    .collect();
            }
            if let ChoiceResolution::RegenerateMana { sources, .. } = &choice.resolution {
                return sources.iter()
                    .map(|src| match src {
                        mk_types::pending::RegenerateManaSource::Token(c) => format!("Spend {:?} token", c),
                        mk_types::pending::RegenerateManaSource::Crystal(c) => format!("Spend {:?} crystal", c),
                        mk_types::pending::RegenerateManaSource::SourceDie(c) => format!("Take {:?} die", c),
                    })
                    .collect();
            }
            if let ChoiceResolution::ManaSourceSelect { sources, .. } = &choice.resolution {
                return sources.iter()
                    .map(|src| format!("Spend {:?} {:?}", src.color, src.source_type))
                    .collect();
            }
            if let ChoiceResolution::PolarizationConvert { options } = &choice.resolution {
                return options.iter()
                    .map(|opt| format!("{:?} {:?} → {:?}", opt.source_type, opt.source_color, opt.target_color))
                    .collect();
            }
            if let ChoiceResolution::BloodBasicManaSelect { mana_options } = &choice.resolution {
                return mana_options.iter()
                    .map(|(_, color)| format!("Spend {:?} mana", color))
                    .collect();
            }
            choice.options.iter().map(effect_summary).collect()
        }
        ActivePending::UnitAbilityChoice { options, .. } => {
            options.iter().map(|o| format!("{:?}", o)).collect()
        }
        ActivePending::DeepMineChoice { colors } => colors
            .iter()
            .map(|c| format!("{:?} crystal", c))
            .collect(),
        _ => Vec::new(),
    }
}

fn enemy_name_from_instance(instance_id: &str, state: &GameState) -> String {
    state.combat.as_ref()
        .and_then(|c| c.enemies.iter().find(|e| e.instance_id.as_str() == instance_id))
        .and_then(|e| get_enemy(e.enemy_id.as_str()))
        .map(|def| def.name.to_string())
        .unwrap_or_else(|| instance_id.to_string())
}

fn effect_summary(effect: &mk_types::effect::CardEffect) -> String {
    use mk_types::effect::CardEffect;
    match effect {
        CardEffect::GainMove { amount } => format!("+{} Move", amount),
        CardEffect::GainInfluence { amount } => format!("+{} Influence", amount),
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => {
            let ct = match combat_type {
                CombatType::Melee => "",
                CombatType::Ranged => "Ranged ",
                CombatType::Siege => "Siege ",
            };
            format!("+{} {}Attack {:?}", amount, ct, element)
        }
        CardEffect::GainBlock { amount, element } => format!("+{} Block {:?}", amount, element),
        CardEffect::GainHealing { amount } => format!("+{} Heal", amount),
        CardEffect::GainMana { color, amount } => format!("Gain {} {:?} mana", amount, color),
        CardEffect::DrawCards { count } => format!("Draw {} cards", count),
        CardEffect::GainFame { amount } => format!("Gain {} fame", amount),
        CardEffect::ChangeReputation { amount } => format!("Rep {:+}", amount),
        CardEffect::GainCrystal { color } => match color {
            Some(c) => format!("Gain {:?} crystal", c),
            None => "Gain crystal".into(),
        },
        CardEffect::TakeWound => "Take wound".into(),
        CardEffect::ConvertManaToCrystal => "Crystallize".into(),
        CardEffect::Noop => "Nothing".into(),
        other => format!("{:?}", other),
    }
}

// =============================================================================
// Map filtering
// =============================================================================

fn to_client_map(map: &MapState) -> ClientMapState {
    ClientMapState {
        hexes: map
            .hexes
            .values()
            .map(|hex| {
                let key = format!("{},{}", hex.coord.q, hex.coord.r);
                let value = ClientHexState {
                    coord: hex.coord,
                    terrain: hex.terrain,
                    tile_id: hex.tile_id,
                    site: hex.site.as_ref().map(|s| ClientSite {
                        site_type: s.site_type,
                        owner: s.owner.clone(),
                        is_conquered: s.is_conquered,
                        is_burned: s.is_burned,
                        city_color: s.city_color,
                        mine_color: s.mine_color,
                    }),
                    rampaging_enemies: hex.rampaging_enemies.to_vec(),
                    enemies: hex
                        .enemies
                        .iter()
                        .map(|e| ClientHexEnemy {
                            color: e.color,
                            is_revealed: e.is_revealed,
                            token_id: if e.is_revealed {
                                Some(e.token_id.clone())
                            } else {
                                None
                            },
                        })
                        .collect(),
                };
                (key, value)
            })
            .collect(),

        tiles: map
            .tiles
            .iter()
            .map(|t| ClientTilePlacement {
                center_coord: t.center_coord,
                revealed: t.revealed,
                tile_id: if t.revealed {
                    Some(t.tile_id)
                } else {
                    None
                },
            })
            .collect(),

        tile_slots: map
            .tile_slots
            .iter()
            .map(|(key, s)| {
                (
                    key.clone(),
                    ClientTileSlot {
                        coord: s.coord,
                        row: s.row,
                        filled: s.filled,
                    },
                )
            })
            .collect(),
    }
}

// =============================================================================
// Mana source filtering
// =============================================================================

fn to_client_source(source: &ManaSource, players: &[PlayerState]) -> ClientManaSource {
    ClientManaSource {
        dice: source
            .dice
            .iter()
            .map(|die| {
                let is_stolen = players.iter().any(|p| {
                    p.tactic_state
                        .stored_mana_die
                        .as_ref()
                        .is_some_and(|d| d.die_id == die.id)
                });
                ClientSourceDie {
                    id: die.id.clone(),
                    color: die.color,
                    is_depleted: die.is_depleted,
                    taken_by_player_id: die.taken_by_player_id.clone(),
                    is_stolen_by_tactic: is_stolen,
                }
            })
            .collect(),
    }
}

// =============================================================================
// Offers & decks
// =============================================================================

fn to_client_offers(offers: &GameOffers) -> ClientOffers {
    ClientOffers {
        units: offers.units.to_vec(),
        advanced_actions: offers.advanced_actions.clone(),
        spells: offers.spells.clone(),
    }
}

fn to_client_deck_counts(decks: &GameDecks) -> ClientDeckCounts {
    ClientDeckCounts {
        spells: decks.spell_deck.len(),
        advanced_actions: decks.advanced_action_deck.len(),
        artifacts: decks.artifact_deck.len(),
        units: decks.unit_deck.len() + decks.elite_unit_deck.len(),
    }
}

// =============================================================================
// Combat filtering
// =============================================================================

fn to_client_combat(
    combat: &CombatState,
    state: &GameState,
) -> ClientCombatState {
    let declared_attack_armor_needed = combat.declared_attack_targets.as_ref().map(|targets| {
        crate::legal_actions::combat::compute_total_target_armor(
            combat,
            targets,
            &state.active_modifiers,
            None,
        )
    });

    ClientCombatState {
        phase: combat.phase,
        enemies: combat
            .enemies
            .iter()
            .filter(|e| !e.is_summoner_hidden)
            .map(hydrate_combat_enemy)
            .collect(),
        wounds_this_combat: combat.wounds_this_combat,
        fame_gained: combat.fame_gained,
        is_at_fortified_site: combat.is_at_fortified_site,
        declared_attack_targets: combat.declared_attack_targets.clone(),
        declared_attack_type: combat.declared_attack_type,
        declared_attack_armor_needed,
    }
}

fn hydrate_combat_enemy(enemy: &CombatEnemy) -> ClientCombatEnemy {
    let def = get_enemy(enemy.enemy_id.as_str());

    ClientCombatEnemy {
        instance_id: enemy.instance_id.clone(),
        enemy_id: enemy.enemy_id.clone(),

        name: def.map(|d| d.name.to_string()).unwrap_or_else(|| "???".into()),
        color: def.map(|d| d.color).unwrap_or(EnemyColor::Brown),
        attack: def.map(|d| d.attack).unwrap_or(0),
        attack_element: def.map(|d| d.attack_element).unwrap_or(Element::Physical),
        armor: def.map(|d| d.armor).unwrap_or(0),
        fame: def.map(|d| d.fame).unwrap_or(0),
        resistances: def
            .map(|d| d.resistances.to_vec())
            .unwrap_or_default(),
        abilities: def.map(|d| d.abilities.to_vec()).unwrap_or_default(),
        attacks: def.and_then(|d| {
            d.attacks.map(|atks| {
                atks.iter()
                    .map(|a| ClientEnemyAttack {
                        damage: a.damage,
                        element: a.element,
                        ability: a.ability,
                    })
                    .collect()
            })
        }),

        is_blocked: enemy.is_blocked,
        is_defeated: enemy.is_defeated,
    }
}

// =============================================================================
// Dummy player
// =============================================================================

fn to_client_dummy(dummy: &DummyPlayer, tactic_id: &Option<TacticId>) -> ClientDummyPlayer {
    ClientDummyPlayer {
        hero: dummy.hero,
        deck_count: dummy.deck.len(),
        discard_count: dummy.discard.len(),
        tactic_id: tactic_id.clone(),
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;

    #[test]
    fn basic_client_state_creation() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        assert_eq!(client.phase, GamePhase::Round);
        assert_eq!(client.time_of_day, TimeOfDay::Day);
        assert_eq!(client.round, 1);
        assert_eq!(client.players.len(), 1);
        assert_eq!(client.current_player_id, player_id);
    }

    #[test]
    fn self_hand_visible() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        let player = &client.players[0];
        assert!(!player.hand.is_empty());
        assert_eq!(player.hand.len(), player.hand_count);
        assert_eq!(player.hand_count, state.players[0].hand.len());
    }

    #[test]
    fn other_player_hand_hidden() {
        let state = create_solo_game(42, Hero::Arythea);
        // Ask for a non-existent player's view
        let fake_id = PlayerId::from("other_player");
        let client = to_client_state(&state, &fake_id);

        let player = &client.players[0];
        assert!(player.hand.is_empty(), "other player's hand should be empty");
        assert!(player.hand_count > 0, "hand_count should still show count");
    }

    #[test]
    fn deck_counts_correct() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        let player = &client.players[0];
        assert_eq!(player.deck_count, state.players[0].deck.len());
        assert_eq!(player.discard_count, state.players[0].discard.len());
    }

    #[test]
    fn map_tiles_filtered() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        // Starting tile should be revealed
        assert!(!client.map.tiles.is_empty());
        let first_tile = &client.map.tiles[0];
        assert!(first_tile.revealed);
        assert!(first_tile.tile_id.is_some());
    }

    #[test]
    fn source_dice_present() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        // Solo: 1 player + 2 = 3 dice
        assert_eq!(client.source.dice.len(), 3);
    }

    #[test]
    fn offers_present() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        assert_eq!(client.offers.advanced_actions.len(), 3);
        assert_eq!(client.offers.spells.len(), 3);
    }

    #[test]
    fn combat_state_none_without_combat() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        assert!(client.combat.is_none());
    }

    #[test]
    fn flags_extracted() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        let player = &client.players[0];
        assert!(!player.knocked_out);
        assert!(!player.is_resting);
        assert!(!player.has_moved_this_turn);
    }

    #[test]
    fn no_pending_at_start() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        assert!(client.players[0].pending.is_none());
    }

    #[test]
    fn serializes_to_json() {
        let state = create_solo_game(42, Hero::Arythea);
        let player_id = state.players[0].id.clone();
        let client = to_client_state(&state, &player_id);

        let json = serde_json::to_string(&client).expect("should serialize to JSON");
        assert!(!json.is_empty());
        // Round-trip
        let _: ClientGameState =
            serde_json::from_str(&json).expect("should deserialize from JSON");
    }
}
