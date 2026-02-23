//! Site interaction enumeration — EnterSite, InteractSite, BuySpell, LearnAA, BurnMonastery.

use mk_data::sites::{
    adventure_site_enemies, draws_fresh_enemies, healing_cost, is_adventure_site, is_inhabited,
    MONASTERY_AA_PURCHASE_COST, SPELL_PURCHASE_COST,
};
use mk_types::enums::SiteType;
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags};

use crate::effect_queue::WOUND_CARD_ID;

pub(super) fn enumerate_site_actions(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let pos = match player.position {
        Some(p) => p,
        None => return,
    };

    let hex_state = match state.map.hexes.get(&pos.key()) {
        Some(h) => h,
        None => return,
    };

    let site = match hex_state.site.as_ref() {
        Some(s) => s,
        None => return,
    };

    // Common guards: no combat, not resting
    if state.combat.is_some() {
        return;
    }
    if player.flags.contains(PlayerFlags::IS_RESTING) {
        return;
    }

    // EnterSite — adventure sites
    if is_adventure_site(site.site_type)
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        // Dungeon/Tomb can be re-entered when conquered (for fame).
        // MonsterDen/SpawningGrounds cannot be entered when conquered.
        let can_enter = if draws_fresh_enemies(site.site_type) {
            // Dungeon/Tomb: always enterable (draw fresh enemies each time)
            true
        } else {
            // MonsterDen/SpawningGrounds: only when not conquered
            !site.is_conquered
        };

        // Must have enemies to draw from piles, or existing hex enemies for MonsterDen/SpawningGrounds
        if can_enter {
            if draws_fresh_enemies(site.site_type) {
                // Dungeon/Tomb: check if enemy pile has tokens
                if let Some(enemies_config) = adventure_site_enemies(site.site_type) {
                    let has_tokens =
                        pile_has_tokens(state, enemies_config.color, enemies_config.count);
                    if has_tokens {
                        actions.push(LegalAction::EnterSite);
                    }
                }
            } else {
                // MonsterDen/SpawningGrounds: use existing hex enemies, or draw if none
                if !hex_state.enemies.is_empty() {
                    actions.push(LegalAction::EnterSite);
                } else if let Some(enemies_config) = adventure_site_enemies(site.site_type) {
                    let has_tokens =
                        pile_has_tokens(state, enemies_config.color, enemies_config.count);
                    if has_tokens {
                        actions.push(LegalAction::EnterSite);
                    }
                }
            }
        }
    }

    // AncientRuins — altar tribute or enter site (enemy token)
    // NOTE: AncientRuins are NOT blocked by X-space (rep -7) — they're adventure sites.
    if site.site_type == SiteType::AncientRuins
        && !site.is_conquered
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        if let Some(ref ruins_token) = hex_state.ruins_token {
            if ruins_token.is_revealed {
                match mk_data::ruins_tokens::get_ruins_token(ruins_token.token_id.as_str()) {
                    Some(mk_data::ruins_tokens::RuinsTokenDef::Altar(altar)) => {
                        // Check if the player can afford the altar cost
                        let sources = collect_altar_mana_sources(state, player_idx, altar);
                        if !sources.is_empty() {
                            actions.push(LegalAction::AltarTribute {
                                mana_sources: sources,
                            });
                        }
                    }
                    Some(mk_data::ruins_tokens::RuinsTokenDef::Enemy(enemy_token)) => {
                        // If enemies are already on the hex from a previous retreat,
                        // the player can re-enter to fight them (no fresh draw needed).
                        if !hex_state.enemies.is_empty() {
                            actions.push(LegalAction::EnterSite);
                        } else {
                            // First entry: check if all enemy colors have tokens available
                            let can_fight = enemy_token.enemy_colors.iter().all(|&color| {
                                pile_has_tokens(state, color, 1)
                            });
                            if can_fight {
                                actions.push(LegalAction::EnterSite);
                            }
                        }
                    }
                    None => {}
                }
            }
        }
    }

    // === Inhabited site interactions below — blocked by X-space (rep -7) ===
    if player.reputation == -7 {
        return;
    }

    // Compute effective influence once (accounts for reputation bonus + shield tokens)
    let effective_influence = compute_effective_influence(state, player_idx);

    // InteractSite — healing at inhabited sites
    if is_inhabited(site.site_type)
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
    {
        // Access check: Village/Monastery/RefugeeCamp always accessible.
        // Keep/MageTower/City only when conquered.
        let accessible = match site.site_type {
            SiteType::Keep | SiteType::MageTower | SiteType::City => site.is_conquered,
            _ => true,
        };

        // Must not be burned
        if accessible && !site.is_burned {
            if let Some(cost) = healing_cost(site.site_type) {
                let wounds_in_hand = player
                    .hand
                    .iter()
                    .filter(|c| c.as_str() == WOUND_CARD_ID)
                    .count() as u32;
                let max_healing = if cost > 0 {
                    (effective_influence / cost).min(wounds_in_hand)
                } else {
                    wounds_in_hand
                };

                for healing in 1..=max_healing {
                    actions.push(LegalAction::InteractSite { healing });
                }
            }
        }
    }

    // BuySpell — at conquered Mage Tower (7 influence + matching-color mana)
    if site.site_type == SiteType::MageTower
        && site.is_conquered
        && !player
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN)
        && effective_influence >= SPELL_PURCHASE_COST
    {
        for (idx, card_id) in state.offers.spells.iter().enumerate() {
            if let Some(color) = mk_data::cards::get_spell_color(card_id.as_str()) {
                if super::units::can_afford_mana(player, color) {
                    actions.push(LegalAction::BuySpell {
                        card_id: card_id.clone(),
                        offer_index: idx,
                        mana_color: color,
                    });
                }
            }
        }
    }

    // LearnAdvancedAction — at non-burned Monastery
    if site.site_type == SiteType::Monastery
        && !site.is_burned
        && effective_influence >= MONASTERY_AA_PURCHASE_COST
    {
        for (idx, card_id) in state.offers.monastery_advanced_actions.iter().enumerate() {
            actions.push(LegalAction::LearnAdvancedAction {
                card_id: card_id.clone(),
                offer_index: idx,
            });
        }
    }

    // BurnMonastery — at non-burned Monastery
    if site.site_type == SiteType::Monastery
        && !site.is_burned
        && !player
            .flags
            .contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        && !player
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN)
    {
        // Must have violet tokens to draw
        if pile_has_tokens(state, mk_types::enums::EnemyColor::Violet, 1) {
            actions.push(LegalAction::BurnMonastery);
        }
    }
}

