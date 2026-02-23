//! Pure functions for elemental math and combat resolution.
//!
//! All functions are stateless — they compute results from enemy definitions,
//! accumulated values, and combat phase. No GameState mutation happens here.

use std::collections::BTreeMap;

use mk_data::enemies::{get_enemy, EnemyDefinition};
use mk_types::enums::*;
use mk_types::ids::CombatInstanceId;
use mk_types::state::{CombatEnemy, CombatState, ElementalValues};

// =============================================================================
// Elemental attack math
// =============================================================================

/// Check if an attack element is resisted by the given resistance set.
///
/// - Physical ← Physical resistance
/// - Fire ← Fire resistance
/// - Ice ← Ice resistance
/// - ColdFire ← BOTH Fire AND Ice resistance present
pub fn is_attack_resisted(element: Element, resistances: &[ResistanceElement]) -> bool {
    match element {
        Element::Physical => resistances.contains(&ResistanceElement::Physical),
        Element::Fire => resistances.contains(&ResistanceElement::Fire),
        Element::Ice => resistances.contains(&ResistanceElement::Ice),
        Element::ColdFire => {
            resistances.contains(&ResistanceElement::Fire)
                && resistances.contains(&ResistanceElement::Ice)
        }
    }
}

/// Calculate effective attack value after resistance halving.
///
/// Each elemental component is checked against the combined resistance set.
/// Resisted elements are halved (floor division). Non-resisted keep full value.
pub fn calculate_effective_attack(
    attack_elements: &ElementalValues,
    resistances: &[ResistanceElement],
) -> u32 {
    let mut total = 0u32;

    if attack_elements.physical > 0 {
        if is_attack_resisted(Element::Physical, resistances) {
            total += attack_elements.physical / 2;
        } else {
            total += attack_elements.physical;
        }
    }

    if attack_elements.fire > 0 {
        if is_attack_resisted(Element::Fire, resistances) {
            total += attack_elements.fire / 2;
        } else {
            total += attack_elements.fire;
        }
    }

    if attack_elements.ice > 0 {
        if is_attack_resisted(Element::Ice, resistances) {
            total += attack_elements.ice / 2;
        } else {
            total += attack_elements.ice;
        }
    }

    if attack_elements.cold_fire > 0 {
        if is_attack_resisted(Element::ColdFire, resistances) {
            total += attack_elements.cold_fire / 2;
        } else {
            total += attack_elements.cold_fire;
        }
    }

    total
}

/// Combine resistances from all target enemies (union).
/// If ANY enemy resists an element, it applies to the whole group.
pub fn combine_resistances(enemy_defs: &[&EnemyDefinition]) -> Vec<ResistanceElement> {
    let mut combined = Vec::new();
    for def in enemy_defs {
        for &res in def.resistances {
            if !combined.contains(&res) {
                combined.push(res);
            }
        }
    }
    combined
}

// =============================================================================
// Block efficiency math
// =============================================================================

/// Check if a block element is efficient against an attack element.
///
/// | Attack     | Efficient Block            |
/// |-----------|----------------------------|
/// | Physical  | Physical, Fire, Ice, ColdFire |
/// | Fire      | Ice, ColdFire              |
/// | Ice       | Fire, ColdFire             |
/// | ColdFire  | ColdFire only              |
pub fn is_block_efficient(block_element: Element, attack_element: Element) -> bool {
    match attack_element {
        Element::Physical => true, // All block types efficient vs physical
        Element::Fire => matches!(block_element, Element::Ice | Element::ColdFire),
        Element::Ice => matches!(block_element, Element::Fire | Element::ColdFire),
        Element::ColdFire => matches!(block_element, Element::ColdFire),
    }
}

/// Calculate effective block value against an attack element.
///
/// efficient_total + floor(inefficient_total / 2)
pub fn calculate_effective_block(
    block_elements: &ElementalValues,
    attack_element: Element,
) -> u32 {
    let mut efficient = 0u32;
    let mut inefficient = 0u32;

    // Physical block
    if is_block_efficient(Element::Physical, attack_element) {
        efficient += block_elements.physical;
    } else {
        inefficient += block_elements.physical;
    }

    // Fire block
    if is_block_efficient(Element::Fire, attack_element) {
        efficient += block_elements.fire;
    } else {
        inefficient += block_elements.fire;
    }

    // Ice block
    if is_block_efficient(Element::Ice, attack_element) {
        efficient += block_elements.ice;
    } else {
        inefficient += block_elements.ice;
    }

    // ColdFire block
    if is_block_efficient(Element::ColdFire, attack_element) {
        efficient += block_elements.cold_fire;
    } else {
        inefficient += block_elements.cold_fire;
    }

    efficient + inefficient / 2
}

// =============================================================================
// Enemy queries
// =============================================================================

/// Get the effective armor for an enemy in the given combat phase.
/// Elusive enemies use `armor_elusive` (higher) in the Attack phase.
pub fn get_enemy_armor_for_phase(def: &EnemyDefinition, phase: CombatPhase) -> u32 {
    if phase == CombatPhase::Attack {
        if let Some(elusive_armor) = def.armor_elusive {
            return elusive_armor;
        }
    }
    def.armor
}

/// Check if an enemy has a specific ability.
pub fn has_ability(def: &EnemyDefinition, ability: EnemyAbilityType) -> bool {
    def.abilities.contains(&ability)
}

/// Get total effective armor including phase, vampiric, and defend bonuses.
pub fn get_effective_armor(
    def: &EnemyDefinition,
    phase: CombatPhase,
    vampiric_bonus: u32,
    defend_bonus: u32,
) -> u32 {
    get_enemy_armor_for_phase(def, phase) + vampiric_bonus + defend_bonus
}

/// Get attack info for a specific attack index.
///
/// Returns `(damage, element, is_swift)`.
/// For single-attack enemies, use attack_index=0.
/// For multi-attack, uses the `attacks` array.
pub fn get_enemy_attack_info(
    def: &EnemyDefinition,
    attack_index: usize,
) -> (u32, Element, bool) {
    let is_swift = has_ability(def, EnemyAbilityType::Swift);

    if let Some(attacks) = def.attacks {
        if attack_index < attacks.len() {
            let atk = &attacks[attack_index];
            let atk_swift = is_swift || atk.ability == Some(EnemyAbilityType::Swift);
            return (atk.damage, atk.element, atk_swift);
        }
    }

    // Single-attack enemy (attack_index=0)
    (def.attack, def.attack_element, is_swift)
}

// =============================================================================
// City defender bonuses
// =============================================================================
//
// Per rulebook + FAQ:
// - White city: all defenders get +1 Armor
// - Blue city: +2 Attack if Ice or Fire attack, +1 Attack if ColdFire attack
// - Red city: defenders with physical attack gain Brutal
// - Green city: defenders with physical attack gain Poison
//
// These bonuses cannot be removed by Know Your Prey (they're location-based).
//
// FAQ S4: Only enemies *inside* the city get the bonus. Provoked rampaging
// enemies from adjacent hexes do NOT get the city bonus. Summoned monsters
// from city defenders DO get the bonus.

