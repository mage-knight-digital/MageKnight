//! Scoring calculations — achievements, base scores, and final results.
//!
//! Matches the TypeScript scoring system in:
//! - `core/src/engine/scoring/achievementCalculators.ts`
//! - `core/src/engine/scoring/standardAchievements.ts`
//! - `core/src/engine/scoring/baseScore.ts`

use mk_types::enums::{DeedCardType, SiteType};
use mk_types::scoring::*;
use mk_types::state::{GameState, PlayerState};

// =============================================================================
// Wound card ID constant
// =============================================================================

const WOUND_CARD_ID: &str = "wound";

// =============================================================================
// Achievement calculators
// =============================================================================

/// Calculate base points for a single achievement category for one player.
pub fn calculate_category_base_points(
    category: AchievementCategory,
    player: &PlayerState,
    state: &GameState,
) -> i32 {
    match category {
        AchievementCategory::GreatestKnowledge => calculate_greatest_knowledge(player),
        AchievementCategory::GreatestLoot => calculate_greatest_loot(player),
        AchievementCategory::GreatestLeader => calculate_greatest_leader(player),
        AchievementCategory::GreatestConqueror => calculate_greatest_conqueror(player, state),
        AchievementCategory::GreatestAdventurer => calculate_greatest_adventurer(player, state),
        AchievementCategory::GreatestBeating => calculate_greatest_beating(player),
    }
}

/// Greatest Knowledge: +2 per Spell, +1 per Advanced Action.
fn calculate_greatest_knowledge(player: &PlayerState) -> i32 {
    let all_cards = all_player_cards(player);
    let mut spells = 0i32;
    let mut advanced_actions = 0i32;

    for card_id in &all_cards {
        if let Some(card_def) = mk_data::cards::get_card(card_id.as_str()) {
            match card_def.card_type {
                DeedCardType::Spell => spells += 1,
                DeedCardType::AdvancedAction => advanced_actions += 1,
                _ => {}
            }
        }
    }

    spells * POINTS_PER_SPELL + advanced_actions * POINTS_PER_ADVANCED_ACTION
}

/// Greatest Loot: +2 per Artifact, +1 per 2 crystals.
fn calculate_greatest_loot(player: &PlayerState) -> i32 {
    let all_cards = all_player_cards(player);
    let mut artifacts = 0i32;

    for card_id in &all_cards {
        if let Some(card_def) = mk_data::cards::get_card(card_id.as_str()) {
            if card_def.card_type == DeedCardType::Artifact {
                artifacts += 1;
            }
        }
    }

    let total_crystals =
        player.crystals.red as u32
        + player.crystals.blue as u32
        + player.crystals.green as u32
        + player.crystals.white as u32;
    let crystal_points = (total_crystals / CRYSTALS_PER_POINT) as i32;

    artifacts * POINTS_PER_ARTIFACT + crystal_points
}

/// Greatest Leader: +1 per unit level (wounded = half, floor).
fn calculate_greatest_leader(player: &PlayerState) -> i32 {
    let mut total = 0i32;
    for unit in &player.units {
        let level = unit.level as i32;
        if unit.wounded {
            total += level / 2;
        } else {
            total += level;
        }
    }
    total
}

/// Greatest Conqueror: +2 per shield on keep/mage tower/monastery.
fn calculate_greatest_conqueror(player: &PlayerState, state: &GameState) -> i32 {
    let mut count = 0i32;
    for hex in state.map.hexes.values() {
        if let Some(ref site) = hex.site {
            if is_fortified_site(site.site_type) {
                count += hex
                    .shield_tokens
                    .iter()
                    .filter(|id| **id == player.id)
                    .count() as i32;
            }
        }
    }
    count * POINTS_PER_FORTIFIED_SHIELD
}

/// Greatest Adventurer: +2 per shield on adventure site.
fn calculate_greatest_adventurer(player: &PlayerState, state: &GameState) -> i32 {
    let mut count = 0i32;
    for hex in state.map.hexes.values() {
        if let Some(ref site) = hex.site {
            if is_adventure_site(site.site_type) {
                count += hex
                    .shield_tokens
                    .iter()
                    .filter(|id| **id == player.id)
                    .count() as i32;
            }
        }
    }
    count * POINTS_PER_ADVENTURE_SHIELD
}

/// Greatest Beating: -2 per wound in deck (penalty).
fn calculate_greatest_beating(player: &PlayerState) -> i32 {
    let all_cards = all_player_cards(player);
    let wound_count = all_cards
        .iter()
        .filter(|c| c.as_str() == WOUND_CARD_ID)
        .count() as i32;
    wound_count * POINTS_PER_WOUND
}

