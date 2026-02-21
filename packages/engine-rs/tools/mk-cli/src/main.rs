use std::env;
use std::io::{self, Write};

use dialoguer::{theme::ColorfulTheme, Select};

use mk_data::cards::get_card;
use mk_data::enemies::get_enemy;
use mk_data::units::get_unit;
use mk_engine::action_pipeline::apply_legal_action;
use mk_engine::legal_actions::enumerate_legal_actions_with_undo;
use mk_engine::setup::create_solo_game;
use mk_engine::undo::UndoStack;
use mk_types::effect::CardEffect;
use mk_types::enums::*;
use mk_types::legal_action::{LegalAction, TacticDecisionData};
use mk_types::pending::ActivePending;
use mk_types::state::*;

const HEROES: [(&str, Hero); 7] = [
    ("Arythea", Hero::Arythea),
    ("Tovak", Hero::Tovak),
    ("Goldyx", Hero::Goldyx),
    ("Norowas", Hero::Norowas),
    ("Wolfhawk", Hero::Wolfhawk),
    ("Krang", Hero::Krang),
    ("Braevalar", Hero::Braevalar),
];

fn parse_args() -> (Hero, &'static str, u32) {
    let args: Vec<String> = env::args().collect();
    let mut hero: Option<(Hero, &'static str)> = None;
    let mut seed: Option<u32> = None;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--hero" | "-h" => {
                i += 1;
                if i < args.len() {
                    let name = args[i].to_lowercase();
                    for &(hname, h) in &HEROES {
                        if hname.to_lowercase() == name {
                            hero = Some((h, hname));
                            break;
                        }
                    }
                }
            }
            "--seed" | "-s" => {
                i += 1;
                if i < args.len() {
                    seed = args[i].parse().ok();
                }
            }
            _ => {}
        }
        i += 1;
    }
    (
        hero.map(|(h, _)| h).unwrap_or(Hero::Arythea),
        hero.map(|(_, n)| n).unwrap_or("Arythea"),
        seed.unwrap_or(42),
    )
}

fn main() {
    println!("\n  =============================");
    println!("    M A G E   K N I G H T");
    println!("  =============================\n");

    // Check if we're in an interactive terminal
    let is_tty = is_terminal();

    let (hero, hero_name, seed) = if is_tty {
        let hero_names: Vec<&str> = HEROES.iter().map(|(n, _)| *n).collect();
        let hero_idx = Select::with_theme(&ColorfulTheme::default())
            .with_prompt("Choose your hero")
            .items(&hero_names)
            .default(0)
            .interact()
            .unwrap();
        let (hname, h) = HEROES[hero_idx];

        print!("Enter seed (or Enter for 42): ");
        io::stdout().flush().unwrap();
        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();
        let s: u32 = input.trim().parse().unwrap_or(42);
        (h, hname, s)
    } else {
        parse_args()
    };

    let mut state = create_solo_game(seed, hero);
    let mut undo = UndoStack::new();
    let player_idx = 0;

    println!("\n  {} playing as {}, seed {}\n", ">>", hero_name, seed);

    loop {
        if state.game_ended {
            println!("\n  === GAME OVER ===");
            display_score(&state);
            break;
        }

        display_state(&state, player_idx);

        let action_set = enumerate_legal_actions_with_undo(&state, player_idx, &undo);

        if action_set.actions.is_empty() {
            println!("  No legal actions available!");
            break;
        }

        let action_strings: Vec<String> = action_set
            .actions
            .iter()
            .map(|a| format_action(a, &state, player_idx))
            .collect();

        let selection = Select::with_theme(&ColorfulTheme::default())
            .with_prompt(format!("{} actions", action_strings.len()))
            .items(&action_strings)
            .default(0)
            .interact_opt()
            .unwrap();

        let Some(idx) = selection else {
            println!("\n  Goodbye!");
            break;
        };

        let action = action_set.actions[idx].clone();
        let epoch = action_set.epoch;

        match apply_legal_action(&mut state, &mut undo, player_idx, &action, epoch) {
            Ok(result) => {
                if result.game_ended {
                    println!("\n  === GAME OVER ===");
                    display_score(&state);
                    break;
                }
            }
            Err(e) => {
                println!("  ERROR: {:?}", e);
            }
        }
    }
}

// =============================================================================
// State display
// =============================================================================

