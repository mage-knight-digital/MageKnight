//! Enemy token pile creation and drawing helpers.
//!
//! One token per enemy definition. Token IDs use the format `"{enemy_id}_{counter}"`.
//! Drawing takes from the top (index 0) of the draw pile. If empty, reshuffles discard.

use mk_types::enums::{EnemyColor, RampagingEnemyType, SiteType};
use mk_types::ids::EnemyTokenId;
use mk_types::rng::RngState;
use mk_types::state::EnemyTokenPiles;

use crate::enemies::all_enemy_ids_for_color;

// =============================================================================
// Pile creation
// =============================================================================

/// Create shuffled enemy token piles for a game.
/// One token per enemy definition, shuffled per color.
pub fn create_enemy_token_piles(rng: &mut RngState) -> EnemyTokenPiles {
    let mut piles = EnemyTokenPiles::default();

    let mut counter = 0u32;

    for &color in &[
        EnemyColor::Green, EnemyColor::Gray, EnemyColor::Brown,
        EnemyColor::Violet, EnemyColor::White, EnemyColor::Red,
    ] {
        let ids = all_enemy_ids_for_color(color);
        let mut tokens: Vec<EnemyTokenId> = ids.iter().map(|&id| {
            counter += 1;
            EnemyTokenId::from(format!("{}_{}", id, counter))
        }).collect();
        rng.shuffle(&mut tokens);

        let draw = get_draw_pile_mut(&mut piles, color);
        *draw = tokens;
    }

    piles
}

// =============================================================================
// Token ID helpers
// =============================================================================

/// Extract the enemy definition ID from a token ID.
///
/// Token format: `"{enemy_id}_{counter}"`. Pops the last `_N` segment.
/// Example: `"cursed_hags_3"` → `"cursed_hags"`.
pub fn enemy_id_from_token(token_id: &EnemyTokenId) -> String {
    let s = token_id.as_str();
    match s.rfind('_') {
        Some(pos) => s[..pos].to_string(),
        None => s.to_string(),
    }
}

// =============================================================================
// Drawing
// =============================================================================

/// Draw a token from a color's draw pile.
///
/// If the draw pile is empty, reshuffles the discard pile into draw.
/// Returns `None` if both piles are empty.
pub fn draw_enemy_token(
    piles: &mut EnemyTokenPiles,
    color: EnemyColor,
    rng: &mut RngState,
) -> Option<EnemyTokenId> {
    let draw = get_draw_pile_mut(piles, color);

    if !draw.is_empty() {
        return Some(draw.remove(0));
    }

    // Reshuffle discard into draw
    let discard = get_discard_pile_mut(piles, color);
    if discard.is_empty() {
        return None;
    }

    let mut reshuffled: Vec<EnemyTokenId> = discard.drain(..).collect();
    rng.shuffle(&mut reshuffled);

    let draw = get_draw_pile_mut(piles, color);
    *draw = reshuffled;

    if draw.is_empty() {
        None
    } else {
        Some(draw.remove(0))
    }
}

// =============================================================================
// Site/Rampaging mapping
// =============================================================================

/// Defender configuration: color and count of enemies placed at a site.
pub struct SiteDefenderConfig {
    pub color: EnemyColor,
    pub count: u32,
}

/// Get the pile color for a rampaging enemy type.
pub fn rampaging_enemy_color(rampaging_type: RampagingEnemyType) -> EnemyColor {
    match rampaging_type {
        RampagingEnemyType::OrcMarauder => EnemyColor::Green,
        RampagingEnemyType::Draconum => EnemyColor::Red,
    }
}

/// Site type → defender config at tile reveal time, or None for safe/deferred sites.
///
/// NOTE: Dungeon/Tomb/MonsterDen/SpawningGrounds enemies are drawn when the player
/// enters the site, not at tile reveal. AncientRuins use ruins tokens.
pub fn site_defender_config(site_type: SiteType) -> Option<SiteDefenderConfig> {
    match site_type {
        SiteType::Keep => Some(SiteDefenderConfig { color: EnemyColor::Gray, count: 1 }),
        SiteType::MageTower => Some(SiteDefenderConfig { color: EnemyColor::Violet, count: 1 }),
        SiteType::Maze | SiteType::Labyrinth => Some(SiteDefenderConfig { color: EnemyColor::Brown, count: 1 }),
        // Safe sites, deferred sites, cities
        _ => None,
    }
}

/// Whether site enemies are face-up (revealed) when placed.
pub fn is_site_enemy_revealed(site_type: SiteType) -> bool {
    match site_type {
        // Fortified sites — face DOWN
        SiteType::Keep | SiteType::MageTower | SiteType::City => false,
        // Everything else — face UP
        _ => true,
    }
}

/// Discard an enemy token to its color's discard pile.
pub fn discard_enemy_token(piles: &mut EnemyTokenPiles, token_id: &EnemyTokenId, color: EnemyColor) {
    get_discard_pile_mut(piles, color).push(token_id.clone());
}

// =============================================================================
// Internal helpers
// =============================================================================