// =============================================================================
// Site type helpers
// =============================================================================

fn is_fortified_site(site_type: SiteType) -> bool {
    matches!(
        site_type,
        SiteType::Keep | SiteType::MageTower | SiteType::Monastery
    )
}

fn is_adventure_site(site_type: SiteType) -> bool {
    matches!(
        site_type,
        SiteType::AncientRuins
            | SiteType::Dungeon
            | SiteType::Tomb
            | SiteType::MonsterDen
            | SiteType::SpawningGrounds
            | SiteType::Maze
            | SiteType::Labyrinth
    )
}

// =============================================================================
// Card collection helper
// =============================================================================

/// Collect all cards a player owns (hand + deck + discard + play area).
fn all_player_cards(player: &PlayerState) -> Vec<&mk_types::ids::CardId> {
    let mut cards = Vec::with_capacity(
        player.hand.len() + player.deck.len() + player.discard.len() + player.play_area.len(),
    );
    cards.extend(player.hand.iter());
    cards.extend(player.deck.iter());
    cards.extend(player.discard.iter());
    cards.extend(player.play_area.iter());
    cards
}

// =============================================================================
// Title configuration
// =============================================================================

struct CategoryTitleConfig {
    winner_bonus: i32,
    tied_bonus: i32,
    zero_tie_exception: bool,
    is_negative: bool,
}

fn get_title_config(category: AchievementCategory) -> CategoryTitleConfig {
    match category {
        AchievementCategory::GreatestKnowledge => CategoryTitleConfig {
            winner_bonus: TITLE_BONUS_WINNER,
            tied_bonus: TITLE_BONUS_TIED,
            zero_tie_exception: true,
            is_negative: false,
        },
        AchievementCategory::GreatestLoot => CategoryTitleConfig {
            winner_bonus: TITLE_BONUS_WINNER,
            tied_bonus: TITLE_BONUS_TIED,
            zero_tie_exception: false,
            is_negative: false,
        },
        AchievementCategory::GreatestLeader => CategoryTitleConfig {
            winner_bonus: TITLE_BONUS_WINNER,
            tied_bonus: TITLE_BONUS_TIED,
            zero_tie_exception: false,
            is_negative: false,
        },
        AchievementCategory::GreatestConqueror => CategoryTitleConfig {
            winner_bonus: TITLE_BONUS_WINNER,
            tied_bonus: TITLE_BONUS_TIED,
            zero_tie_exception: false,
            is_negative: false,
        },
        AchievementCategory::GreatestAdventurer => CategoryTitleConfig {
            winner_bonus: TITLE_BONUS_WINNER,
            tied_bonus: TITLE_BONUS_TIED,
            zero_tie_exception: false,
            is_negative: false,
        },
        AchievementCategory::GreatestBeating => CategoryTitleConfig {
            winner_bonus: TITLE_PENALTY_MOST_WOUNDS,
            tied_bonus: TITLE_PENALTY_MOST_WOUNDS_TIED,
            zero_tie_exception: true,
            is_negative: true,
        },
    }
}

// =============================================================================
// Base score calculation
// =============================================================================

/// Calculate base scores for all players based on the scoring mode.
fn calculate_base_scores(players: &[PlayerState], mode: BaseScoreMode) -> Vec<i32> {
    match mode {
        BaseScoreMode::IndividualFame => players.iter().map(|p| p.fame as i32).collect(),
        BaseScoreMode::LowestFame => {
            let lowest = players.iter().map(|p| p.fame).min().unwrap_or(0) as i32;
            vec![lowest; players.len()]
        }
        BaseScoreMode::VictoryPoints | BaseScoreMode::None => vec![0; players.len()],
    }
}

// =============================================================================
// Achievement scoring
// =============================================================================