fn display_state(state: &GameState, player_idx: usize) {
    let player = &state.players[player_idx];
    let time = match state.time_of_day {
        TimeOfDay::Day => "Day",
        TimeOfDay::Night => "Night",
    };

    println!("  ─────────────────────────────────────────");
    println!(
        "  Round {} | {} | Turn {}",
        state.round, time, state.current_player_index + 1
    );
    println!(
        "  Lv{} | Fame {} | Rep {} | Armor {}",
        player.level, player.fame, player.reputation, player.armor
    );

    if let Some(pos) = player.position {
        let terrain = state
            .map
            .hexes
            .get(&pos.key())
            .map(|h| format!("{:?}", h.terrain))
            .unwrap_or_else(|| "?".into());
        println!("  Position: ({},{}) {}", pos.q, pos.r, terrain);
    }

    // Resources
    let mut res = Vec::new();
    if player.move_points > 0 {
        res.push(format!("Move:{}", player.move_points));
    }
    if player.influence_points > 0 {
        res.push(format!("Influence:{}", player.influence_points));
    }
    if player.healing_points > 0 {
        res.push(format!("Heal:{}", player.healing_points));
    }
    if !res.is_empty() {
        println!("  {}", res.join("  "));
    }

    // Crystals
    let c = &player.crystals;
    if c.red + c.blue + c.green + c.white > 0 {
        println!(
            "  Crystals: R:{} B:{} G:{} W:{}",
            c.red, c.blue, c.green, c.white
        );
    }

    // Mana tokens
    if !player.pure_mana.is_empty() {
        let tokens: Vec<String> = player.pure_mana.iter().map(|t| mana_color_str(t.color)).collect();
        println!("  Mana tokens: {}", tokens.join(", "));
    }

    // Hand
    println!("  ── Hand ({}) ──", player.hand.len());
    for (i, card_id) in player.hand.iter().enumerate() {
        println!("    {}. {}", i + 1, card_display(card_id.as_str()));
    }

    // Play area
    if !player.play_area.is_empty() {
        let played: Vec<String> = player
            .play_area
            .iter()
            .map(|c| card_name(c.as_str()))
            .collect();
        println!("  Played: {}", played.join(", "));
    }

    // Units
    if !player.units.is_empty() {
        println!("  ── Units ──");
        for u in player.units.iter() {
            let name = get_unit(u.unit_id.as_str())
                .map(|d| d.name)
                .unwrap_or("?");
            let status = match (u.state, u.wounded) {
                (UnitState::Ready, false) => "Ready",
                (UnitState::Ready, true) => "Ready (wounded)",
                (UnitState::Spent, false) => "Spent",
                (UnitState::Spent, true) => "Spent (wounded)",
            };
            println!("    {} [{}]", name, status);
        }
    }

    // Mana source
    let available: Vec<String> = state
        .source
        .dice
        .iter()
        .filter(|d| !d.is_depleted && d.taken_by_player_id.is_none())
        .map(|d| mana_color_str(d.color))
        .collect();
    if !available.is_empty() {
        println!("  Source: {}", available.join(" "));
    }

    // Combat
    if let Some(ref combat) = state.combat {
        display_combat(combat);
    }

    // Pending
    if let Some(ref active) = player.pending.active {
        println!("  ── Pending: {} ──", pending_label(active));
    }

    // Tactic
    if let Some(ref tactic) = player.selected_tactic {
        let flipped = if player.flags.contains(PlayerFlags::TACTIC_FLIPPED) {
            " (flipped)"
        } else {
            ""
        };
        println!("  Tactic: {}{}", tactic_display(tactic.as_str()), flipped);
    }

    println!();
}

fn display_combat(combat: &CombatState) {
    let phase = match combat.phase {
        CombatPhase::RangedSiege => "Ranged/Siege",
        CombatPhase::Block => "Block",
        CombatPhase::AssignDamage => "Assign Damage",
        CombatPhase::Attack => "Attack",
    };
    println!("  ── Combat: {} ──", phase);
    for enemy in &combat.enemies {
        if enemy.is_defeated {
            continue;
        }
        if enemy.is_summoner_hidden {
            continue;
        }
        let def = get_enemy(enemy.enemy_id.as_str());
        let name = def.map(|d| d.name).unwrap_or("???");
        let armor = def.map(|d| d.armor).unwrap_or(0);
        let atk = def.map(|d| d.attack).unwrap_or(0);
        let elem = def
            .map(|d| element_str(d.attack_element))
            .unwrap_or("?");
        let blocked = if enemy.is_blocked { " [blocked]" } else { "" };
        println!(
            "    {} (atk:{} {} / armor:{}){}", name, atk, elem, armor, blocked
        );
    }
}

