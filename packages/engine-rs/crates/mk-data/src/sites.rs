//! Site property definitions.
//!
//! Pure functions returning static site data — fortification, inhabitance,
//! adventure site status, enemy draws, and healing costs.

use mk_types::enums::{EnemyColor, SiteType};

// =============================================================================
// Site properties
// =============================================================================

/// Static properties of a site type.
pub struct SiteProperties {
    pub fortified: bool,
    pub inhabited: bool,
    pub adventure_site: bool,
}

/// Get the static properties for a site type.
pub fn get_site_properties(site_type: SiteType) -> SiteProperties {
    match site_type {
        SiteType::Keep => SiteProperties {
            fortified: true,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::MageTower => SiteProperties {
            fortified: true,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::City => SiteProperties {
            fortified: true,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::Village => SiteProperties {
            fortified: false,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::Monastery => SiteProperties {
            fortified: false,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::RefugeeCamp => SiteProperties {
            fortified: false,
            inhabited: true,
            adventure_site: false,
        },
        SiteType::Dungeon => SiteProperties {
            fortified: false,
            inhabited: false,
            adventure_site: true,
        },
        SiteType::Tomb => SiteProperties {
            fortified: false,
            inhabited: false,
            adventure_site: true,
        },
        SiteType::MonsterDen => SiteProperties {
            fortified: false,
            inhabited: false,
            adventure_site: true,
        },
        SiteType::SpawningGrounds => SiteProperties {
            fortified: false,
            inhabited: false,
            adventure_site: true,
        },
        SiteType::MagicalGlade | SiteType::Mine | SiteType::DeepMine | SiteType::Portal
        | SiteType::AncientRuins | SiteType::Maze | SiteType::Labyrinth
        | SiteType::VolkaresCamp => SiteProperties {
            fortified: false,
            inhabited: false,
            adventure_site: false,
        },
    }
}

pub fn is_fortified(site_type: SiteType) -> bool {
    get_site_properties(site_type).fortified
}

pub fn is_adventure_site(site_type: SiteType) -> bool {
    get_site_properties(site_type).adventure_site
}

pub fn is_inhabited(site_type: SiteType) -> bool {
    get_site_properties(site_type).inhabited
}

// =============================================================================
// Adventure site enemy draws
// =============================================================================

/// Enemy color and count drawn when entering an adventure site.
pub struct AdventureSiteEnemies {
    pub color: EnemyColor,
    pub count: u32,
}

/// Get the enemies drawn when entering an adventure site.
/// Returns `None` for non-adventure sites.
pub fn adventure_site_enemies(site_type: SiteType) -> Option<AdventureSiteEnemies> {
    match site_type {
        SiteType::Dungeon => Some(AdventureSiteEnemies {
            color: EnemyColor::Brown,
            count: 1,
        }),
        SiteType::Tomb => Some(AdventureSiteEnemies {
            color: EnemyColor::Red,
            count: 1,
        }),
        SiteType::MonsterDen => Some(AdventureSiteEnemies {
            color: EnemyColor::Brown,
            count: 1,
        }),
        SiteType::SpawningGrounds => Some(AdventureSiteEnemies {
            color: EnemyColor::Brown,
            count: 2,
        }),
        _ => None,
    }
}

// =============================================================================
// Healing costs
// =============================================================================

/// Influence cost per wound healed at an inhabited site.
/// Returns `None` for sites that don't offer healing.
pub fn healing_cost(site_type: SiteType) -> Option<u32> {
    match site_type {
        SiteType::Village | SiteType::RefugeeCamp => Some(3),
        SiteType::Monastery => Some(2),
        _ => None,
    }
}

/// Whether this site type draws fresh enemies each entry (vs reusing hex enemies).
pub fn draws_fresh_enemies(site_type: SiteType) -> bool {
    matches!(site_type, SiteType::Dungeon | SiteType::Tomb)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adventure_sites_identified() {
        assert!(is_adventure_site(SiteType::Dungeon));
        assert!(is_adventure_site(SiteType::Tomb));
        assert!(is_adventure_site(SiteType::MonsterDen));
        assert!(is_adventure_site(SiteType::SpawningGrounds));
        assert!(!is_adventure_site(SiteType::Village));
        assert!(!is_adventure_site(SiteType::Keep));
        assert!(!is_adventure_site(SiteType::Mine));
    }

    #[test]
    fn fortified_sites_identified() {
        assert!(is_fortified(SiteType::Keep));
        assert!(is_fortified(SiteType::MageTower));
        assert!(is_fortified(SiteType::City));
        assert!(!is_fortified(SiteType::Village));
        assert!(!is_fortified(SiteType::Dungeon));
    }

    #[test]
    fn inhabited_sites_identified() {
        assert!(is_inhabited(SiteType::Village));
        assert!(is_inhabited(SiteType::Monastery));
        assert!(is_inhabited(SiteType::RefugeeCamp));
        assert!(is_inhabited(SiteType::Keep));
        assert!(is_inhabited(SiteType::MageTower));
        assert!(is_inhabited(SiteType::City));
        assert!(!is_inhabited(SiteType::Dungeon));
        assert!(!is_inhabited(SiteType::Mine));
    }

    #[test]
    fn adventure_site_enemy_configs() {
        let dungeon = adventure_site_enemies(SiteType::Dungeon).unwrap();
        assert_eq!(dungeon.color, EnemyColor::Brown);
        assert_eq!(dungeon.count, 1);

        let tomb = adventure_site_enemies(SiteType::Tomb).unwrap();
        assert_eq!(tomb.color, EnemyColor::Red);
        assert_eq!(tomb.count, 1);

        let sg = adventure_site_enemies(SiteType::SpawningGrounds).unwrap();
        assert_eq!(sg.color, EnemyColor::Brown);
        assert_eq!(sg.count, 2);

        assert!(adventure_site_enemies(SiteType::Village).is_none());
    }

    #[test]
    fn healing_costs() {
        assert_eq!(healing_cost(SiteType::Village), Some(3));
        assert_eq!(healing_cost(SiteType::RefugeeCamp), Some(3));
        assert_eq!(healing_cost(SiteType::Monastery), Some(2));
        assert_eq!(healing_cost(SiteType::Dungeon), None);
        assert_eq!(healing_cost(SiteType::Keep), None);
    }

    #[test]
    fn fresh_enemy_draws() {
        assert!(draws_fresh_enemies(SiteType::Dungeon));
        assert!(draws_fresh_enemies(SiteType::Tomb));
        assert!(!draws_fresh_enemies(SiteType::MonsterDen));
        assert!(!draws_fresh_enemies(SiteType::SpawningGrounds));
    }
}