/// Determine the effective city color for a specific enemy.
///
/// Returns the combat's city_color if the enemy is a city defender
/// (`is_required_for_conquest`) or was summoned by a city defender.
/// Provoked rampaging enemies (not required for conquest) return None.
pub fn effective_city_color_for_enemy(
    combat: &CombatState,
    enemy: &CombatEnemy,
) -> Option<BasicManaColor> {
    let city_color = combat.city_color?;

    if enemy.is_required_for_conquest {
        return Some(city_color);
    }

    // Summoned by a city defender? Check the summoner's is_required_for_conquest.
    if let Some(ref summoner_id) = enemy.summoned_by_instance_id {
        if let Some(summoner) = combat.enemies.iter().find(|e| e.instance_id == *summoner_id) {
            if summoner.is_required_for_conquest {
                return Some(city_color);
            }
        }
    }

    None
}

/// Get the city armor bonus for an enemy at a city.
/// White city: +1 armor for all defenders.
pub fn city_armor_bonus(city_color: Option<BasicManaColor>) -> u32 {
    match city_color {
        Some(BasicManaColor::White) => 1,
        _ => 0,
    }
}

/// Get the city attack bonus for a specific attack element.
/// Blue city: +2 for Ice or Fire, +1 for ColdFire.
pub fn city_attack_bonus(city_color: Option<BasicManaColor>, element: Element) -> u32 {
    match city_color {
        Some(BasicManaColor::Blue) => match element {
            Element::Ice | Element::Fire => 2,
            Element::ColdFire => 1,
            Element::Physical => 0,
        },
        _ => 0,
    }
}

/// Check if an enemy has a specific ability, including city-granted abilities.
/// Red city: physical attackers gain Brutal.
/// Green city: physical attackers gain Poison.
pub fn has_ability_with_city(
    def: &EnemyDefinition,
    ability: EnemyAbilityType,
    city_color: Option<BasicManaColor>,
) -> bool {
    if def.abilities.contains(&ability) {
        return true;
    }
    // City-granted abilities only apply to physical attackers
    if def.attack_element == Element::Physical {
        match (city_color, ability) {
            (Some(BasicManaColor::Red), EnemyAbilityType::Brutal) => return true,
            (Some(BasicManaColor::Green), EnemyAbilityType::Poison) => return true,
            _ => {}
        }
    }
    false
}

/// Get effective armor with city bonus.
pub fn get_effective_armor_with_city(
    def: &EnemyDefinition,
    phase: CombatPhase,
    vampiric_bonus: u32,
    defend_bonus: u32,
    city_color: Option<BasicManaColor>,
) -> u32 {
    get_effective_armor(def, phase, vampiric_bonus, defend_bonus) + city_armor_bonus(city_color)
}

/// Get attack info with city bonus applied to damage.
///
/// Returns `(damage, element, is_swift)` with Blue city bonus added.
pub fn get_enemy_attack_info_with_city(
    def: &EnemyDefinition,
    attack_index: usize,
    city_color: Option<BasicManaColor>,
) -> (u32, Element, bool) {
    let (damage, element, is_swift) = get_enemy_attack_info(def, attack_index);
    let bonus = city_attack_bonus(city_color, element);
    (damage + bonus, element, is_swift)
}

/// Calculate hero wounds with city bonuses (Brutal/Poison from Red/Green city).
pub fn calculate_hero_wounds_with_city(
    enemy_def: &EnemyDefinition,
    attack_index: usize,
    hero_armor: u32,
    city_color: Option<BasicManaColor>,
) -> (u32, bool) {
    let (damage, _element, _is_swift) =
        get_enemy_attack_info_with_city(enemy_def, attack_index, city_color);

    if damage == 0 || hero_armor == 0 {
        return (0, false);
    }

    let is_brutal = has_ability_with_city(enemy_def, EnemyAbilityType::Brutal, city_color);
    let effective_damage = if is_brutal { damage * 2 } else { damage };

    let is_poison = has_ability_with_city(enemy_def, EnemyAbilityType::Poison, city_color);

    let wounds = effective_damage.div_ceil(hero_armor);

    (wounds, is_poison)
}

/// Calculate hero wounds from pre-computed damage with city bonuses.
pub fn calculate_hero_wounds_with_damage_and_city(
    enemy_def: &EnemyDefinition,
    _attack_index: usize,
    hero_armor: u32,
    damage: u32,
    city_color: Option<BasicManaColor>,
) -> (u32, bool) {
    if damage == 0 || hero_armor == 0 {
        return (0, false);
    }

    let is_brutal = has_ability_with_city(enemy_def, EnemyAbilityType::Brutal, city_color);
    let effective_damage = if is_brutal { damage * 2 } else { damage };

    let is_poison = has_ability_with_city(enemy_def, EnemyAbilityType::Poison, city_color);

    let wounds = effective_damage.div_ceil(hero_armor);

    (wounds, is_poison)
}

// =============================================================================
// Block resolution
// =============================================================================

/// Result of a block attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BlockResult {
    pub success: bool,
    pub required: u32,
    pub effective_block: u32,
}

/// Resolve a block attempt against a specific enemy attack.
///
/// Swift doubles the required block.
pub fn resolve_block(
    block_elements: &ElementalValues,
    enemy_def: &EnemyDefinition,
    attack_index: usize,
) -> BlockResult {
    resolve_block_with_city(block_elements, enemy_def, attack_index, None)
}

/// Resolve a block attempt with city bonus applied.
pub fn resolve_block_with_city(
    block_elements: &ElementalValues,
    enemy_def: &EnemyDefinition,
    attack_index: usize,
    city_color: Option<BasicManaColor>,
) -> BlockResult {
    let (damage, element, is_swift) =
        get_enemy_attack_info_with_city(enemy_def, attack_index, city_color);

    let required = if is_swift { damage * 2 } else { damage };
    let effective_block = calculate_effective_block(block_elements, element);

    BlockResult {
        success: effective_block >= required,
        required,
        effective_block,
    }
}

// =============================================================================
// Attack resolution
// =============================================================================

/// Result of an attack attempt.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AttackResult {
    pub success: bool,
    pub effective_attack: u32,
    pub total_armor: u32,
    pub fame_gained: u32,
    pub reputation_delta: i32,
}

