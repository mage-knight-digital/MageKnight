//! Resolvability checks and condition/scaling evaluators.

use mk_types::effect::*;
use mk_types::enums::*;
use mk_types::state::*;

use crate::card_play::is_die_available_with_overrides;
use super::{MAX_CRYSTALS_PER_COLOR, WOUND_CARD_ID};

// =============================================================================
// Resolvability check
// =============================================================================

/// Check if an effect can currently be resolved (used for Choice filtering).
pub(crate) fn is_resolvable(state: &GameState, player_idx: usize, effect: &CardEffect) -> bool {
    let player = &state.players[player_idx];

    match effect {
        // Always resolvable
        CardEffect::GainMove { .. }
        | CardEffect::GainInfluence { .. }
        | CardEffect::GainFame { .. }
        | CardEffect::ChangeReputation { .. }
        | CardEffect::GainMana { .. }
        | CardEffect::GainCrystal { .. }
        | CardEffect::TakeWound
        | CardEffect::Noop => true,

        // Only in combat
        CardEffect::GainAttack { .. }
        | CardEffect::GainBlock { .. }
        | CardEffect::GainBlockElement { .. }
        | CardEffect::AttackWithDefeatBonus { .. } => state.combat.is_some(),

        // Need wounds in hand; healing is not usable during combat (MK rules).
        CardEffect::GainHealing { .. } => {
            state.combat.is_none()
                && (player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID)
                    || player.units.iter().any(|u| u.wounded))
        }

        // Need cards in deck
        CardEffect::DrawCards { .. } => !player.deck.is_empty(),

        // Compound: at least one sub-effect resolvable
        CardEffect::Compound { effects } => {
            effects.iter().any(|e| is_resolvable(state, player_idx, e))
        }

        // Choice: at least one option resolvable
        CardEffect::Choice { options } => {
            options.iter().any(|o| is_resolvable(state, player_idx, o))
        }

        // Conditional: always resolvable (condition evaluated at resolve time)
        CardEffect::Conditional { .. } => true,

        // Scaling: resolvable if base effect is resolvable
        CardEffect::Scaling { base_effect, .. } => is_resolvable(state, player_idx, base_effect),

        // Crystallize: resolvable if player has a basic-color mana token OR an available
        // basic-color source die (gold/black excluded — no gold/black crystal exists)
        CardEffect::ConvertManaToCrystal => {
            let has_basic_token = player.pure_mana.iter().any(|t| {
                matches!(t.color, ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White)
            });
            if has_basic_token {
                return true;
            }
            // Check source dice: basic color, available, not already used this turn
            if player.flags.contains(PlayerFlags::USED_MANA_FROM_SOURCE) {
                return false;
            }
            let player_id = &player.id;
            let stolen_die_id = player
                .tactic_state
                .stored_mana_die
                .as_ref()
                .map(|s| &s.die_id);
            state.source.dice.iter().any(|die| {
                if !is_die_available_with_overrides(die, state, player_idx) {
                    return false;
                }
                let is_available = die.taken_by_player_id.is_none()
                    || (die.taken_by_player_id.as_ref() == Some(player_id)
                        && stolen_die_id == Some(&die.id));
                is_available
                    && matches!(die.color, ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White)
            })
        }

        // Multi-step effects: resolvable by default (will be filtered at resolve time)
        CardEffect::CardBoost { .. }
        | CardEffect::ManaDrawPowered { .. }
        | CardEffect::DiscardCost { .. }
        | CardEffect::ApplyModifier { .. }
        | CardEffect::HandLimitBonus { .. }
        | CardEffect::ReadyUnit { .. }
        | CardEffect::HealUnit { .. }
        | CardEffect::DiscardForBonus { .. }
        | CardEffect::Decompose { .. }
        | CardEffect::DiscardForAttack { .. }
        | CardEffect::PureMagic { .. } => true,

        // Training/MaximalEffect: need at least one non-wound action card in hand
        // besides the source card itself (which will move to play area on resolution).
        // Require >= 2 eligible cards since the source card is one of them.
        CardEffect::Training { .. } | CardEffect::MaximalEffect { .. } => {
            let eligible_count = state.players[player_idx].hand.iter().filter(|card_id| {
                mk_data::cards::get_card(card_id.as_str()).is_some_and(|def| {
                    matches!(
                        def.card_type,
                        DeedCardType::BasicAction | DeedCardType::AdvancedAction
                    )
                })
            }).count();
            eligible_count >= 2
        }

        // SelectCombatEnemy: only in combat
        CardEffect::SelectCombatEnemy { .. } => state.combat.is_some(),

        // Cure: need wounds in hand
        CardEffect::Cure { .. } => player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID),

        // Disease: only in combat (sets armor for blocked enemies)
        CardEffect::Disease => state.combat.is_some(),

        // Energy Flow: need at least one spent unit
        CardEffect::EnergyFlow { .. } => player.units.iter().any(|u| u.state == UnitState::Spent),

        // Mana Bolt: need at least one mana token (non-Black)
        CardEffect::ManaBolt { .. } => player.pure_mana.iter().any(|t| {
            matches!(
                t.color,
                ManaColor::Red
                    | ManaColor::Blue
                    | ManaColor::Green
                    | ManaColor::White
                    | ManaColor::Gold
            )
        }),

        // DiscardForCrystal: always resolvable (optional can skip)
        CardEffect::DiscardForCrystal { .. } => true,

        // Sacrifice: need crystal pairs
        CardEffect::Sacrifice => {
            let c = &player.crystals;
            let has_pair = |a: u8, b: u8| a > 0 && b > 0;
            has_pair(c.green, c.red)
                || has_pair(c.green, c.blue)
                || has_pair(c.white, c.red)
                || has_pair(c.white, c.blue)
        }

        // Mana Claim: need unclaimed basic-color dice
        CardEffect::ManaClaim { .. } => state.source.dice.iter().any(|d| {
            d.taken_by_player_id.is_none()
                && !d.is_depleted
                && matches!(
                    d.color,
                    ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White
                )
        }),

        // === Advanced Action effects ===
        CardEffect::SelectUnitForModifier { .. } => {
            // Resolvable if player has at least one unit
            !player.units.is_empty()
        }
        CardEffect::SongOfWindPowered => true,
        CardEffect::RushOfAdrenaline { .. } => true,
        CardEffect::PowerOfCrystalsBasic => {
            // Resolvable if any color is below max
            let c = &player.crystals;
            c.red < MAX_CRYSTALS_PER_COLOR || c.blue < MAX_CRYSTALS_PER_COLOR
                || c.green < MAX_CRYSTALS_PER_COLOR || c.white < MAX_CRYSTALS_PER_COLOR
        }
        CardEffect::PowerOfCrystalsPowered => state.combat.is_none(),
        CardEffect::CrystalMasteryBasic => {
            // Resolvable if player owns at least 1 crystal of some color AND that color < 3
            let c = &player.crystals;
            (c.red > 0 && c.red < MAX_CRYSTALS_PER_COLOR)
                || (c.blue > 0 && c.blue < MAX_CRYSTALS_PER_COLOR)
                || (c.green > 0 && c.green < MAX_CRYSTALS_PER_COLOR)
                || (c.white > 0 && c.white < MAX_CRYSTALS_PER_COLOR)
        }
        CardEffect::CrystalMasteryPowered => true,
        CardEffect::ManaStormBasic => {
            state.source.dice.iter().any(|d| {
                d.taken_by_player_id.is_none()
                    && !d.is_depleted
                    && matches!(d.color, ManaColor::Red | ManaColor::Blue | ManaColor::Green | ManaColor::White)
            })
        }
        CardEffect::ManaStormPowered => true,
        CardEffect::SpellForgeBasic | CardEffect::SpellForgePowered => {
            !state.offers.spells.is_empty()
        }
        CardEffect::MagicTalentBasic => {
            // Need spells in offer + discardable colored card
            !state.offers.spells.is_empty()
                && player.hand.iter().any(|c| {
                    c.as_str() != WOUND_CARD_ID && c.as_str() != "magic_talent"
                        && mk_data::cards::get_card_color(c.as_str()).is_some()
                })
        }
        CardEffect::MagicTalentPowered => {
            // Need spell in offer + matching mana token
            state.offers.spells.iter().any(|spell_id| {
                if let Some(color) = mk_data::cards::get_spell_color(spell_id.as_str()) {
                    let target = ManaColor::from(color);
                    player.pure_mana.iter().any(|t| t.color == target)
                } else {
                    false
                }
            })
        }
        CardEffect::BloodOfAncientsBasic => true, // Always resolvable (wound is taken regardless)
        CardEffect::BloodOfAncientsPowered => !state.offers.advanced_actions.is_empty(),
        CardEffect::PeacefulMomentAction { .. } => state.combat.is_none(),
        CardEffect::PeacefulMomentConvert { .. } => true,

        // === Spell effects (new) ===
        CardEffect::ManaMeltdown { powered } => {
            if *powered {
                // Solo Mana Radiance: need at least 1 crystal
                let c = &player.crystals;
                c.red > 0 || c.blue > 0 || c.green > 0 || c.white > 0
            } else {
                // Solo Mana Meltdown basic: skip (no opponents)
                false
            }
        }
        CardEffect::MindRead { .. } => {
            // Solo: choose color → gain crystal (always resolvable if any color < max)
            let c = &player.crystals;
            c.red < MAX_CRYSTALS_PER_COLOR || c.blue < MAX_CRYSTALS_PER_COLOR
                || c.green < MAX_CRYSTALS_PER_COLOR || c.white < MAX_CRYSTALS_PER_COLOR
        }
        CardEffect::CallToArms => {
            // Need units in offer with activatable abilities
            !state.offers.units.is_empty()
        }
        CardEffect::FreeRecruit => {
            // Need units in offer
            !state.offers.units.is_empty()
        }
        CardEffect::WingsOfNight => {
            // Need to be in combat with non-arcane-immune enemies
            state.combat.is_some()
        }
        CardEffect::PossessEnemy => {
            // Need to be in combat with non-arcane-immune enemies
            state.combat.is_some()
        }
        CardEffect::Meditation { .. } => true,
        CardEffect::ReadyUnitsBudget { .. } => {
            // Need at least one spent unit
            player.units.iter().any(|u| u.state == UnitState::Spent)
        }
        CardEffect::GrantWoundImmunity => true,

        // === Artifact effects ===
        CardEffect::ReadyAllUnits => player.units.iter().any(|u| u.state == UnitState::Spent),
        CardEffect::HealAllUnits => player.units.iter().any(|u| u.wounded),
        CardEffect::ActivateBannerProtection => true,
        CardEffect::FamePerEnemyDefeated { .. } => state.combat.is_some(),
        CardEffect::RollDieForWound { .. } => true,
        CardEffect::ChooseBonusWithRisk { .. } => state.combat.is_some(),
        CardEffect::RollForCrystals { .. } => true,
        CardEffect::BookOfWisdom { .. } => {
            // Need non-wound, non-self action card in hand
            player.hand.iter().any(|c| {
                c.as_str() != WOUND_CARD_ID && c.as_str() != "book_of_wisdom"
                    && mk_data::cards::get_card_color(c.as_str()).is_some()
            })
        }
        CardEffect::TomeOfAllSpells { .. } => {
            // Need colored card in hand + spell in offer
            !state.offers.spells.is_empty()
                && player.hand.iter().any(|c| {
                    c.as_str() != WOUND_CARD_ID && c.as_str() != "tome_of_all_spells"
                })
        }
        CardEffect::CircletOfProficiencyBasic | CardEffect::CircletOfProficiencyPowered => true,
        CardEffect::MysteriousBox => !state.offers.artifacts.is_empty(),
        CardEffect::DruidicStaffBasic => {
            // Need non-wound card in hand to discard
            player.hand.iter().any(|c| c.as_str() != WOUND_CARD_ID && c.as_str() != "druidic_staff")
        }
        CardEffect::DruidicStaffPowered => true, // Always has 6 choices
        CardEffect::GainAttackBowResolved { .. } => state.combat.is_some(),

        // Unknown: default resolvable
        CardEffect::Other { .. } => true,
    }
}