fn display_score(state: &GameState) {
    for p in &state.players {
        println!(
            "  {} - Fame: {}, Level: {}, Rep: {}",
            p.hero_name(),
            p.fame,
            p.level,
            p.reputation
        );
    }
}

// =============================================================================
// Action formatting
// =============================================================================

fn format_action(action: &LegalAction, state: &GameState, player_idx: usize) -> String {
    match action {
        LegalAction::SelectTactic { tactic_id } => {
            format!("Select tactic: {}", tactic_display(tactic_id.as_str()))
        }
        LegalAction::PlayCardBasic { card_id, .. } => {
            format!("Play {} (basic)", card_name(card_id.as_str()))
        }
        LegalAction::PlayCardPowered {
            card_id,
            mana_color,
            ..
        } => {
            format!(
                "Play {} (powered, {} mana)",
                card_name(card_id.as_str()),
                basic_color_str(*mana_color)
            )
        }
        LegalAction::PlayCardSideways {
            card_id,
            sideways_as,
            ..
        } => {
            let as_str = match sideways_as {
                SidewaysAs::Move => "Move 1",
                SidewaysAs::Influence => "Influence 1",
                SidewaysAs::Attack => "Attack 1",
                SidewaysAs::Block => "Block 1",
            };
            format!(
                "Play {} sideways as {}",
                card_name(card_id.as_str()),
                as_str
            )
        }
        LegalAction::Move { target, cost } => {
            let terrain = state
                .map
                .hexes
                .get(&target.key())
                .map(|h| format!("{:?}", h.terrain))
                .unwrap_or_else(|| "?".into());
            format!("Move to ({},{}) {} [cost:{}]", target.q, target.r, terrain, cost)
        }
        LegalAction::Explore { direction } => {
            format!("Explore {:?}", direction)
        }
        LegalAction::ResolveChoice { choice_index } => {
            format_resolve_choice(*choice_index, state, player_idx)
        }
        LegalAction::ResolveDiscardForBonus {
            choice_index,
            discard_count,
        } => {
            format!("Discard {} cards (option {})", discard_count, choice_index + 1)
        }
        LegalAction::ResolveDecompose { hand_index } => {
            let player = &state.players[player_idx];
            let name = player
                .hand
                .get(*hand_index)
                .map(|c| card_name(c.as_str()))
                .unwrap_or_else(|| "?".into());
            format!("Decompose {}", name)
        }
        LegalAction::ChallengeRampaging { hex } => {
            format!("Challenge rampaging enemies at ({},{})", hex.q, hex.r)
        }
        LegalAction::DeclareBlock {
            enemy_instance_id,
            attack_index,
        } => {
            let enemy_name = combat_enemy_name(state, enemy_instance_id.as_str());
            format!("Block {} attack #{}", enemy_name, attack_index + 1)
        }
        LegalAction::DeclareAttack {
            target_instance_ids,
            attack_type,
        } => {
            let targets: Vec<String> = target_instance_ids
                .iter()
                .map(|id| combat_enemy_name(state, id.as_str()))
                .collect();
            let atype = match attack_type {
                CombatType::Melee => "melee",
                CombatType::Ranged => "ranged",
                CombatType::Siege => "siege",
            };
            format!("Attack [{}] ({})", targets.join(", "), atype)
        }
        LegalAction::SpendMoveOnCumbersome { enemy_instance_id } => {
            let name = combat_enemy_name(state, enemy_instance_id.as_str());
            format!("Spend move on {} (cumbersome)", name)
        }
        LegalAction::ResolveTacticDecision { data } => format_tactic_decision(data),
        LegalAction::ActivateTactic => "Activate tactic".into(),
        LegalAction::RerollSourceDice { die_indices } => {
            let colors: Vec<String> = die_indices
                .iter()
                .filter_map(|&i| state.source.dice.get(i))
                .map(|d| mana_color_str(d.color))
                .collect();
            format!("Reroll source dice: {}", colors.join(", "))
        }
        LegalAction::EnterSite => {
            let site_name = player_site_name(state, player_idx);
            format!("Enter {}", site_name)
        }
        LegalAction::InteractSite { healing } => {
            format!("Interact with site (heal {} wounds)", healing)
        }
        LegalAction::PlunderSite => "Plunder site".into(),
        LegalAction::DeclinePlunder => "Decline plunder".into(),
        LegalAction::ResolveGladeWound { choice } => {
            format!("Remove wound from {:?}", choice)
        }
        LegalAction::RecruitUnit {
            unit_id,
            influence_cost,
            ..
        } => {
            let name = get_unit(unit_id.as_str())
                .map(|d| d.name)
                .unwrap_or("?");
            format!("Recruit {} (cost: {} influence)", name, influence_cost)
        }
        LegalAction::ActivateUnit {
            unit_instance_id,
            ability_index,
        } => format_activate_unit(state, player_idx, unit_instance_id.as_str(), *ability_index),
        LegalAction::UseSkill { skill_id } => {
            format!("Use skill: {}", skill_id.as_str())
        }
        LegalAction::ChooseLevelUpReward {
            skill_index,
            from_common_pool,
            advanced_action_id,
        } => {
            let source = if *from_common_pool { "common" } else { "drawn" };
            format!(
                "Level up: skill #{} ({}) + AA {}",
                skill_index + 1,
                source,
                card_name(advanced_action_id.as_str())
            )
        }
        LegalAction::EndTurn => "End turn".into(),
        LegalAction::DeclareRest => "Declare rest".into(),
        LegalAction::CompleteRest {
            discard_hand_index,
        } => match discard_hand_index {
            Some(idx) => {
                let player = &state.players[player_idx];
                let name = player
                    .hand
                    .get(*idx)
                    .map(|c| card_name(c.as_str()))
                    .unwrap_or_else(|| "?".into());
                format!("Complete rest (discard {})", name)
            }
            None => "Complete rest".into(),
        },
        LegalAction::EndCombatPhase => "End combat phase".into(),
        LegalAction::AssignDamageToHero { enemy_index, attack_index } => {
            format!("Assign damage to hero (enemy {}, attack {})", enemy_index, attack_index)
        }
        LegalAction::AssignDamageToUnit { enemy_index, attack_index, unit_instance_id } => {
            format!("Assign damage to unit {} (enemy {}, attack {})", unit_instance_id.as_str(), enemy_index, attack_index)
        }
        LegalAction::Undo => "Undo".into(),
    }
}

