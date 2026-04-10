//! Batched output from VecEnv encoding — pre-padded arrays ready for numpy export.
//!
//! This module contains both the MK-specific `BatchOutput` struct (used directly
//! by mk-python for efficient numpy conversion) and the `MkBatchPacker` that
//! implements the generic `rl_core::BatchPacker` trait.

use mk_features::{
    EncodedStep, ACTION_SCALAR_DIM, COMBAT_ENEMY_SCALAR_DIM, HEX_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM, SITE_SCALAR_DIM, STATE_SCALAR_DIM, UNIT_SCALAR_DIM,
};
use rl_core::{BatchArrayF32, BatchArrayI32, BatchPacker, GenericBatchOutput};

/// Pre-padded batch output ready for zero-copy numpy export.
///
/// All variable-length dimensions are padded to the per-batch maximum.
/// Shapes use `N` = number of environments.
pub struct BatchOutput {
    pub num_envs: usize,

    // ── State features ─────────────────────────────────────────────
    pub state_scalars: Vec<f32>,
    pub state_ids: Vec<i32>,

    pub hand_card_ids: Vec<i32>,
    pub hand_counts: Vec<i32>,
    pub max_hand: usize,

    pub deck_card_ids: Vec<i32>,
    pub deck_counts: Vec<i32>,
    pub max_deck: usize,

    pub discard_card_ids: Vec<i32>,
    pub discard_counts: Vec<i32>,
    pub max_discard: usize,

    pub unit_ids: Vec<i32>,
    pub unit_counts: Vec<i32>,
    pub max_units: usize,
    pub unit_scalars: Vec<f32>,

    pub combat_enemy_ids: Vec<i32>,
    pub combat_enemy_counts: Vec<i32>,
    pub max_combat_enemies: usize,
    pub combat_enemy_scalars: Vec<f32>,

    pub skill_ids: Vec<i32>,
    pub skill_counts: Vec<i32>,
    pub max_skills: usize,

    pub visible_site_ids: Vec<i32>,
    pub visible_site_counts: Vec<i32>,
    pub max_visible_sites: usize,
    pub visible_site_scalars: Vec<f32>,

    pub map_enemy_ids: Vec<i32>,
    pub map_enemy_counts: Vec<i32>,
    pub max_map_enemies: usize,
    pub map_enemy_scalars: Vec<f32>,

    pub revealed_hex_terrain_ids: Vec<i32>,
    pub revealed_hex_counts: Vec<i32>,
    pub max_revealed_hexes: usize,
    pub revealed_hex_scalars: Vec<f32>,

    // ── Action features ────────────────────────────────────────────
    pub action_ids: Vec<i32>,
    pub action_scalars: Vec<f32>,
    pub action_counts: Vec<i32>,
    pub max_actions: usize,

    pub action_target_offsets: Vec<i32>,
    pub action_target_ids: Vec<i32>,

    pub fames: Vec<i32>,
}