// =============================================================================
// Condition evaluator
// =============================================================================

/// Evaluate a condition against the current game state for a player.
pub(super) fn evaluate_condition(state: &GameState, player_idx: usize, condition: &EffectCondition) -> bool {
    let player = &state.players[player_idx];

    match condition {
        EffectCondition::TimeOfDay { time } => state.time_of_day == *time,

        EffectCondition::InCombat => state.combat.is_some(),

        EffectCondition::InPhase { phases } => state
            .combat
            .as_ref()
            .is_some_and(|c| phases.contains(&c.phase)),

        EffectCondition::OnTerrain { terrain } => player.position.as_ref().is_some_and(|pos| {
            state
                .map
                .hexes
                .get(&pos.key())
                .is_some_and(|hex| terrain.contains(&hex.terrain))
        }),

        EffectCondition::BlockedSuccessfully => state
            .combat
            .as_ref()
            .is_some_and(|c| c.all_damage_blocked_this_phase),

        EffectCondition::EnemyDefeatedThisCombat => state
            .combat
            .as_ref()
            .is_some_and(|c| c.enemies.iter().any(|e| e.is_defeated)),

        EffectCondition::ManaUsedThisTurn { color } => match color {
            Some(c) => player.mana_used_this_turn.contains(c),
            None => !player.mana_used_this_turn.is_empty(),
        },

        EffectCondition::HasWoundsInHand => player.hand.iter().any(|c| c.as_str() == WOUND_CARD_ID),

        EffectCondition::NoUnitRecruitedThisTurn => !player
            .flags
            .contains(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN),

        EffectCondition::LowestFame => {
            let player_fame = player.fame;
            let min_fame = state.players.iter().map(|p| p.fame).min().unwrap_or(0);
            player_fame <= min_fame
        }

        EffectCondition::IsNightOrUnderground => {
            state.time_of_day == TimeOfDay::Night
                || state.combat.as_ref().is_some_and(|c| c.night_mana_rules)
        }

        EffectCondition::InInteraction => {
            // Simplified: check if player is at a site (full check needs site properties)
            player.position.as_ref().is_some_and(|pos| {
                state
                    .map
                    .hexes
                    .get(&pos.key())
                    .and_then(|hex| hex.site.as_ref())
                    .is_some()
            })
        }

        EffectCondition::AtFortifiedSite => {
            // Simplified: check if player is at keep, mage tower, or city
            player.position.as_ref().is_some_and(|pos| {
                state
                    .map
                    .hexes
                    .get(&pos.key())
                    .and_then(|hex| hex.site.as_ref())
                    .is_some_and(|site| {
                        matches!(
                            site.site_type,
                            SiteType::Keep | SiteType::MageTower | SiteType::City
                        )
                    })
            })
        }

        EffectCondition::AtMagicalGlade => player.position.as_ref().is_some_and(|pos| {
            state
                .map
                .hexes
                .get(&pos.key())
                .and_then(|hex| hex.site.as_ref())
                .is_some_and(|site| site.site_type == SiteType::MagicalGlade)
        }),
    }
}

