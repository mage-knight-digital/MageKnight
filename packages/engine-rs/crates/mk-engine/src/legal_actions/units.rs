//! Unit recruitment and activation enumeration.
//!
//! Enumerates `RecruitUnit` actions at inhabited sites and
//! `ActivateUnit` actions for ready units.

use mk_data::levels::get_level_stats;
use mk_data::units::{get_unit, is_combat_ability, is_hero_unit, is_noncombat_ability, UnitAbility, UnitDefinition};
use mk_types::enums::{BasicManaColor, CombatPhase, ManaColor, RecruitSite, SiteType, UnitState};
use mk_types::ids::UnitId;
use mk_types::legal_action::LegalAction;
use mk_types::state::{GameState, PlayerFlags, PlayerState};

/// Reputation cost modifier table.
/// Matches TS `getReputationCostModifier` in `rules/unitRecruitment.ts`.
fn reputation_cost_modifier(reputation: i8) -> i32 {
    let rep = reputation.clamp(-7, 7);
    if rep == 0 {
        return 0;
    }
    if rep == -7 {
        return 5;
    }
    if rep == 7 {
        return -5;
    }
    let abs_rep = rep.unsigned_abs();
    let modifier = if abs_rep <= 2 {
        1
    } else if abs_rep <= 4 {
        2
    } else {
        3
    };
    if rep < 0 { modifier } else { -modifier }
}

/// Map a SiteType to a RecruitSite. Returns None if recruitment not possible.
fn site_type_to_recruit_site(site_type: SiteType) -> Option<RecruitSite> {
    match site_type {
        SiteType::Village => Some(RecruitSite::Village),
        SiteType::Keep => Some(RecruitSite::Keep),
        SiteType::MageTower => Some(RecruitSite::MageTower),
        SiteType::Monastery => Some(RecruitSite::Monastery),
        SiteType::City => Some(RecruitSite::City),
        SiteType::RefugeeCamp => Some(RecruitSite::Camp),
        SiteType::MagicalGlade => Some(RecruitSite::MagicalGlade),
        _ => None,
    }
}

/// Tiered cost modifier for Refugee Camp recruitment.
/// Village units: +0, Keep/MageTower/Monastery: +1, City-only: +3.
fn refugee_camp_cost_modifier(unit: &UnitDefinition) -> i32 {
    if unit.recruit_sites.contains(&RecruitSite::Village) {
        return 0;
    }
    if unit.recruit_sites.contains(&RecruitSite::Keep)
        || unit.recruit_sites.contains(&RecruitSite::MageTower)
        || unit.recruit_sites.contains(&RecruitSite::Monastery)
    {
        return 1;
    }
    if unit.recruit_sites.contains(&RecruitSite::City) {
        return 3;
    }
    0
}

/// Check if a unit can be recruited at the given site.
fn unit_available_at_site(
    unit: &UnitDefinition,
    recruit_site: RecruitSite,
) -> bool {
    match recruit_site {
        RecruitSite::Camp => {
            // Refugee Camp: any unit can be recruited (tiered cost applied separately)
            true
        }
        RecruitSite::MagicalGlade => {
            // Magical Glade: only units with MagicalGlade in recruit_sites
            unit.recruit_sites.contains(&RecruitSite::MagicalGlade)
        }
        _ => {
            // Normal: unit's recruit_sites must include this site
            unit.recruit_sites.contains(&recruit_site)
        }
    }
}

/// Check whether Heroes/Thugs exclusion blocks this recruitment.
fn violates_hero_thug_exclusion(
    unit_id: &str,
    units_recruited: &[UnitId],
) -> bool {
    if is_hero_unit(unit_id) {
        return units_recruited.iter().any(|id| id.as_str() == "thugs");
    }
    if unit_id == "thugs" {
        return units_recruited.iter().any(|id| is_hero_unit(id.as_str()));
    }
    false
}