/// Resolve an attack against one or more target enemies.
///
/// Combines target resistances (union), calculates effective attack after
/// resistance halving, sums total armor (Elusive in Attack phase + vampiric/defend bonuses).
/// All-or-nothing: must meet combined armor to defeat all targets.
///
/// `bonus_armor` provides per-enemy instance armor bonuses (vampiric + defend).
/// `removed_resistances` lists resistance elements stripped by modifiers (e.g. Sword of Justice).
pub fn resolve_attack(
    available_elements: &ElementalValues,
    targets: &[(&CombatEnemy, &EnemyDefinition)],
    phase: CombatPhase,
    bonus_armor: &BTreeMap<String, i32>,
) -> AttackResult {
    resolve_attack_with_removed_resistances(
        available_elements, targets, phase, bonus_armor, &[],
    )
}

/// Like `resolve_attack` but with explicit resistance removal.
pub fn resolve_attack_with_removed_resistances(
    available_elements: &ElementalValues,
    targets: &[(&CombatEnemy, &EnemyDefinition)],
    phase: CombatPhase,
    bonus_armor: &BTreeMap<String, i32>,
    removed_resistances: &[ResistanceElement],
) -> AttackResult {
    resolve_attack_with_city(
        available_elements, targets, phase, bonus_armor, removed_resistances, None,
    )
}

/// Like `resolve_attack_with_removed_resistances` but with city armor bonus.
pub fn resolve_attack_with_city(
    available_elements: &ElementalValues,
    targets: &[(&CombatEnemy, &EnemyDefinition)],
    phase: CombatPhase,
    bonus_armor: &BTreeMap<String, i32>,
    removed_resistances: &[ResistanceElement],
    city_color: Option<BasicManaColor>,
) -> AttackResult {
    // Collect definitions for resistance combination
    let defs: Vec<&EnemyDefinition> = targets.iter().map(|(_, def)| *def).collect();
    let mut combined_resistances = combine_resistances(&defs);

    // Filter out removed resistances
    combined_resistances.retain(|r| !removed_resistances.contains(r));

    let effective_attack = calculate_effective_attack(available_elements, &combined_resistances);

    let city_armor = city_armor_bonus(city_color);
    let total_armor: u32 = targets
        .iter()
        .map(|(enemy, def)| {
            let bonus = bonus_armor
                .get(enemy.instance_id.as_str())
                .copied()
                .unwrap_or(0);
            (get_enemy_armor_for_phase(def, phase) as i32 + bonus + city_armor as i32).max(0) as u32
        })
        .sum();

    // Skip fame for summoned enemies
    let fame_gained: u32 = targets
        .iter()
        .filter(|(enemy, _)| enemy.summoned_by_instance_id.is_none())
        .map(|(_, def)| def.fame)
        .sum();

    let reputation_delta: i32 = targets
        .iter()
        .filter(|(enemy, _)| enemy.summoned_by_instance_id.is_none())
        .map(|(_, def)| {
            let bonus = def.reputation_bonus.unwrap_or(0) as i32;
            let penalty = -(def.reputation_penalty.unwrap_or(0) as i32);
            bonus + penalty
        })
        .sum();

    let success = effective_attack >= total_armor;

    AttackResult {
        success,
        effective_attack,
        total_armor,
        fame_gained: if success { fame_gained } else { 0 },
        reputation_delta: if success { reputation_delta } else { 0 },
    }
}

// =============================================================================
// Hero damage calculation
// =============================================================================

/// Calculate wounds dealt to the hero from an unblocked enemy attack.
///
/// wounds = ceil(effective_damage / hero_armor)
/// Brutal doubles the damage. Returns (wound_count, is_poison).
pub fn calculate_hero_wounds(
    enemy_def: &EnemyDefinition,
    attack_index: usize,
    hero_armor: u32,
) -> (u32, bool) {
    let (damage, _element, _is_swift) = get_enemy_attack_info(enemy_def, attack_index);

    if damage == 0 || hero_armor == 0 {
        return (0, false);
    }

    let is_brutal = has_ability(enemy_def, EnemyAbilityType::Brutal);
    let effective_damage = if is_brutal { damage * 2 } else { damage };

    let is_poison = has_ability(enemy_def, EnemyAbilityType::Poison);

    let wounds = effective_damage.div_ceil(hero_armor);

    (wounds, is_poison)
}

// =============================================================================
// Defend auto-assignment
// =============================================================================

/// Auto-assign defend bonuses from undefeated Defend enemies to attacked targets.
///
/// Each Defend enemy can protect ONE target per combat (tracked in `used_defend`).
/// Returns a map of target_instance_id → total defend bonus.
///
/// Targets that already have an entry in `defend_bonuses` are skipped — their
/// defend bonus was already locked in by a previous attack (FAQ S29: defend
/// persists for the entire combat, even after the defending enemy is killed).
///
/// Algorithm (greedy): for each target, find the first available (unused) Defend
/// enemy and assign its defend value. Defend enemies can also defend themselves.
pub fn auto_assign_defend(
    enemies: &[CombatEnemy],
    target_ids: &[CombatInstanceId],
    used_defend: &BTreeMap<String, String>,
    defend_bonuses: &BTreeMap<String, u32>,
) -> BTreeMap<String, u32> {
    let mut assignments: BTreeMap<String, u32> = BTreeMap::new();
    let mut newly_used: Vec<String> = Vec::new();

    // Collect available defenders (undefeated, have Defend, not yet used)
    let mut available_defenders: Vec<(&CombatEnemy, u32)> = Vec::new();
    for enemy in enemies {
        if enemy.is_defeated {
            continue;
        }
        let def = match get_enemy(enemy.enemy_id.as_str()) {
            Some(d) => d,
            None => continue,
        };
        if !has_ability(def, EnemyAbilityType::Defend) {
            continue;
        }
        let defend_value = match def.defend {
            Some(v) => v,
            None => continue,
        };
        // Check if already used (in permanent state)
        if used_defend.contains_key(enemy.instance_id.as_str()) {
            continue;
        }
        available_defenders.push((enemy, defend_value));
    }

    // Assign defenders to targets
    for target_id in target_ids {
        // Skip targets that already have a persisted defend bonus
        if defend_bonuses.contains_key(target_id.as_str()) {
            continue;
        }

        // Find first available defender not yet assigned in this round
        let defender_idx = available_defenders.iter().position(|(defender, _)| {
            !newly_used.contains(&defender.instance_id.as_str().to_string())
        });

        if let Some(idx) = defender_idx {
            let (defender, defend_value) = available_defenders[idx];
            *assignments
                .entry(target_id.as_str().to_string())
                .or_insert(0) += defend_value;
            newly_used.push(defender.instance_id.as_str().to_string());
        }
    }

    assignments
}

/// Calculate wounds from pre-computed damage (after cumbersome reduction).
///
/// Like `calculate_hero_wounds` but uses the provided damage instead of the enemy def's base.
/// Brutal still doubles the provided damage.
pub fn calculate_hero_wounds_with_damage(
    enemy_def: &EnemyDefinition,
    _attack_index: usize,
    hero_armor: u32,
    damage: u32,
) -> (u32, bool) {
    if damage == 0 || hero_armor == 0 {
        return (0, false);
    }

    let is_brutal = has_ability(enemy_def, EnemyAbilityType::Brutal);
    let effective_damage = if is_brutal { damage * 2 } else { damage };

    let is_poison = has_ability(enemy_def, EnemyAbilityType::Poison);

    let wounds = effective_damage.div_ceil(hero_armor);

    (wounds, is_poison)
}