/// Calculate full achievement results for all players.
fn calculate_achievements(
    state: &GameState,
    config: &AchievementsConfig,
) -> Vec<AchievementScoreResult> {
    let players = &state.players;
    let mut results: Vec<AchievementScoreResult> = players
        .iter()
        .map(|_| AchievementScoreResult {
            category_scores: Vec::new(),
            total_achievement_points: 0,
        })
        .collect();

    for &category in &ALL_ACHIEVEMENT_CATEGORIES {
        // Calculate base points for each player
        let base_points: Vec<i32> = players
            .iter()
            .map(|p| calculate_category_base_points(category, p, state))
            .collect();

        // Determine title bonuses based on mode
        let title_bonuses = match config.mode {
            AchievementMode::Competitive => {
                determine_title_bonuses(category, &base_points, config)
            }
            AchievementMode::Solo | AchievementMode::CoopBestOnly => {
                // No titles in solo/coop mode
                vec![(0, false, false); players.len()]
            }
        };

        // Build category scores for each player
        for (i, (base, (bonus, has_title, is_tied))) in
            base_points.iter().zip(title_bonuses.iter()).enumerate()
        {
            let total = base + bonus;
            results[i].category_scores.push(AchievementCategoryScore {
                category,
                base_points: *base,
                title_bonus: *bonus,
                total_points: total,
                has_title: *has_title,
                is_tied: *is_tied,
            });
            results[i].total_achievement_points += total;
        }
    }

    results
}

/// Determine title bonuses for a category in competitive mode.
/// Returns (bonus, has_title, is_tied) for each player.
fn determine_title_bonuses(
    category: AchievementCategory,
    base_points: &[i32],
    config: &AchievementsConfig,
) -> Vec<(i32, bool, bool)> {
    let title_config = get_title_config(category);

    // Apply overrides if present
    let (winner_bonus, tied_bonus) = if let Some(ovr) = config.overrides.get(&category) {
        (
            ovr.title_bonus.unwrap_or(title_config.winner_bonus),
            ovr.title_tied_bonus.unwrap_or(title_config.tied_bonus),
        )
    } else {
        (title_config.winner_bonus, title_config.tied_bonus)
    };

    // Find best score
    let best_score = if title_config.is_negative {
        // For negative categories (beating), the "winner" has the most negative score
        base_points.iter().copied().min().unwrap_or(0)
    } else {
        base_points.iter().copied().max().unwrap_or(0)
    };

    // Find winners
    let winner_count = base_points.iter().filter(|&&s| s == best_score).count();
    let is_tied = winner_count > 1;

    // Check zero-tie exception
    if title_config.zero_tie_exception && is_tied && best_score == 0 {
        return vec![(0, false, false); base_points.len()];
    }

    // Build results
    let bonus = if is_tied { tied_bonus } else { winner_bonus };
    base_points
        .iter()
        .map(|&score| {
            if score == best_score {
                (bonus, true, is_tied)
            } else {
                (0, false, false)
            }
        })
        .collect()
}

// =============================================================================
// Final score calculation
// =============================================================================

/// Calculate complete final scores for the game.
pub fn calculate_final_scores(state: &GameState) -> FinalScoreResult {
    let scoring_config = state
        .scenario_config
        .scoring_config
        .clone()
        .unwrap_or_else(default_scoring_config);

    let players = &state.players;

    // Step 1: Base scores
    let base_scores = calculate_base_scores(players, scoring_config.base_score_mode);

    // Step 2: Achievement scores
    let achievement_results = if scoring_config.achievements.enabled {
        Some(calculate_achievements(state, &scoring_config.achievements))
    } else {
        None
    };

    // Step 3: Build player results
    let mut player_results: Vec<PlayerScoreResult> = Vec::with_capacity(players.len());
    for (i, player) in players.iter().enumerate() {
        let base_score = base_scores[i];
        let achievements = achievement_results.as_ref().map(|r| r[i].clone());
        let achievement_points = achievements
            .as_ref()
            .map(|a| a.total_achievement_points)
            .unwrap_or(0);

        // Module scoring not yet implemented — placeholder
        let module_results = Vec::new();
        let module_points: i32 = 0;

        let total_score = base_score + achievement_points + module_points;

        player_results.push(PlayerScoreResult {
            player_id: player.id.as_str().to_string(),
            base_score,
            achievements,
            module_results,
            total_score,
        });
    }

    // Step 4: Rankings (highest score first)
    let mut ranked: Vec<(usize, i32)> = player_results
        .iter()
        .enumerate()
        .map(|(i, r)| (i, r.total_score))
        .collect();
    ranked.sort_by(|a, b| b.1.cmp(&a.1));
    let rankings: Vec<String> = ranked
        .iter()
        .map(|(i, _)| players[*i].id.as_str().to_string())
        .collect();

    // Step 5: Check for tie
    let is_tied = player_results.len() > 1
        && player_results
            .iter()
            .filter(|r| r.total_score == player_results.iter().map(|r| r.total_score).max().unwrap_or(0))
            .count()
            > 1;

    FinalScoreResult {
        config: scoring_config,
        player_results,
        rankings,
        is_tied,
    }
}

