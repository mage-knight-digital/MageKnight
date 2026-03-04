//! Batched output from VecEnv encoding — pre-padded arrays ready for numpy export.

use mk_features::{
    EncodedStep, ACTION_SCALAR_DIM, COMBAT_ENEMY_SCALAR_DIM,
    MAP_ENEMY_SCALAR_DIM, SITE_SCALAR_DIM, STATE_SCALAR_DIM, UNIT_SCALAR_DIM,
};

/// Pre-padded batch output ready for zero-copy numpy export.
///
/// All variable-length dimensions are padded to the per-batch maximum.
/// Shapes use `N` = number of environments.
pub struct BatchOutput {
    pub num_envs: usize,

    // ── State features ─────────────────────────────────────────────
    /// (N, STATE_SCALAR_DIM) f32
    pub state_scalars: Vec<f32>,
    /// (N, 3) i32 — [mode_id, terrain_id, site_type_id]
    pub state_ids: Vec<i32>,

    /// (N, max_H) i32 — hand card IDs, 0-padded
    pub hand_card_ids: Vec<i32>,
    pub hand_counts: Vec<i32>,
    pub max_hand: usize,

    /// (N, max_D) i32 — deck card IDs, 0-padded
    pub deck_card_ids: Vec<i32>,
    pub deck_counts: Vec<i32>,
    pub max_deck: usize,

    /// (N, max_DC) i32 — discard card IDs, 0-padded
    pub discard_card_ids: Vec<i32>,
    pub discard_counts: Vec<i32>,
    pub max_discard: usize,

    /// (N, max_U) i32 — unit IDs, 0-padded
    pub unit_ids: Vec<i32>,
    pub unit_counts: Vec<i32>,
    pub max_units: usize,
    /// (N, max_U, UNIT_SCALAR_DIM) f32
    pub unit_scalars: Vec<f32>,

    /// (N, max_CE) i32 — combat enemy IDs
    pub combat_enemy_ids: Vec<i32>,
    pub combat_enemy_counts: Vec<i32>,
    pub max_combat_enemies: usize,
    /// (N, max_CE, COMBAT_ENEMY_SCALAR_DIM) f32
    pub combat_enemy_scalars: Vec<f32>,

    /// (N, max_S) i32 — skill IDs
    pub skill_ids: Vec<i32>,
    pub skill_counts: Vec<i32>,
    pub max_skills: usize,

    /// (N, max_VS) i32 — visible site IDs
    pub visible_site_ids: Vec<i32>,
    pub visible_site_counts: Vec<i32>,
    pub max_visible_sites: usize,
    /// (N, max_VS, SITE_SCALAR_DIM) f32
    pub visible_site_scalars: Vec<f32>,

    /// (N, max_ME) i32 — map enemy IDs
    pub map_enemy_ids: Vec<i32>,
    pub map_enemy_counts: Vec<i32>,
    pub max_map_enemies: usize,
    /// (N, max_ME, MAP_ENEMY_SCALAR_DIM) f32
    pub map_enemy_scalars: Vec<f32>,

    // ── Action features ────────────────────────────────────────────
    /// (N, max_M, 6) i32 — action vocab IDs, 0-padded
    pub action_ids: Vec<i32>,
    /// (N, max_M, ACTION_SCALAR_DIM) f32 — action scalars, 0-padded
    pub action_scalars: Vec<f32>,
    /// (N,) i32 — actual action count per env
    pub action_counts: Vec<i32>,
    pub max_actions: usize,

    /// (N, max_M+1) i32 — per-env CSR offsets into action_target_ids
    pub action_target_offsets: Vec<i32>,
    /// (T_total,) i32 — flat target enemy IDs
    pub action_target_ids: Vec<i32>,

    // ── Rewards/dones from step (populated by step_batch) ──────────
    /// (N,) f32 — fame before step
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
            max_actions = max_actions.max(step.actions.len());
        }

        // Ensure at least 1 for padding dimensions to avoid 0-size arrays
        let max_hand = max_hand.max(1);
        let max_deck = max_deck.max(1);
        let max_discard = max_discard.max(1);
        let max_units = max_units.max(1);
        let max_combat_enemies = max_combat_enemies.max(1);
        let max_skills = max_skills.max(1);
        let max_visible_sites = max_visible_sites.max(1);
        let max_map_enemies = max_map_enemies.max(1);
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
            // Fill remaining offset slots for padded actions
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
            action_ids: action_ids_buf,
            action_scalars: action_scalars_buf,
            action_counts: action_counts_buf,
            max_actions,
            action_target_offsets: action_target_offsets_buf,
            action_target_ids: action_target_ids_buf,
            fames: fames.to_vec(),
        }
    }
}