pub(super) fn enumerate_unit_actions(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];

    // Guard: not in combat, not resting
    if state.combat.is_some() {
        return;
    }
    if player.flags.contains(PlayerFlags::IS_RESTING) {
        return;
    }

    // Guard: must not have taken an action UNLESS already recruited this turn
    if player.flags.contains(PlayerFlags::HAS_TAKEN_ACTION_THIS_TURN)
        && !player.flags.contains(PlayerFlags::HAS_RECRUITED_UNIT_THIS_TURN)
    {
        return;
    }

    // Guard: player must be on a hex with a recruitment site
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

    // Map site type to recruit site
    let recruit_site = match site_type_to_recruit_site(site.site_type) {
        Some(rs) => rs,
        None => return,
    };

    // Access check
    let accessible = match site.site_type {
        SiteType::Village | SiteType::RefugeeCamp | SiteType::MagicalGlade => true,
        SiteType::Keep | SiteType::MageTower => {
            site.is_conquered
                && site
                    .owner
                    .as_ref()
                    .is_some_and(|o| *o == player.id)
        }
        SiteType::City => site.is_conquered,
        SiteType::Monastery => !site.is_burned,
        _ => false,
    };

    if !accessible || site.is_burned {
        return;
    }

    // Command limit check (bonds_of_loyalty adds +1 slot)
    let mut command_slots = get_level_stats(player.level).command_slots as usize;
    if player.skills.iter().any(|s| s.as_str() == "norowas_bonds_of_loyalty") {
        command_slots += 1;
    }
    if player.units.len() >= command_slots {
        return;
    }

    // Whether a hero has been recruited this interaction (for doubled rep modifier)
    let has_recruited_hero = player
        .units_recruited_this_interaction
        .iter()
        .any(|id| is_hero_unit(id.as_str()));

    let is_glade = site.site_type == SiteType::MagicalGlade;

    // Enumerate per unit in offer
    for (offer_idx, unit_id) in state.offers.units.iter().enumerate() {
        let unit = match get_unit(unit_id.as_str()) {
            Some(u) => u,
            None => continue,
        };

        // Check unit is available at this site
        if !unit_available_at_site(unit, recruit_site) {
            continue;
        }

        // Heroes/Thugs exclusion
        if violates_hero_thug_exclusion(
            unit_id.as_str(),
            &player.units_recruited_this_interaction,
        ) {
            continue;
        }

        // Compute influence cost
        let base_cost = unit.influence_cost as i32;

        // Reputation modifier (ignored at Magical Glade)
        let rep_mod = if is_glade {
            0
        } else {
            let mut m = reputation_cost_modifier(player.reputation);
            // Thugs: reversed
            if unit.reversed_reputation && m != 0 {
                m = -m;
            }
            // Heroes: doubled (once per interaction)
            if is_hero_unit(unit_id.as_str()) && !has_recruited_hero {
                m *= 2;
            }
            m
        };

        // Refugee camp tiered cost
        let camp_mod = if recruit_site == RecruitSite::Camp {
            refugee_camp_cost_modifier(unit)
        } else {
            0
        };

        let mut total_cost = (base_cost + rep_mod + camp_mod).max(0) as u32;

        // Bonds of Loyalty: -5 influence when the bonds slot is empty
        if player.skills.iter().any(|s| s.as_str() == "norowas_bonds_of_loyalty")
            && player.bonds_of_loyalty_unit_instance_id.is_none()
        {
            total_cost = total_cost.saturating_sub(5);
        }

        // Check player can afford
        if player.influence_points < total_cost {
            continue;
        }

        actions.push(LegalAction::RecruitUnit {
            unit_id: unit_id.clone(),
            offer_index: offer_idx,
            influence_cost: total_cost,
        });
    }
}

// =============================================================================
// Unit activation enumeration
// =============================================================================

/// Check if the player can afford a mana cost for a unit ability.
fn can_afford_mana(player: &PlayerState, color: BasicManaColor) -> bool {
    let target = ManaColor::from(color);

    // 1. Matching-color mana token.
    if player.pure_mana.iter().any(|t| t.color == target) {
        return true;
    }

    // 2. Gold mana token (wild).
    if player.pure_mana.iter().any(|t| t.color == ManaColor::Gold) {
        return true;
    }

    // 3. Matching-color crystal.
    let crystal_count = match color {
        BasicManaColor::Red => player.crystals.red,
        BasicManaColor::Blue => player.crystals.blue,
        BasicManaColor::Green => player.crystals.green,
        BasicManaColor::White => player.crystals.white,
    };
    crystal_count > 0
}

/// Check if a combat ability is allowed in the current combat phase.
///
/// At fortified sites, ranged attacks are blocked during RangedSiege — only
/// siege attacks work against fortifications. Ranged is still allowed in Attack phase.
fn phase_allows_ability(ability: &UnitAbility, phase: CombatPhase, is_fortified: bool) -> bool {
    match ability {
        UnitAbility::Attack { .. } | UnitAbility::AttackWithRepCost { .. } => {
            phase == CombatPhase::Attack
        }
        UnitAbility::Block { .. } => phase == CombatPhase::Block,
        UnitAbility::RangedAttack { .. } => {
            if is_fortified && phase == CombatPhase::RangedSiege {
                return false;
            }
            phase == CombatPhase::RangedSiege || phase == CombatPhase::Attack
        }
        UnitAbility::SiegeAttack { .. } => {
            phase == CombatPhase::RangedSiege || phase == CombatPhase::Attack
        }
        UnitAbility::AttackOrBlockWoundSelf { .. } => {
            // Can be used in Attack or Block phase (player chooses at execution)
            phase == CombatPhase::Attack || phase == CombatPhase::Block
        }
        UnitAbility::SelectCombatEnemy(_) => {
            // Can target enemies in any combat phase
            true
        }
        UnitAbility::CoordinatedFire { .. } => {
            // Grants ranged attack — only in RangedSiege phase
            phase == CombatPhase::RangedSiege
        }
        _ => false, // Non-combat abilities never allowed in combat
    }
}

