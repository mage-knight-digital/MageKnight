//! Seeded RNG — Mulberry32, matching TS engine for deterministic parity.
//!
//! All randomness in the game engine must go through `RngState` to ensure
//! games are reproducible for testing, replays, RL training, and debugging.
//!
//! The algorithm exactly matches `packages/core/src/utils/rng.ts`.

use serde::{Deserialize, Serialize};

/// RNG state tracked in game state. Matches TS `RngState`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct RngState {
    pub seed: u32,
    pub counter: u32,
}

impl RngState {
    /// Create RNG with the given seed (counter starts at 0).
    pub fn new(seed: u32) -> Self {
        Self { seed, counter: 0 }
    }

    /// Get next random f64 in [0, 1). Advances counter by 1.
    pub fn next_f64(&mut self) -> f64 {
        self.counter = self.counter.wrapping_add(1);
        mulberry32(self.seed.wrapping_add(self.counter))
    }

    /// Get random u32 in [min, max] inclusive.
    /// Matches TS `randomInt(rng, min, max)`.
    pub fn next_int(&mut self, min: u32, max: u32) -> u32 {
        let value = self.next_f64();
        min + (value * (max - min + 1) as f64) as u32
    }

    /// Fisher-Yates shuffle, matching TS `shuffleWithRng` exactly.
    pub fn shuffle<T>(&mut self, slice: &mut [T]) {
        for i in (1..slice.len()).rev() {
            let value = self.next_f64();
            let j = (value * (i + 1) as f64) as usize;
            slice.swap(i, j);
        }
    }

    /// Pick a random index from `[0, len)`. Returns `None` if len is 0.
    pub fn random_index(&mut self, len: usize) -> Option<usize> {
        if len == 0 {
            return None;
        }
        Some(self.next_int(0, len as u32 - 1) as usize)
    }
}

/// Mulberry32 PRNG — fast, good distribution, seedable.
///
/// Takes a u32 input (seed + counter), returns a value in [0, 1).
/// Uses i32 wrapping arithmetic to match JavaScript's 32-bit integer
/// operations (`Math.imul`, `| 0`, `>>> 0`).
fn mulberry32(input: u32) -> f64 {
    // JS: let t = (seed + 0x6d2b79f5) | 0;
    let mut t: i32 = input.wrapping_add(0x6D2B79F5) as i32;

    // JS: t = Math.imul(t ^ (t >>> 15), t | 1);
    let lhs = ((t as u32) ^ ((t as u32) >> 15)) as i32;
    let rhs = t | 1;
    t = lhs.wrapping_mul(rhs);

    // JS: t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    let lhs2 = ((t as u32) ^ ((t as u32) >> 7)) as i32;
    let rhs2 = t | 61;
    let mul = lhs2.wrapping_mul(rhs2);
    t ^= t.wrapping_add(mul);

    // JS: return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    let result = (t as u32) ^ ((t as u32) >> 14);
    result as f64 / 4294967296.0
}

#[cfg(test)]
mod tests {
    use super::*;

    // Golden values computed from TS mulberry32 implementation.
    const SEED_42_EXPECTED: [f64; 10] = [
        0.9998110907617956,
        0.8361802322324365,
        0.03719550580717623,
        0.060074036940932274,
        0.62949686544016,
        0.8452139683067799,
        0.37396135926246643,
        0.5425962486770004,
        0.14702514582313597,
        0.2141944591421634,
    ];

    const SEED_0_EXPECTED: [f64; 5] = [
        0.6270739405881613,
        0.7342509443406016,
        0.7202267837710679,
        0.9236361971125007,
        0.6897749109193683,
    ];

    #[test]
    fn mulberry32_parity_seed_42() {
        let mut rng = RngState::new(42);
        for (i, &expected) in SEED_42_EXPECTED.iter().enumerate() {
            let actual = rng.next_f64();
            assert!(
                (actual - expected).abs() < 1e-15,
                "seed=42, index={i}: expected {expected}, got {actual}"
            );
        }
    }

    #[test]
    fn mulberry32_parity_seed_0() {
        let mut rng = RngState::new(0);
        for (i, &expected) in SEED_0_EXPECTED.iter().enumerate() {
            let actual = rng.next_f64();
            assert!(
                (actual - expected).abs() < 1e-15,
                "seed=0, index={i}: expected {expected}, got {actual}"
            );
        }
    }

    #[test]
    fn deterministic_same_seed() {
        let mut rng1 = RngState::new(42);
        let mut rng2 = RngState::new(42);
        for _ in 0..100 {
            assert_eq!(rng1.next_f64().to_bits(), rng2.next_f64().to_bits());
        }
    }

    #[test]
    fn different_seeds_differ() {
        let mut rng1 = RngState::new(42);
        let mut rng2 = RngState::new(43);
        let v1 = rng1.next_f64();
        let v2 = rng2.next_f64();
        assert_ne!(v1.to_bits(), v2.to_bits());
    }

    #[test]
    fn values_in_range() {
        let mut rng = RngState::new(12345);
        for _ in 0..1000 {
            let v = rng.next_f64();
            assert!((0.0..1.0).contains(&v), "value {v} out of [0, 1)");
        }
    }

    #[test]
    fn next_int_in_range() {
        let mut rng = RngState::new(42);
        // TS: randomInt(seed=42, counter=0, 0, 5) = { value: 5, counter: 1 }
        let v = rng.next_int(0, 5);
        assert_eq!(v, 5);

        // General range check
        let mut rng2 = RngState::new(999);
        for _ in 0..1000 {
            let v = rng2.next_int(3, 7);
            assert!((3..=7).contains(&v), "randomInt {v} out of [3, 7]");
        }
    }

    #[test]
    fn shuffle_parity() {
        let mut rng = RngState::new(42);
        let mut arr: Vec<usize> = (0..10).collect();
        rng.shuffle(&mut arr);
        assert_eq!(arr, vec![2, 6, 5, 1, 4, 3, 8, 0, 7, 9]);
        assert_eq!(rng.counter, 9);
    }

    #[test]
    fn shuffle_empty_and_single() {
        let mut rng = RngState::new(42);
        let mut empty: Vec<u32> = vec![];
        rng.shuffle(&mut empty);
        assert_eq!(rng.counter, 0); // no advances

        let mut single = vec![42u32];
        rng.shuffle(&mut single);
        assert_eq!(single, vec![42]);
        assert_eq!(rng.counter, 0); // no advances for single element
    }

    #[test]
    fn random_index_empty() {
        let mut rng = RngState::new(42);
        assert_eq!(rng.random_index(0), None);
        assert_eq!(rng.counter, 0); // no advance
    }

    #[test]
    fn random_index_in_range() {
        let mut rng = RngState::new(42);
        for _ in 0..100 {
            let idx = rng.random_index(5).unwrap();
            assert!(idx < 5, "index {idx} out of range [0, 5)");
        }
    }

    #[test]
    fn counter_increments() {
        let mut rng = RngState::new(42);
        assert_eq!(rng.counter, 0);
        rng.next_f64();
        assert_eq!(rng.counter, 1);
        rng.next_f64();
        assert_eq!(rng.counter, 2);
        rng.next_int(0, 10);
        assert_eq!(rng.counter, 3);
    }
}
