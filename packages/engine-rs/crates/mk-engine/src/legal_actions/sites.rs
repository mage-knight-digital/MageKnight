//! Site interaction enumeration — EnterSite and InteractSite.

use mk_data::sites::{
    adventure_site_enemies, draws_fresh_enemies, healing_cost, is_adventure_site, is_inhabited,
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
                    (player.influence_points / cost).min(wounds_in_hand)
                } else {
                    wounds_in_hand
                };

                for healing in 1..=max_healing {
                    actions.push(LegalAction::InteractSite { healing });
                }
            }
        }
    }
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