/// Enumerate `ActivateUnit` actions for all ready, unwounded units.
///
/// Works for both combat (attack/block/ranged/siege abilities) and normal
/// turn (move/influence/heal abilities). Checks mana affordability and
/// phase gating.
pub(super) fn enumerate_unit_activations(
    state: &GameState,
    player_idx: usize,
    actions: &mut Vec<LegalAction>,
) {
    let player = &state.players[player_idx];
    let in_combat = state.combat.is_some();

    // In combat: check units_allowed
    if in_combat {
        if let Some(ref combat) = state.combat {
            if !combat.units_allowed {
                return;
            }
        }
    }

    let combat_phase = state.combat.as_ref().map(|c| c.phase);
    let is_fortified = state.combat.as_ref().map_or(false, |c| c.is_at_fortified_site);

    for unit in &player.units {
        // Skip spent or wounded units
        if unit.state != UnitState::Ready || unit.wounded {
            continue;
        }

        let unit_def = match get_unit(unit.unit_id.as_str()) {
            Some(d) => d,
            None => continue,
        };

        for (idx, slot) in unit_def.abilities.iter().enumerate() {
            // Skip Other (complex) abilities
            if matches!(slot.ability, UnitAbility::Other { .. }) {
                continue;
            }

            if in_combat {
                // Only combat abilities allowed in combat
                if !is_combat_ability(&slot.ability) {
                    continue;
                }
                // Phase gating (includes fortification check for ranged)
                if let Some(phase) = combat_phase {
                    if !phase_allows_ability(&slot.ability, phase, is_fortified) {
                        continue;
                    }
                }
            } else {
                // Only non-combat abilities allowed outside combat
                if !is_noncombat_ability(&slot.ability) {
                    continue;
                }

                // Heal: skip if no wounds in hand
                if matches!(slot.ability, UnitAbility::Heal { .. }) {
                    let has_wounds = player.hand.iter().any(|c| c.as_str() == "wound");
                    if !has_wounds {
                        continue;
                    }
                }

                // ReadyUnit: skip if no spent units at or below max_level
                if let UnitAbility::ReadyUnit { max_level } = slot.ability {
                    let has_eligible = player.units.iter().any(|u| {
                        u.state == UnitState::Spent && u.level <= max_level
                    });
                    if !has_eligible {
                        continue;
                    }
                }
            }

            // Mana cost check
            if let Some(color) = slot.mana_cost {
                if !can_afford_mana(player, color) {
                    continue;
                }
            }

            actions.push(LegalAction::ActivateUnit {
                unit_instance_id: unit.instance_id.clone(),
                ability_index: idx,
            });
        }
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- reputation_cost_modifier ---

    #[test]
    fn rep_mod_zero() {
        assert_eq!(reputation_cost_modifier(0), 0);
    }

    #[test]
    fn rep_mod_negative() {
        assert_eq!(reputation_cost_modifier(-1), 1);
        assert_eq!(reputation_cost_modifier(-2), 1);
        assert_eq!(reputation_cost_modifier(-3), 2);
        assert_eq!(reputation_cost_modifier(-4), 2);
        assert_eq!(reputation_cost_modifier(-5), 3);
        assert_eq!(reputation_cost_modifier(-6), 3);
        assert_eq!(reputation_cost_modifier(-7), 5);
    }

    #[test]
    fn rep_mod_positive() {
        assert_eq!(reputation_cost_modifier(1), -1);
        assert_eq!(reputation_cost_modifier(2), -1);
        assert_eq!(reputation_cost_modifier(3), -2);
        assert_eq!(reputation_cost_modifier(4), -2);
        assert_eq!(reputation_cost_modifier(5), -3);
        assert_eq!(reputation_cost_modifier(6), -3);
        assert_eq!(reputation_cost_modifier(7), -5);
    }

    // --- refugee_camp_cost_modifier ---

    #[test]
    fn camp_mod_village_unit() {
        let u = get_unit("peasants").unwrap();
        assert_eq!(refugee_camp_cost_modifier(u), 0);
    }

    #[test]
    fn camp_mod_keep_unit() {
        let u = get_unit("utem_swordsmen").unwrap();
        assert_eq!(refugee_camp_cost_modifier(u), 1);
    }

    #[test]
    fn camp_mod_city_unit() {
        let u = get_unit("altem_mages").unwrap();
        assert_eq!(refugee_camp_cost_modifier(u), 3);
    }

    // --- hero/thug exclusion ---

    #[test]
    fn hero_blocked_by_thugs() {
        let recruited = vec![UnitId::from("thugs")];
        assert!(violates_hero_thug_exclusion("hero_blue", &recruited));
    }

    #[test]
    fn thugs_blocked_by_hero() {
        let recruited = vec![UnitId::from("hero_red")];
        assert!(violates_hero_thug_exclusion("thugs", &recruited));
    }

    #[test]
    fn no_exclusion_normal() {
        let recruited = vec![UnitId::from("peasants")];
        assert!(!violates_hero_thug_exclusion("foresters", &recruited));
    }

    // --- can_afford_mana ---

    fn test_player() -> PlayerState {
        let state = crate::setup::create_solo_game(42, mk_types::enums::Hero::Tovak);
        state.players[0].clone()
    }

    #[test]
    fn afford_mana_matching_token() {
        let mut player = test_player();
        player.pure_mana.clear();
        player.pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Red,
            source: mk_types::state::ManaTokenSource::Die,
            cannot_power_spells: false,
        });
        assert!(can_afford_mana(&player, BasicManaColor::Red));
        assert!(!can_afford_mana(&player, BasicManaColor::Blue));
    }

    #[test]
    fn afford_mana_gold_token() {
        let mut player = test_player();
        player.pure_mana.clear();
        player.pure_mana.push(mk_types::state::ManaToken {
            color: ManaColor::Gold,
            source: mk_types::state::ManaTokenSource::Die,
            cannot_power_spells: false,
        });
        assert!(can_afford_mana(&player, BasicManaColor::Red));
        assert!(can_afford_mana(&player, BasicManaColor::Blue));
    }

    #[test]
    fn afford_mana_crystal() {
        let mut player = test_player();
        player.pure_mana.clear();
        player.crystals.blue = 1;
        assert!(can_afford_mana(&player, BasicManaColor::Blue));
        assert!(!can_afford_mana(&player, BasicManaColor::Red));
    }

    // --- phase_allows_ability ---

    #[test]
    fn phase_attack_only_in_attack() {
        let atk = UnitAbility::Attack { value: 3, element: mk_types::enums::Element::Physical };
        assert!(phase_allows_ability(&atk, CombatPhase::Attack, false));
        assert!(!phase_allows_ability(&atk, CombatPhase::Block, false));
        assert!(!phase_allows_ability(&atk, CombatPhase::RangedSiege, false));
    }

    #[test]
    fn phase_block_only_in_block() {
        let blk = UnitAbility::Block { value: 3, element: mk_types::enums::Element::Physical };
        assert!(phase_allows_ability(&blk, CombatPhase::Block, false));
        assert!(!phase_allows_ability(&blk, CombatPhase::Attack, false));
        assert!(!phase_allows_ability(&blk, CombatPhase::RangedSiege, false));
    }

    #[test]
    fn phase_ranged_in_rangedsiege_and_attack() {
        let rng = UnitAbility::RangedAttack { value: 2, element: mk_types::enums::Element::Fire };
        assert!(phase_allows_ability(&rng, CombatPhase::RangedSiege, false));
        assert!(phase_allows_ability(&rng, CombatPhase::Attack, false));
        assert!(!phase_allows_ability(&rng, CombatPhase::Block, false));
    }

    #[test]
    fn phase_siege_in_rangedsiege_and_attack() {
        let siege = UnitAbility::SiegeAttack { value: 4, element: mk_types::enums::Element::Physical };
        assert!(phase_allows_ability(&siege, CombatPhase::RangedSiege, false));
        assert!(phase_allows_ability(&siege, CombatPhase::Attack, false));
        assert!(!phase_allows_ability(&siege, CombatPhase::Block, false));
    }

    // --- fortification restriction ---

    #[test]
    fn ranged_blocked_at_fortified_in_rangedsiege() {
        let rng = UnitAbility::RangedAttack { value: 2, element: mk_types::enums::Element::Fire };
        assert!(!phase_allows_ability(&rng, CombatPhase::RangedSiege, true),
            "ranged blocked at fortified site in RangedSiege");
        // Still allowed in Attack phase even at fortified
        assert!(phase_allows_ability(&rng, CombatPhase::Attack, true));
    }

    #[test]
    fn siege_allowed_at_fortified_in_rangedsiege() {
        let siege = UnitAbility::SiegeAttack { value: 4, element: mk_types::enums::Element::Physical };
        assert!(phase_allows_ability(&siege, CombatPhase::RangedSiege, true),
            "siege should work at fortified site");
        assert!(phase_allows_ability(&siege, CombatPhase::Attack, true));
    }
}