// =============================================================================
// Reputation influence bonus helpers
// =============================================================================

/// Reputation influence bonus table — same magnitude as unit recruitment's
/// `reputation_cost_modifier()` but inverted sign (positive rep = positive bonus).
///
/// | Rep | Bonus |
/// |-----|-------|
/// | 0   | 0     |
/// | ±1,2| ±1    |
/// | ±3,4| ±2    |
/// | ±5,6| ±3    |
/// | ±7  | ±5    |
pub(crate) fn reputation_influence_bonus(reputation: i8) -> i32 {
    let rep = reputation.clamp(-7, 7);
    if rep == 0 {
        return 0;
    }
    if rep == 7 {
        return 5;
    }
    if rep == -7 {
        return -5;
    }
    let abs_rep = rep.unsigned_abs();
    let magnitude = if abs_rep <= 2 {
        1
    } else if abs_rep <= 4 {
        2
    } else {
        3
    };
    if rep > 0 { magnitude } else { -magnitude }
}

/// Compute effective influence at a site, accounting for reputation bonus and
/// shield tokens on conquered cities.
///
/// If the reputation bonus has already been applied this turn (flag set),
/// returns the raw `influence_points`. Otherwise, adds the bonus that _would_
/// be applied at interaction time so the enumeration layer can check affordability.
pub(crate) fn compute_effective_influence(
    state: &GameState,
    player_idx: usize,
) -> u32 {
    let player = &state.players[player_idx];

    // If bonus already applied (mutated into influence_points), just return current value
    if player
        .flags
        .contains(PlayerFlags::REPUTATION_BONUS_APPLIED_THIS_TURN)
    {
        return player.influence_points;
    }

    let mut bonus: i32 = 0;

    // Reputation bonus (only at inhabited sites)
    let pos = match player.position {
        Some(p) => p,
        None => return player.influence_points,
    };
    let hex_state = match state.map.hexes.get(&pos.key()) {
        Some(h) => h,
        None => return player.influence_points,
    };
    let site = match hex_state.site.as_ref() {
        Some(s) => s,
        None => return player.influence_points,
    };

    if !is_inhabited(site.site_type) {
        return player.influence_points;
    }

    bonus += reputation_influence_bonus(player.reputation);

    // Shield token bonus: each shield token of this player on a conquered City
    if site.site_type == SiteType::City && site.is_conquered {
        let shield_count = hex_state
            .shield_tokens
            .iter()
            .filter(|id| **id == player.id)
            .count() as i32;
        bonus += shield_count;
    }

    let raw = player.influence_points as i32 + bonus;
    raw.max(0) as u32
}