impl BatchOutput {
    /// Pack N `EncodedStep`s into a pre-padded `BatchOutput`.
    pub fn pack(steps: &[EncodedStep], fames: &[i32]) -> Self {
        let n = steps.len();

        // ── Pass 1: compute per-batch max sizes ────────────────────
        let mut max_hand = 0usize;
        let mut max_deck = 0usize;
        let mut max_discard = 0usize;
        let mut max_units = 0usize;
        let mut max_combat_enemies = 0usize;
        let mut max_skills = 0usize;
        let mut max_visible_sites = 0usize;
        let mut max_map_enemies = 0usize;
        let mut max_revealed_hexes = 0usize;
        let mut max_actions = 0usize;

        for step in steps {
            let s = &step.state;
            max_hand = max_hand.max(s.hand_card_ids.len());
            max_deck = max_deck.max(s.deck_card_ids.len());
            max_discard = max_discard.max(s.discard_card_ids.len());
            max_units = max_units.max(s.unit_ids.len());
            max_combat_enemies = max_combat_enemies.max(s.combat_enemy_ids.len());
            max_skills = max_skills.max(s.skill_ids.len());
            max_visible_sites = max_visible_sites.max(s.visible_site_ids.len());
            max_map_enemies = max_map_enemies.max(s.map_enemy_ids.len());
            max_revealed_hexes = max_revealed_hexes.max(s.revealed_hex_terrain_ids.len());
            max_actions = max_actions.max(step.actions.len());
        }

        let max_hand = max_hand.max(1);
        let max_deck = max_deck.max(1);
        let max_discard = max_discard.max(1);
        let max_units = max_units.max(1);
        let max_combat_enemies = max_combat_enemies.max(1);
        let max_skills = max_skills.max(1);
        let max_visible_sites = max_visible_sites.max(1);
        let max_map_enemies = max_map_enemies.max(1);
        let max_revealed_hexes = max_revealed_hexes.max(1);
        let max_actions = max_actions.max(1);

        // ── Pass 2: allocate and fill ──────────────────────────────
        let state_scalar_dim = steps.first().map_or(STATE_SCALAR_DIM, |s| s.state.scalars.len());

        let mut state_scalars = vec![0.0f32; n * state_scalar_dim];
        let mut state_ids = vec![0i32; n * 3];

        let mut hand_card_ids_buf = vec![0i32; n * max_hand];
        let mut hand_counts = Vec::with_capacity(n);

        let mut deck_card_ids_buf = vec![0i32; n * max_deck];
        let mut deck_counts = Vec::with_capacity(n);

        let mut discard_card_ids_buf = vec![0i32; n * max_discard];
        let mut discard_counts = Vec::with_capacity(n);

        let mut unit_ids_buf = vec![0i32; n * max_units];
        let mut unit_counts = Vec::with_capacity(n);
        let mut unit_scalars_buf = vec![0.0f32; n * max_units * UNIT_SCALAR_DIM];

        let mut combat_enemy_ids_buf = vec![0i32; n * max_combat_enemies];
        let mut combat_enemy_counts = Vec::with_capacity(n);
        let mut combat_enemy_scalars_buf =
            vec![0.0f32; n * max_combat_enemies * COMBAT_ENEMY_SCALAR_DIM];

        let mut skill_ids_buf = vec![0i32; n * max_skills];
        let mut skill_counts = Vec::with_capacity(n);

        let mut visible_site_ids_buf = vec![0i32; n * max_visible_sites];
        let mut visible_site_counts = Vec::with_capacity(n);
        let mut visible_site_scalars_buf =
            vec![0.0f32; n * max_visible_sites * SITE_SCALAR_DIM];

        let mut map_enemy_ids_buf = vec![0i32; n * max_map_enemies];
        let mut map_enemy_counts = Vec::with_capacity(n);
        let mut map_enemy_scalars_buf =
            vec![0.0f32; n * max_map_enemies * MAP_ENEMY_SCALAR_DIM];

        let mut revealed_hex_terrain_ids_buf = vec![0i32; n * max_revealed_hexes];
        let mut revealed_hex_counts = Vec::with_capacity(n);
        let mut revealed_hex_scalars_buf =
            vec![0.0f32; n * max_revealed_hexes * HEX_SCALAR_DIM];

        let mut action_ids_buf = vec![0i32; n * max_actions * 6];
        let mut action_scalars_buf = vec![0.0f32; n * max_actions * ACTION_SCALAR_DIM];
        let mut action_counts_buf = Vec::with_capacity(n);

        let mut action_target_offsets_buf = vec![0i32; n * (max_actions + 1)];
        let mut action_target_ids_buf = Vec::new();

        for (i, step) in steps.iter().enumerate() {
            let s = &step.state;

            // State scalars
            let ss_offset = i * state_scalar_dim;
            state_scalars[ss_offset..ss_offset + s.scalars.len()]
                .copy_from_slice(&s.scalars);

            // State IDs
            state_ids[i * 3] = s.mode_id as i32;
            state_ids[i * 3 + 1] = s.current_terrain_id as i32;
            state_ids[i * 3 + 2] = s.current_site_type_id as i32;

            // Hand cards
            let hc = s.hand_card_ids.len();
            hand_counts.push(hc as i32);
            let h_off = i * max_hand;
            for (j, &id) in s.hand_card_ids.iter().enumerate() {
                hand_card_ids_buf[h_off + j] = id as i32;
            }

            // Deck cards
            let dc = s.deck_card_ids.len();
            deck_counts.push(dc as i32);
            let d_off = i * max_deck;
            for (j, &id) in s.deck_card_ids.iter().enumerate() {
                deck_card_ids_buf[d_off + j] = id as i32;
            }

            // Discard cards
            let dcc = s.discard_card_ids.len();
            discard_counts.push(dcc as i32);
            let dc_off = i * max_discard;
            for (j, &id) in s.discard_card_ids.iter().enumerate() {
                discard_card_ids_buf[dc_off + j] = id as i32;
            }

            // Units
            let uc = s.unit_ids.len();
            unit_counts.push(uc as i32);
            let u_off = i * max_units;
            for (j, &id) in s.unit_ids.iter().enumerate() {
                unit_ids_buf[u_off + j] = id as i32;
            }
            let us_off = i * max_units * UNIT_SCALAR_DIM;
            for (j, scalars) in s.unit_scalars.iter().enumerate() {
                let row = us_off + j * UNIT_SCALAR_DIM;
                unit_scalars_buf[row..row + UNIT_SCALAR_DIM]
                    .copy_from_slice(scalars);
            }

            // Combat enemies
            let ce = s.combat_enemy_ids.len();
            combat_enemy_counts.push(ce as i32);
            let ce_off = i * max_combat_enemies;
            for (j, &id) in s.combat_enemy_ids.iter().enumerate() {
                combat_enemy_ids_buf[ce_off + j] = id as i32;
            }
            let ces_off = i * max_combat_enemies * COMBAT_ENEMY_SCALAR_DIM;
            for (j, scalars) in s.combat_enemy_scalars.iter().enumerate() {
                let row = ces_off + j * COMBAT_ENEMY_SCALAR_DIM;
                combat_enemy_scalars_buf[row..row + COMBAT_ENEMY_SCALAR_DIM]
                    .copy_from_slice(scalars);
            }

            // Skills
            let sk = s.skill_ids.len();
            skill_counts.push(sk as i32);
            let sk_off = i * max_skills;
            for (j, &id) in s.skill_ids.iter().enumerate() {
                skill_ids_buf[sk_off + j] = id as i32;
            }

            // Visible sites
            let vs = s.visible_site_ids.len();
            visible_site_counts.push(vs as i32);
            let vs_off = i * max_visible_sites;
            for (j, &id) in s.visible_site_ids.iter().enumerate() {
                visible_site_ids_buf[vs_off + j] = id as i32;
            }
            let vss_off = i * max_visible_sites * SITE_SCALAR_DIM;
            for (j, scalars) in s.visible_site_scalars.iter().enumerate() {
                let row = vss_off + j * SITE_SCALAR_DIM;
                visible_site_scalars_buf[row..row + SITE_SCALAR_DIM]
                    .copy_from_slice(scalars);
            }

            // Map enemies
            let me = s.map_enemy_ids.len();
            map_enemy_counts.push(me as i32);
            let me_off = i * max_map_enemies;
            for (j, &id) in s.map_enemy_ids.iter().enumerate() {
                map_enemy_ids_buf[me_off + j] = id as i32;
            }
            let mes_off = i * max_map_enemies * MAP_ENEMY_SCALAR_DIM;
            for (j, scalars) in s.map_enemy_scalars.iter().enumerate() {
                let row = mes_off + j * MAP_ENEMY_SCALAR_DIM;
                map_enemy_scalars_buf[row..row + MAP_ENEMY_SCALAR_DIM]
                    .copy_from_slice(scalars);
            }

            // Revealed hexes
            let rh = s.revealed_hex_terrain_ids.len();
            revealed_hex_counts.push(rh as i32);
            let rh_off = i * max_revealed_hexes;
            for (j, &id) in s.revealed_hex_terrain_ids.iter().enumerate() {
                revealed_hex_terrain_ids_buf[rh_off + j] = id as i32;
            }
            let rhs_off = i * max_revealed_hexes * HEX_SCALAR_DIM;
            for (j, scalars) in s.revealed_hex_scalars.iter().enumerate() {
                let row = rhs_off + j * HEX_SCALAR_DIM;
                revealed_hex_scalars_buf[row..row + HEX_SCALAR_DIM]
                    .copy_from_slice(scalars);
            }

            // Actions
            let na = step.actions.len();
            action_counts_buf.push(na as i32);

            let a_id_off = i * max_actions * 6;
            let a_sc_off = i * max_actions * ACTION_SCALAR_DIM;
            let a_to_off = i * (max_actions + 1);

            let mut local_target_offset: i32 = action_target_ids_buf.len() as i32;

            for (j, action) in step.actions.iter().enumerate() {
                let id_row = a_id_off + j * 6;
                action_ids_buf[id_row] = action.action_type_id as i32;
                action_ids_buf[id_row + 1] = action.source_id as i32;
                action_ids_buf[id_row + 2] = action.card_id as i32;
                action_ids_buf[id_row + 3] = action.unit_id as i32;
                action_ids_buf[id_row + 4] = action.enemy_id as i32;
                action_ids_buf[id_row + 5] = action.skill_id as i32;

                let sc_row = a_sc_off + j * ACTION_SCALAR_DIM;
                action_scalars_buf[sc_row..sc_row + ACTION_SCALAR_DIM]
                    .copy_from_slice(&action.scalars);

                action_target_offsets_buf[a_to_off + j] = local_target_offset;
                for &tid in &action.target_enemy_ids {
                    action_target_ids_buf.push(tid as i32);
                }
                local_target_offset = action_target_ids_buf.len() as i32;
            }
            for j in na..=max_actions {
                action_target_offsets_buf[a_to_off + j] = local_target_offset;
            }
        }

        Self {
            num_envs: n,
            state_scalars,
            state_ids,
            hand_card_ids: hand_card_ids_buf,
            hand_counts,
            max_hand,
            deck_card_ids: deck_card_ids_buf,
            deck_counts,
            max_deck,
            discard_card_ids: discard_card_ids_buf,
            discard_counts,
            max_discard,
            unit_ids: unit_ids_buf,
            unit_counts,
            max_units,
            unit_scalars: unit_scalars_buf,
            combat_enemy_ids: combat_enemy_ids_buf,
            combat_enemy_counts,
            max_combat_enemies,
            combat_enemy_scalars: combat_enemy_scalars_buf,
            skill_ids: skill_ids_buf,
            skill_counts,
            max_skills,
            visible_site_ids: visible_site_ids_buf,
            visible_site_counts,
            max_visible_sites,
            visible_site_scalars: visible_site_scalars_buf,
            map_enemy_ids: map_enemy_ids_buf,
            map_enemy_counts,
            max_map_enemies,
            map_enemy_scalars: map_enemy_scalars_buf,
            revealed_hex_terrain_ids: revealed_hex_terrain_ids_buf,
            revealed_hex_counts,
            max_revealed_hexes,
            revealed_hex_scalars: revealed_hex_scalars_buf,
            action_ids: action_ids_buf,
            action_scalars: action_scalars_buf,
            action_counts: action_counts_buf,
            max_actions,
            action_target_offsets: action_target_offsets_buf,
            action_target_ids: action_target_ids_buf,
            fames: fames.to_vec(),
        }
    }

