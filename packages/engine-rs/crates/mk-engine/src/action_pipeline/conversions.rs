//! Move/influence conversions, hero assault, thug damage, unit maintenance,
//! and terrain cost reduction handlers.

use mk_types::enums::*;
use mk_types::ids::{CardId, ModifierId};
use mk_types::state::*;

use super::{ApplyError, ApplyResult};

pub(super) fn apply_convert_move_to_attack(
    state: &mut GameState,
    player_idx: usize,
    move_points: u32,
    attack_type: mk_types::modifier::CombatValueType,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.move_points < move_points {
        return Err(ApplyError::InternalError(format!(
            "ConvertMoveToAttack: need {} move points, have {}",
            move_points, player.move_points
        )));
    }

    // Deduct move points
    player.move_points -= move_points;

    // Convert: 1 attack point per cost_per_point move points consumed
    // The LegalAction already carries the total move_points to spend.
    // We need to find the conversion ratio from the modifier.
    let player_id = player.id.clone();
    let cost_per_point = state
        .active_modifiers
        .iter()
        .find_map(|m| {
            if m.created_by_player_id != player_id {
                return None;
            }
            if let mk_types::modifier::ModifierEffect::MoveToAttackConversion {
                cost_per_point: cpp,
                attack_type: at,
            } = &m.effect
            {
                if *at == attack_type {
                    return Some(*cpp);
                }
            }
            None
        })
        .ok_or_else(|| {
            ApplyError::InternalError("ConvertMoveToAttack: no matching modifier".into())
        })?;

    let attack_points = move_points / cost_per_point;

    let player = &mut state.players[player_idx];
    match attack_type {
        mk_types::modifier::CombatValueType::Attack => {
            player.combat_accumulator.attack.normal += attack_points;
            player.combat_accumulator.attack.normal_elements.physical += attack_points;
        }
        mk_types::modifier::CombatValueType::Ranged => {
            player.combat_accumulator.attack.ranged += attack_points;
            player.combat_accumulator.attack.ranged_elements.physical += attack_points;
        }
        _ => {
            return Err(ApplyError::InternalError(format!(
                "ConvertMoveToAttack: unsupported attack type {:?}",
                attack_type
            )));
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_convert_influence_to_block(
    state: &mut GameState,
    player_idx: usize,
    influence_points: u32,
    element: Option<Element>,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.influence_points < influence_points {
        return Err(ApplyError::InternalError(format!(
            "ConvertInfluenceToBlock: need {} influence, have {}",
            influence_points, player.influence_points
        )));
    }

    // Deduct influence
    player.influence_points -= influence_points;

    // Find cost_per_point from modifier
    let player_id = player.id.clone();
    let cost_per_point = state
        .active_modifiers
        .iter()
        .find_map(|m| {
            if m.created_by_player_id != player_id {
                return None;
            }
            if let mk_types::modifier::ModifierEffect::InfluenceToBlockConversion {
                cost_per_point: cpp,
                element: el,
            } = &m.effect
            {
                if *el == element {
                    return Some(*cpp);
                }
            }
            None
        })
        .ok_or_else(|| {
            ApplyError::InternalError("ConvertInfluenceToBlock: no matching modifier".into())
        })?;

    let block_points = influence_points / cost_per_point;

    let player = &mut state.players[player_idx];
    player.combat_accumulator.block += block_points;
    match element {
        None | Some(Element::Physical) => {
            player.combat_accumulator.block_elements.physical += block_points;
        }
        Some(Element::Fire) => {
            player.combat_accumulator.block_elements.fire += block_points;
        }
        Some(Element::Ice) => {
            player.combat_accumulator.block_elements.ice += block_points;
        }
        Some(Element::ColdFire) => {
            player.combat_accumulator.block_elements.cold_fire += block_points;
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_pay_heroes_assault_influence(
    state: &mut GameState,
    player_idx: usize,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.influence_points < 2 {
        return Err(ApplyError::InternalError(
            "PayHeroesAssaultInfluence: need 2 influence".into(),
        ));
    }

    player.influence_points -= 2;

    let combat = state.combat.as_mut().ok_or_else(|| {
        ApplyError::InternalError("PayHeroesAssaultInfluence: no combat".into())
    })?;

    combat.paid_heroes_assault_influence = true;

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_pay_thugs_damage_influence(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
) -> Result<ApplyResult, ApplyError> {
    let player = &mut state.players[player_idx];

    if player.influence_points < 2 {
        return Err(ApplyError::InternalError(
            "PayThugsDamageInfluence: need 2 influence".into(),
        ));
    }

    player.influence_points -= 2;

    let combat = state.combat.as_mut().ok_or_else(|| {
        ApplyError::InternalError("PayThugsDamageInfluence: no combat".into())
    })?;

    combat
        .paid_thugs_damage_influence
        .insert(unit_instance_id.as_str().to_string(), true);

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_resolve_unit_maintenance(
    state: &mut GameState,
    player_idx: usize,
    unit_instance_id: &mk_types::ids::UnitInstanceId,
    keep_unit: bool,
    crystal_color: Option<BasicManaColor>,
    new_mana_token_color: Option<BasicManaColor>,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::ActivePending;

    if keep_unit {
        // Deduct 1 crystal of the chosen color
        let color = crystal_color.ok_or_else(|| {
            ApplyError::InternalError("ResolveUnitMaintenance keep: no crystal color".into())
        })?;
        let token_color = new_mana_token_color.ok_or_else(|| {
            ApplyError::InternalError("ResolveUnitMaintenance keep: no token color".into())
        })?;

        let player = &mut state.players[player_idx];
        let crystal_ref = match color {
            BasicManaColor::Red => &mut player.crystals.red,
            BasicManaColor::Blue => &mut player.crystals.blue,
            BasicManaColor::Green => &mut player.crystals.green,
            BasicManaColor::White => &mut player.crystals.white,
        };
        if *crystal_ref == 0 {
            return Err(ApplyError::InternalError(format!(
                "ResolveUnitMaintenance: no {:?} crystal",
                color
            )));
        }
        *crystal_ref -= 1;

        // Update unit's mana token
        let unit = player
            .units
            .iter_mut()
            .find(|u| u.instance_id == *unit_instance_id)
            .ok_or_else(|| {
                ApplyError::InternalError(format!(
                    "ResolveUnitMaintenance: unit '{}' not found",
                    unit_instance_id.as_str()
                ))
            })?;
        unit.mana_token = Some(ManaToken {
            color: ManaColor::from(token_color),
            source: ManaTokenSource::Effect,
            cannot_power_spells: false,
        });
    } else {
        // Disband: remove unit
        let player = &mut state.players[player_idx];
        let unit_idx = player
            .units
            .iter()
            .position(|u| u.instance_id == *unit_instance_id)
            .ok_or_else(|| {
                ApplyError::InternalError(format!(
                    "ResolveUnitMaintenance disband: unit '{}' not found",
                    unit_instance_id.as_str()
                ))
            })?;
        player.units.remove(unit_idx);

        // Clear bonds_of_loyalty if matching
        if player
            .bonds_of_loyalty_unit_instance_id
            .as_ref()
            .is_some_and(|id| id == unit_instance_id)
        {
            player.bonds_of_loyalty_unit_instance_id = None;
        }

        // Remove attached banners for this unit
        player
            .attached_banners
            .retain(|b| b.unit_instance_id != *unit_instance_id);
    }

    // Remove entry from pending list
    let player = &mut state.players[player_idx];
    if let Some(ActivePending::UnitMaintenance(ref mut entries)) = player.pending.active {
        entries.retain(|e| e.unit_instance_id != *unit_instance_id);
        if entries.is_empty() {
            player.pending.active = None;
        }
    }

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_resolve_hex_cost_reduction(
    state: &mut GameState,
    player_idx: usize,
    coordinate: mk_types::hex::HexCoord,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, TerrainCostReductionMode};

    let player = &state.players[player_idx];
    let (reduction, minimum_cost) = match &player.pending.active {
        Some(ActivePending::TerrainCostReduction(ref tcr))
            if tcr.mode == TerrainCostReductionMode::Hex =>
        {
            if !tcr.available_coordinates.contains(&coordinate) {
                return Err(ApplyError::InternalError(format!(
                    "ResolveHexCostReduction: coord {:?} not in available list",
                    coordinate
                )));
            }
            (tcr.reduction, tcr.minimum_cost)
        }
        _ => {
            return Err(ApplyError::InternalError(
                "ResolveHexCostReduction: no TerrainCostReduction pending (Hex mode)".into(),
            ));
        }
    };

    // Clear pending
    state.players[player_idx].pending.active = None;

    // Determine the terrain at target coordinate
    let terrain = state
        .map
        .hexes
        .get(&coordinate.key())
        .map(|h| h.terrain)
        .ok_or_else(|| {
            ApplyError::InternalError(format!(
                "ResolveHexCostReduction: hex {:?} not found on map",
                coordinate
            ))
        })?;

    // Add a TerrainCost modifier for this specific terrain with Turn duration
    let player_id = state.players[player_idx].id.clone();
    let modifier_id = ModifierId::from(format!("druidic_hex_{}", state.next_instance_counter));
    state.next_instance_counter += 1;

    state.active_modifiers.push(mk_types::modifier::ActiveModifier {
        id: modifier_id,
        source: mk_types::modifier::ModifierSource::Card {
            card_id: CardId::from("braevalar_druidic_paths"),
            player_id: player_id.clone(),
        },
        duration: mk_types::modifier::ModifierDuration::Turn,
        scope: mk_types::modifier::ModifierScope::SelfScope,
        effect: mk_types::modifier::ModifierEffect::TerrainCost {
            terrain: mk_types::modifier::TerrainOrAll::Specific(terrain),
            amount: reduction,
            minimum: minimum_cost,
            replace_cost: Some(minimum_cost),
        },
        created_at_round: state.round,
        created_by_player_id: player_id,
    });

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}

pub(super) fn apply_resolve_terrain_cost_reduction(
    state: &mut GameState,
    player_idx: usize,
    terrain: Terrain,
) -> Result<ApplyResult, ApplyError> {
    use mk_types::pending::{ActivePending, TerrainCostReductionMode};

    let player = &state.players[player_idx];
    let (reduction, minimum_cost) = match &player.pending.active {
        Some(ActivePending::TerrainCostReduction(ref tcr))
            if tcr.mode == TerrainCostReductionMode::Terrain =>
        {
            if !tcr.available_terrains.contains(&terrain) {
                return Err(ApplyError::InternalError(format!(
                    "ResolveTerrainCostReduction: terrain {:?} not in available list",
                    terrain
                )));
            }
            (tcr.reduction, tcr.minimum_cost)
        }
        _ => {
            return Err(ApplyError::InternalError(
                "ResolveTerrainCostReduction: no TerrainCostReduction pending (Terrain mode)"
                    .into(),
            ));
        }
    };

    // Clear pending
    state.players[player_idx].pending.active = None;

    // Add a TerrainCost modifier for this terrain type with Turn duration
    let player_id = state.players[player_idx].id.clone();
    let modifier_id =
        ModifierId::from(format!("druidic_terrain_{}", state.next_instance_counter));
    state.next_instance_counter += 1;

    state.active_modifiers.push(mk_types::modifier::ActiveModifier {
        id: modifier_id,
        source: mk_types::modifier::ModifierSource::Card {
            card_id: CardId::from("braevalar_druidic_paths"),
            player_id: player_id.clone(),
        },
        duration: mk_types::modifier::ModifierDuration::Turn,
        scope: mk_types::modifier::ModifierScope::SelfScope,
        effect: mk_types::modifier::ModifierEffect::TerrainCost {
            terrain: mk_types::modifier::TerrainOrAll::Specific(terrain),
            amount: reduction,
            minimum: minimum_cost,
            replace_cost: Some(minimum_cost),
        },
        created_at_round: state.round,
        created_by_player_id: player_id,
    });

    Ok(ApplyResult {
        needs_reenumeration: true,
        game_ended: false,
        events: vec![],
    })
}
