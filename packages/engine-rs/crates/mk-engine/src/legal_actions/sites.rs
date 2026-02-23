//! Site interaction enumeration — EnterSite, InteractSite, BuySpell, LearnAA, BurnMonastery.

use mk_data::sites::{
    adventure_site_enemies, draws_fresh_enemies, healing_cost, is_adventure_site, is_inhabited,
    CITY_AA_PURCHASE_COST, CITY_ARTIFACT_PURCHASE_COST, CITY_ELITE_UNIT_COST,
    MONASTERY_AA_PURCHASE_COST, SPELL_PURCHASE_COST,
};
use mk_types::enums::{BasicManaColor, SiteType};
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

    // BuySpell — at conquered Mage Tower (requires 7 influence + matching mana)
    if site.site_type == SiteType::MageTower
        && site.is_conquered
        && !player
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN)
        && player.influence_points >= SPELL_PURCHASE_COST
    {
        for (idx, card_id) in state.offers.spells.iter().enumerate() {
            if let Some(spell_color) = mk_data::cards::get_spell_color(card_id.as_str()) {
                if player_has_mana_of_color(player, spell_color) {
                    actions.push(LegalAction::BuySpell {
                        card_id: card_id.clone(),
                        offer_index: idx,
                        mana_color: spell_color,
                    });
                }
            }
        }
    }

    // LearnAdvancedAction — at non-burned Monastery
    if site.site_type == SiteType::Monastery
        && !site.is_burned
        && player.influence_points >= MONASTERY_AA_PURCHASE_COST
    {
        for (idx, card_id) in state.offers.monastery_advanced_actions.iter().enumerate() {
            actions.push(LegalAction::LearnAdvancedAction {
                card_id: card_id.clone(),
                offer_index: idx,
            });
        }
    }

    // AncientRuins — altar tribute or enter site (enemy token)
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

    // City commerce — per-color interactions at conquered cities
    if site.site_type == SiteType::City
        && site.is_conquered
        && !player
            .flags
            .contains(PlayerFlags::HAS_COMBATTED_THIS_TURN)
    {
        // Shield token influence bonus: +1 per shield on this city, once per turn
        let shield_bonus = if !player
            .flags
            .contains(PlayerFlags::SHIELD_INFLUENCE_CLAIMED_THIS_TURN)
        {
            city_shield_influence(hex_state, &player.id)
        } else {
            0
        };
        let effective_influence = player.influence_points + shield_bonus;

        match site.city_color {
            Some(BasicManaColor::Blue) => {
                // Same as MageTower: BuySpell for each spell in offer
                // Requires 7 influence + matching mana
                if effective_influence >= SPELL_PURCHASE_COST {
                    for (idx, card_id) in state.offers.spells.iter().enumerate() {
                        // Check if spell has a color and player has matching mana
                        if let Some(spell_color) = mk_data::cards::get_spell_color(card_id.as_str()) {
                            if player_has_mana_of_color(player, spell_color) {
                                actions.push(LegalAction::BuySpell {
                                    card_id: card_id.clone(),
                                    offer_index: idx,
                                    mana_color: spell_color,
                                });
                            }
                        }
                    }
                }
            }
            Some(BasicManaColor::Green) => {
                // AA from main offer (replenished), cost 6
                if effective_influence >= CITY_AA_PURCHASE_COST {
                    for (idx, card_id) in state.offers.advanced_actions.iter().enumerate() {
                        actions.push(LegalAction::BuyCityAdvancedAction {
                            card_id: card_id.clone(),
                            offer_index: idx,
                        });
                    }
                }
                // Blind draw from AA deck, cost 6
                if effective_influence >= CITY_AA_PURCHASE_COST
                    && !state.decks.advanced_action_deck.is_empty()
                {
                    actions.push(LegalAction::BuyCityAdvancedActionFromDeck);
                }
            }
            Some(BasicManaColor::Red) => {
                // Artifact from deck (draw 2, keep 1), cost 12
                if effective_influence >= CITY_ARTIFACT_PURCHASE_COST
                    && !state.decks.artifact_deck.is_empty()
                {
                    actions.push(LegalAction::BuyArtifact);
                }
            }
            Some(BasicManaColor::White) => {
                // Elite unit add: pay 2 influence to add unit from deck to offer
                if effective_influence >= CITY_ELITE_UNIT_COST
                    && !state.decks.unit_deck.is_empty()
                {
                    actions.push(LegalAction::AddEliteToOffer);
                }
            }
            None => {}
        }
    }
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

/// Count shield tokens placed by this player on the given hex's city.
fn city_shield_influence(hex: &mk_types::state::HexState, player_id: &mk_types::ids::PlayerId) -> u32 {
    hex.shield_tokens.iter().filter(|id| *id == player_id).count() as u32
}

/// Check if a player has mana of a given basic color (token, gold token, or crystal).
fn player_has_mana_of_color(player: &mk_types::state::PlayerState, color: BasicManaColor) -> bool {
    let target = mk_types::enums::ManaColor::from(color);
    // Check matching-color token
    if player.pure_mana.iter().any(|t| t.color == target) {
        return true;
    }
    // Check gold token (wild)
    if player.pure_mana.iter().any(|t| t.color == mk_types::enums::ManaColor::Gold) {
        return true;
    }
    // Check matching-color crystal
    let crystal_count = match color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    crystal_count > 0
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