fn format_resolve_choice(
    choice_index: usize,
    state: &GameState,
    player_idx: usize,
) -> String {
    let player = &state.players[player_idx];
    if let Some(ActivePending::Choice(ref choice)) = player.pending.active {
        if let Some(effect) = choice.options.get(choice_index) {
            return format!("Choose: {}", effect_summary(effect));
        }
    }
    if let Some(ActivePending::UnitAbilityChoice { ref options, .. }) = player.pending.active {
        if let Some(opt) = options.get(choice_index) {
            return format!("Choose: {:?}", opt);
        }
    }
    if let Some(ActivePending::DeepMineChoice { ref colors }) = player.pending.active {
        if let Some(color) = colors.get(choice_index) {
            return format!("Choose {} crystal", basic_color_str(*color));
        }
    }
    format!("Choose option {}", choice_index + 1)
}

fn format_tactic_decision(data: &TacticDecisionData) -> String {
    match data {
        TacticDecisionData::Rethink { hand_indices } => {
            format!("Rethink: swap cards {:?}", hand_indices)
        }
        TacticDecisionData::ManaSteal { die_index } => {
            format!("Mana Steal: take die #{}", die_index + 1)
        }
        TacticDecisionData::Preparation { deck_card_index } => {
            format!("Preparation: take deck card #{}", deck_card_index + 1)
        }
        TacticDecisionData::MidnightMeditation { hand_indices } => {
            format!("Midnight Meditation: swap cards {:?}", hand_indices)
        }
        TacticDecisionData::SparingPowerStash => "Sparing Power: stash top card".into(),
        TacticDecisionData::SparingPowerTake => "Sparing Power: take all stored cards".into(),
    }
}

fn format_activate_unit(
    state: &GameState,
    player_idx: usize,
    instance_id: &str,
    ability_index: usize,
) -> String {
    let player = &state.players[player_idx];
    let unit = player.units.iter().find(|u| u.instance_id.as_str() == instance_id);
    if let Some(unit) = unit {
        let def = get_unit(unit.unit_id.as_str());
        let name = def.map(|d| d.name).unwrap_or("?");
        if let Some(def) = def {
            if let Some(slot) = def.abilities.get(ability_index) {
                let cost = slot
                    .mana_cost
                    .map(|c| format!(" [{}]", basic_color_str(c)))
                    .unwrap_or_default();
                return format!("{}: {}{}", name, unit_ability_str(&slot.ability), cost);
            }
        }
        return format!("{}: ability #{}", name, ability_index + 1);
    }
    format!("Activate unit ability #{}", ability_index + 1)
}