fn get_draw_pile_mut(piles: &mut EnemyTokenPiles, color: EnemyColor) -> &mut Vec<EnemyTokenId> {
    match color {
        EnemyColor::Green => &mut piles.green_draw,
        EnemyColor::Gray => &mut piles.gray_draw,
        EnemyColor::Brown => &mut piles.brown_draw,
        EnemyColor::Violet => &mut piles.violet_draw,
        EnemyColor::White => &mut piles.white_draw,
        EnemyColor::Red => &mut piles.red_draw,
    }
}

fn get_discard_pile_mut(piles: &mut EnemyTokenPiles, color: EnemyColor) -> &mut Vec<EnemyTokenId> {
    match color {
        EnemyColor::Green => &mut piles.green_discard,
        EnemyColor::Gray => &mut piles.gray_discard,
        EnemyColor::Brown => &mut piles.brown_discard,
        EnemyColor::Violet => &mut piles.violet_discard,
        EnemyColor::White => &mut piles.white_discard,
        EnemyColor::Red => &mut piles.red_discard,
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_piles_has_correct_sizes() {
        let mut rng = RngState::new(42);
        let piles = create_enemy_token_piles(&mut rng);
        assert_eq!(piles.green_draw.len(), 20);
        assert_eq!(piles.gray_draw.len(), 7);
        assert_eq!(piles.brown_draw.len(), 16);
        assert_eq!(piles.violet_draw.len(), 8);
        assert_eq!(piles.white_draw.len(), 10);
        assert_eq!(piles.red_draw.len(), 11);
    }

    #[test]
    fn create_piles_discard_empty() {
        let mut rng = RngState::new(42);
        let piles = create_enemy_token_piles(&mut rng);
        assert!(piles.green_discard.is_empty());
        assert!(piles.gray_discard.is_empty());
        assert!(piles.brown_discard.is_empty());
        assert!(piles.violet_discard.is_empty());
        assert!(piles.white_discard.is_empty());
        assert!(piles.red_discard.is_empty());
    }

    #[test]
    fn enemy_id_from_token_simple() {
        let token = EnemyTokenId::from("prowlers_1");
        assert_eq!(enemy_id_from_token(&token), "prowlers");
    }

    #[test]
    fn enemy_id_from_token_underscored() {
        let token = EnemyTokenId::from("cursed_hags_3");
        assert_eq!(enemy_id_from_token(&token), "cursed_hags");
    }

    #[test]
    fn enemy_id_from_token_deep_underscored() {
        let token = EnemyTokenId::from("orc_war_beasts_7");
        assert_eq!(enemy_id_from_token(&token), "orc_war_beasts");
    }

    #[test]
    fn draw_enemy_token_basic() {
        let mut rng = RngState::new(42);
        let mut piles = create_enemy_token_piles(&mut rng);
        let token = draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng);
        assert!(token.is_some());
        assert_eq!(piles.green_draw.len(), 19);
    }

    #[test]
    fn draw_enemy_token_exhausts_pile() {
        let mut rng = RngState::new(42);
        let mut piles = create_enemy_token_piles(&mut rng);
        // Draw all green tokens
        for _ in 0..20 {
            let token = draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng);
            assert!(token.is_some());
        }
        // Next draw should return None (empty draw + empty discard)
        let token = draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng);
        assert!(token.is_none());
    }

    #[test]
    fn draw_enemy_token_reshuffles_discard() {
        let mut rng = RngState::new(42);
        let mut piles = create_enemy_token_piles(&mut rng);
        // Draw one token
        let token = draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng).unwrap();
        // Put it in discard
        piles.green_discard.push(token.clone());
        // Draw all remaining
        for _ in 0..19 {
            draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng).unwrap();
        }
        // Draw pile now empty, discard has 1 token
        assert!(piles.green_draw.is_empty());
        assert_eq!(piles.green_discard.len(), 1);
        // Next draw should reshuffle and return the discarded token
        let reshuffled = draw_enemy_token(&mut piles, EnemyColor::Green, &mut rng);
        assert!(reshuffled.is_some());
        assert_eq!(reshuffled.unwrap(), token);
    }

    #[test]
    fn rampaging_enemy_color_mapping() {
        assert_eq!(rampaging_enemy_color(RampagingEnemyType::OrcMarauder), EnemyColor::Green);
        assert_eq!(rampaging_enemy_color(RampagingEnemyType::Draconum), EnemyColor::Red);
    }

    #[test]
    fn site_defender_config_keep() {
        let config = site_defender_config(SiteType::Keep).unwrap();
        assert_eq!(config.color, EnemyColor::Gray);
        assert_eq!(config.count, 1);
    }

    #[test]
    fn site_defender_config_mage_tower() {
        let config = site_defender_config(SiteType::MageTower).unwrap();
        assert_eq!(config.color, EnemyColor::Violet);
        assert_eq!(config.count, 1);
    }

    #[test]
    fn site_defender_config_village_none() {
        assert!(site_defender_config(SiteType::Village).is_none());
    }

    #[test]
    fn site_defender_config_dungeon_none() {
        assert!(site_defender_config(SiteType::Dungeon).is_none());
    }

    #[test]
    fn site_enemy_revealed_keep() {
        assert!(!is_site_enemy_revealed(SiteType::Keep));
    }

    #[test]
    fn site_enemy_revealed_monster_den() {
        assert!(is_site_enemy_revealed(SiteType::MonsterDen));
    }
}