// =============================================================================
// Unit damage calculation
// =============================================================================

/// Result of assigning an attack to a unit.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnitDamageResult {
    pub unit_destroyed: bool,
    pub unit_wounded: bool,
    /// Whether a resistance was consumed for this damage calculation.
    pub resistance_used: bool,
}

/// Calculate result of assigning an enemy attack to a unit.
///
/// - Poison → instant destruction
/// - Unit armor = unit level
/// - If unit has matching resistance and hasn't used it: halve damage (ceiling)
/// - If effective_damage <= armor → fully absorbed
/// - If not wounded → becomes wounded
/// - If already wounded → destroyed
#[allow(clippy::too_many_arguments)] // attack + unit properties are cohesive
pub fn calculate_unit_damage(
    attack_damage: u32,
    attack_element: Element,
    is_poison: bool,
    is_paralyze: bool,
    unit_level: u8,
    unit_wounded: bool,
    used_resistance_this_combat: bool,
    unit_resistances: &[ResistanceElement],
) -> UnitDamageResult {
    if is_poison || is_paralyze {
        return UnitDamageResult {
            unit_destroyed: true,
            unit_wounded: false,
            resistance_used: false,
        };
    }

    let armor = unit_level as u32;

    // Check if unit has matching resistance and can use it
    let can_resist = !used_resistance_this_combat
        && is_attack_resisted(attack_element, unit_resistances);

    let effective_damage = if can_resist {
        attack_damage.div_ceil(2)
    } else {
        attack_damage
    };

    if effective_damage <= armor {
        UnitDamageResult {
            unit_destroyed: false,
            unit_wounded: false,
            resistance_used: can_resist && attack_damage > 0,
        }
    } else if !unit_wounded {
        UnitDamageResult {
            unit_destroyed: false,
            unit_wounded: true,
            resistance_used: can_resist && attack_damage > 0,
        }
    } else {
        UnitDamageResult {
            unit_destroyed: true,
            unit_wounded: false,
            resistance_used: can_resist && attack_damage > 0,
        }
    }
}

/// Subtract element-wise: a - b, clamped to 0.
pub fn subtract_elements(a: &ElementalValues, b: &ElementalValues) -> ElementalValues {
    ElementalValues {
        physical: a.physical.saturating_sub(b.physical),
        fire: a.fire.saturating_sub(b.fire),
        ice: a.ice.saturating_sub(b.ice),
        cold_fire: a.cold_fire.saturating_sub(b.cold_fire),
    }
}

/// Add element-wise.
pub fn add_elements(a: &ElementalValues, b: &ElementalValues) -> ElementalValues {
    ElementalValues {
        physical: a.physical + b.physical,
        fire: a.fire + b.fire,
        ice: a.ice + b.ice,
        cold_fire: a.cold_fire + b.cold_fire,
    }
}

// =============================================================================
// Modifier query helpers (for SelectCombatEnemy abilities)
// =============================================================================

use mk_types::modifier::{ActiveModifier, ModifierEffect, ModifierScope, EnemyStat as ModEnemyStat};

/// Check if an enemy's attacks are skipped via EnemySkipAttack modifier.
pub fn is_enemy_attacks_skipped(modifiers: &[ActiveModifier], enemy_id: &str) -> bool {
    modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::EnemySkipAttack)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
    })
}

/// Get armor adjustment from EnemyStat(Armor) modifiers. Returns (total_change, max_minimum).
pub fn get_enemy_armor_modifier(modifiers: &[ActiveModifier], enemy_id: &str) -> (i32, u32) {
    let mut total_change = 0i32;
    let mut max_minimum = 0u32;
    for m in modifiers {
        if let ModifierEffect::EnemyStat { stat: ModEnemyStat::Armor, amount, minimum, exclude_resistance, .. } = &m.effect {
            // Skip modifier if enemy has the excluded resistance
            if let Some(resist) = exclude_resistance {
                if enemy_has_resistance(enemy_id, *resist) {
                    continue;
                }
            }
            if matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
                || matches!(&m.scope, ModifierScope::AllEnemies)
            {
                total_change += amount;
                if *minimum > max_minimum {
                    max_minimum = *minimum;
                }
            }
        }
    }
    (total_change, max_minimum)
}

/// Get attack adjustment from EnemyStat(Attack) modifiers. Returns (total_change, max_minimum).
pub fn get_enemy_attack_modifier(modifiers: &[ActiveModifier], enemy_id: &str) -> (i32, u32) {
    let mut total_change = 0i32;
    let mut max_minimum = 0u32;
    for m in modifiers {
        if let ModifierEffect::EnemyStat { stat: ModEnemyStat::Attack, amount, minimum, exclude_resistance, .. } = &m.effect {
            // Skip modifier if enemy has the excluded resistance
            if let Some(resist) = exclude_resistance {
                if enemy_has_resistance(enemy_id, *resist) {
                    continue;
                }
            }
            if matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
                || matches!(&m.scope, ModifierScope::AllEnemies)
            {
                total_change += amount;
                if *minimum > max_minimum {
                    max_minimum = *minimum;
                }
            }
        }
    }
    (total_change, max_minimum)
}

/// Check if an enemy has a specific resistance element.
fn enemy_has_resistance(enemy_id: &str, resist: mk_types::enums::ResistanceElement) -> bool {
    mk_data::enemies::get_enemy(enemy_id)
        .map(|def| def.resistances.contains(&resist))
        .unwrap_or(false)
}

/// Check if enemy's fortification is nullified (AbilityNullifier).
pub fn is_fortification_nullified(modifiers: &[ActiveModifier], enemy_id: &str) -> bool {
    modifiers.iter().any(|m| {
        if let ModifierEffect::AbilityNullifier { ability, .. } = &m.effect {
            *ability == Some(EnemyAbilityType::Fortified)
                && (matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
                    || matches!(&m.scope, ModifierScope::AllEnemies))
        } else {
            false
        }
    })
}

/// Check if enemy's resistances are removed (RemoveResistances modifier).
pub fn are_resistances_removed(modifiers: &[ActiveModifier], enemy_id: &str) -> bool {
    modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::RemoveResistances)
            && (matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
                || matches!(&m.scope, ModifierScope::AllEnemies))
    })
}

/// Check if enemy has DefeatIfBlocked modifier.
pub fn has_defeat_if_blocked(modifiers: &[ActiveModifier], enemy_id: &str) -> bool {
    modifiers.iter().any(|m| {
        matches!(&m.effect, ModifierEffect::DefeatIfBlocked)
            && matches!(&m.scope, ModifierScope::OneEnemy { enemy_id: id } if id == enemy_id)
    })
}