// =============================================================================
// Helpers
// =============================================================================

fn card_name(id: &str) -> String {
    if id == "wound" {
        return "Wound".into();
    }
    get_card(id)
        .map(|c| c.name.to_string())
        .unwrap_or_else(|| titlecase(id))
}

fn card_display(id: &str) -> String {
    if id == "wound" {
        return "Wound".into();
    }
    let def = get_card(id);
    match def {
        Some(c) => {
            let color = match c.color {
                CardColor::Red => "R",
                CardColor::Blue => "B",
                CardColor::Green => "G",
                CardColor::White => "W",
                CardColor::Wound => "wound",
            };
            format!("{} ({})", c.name, color)
        }
        None => titlecase(id),
    }
}

fn titlecase(s: &str) -> String {
    s.split('_')
        .map(|w| {
            let mut chars = w.chars();
            match chars.next() {
                None => String::new(),
                Some(c) => c.to_uppercase().to_string() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn mana_color_str(c: ManaColor) -> String {
    match c {
        ManaColor::Red => "Red".into(),
        ManaColor::Blue => "Blue".into(),
        ManaColor::Green => "Green".into(),
        ManaColor::White => "White".into(),
        ManaColor::Gold => "Gold".into(),
        ManaColor::Black => "Black".into(),
    }
}

fn basic_color_str(c: BasicManaColor) -> &'static str {
    match c {
        BasicManaColor::Red => "Red",
        BasicManaColor::Blue => "Blue",
        BasicManaColor::Green => "Green",
        BasicManaColor::White => "White",
    }
}

fn element_str(e: Element) -> &'static str {
    match e {
        Element::Physical => "physical",
        Element::Fire => "fire",
        Element::Ice => "ice",
        Element::ColdFire => "cold-fire",
    }
}

fn tactic_display(id: &str) -> String {
    titlecase(id)
}

fn combat_enemy_name(state: &GameState, instance_id: &str) -> String {
    if let Some(ref combat) = state.combat {
        for enemy in &combat.enemies {
            if enemy.instance_id.as_str() == instance_id {
                return get_enemy(enemy.enemy_id.as_str())
                    .map(|d| d.name.to_string())
                    .unwrap_or_else(|| "???".into());
            }
        }
    }
    "???".into()
}

fn player_site_name(state: &GameState, player_idx: usize) -> String {
    let player = &state.players[player_idx];
    if let Some(pos) = player.position {
        if let Some(hex) = state.map.hexes.get(&pos.key()) {
            if let Some(ref site) = hex.site {
                return format!("{:?}", site.site_type);
            }
        }
    }
    "site".into()
}

fn pending_label(active: &ActivePending) -> &'static str {
    match active {
        ActivePending::Choice(_) => "Choose an option",
        ActivePending::Discard(_) => "Discard cards",
        ActivePending::DiscardForAttack(_) => "Discard for attack",
        ActivePending::DiscardForBonus(_) => "Discard for bonus",
        ActivePending::DiscardForCrystal(_) => "Discard for crystal",
        ActivePending::Decompose(_) => "Decompose a card",
        ActivePending::MaximalEffect(_) => "Maximal effect choice",
        ActivePending::BookOfWisdom(_) => "Book of Wisdom",
        ActivePending::Training(_) => "Training",
        ActivePending::TacticDecision(_) => "Tactic decision",
        ActivePending::LevelUpReward(_) => "Level-up reward",
        ActivePending::DeepMineChoice { .. } => "Deep mine crystal",
        ActivePending::GladeWoundChoice => "Glade wound location",
        ActivePending::BannerProtectionChoice => "Banner protection",
        ActivePending::SourceOpeningReroll { .. } => "Source opening reroll",
        ActivePending::Meditation(_) => "Meditation",
        ActivePending::PlunderDecision => "Plunder decision",
        ActivePending::UnitMaintenance(_) => "Unit maintenance",
        ActivePending::TerrainCostReduction(_) => "Terrain cost reduction",
        ActivePending::CrystalJoyReclaim(_) => "Crystal joy reclaim",
        ActivePending::SteadyTempoDeckPlacement(_) => "Steady tempo placement",
        ActivePending::UnitAbilityChoice { .. } => "Unit ability choice",
        ActivePending::SelectCombatEnemy { .. } => "Select combat enemy",
    }
}

fn effect_summary(effect: &CardEffect) -> String {
    match effect {
        CardEffect::GainMove { amount } => format!("Move {}", amount),
        CardEffect::GainInfluence { amount } => format!("Influence {}", amount),
        CardEffect::GainAttack {
            amount,
            combat_type,
            element,
        } => {
            let ct = match combat_type {
                CombatType::Melee => "",
                CombatType::Ranged => "ranged ",
                CombatType::Siege => "siege ",
            };
            format!("{}Attack {} {}", ct, amount, element_str(*element))
        }
        CardEffect::GainBlock { amount, element } => {
            format!("Block {} {}", amount, element_str(*element))
        }
        CardEffect::GainHealing { amount } => format!("Heal {}", amount),
        CardEffect::GainMana { color, amount } => {
            format!("Gain {} {} mana", amount, mana_color_str(*color))
        }
        CardEffect::DrawCards { count } => format!("Draw {} cards", count),
        CardEffect::GainFame { amount } => format!("Gain {} fame", amount),
        CardEffect::ChangeReputation { amount } => format!("Rep {:+}", amount),
        CardEffect::GainCrystal { color } => match color {
            Some(c) => format!("Gain {} crystal", basic_color_str(*c)),
            None => "Gain crystal".into(),
        },
        CardEffect::TakeWound => "Take wound".into(),
        CardEffect::ConvertManaToCrystal => "Crystallize".into(),
        CardEffect::Noop => "Nothing".into(),
        _ => format!("{:?}", effect),
    }
}

fn unit_ability_str(ability: &mk_data::units::UnitAbility) -> String {
    use mk_data::units::UnitAbility;
    match ability {
        UnitAbility::Attack { value, element } => {
            format!("Attack {} {}", value, element_str(*element))
        }
        UnitAbility::Block { value, element } => {
            format!("Block {} {}", value, element_str(*element))
        }
        UnitAbility::RangedAttack { value, element } => {
            format!("Ranged {} {}", value, element_str(*element))
        }
        UnitAbility::SiegeAttack { value, element } => {
            format!("Siege {} {}", value, element_str(*element))
        }
        UnitAbility::Move { value } => format!("Move {}", value),
        UnitAbility::Influence { value } => format!("Influence {}", value),
        UnitAbility::Heal { value } => format!("Heal {}", value),
        UnitAbility::GainMana { color } => format!("{} mana", basic_color_str(*color)),
        UnitAbility::GainCrystal { color } => format!("{} crystal", basic_color_str(*color)),
        UnitAbility::GainManaAndCrystal { color } => {
            format!("{} mana + crystal", basic_color_str(*color))
        }
        UnitAbility::AttackWithRepCost {
            value,
            element,
            rep_change,
        } => format!("Attack {} {} (rep {:+})", value, element_str(*element), rep_change),
        UnitAbility::InfluenceWithRepCost { value, rep_change } => {
            format!("Influence {} (rep {:+})", value, rep_change)
        }
        UnitAbility::MoveOrInfluence { value } => format!("Move or Influence {}", value),
        UnitAbility::AttackOrBlockWoundSelf { value, element } => {
            format!("Attack/Block {} {} (wound self)", value, element_str(*element))
        }
        UnitAbility::ReadyUnit { max_level } => format!("Ready unit (lv<={})", max_level),
        UnitAbility::GrantAllResistances => "Grant all resistances".into(),
        UnitAbility::SelectCombatEnemy(_) => "Target enemy ability".into(),
        UnitAbility::CoordinatedFire {
            ranged_value,
            element,
            ..
        } => format!("Ranged {} {} + unit bonus", ranged_value, element_str(*element)),
        UnitAbility::MoveWithTerrainReduction { move_value, .. } => {
            format!("Move {} + terrain reduction", move_value)
        }
        UnitAbility::Other { description } => description.to_string(),
    }
}

fn is_terminal() -> bool {
    dialoguer::console::Term::stderr().is_term()
}

// Helper: PlayerState doesn't have hero_name, derive from hero enum
trait HeroName {
    fn hero_name(&self) -> &'static str;
}

impl HeroName for PlayerState {
    fn hero_name(&self) -> &'static str {
        match self.hero {
            Hero::Arythea => "Arythea",
            Hero::Tovak => "Tovak",
            Hero::Goldyx => "Goldyx",
            Hero::Norowas => "Norowas",
            Hero::Wolfhawk => "Wolfhawk",
            Hero::Krang => "Krang",
            Hero::Braevalar => "Braevalar",
        }
    }
}
