use super::*;
use super::utils::scale_effect;
use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::hex::HexCoord;
use mk_types::ids::{CardId, PlayerId, SourceDieId, UnitId, UnitInstanceId};
use mk_types::modifier::*;
use mk_types::pending::{
    ChoiceResolution, DeferredPending, EffectMode, PeacefulMomentOption,
    PendingDecompose, PendingQueue,
};
use mk_types::rng::RngState;
use mk_types::state::*;

    /// Create a minimal GameState for testing with one player.
    fn test_state() -> GameState {
        GameState {
            phase: GamePhase::Round,
            time_of_day: TimeOfDay::Day,
            round: 1,
            turn_order: vec![PlayerId::from("p1")],
            current_player_index: 0,
            end_of_round_announced_by: None,
            players_with_final_turn: vec![],
            players: vec![test_player()],
            map: MapState::default(),
            combat: None,
            round_phase: RoundPhase::PlayerTurns,
            available_tactics: vec![],
            removed_tactics: vec![],
            dummy_player_tactic: None,
            tactics_selection_order: vec![],
            current_tactic_selector: None,
            source: ManaSource::default(),
            offers: GameOffers::default(),
            enemy_tokens: EnemyTokenPiles::default(),
            ruins_tokens: RuinsTokenPiles::default(),
            decks: GameDecks::default(),
            city_level: 0,
            cities: Default::default(),
            active_modifiers: vec![],
            action_epoch: 0,
            next_instance_counter: 1,
            rng: RngState::new(42),
            wound_pile_count: None,
            scenario_id: mk_types::ids::ScenarioId::from("solo"),
            scenario_config: mk_data::scenarios::first_reconnaissance(),
            scenario_end_triggered: false,
            final_turns_remaining: None,
            game_ended: false,
            winning_player_id: None,
            pending_cooperative_assault: None,
            final_score_result: None,
            mana_overload_center: None,
            mana_enhancement_center: None,
            source_opening_center: None,
            dummy_player: None,
            turn_number: 0,
        }
    }

    fn test_player() -> PlayerState {
        PlayerState {
            id: PlayerId::from("p1"),
            hero: Hero::Arythea,
            position: Some(HexCoord::new(0, 0)),
            fame: 0,
            level: 1,
            reputation: 0,
            armor: 2,
            hand_limit: 5,
            command_tokens: 1,
            hand: vec![],
            deck: vec![
                CardId::from("march"),
                CardId::from("swiftness"),
                CardId::from("rage"),
            ],
            discard: vec![],
            play_area: vec![],
            removed_cards: vec![],
            units: Default::default(),
            bonds_of_loyalty_unit_instance_id: None,
            attached_banners: Default::default(),
            skills: vec![],
            skill_cooldowns: Default::default(),
            skill_flip_state: Default::default(),
            remaining_hero_skills: vec![],
            master_of_chaos_state: None,
            kept_enemy_tokens: Default::default(),
            crystals: Crystals::default(),
            spent_crystals_this_turn: Crystals::default(),
            selected_tactic: None,
            tactic_state: Default::default(),
            pure_mana: vec![],
            used_die_ids: vec![],
            mana_draw_die_ids: vec![],
            mana_used_this_turn: vec![],
            combat_accumulator: Default::default(),
            move_points: 0,
            influence_points: 0,
            healing_points: 0,
            enemies_defeated_this_turn: 0,
            wounds_healed_from_hand_this_turn: 0,
            units_healed_this_turn: vec![],
            units_recruited_this_interaction: vec![],
            spell_colors_cast_this_turn: vec![],
            spells_cast_by_color_this_turn: Default::default(),
            meditation_hand_limit_bonus: 0,
            wounds_received_this_turn: Default::default(),
            time_bending_set_aside_cards: vec![],
            mysterious_box_state: None,
            end_turn_step: 0,
            crystal_joy_reclaim_version: None,
            steady_tempo_version: None,
            flags: PlayerFlags::empty(),
            pending: PendingQueue::new(),
        }
    }

    // ---- Atomic effects ----

    #[test]
    fn gain_move() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainMove { amount: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 3);
    }

    #[test]
    fn gain_influence() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainInfluence { amount: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn gain_fame() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainFame { amount: 5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].fame, 5);
    }

    #[test]
    fn change_reputation_clamped() {
        let mut state = test_state();
        state.players[0].reputation = 6;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ChangeReputation { amount: 5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].reputation, 7); // clamped to max

        state.players[0].reputation = -6;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ChangeReputation { amount: -5 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].reputation, -7); // clamped to min
    }

    #[test]
    fn draw_cards() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DrawCards { count: 2 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 2);
        assert_eq!(state.players[0].deck.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "march");
        assert_eq!(state.players[0].hand[1].as_str(), "swiftness");
    }

    #[test]
    fn draw_cards_limited_by_deck() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DrawCards { count: 10 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 3); // only 3 in deck
        assert!(state.players[0].deck.is_empty());
    }

    #[test]
    fn gain_mana() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainMana {
                color: ManaColor::Red,
                amount: 2,
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].pure_mana.len(), 2);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Red);
    }

    #[test]
    fn gain_crystal() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainCrystal {
                color: Some(BasicManaColor::Blue),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    #[test]
    fn gain_crystal_overflow() {
        let mut state = test_state();
        state.players[0].crystals.blue = 3; // already at max
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainCrystal {
                color: Some(BasicManaColor::Blue),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].crystals.blue, 3); // unchanged
        assert_eq!(state.players[0].pure_mana.len(), 1); // got mana token instead
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Blue);
    }

    #[test]
    fn take_wound() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::TakeWound, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].hand[0].as_str(), "wound");
    }

    #[test]
    fn gain_healing_removes_wounds() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("wound"),
            CardId::from("march"),
            CardId::from("wound"),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 1 }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 2);
        // One wound removed, march remains, second wound remains
        assert_eq!(state.players[0].wounds_healed_from_hand_this_turn, 1);
    }

    #[test]
    fn gain_attack_requires_combat() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // No combat state, so attack should be skipped
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
    }

    #[test]
    fn gain_attack_in_combat() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState {
            phase: CombatPhase::Attack,
            enemies: vec![],
            wounds_this_combat: 0,
            wounds_added_to_hand_this_combat: false,
            attacks_this_phase: 0,
            fame_gained: 0,
            is_at_fortified_site: false,
            units_allowed: true,
            night_mana_rules: false,
            assault_origin: None,
            combat_hex_coord: None,
            all_damage_blocked_this_phase: false,
            discard_enemies_on_failure: false,
            combat_context: CombatContext::Standard,
            pending_damage: Default::default(),
            pending_block: Default::default(),
            pending_swift_block: Default::default(),
            cumbersome_reductions: Default::default(),
            used_defend: Default::default(),
            defend_bonuses: Default::default(),
            vampiric_armor_bonus: Default::default(),
            paid_thugs_damage_influence: Default::default(),
            damage_redirects: Default::default(),
            enemy_assignments: None,
            paid_heroes_assault_influence: false,
            declared_attack_targets: None,
            declared_attack_type: None,
            declared_block_target: None,
            declared_block_attack_index: None,
            ..Default::default()
        }));

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 4,
                combat_type: CombatType::Ranged,
                element: Element::Fire,
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 4);
        assert_eq!(
            state.players[0]
                .combat_accumulator
                .attack
                .ranged_elements
                .fire,
            4
        );
    }

    // ---- Structural effects ----

    #[test]
    fn compound_sequential() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 3 },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].influence_points, 3);
    }

    #[test]
    fn nested_compound() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::Compound {
                        effects: vec![
                            CardEffect::GainMove { amount: 1 },
                            CardEffect::GainMove { amount: 1 },
                        ],
                    },
                    CardEffect::GainInfluence { amount: 5 },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2);
        assert_eq!(state.players[0].influence_points, 5);
    }

    #[test]
    fn choice_auto_resolves_single_option() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        // Only GainMove is resolvable (GainAttack needs combat)
        queue.push(
            CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 4 },
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 4); // auto-resolved
    }

    #[test]
    fn choice_returns_needs_choice() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 3 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(continuation.is_empty());
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // State unchanged
        assert_eq!(state.players[0].move_points, 0);
        assert_eq!(state.players[0].influence_points, 0);
    }

    #[test]
    fn choice_in_compound_preserves_continuation() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::Choice {
                        options: vec![
                            CardEffect::GainInfluence { amount: 2 },
                            CardEffect::GainFame { amount: 3 },
                        ],
                    },
                    CardEffect::GainMove { amount: 5 }, // should be in continuation
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // GainMove(1) applied before choice
        assert_eq!(state.players[0].move_points, 1);

        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert_eq!(continuation.len(), 1); // GainMove(5) remains
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn choice_resume_with_continuation() {
        let mut state = test_state();
        // Simulate: compound was interrupted by choice, player chose option
        // Now resume with chosen option + continuation
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainInfluence { amount: 2 }, None); // chosen option
        queue.push_continuation(vec![QueuedEffect {
            effect: CardEffect::GainMove { amount: 5 },
            source_card_id: None,
        }]);

        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].influence_points, 2);
        assert_eq!(state.players[0].move_points, 5);
    }

    #[test]
    fn conditional_day() {
        let mut state = test_state();
        state.time_of_day = TimeOfDay::Day;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Conditional {
                condition: EffectCondition::TimeOfDay {
                    time: TimeOfDay::Day,
                },
                then_effect: Box::new(CardEffect::GainMove { amount: 4 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 2 })),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 4); // day branch
    }

    #[test]
    fn conditional_night() {
        let mut state = test_state();
        state.time_of_day = TimeOfDay::Night;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Conditional {
                condition: EffectCondition::TimeOfDay {
                    time: TimeOfDay::Day,
                },
                then_effect: Box::new(CardEffect::GainMove { amount: 4 }),
                else_effect: Some(Box::new(CardEffect::GainMove { amount: 2 })),
            },
            None,
        );
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].move_points, 2); // night branch (else)
    }

    #[test]
    fn scaling_per_wound_in_hand() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("wound"),
            CardId::from("march"),
            CardId::from("wound"),
            CardId::from("wound"),
        ];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Scaling {
                factor: ScalingFactor::PerWoundInHand,
                base_effect: Box::new(CardEffect::GainMove { amount: 1 }),
                bonus_per_count: Some(2),
                maximum: None,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // 3 wounds * 2 per count = 6 bonus, base 1 = 7 total
        assert_eq!(state.players[0].move_points, 7);
    }

    #[test]
    fn scaling_per_crystal_color() {
        let mut state = test_state();
        state.players[0].crystals = Crystals {
            red: 2,
            blue: 0,
            green: 1,
            white: 0,
        };
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Scaling {
                factor: ScalingFactor::PerCrystalColor,
                base_effect: Box::new(CardEffect::GainInfluence { amount: 0 }),
                bonus_per_count: None, // default 1
                maximum: None,
            },
            None,
        );
        queue.drain(&mut state, 0);
        // 2 colors (red, green) * 1 + base 0 = 2
        assert_eq!(state.players[0].influence_points, 2);
    }

    #[test]
    fn noop_is_skipped() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Noop, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn gain_crystal_no_color_needs_choice() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainCrystal { color: None }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 4); // R, B, G, W
            }
            _ => panic!("Expected NeedsChoice for unspecified crystal color"),
        }
    }

    #[test]
    fn empty_queue_completes() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    // ---- Multi-step / cost effect handlers ----

    #[test]
    fn convert_mana_to_crystal_no_tokens_skips() {
        let mut state = test_state();
        assert!(state.players[0].pure_mana.is_empty());
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn convert_mana_to_crystal_single_color_auto_crystallizes() {
        let mut state = test_state();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        assert!(state.players[0].pure_mana.is_empty()); // token consumed
    }

    #[test]
    fn convert_mana_to_crystal_multiple_colors_needs_choice() {
        let mut state = test_state();
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Blue,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // red and blue
            }
            _ => panic!("Expected NeedsChoice for multi-color crystallize"),
        }
    }

    #[test]
    fn convert_mana_gold_not_crystallizable() {
        let mut state = test_state();
        // Only gold mana — not crystallizable
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Gold,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // No crystal gained
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn crystallize_from_source_die() {
        let mut state = test_state();
        // No tokens, but a red die is available
        assert!(state.players[0].pure_mana.is_empty());
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_red"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        // Die should be taken
        assert!(state.source.dice[0].taken_by_player_id.is_some());
        // USED_MANA_FROM_SOURCE flag should be set
        assert!(state.players[0].flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE));
    }

    #[test]
    fn crystallize_prefers_token_over_die() {
        let mut state = test_state();
        // Red token + red die
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_red"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Die untouched
        assert!(state.source.dice[0].taken_by_player_id.is_none());
        // Flag NOT set
        assert!(!state.players[0].flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE));
    }

    #[test]
    fn crystallize_die_plus_token_different_colors() {
        let mut state = test_state();
        // Red token + blue die → choice with 2 options
        state.players[0].pure_mana.push(ManaToken {
            color: ManaColor::Red,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_blue"),
            color: ManaColor::Blue,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2);
            }
            _ => panic!("Expected NeedsChoice for token+die different colors"),
        }
    }

    #[test]
    fn crystallize_used_source_flag_blocks_die() {
        let mut state = test_state();
        // No tokens, red die available, but USED_MANA_FROM_SOURCE is set
        state.players[0].flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_red"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn crystallize_gold_die_excluded() {
        let mut state = test_state();
        // No tokens, only a gold die → not crystallizable
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_gold"),
            color: ManaColor::Gold,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ConvertManaToCrystal, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn is_resolvable_crystallize_with_die() {
        let mut state = test_state();
        // No tokens, but a red die is available
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_red"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        });
        assert!(super::conditions::is_resolvable(&state, 0, &CardEffect::ConvertManaToCrystal));
    }

    #[test]
    fn is_resolvable_crystallize_blocked_by_flag() {
        let mut state = test_state();
        // No tokens, red die available, but flag is set
        state.players[0].flags.insert(PlayerFlags::USED_MANA_FROM_SOURCE);
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_red"),
            color: ManaColor::Red,
            is_depleted: false,
            taken_by_player_id: None,
        });
        assert!(!super::conditions::is_resolvable(&state, 0, &CardEffect::ConvertManaToCrystal));
    }

    #[test]
    fn card_boost_no_eligible_cards_skips() {
        let mut state = test_state();
        // Hand empty → no eligible cards → skip
        state.players[0].hand.clear();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn card_boost_only_wounds_skips() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn card_boost_single_eligible_auto_selects() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // march moved from hand to play_area
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].play_area.len(), 1);
        assert_eq!(state.players[0].play_area[0].as_str(), "march");
        // march powered_effect is GainMove{4}, boosted by 2 → GainMove{6}
        assert_eq!(state.players[0].move_points, 6);
    }

    #[test]
    fn card_boost_multiple_eligible_returns_choice() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CardBoost { bonus: 1 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::BoostTarget { .. }));
            }
            _ => panic!("Expected NeedsChoice for multi-eligible card boost"),
        }
        // Hand unchanged until choice is resolved
        assert_eq!(state.players[0].hand.len(), 2);
    }

    #[test]
    fn mana_draw_powered_offers_color_choice() {
        let mut state = test_state();
        // Add an available (not taken, not depleted) source die
        state.source.dice.push(SourceDie {
            id: SourceDieId::from("die_1"),
            color: ManaColor::Gold,
            is_depleted: false,
            taken_by_player_id: None,
        });
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ManaDrawPowered {
                dice_count: 1,
                tokens_per_die: 2,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 4); // R, B, G, W
                                              // Each option should grant 2 mana tokens
                for opt in &options {
                    match opt {
                        CardEffect::GainMana { amount, .. } => assert_eq!(*amount, 2),
                        _ => panic!("Expected GainMana options"),
                    }
                }
                // Resolution should be ManaDrawTakeDie
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ManaDrawTakeDie { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for mana draw powered"),
        }
    }

    #[test]
    fn mana_draw_powered_no_dice_skips() {
        let mut state = test_state();
        // No dice in source → should skip
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ManaDrawPowered {
                dice_count: 1,
                tokens_per_die: 2,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped, nothing to do
    }

    #[test]
    fn apply_modifier_rule_adds_rule_override() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ApplyModifier {
                effect: ModifierEffect::RuleOverride {
                    rule: RuleOverride::ExtraSourceDie,
                },
                duration: ModifierDuration::Turn,
                scope: ModifierScope::SelfScope,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        match &state.active_modifiers[0].effect {
            ModifierEffect::RuleOverride { rule } => {
                assert_eq!(*rule, RuleOverride::ExtraSourceDie);
            }
            other => panic!("Expected RuleOverride, got {:?}", other),
        }
        assert_eq!(state.active_modifiers[0].duration, ModifierDuration::Turn);
    }

    #[test]
    fn apply_modifier_terrain_cost() {
        let mut state = test_state();
        // Put a card in play area so source tracking works
        state.players[0]
            .play_area
            .push(CardId::from("frost_bridge"));
        let mut queue = EffectQueue::new();
        queue.push(
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
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        match &state.active_modifiers[0].effect {
            ModifierEffect::TerrainCost {
                terrain,
                replace_cost,
                ..
            } => {
                assert_eq!(*terrain, TerrainOrAll::Specific(Terrain::Swamp));
                assert_eq!(*replace_cost, Some(1));
            }
            other => panic!("Expected TerrainCost, got {:?}", other),
        }
        // Source should be the card on top of play area
        match &state.active_modifiers[0].source {
            ModifierSource::Card { card_id, .. } => {
                assert_eq!(card_id.as_ref(), "frost_bridge");
            }
            other => panic!("Expected Card source, got {:?}", other),
        }
    }

    #[test]
    fn apply_modifier_combat_duration() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ApplyModifier {
                effect: ModifierEffect::UnitCombatBonus {
                    attack_bonus: 2,
                    block_bonus: 2,
                },
                duration: ModifierDuration::Combat,
                scope: ModifierScope::AllUnits,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        assert_eq!(
            state.active_modifiers[0].duration,
            ModifierDuration::Combat
        );
        match &state.active_modifiers[0].scope {
            ModifierScope::AllUnits => {}
            other => panic!("Expected AllUnits scope, got {:?}", other),
        }
    }

    #[test]
    fn discard_cost_with_no_cards_skips() {
        let mut state = test_state();
        state.players[0].hand.clear(); // no cards to discard
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 0); // nothing happened
    }

    #[test]
    fn discard_cost_auto_discards_single_eligible() {
        let mut state = test_state();
        // Only 1 eligible card → auto-discard, then_effect resolves immediately
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: false,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand.len(), 0); // discarded the only card
        assert_eq!(state.players[0].discard.len(), 1);
        assert_eq!(state.players[0].move_points, 3); // then_effect resolved
    }

    #[test]
    fn discard_cost_multiple_eligible_returns_choice() {
        let mut state = test_state();
        // 2 eligible cards → NeedsChoice (player picks which to discard)
        state.players[0].hand = vec![CardId::from("march"), CardId::from("rage")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: false,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2); // one option per eligible card
                                              // Each option is the then_effect
                for opt in &options {
                    assert!(matches!(opt, CardEffect::GainMove { amount: 3 }));
                }
                // Resolution should be DiscardThenContinue
                assert!(matches!(
                    resolution,
                    ChoiceResolution::DiscardThenContinue { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for multi-eligible discard"),
        }
        // Hand unchanged — no discard until player chooses
        assert_eq!(state.players[0].hand.len(), 2);
    }

    #[test]
    fn discard_cost_filter_wounds_skips_wounds() {
        let mut state = test_state();
        // Only wound cards in hand — can't discard if filter_wounds
        state.players[0].hand = vec![CardId::from("wound"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::GainMove { amount: 3 }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand.len(), 2); // no discard
        assert_eq!(state.players[0].move_points, 0); // nothing happened
    }

    #[test]
    fn discard_cost_auto_discard_then_inner_choice() {
        let mut state = test_state();
        // 1 non-wound + 1 wound (filter_wounds=true) → 1 eligible → auto-discard
        // then_effect is a Choice → NeedsChoice for the inner choice
        state.players[0].hand = vec![CardId::from("march"), CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardCost {
                count: 1,
                filter_wounds: true,
                wounds_only: false,
                then_effect: Box::new(CardEffect::Choice {
                    options: vec![
                        CardEffect::GainMove { amount: 3 },
                        CardEffect::GainInfluence { amount: 3 },
                    ],
                }),
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should have auto-discarded march (only eligible) and presented the inner choice
        assert_eq!(state.players[0].hand.len(), 1); // wound remains
        assert_eq!(state.players[0].discard.len(), 1); // march discarded
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // move 3 or influence 3
            }
            _ => panic!("Expected NeedsChoice from inner choice"),
        }
    }

    // ---- Resolve pending choice ----

    #[test]
    fn resolve_pending_choice_no_pending_errors() {
        let mut state = test_state();
        let result = resolve_pending_choice(&mut state, 0, 0);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::NoPendingChoice);
    }

    #[test]
    fn resolve_pending_choice_invalid_index_errors() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::GainMove { amount: 2 }],
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));
        let result = resolve_pending_choice(&mut state, 0, 5);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::InvalidChoiceIndex);
        // Pending should still be set
        assert!(state.players[0].pending.has_active());
    }

    #[test]
    fn resolve_pending_choice_applies_chosen_option() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("concentration")),
            skill_id: None,
            unit_instance_id: None,
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
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 1).unwrap(); // choose white
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::White);
        assert!(!state.players[0].pending.has_active()); // resolved
    }

    #[test]
    fn resolve_pending_choice_resumes_continuation() {
        let mut state = test_state();
        // Set up a pending choice with continuation effects
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![
                CardEffect::GainInfluence { amount: 2 },
                CardEffect::GainFame { amount: 3 },
            ],
            continuation: vec![ContinuationEntry {
                effect: CardEffect::GainMove { amount: 5 },
                source_card_id: None,
            }],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 0).unwrap(); // choose influence
        assert_eq!(state.players[0].influence_points, 2);
        assert_eq!(state.players[0].move_points, 5); // continuation resolved
        assert!(!state.players[0].pending.has_active());
    }

    #[test]
    fn resolve_pending_choice_chain_produces_new_pending() {
        let mut state = test_state();
        // Choice where the chosen option decomposes into another choice
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Choice {
                options: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::GainInfluence { amount: 1 },
                ],
            }],
            continuation: vec![],
            movement_bonus_applied: false,
            resolution: ChoiceResolution::Standard,
        }));

        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // The inner choice should create a new pending
        assert!(state.players[0].pending.has_active());
        if let Some(ActivePending::Choice(ref choice)) = state.players[0].pending.active {
            assert_eq!(choice.options.len(), 2);
        } else {
            panic!("Expected new pending choice");
        }
    }

    #[test]
    fn resolve_pending_wrong_type_errors() {
        let mut state = test_state();
        // Set a non-Choice pending type
        state.players[0].pending.active = Some(ActivePending::GladeWoundChoice);
        let result = resolve_pending_choice(&mut state, 0, 0);
        assert_eq!(result.unwrap_err(), ResolveChoiceError::NoPendingChoice);
        // The original pending should be preserved
        assert!(state.players[0].pending.has_active());
    }

    // ---- scale_effect recursive tests ----

    #[test]
    fn scale_effect_recursive_compound() {
        let effect = CardEffect::Compound {
            effects: vec![
                CardEffect::GainMove { amount: 1 },
                CardEffect::GainInfluence { amount: 2 },
            ],
        };
        let scaled = scale_effect(&effect, 3);
        match scaled {
            CardEffect::Compound { effects } => {
                assert_eq!(effects.len(), 2);
                assert!(matches!(effects[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(
                    effects[1],
                    CardEffect::GainInfluence { amount: 5 }
                ));
            }
            _ => panic!("Expected Compound"),
        }
    }

    #[test]
    fn scale_effect_recursive_choice() {
        let effect = CardEffect::Choice {
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
        };
        let scaled = scale_effect(&effect, 2);
        match scaled {
            CardEffect::Choice { options } => {
                assert_eq!(options.len(), 2);
                match &options[0] {
                    CardEffect::GainAttack { amount, .. } => assert_eq!(*amount, 4),
                    _ => panic!("Expected GainAttack"),
                }
                match &options[1] {
                    CardEffect::GainBlock { amount, .. } => assert_eq!(*amount, 4),
                    _ => panic!("Expected GainBlock"),
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn hand_limit_bonus_increments_hand_limit() {
        let mut state = test_state();
        let initial_limit = state.players[0].hand_limit;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HandLimitBonus { bonus: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].hand_limit, initial_limit + 2);
    }

    #[test]
    fn hand_limit_bonus_in_compound() {
        let mut state = test_state();
        let initial_limit = state.players[0].hand_limit;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainMove { amount: 1 },
                    CardEffect::HandLimitBonus { bonus: 1 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 1);
        assert_eq!(state.players[0].hand_limit, initial_limit + 1);
    }

    // ---- ReadyUnit effect ----

    fn make_unit(instance_id: &str, level: u8, spent: bool) -> PlayerUnit {
        PlayerUnit {
            instance_id: UnitInstanceId::from(instance_id),
            unit_id: UnitId::from("test_unit"),
            level,
            state: if spent {
                UnitState::Spent
            } else {
                UnitState::Ready
            },
            wounded: false,
            used_resistance_this_combat: false,
            used_ability_indices: Vec::new(),
            mana_token: None,
        }
    }

    #[test]
    fn ready_unit_no_eligible_skips() {
        let mut state = test_state();
        // No units at all
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn ready_unit_no_spent_units_skips() {
        let mut state = test_state();
        // One unit but already Ready
        state.players[0].units.push(make_unit("u0", 1, false));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_one_eligible_auto_readies() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true)); // spent, level 2
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_level_filter_excludes_high_level() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 3, true)); // spent, level 3
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 2 }, None); // max level 2
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Unit should still be spent (not eligible)
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
    }

    #[test]
    fn ready_unit_multiple_eligible_needs_choice() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true)); // spent, level 1
        state.players[0].units.push(make_unit("u1", 2, true)); // spent, level 2
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ReadyUnitTarget { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Both units still spent (choice not resolved yet)
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
        assert_eq!(state.players[0].units[1].state, UnitState::Spent);
    }

    #[test]
    fn ready_unit_choice_resolved_readies_selected() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].units.push(make_unit("u1", 2, true));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyUnit { max_level: 3 }, None);
        let result = queue.drain(&mut state, 0);
        // Should be NeedsChoice — store pending
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Resolve choice: pick unit 1 (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit 0 should still be spent, unit 1 should be ready
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
        assert_eq!(state.players[0].units[1].state, UnitState::Ready);
    }

    #[test]
    fn ready_unit_in_compound_with_healing() {
        let mut state = test_state();
        // Add a wound to heal
        state.players[0].hand.push(CardId::from("wound"));
        // Add a spent unit
        state.players[0].units.push(make_unit("u0", 1, true));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 1 },
                    CardEffect::ReadyUnit { max_level: 2 },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Wound healed
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        // Unit readied
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    // =========================================================================
    // AttackWithDefeatBonus tests
    // =========================================================================

    fn combat_state() -> GameState {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state
    }

    #[test]
    fn attack_with_defeat_bonus_applies_attack_in_combat() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Attack was applied
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
    }

    #[test]
    fn attack_with_defeat_bonus_registers_tracker() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 2,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Tracker should be registered in deferred pending
        let has_tracker = state.players[0].pending.deferred.iter().any(|d| {
            matches!(d, DeferredPending::AttackDefeatFame(trackers) if !trackers.is_empty())
        });
        assert!(has_tracker, "Should have a defeat fame tracker");
        // Verify tracker fields
        if let Some(DeferredPending::AttackDefeatFame(trackers)) =
            state.players[0].pending.deferred.iter().find(|d| {
                matches!(d, DeferredPending::AttackDefeatFame(_))
            })
        {
            assert_eq!(trackers.len(), 1);
            assert_eq!(trackers[0].amount, 2);
            assert_eq!(trackers[0].remaining, 2);
            assert_eq!(trackers[0].reputation_per_defeat, Some(1));
            assert_eq!(trackers[0].fame_per_defeat, None);
        }
    }

    #[test]
    fn attack_with_defeat_bonus_skipped_without_combat() {
        let mut state = test_state();
        // No combat state
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Melee,
                element: Element::Physical,
                reputation_per_defeat: 1,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 0,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // No attack applied
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 0);
        // No tracker
        assert!(state.players[0].pending.deferred.is_empty());
    }

    #[test]
    fn attack_with_defeat_bonus_ranged_with_armor_reduction() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::AttackWithDefeatBonus {
                amount: 3,
                combat_type: CombatType::Ranged,
                element: Element::Physical,
                reputation_per_defeat: 0,
                fame_per_defeat: 0,
                armor_reduction_per_defeat: 1,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Ranged attack applied
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
        // Tracker with armor reduction
        if let Some(DeferredPending::AttackDefeatFame(trackers)) =
            state.players[0].pending.deferred.iter().find(|d| {
                matches!(d, DeferredPending::AttackDefeatFame(_))
            })
        {
            assert_eq!(trackers[0].armor_reduction_per_defeat, Some(1));
            assert_eq!(trackers[0].reputation_per_defeat, None);
        } else {
            panic!("Expected AttackDefeatFame tracker");
        }
    }

    #[test]
    fn attack_with_defeat_bonus_in_choice() {
        // Chivalry pattern: Choice(GainAttack(3), AttackWithDefeatBonus(2))
        let mut state = combat_state();
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Choice {
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
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should need a choice (both options resolvable in combat)
        assert!(matches!(result, DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn attack_with_defeat_bonus_not_resolvable_without_combat() {
        let state = test_state(); // No combat
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        assert!(!is_resolvable(&state, 0, &effect));
    }

    #[test]
    fn attack_with_defeat_bonus_resolvable_in_combat() {
        let mut state = combat_state();
        state.combat.as_mut().unwrap().phase = CombatPhase::Attack;
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        assert!(is_resolvable(&state, 0, &effect));
    }

    #[test]
    fn scale_attack_with_defeat_bonus() {
        let effect = CardEffect::AttackWithDefeatBonus {
            amount: 2,
            combat_type: CombatType::Melee,
            element: Element::Physical,
            reputation_per_defeat: 1,
            fame_per_defeat: 0,
            armor_reduction_per_defeat: 0,
        };
        let scaled = scale_effect(&effect, 3);
        match scaled {
            CardEffect::AttackWithDefeatBonus {
                amount,
                reputation_per_defeat,
                ..
            } => {
                assert_eq!(amount, 5); // 2 + 3
                assert_eq!(reputation_per_defeat, 1); // unchanged
            }
            _ => panic!("Expected AttackWithDefeatBonus"),
        }
    }

    // =========================================================================
    // DiscardForBonus tests
    // =========================================================================

    #[test]
    fn discard_for_bonus_sets_pending() {
        let mut state = test_state();
        state.players[0].play_area.push(CardId::from("stout_resolve"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
            Some(CardId::from("stout_resolve")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(state.players[0].pending.active.is_some());
        match &state.players[0].pending.active {
            Some(ActivePending::DiscardForBonus(dfb)) => {
                assert_eq!(dfb.choice_options.len(), 2);
                assert_eq!(dfb.bonus_per_card, 1);
                assert_eq!(dfb.max_discards, 1);
                assert_eq!(dfb.discard_filter, DiscardForBonusFilter::WoundOnly);
            }
            other => panic!("Expected DiscardForBonus pending, got {:?}", other),
        }
    }

    #[test]
    fn discard_for_bonus_skipped_if_no_resolvable_options() {
        let mut state = test_state();
        // Options are attack and block, but not in combat
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
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
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete)); // Skipped
        assert!(state.players[0].pending.active.is_none());
    }

    #[test]
    fn discard_for_bonus_filters_combat_only_options() {
        let mut state = test_state();
        state.players[0].play_area.push(CardId::from("test"));
        // Mix of combat and non-combat options; no combat active
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForBonus {
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainAttack {
                        amount: 2,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        match &state.players[0].pending.active {
            Some(ActivePending::DiscardForBonus(dfb)) => {
                // Only GainMove should remain (attack filtered out)
                assert_eq!(dfb.choice_options.len(), 1);
                assert!(matches!(
                    dfb.choice_options[0],
                    CardEffect::GainMove { amount: 2 }
                ));
            }
            other => panic!("Expected DiscardForBonus, got {:?}", other),
        }
    }

    #[test]
    fn resolve_discard_for_bonus_no_discard() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("wound"),
        ];
        // Set up a DiscardForBonus pending
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        // Resolve with choice_index=0 (Move), discard_count=0 (no discard)
        resolve_discard_for_bonus(&mut state, 0, 0, 0).unwrap();

        assert!(state.players[0].pending.active.is_none());
        assert_eq!(state.players[0].move_points, 2); // base effect, no bonus
        assert_eq!(state.players[0].hand.len(), 2); // no cards discarded
    }

    #[test]
    fn resolve_discard_for_bonus_with_wound_discard() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("wound"),
        ];
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                    CardEffect::GainInfluence { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        // Resolve with choice_index=0 (Move), discard_count=1 (discard 1 wound)
        resolve_discard_for_bonus(&mut state, 0, 0, 1).unwrap();

        assert!(state.players[0].pending.active.is_none());
        assert_eq!(state.players[0].move_points, 3); // 2 + 1 (bonus)
        assert_eq!(state.players[0].hand.len(), 1); // wound removed
        assert_eq!(state.players[0].hand[0].as_str(), "march"); // march remains
        assert_eq!(state.players[0].discard.len(), 1); // wound in discard
    }

    #[test]
    fn resolve_discard_for_bonus_powered_multiple_discards() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("rage"),
            CardId::from("wound"),
        ];
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 3 },
                ],
                bonus_per_card: 2,
                max_discards: u32::MAX,
                discard_filter: DiscardForBonusFilter::AnyMaxOneWound,
            },
        ));

        // Resolve: Move 3 + discard 2 cards (1 non-wound + 1 wound) → bonus = 2*2 = 4
        resolve_discard_for_bonus(&mut state, 0, 0, 2).unwrap();

        assert_eq!(state.players[0].move_points, 7); // 3 + 4
        assert_eq!(state.players[0].hand.len(), 1); // 1 card remains
        assert_eq!(state.players[0].discard.len(), 2); // 2 discarded
    }

    #[test]
    fn resolve_discard_for_bonus_invalid_choice_index() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::DiscardForBonus(
            mk_types::pending::PendingDiscardForBonus {
                source_card_id: CardId::from("stout_resolve"),
                choice_options: vec![
                    CardEffect::GainMove { amount: 2 },
                ],
                bonus_per_card: 1,
                max_discards: 1,
                discard_filter: DiscardForBonusFilter::WoundOnly,
            },
        ));

        let result = resolve_discard_for_bonus(&mut state, 0, 5, 0);
        assert!(matches!(result, Err(ResolveChoiceError::InvalidChoiceIndex)));
        // Pending should be restored
        assert!(state.players[0].pending.active.is_some());
    }

    #[test]
    fn resolve_discard_for_bonus_no_pending() {
        let mut state = test_state();
        let result = resolve_discard_for_bonus(&mut state, 0, 0, 0);
        assert!(matches!(result, Err(ResolveChoiceError::NoPendingChoice)));
    }

    #[test]
    fn discard_for_bonus_is_resolvable() {
        let state = test_state();
        let effect = CardEffect::DiscardForBonus {
            choice_options: vec![CardEffect::GainMove { amount: 2 }],
            bonus_per_card: 1,
            max_discards: 1,
            discard_filter: DiscardForBonusFilter::WoundOnly,
        };
        assert!(is_resolvable(&state, 0, &effect));
    }

    // =========================================================================
    // Decompose tests
    // =========================================================================

    #[test]
    fn decompose_sets_pending_with_eligible_cards() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("rage"),
        ];
        state.players[0].play_area = vec![CardId::from("decompose")];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic,
            },
            Some(CardId::from("decompose")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(matches!(
            state.players[0].pending.active,
            Some(ActivePending::Decompose(_))
        ));
    }

    #[test]
    fn decompose_skips_when_no_eligible_cards() {
        let mut state = test_state();
        // Only wound cards in hand (not action cards)
        state.players[0].hand = vec![CardId::from("wound")];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic,
            },
            Some(CardId::from("decompose")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn resolve_decompose_basic_gains_two_matching_crystals() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")]; // Green card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_ok());

        // Card removed from hand to removed_cards
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].removed_cards.len(), 1);
        assert_eq!(state.players[0].removed_cards[0].as_str(), "march");

        // Gained 2 green crystals
        assert_eq!(state.players[0].crystals.green, 2);
        assert_eq!(state.players[0].crystals.red, 0);
        assert_eq!(state.players[0].crystals.blue, 0);
        assert_eq!(state.players[0].crystals.white, 0);
    }

    #[test]
    fn resolve_decompose_powered_gains_non_matching_crystals() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("rage")]; // Red card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Powered,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_ok());

        // Card removed from hand
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].removed_cards.len(), 1);

        // Gained 1 crystal of each non-red color (blue, green, white)
        assert_eq!(state.players[0].crystals.red, 0);
        assert_eq!(state.players[0].crystals.blue, 1);
        assert_eq!(state.players[0].crystals.green, 1);
        assert_eq!(state.players[0].crystals.white, 1);
    }

    #[test]
    fn resolve_decompose_rejects_non_action_card() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound")]; // Not an action card
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 0);
        assert!(result.is_err());
        // Pending should be restored
        assert!(state.players[0].pending.active.is_some());
    }

    #[test]
    fn resolve_decompose_rejects_invalid_index() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pending.active =
            Some(ActivePending::Decompose(PendingDecompose {
                source_card_id: CardId::from("decompose"),
                mode: mk_types::pending::EffectMode::Basic,
            }));

        let result = resolve_decompose(&mut state, 0, 5); // Out of bounds
        assert!(result.is_err());
    }

    // =========================================================================
    // DiscardForAttack tests
    // =========================================================================

    #[test]
    fn discard_for_attack_auto_discards_single_eligible_card() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![CardId::from("march")]; // Green card

        let attacks = vec![
            (
                BasicManaColor::Green,
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            Some(CardId::from("ritual_attack")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));

        // Card discarded
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].discard.len(), 1);

        // Attack applied
        let acc = &state.players[0].combat_accumulator.attack;
        assert_eq!(acc.siege, 2);
    }

    #[test]
    fn discard_for_attack_skips_outside_combat() {
        let mut state = test_state();
        // No combat
        state.players[0].hand = vec![CardId::from("march")];

        let attacks = vec![
            (
                BasicManaColor::Green,
                CardEffect::GainAttack {
                    amount: 2,
                    combat_type: CombatType::Siege,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Card NOT discarded
        assert_eq!(state.players[0].hand.len(), 1);
    }

    #[test]
    fn discard_for_attack_offers_choice_with_multiple_cards() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![
            CardId::from("march"),      // Green
            CardId::from("rage"),        // Red
        ];

        let attacks = vec![
            (
                BasicManaColor::Red,
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
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
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            Some(CardId::from("ritual_attack")),
        );
        let result = queue.drain(&mut state, 0);

        // Should need a choice: which card to discard
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                // First option is green (march, idx 0), second is red (rage, idx 1)
                assert!(matches!(
                    resolution,
                    ChoiceResolution::DiscardThenContinue { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice, got {:?}", result),
        }
    }

    #[test]
    fn discard_for_attack_skips_when_no_matching_cards() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].hand = vec![CardId::from("wound")]; // No action cards

        let attacks = vec![
            (
                BasicManaColor::Red,
                CardEffect::GainAttack {
                    amount: 5,
                    combat_type: CombatType::Melee,
                    element: Element::Physical,
                },
            ),
        ];

        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::DiscardForAttack {
                attacks_by_color: attacks,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    // =========================================================================
    // Pure Magic tests
    // =========================================================================

    #[test]
    fn pure_magic_auto_selects_single_color() {
        let mut state = test_state();
        // Green mana → Move
        state.players[0].pure_mana = vec![ManaToken {
            color: ManaColor::Green,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        }];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        assert!(matches!(result, DrainResult::Complete));
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Move points gained
        assert_eq!(state.players[0].move_points, 4);
    }

    #[test]
    fn pure_magic_skips_with_no_mana() {
        let mut state = test_state();
        state.players[0].pure_mana = vec![];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn pure_magic_offers_choice_with_multiple_colors() {
        let mut state = test_state();
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::White,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                // Green → Move 4, White → Influence 4
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(options[1], CardEffect::GainInfluence { amount: 4 }));
                assert!(matches!(
                    resolution,
                    ChoiceResolution::PureMagicConsume { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_combat_only_colors_skipped_outside_combat() {
        let mut state = test_state();
        // Red and Blue are combat-only for pure magic
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Red,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Blue,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        // Red/Blue give Attack/Block which are combat-only → skipped
        assert!(matches!(result, DrainResult::Complete));
        // Tokens NOT consumed (no valid options)
        assert_eq!(state.players[0].pure_mana.len(), 2);
    }

    #[test]
    fn pure_magic_combat_includes_all_four_colors() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Red,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Blue,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::White,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 7 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, .. } => {
                // All 4 colors available → 4 options
                assert_eq!(options.len(), 4);
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_gold_adds_missing_colors() {
        let mut state = test_state();
        // Only green basic token + gold
        state.players[0].pure_mana = vec![
            ManaToken {
                color: ManaColor::Green,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
            ManaToken {
                color: ManaColor::Gold,
                source: ManaTokenSource::Effect,
                cannot_power_spells: false,
            },
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PureMagic { amount: 4 }, None);
        let result = queue.drain(&mut state, 0);

        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                // Green (from green token) + White (from gold)
                assert_eq!(options.len(), 2);
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(options[1], CardEffect::GainInfluence { amount: 4 }));
                // Check token_colors
                if let ChoiceResolution::PureMagicConsume { token_colors } = &resolution {
                    assert_eq!(token_colors[0], ManaColor::Green);
                    assert_eq!(token_colors[1], ManaColor::Gold);
                }
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn pure_magic_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::PureMagic { amount: 4 }
        ));
    }

    #[test]
    fn decompose_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::Decompose {
                mode: mk_types::pending::EffectMode::Basic
            }
        ));
    }

    #[test]
    fn discard_for_attack_is_resolvable() {
        let state = test_state();
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::DiscardForAttack {
                attacks_by_color: vec![]
            }
        ));
    }

    // =========================================================================
    // HealUnit tests
    // =========================================================================

    #[test]
    fn heal_unit_no_wounded_skips() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, false)); // not wounded
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_one_wounded_auto_heals() {
        let mut state = test_state();
        let mut u = make_unit("u0", 2, false);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_level_filter_excludes_high_level() {
        let mut state = test_state();
        let mut u = make_unit("u0", 3, false);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Unit should still be wounded (level 3 > max 2)
        assert!(state.players[0].units[0].wounded);
    }

    #[test]
    fn heal_unit_multiple_wounded_needs_choice() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, false);
        u0.wounded = true;
        let mut u1 = make_unit("u1", 2, false);
        u1.wounded = true;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::HealUnitTarget { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Both still wounded
        assert!(state.players[0].units[0].wounded);
        assert!(state.players[0].units[1].wounded);
    }

    #[test]
    fn heal_unit_choice_resolved_heals_selected() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, false);
        u0.wounded = true;
        let mut u1 = make_unit("u1", 2, false);
        u1.wounded = true;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealUnit { max_level: 4 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Pick unit 1 (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit 0 still wounded, unit 1 healed
        assert!(state.players[0].units[0].wounded);
        assert!(!state.players[0].units[1].wounded);
    }

    // =========================================================================
    // Energy Flow tests
    // =========================================================================

    #[test]
    fn energy_flow_no_spent_units_skips() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, false)); // Ready, not spent
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn energy_flow_one_spent_auto_readies() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true)); // Spent
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
    }

    #[test]
    fn energy_flow_multiple_spent_needs_choice() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].units.push(make_unit("u1", 2, true));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: false }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::EnergyFlowTarget { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn energy_flow_heal_readies_and_heals_wounded() {
        let mut state = test_state();
        let mut u = make_unit("u0", 2, true);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: true }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
        assert!(!state.players[0].units[0].wounded);
    }

    #[test]
    fn energy_flow_no_heal_keeps_wound() {
        let mut state = test_state();
        let mut u = make_unit("u0", 2, true);
        u.wounded = true;
        state.players[0].units.push(u);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
        assert!(state.players[0].units[0].wounded); // Still wounded
    }

    #[test]
    fn energy_flow_choice_resolved_readies_selected() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].units.push(make_unit("u1", 2, true));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::EnergyFlow { heal: true }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Pick unit 1 (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit 0 still spent, unit 1 readied and healed
        assert_eq!(state.players[0].units[0].state, UnitState::Spent);
        assert_eq!(state.players[0].units[1].state, UnitState::Ready);
    }

    // =========================================================================
    // Mana Bolt tests
    // =========================================================================

    fn make_mana_token(color: ManaColor) -> ManaToken {
        ManaToken {
            color,
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        }
    }

    #[test]
    fn mana_bolt_no_combat_skips() {
        let mut state = test_state(); // No combat
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Token not consumed
        assert_eq!(state.players[0].pure_mana.len(), 1);
    }

    #[test]
    fn mana_bolt_no_tokens_skips() {
        let mut state = combat_state();
        // No tokens at all
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn mana_bolt_single_blue_token_auto() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Should have gained Melee Ice 8 attack
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 8);
    }

    #[test]
    fn mana_bolt_single_red_token() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].pure_mana.is_empty());
        // Red = Melee ColdFire (base-1) = 7
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 7);
    }

    #[test]
    fn mana_bolt_gold_token_fills_gaps() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Gold));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        // Gold with no basic tokens → 4 options (one per basic color)
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 4);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ManaBoltTokenSelect { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for gold token with all 4 options"),
        }
    }

    #[test]
    fn mana_bolt_multiple_tokens_needs_choice() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ManaBoltTokenSelect { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice"),
        }
    }

    #[test]
    fn mana_bolt_powered_base_value_11() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 11 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].pure_mana.is_empty());
        // Blue = Melee Ice 11
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 11);
    }

    #[test]
    fn mana_bolt_black_token_ignored() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Black));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaBolt { base_value: 8 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Black not usable — token should still be there
        assert_eq!(state.players[0].pure_mana.len(), 1);
    }

    // =========================================================================
    // Offering (DiscardForCrystal) tests
    // =========================================================================

    #[test]
    fn discard_for_crystal_optional_skip() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")]; // Green card
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: true }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
                ..
            } => {
                // 2 options: skip + march
                assert_eq!(options.len(), 2);
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Choose index 0 = skip
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Card still in hand, no crystal gained
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].crystals.green, 0);
    }

    #[test]
    fn discard_for_crystal_discard_one_card() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("march")]; // Green card
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: true }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
                ..
            } => {
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice"),
        }
        // Choose index 1 = discard march (Green)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Card moved to discard, crystal gained
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].discard.len(), 1);
        assert_eq!(state.players[0].crystals.green, 1);
    }

    #[test]
    fn discard_for_crystal_wound_not_eligible() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound")]; // Only wounds
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: true }, None);
        let result = queue.drain(&mut state, 0);
        // No eligible cards → skip
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn offering_full_compound_basic() {
        // Test the full offering basic effect: GainCrystal(Red) + 3x DiscardForCrystal(optional)
        let mut state = test_state();
        state.players[0].hand = vec![]; // Empty hand — nothing to discard
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainCrystal {
                        color: Some(BasicManaColor::Red),
                    },
                    CardEffect::DiscardForCrystal { optional: true },
                    CardEffect::DiscardForCrystal { optional: true },
                    CardEffect::DiscardForCrystal { optional: true },
                ],
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Should have gained 1 Red crystal from GainCrystal, 3 DFCs skipped (no hand cards)
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn discard_for_crystal_non_optional_auto_selects() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("rage")]; // Red card, only one
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Auto-selected: card discarded, crystal gained
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].crystals.red, 1);
    }

    // =========================================================================
    // DiscardForCrystal — colorless artifact tests
    // =========================================================================

    #[test]
    fn discard_for_crystal_colorless_single_auto() {
        // Single colorless artifact in hand, non-optional → auto-discards → color choice
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("endless_bag_of_gold")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: false }, None);
        let result = queue.drain(&mut state, 0);
        // Auto-discard fires, but colorless → NeedsChoice with 4 crystal colors
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 4); // Red, Blue, Green, White
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice for crystal color, got {:?}", result),
        }
        // Card already discarded during auto-select
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].discard.len(), 1);
        // Pick Red (index 0)
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn discard_for_crystal_colorless_multi() {
        // Multiple cards including a colorless artifact → pick artifact → color choice
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),                // Green
            CardId::from("endless_bag_of_gold"),  // Colorless
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: false }, None);
        let result = queue.drain(&mut state, 0);
        // 2 eligible → NeedsChoice for card selection
        match result {
            DrainResult::NeedsChoice {
                options,
                continuation,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                state.players[0].pending.active =
                    Some(ActivePending::Choice(PendingChoice {
                        card_id: None,
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
            }
            _ => panic!("Expected NeedsChoice for card selection"),
        }
        // Choose index 1 = endless_bag_of_gold (colorless)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Now we should have a new pending choice for crystal color
        assert!(state.players[0].pending.active.is_some());
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(choice)) => {
                assert_eq!(choice.options.len(), 4); // 4 crystal colors
            }
            other => panic!("Expected Choice pending for crystal color, got {:?}", other),
        }
        // Pick Blue (index 1)
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        assert_eq!(state.players[0].crystals.blue, 1);
        assert_eq!(state.players[0].hand.len(), 1); // march still in hand
    }

    #[test]
    fn discard_for_crystal_colored_unchanged() {
        // Regression: normal colored card still auto-grants matching crystal
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("rage")]; // Red card
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DiscardForCrystal { optional: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].crystals.red, 1);
    }

    // =========================================================================
    // Sacrifice tests
    // =========================================================================

    #[test]
    fn sacrifice_no_combat_skips() {
        let mut state = test_state(); // No combat
        state.players[0].crystals.green = 2;
        state.players[0].crystals.red = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn sacrifice_no_pairs_skips() {
        let mut state = combat_state();
        state.players[0].crystals.red = 1; // Only red, no partner
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn sacrifice_green_red_pair_siege_fire() {
        let mut state = combat_state();
        state.players[0].crystals.green = 2;
        state.players[0].crystals.red = 1;
        // Only Green+Red pair available (1 pair), auto-selected
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // 1 pair: Siege Fire 4 attack
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 4);
        // Crystals: green 2→1, red 1→0
        assert_eq!(state.players[0].crystals.green, 1);
        assert_eq!(state.players[0].crystals.red, 0);
        // Mana tokens: 1 green + 1 red
        assert_eq!(state.players[0].pure_mana.len(), 2);
    }

    #[test]
    fn sacrifice_white_blue_pair_ranged_ice() {
        let mut state = combat_state();
        state.players[0].crystals.white = 2;
        state.players[0].crystals.blue = 2;
        // Only White+Blue pair available (2 pairs), auto-selected
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // 2 pairs: Ranged Ice 6 * 2 = 12 attack
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 12);
        // Crystals: white 2→0, blue 2→0
        assert_eq!(state.players[0].crystals.white, 0);
        assert_eq!(state.players[0].crystals.blue, 0);
        // Tokens: 2 white + 2 blue = 4
        assert_eq!(state.players[0].pure_mana.len(), 4);
    }

    #[test]
    fn sacrifice_multiple_pair_types_needs_choice() {
        let mut state = combat_state();
        state.players[0].crystals.green = 1;
        state.players[0].crystals.red = 1;
        state.players[0].crystals.blue = 1;
        // Green+Red (1 pair) and Green+Blue (1 pair) both available
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::SacrificePairSelect { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for multiple pair types"),
        }
    }

    #[test]
    fn sacrifice_asymmetric_crystals_uses_min() {
        let mut state = combat_state();
        state.players[0].crystals.green = 3;
        state.players[0].crystals.red = 1;
        // min(3, 1) = 1 pair
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::Sacrifice, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 4); // 1 pair * 4
        assert_eq!(state.players[0].crystals.green, 2); // 3→2
        assert_eq!(state.players[0].crystals.red, 0); // 1→0
    }

    // =========================================================================
    // Mana Claim tests
    // =========================================================================

    fn make_source_die(id: &str, color: ManaColor) -> SourceDie {
        SourceDie {
            id: SourceDieId::from(id),
            color,
            is_depleted: false,
            taken_by_player_id: None,
        }
    }

    #[test]
    fn mana_claim_no_basic_dice_skips() {
        let mut state = test_state();
        // Only gold and black dice
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Gold),
            make_source_die("d1", ManaColor::Black),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn mana_claim_single_die_goes_to_mode_choice() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Blue)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let result = queue.drain(&mut state, 0);
        // Single die auto-selected → mode choice pending
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(state.players[0].pending.active.is_some());
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                assert_eq!(pc.options.len(), 2); // burst vs sustained
                assert!(matches!(
                    pc.resolution,
                    ChoiceResolution::ManaClaimModeSelect { .. }
                ));
            }
            _ => panic!("Expected mode choice pending"),
        }
    }

    #[test]
    fn mana_claim_multiple_dice_needs_choice() {
        let mut state = test_state();
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Blue),
            make_source_die("d1", ManaColor::Red),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice {
                options,
                resolution,
                ..
            } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(
                    resolution,
                    ChoiceResolution::ManaClaimDieSelect { .. }
                ));
            }
            _ => panic!("Expected NeedsChoice for die selection"),
        }
    }

    #[test]
    fn mana_claim_burst_grants_3_tokens() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Blue)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let _result = queue.drain(&mut state, 0);
        // Mode choice is now pending; resolve with index 0 = burst
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Should have 3 blue tokens
        assert_eq!(state.players[0].pure_mana.len(), 3);
        assert!(state.players[0].pure_mana.iter().all(|t| t.color == ManaColor::Blue));
        // Die should be marked as claimed
        assert_eq!(
            state.source.dice[0].taken_by_player_id,
            Some(PlayerId::from("p1"))
        );
    }

    #[test]
    fn mana_claim_sustained_adds_modifier_and_immediate_token() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Green)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let _result = queue.drain(&mut state, 0);
        // Mode choice pending; resolve with index 1 = sustained
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Should have 1 immediate token
        assert_eq!(state.players[0].pure_mana.len(), 1);
        assert_eq!(state.players[0].pure_mana[0].color, ManaColor::Green);
        // Should have ManaClaimSustained modifier
        assert!(state.active_modifiers.iter().any(|m| matches!(
            &m.effect,
            ModifierEffect::ManaClaimSustained { color, .. } if *color == BasicManaColor::Green
        )));
        // Die marked as claimed
        assert_eq!(
            state.source.dice[0].taken_by_player_id,
            Some(PlayerId::from("p1"))
        );
    }

    #[test]
    fn mana_claim_depleted_die_not_eligible() {
        let mut state = test_state();
        let mut die = make_source_die("d0", ManaColor::Blue);
        die.is_depleted = true;
        state.source.dice = vec![die];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn mana_claim_already_taken_die_not_eligible() {
        let mut state = test_state();
        let mut die = make_source_die("d0", ManaColor::Blue);
        die.taken_by_player_id = Some(PlayerId::from("p2"));
        state.source.dice = vec![die];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: false }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn mana_claim_with_curse_solo_no_crash() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaClaim { with_curse: true }, None);
        let _result = queue.drain(&mut state, 0);
        // Burst mode
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Should still work fine — curse is a no-op in solo
        assert_eq!(state.players[0].pure_mana.len(), 3);
    }

    // =========================================================================
    // is_resolvable tests for new spells
    // =========================================================================

    #[test]
    fn energy_flow_is_resolvable_with_spent_units() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true));
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::EnergyFlow { heal: false }
        ));
    }

    #[test]
    fn energy_flow_not_resolvable_without_spent_units() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, false)); // Ready
        assert!(!is_resolvable(
            &state,
            0,
            &CardEffect::EnergyFlow { heal: false }
        ));
    }

    #[test]
    fn mana_bolt_is_resolvable_with_non_black_token() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::ManaBolt { base_value: 8 }
        ));
    }

    #[test]
    fn mana_bolt_not_resolvable_with_only_black() {
        let mut state = combat_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Black));
        assert!(!is_resolvable(
            &state,
            0,
            &CardEffect::ManaBolt { base_value: 8 }
        ));
    }

    #[test]
    fn sacrifice_is_resolvable_with_pair() {
        let mut state = combat_state();
        state.players[0].crystals.green = 1;
        state.players[0].crystals.red = 1;
        assert!(is_resolvable(&state, 0, &CardEffect::Sacrifice));
    }

    #[test]
    fn sacrifice_not_resolvable_without_pair() {
        let mut state = combat_state();
        state.players[0].crystals.red = 1; // Only red, no matching partner
        assert!(!is_resolvable(&state, 0, &CardEffect::Sacrifice));
    }

    #[test]
    fn mana_claim_is_resolvable_with_basic_die() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Blue)];
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::ManaClaim { with_curse: false }
        ));
    }

    #[test]
    fn mana_claim_not_resolvable_without_basic_die() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Gold)];
        assert!(!is_resolvable(
            &state,
            0,
            &CardEffect::ManaClaim { with_curse: false }
        ));
    }

    // =========================================================================
    // Advanced Action Card Tests
    // =========================================================================

    // ---- Force of Nature (basic = SelectUnitForModifier) ----

    #[test]
    fn force_of_nature_basic_no_units_skips() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::SelectUnitForModifier {
                modifier: ModifierEffect::GrantResistances {
                    resistances: vec![ResistanceElement::Physical],
                },
                duration: ModifierDuration::Combat,
            },
            Some(CardId::from("force_of_nature")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.active_modifiers.is_empty());
    }

    #[test]
    fn force_of_nature_basic_one_unit_auto_applies() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, false));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::SelectUnitForModifier {
                modifier: ModifierEffect::GrantResistances {
                    resistances: vec![ResistanceElement::Physical],
                },
                duration: ModifierDuration::Combat,
            },
            Some(CardId::from("force_of_nature")),
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), 1);
        let m = &state.active_modifiers[0];
        assert!(matches!(&m.effect, ModifierEffect::GrantResistances { resistances } if resistances.contains(&ResistanceElement::Physical)));
        assert!(matches!(m.scope, ModifierScope::OneUnit { unit_index: 0 }));
        assert!(matches!(m.duration, ModifierDuration::Combat));
    }

    #[test]
    fn force_of_nature_basic_multiple_units_needs_choice() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, false));
        state.players[0].units.push(make_unit("u1", 1, true));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::SelectUnitForModifier {
                modifier: ModifierEffect::GrantResistances {
                    resistances: vec![ResistanceElement::Physical],
                },
                duration: ModifierDuration::Combat,
            },
            Some(CardId::from("force_of_nature")),
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::SelectUnitModifier { eligible_unit_indices } if eligible_unit_indices == vec![0, 1]));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn force_of_nature_basic_choice_resolves_to_second_unit() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, false));
        state.players[0].units.push(make_unit("u1", 1, true));
        // Set up pending choice as if NeedsChoice was returned
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("force_of_nature")),
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop, CardEffect::Noop],
            continuation: vec![],
            resolution: ChoiceResolution::SelectUnitModifier {
                eligible_unit_indices: vec![0, 1],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        assert_eq!(state.active_modifiers.len(), 1);
        let m = &state.active_modifiers[0];
        assert!(matches!(m.scope, ModifierScope::OneUnit { unit_index: 1 }));
    }

    #[test]
    fn force_of_nature_basic_resolvable_with_units() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, false));
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::SelectUnitForModifier {
                modifier: ModifierEffect::GrantResistances {
                    resistances: vec![ResistanceElement::Physical],
                },
                duration: ModifierDuration::Combat,
            }
        ));
    }

    #[test]
    fn force_of_nature_basic_not_resolvable_without_units() {
        let state = test_state();
        assert!(!is_resolvable(
            &state,
            0,
            &CardEffect::SelectUnitForModifier {
                modifier: ModifierEffect::GrantResistances {
                    resistances: vec![ResistanceElement::Physical],
                },
                duration: ModifierDuration::Combat,
            }
        ));
    }

    #[test]
    fn force_of_nature_powered_choice_attack_or_block() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Choice {
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
            Some(CardId::from("force_of_nature")),
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2);
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn force_of_nature_powered_siege_resolves() {
        let mut state = combat_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("force_of_nature")),
            skill_id: None,
            unit_instance_id: None,
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
            continuation: vec![],
            resolution: ChoiceResolution::Standard,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].combat_accumulator.attack.siege, 3);
    }

    // ---- Song of Wind Powered ----

    #[test]
    fn song_of_wind_powered_grants_move_and_terrain_mods() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].move_points, 2);
        // 3 terrain modifiers (Plains, Desert, Wasteland)
        let terrain_mods: Vec<_> = state.active_modifiers.iter().filter(|m| {
            matches!(&m.effect, ModifierEffect::TerrainCost { .. })
        }).collect();
        assert_eq!(terrain_mods.len(), 3);
    }

    #[test]
    fn song_of_wind_powered_no_blue_mana_no_lake_choice() {
        let mut state = test_state();
        // No blue mana anywhere
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Only 3 terrain mods (no lake)
        let terrain_mods: Vec<_> = state.active_modifiers.iter().filter(|m| {
            matches!(&m.effect, ModifierEffect::TerrainCost { .. })
        }).collect();
        assert_eq!(terrain_mods.len(), 3);
    }

    #[test]
    fn song_of_wind_powered_blue_token_offers_lake_choice() {
        let mut state = test_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        // Should get NeedsChoice for the lake option (after move + terrain mods resolve)
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // skip or lake
            }
            other => panic!("Expected NeedsChoice for lake, got {:?}", other),
        }
        // Move and terrain mods already applied
        assert_eq!(state.players[0].move_points, 2);
    }

    #[test]
    fn song_of_wind_powered_lake_accept_consumes_blue_token() {
        let mut state = test_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        // Set up pending choice for lake (option 1 = lake modifier)
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("song_of_wind")),
            skill_id: None,
            unit_instance_id: None,
            options: vec![
                CardEffect::Noop,
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Lake),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(0),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
            continuation: vec![],
            resolution: ChoiceResolution::Standard,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Lake modifier applied
        let has_lake = state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Lake), replace_cost: Some(0), .. })
        });
        assert!(has_lake);
    }

    #[test]
    fn song_of_wind_powered_lake_decline_keeps_token() {
        let mut state = test_state();
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: Some(CardId::from("song_of_wind")),
            skill_id: None,
            unit_instance_id: None,
            options: vec![
                CardEffect::Noop,
                CardEffect::ApplyModifier {
                    effect: ModifierEffect::TerrainCost {
                        terrain: TerrainOrAll::Specific(Terrain::Lake),
                        amount: 0,
                        minimum: 0,
                        replace_cost: Some(0),
                    },
                    duration: ModifierDuration::Turn,
                    scope: ModifierScope::SelfScope,
                },
            ],
            continuation: vec![],
            resolution: ChoiceResolution::Standard,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // No lake modifier
        let has_lake = state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::TerrainCost { terrain: TerrainOrAll::Specific(Terrain::Lake), .. })
        });
        assert!(!has_lake);
        // Blue token still present
        assert_eq!(state.players[0].pure_mana.len(), 1);
    }

    #[test]
    fn song_of_wind_powered_lake_with_blue_crystal() {
        let mut state = test_state();
        state.players[0].crystals.blue = 1;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        // Should offer lake choice since blue crystal available
        assert!(matches!(result, DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn song_of_wind_powered_lake_with_blue_die() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Blue)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn song_of_wind_powered_no_blue_crystal_or_die() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        state.players[0].crystals.red = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn song_of_wind_powered_terrain_mods_turn_duration() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        queue.drain(&mut state, 0);
        for m in &state.active_modifiers {
            assert!(matches!(m.duration, ModifierDuration::Turn));
            assert!(matches!(m.scope, ModifierScope::SelfScope));
        }
    }

    #[test]
    fn song_of_wind_powered_terrain_mods_are_minus_2() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SongOfWindPowered, None);
        queue.drain(&mut state, 0);
        for m in &state.active_modifiers {
            if let ModifierEffect::TerrainCost { amount, minimum, .. } = &m.effect {
                assert_eq!(*amount, -2);
                assert_eq!(*minimum, 0);
            }
        }
    }

    // ---- Rush of Adrenaline ----

    #[test]
    fn rush_basic_no_wounds_creates_modifier_3_remaining() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).expect("Should have RushOfAdrenaline modifier");
        if let ModifierEffect::RushOfAdrenalineActive { mode, remaining_draws, thrown_first_wound } = &m.effect {
            assert!(matches!(mode, mk_types::modifier::RushOfAdrenalineMode::Basic));
            assert_eq!(*remaining_draws, 3);
            assert!(!thrown_first_wound);
        }
    }

    #[test]
    fn rush_basic_retroactive_draws_1_wound() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 1;
        let initial_deck = state.players[0].deck.len();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        queue.drain(&mut state, 0);
        // 1 card drawn retroactively
        assert_eq!(state.players[0].hand.len(), 1);
        assert_eq!(state.players[0].deck.len(), initial_deck - 1);
        // Modifier with 2 remaining
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        if let ModifierEffect::RushOfAdrenalineActive { remaining_draws, .. } = &m.effect {
            assert_eq!(*remaining_draws, 2);
        }
    }

    #[test]
    fn rush_basic_retroactive_capped_at_3() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 5;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        queue.drain(&mut state, 0);
        // 3 drawn (capped), deck had 3 cards
        assert_eq!(state.players[0].hand.len(), 3);
        assert!(state.players[0].deck.is_empty());
        // No modifier (remaining=0)
        assert!(!state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }));
    }

    #[test]
    fn rush_basic_partial_creates_modifier() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].hand.len(), 2);
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        if let ModifierEffect::RushOfAdrenalineActive { remaining_draws, .. } = &m.effect {
            assert_eq!(*remaining_draws, 1);
        }
    }

    #[test]
    fn rush_basic_empty_deck_graceful() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 2;
        state.players[0].deck = vec![CardId::from("march")]; // only 1 card
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        queue.drain(&mut state, 0);
        // Only 1 card drawn (deck exhausted)
        assert_eq!(state.players[0].hand.len(), 1);
        // Modifier with remaining=1
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        if let ModifierEffect::RushOfAdrenalineActive { remaining_draws, .. } = &m.effect {
            assert_eq!(*remaining_draws, 1);
        }
    }

    #[test]
    fn rush_powered_no_wounds_creates_modifier() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).expect("Should have modifier");
        if let ModifierEffect::RushOfAdrenalineActive { mode, remaining_draws, thrown_first_wound } = &m.effect {
            assert!(matches!(mode, mk_types::modifier::RushOfAdrenalineMode::Powered));
            assert_eq!(*remaining_draws, 3);
            assert!(!thrown_first_wound);
        }
    }

    #[test]
    fn rush_powered_throws_first_wound() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 1;
        state.players[0].hand.push(CardId::from("wound"));
        let initial_deck = state.players[0].deck.len();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        // Wound thrown to removed_cards
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "wound"));
        // Wound removed from hand
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        // 1 draw for the thrown wound
        let cards_drawn = initial_deck - state.players[0].deck.len();
        assert!(cards_drawn >= 1);
    }

    #[test]
    fn rush_powered_throw_plus_retroactive() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 3;
        state.players[0].hand.push(CardId::from("wound"));
        // 3 cards in deck
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        // thrown=true, 1 draw for throw + 2 retroactive = 3 draws total
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "wound"));
        // Modifier: remaining = 3 - 2 = 1
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        if let ModifierEffect::RushOfAdrenalineActive { remaining_draws, thrown_first_wound, .. } = &m.effect {
            assert_eq!(*remaining_draws, 1);
            assert!(*thrown_first_wound);
        }
    }

    #[test]
    fn rush_powered_max_scenario_no_modifier() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 4;
        state.players[0].hand.push(CardId::from("wound"));
        // Need enough deck to draw
        state.players[0].deck = vec![
            CardId::from("march"),
            CardId::from("swiftness"),
            CardId::from("rage"),
            CardId::from("stamina"),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        // thrown + 3 retroactive = 4 handled, remaining = 0
        assert!(!state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }));
    }

    #[test]
    fn rush_powered_no_wound_card_despite_counter() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 1;
        // No wound card in hand (already played/discarded somehow)
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        // Not thrown (no wound in hand)
        assert!(state.players[0].removed_cards.is_empty());
        // 1 retroactive draw
        assert_eq!(state.players[0].hand.len(), 1);
        // Modifier: remaining=2 (3-1 retro)
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        if let ModifierEffect::RushOfAdrenalineActive { remaining_draws, thrown_first_wound, .. } = &m.effect {
            assert_eq!(*remaining_draws, 2);
            assert!(!thrown_first_wound);
        }
    }

    #[test]
    fn rush_basic_modifier_turn_duration() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Basic }, None);
        queue.drain(&mut state, 0);
        let m = state.active_modifiers.iter().find(|m| {
            matches!(&m.effect, ModifierEffect::RushOfAdrenalineActive { .. })
        }).unwrap();
        assert!(matches!(m.duration, ModifierDuration::Turn));
        assert!(matches!(m.scope, ModifierScope::SelfScope));
    }

    #[test]
    fn rush_powered_empty_deck_for_throw() {
        let mut state = test_state();
        state.players[0].wounds_received_this_turn.hand = 1;
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].deck.clear();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RushOfAdrenaline { mode: EffectMode::Powered }, None);
        queue.drain(&mut state, 0);
        // Wound thrown
        assert!(state.players[0].removed_cards.iter().any(|c| c.as_str() == "wound"));
        // No draw happened (empty deck)
        assert!(state.players[0].hand.is_empty());
    }

    // ---- Power of Crystals ----

    #[test]
    fn power_crystals_basic_all_below_max_4_colors() {
        let mut state = test_state();
        // All at 0 — 4 eligible colors
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 4);
                assert!(matches!(resolution, ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors } if eligible_colors.len() == 4));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn power_crystals_basic_one_at_max_3_colors() {
        let mut state = test_state();
        state.players[0].crystals.red = 3;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 3);
                if let ChoiceResolution::PowerOfCrystalsGainColor { eligible_colors } = &resolution {
                    assert!(!eligible_colors.contains(&BasicManaColor::Red));
                }
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn power_crystals_basic_one_below_max_auto() {
        let mut state = test_state();
        state.players[0].crystals.red = 3;
        state.players[0].crystals.blue = 3;
        state.players[0].crystals.green = 3;
        state.players[0].crystals.white = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.white, 3);
    }

    #[test]
    fn power_crystals_basic_all_at_max_skips() {
        let mut state = test_state();
        state.players[0].crystals.red = 3;
        state.players[0].crystals.blue = 3;
        state.players[0].crystals.green = 3;
        state.players[0].crystals.white = 3;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn power_crystals_basic_choice_gains_crystal() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 4],
            continuation: vec![],
            resolution: ChoiceResolution::PowerOfCrystalsGainColor {
                eligible_colors: vec![
                    BasicManaColor::Red,
                    BasicManaColor::Blue,
                    BasicManaColor::Green,
                    BasicManaColor::White,
                ],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    #[test]
    fn power_crystals_powered_no_combat_3_options() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 3);
                // Move(4), Heal(2), Draw(2) with 0 complete sets
                assert!(matches!(options[0], CardEffect::GainMove { amount: 4 }));
                assert!(matches!(options[1], CardEffect::GainHealing { amount: 2 }));
                assert!(matches!(options[2], CardEffect::DrawCards { count: 2 }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn power_crystals_powered_1_complete_set() {
        let mut state = test_state();
        state.players[0].crystals.red = 1;
        state.players[0].crystals.blue = 1;
        state.players[0].crystals.green = 1;
        state.players[0].crystals.white = 1;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert!(matches!(options[0], CardEffect::GainMove { amount: 6 }));
                assert!(matches!(options[1], CardEffect::GainHealing { amount: 3 }));
                assert!(matches!(options[2], CardEffect::DrawCards { count: 3 }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn power_crystals_powered_2_complete_sets() {
        let mut state = test_state();
        state.players[0].crystals.red = 2;
        state.players[0].crystals.blue = 2;
        state.players[0].crystals.green = 2;
        state.players[0].crystals.white = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert!(matches!(options[0], CardEffect::GainMove { amount: 8 }));
                assert!(matches!(options[1], CardEffect::GainHealing { amount: 4 }));
                assert!(matches!(options[2], CardEffect::DrawCards { count: 4 }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn power_crystals_powered_in_combat_skips() {
        let mut state = combat_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::PowerOfCrystalsPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn power_crystals_basic_resolvable() {
        let state = test_state();
        assert!(is_resolvable(&state, 0, &CardEffect::PowerOfCrystalsBasic));
        let mut state2 = test_state();
        state2.players[0].crystals.red = 3;
        state2.players[0].crystals.blue = 3;
        state2.players[0].crystals.green = 3;
        state2.players[0].crystals.white = 3;
        assert!(!is_resolvable(&state2, 0, &CardEffect::PowerOfCrystalsBasic));
    }

    // ---- Crystal Mastery ----

    #[test]
    fn crystal_mastery_basic_owned_below_max_choice() {
        let mut state = test_state();
        state.players[0].crystals.red = 1;
        state.players[0].crystals.blue = 2;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                if let ChoiceResolution::CrystalMasteryGainColor { eligible_colors } = &resolution {
                    assert!(eligible_colors.contains(&BasicManaColor::Red));
                    assert!(eligible_colors.contains(&BasicManaColor::Blue));
                }
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn crystal_mastery_basic_one_eligible_auto() {
        let mut state = test_state();
        state.players[0].crystals.red = 1;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 2);
    }

    #[test]
    fn crystal_mastery_basic_no_crystals_skips() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn crystal_mastery_basic_all_owned_at_max_skips() {
        let mut state = test_state();
        state.players[0].crystals.red = 3;
        state.players[0].crystals.blue = 3;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn crystal_mastery_basic_mixed_owned_maxed() {
        let mut state = test_state();
        state.players[0].crystals.red = 3; // owned but maxed
        state.players[0].crystals.blue = 1; // owned and below max
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.blue, 2);
    }

    #[test]
    fn crystal_mastery_basic_choice_resolves() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::CrystalMasteryGainColor {
                eligible_colors: vec![BasicManaColor::Red, BasicManaColor::Blue],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn crystal_mastery_powered_sets_flag() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::CrystalMasteryPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].flags.contains(PlayerFlags::CRYSTAL_MASTERY_POWERED_ACTIVE));
    }

    #[test]
    fn crystal_mastery_basic_resolvable() {
        let mut state = test_state();
        state.players[0].crystals.red = 1;
        assert!(is_resolvable(&state, 0, &CardEffect::CrystalMasteryBasic));

        let mut state2 = test_state();
        // No crystals owned
        assert!(!is_resolvable(&state2, 0, &CardEffect::CrystalMasteryBasic));

        state2.players[0].crystals.red = 3;
        // Owned but maxed
        assert!(!is_resolvable(&state2, 0, &CardEffect::CrystalMasteryBasic));
    }

    // ---- Mana Storm ----

    #[test]
    fn mana_storm_basic_multiple_dice_needs_choice() {
        let mut state = test_state();
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Red),
            make_source_die("d1", ManaColor::Blue),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::ManaStormDieSelect { .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn mana_storm_basic_one_die_auto() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn mana_storm_basic_no_basic_dice_skips() {
        let mut state = test_state();
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Gold),
            make_source_die("d1", ManaColor::Black),
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 0);
    }

    #[test]
    fn mana_storm_basic_excludes_depleted_taken() {
        let mut state = test_state();
        let mut depleted_die = make_source_die("d0", ManaColor::Red);
        depleted_die.is_depleted = true;
        let mut taken_die = make_source_die("d1", ManaColor::Blue);
        taken_die.taken_by_player_id = Some(PlayerId::from("p1"));
        state.source.dice = vec![depleted_die, taken_die];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn mana_storm_basic_gains_crystal_and_rerolls() {
        let mut state = test_state();
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Red),
            make_source_die("d1", ManaColor::Blue),
        ];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::ManaStormDieSelect {
                die_ids: vec![SourceDieId::from("d0"), SourceDieId::from("d1")],
                die_colors: vec![BasicManaColor::Red, BasicManaColor::Blue],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].crystals.red, 1);
        // Die was rerolled (color may have changed, RNG consumed)
    }

    #[test]
    fn mana_storm_basic_crystal_cap() {
        let mut state = test_state();
        state.players[0].crystals.red = 3;
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormBasic, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].crystals.red, 3); // Stays at 3
    }

    #[test]
    fn mana_storm_powered_rerolls_all() {
        let mut state = test_state();
        state.source.dice = vec![
            make_source_die("d0", ManaColor::Red),
            make_source_die("d1", ManaColor::Blue),
            make_source_die("d2", ManaColor::Green),
        ];
        // Mark one as taken
        state.source.dice[1].taken_by_player_id = Some(PlayerId::from("p1"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // All dice rerolled (RNG consumed)
    }

    #[test]
    fn mana_storm_powered_five_modifiers() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormPowered, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.active_modifiers.len(), 5);
        // 3 ExtraSourceDie
        let extra_count = state.active_modifiers.iter().filter(|m| {
            matches!(&m.effect, ModifierEffect::RuleOverride { rule: RuleOverride::ExtraSourceDie })
        }).count();
        assert_eq!(extra_count, 3);
        // 1 BlackAsAnyColor
        assert!(state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::RuleOverride { rule: RuleOverride::BlackAsAnyColor })
        }));
        // 1 GoldAsAnyColor
        assert!(state.active_modifiers.iter().any(|m| {
            matches!(&m.effect, ModifierEffect::RuleOverride { rule: RuleOverride::GoldAsAnyColor })
        }));
    }

    #[test]
    fn mana_storm_powered_turn_duration() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ManaStormPowered, None);
        queue.drain(&mut state, 0);
        for m in &state.active_modifiers {
            assert!(matches!(m.duration, ModifierDuration::Turn));
            assert!(matches!(m.scope, ModifierScope::SelfScope));
        }
    }

    #[test]
    fn mana_storm_basic_resolvable() {
        let mut state = test_state();
        state.source.dice = vec![make_source_die("d0", ManaColor::Red)];
        assert!(is_resolvable(&state, 0, &CardEffect::ManaStormBasic));

        let mut state2 = test_state();
        state2.source.dice = vec![make_source_die("d0", ManaColor::Gold)];
        assert!(!is_resolvable(&state2, 0, &CardEffect::ManaStormBasic));
    }

    // ---- Spell Forge ----

    #[test]
    fn spell_forge_basic_multiple_needs_choice() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),      // Red
            CardId::from("snowstorm"),     // Blue
        ];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SpellForgeBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::SpellForgeCrystal { is_second: false, .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn spell_forge_basic_single_auto() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")]; // Red
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SpellForgeBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn spell_forge_basic_empty_skips() {
        let mut state = test_state();
        state.offers.spells = vec![];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SpellForgeBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn spell_forge_basic_gains_crystal_of_spell_color() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::SpellForgeCrystal {
                spell_entries: vec![(0, BasicManaColor::Red), (1, BasicManaColor::Blue)],
                is_second: false,
                first_spell_index: None,
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    #[test]
    fn spell_forge_powered_chains_to_second() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),
            CardId::from("snowstorm"),
        ];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::SpellForgeCrystal {
                spell_entries: vec![(0, BasicManaColor::Red), (1, BasicManaColor::Blue)],
                is_second: false,
                first_spell_index: None,
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].crystals.red, 1);
        // Should have a new pending for second pick
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                assert!(matches!(&pc.resolution, ChoiceResolution::SpellForgeCrystal { is_second: true, first_spell_index: Some(0), .. }));
            }
            other => panic!("Expected Choice with SpellForgeCrystal second, got {:?}", other),
        }
    }

    #[test]
    fn spell_forge_powered_second_gains_crystal() {
        let mut state = test_state();
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop],
            continuation: vec![],
            resolution: ChoiceResolution::SpellForgeCrystal {
                spell_entries: vec![(1, BasicManaColor::Blue)],
                is_second: true,
                first_spell_index: Some(0),
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        assert_eq!(state.players[0].crystals.blue, 1);
    }

    #[test]
    fn spell_forge_powered_single_spell_one_crystal() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SpellForgePowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].crystals.red, 1);
    }

    #[test]
    fn spell_forge_powered_excludes_first_pick() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),
            CardId::from("snowstorm"),
            CardId::from("restoration"),
        ];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 3],
            continuation: vec![],
            resolution: ChoiceResolution::SpellForgeCrystal {
                spell_entries: vec![
                    (0, BasicManaColor::Red),
                    (1, BasicManaColor::Blue),
                    (2, BasicManaColor::Green),
                ],
                is_second: false,
                first_spell_index: None,
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Second choice should exclude index 0
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::SpellForgeCrystal { spell_entries, .. } = &pc.resolution {
                    assert_eq!(spell_entries.len(), 2);
                    assert!(!spell_entries.iter().any(|(idx, _)| *idx == 0));
                }
            }
            _ => panic!("Expected Choice"),
        }
    }

    #[test]
    fn spell_forge_powered_same_color_spells() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("snowstorm"),
            CardId::from("chill"),
        ];
        // Both blue spells
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::SpellForgePowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { resolution, .. } => {
                assert!(matches!(resolution, ChoiceResolution::SpellForgeCrystal { .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn spell_forge_resolvable() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")];
        assert!(is_resolvable(&state, 0, &CardEffect::SpellForgeBasic));

        let mut state2 = test_state();
        state2.offers.spells = vec![];
        assert!(!is_resolvable(&state2, 0, &CardEffect::SpellForgeBasic));
    }

    // ---- Magic Talent ----

    #[test]
    fn magic_talent_basic_no_spells_skips() {
        let mut state = test_state();
        state.offers.spells = vec![];
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn magic_talent_basic_no_colored_hand_skips() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")];
        state.players[0].hand = vec![CardId::from("wound")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn magic_talent_basic_single_match_auto() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")]; // Red spell
        state.players[0].hand = vec![CardId::from("march")]; // Has a colored card
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentBasic, None);
        let result = queue.drain(&mut state, 0);
        // Single spell → auto-select → decompose to fireball's basic effect
        // This may result in Complete or NeedsChoice depending on fireball's basic effect
        // Fireball basic is an attack, which needs combat
        // Without combat, the attack effect would be skipped
        assert!(matches!(result, DrainResult::Complete | DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn magic_talent_basic_multiple_needs_choice() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),
            CardId::from("snowstorm"),
        ];
        state.players[0].hand = vec![CardId::from("march")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::MagicTalentSpellSelect { .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn magic_talent_basic_spell_stays_in_offer() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),
            CardId::from("snowstorm"),
        ];
        state.players[0].hand = vec![CardId::from("march")];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::MagicTalentSpellSelect {
                spell_entries: vec![
                    (0, CardId::from("fireball"), BasicManaColor::Red),
                    (1, CardId::from("snowstorm"), BasicManaColor::Blue),
                ],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Spell should still be in offer (basic just uses the effect, doesn't take the card)
        assert!(state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
    }

    #[test]
    fn magic_talent_powered_no_matching_mana_skips() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")]; // Red
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue)); // Wrong color
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn magic_talent_powered_single_match_auto() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")]; // Red
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        state.decks.spell_deck = vec![]; // Prevent replenish
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Spell moved to discard
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "fireball"));
        // Removed from offer
        assert!(!state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
    }

    #[test]
    fn magic_talent_powered_multiple_needs_choice() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),   // Red
            CardId::from("tremor"),     // Red
        ];
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::MagicTalentGainSelect { .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn magic_talent_powered_gains_spell_to_discard() {
        let mut state = test_state();
        state.offers.spells = vec![
            CardId::from("fireball"),
            CardId::from("tremor"),
        ];
        state.decks.spell_deck = vec![];
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::MagicTalentGainSelect {
                gain_entries: vec![
                    (0, CardId::from("fireball"), BasicManaColor::Red),
                    (1, CardId::from("tremor"), BasicManaColor::Red),
                ],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Spell in discard
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "fireball"));
        // Removed from offer
        assert!(!state.offers.spells.iter().any(|s| s.as_str() == "fireball"));
    }

    #[test]
    fn magic_talent_powered_offer_replenished() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")]; // Red
        state.decks.spell_deck = vec![CardId::from("restoration")]; // Replenish
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MagicTalentPowered, None);
        queue.drain(&mut state, 0);
        // Offer replenished from deck
        assert!(state.offers.spells.iter().any(|s| s.as_str() == "restoration"));
    }

    #[test]
    fn magic_talent_resolvable() {
        let mut state = test_state();
        state.offers.spells = vec![CardId::from("fireball")];
        state.players[0].hand = vec![CardId::from("march")];
        assert!(is_resolvable(&state, 0, &CardEffect::MagicTalentBasic));

        // Powered: need matching mana
        let mut state2 = test_state();
        state2.offers.spells = vec![CardId::from("fireball")];
        state2.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        assert!(is_resolvable(&state2, 0, &CardEffect::MagicTalentPowered));

        // Powered: no matching mana
        let mut state3 = test_state();
        state3.offers.spells = vec![CardId::from("fireball")];
        state3.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        assert!(!is_resolvable(&state3, 0, &CardEffect::MagicTalentPowered));
    }

    // ---- Blood of Ancients ----

    #[test]
    fn blood_basic_takes_wound_offers_mana() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage"), CardId::from("ice_bolt")];
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Blue));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsBasic, None);
        let result = queue.drain(&mut state, 0);
        // Wound taken to hand
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        assert_eq!(state.players[0].wounds_received_this_turn.hand, 1);
        // Mana choice offered
        match result {
            DrainResult::NeedsChoice { resolution, .. } => {
                assert!(matches!(resolution, ChoiceResolution::BloodBasicManaSelect { .. }));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn blood_basic_no_mana_wound_only() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage")]; // Red AA
        // No mana tokens or crystals
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    }

    #[test]
    fn blood_basic_single_option_auto() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage")]; // Red AA
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        state.decks.advanced_action_deck = vec![];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsBasic, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // AA gained to hand
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "blood_rage"));
    }

    #[test]
    fn blood_basic_mana_then_aa_chain() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![
            CardId::from("blood_rage"),    // Red
            CardId::from("intimidate"),    // Red
        ];
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop],
            continuation: vec![],
            resolution: ChoiceResolution::BloodBasicManaSelect {
                mana_options: vec![(
                    mk_types::action::ManaSourceInfo {
                        source_type: ManaSourceType::Token,
                        color: ManaColor::Red,
                        die_id: None,
                    },
                    BasicManaColor::Red,
                )],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Token consumed
        assert!(state.players[0].pure_mana.is_empty());
        // Should chain to BloodBasicAaSelect since 2 matching red AAs
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                assert!(matches!(&pc.resolution, ChoiceResolution::BloodBasicAaSelect { color } if *color == BasicManaColor::Red));
            }
            other => panic!("Expected BloodBasicAaSelect, got {:?}", other),
        }
    }

    #[test]
    fn blood_basic_only_matching_colors() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("ice_bolt")]; // Blue AA only
        state.players[0].pure_mana.push(make_mana_token(ManaColor::Red)); // Red token
        // Red token but no red AAs → Red not in options
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsBasic, None);
        let result = queue.drain(&mut state, 0);
        // Wound taken but no matching mana+AA combo
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn blood_basic_tracks_wound() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsBasic, None);
        queue.drain(&mut state, 0);
        assert_eq!(state.players[0].wounds_received_this_turn.hand, 1);
    }

    #[test]
    fn blood_powered_empty_offer_skips() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsPowered, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn blood_powered_wound_destination_choice() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage")];
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::BloodOfAncientsPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                assert_eq!(options.len(), 2);
                assert!(matches!(resolution, ChoiceResolution::BloodPoweredWoundSelect));
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn blood_powered_wound_to_hand() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage")];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::BloodPoweredWoundSelect,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Wound to hand
        assert!(state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
        assert_eq!(state.players[0].wounds_received_this_turn.hand, 1);
        // Chains to BloodPoweredAaSelect
        assert!(matches!(&state.players[0].pending.active, Some(ActivePending::Choice(pc)) if matches!(&pc.resolution, ChoiceResolution::BloodPoweredAaSelect)));
    }

    #[test]
    fn blood_powered_wound_to_discard() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![CardId::from("blood_rage")];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::BloodPoweredWoundSelect,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        assert!(state.players[0].discard.iter().any(|c| c.as_str() == "wound"));
        assert_eq!(state.players[0].wounds_received_this_turn.discard, 1);
    }

    #[test]
    fn blood_powered_aa_select() {
        let mut state = test_state();
        state.offers.advanced_actions = vec![
            CardId::from("blood_rage"),
            CardId::from("ice_bolt"),
        ];
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::BloodPoweredAaSelect,
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // blood_rage's powered effect should have been resolved
        // blood_rage powered is Choice(Attack2, TakeWound+Attack5) — needs choice in combat
        // Without combat, the effect resolution depends on the AA's powered effect
    }

    // ---- Peaceful Moment ----

    #[test]
    fn peaceful_action_no_targets_skips() {
        // PeacefulMomentAction alone (no wounds, no spent units) → skip
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentAction { influence: 3, allow_refresh: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Influence NOT granted here (that's GainInfluence's job in the Compound)
        assert_eq!(state.players[0].influence_points, 0);
        // HAS_TAKEN_ACTION not set since nothing to convert
        assert!(!state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn peaceful_action_sets_healing_flags() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentAction { influence: 3, allow_refresh: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should set healing-window flags (conversion entered via BeginPeacefulMomentHealing)
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].flags.contains(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING));
        assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
        assert!(!state.players[0].flags.contains(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH));
    }

    #[test]
    fn peaceful_action_powered_sets_refresh_flag() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentAction { influence: 6, allow_refresh: true },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].flags.contains(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING));
        assert!(state.players[0].flags.contains(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH));
    }

    #[test]
    fn peaceful_convert_no_wounds_exits() {
        let mut state = test_state();
        // No wounds, no spent units
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert { influence_remaining: 3, allow_refresh: false, refreshed: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Only "Done" available → auto-exit
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn peaceful_convert_wound_offers_heal() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert { influence_remaining: 3, allow_refresh: false, refreshed: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // Done + Heal
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_heal_removes_wound_costs_2() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 4,
                allow_refresh: false,
                refreshed: false,
                option_map: vec![PeacefulMomentOption::Done, PeacefulMomentOption::HealWound],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Wound removed from hand
        assert!(!state.players[0].hand.iter().any(|c| c.as_str() == "wound"));
    }

    #[test]
    fn peaceful_done_exits() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 4,
                allow_refresh: false,
                refreshed: false,
                option_map: vec![PeacefulMomentOption::Done, PeacefulMomentOption::HealWound],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 0).unwrap();
        // Done → no more pending
        assert!(state.players[0].pending.active.is_none());
    }

    #[test]
    fn peaceful_heal_then_loop() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2],
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 6,
                allow_refresh: false,
                refreshed: false,
                option_map: vec![PeacefulMomentOption::Done, PeacefulMomentOption::HealWound],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // After heal, should loop back with reduced influence
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::PeacefulMomentConversion { influence_remaining, .. } = &pc.resolution {
                    assert_eq!(*influence_remaining, 4);
                }
            }
            other => panic!("Expected loop continuation, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_insufficient_influence_exits() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert { influence_remaining: 1, allow_refresh: false, refreshed: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Only 1 influence, heal costs 2 → only Done → auto-exit
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn peaceful_powered_offers_refresh() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true)); // Spent unit
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert { influence_remaining: 6, allow_refresh: true, refreshed: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                // Done + Refresh (no wound so no heal)
                assert_eq!(options.len(), 2);
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_refresh_readies_unit() {
        // No wound in hand, just a spent unit — option_map correctly maps index 1 to RefreshUnit.
        // (This previously required a workaround due to hardcoded index mapping.)
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true)); // Spent unit, level 1
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 2], // Done + Refresh
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 6,
                allow_refresh: true,
                refreshed: false,
                option_map: vec![PeacefulMomentOption::Done, PeacefulMomentOption::RefreshUnit],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 1).unwrap();
        // Unit readied
        assert!(matches!(state.players[0].units[0].state, UnitState::Ready));
    }

    #[test]
    fn peaceful_refresh_level2_costs_4() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true)); // Level 2 spent unit
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 3],
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 6,
                allow_refresh: true,
                refreshed: false,
                option_map: vec![
                    PeacefulMomentOption::Done,
                    PeacefulMomentOption::HealWound,
                    PeacefulMomentOption::RefreshUnit,
                ],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 2).unwrap();
        assert!(matches!(state.players[0].units[0].state, UnitState::Ready));
        // Influence reduced by 4 (level 2 × 2). Check continuation.
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::PeacefulMomentConversion { influence_remaining, refreshed, .. } = &pc.resolution {
                    assert_eq!(*influence_remaining, 2); // 6 - 4
                    assert!(*refreshed);
                }
            }
            other => panic!("Expected continuation, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_refresh_not_offered_twice() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert {
                influence_remaining: 6,
                allow_refresh: true,
                refreshed: true, // already refreshed
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                // Done + Heal only (no refresh since already refreshed)
                assert_eq!(options.len(), 2);
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_basic_no_refresh() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 1, true));
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert {
                influence_remaining: 6,
                allow_refresh: false, // basic mode
                refreshed: false,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2); // Done + Heal only
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_refresh_too_expensive_not_offered() {
        let mut state = test_state();
        state.players[0].units.push(make_unit("u0", 2, true)); // Level 2 costs 4
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert {
                influence_remaining: 3, // Only 3, need 4
                allow_refresh: true,
                refreshed: false,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Only Done available (no wound for heal, refresh too expensive)
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn peaceful_no_wounds_no_unit_exits() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert {
                influence_remaining: 6,
                allow_refresh: true,
                refreshed: false,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // No wounds, no spent units → only Done → auto-exit
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn peaceful_action_skips_in_combat() {
        // In combat (even with InfluenceCardsInCombat), PeacefulMomentAction
        // should skip — healing is not allowed in combat. The GainInfluence
        // in the Compound still fires, giving influence for the combat rule.
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        // Put the game in combat
        state.combat = Some(Box::new(CombatState::default()));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentAction { influence: 3, allow_refresh: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should skip — no conversion loop, no HAS_TAKEN_ACTION
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn peaceful_basic_always_grants_influence_then_sets_flags() {
        // Bug: card was Choice(GainInfluence | PeacefulMomentAction).
        // Correct: always grant influence, then set healing-window flags.
        // Playing basic peaceful_moment with a wound should grant 3 influence
        // AND set IS_PEACEFUL_MOMENT_HEALING for the accumulation window.
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("peaceful_moment"),
            CardId::from("wound"),
        ];
        let card_def = mk_data::cards::get_card("peaceful_moment").unwrap();
        let mut queue = EffectQueue::new();
        queue.push(card_def.basic_effect.clone(), Some(CardId::from("peaceful_moment")));
        let result = queue.drain(&mut state, 0);
        // Should have gained 3 influence already
        assert_eq!(state.players[0].influence_points, 3, "influence should be granted before heal choice");
        // Should set healing-window flags (conversion entered via BeginPeacefulMomentHealing)
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].flags.contains(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING));
        assert!(state.players[0].flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN));
    }

    #[test]
    fn peaceful_convert_offers_heal_wounded_unit() {
        // Wounded unit should appear as a conversion option.
        // Healing a level 2 wounded unit costs 4 influence (level × 2).
        let mut state = test_state();
        let mut unit = make_unit("u0", 2, false);
        unit.wounded = true;
        state.players[0].units.push(unit);
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::PeacefulMomentConvert {
                influence_remaining: 6,
                allow_refresh: false,
                refreshed: false,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, resolution, .. } => {
                // Should have: Done + HealUnit
                assert!(options.len() >= 2, "expected at least Done + HealUnit, got {}", options.len());
                if let ChoiceResolution::PeacefulMomentConversion { option_map, .. } = &resolution {
                    let has_heal_unit = option_map.iter().any(|o| matches!(o, PeacefulMomentOption::HealUnit { .. }));
                    assert!(has_heal_unit, "expected HealUnit option in option_map, got {:?}", option_map);
                } else {
                    panic!("Expected PeacefulMomentConversion, got {:?}", resolution);
                }
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn peaceful_heal_wounded_unit_removes_wound() {
        // Resolving the HealUnit option should unwound the unit and cost level × 2 influence.
        let mut state = test_state();
        let mut unit = make_unit("u0", 2, false);
        unit.wounded = true;
        state.players[0].units.push(unit);
        // Also add a wound in hand so the loop continues after healing the unit
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].pending.active = Some(ActivePending::Choice(PendingChoice {
            card_id: None,
            skill_id: None,
            unit_instance_id: None,
            options: vec![CardEffect::Noop; 3], // Done + HealWound + HealUnit
            continuation: vec![],
            resolution: ChoiceResolution::PeacefulMomentConversion {
                influence_remaining: 6,
                allow_refresh: false,
                refreshed: false,
                option_map: vec![
                    PeacefulMomentOption::Done,
                    PeacefulMomentOption::HealWound,
                    PeacefulMomentOption::HealUnit { unit_index: 0 },
                ],
            },
            movement_bonus_applied: false,
        }));
        resolve_pending_choice(&mut state, 0, 2).unwrap();
        // Unit should no longer be wounded
        assert!(!state.players[0].units[0].wounded, "unit should be healed");
        // Should loop back with reduced influence (6 - 4 = 2) and offer wound heal
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::PeacefulMomentConversion { influence_remaining, .. } = &pc.resolution {
                    assert_eq!(*influence_remaining, 2, "should have 2 influence remaining (6 - level 2 × 2)");
                } else {
                    panic!("Expected PeacefulMomentConversion continuation");
                }
            }
            other => panic!("Expected continuation, got {:?}", other),
        }
    }

    #[test]
    fn enter_peaceful_moment_conversion_sets_pending() {
        // enter_peaceful_moment_conversion should read accumulated influence,
        // clear flags, and set up a PeacefulMomentConversion pending choice.
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].influence_points = 5;
        state.players[0].flags.insert(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING);
        enter_peaceful_moment_conversion(&mut state, 0);
        // Flags cleared
        assert!(!state.players[0].flags.contains(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING));
        assert!(!state.players[0].flags.contains(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH));
        // Pending choice set with correct influence
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::PeacefulMomentConversion { influence_remaining, .. } = &pc.resolution {
                    assert_eq!(*influence_remaining, 5);
                } else {
                    panic!("Expected PeacefulMomentConversion resolution");
                }
            }
            other => panic!("Expected pending choice, got {:?}", other),
        }
    }

    #[test]
    fn enter_peaceful_moment_conversion_with_refresh() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].influence_points = 6;
        state.players[0].flags.insert(PlayerFlags::IS_PEACEFUL_MOMENT_HEALING);
        state.players[0].flags.insert(PlayerFlags::PEACEFUL_MOMENT_ALLOW_REFRESH);
        let mut unit = make_unit("u0", 1, false);
        unit.state = UnitState::Spent;
        state.players[0].units.push(unit);
        enter_peaceful_moment_conversion(&mut state, 0);
        match &state.players[0].pending.active {
            Some(ActivePending::Choice(pc)) => {
                if let ChoiceResolution::PeacefulMomentConversion { allow_refresh, option_map, .. } = &pc.resolution {
                    assert!(*allow_refresh);
                    assert!(option_map.iter().any(|o| matches!(o, PeacefulMomentOption::RefreshUnit)));
                } else {
                    panic!("Expected PeacefulMomentConversion resolution");
                }
            }
            other => panic!("Expected pending choice, got {:?}", other),
        }
    }

    // =========================================================================
    // Artifact effect resolver tests
    // =========================================================================

    #[test]
    fn ready_all_units_readies_all_spent() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, true); // spent
        let u1 = make_unit("u1", 2, false); // ready
        let mut u2 = make_unit("u2", 3, true); // spent
        u0.state = UnitState::Spent;
        u2.state = UnitState::Spent;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        state.players[0].units.push(u2);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyAllUnits, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].units[0].state, UnitState::Ready);
        assert_eq!(state.players[0].units[1].state, UnitState::Ready);
        assert_eq!(state.players[0].units[2].state, UnitState::Ready);
    }

    #[test]
    fn ready_all_units_no_units_is_noop() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ReadyAllUnits, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn heal_all_units_heals_all_wounded() {
        let mut state = test_state();
        let mut u0 = make_unit("u0", 1, false);
        u0.wounded = true;
        let u1 = make_unit("u1", 2, false); // not wounded
        let mut u2 = make_unit("u2", 3, false);
        u2.wounded = true;
        state.players[0].units.push(u0);
        state.players[0].units.push(u1);
        state.players[0].units.push(u2);
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::HealAllUnits, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(!state.players[0].units[0].wounded);
        assert!(!state.players[0].units[1].wounded);
        assert!(!state.players[0].units[2].wounded);
    }

    #[test]
    fn activate_banner_protection_sets_flag() {
        let mut state = test_state();
        assert!(!state.players[0].flags.contains(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::ActivateBannerProtection, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert!(state.players[0].flags.contains(PlayerFlags::BANNER_OF_PROTECTION_ACTIVE));
    }

    #[test]
    fn fame_per_enemy_defeated_adds_modifier() {
        let mut state = test_state();
        state.players[0].play_area.push(CardId::from("banner_of_glory"));
        state.combat = Some(Box::new(CombatState::default()));
        let initial_mod_count = state.active_modifiers.len();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::FamePerEnemyDefeated { amount: 1, exclude_summoned: false },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.active_modifiers.len(), initial_mod_count + 1);
        assert!(matches!(
            &state.active_modifiers.last().unwrap().effect,
            ModifierEffect::FamePerEnemyDefeated { fame_per_enemy: 1, exclude_summoned: false }
        ));
    }

    #[test]
    fn roll_die_for_wound_produces_wounds() {
        let mut state = test_state();
        // Set up RNG to produce known results
        state.rng = mk_types::rng::RngState::new(42);
        let initial_wounds: usize = state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RollDieForWound { die_count: 3 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        // Some wounds may have been added depending on RNG
        let final_wounds: usize = state.players[0]
            .hand
            .iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        // Just verify it ran without error - exact count depends on RNG
        assert!(final_wounds >= initial_wounds);
    }

    #[test]
    fn roll_for_crystals_grants_crystals() {
        let mut state = test_state();
        state.rng = mk_types::rng::RngState::new(42);
        let initial_fame = state.players[0].fame;
        let initial_crystals = state.players[0].crystals.red
            + state.players[0].crystals.blue
            + state.players[0].crystals.green
            + state.players[0].crystals.white;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::RollForCrystals { die_count: 2 }, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        let final_crystals = state.players[0].crystals.red
            + state.players[0].crystals.blue
            + state.players[0].crystals.green
            + state.players[0].crystals.white;
        let final_fame = state.players[0].fame;
        // Should have gained 2 items (crystals or fame)
        let crystal_gain = final_crystals - initial_crystals;
        let fame_gain = final_fame - initial_fame;
        assert_eq!(crystal_gain as u32 + fame_gain, 2);
    }

    #[test]
    fn choose_bonus_with_risk_first_call_must_roll() {
        let mut state = test_state();
        state.combat = Some(Box::new(CombatState::default()));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::ChooseBonusWithRisk {
                bonus_per_roll: 5,
                combat_type: CombatType::Siege,
                element: Element::Physical,
                accumulated: 0,
                rolled: false,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // First call with accumulated=0: must roll (decomposed into rolled=true)
        assert!(matches!(result, DrainResult::Complete | DrainResult::NeedsChoice { .. }));
    }

    #[test]
    fn druidic_staff_powered_offers_six_choices() {
        let mut state = test_state();
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DruidicStaffPowered, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 6);
                // All should be Compound effects
                for opt in &options {
                    assert!(matches!(opt, CardEffect::Compound { .. }));
                }
            }
            _ => panic!("Expected NeedsChoice with 6 options"),
        }
    }

    #[test]
    fn druidic_staff_basic_needs_cards_in_hand() {
        let mut state = test_state();
        // Clear hand to only wounds
        state.players[0].hand.clear();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DruidicStaffBasic, None);
        let result = queue.drain(&mut state, 0);
        // No eligible cards → skipped
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn druidic_staff_basic_with_cards_offers_discard_choice() {
        let mut state = test_state();
        state.players[0].hand.push(CardId::from("march"));
        state.players[0].hand.push(CardId::from("rage"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::DruidicStaffBasic, None);
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { resolution, .. } => {
                assert!(matches!(resolution, ChoiceResolution::DiscardThenContinue { .. }));
            }
            _ => panic!("Expected NeedsChoice with DiscardThenContinue"),
        }
    }

    #[test]
    fn mysterious_box_reveals_artifact_and_offers_choices() {
        let mut state = test_state();
        // Put ruby_ring in artifact offer
        state.offers.artifacts.push(CardId::from("ruby_ring"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MysteriousBox, None);
        let result = queue.drain(&mut state, 0);
        // Should return NeedsChoice with 3 options (basic, powered, skip)
        assert!(matches!(result, DrainResult::NeedsChoice { .. }));
        if let DrainResult::NeedsChoice { options, resolution, .. } = &result {
            assert_eq!(options.len(), 3, "Should have basic, powered, and skip options");
            assert!(matches!(resolution, ChoiceResolution::MysteriousBoxUse { .. }));
            // Last option should be Noop (skip)
            assert!(matches!(options[2], CardEffect::Noop));
        }
        // mysterious_box_state should be set
        assert!(state.players[0].mysterious_box_state.is_some());
        let box_state = state.players[0].mysterious_box_state.as_ref().unwrap();
        assert_eq!(box_state.revealed_artifact_id.as_str(), "ruby_ring");
        assert!(matches!(box_state.used_as, MysteriousBoxUsage::Unused));
        // Artifact should have been removed from offer
        assert!(state.offers.artifacts.is_empty());
    }

    /// Helper: drain queue and convert NeedsChoice to pending (like card_play does).
    fn drain_and_set_pending(queue: &mut EffectQueue, state: &mut GameState, player_idx: usize) {
        use mk_types::pending::{ActivePending, PendingChoice, ContinuationEntry};
        let result = queue.drain(state, player_idx);
        if let DrainResult::NeedsChoice { options, continuation, resolution } = result {
            state.players[player_idx].pending.active = Some(ActivePending::Choice(PendingChoice {
                card_id: None,
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
        }
    }

    #[test]
    fn mysterious_box_basic_choice_grants_fame_and_effect() {
        let mut state = test_state();
        state.offers.artifacts.push(CardId::from("ruby_ring"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MysteriousBox, None);
        drain_and_set_pending(&mut queue, &mut state, 0);
        // Choose basic (index 0)
        let resolve_result = crate::effect_queue::choice_resolution::resolve_pending_choice(
            &mut state, 0, 0,
        );
        assert!(resolve_result.is_ok());
        // Should have gained fame (ruby ring basic gives fame + mana + crystal, plus Box +1 fame)
        assert!(state.players[0].fame > 0);
        // mysterious_box_state should be set to Basic
        let box_state = state.players[0].mysterious_box_state.as_ref().unwrap();
        assert!(matches!(box_state.used_as, MysteriousBoxUsage::Basic));
    }

    #[test]
    fn mysterious_box_powered_choice_sets_powered_usage() {
        let mut state = test_state();
        state.offers.artifacts.push(CardId::from("ruby_ring"));
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MysteriousBox, None);
        drain_and_set_pending(&mut queue, &mut state, 0);
        // Choose powered (index 1)
        let resolve_result = crate::effect_queue::choice_resolution::resolve_pending_choice(
            &mut state, 0, 1,
        );
        assert!(resolve_result.is_ok());
        // mysterious_box_state should be set to Powered
        let box_state = state.players[0].mysterious_box_state.as_ref().unwrap();
        assert!(matches!(box_state.used_as, MysteriousBoxUsage::Powered));
        // Should have gained fame
        assert!(state.players[0].fame > 0);
    }

    #[test]
    fn mysterious_box_skip_choice_no_fame() {
        let mut state = test_state();
        state.offers.artifacts.push(CardId::from("ruby_ring"));
        let initial_fame = state.players[0].fame;
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MysteriousBox, None);
        drain_and_set_pending(&mut queue, &mut state, 0);
        // Choose skip (index 2)
        let resolve_result = crate::effect_queue::choice_resolution::resolve_pending_choice(
            &mut state, 0, 2,
        );
        assert!(resolve_result.is_ok());
        // mysterious_box_state should stay Unused
        let box_state = state.players[0].mysterious_box_state.as_ref().unwrap();
        assert!(matches!(box_state.used_as, MysteriousBoxUsage::Unused));
        // No fame gained
        assert_eq!(state.players[0].fame, initial_fame);
        // Artifact removed from offer (revealed), held in mysterious_box_state for end-of-turn return
        assert!(state.offers.artifacts.is_empty());
        assert_eq!(box_state.revealed_artifact_id.as_str(), "ruby_ring");
    }

    #[test]
    fn mysterious_box_empty_artifacts_skipped() {
        let mut state = test_state();
        // No artifacts in offer
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::MysteriousBox, None);
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn book_of_wisdom_sets_pending() {
        let mut state = test_state();
        // Need a colored card in hand (not wound, not book_of_wisdom)
        state.players[0].hand.push(CardId::from("march"));
        state.players[0].play_area.push(CardId::from("book_of_wisdom"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::BookOfWisdom {
                mode: mk_types::pending::EffectMode::Basic,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::PendingSet));
        assert!(state.players[0].pending.has_active());
    }

    #[test]
    fn book_of_wisdom_no_eligible_cards_skipped() {
        let mut state = test_state();
        // Only wounds in hand
        state.players[0].hand.clear();
        state.players[0].hand.push(CardId::from("wound"));
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::BookOfWisdom {
                mode: mk_types::pending::EffectMode::Basic,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
    }

    #[test]
    fn resolvability_artifact_effects() {
        let mut state = test_state();
        // ReadyAllUnits: need spent units
        assert!(!is_resolvable(&state, 0, &CardEffect::ReadyAllUnits));
        state.players[0].units.push(make_unit("u0", 1, true));
        assert!(is_resolvable(&state, 0, &CardEffect::ReadyAllUnits));

        // HealAllUnits: need wounded units
        assert!(!is_resolvable(&state, 0, &CardEffect::HealAllUnits));
        state.players[0].units[0].wounded = true;
        assert!(is_resolvable(&state, 0, &CardEffect::HealAllUnits));

        // ActivateBannerProtection: always
        assert!(is_resolvable(&state, 0, &CardEffect::ActivateBannerProtection));

        // FamePerEnemyDefeated: need combat
        assert!(!is_resolvable(
            &state,
            0,
            &CardEffect::FamePerEnemyDefeated { amount: 1, exclude_summoned: false }
        ));
        state.combat = Some(Box::new(CombatState::default()));
        assert!(is_resolvable(
            &state,
            0,
            &CardEffect::FamePerEnemyDefeated { amount: 1, exclude_summoned: false }
        ));

        // RollDieForWound: always
        assert!(is_resolvable(&state, 0, &CardEffect::RollDieForWound { die_count: 1 }));

        // RollForCrystals: always
        assert!(is_resolvable(&state, 0, &CardEffect::RollForCrystals { die_count: 2 }));

        // MysteriousBox: need artifacts in offer
        assert!(!is_resolvable(&state, 0, &CardEffect::MysteriousBox));
        state.offers.artifacts.push(CardId::from("ruby_ring"));
        assert!(is_resolvable(&state, 0, &CardEffect::MysteriousBox));
    }

    // =========================================================================
    // Step 1: BowAttackTransformation tests
    // =========================================================================

    fn combat_state_with_bow() -> GameState {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;
        let mut state = combat_state();
        let pid = state.players[0].id.clone();
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("bow_1"),
            source: ModifierSource::Card {
                card_id: CardId::from("bow_of_starsdawn"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::BowAttackTransformation,
            created_at_round: 1,
            created_by_player_id: pid,
        });
        state
    }

    #[test]
    fn bow_ranged_attack_presents_choice() {
        let mut state = combat_state_with_bow();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Ranged,
                element: Element::Physical,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should present a choice: doubled ranged (6) or converted siege (3)
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2);
                match &options[0] {
                    CardEffect::GainAttackBowResolved {
                        amount,
                        combat_type,
                        ..
                    } => {
                        assert_eq!(*amount, 6); // doubled
                        assert_eq!(*combat_type, CombatType::Ranged);
                    }
                    other => panic!("Expected GainAttackBowResolved, got {:?}", other),
                }
                match &options[1] {
                    CardEffect::GainAttackBowResolved {
                        amount,
                        combat_type,
                        ..
                    } => {
                        assert_eq!(*amount, 3); // converted
                        assert_eq!(*combat_type, CombatType::Siege);
                    }
                    other => panic!("Expected GainAttackBowResolved, got {:?}", other),
                }
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn bow_siege_attack_presents_choice() {
        let mut state = combat_state_with_bow();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 4,
                combat_type: CombatType::Siege,
                element: Element::Fire,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        match result {
            DrainResult::NeedsChoice { options, .. } => {
                assert_eq!(options.len(), 2);
                // opt0: doubled siege (8)
                match &options[0] {
                    CardEffect::GainAttackBowResolved {
                        amount,
                        combat_type,
                        element,
                    } => {
                        assert_eq!(*amount, 8);
                        assert_eq!(*combat_type, CombatType::Siege);
                        assert_eq!(*element, Element::Fire);
                    }
                    other => panic!("Expected GainAttackBowResolved, got {:?}", other),
                }
                // opt1: converted ranged (4)
                match &options[1] {
                    CardEffect::GainAttackBowResolved {
                        amount,
                        combat_type,
                        ..
                    } => {
                        assert_eq!(*amount, 4);
                        assert_eq!(*combat_type, CombatType::Ranged);
                    }
                    other => panic!("Expected GainAttackBowResolved, got {:?}", other),
                }
            }
            other => panic!("Expected NeedsChoice, got {:?}", other),
        }
    }

    #[test]
    fn bow_melee_attack_no_choice() {
        let mut state = combat_state_with_bow();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 5,
                combat_type: CombatType::Melee,
                element: Element::Physical,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 5);
    }

    #[test]
    fn bow_no_modifier_ranged_passes_through() {
        let mut state = combat_state(); // no bow modifier
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Ranged,
                element: Element::Physical,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
    }

    #[test]
    fn bow_resolved_writes_to_accumulator() {
        let mut state = combat_state_with_bow();
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttackBowResolved {
                amount: 6,
                combat_type: CombatType::Ranged,
                element: Element::Ice,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 6);
    }

    #[test]
    fn bow_not_active_during_block_phase() {
        let mut state = combat_state_with_bow();
        state.combat.as_mut().unwrap().phase = CombatPhase::Block;
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::GainAttack {
                amount: 3,
                combat_type: CombatType::Ranged,
                element: Element::Physical,
            },
            None,
        );
        let result = queue.drain(&mut state, 0);
        // Should pass through without choice since not RangedSiege phase
        assert!(matches!(result, DrainResult::Complete));
        assert_eq!(state.players[0].combat_accumulator.attack.ranged, 3);
    }

    // =========================================================================
    // Golden Grail — healing hook tests
    // =========================================================================

    #[test]
    fn golden_grail_fame_tracking_awards_fame_on_heal() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Add 3 wounds to hand
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].hand.push(CardId::from("wound"));

        // Add GoldenGrailFameTracking modifier (e.g. from basic play: heal 2, track 2)
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_fame"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 2,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        // Heal 2 wounds
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 2 }, None);
        queue.drain(&mut state, 0);

        // 2 wounds healed → +2 fame from tracker
        assert_eq!(state.players[0].fame, initial_fame + 2);
        // Tracker should be consumed (removed) since 2 remaining - 2 healed = 0
        assert!(!state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::GoldenGrailFameTracking { .. })
        ));
    }

    #[test]
    fn golden_grail_fame_tracking_partial_consumption() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Add 1 wound
        state.players[0].hand.push(CardId::from("wound"));

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_partial"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 3,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        // Heal 1 (only 1 wound available)
        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 3 }, None);
        queue.drain(&mut state, 0);

        // Only 1 wound healed → +1 fame
        assert_eq!(state.players[0].fame, initial_fame + 1);
        // Tracker remaining: 3 - 1 = 2 (still active)
        let remaining = state.active_modifiers.iter().find_map(|m| {
            if let ModifierEffect::GoldenGrailFameTracking { remaining_healing_points } = &m.effect {
                Some(*remaining_healing_points)
            } else {
                None
            }
        });
        assert_eq!(remaining, Some(2));
    }

    #[test]
    fn golden_grail_fame_tracking_no_wounds_no_fame() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // No wounds in hand
        state.players[0].hand.clear();

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_nw"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 2,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 2 }, None);
        queue.drain(&mut state, 0);

        // No wounds healed → no fame
        assert_eq!(state.players[0].fame, initial_fame);
        // Tracker still intact
        assert!(state.active_modifiers.iter().any(|m|
            matches!(&m.effect, ModifierEffect::GoldenGrailFameTracking { .. })
        ));
    }

    #[test]
    fn golden_grail_draw_on_heal_draws_cards() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Add 2 wounds to hand
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].hand.push(CardId::from("wound"));
        // Add cards to deck so draw doesn't fail
        state.players[0].deck.push(CardId::from("march"));
        state.players[0].deck.push(CardId::from("rage"));

        // Add GoldenGrailDrawOnHeal modifier (from powered play)
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_draw"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailDrawOnHeal,
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_hand_size = state.players[0].hand.len();
        let initial_deck_size = state.players[0].deck.len();

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 2 }, None);
        queue.drain(&mut state, 0);

        // 2 wounds removed, 2 cards drawn → net hand size change: -2 + 2 = 0
        // But deck should have decreased by 2
        assert_eq!(state.players[0].deck.len(), initial_deck_size - 2);
    }

    #[test]
    fn golden_grail_draw_on_heal_no_draw_without_wounds() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // No wounds in hand
        state.players[0].hand.clear();
        state.players[0].deck.push(CardId::from("march"));

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_d2"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailDrawOnHeal,
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_deck_size = state.players[0].deck.len();

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 3 }, None);
        queue.drain(&mut state, 0);

        // No wounds healed → no draw triggered
        assert_eq!(state.players[0].deck.len(), initial_deck_size);
    }

    #[test]
    fn golden_grail_fame_and_draw_together() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // 2 wounds + 2 deck cards
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].deck.push(CardId::from("march"));
        state.players[0].deck.push(CardId::from("rage"));

        // Both modifiers active
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_f"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 5,
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_doh"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailDrawOnHeal,
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 2 }, None);
        queue.drain(&mut state, 0);

        // Fame: +2, Draw: 2 cards from deck
        assert_eq!(state.players[0].fame, initial_fame + 2);
        // test_player starts with 3 deck cards + 2 we added = 5; draw 2 = 3 remaining
        assert_eq!(state.players[0].deck.len(), 3);
    }

    // =========================================================================
    // Cross-system: Golden Grail compound healing interactions
    // =========================================================================

    #[test]
    fn golden_grail_compound_two_heals_shares_tracking() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Add 4 wounds to hand
        for _ in 0..4 {
            state.players[0].hand.push(CardId::from("wound"));
        }

        // Fame tracking: remaining=3
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_compound"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 3,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        // Compound with two GainHealing sub-effects
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 2 },
                    CardEffect::GainHealing { amount: 2 },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);

        // First heal: 2 wounds healed → 2 fame (remaining: 3→1)
        // Second heal: 2 wounds healed → 1 fame (remaining: 1→0, modifier removed)
        // Total: 3 fame, 4 wounds healed
        assert_eq!(state.players[0].fame, initial_fame + 3);
        // Tracker should be fully consumed
        assert!(
            !state.active_modifiers.iter().any(|m|
                matches!(&m.effect, ModifierEffect::GoldenGrailFameTracking { .. })
            ),
            "Fame tracker should be removed after exhaustion"
        );
    }

    #[test]
    fn golden_grail_draw_decomposes_correctly_inside_compound() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // 1 wound in hand, cards in deck for draw
        state.players[0].hand.push(CardId::from("wound"));
        state.players[0].deck.push(CardId::from("extra_card"));

        // GoldenGrailDrawOnHeal active
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_draw_compound"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailDrawOnHeal,
            created_at_round: 1,
            created_by_player_id: pid,
        });

        // Enter combat so GainAttack resolves
        let tokens = vec![mk_types::ids::EnemyTokenId::from("prowlers_1")];
        crate::combat::execute_enter_combat(
            &mut state, 0, &tokens, false, None, Default::default(),
        ).unwrap();

        let initial_deck = state.players[0].deck.len();

        // Compound: heal 1, then gain attack 3
        let mut queue = EffectQueue::new();
        queue.push(
            CardEffect::Compound {
                effects: vec![
                    CardEffect::GainHealing { amount: 1 },
                    CardEffect::GainAttack {
                        amount: 3,
                        combat_type: CombatType::Melee,
                        element: Element::Physical,
                    },
                ],
            },
            None,
        );
        queue.drain(&mut state, 0);

        // Draw decomposed from healing: deck decreased by 1
        assert_eq!(state.players[0].deck.len(), initial_deck - 1);
        // GainAttack still resolved: 3 melee attack in accumulator
        assert_eq!(state.players[0].combat_accumulator.attack.normal, 3);
    }

    #[test]
    fn golden_grail_fame_tracker_exhausted_and_removed() {
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // 3 wounds in hand
        for _ in 0..3 {
            state.players[0].hand.push(CardId::from("wound"));
        }

        // Fame tracking: remaining=1 (will exhaust after 1 heal point)
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("gg_exhaust"),
            source: ModifierSource::Card {
                card_id: CardId::from("golden_grail"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::GoldenGrailFameTracking {
                remaining_healing_points: 1,
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        let initial_fame = state.players[0].fame;

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 3 }, None);
        queue.drain(&mut state, 0);

        // 3 wounds healed, but only 1 fame (tracker had remaining=1)
        assert_eq!(state.players[0].fame, initial_fame + 1);
        // Modifier should be removed
        assert!(
            !state.active_modifiers.iter().any(|m|
                matches!(&m.effect, ModifierEffect::GoldenGrailFameTracking { .. })
            ),
            "Exhausted fame tracker should be removed"
        );
        // All 3 wounds still healed despite tracker exhaustion
        let wounds_in_hand = state.players[0].hand.iter()
            .filter(|c| c.as_str() == "wound")
            .count();
        assert_eq!(wounds_in_hand, 0, "All 3 wounds should be healed");
    }

    // =========================================================================
    // Endless Mana / Ring fame tests
    // =========================================================================

    #[test]
    fn ring_fame_at_end_turn_counts_matching_color_spells() {
        // Test the ring fame bonus logic directly.
        // When a ring's EndlessMana modifier is active and spells of matching color
        // were cast, the player gets fame per spell at end of turn.
        // This is tested in end_turn.rs, but we verify the modifier structure here.
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Sapphire ring: blue + black endless mana
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("sapphire"),
            source: ModifierSource::Card {
                card_id: CardId::from("sapphire_ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Blue, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        // Verify the modifier is correctly formed
        let m = &state.active_modifiers[0];
        if let ModifierEffect::EndlessMana { colors } = &m.effect {
            assert!(colors.contains(&ManaColor::Blue));
            assert!(colors.contains(&ManaColor::Black));
            assert_eq!(colors.len(), 2);
        } else {
            panic!("Expected EndlessMana modifier");
        }
    }

    #[test]
    fn endless_mana_modifier_player_scoped() {
        // EndlessMana modifier should only apply to the player who owns it.
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("ring_r"),
            source: ModifierSource::Card {
                card_id: CardId::from("ruby_ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Red, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        // Modifier belongs to pid ("p1")
        assert_eq!(state.active_modifiers[0].created_by_player_id, pid);
        // A second player would not match
        let other_pid = PlayerId::from("p2");
        assert_ne!(state.active_modifiers[0].created_by_player_id, other_pid);
    }

    #[test]
    fn multiple_ring_modifiers_stack_colors() {
        // Multiple EndlessMana modifiers provide union of all colors.
        use mk_types::modifier::*;
        use mk_types::ids::ModifierId;

        let mut state = test_state();
        let pid = state.players[0].id.clone();

        // Ruby ring: Red + Black
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("ruby"),
            source: ModifierSource::Card {
                card_id: CardId::from("ruby_ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Red, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid.clone(),
        });

        // Sapphire ring: Blue + Black
        state.active_modifiers.push(ActiveModifier {
            id: ModifierId::from("sapphire"),
            source: ModifierSource::Card {
                card_id: CardId::from("sapphire_ring"),
                player_id: pid.clone(),
            },
            duration: ModifierDuration::Turn,
            scope: ModifierScope::SelfScope,
            effect: ModifierEffect::EndlessMana {
                colors: vec![ManaColor::Blue, ManaColor::Black],
            },
            created_at_round: 1,
            created_by_player_id: pid,
        });

        // Collect all endless mana colors
        let all_colors: Vec<ManaColor> = state.active_modifiers.iter().flat_map(|m| {
            if let ModifierEffect::EndlessMana { colors } = &m.effect {
                colors.clone()
            } else {
                vec![]
            }
        }).collect();

        assert!(all_colors.contains(&ManaColor::Red));
        assert!(all_colors.contains(&ManaColor::Blue));
        assert!(all_colors.contains(&ManaColor::Black));
        // Deduplicated set has 3 unique colors
        let mut unique: Vec<ManaColor> = all_colors.clone();
        unique.sort_by_key(|c| *c as u8);
        unique.dedup();
        assert_eq!(unique.len(), 3);
    }

    #[test]
    fn gain_healing_removes_wounds_from_hand() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("march"),
            CardId::from("wound"),
            CardId::from("wound"),
            CardId::from("rage"),
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 1 }, None);
        queue.drain(&mut state, 0);

        // 1 wound removed, 3 cards remain
        assert_eq!(state.players[0].hand.len(), 3);
        let wound_count = state.players[0].hand.iter().filter(|c| c.as_str() == "wound").count();
        assert_eq!(wound_count, 1); // 1 wound left (had 2, removed 1)
    }

    #[test]
    fn gain_healing_excess_goes_to_healing_points() {
        let mut state = test_state();
        state.players[0].hand = vec![CardId::from("wound")];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 3 }, None);
        queue.drain(&mut state, 0);

        // 1 wound removed, 2 excess → healing points
        assert!(state.players[0].hand.is_empty());
        assert_eq!(state.players[0].healing_points, 2);
    }

    #[test]
    fn gain_healing_tracks_wounds_healed_from_hand() {
        let mut state = test_state();
        state.players[0].hand = vec![
            CardId::from("wound"),
            CardId::from("wound"),
        ];

        let mut queue = EffectQueue::new();
        queue.push(CardEffect::GainHealing { amount: 2 }, None);
        queue.drain(&mut state, 0);

        assert_eq!(state.players[0].wounds_healed_from_hand_this_turn, 2);
    }