    /// Convert to generic batch output for the rl-core interface.
    pub fn to_generic(self) -> GenericBatchOutput {
        let n = self.num_envs;
        let state_scalar_dim = if n > 0 { self.state_scalars.len() / n } else { STATE_SCALAR_DIM };

        GenericBatchOutput {
            num_envs: n,
            arrays_f32: vec![
                BatchArrayF32 { name: "state_scalars", data: self.state_scalars, shape: vec![n, state_scalar_dim] },
                BatchArrayF32 { name: "unit_scalars", data: self.unit_scalars, shape: vec![n * self.max_units, UNIT_SCALAR_DIM] },
                BatchArrayF32 { name: "combat_enemy_scalars", data: self.combat_enemy_scalars, shape: vec![n * self.max_combat_enemies, COMBAT_ENEMY_SCALAR_DIM] },
                BatchArrayF32 { name: "visible_site_scalars", data: self.visible_site_scalars, shape: vec![n * self.max_visible_sites, SITE_SCALAR_DIM] },
                BatchArrayF32 { name: "map_enemy_scalars", data: self.map_enemy_scalars, shape: vec![n * self.max_map_enemies, MAP_ENEMY_SCALAR_DIM] },
                BatchArrayF32 { name: "revealed_hex_scalars", data: self.revealed_hex_scalars, shape: vec![n * self.max_revealed_hexes, HEX_SCALAR_DIM] },
                BatchArrayF32 { name: "action_scalars", data: self.action_scalars, shape: vec![n * self.max_actions, ACTION_SCALAR_DIM] },
            ],
            arrays_i32: vec![
                BatchArrayI32 { name: "state_ids", data: self.state_ids, shape: vec![n, 3] },
                BatchArrayI32 { name: "hand_card_ids", data: self.hand_card_ids, shape: vec![n, self.max_hand] },
                BatchArrayI32 { name: "deck_card_ids", data: self.deck_card_ids, shape: vec![n, self.max_deck] },
                BatchArrayI32 { name: "discard_card_ids", data: self.discard_card_ids, shape: vec![n, self.max_discard] },
                BatchArrayI32 { name: "unit_ids", data: self.unit_ids, shape: vec![n, self.max_units] },
                BatchArrayI32 { name: "combat_enemy_ids", data: self.combat_enemy_ids, shape: vec![n, self.max_combat_enemies] },
                BatchArrayI32 { name: "skill_ids", data: self.skill_ids, shape: vec![n, self.max_skills] },
                BatchArrayI32 { name: "visible_site_ids", data: self.visible_site_ids, shape: vec![n, self.max_visible_sites] },
                BatchArrayI32 { name: "map_enemy_ids", data: self.map_enemy_ids, shape: vec![n, self.max_map_enemies] },
                BatchArrayI32 { name: "revealed_hex_terrain_ids", data: self.revealed_hex_terrain_ids, shape: vec![n, self.max_revealed_hexes] },
                BatchArrayI32 { name: "action_ids", data: self.action_ids, shape: vec![n * self.max_actions, 6] },
                BatchArrayI32 { name: "action_target_offsets", data: self.action_target_offsets, shape: vec![n * (self.max_actions + 1)] },
                BatchArrayI32 { name: "action_target_ids", data: self.action_target_ids, shape: vec![] },
            ],
            scalars_i32: vec![
                ("hand_counts", self.hand_counts),
                ("deck_counts", self.deck_counts),
                ("discard_counts", self.discard_counts),
                ("unit_counts", self.unit_counts),
                ("combat_enemy_counts", self.combat_enemy_counts),
                ("skill_counts", self.skill_counts),
                ("visible_site_counts", self.visible_site_counts),
                ("map_enemy_counts", self.map_enemy_counts),
                ("revealed_hex_counts", self.revealed_hex_counts),
                ("action_counts", self.action_counts),
                ("fames", self.fames),
            ],
            scalars_usize: vec![("max_actions", self.max_actions)],
        }
    }
}

/// MK-specific batch packer implementing the rl-core `BatchPacker` trait.
pub struct MkBatchPacker;

impl BatchPacker for MkBatchPacker {
    type Encoded = EncodedStep;

    fn pack(steps: &[EncodedStep], extras: &[(&'static str, &[i32])]) -> GenericBatchOutput {
        // Extract fames from extras (first entry is always "fames")
        let fames = extras
            .iter()
            .find(|(name, _)| *name == "fames")
            .map(|(_, data)| *data)
            .unwrap_or(&[]);
        BatchOutput::pack(steps, fames).to_generic()
    }
}