/// Collect mana sources needed to pay an altar's cost, or return empty if unaffordable.
///
/// For each (color, count) in the altar cost, we need `count` sources of that color.
/// Sources are: tokens of matching color, gold tokens (wild), crystals of matching color.
fn collect_altar_mana_sources(
    state: &GameState,
    player_idx: usize,
    altar: &mk_data::ruins_tokens::AltarToken,
) -> Vec<mk_types::action::ManaSourceInfo> {
    use mk_types::action::ManaSourceInfo;
    use mk_types::enums::{ManaColor, ManaSourceType};

    let player = &state.players[player_idx];
    let mut sources = Vec::new();

    // Track which tokens and crystals we've already "claimed" for this payment
    let mut used_token_indices: Vec<usize> = Vec::new();
    let mut used_crystals = mk_types::state::Crystals::default();
    let mut _used_gold_tokens: usize = 0;

    for &(color, count) in altar.cost {
        let mana_color = ManaColor::from(color);

        for _ in 0..count {
            // Try matching-color token first
            let token_idx = player.pure_mana.iter().enumerate().find(|(i, t)| {
                t.color == mana_color && !used_token_indices.contains(i)
            });

            if let Some((idx, _)) = token_idx {
                used_token_indices.push(idx);
                sources.push(ManaSourceInfo {
                    source_type: ManaSourceType::Token,
                    color: mana_color,
                    die_id: None,
                });
                continue;
            }

            // Try gold token (wild)
            let gold_idx = player.pure_mana.iter().enumerate().find(|(i, t)| {
                t.color == ManaColor::Gold && !used_token_indices.contains(i)
            });

            if let Some((idx, _)) = gold_idx {
                used_token_indices.push(idx);
                _used_gold_tokens += 1;
                sources.push(ManaSourceInfo {
                    source_type: ManaSourceType::Token,
                    color: ManaColor::Gold,
                    die_id: None,
                });
                continue;
            }

            // Try crystal
            let crystal_count = match color {
                mk_types::enums::BasicManaColor::Red => player.crystals.red - used_crystals.red,
                mk_types::enums::BasicManaColor::Blue => player.crystals.blue - used_crystals.blue,
                mk_types::enums::BasicManaColor::Green => player.crystals.green - used_crystals.green,
                mk_types::enums::BasicManaColor::White => player.crystals.white - used_crystals.white,
            };

            if crystal_count > 0 {
                match color {
                    mk_types::enums::BasicManaColor::Red => used_crystals.red += 1,
                    mk_types::enums::BasicManaColor::Blue => used_crystals.blue += 1,
                    mk_types::enums::BasicManaColor::Green => used_crystals.green += 1,
                    mk_types::enums::BasicManaColor::White => used_crystals.white += 1,
                }
                sources.push(ManaSourceInfo {
                    source_type: ManaSourceType::Crystal,
                    color: mana_color,
                    die_id: None,
                });
                continue;
            }

            // Cannot afford — return empty
            return Vec::new();
        }
    }

    sources
}

/// Check if a color pile has at least `count` tokens available.
fn pile_has_tokens(
    state: &GameState,
    color: mk_types::enums::EnemyColor,
    count: u32,
) -> bool {
    use mk_types::enums::EnemyColor;
    let piles = &state.enemy_tokens;
    let (draw, discard) = match color {
        EnemyColor::Green => (&piles.green_draw, &piles.green_discard),
        EnemyColor::Gray => (&piles.gray_draw, &piles.gray_discard),
        EnemyColor::Brown => (&piles.brown_draw, &piles.brown_discard),
        EnemyColor::Violet => (&piles.violet_draw, &piles.violet_discard),
        EnemyColor::White => (&piles.white_draw, &piles.white_discard),
        EnemyColor::Red => (&piles.red_draw, &piles.red_discard),
    };
    (draw.len() + discard.len()) >= count as usize
}