/// Check effective fortification: base ability/site + nullifier check.
pub fn is_effectively_fortified(
    def: &EnemyDefinition,
    enemy_id: &str,
    is_at_fortified_site: bool,
    modifiers: &[ActiveModifier],
) -> bool {
    let base_fortified = has_ability(def, EnemyAbilityType::Fortified) || is_at_fortified_site;
    if !base_fortified {
        return false;
    }
    !is_fortification_nullified(modifiers, enemy_id)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use mk_data::enemies::get_enemy;
    use mk_types::ids::EnemyId;

    // ---- is_attack_resisted ----

    #[test]
    fn is_attack_resisted_physical() {
        assert!(is_attack_resisted(
            Element::Physical,
            &[ResistanceElement::Physical]
        ));
        assert!(!is_attack_resisted(
            Element::Physical,
            &[ResistanceElement::Fire]
        ));
        assert!(!is_attack_resisted(Element::Physical, &[]));
    }

    #[test]
    fn is_attack_resisted_fire() {
        assert!(is_attack_resisted(
            Element::Fire,
            &[ResistanceElement::Fire]
        ));
        assert!(!is_attack_resisted(
            Element::Fire,
            &[ResistanceElement::Physical]
        ));
    }

    #[test]
    fn is_attack_resisted_cold_fire_needs_both() {
        // ColdFire resisted only when BOTH Fire AND Ice resistance present
        assert!(is_attack_resisted(
            Element::ColdFire,
            &[ResistanceElement::Fire, ResistanceElement::Ice]
        ));
        assert!(!is_attack_resisted(
            Element::ColdFire,
            &[ResistanceElement::Fire]
        ));
        assert!(!is_attack_resisted(
            Element::ColdFire,
            &[ResistanceElement::Ice]
        ));
        assert!(!is_attack_resisted(Element::ColdFire, &[]));
    }

    #[test]
    fn is_attack_resisted_ice() {
        assert!(is_attack_resisted(
            Element::Ice,
            &[ResistanceElement::Ice]
        ));
        assert!(!is_attack_resisted(
            Element::Ice,
            &[ResistanceElement::Fire]
        ));
    }

    // ---- calculate_effective_attack ----

    #[test]
    fn effective_attack_no_resistance() {
        let elements = ElementalValues {
            physical: 5,
            fire: 3,
            ice: 0,
            cold_fire: 0,
        };
        assert_eq!(calculate_effective_attack(&elements, &[]), 8);
    }

    #[test]
    fn effective_attack_partial_resistance() {
        let elements = ElementalValues {
            physical: 6,
            fire: 4,
            ice: 0,
            cold_fire: 0,
        };
        // Physical resisted: 6/2=3, Fire not resisted: 4. Total = 7
        assert_eq!(
            calculate_effective_attack(&elements, &[ResistanceElement::Physical]),
            7
        );
    }

    #[test]
    fn effective_attack_mixed_elements() {
        let elements = ElementalValues {
            physical: 3,
            fire: 2,
            ice: 4,
            cold_fire: 1,
        };
        // Fire + Ice resistance: fire halved (1), ice halved (2), cold_fire halved (0)
        // Physical: 3. Total = 3 + 1 + 2 + 0 = 6
        assert_eq!(
            calculate_effective_attack(
                &elements,
                &[ResistanceElement::Fire, ResistanceElement::Ice]
            ),
            6
        );
    }

    // ---- is_block_efficient ----

    #[test]
    fn block_efficient_vs_physical() {
        // All block types efficient vs physical
        assert!(is_block_efficient(Element::Physical, Element::Physical));
        assert!(is_block_efficient(Element::Fire, Element::Physical));
        assert!(is_block_efficient(Element::Ice, Element::Physical));
        assert!(is_block_efficient(Element::ColdFire, Element::Physical));
    }

    #[test]
    fn block_efficient_vs_fire() {
        // Ice and ColdFire efficient vs fire
        assert!(is_block_efficient(Element::Ice, Element::Fire));
        assert!(is_block_efficient(Element::ColdFire, Element::Fire));
        assert!(!is_block_efficient(Element::Physical, Element::Fire));
        assert!(!is_block_efficient(Element::Fire, Element::Fire));
    }

    #[test]
    fn block_efficient_vs_cold_fire() {
        // Only ColdFire efficient vs ColdFire
        assert!(is_block_efficient(Element::ColdFire, Element::ColdFire));
        assert!(!is_block_efficient(Element::Physical, Element::ColdFire));
        assert!(!is_block_efficient(Element::Fire, Element::ColdFire));
        assert!(!is_block_efficient(Element::Ice, Element::ColdFire));
    }

    // ---- calculate_effective_block ----

    #[test]
    fn effective_block_all_efficient() {
        let block = ElementalValues {
            physical: 3,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        // All efficient vs physical
        assert_eq!(calculate_effective_block(&block, Element::Physical), 3);
    }

    #[test]
    fn effective_block_mixed_efficiency() {
        let block = ElementalValues {
            physical: 4,
            fire: 0,
            ice: 2,
            cold_fire: 0,
        };
        // vs Fire: physical inefficient (4/2=2), ice efficient (2). Total = 4
        assert_eq!(calculate_effective_block(&block, Element::Fire), 4);
    }

    // ---- resolve_block ----

    #[test]
    fn resolve_block_success() {
        // Prowlers: 4 physical attack, not swift
        let def = get_enemy("prowlers").unwrap();
        let block = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let result = resolve_block(&block, def, 0);
        assert!(result.success);
        assert_eq!(result.required, 4);
        assert_eq!(result.effective_block, 5);
    }

    #[test]
    fn resolve_block_failure() {
        let def = get_enemy("prowlers").unwrap();
        let block = ElementalValues {
            physical: 3,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let result = resolve_block(&block, def, 0);
        assert!(!result.success);
        assert_eq!(result.required, 4);
    }

    #[test]
    fn resolve_block_swift_doubles_requirement() {
        // Wolf Riders: 3 physical attack, Swift
        let def = get_enemy("wolf_riders").unwrap();
        let block = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let result = resolve_block(&block, def, 0);
        assert!(!result.success); // Need 6, only have 5
        assert_eq!(result.required, 6); // Swift doubles from 3 to 6

        let big_block = ElementalValues {
            physical: 6,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let result2 = resolve_block(&big_block, def, 0);
        assert!(result2.success);
    }

    // ---- resolve_attack ----

    #[test]
    fn resolve_attack_success() {
        // Prowlers: armor 3, fame 2, no resistances
        let def = get_enemy("prowlers").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let attack = ElementalValues {
            physical: 4,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result.success);
        assert_eq!(result.effective_attack, 4);
        assert_eq!(result.total_armor, 3);
        assert_eq!(result.fame_gained, 2);
    }

    #[test]
    fn resolve_attack_failure() {
        let def = get_enemy("prowlers").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let attack = ElementalValues {
            physical: 2,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };

        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(!result.success);
        assert_eq!(result.fame_gained, 0);
    }

    #[test]
    fn resolve_attack_resistance_halves() {
        // Ironclads: armor 3, Physical resistance, fame 4
        let def = get_enemy("ironclads").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "ironclads".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        // 5 physical → halved to 2 (5/2=2) → not enough vs armor 3
        let attack = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(!result.success);
        assert_eq!(result.effective_attack, 2);

        // 6 physical → halved to 3 → meets armor 3
        let attack2 = ElementalValues {
            physical: 6,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let result2 = resolve_attack(&attack2, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result2.success);
    }

    // ---- get_enemy_armor_for_phase ----

    #[test]
    fn elusive_armor_in_attack_phase() {
        // Orc Tracker: armor=3, armor_elusive=6
        let def = get_enemy("orc_tracker").unwrap();
        assert_eq!(get_enemy_armor_for_phase(def, CombatPhase::RangedSiege), 3);
        assert_eq!(get_enemy_armor_for_phase(def, CombatPhase::Attack), 6);
    }

    // ---- calculate_hero_wounds ----

    #[test]
    fn hero_wounds_basic() {
        // Prowlers: 4 physical, no Brutal/Poison
        let def = get_enemy("prowlers").unwrap();

        // armor 2: ceil(4/2) = 2 wounds
        let (wounds, poison) = calculate_hero_wounds(def, 0, 2);
        assert_eq!(wounds, 2);
        assert!(!poison);

        // armor 3: ceil(4/3) = 2 wounds
        let (wounds2, _) = calculate_hero_wounds(def, 0, 3);
        assert_eq!(wounds2, 2);

        // armor 4: ceil(4/4) = 1 wound
        let (wounds3, _) = calculate_hero_wounds(def, 0, 4);
        assert_eq!(wounds3, 1);
    }

    #[test]
    fn hero_wounds_brutal_doubles() {
        // Ironclads: 4 physical, Brutal
        let def = get_enemy("ironclads").unwrap();

        // Brutal doubles: effective 8, armor 2: ceil(8/2) = 4 wounds
        let (wounds, _) = calculate_hero_wounds(def, 0, 2);
        assert_eq!(wounds, 4);
    }

    #[test]
    fn hero_wounds_poison() {
        // Cursed Hags: 3 physical, Poison
        let def = get_enemy("cursed_hags").unwrap();
        let (wounds, poison) = calculate_hero_wounds(def, 0, 2);
        assert_eq!(wounds, 2); // ceil(3/2) = 2
        assert!(poison);
    }

    #[test]
    fn hero_wounds_zero_damage() {
        // Orc Summoners: 0 attack
        let def = get_enemy("orc_summoners").unwrap();
        let (wounds, _) = calculate_hero_wounds(def, 0, 2);
        assert_eq!(wounds, 0);
    }

    // ---- combine_resistances ----

    #[test]
    fn combine_resistances_union() {
        let ironclads = get_enemy("ironclads").unwrap(); // Physical
        let skeletal = get_enemy("skeletal_warriors").unwrap(); // Fire
        let combined = combine_resistances(&[ironclads, skeletal]);
        assert!(combined.contains(&ResistanceElement::Physical));
        assert!(combined.contains(&ResistanceElement::Fire));
        assert_eq!(combined.len(), 2);
    }

    // ---- subtract_elements ----

    #[test]
    fn subtract_elements_clamps_zero() {
        let a = ElementalValues {
            physical: 3,
            fire: 1,
            ice: 0,
            cold_fire: 5,
        };
        let b = ElementalValues {
            physical: 5,
            fire: 0,
            ice: 2,
            cold_fire: 3,
        };
        let result = subtract_elements(&a, &b);
        assert_eq!(result.physical, 0);
        assert_eq!(result.fire, 1);
        assert_eq!(result.ice, 0);
        assert_eq!(result.cold_fire, 2);
    }

    // ---- reputation on defeat ----

    #[test]
    fn resolve_attack_reputation_bonus() {
        // Thugs (gray): reputation_bonus=1
        let def = get_enemy("thugs_gray").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "thugs_gray".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let attack = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result.success);
        assert_eq!(result.reputation_delta, 1);
    }

    #[test]
    fn resolve_attack_reputation_penalty() {
        // Heroes (gray): reputation_penalty=1
        let def = get_enemy("heroes").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "heroes".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false; 2],
            attacks_damage_assigned: vec![false; 2],
            attacks_cancelled: vec![false; 2],
        };

        let attack = ElementalValues {
            physical: 10,
            fire: 0,
            ice: 0,
            cold_fire: 0,
        };
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result.success);
        assert_eq!(result.reputation_delta, -1);
    }

    // ---- get_effective_armor ----

    #[test]
    fn effective_armor_includes_vampiric_and_defend() {
        let def = get_enemy("prowlers").unwrap(); // armor 3
        assert_eq!(get_effective_armor(def, CombatPhase::Attack, 0, 0), 3);
        assert_eq!(get_effective_armor(def, CombatPhase::Attack, 2, 0), 5);
        assert_eq!(get_effective_armor(def, CombatPhase::Attack, 0, 1), 4);
        assert_eq!(get_effective_armor(def, CombatPhase::Attack, 2, 1), 6);
    }

    #[test]
    fn effective_armor_elusive_plus_bonuses() {
        let def = get_enemy("orc_tracker").unwrap(); // armor 3, elusive armor 6
        assert_eq!(get_effective_armor(def, CombatPhase::RangedSiege, 1, 0), 4);
        assert_eq!(get_effective_armor(def, CombatPhase::Attack, 1, 0), 7);
    }

    // ---- resolve_attack with bonus armor ----

    #[test]
    fn resolve_attack_with_vampiric_bonus() {
        // Gibbering Ghouls: armor 4, Vampiric
        let def = get_enemy("gibbering_ghouls").unwrap();
        let enemy = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "gibbering_ghouls".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let attack = ElementalValues { physical: 6, fire: 0, ice: 0, cold_fire: 0 };

        // Without bonus: 6 >= 4, success
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result.success);

        // With +3 vampiric bonus: 6 < 7, failure
        let mut bonus = BTreeMap::new();
        bonus.insert("enemy_0".to_string(), 3i32);
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &bonus);
        assert!(!result.success);
        assert_eq!(result.total_armor, 7);
    }

    // ---- auto_assign_defend ----

    #[test]
    fn auto_assign_defend_basic() {
        // Corrupted Priests: Defend with defend=1
        let defender = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "corrupted_priests".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };
        let target = CombatEnemy {
            instance_id: "enemy_1".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let enemies = vec![defender, target];
        let target_ids = vec![CombatInstanceId::from("enemy_1")];
        let used = BTreeMap::new();

        let result = auto_assign_defend(&enemies, &target_ids, &used, &BTreeMap::new());
        assert_eq!(result.get("enemy_1").copied().unwrap_or(0), 1);
    }

    #[test]
    fn auto_assign_defend_already_used() {
        let defender = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "corrupted_priests".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let enemies = vec![defender];
        let target_ids = vec![CombatInstanceId::from("enemy_0")];
        let mut used = BTreeMap::new();
        used.insert("enemy_0".to_string(), "some_target".to_string());

        let result = auto_assign_defend(&enemies, &target_ids, &used, &BTreeMap::new());
        assert!(result.is_empty());
    }

    #[test]
    fn auto_assign_defend_self() {
        // Defender can defend itself when targeted
        let defender = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "elven_protectors".into(), // Defend with defend=2
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let enemies = vec![defender];
        let target_ids = vec![CombatInstanceId::from("enemy_0")];
        let used = BTreeMap::new();

        let result = auto_assign_defend(&enemies, &target_ids, &used, &BTreeMap::new());
        assert_eq!(result.get("enemy_0").copied().unwrap_or(0), 2);
    }

    #[test]
    fn auto_assign_defend_multiple_defenders() {
        // Two defenders protect two targets
        let defender1 = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "corrupted_priests".into(), // defend=1
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };
        let defender2 = CombatEnemy {
            instance_id: "enemy_1".into(),
            enemy_id: "elven_protectors".into(), // defend=2
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };
        let target = CombatEnemy {
            instance_id: "enemy_2".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let enemies = vec![defender1, defender2, target];
        // Attack two targets
        let target_ids = vec![
            CombatInstanceId::from("enemy_1"),
            CombatInstanceId::from("enemy_2"),
        ];
        let used = BTreeMap::new();

        let result = auto_assign_defend(&enemies, &target_ids, &used, &BTreeMap::new());
        // First defender (corrupted_priests, defend=1) protects enemy_1
        assert_eq!(result.get("enemy_1").copied().unwrap_or(0), 1);
        // Second defender (elven_protectors, defend=2) protects enemy_2
        // But wait — elven_protectors IS enemy_1, so it's also a target. But it hasn't been used as defender.
        // Actually enemy_1 IS the elven_protectors. The defender logic assigns:
        // - For target enemy_1: first available = enemy_0 (corrupted_priests, defend=1) → +1
        // - For target enemy_2: first available = enemy_1 (elven_protectors, defend=2) → +2
        assert_eq!(result.get("enemy_2").copied().unwrap_or(0), 2);
    }

    #[test]
    fn auto_assign_defend_skips_already_defended() {
        // If a target already has a persisted defend bonus, auto_assign_defend
        // should not consume another defender for it (FAQ S29).
        let defender = CombatEnemy {
            instance_id: "enemy_0".into(),
            enemy_id: "corrupted_priests".into(), // defend=1
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };
        let target = CombatEnemy {
            instance_id: "enemy_1".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let enemies = vec![defender, target];
        let target_ids = vec![CombatInstanceId::from("enemy_1")];
        let used = BTreeMap::new();
        // enemy_1 already has a persisted defend bonus from a prior attack
        let mut existing_bonuses = BTreeMap::new();
        existing_bonuses.insert("enemy_1".to_string(), 1);

        let result = auto_assign_defend(&enemies, &target_ids, &used, &existing_bonuses);
        // No new assignment because the target already has a bonus
        assert!(result.is_empty());
    }

    // ---- resolve_attack skips fame for summoned ----

    #[test]
    fn resolve_attack_no_fame_for_summoned() {
        let def = get_enemy("prowlers").unwrap(); // fame 2
        let enemy = CombatEnemy {
            instance_id: "summoned_0_prowlers".into(),
            enemy_id: "prowlers".into(),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: false,
            summoned_by_instance_id: Some("enemy_0".into()),
            is_summoner_hidden: false,
            attacks_blocked: vec![false],
            attacks_damage_assigned: vec![false],
            attacks_cancelled: vec![false],
        };

        let attack = ElementalValues { physical: 5, fire: 0, ice: 0, cold_fire: 0 };
        let result = resolve_attack(&attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new());
        assert!(result.success);
        assert_eq!(result.fame_gained, 0, "No fame for summoned enemies");
    }

    // =========================================================================
    // City defender bonus tests
    // =========================================================================

    #[test]
    fn white_city_armor_bonus() {
        assert_eq!(city_armor_bonus(Some(BasicManaColor::White)), 1);
        assert_eq!(city_armor_bonus(Some(BasicManaColor::Blue)), 0);
        assert_eq!(city_armor_bonus(Some(BasicManaColor::Red)), 0);
        assert_eq!(city_armor_bonus(Some(BasicManaColor::Green)), 0);
        assert_eq!(city_armor_bonus(None), 0);
    }

    #[test]
    fn blue_city_attack_bonus_fire() {
        // Fire attack: +2
        assert_eq!(city_attack_bonus(Some(BasicManaColor::Blue), Element::Fire), 2);
    }

    #[test]
    fn blue_city_attack_bonus_ice() {
        // Ice attack: +2
        assert_eq!(city_attack_bonus(Some(BasicManaColor::Blue), Element::Ice), 2);
    }

    #[test]
    fn blue_city_attack_bonus_cold_fire() {
        // ColdFire attack: +1
        assert_eq!(city_attack_bonus(Some(BasicManaColor::Blue), Element::ColdFire), 1);
    }

    #[test]
    fn blue_city_no_bonus_physical() {
        // Physical attack: no bonus at blue city
        assert_eq!(city_attack_bonus(Some(BasicManaColor::Blue), Element::Physical), 0);
    }

    #[test]
    fn non_blue_city_no_attack_bonus() {
        assert_eq!(city_attack_bonus(Some(BasicManaColor::Red), Element::Fire), 0);
        assert_eq!(city_attack_bonus(None, Element::Ice), 0);
    }

    #[test]
    fn red_city_grants_brutal_to_physical() {
        // Prowlers: physical attack, no innate Brutal
        let def = get_enemy("prowlers").unwrap();
        assert!(!has_ability(def, EnemyAbilityType::Brutal));
        assert!(has_ability_with_city(def, EnemyAbilityType::Brutal, Some(BasicManaColor::Red)));
    }

    #[test]
    fn red_city_no_brutal_for_non_physical() {
        // Ice Mages: ice attack — Red city shouldn't grant Brutal
        let def = get_enemy("ice_mages").unwrap();
        assert!(!has_ability_with_city(def, EnemyAbilityType::Brutal, Some(BasicManaColor::Red)));
    }

    #[test]
    fn green_city_grants_poison_to_physical() {
        // Prowlers: physical attack, no innate Poison
        let def = get_enemy("prowlers").unwrap();
        assert!(!has_ability(def, EnemyAbilityType::Poison));
        assert!(has_ability_with_city(def, EnemyAbilityType::Poison, Some(BasicManaColor::Green)));
    }

    #[test]
    fn green_city_no_poison_for_non_physical() {
        // Fire Mages: fire attack — Green city shouldn't grant Poison
        let def = get_enemy("fire_mages").unwrap();
        assert!(!has_ability_with_city(def, EnemyAbilityType::Poison, Some(BasicManaColor::Green)));
    }

    #[test]
    fn white_city_effective_armor_includes_bonus() {
        // Prowlers: armor 3, White city: +1 → 4
        let def = get_enemy("prowlers").unwrap();
        let armor = get_effective_armor_with_city(def, CombatPhase::Block, 0, 0, Some(BasicManaColor::White));
        assert_eq!(armor, 4);
    }

    #[test]
    fn blue_city_attack_info_fire_mages() {
        // Fire Mages: base 6 Fire, Blue city +2 → 8 Fire
        let def = get_enemy("fire_mages").unwrap();
        let (dmg, elem, _swift) = get_enemy_attack_info_with_city(def, 0, Some(BasicManaColor::Blue));
        assert_eq!(dmg, 8);
        assert_eq!(elem, Element::Fire);
    }

    #[test]
    fn blue_city_attack_info_ice_mages() {
        // Ice Mages: base 5 Ice, Blue city +2 → 7 Ice
        let def = get_enemy("ice_mages").unwrap();
        let (dmg, elem, _swift) = get_enemy_attack_info_with_city(def, 0, Some(BasicManaColor::Blue));
        assert_eq!(dmg, 7);
        assert_eq!(elem, Element::Ice);
    }

    #[test]
    fn blue_city_attack_info_coldfire() {
        // Corrupted Priests: base 4 ColdFire, Blue city +1 → 5 ColdFire
        let def = get_enemy("corrupted_priests").unwrap();
        let (dmg, elem, _swift) = get_enemy_attack_info_with_city(def, 0, Some(BasicManaColor::Blue));
        assert_eq!(dmg, 5);
        assert_eq!(elem, Element::ColdFire);
    }

    #[test]
    fn blue_city_no_bonus_to_physical_attacker() {
        // Prowlers: base 4 Physical, Blue city +0 → 4 Physical
        let def = get_enemy("prowlers").unwrap();
        let (dmg, _, _) = get_enemy_attack_info_with_city(def, 0, Some(BasicManaColor::Blue));
        assert_eq!(dmg, 4);
    }

    #[test]
    fn red_city_hero_wounds_brutal_doubles() {
        // Prowlers at Red city: 4 Physical, Brutal from city → 8 effective, armor 2 → 4 wounds
        let def = get_enemy("prowlers").unwrap();
        let (wounds, is_poison) = calculate_hero_wounds_with_city(def, 0, 2, Some(BasicManaColor::Red));
        assert_eq!(wounds, 4);
        assert!(!is_poison);
    }

    #[test]
    fn green_city_hero_wounds_poison() {
        // Prowlers at Green city: 4 Physical, Poison from city → wounds=2, is_poison=true
        let def = get_enemy("prowlers").unwrap();
        let (wounds, is_poison) = calculate_hero_wounds_with_city(def, 0, 2, Some(BasicManaColor::Green));
        assert_eq!(wounds, 2); // ceil(4/2) = 2
        assert!(is_poison);
    }

    #[test]
    fn blue_city_hero_wounds_increased_damage() {
        // Fire Mages at Blue city: 6+2=8 Fire, armor 2 → ceil(8/2) = 4 wounds
        let def = get_enemy("fire_mages").unwrap();
        let (wounds, _) = calculate_hero_wounds_with_city(def, 0, 2, Some(BasicManaColor::Blue));
        assert_eq!(wounds, 4);
    }

    #[test]
    fn white_city_attack_needs_more_to_defeat() {
        // Prowlers: armor 3 + White city +1 = 4 total armor
        let def = get_enemy("prowlers").unwrap();
        let enemy = make_test_enemy("prowlers");

        // 3 physical attack: not enough (was enough without city bonus)
        let attack = ElementalValues { physical: 3, fire: 0, ice: 0, cold_fire: 0 };
        let result = resolve_attack_with_city(
            &attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new(),
            &[], Some(BasicManaColor::White),
        );
        assert!(!result.success);

        // 4 physical: exactly enough
        let attack = ElementalValues { physical: 4, fire: 0, ice: 0, cold_fire: 0 };
        let result = resolve_attack_with_city(
            &attack, &[(&enemy, def)], CombatPhase::Attack, &BTreeMap::new(),
            &[], Some(BasicManaColor::White),
        );
        assert!(result.success);
    }

    #[test]
    fn blue_city_block_requires_more() {
        // Fire Mages: base 6 Fire attack, Blue city +2 → 8 required block
        let def = get_enemy("fire_mages").unwrap();

        // 7 ice block (efficient vs Fire): not enough with city bonus
        let block = ElementalValues { physical: 0, fire: 0, ice: 7, cold_fire: 0 };
        let result = resolve_block_with_city(&block, def, 0, Some(BasicManaColor::Blue));
        assert!(!result.success);
        assert_eq!(result.required, 8);

        // 8 ice block: exactly enough
        let block = ElementalValues { physical: 0, fire: 0, ice: 8, cold_fire: 0 };
        let result = resolve_block_with_city(&block, def, 0, Some(BasicManaColor::Blue));
        assert!(result.success);
    }

    #[test]
    fn no_city_color_no_bonus() {
        // All functions with city_color=None should match non-city versions
        let def = get_enemy("prowlers").unwrap();
        let (dmg, elem, swift) = get_enemy_attack_info(def, 0);
        let (dmg_c, elem_c, swift_c) = get_enemy_attack_info_with_city(def, 0, None);
        assert_eq!((dmg, elem, swift), (dmg_c, elem_c, swift_c));

        let armor = get_effective_armor(def, CombatPhase::Block, 0, 0);
        let armor_c = get_effective_armor_with_city(def, CombatPhase::Block, 0, 0, None);
        assert_eq!(armor, armor_c);
    }

    /// Helper to make a test CombatEnemy with reasonable defaults.
    fn make_test_enemy(enemy_id: &str) -> CombatEnemy {
        let def = get_enemy(enemy_id).unwrap();
        let num_attacks = if let Some(attacks) = def.attacks { attacks.len() } else { 1 };
        CombatEnemy {
            instance_id: CombatInstanceId::from("enemy_0"),
            enemy_id: EnemyId::from(enemy_id),
            is_blocked: false,
            is_defeated: false,
            damage_assigned: false,
            is_required_for_conquest: true,
            summoned_by_instance_id: None,
            is_summoner_hidden: false,
            attacks_blocked: vec![false; num_attacks],
            attacks_damage_assigned: vec![false; num_attacks],
            attacks_cancelled: vec![false; num_attacks],
        }
    }
}