// =============================================================================
// Scaling evaluator
// =============================================================================

/// Evaluate a scaling factor and return the multiplier count.
pub(super) fn evaluate_scaling(state: &GameState, player_idx: usize, factor: &ScalingFactor) -> u32 {
    let player = &state.players[player_idx];

    match factor {
        ScalingFactor::PerEnemy => state
            .combat
            .as_ref()
            .map(|c| {
                c.enemies
                    .iter()
                    .filter(|e| !e.is_defeated && e.summoned_by_instance_id.is_none())
                    .count() as u32
            })
            .unwrap_or(0),

        ScalingFactor::PerWoundInHand => player
            .hand
            .iter()
            .filter(|c| c.as_str() == WOUND_CARD_ID)
            .count() as u32,

        ScalingFactor::PerWoundThisCombat => state
            .combat
            .as_ref()
            .map(|c| c.wounds_this_combat)
            .unwrap_or(0),

        ScalingFactor::PerUnit { filter } => count_units_with_filter(player, filter.as_ref()),

        ScalingFactor::PerCrystalColor => {
            let c = &player.crystals;
            let mut count = 0u32;
            if c.red > 0 {
                count += 1;
            }
            if c.blue > 0 {
                count += 1;
            }
            if c.green > 0 {
                count += 1;
            }
            if c.white > 0 {
                count += 1;
            }
            count
        }

        ScalingFactor::PerCompleteCrystalSet => {
            let c = &player.crystals;
            c.red.min(c.blue).min(c.green).min(c.white) as u32
        }

        ScalingFactor::PerEmptyCommandToken => {
            let used = player.units.len() as u32;
            player.command_tokens.saturating_sub(used)
        }

        ScalingFactor::PerWoundTotal => {
            let in_hand = player
                .hand
                .iter()
                .filter(|c| c.as_str() == WOUND_CARD_ID)
                .count() as u32;
            let wounded_units = player.units.iter().filter(|u| u.wounded).count() as u32;
            in_hand + wounded_units
        }

        ScalingFactor::PerEnemyBlocked => state
            .combat
            .as_ref()
            .map(|c| {
                c.enemies
                    .iter()
                    .filter(|e| e.is_blocked && e.summoned_by_instance_id.is_none())
                    .count() as u32
            })
            .unwrap_or(0),
    }
}

fn count_units_with_filter(player: &PlayerState, filter: Option<&UnitFilter>) -> u32 {
    match filter {
        None => {
            // Default: count non-wounded units
            player.units.iter().filter(|u| !u.wounded).count() as u32
        }
        Some(f) => player
            .units
            .iter()
            .filter(|u| {
                if let Some(wounded) = f.wounded {
                    if u.wounded != wounded {
                        return false;
                    }
                }
                if let Some(required_state) = &f.state {
                    if u.state != *required_state {
                        return false;
                    }
                }
                true
            })
            .count() as u32,
    }
}