/// Default scoring config when scenario doesn't specify one (fame-only).
fn default_scoring_config() -> ScenarioScoringConfig {
    ScenarioScoringConfig {
        base_score_mode: BaseScoreMode::IndividualFame,
        achievements: AchievementsConfig {
            enabled: false,
            mode: AchievementMode::Solo,
            overrides: std::collections::BTreeMap::new(),
        },
        modules: vec![],
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::create_solo_game;
    use mk_types::enums::Hero;

    #[test]
    fn base_score_individual_fame() {
        let state = create_solo_game(42, Hero::Arythea);
        let scores = calculate_base_scores(&state.players, BaseScoreMode::IndividualFame);
        assert_eq!(scores.len(), 1);
        assert_eq!(scores[0], state.players[0].fame as i32);
    }

    #[test]
    fn greatest_knowledge_empty_deck() {
        let state = create_solo_game(42, Hero::Arythea);
        // Starting deck has basic actions only, no spells or advanced actions
        let pts = calculate_greatest_knowledge(&state.players[0]);
        assert_eq!(pts, 0);
    }

    #[test]
    fn greatest_beating_no_wounds() {
        let state = create_solo_game(42, Hero::Arythea);
        let pts = calculate_greatest_beating(&state.players[0]);
        assert_eq!(pts, 0);
    }

    #[test]
    fn greatest_leader_no_units() {
        let state = create_solo_game(42, Hero::Arythea);
        let pts = calculate_greatest_leader(&state.players[0]);
        assert_eq!(pts, 0);
    }

    #[test]
    fn calculate_final_scores_solo() {
        let state = create_solo_game(42, Hero::Arythea);
        let result = calculate_final_scores(&state);
        assert_eq!(result.player_results.len(), 1);
        assert_eq!(result.rankings.len(), 1);

        // Solo with achievements enabled — should have 6 category scores
        let pr = &result.player_results[0];
        if let Some(ref achievements) = pr.achievements {
            assert_eq!(achievements.category_scores.len(), 6);
        }
    }

    #[test]
    fn title_bonus_competitive_clear_winner() {
        let base_points = vec![5, 3, 1];
        let config = AchievementsConfig {
            enabled: true,
            mode: AchievementMode::Competitive,
            overrides: std::collections::BTreeMap::new(),
        };
        let bonuses =
            determine_title_bonuses(AchievementCategory::GreatestKnowledge, &base_points, &config);
        // Player 0 wins with 5 points
        assert_eq!(bonuses[0], (TITLE_BONUS_WINNER, true, false));
        assert_eq!(bonuses[1], (0, false, false));
        assert_eq!(bonuses[2], (0, false, false));
    }

    #[test]
    fn title_bonus_competitive_tied() {
        let base_points = vec![5, 5, 1];
        let config = AchievementsConfig {
            enabled: true,
            mode: AchievementMode::Competitive,
            overrides: std::collections::BTreeMap::new(),
        };
        let bonuses =
            determine_title_bonuses(AchievementCategory::GreatestLoot, &base_points, &config);
        // Players 0 and 1 tied
        assert_eq!(bonuses[0], (TITLE_BONUS_TIED, true, true));
        assert_eq!(bonuses[1], (TITLE_BONUS_TIED, true, true));
        assert_eq!(bonuses[2], (0, false, false));
    }

    #[test]
    fn title_bonus_zero_tie_exception() {
        let base_points = vec![0, 0];
        let config = AchievementsConfig {
            enabled: true,
            mode: AchievementMode::Competitive,
            overrides: std::collections::BTreeMap::new(),
        };
        // Greatest Knowledge has zero_tie_exception = true
        let bonuses =
            determine_title_bonuses(AchievementCategory::GreatestKnowledge, &base_points, &config);
        assert_eq!(bonuses[0], (0, false, false));
        assert_eq!(bonuses[1], (0, false, false));
    }

    #[test]
    fn greatest_beating_penalty_competitive() {
        let base_points = vec![-4, -2, 0];
        let config = AchievementsConfig {
            enabled: true,
            mode: AchievementMode::Competitive,
            overrides: std::collections::BTreeMap::new(),
        };
        let bonuses =
            determine_title_bonuses(AchievementCategory::GreatestBeating, &base_points, &config);
        // Player 0 has most wounds (most negative), gets the penalty
        assert_eq!(bonuses[0], (TITLE_PENALTY_MOST_WOUNDS, true, false));
        assert_eq!(bonuses[1], (0, false, false));
        assert_eq!(bonuses[2], (0, false, false));
    }
}
