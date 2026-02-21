/**
 * Post-transform patches for Rust → TS state shape compatibility.
 *
 * After snakeToCamel(), some field names and structural shapes still differ
 * between the Rust ClientGameState and the TS ClientGameState. This module
 * patches the critical mismatches so existing display components work.
 *
 * Field renames:
 *   player.hero           → player.heroId
 *   player.selectedTactic → player.selectedTacticId
 *   player.manaTokens     → player.pureMana
 *   site.siteType         → site.type
 *
 * Structural transforms:
 *   map.hexes: array → Record<"q,r", hex>
 *   offers.advancedActions: string[] → { cards: string[] }
 *   offers.spells: string[] → { cards: string[] }
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export function patchRustState(state: any): any {
  if (!state) return state;

  // Patch players
  if (Array.isArray(state.players)) {
    for (const player of state.players) {
      patchPlayer(player);
    }
  }

  // Patch map.hexes: array → Record<"q,r", hex>
  if (state.map && Array.isArray(state.map.hexes)) {
    const hexRecord: Record<string, any> = {};
    for (const hex of state.map.hexes) {
      if (hex.coord) {
        const key = `${hex.coord.q},${hex.coord.r}`;
        // Patch site.siteType → site.type within each hex
        if (hex.site) {
          patchSite(hex.site);
        }
        hexRecord[key] = hex;
      }
    }
    state.map.hexes = hexRecord;
  }

  // Ensure map.tileSlots exists (fallback to empty if Rust server doesn't send it)
  if (state.map && !state.map.tileSlots) {
    state.map.tileSlots = {};
  }

  // Rust sends tile_slots as BTreeMap which becomes tileSlots after snakeToCamel.
  // The keys are hex coord strings like "0,0" — already in the right format.
  // No structural patching needed since it serializes as Record<string, ClientTileSlot>.

  // Patch offers: wrap arrays in { cards: [...] } for TS compatibility
  if (state.offers) {
    if (Array.isArray(state.offers.advancedActions)) {
      state.offers.advancedActions = { cards: state.offers.advancedActions };
    }
    if (Array.isArray(state.offers.spells)) {
      state.offers.spells = { cards: state.offers.spells };
    }
  }

  // Patch deckCounts: units → regularUnits (Rust has single field)
  if (state.deckCounts) {
    if (state.deckCounts.units !== undefined && state.deckCounts.regularUnits === undefined) {
      state.deckCounts.regularUnits = state.deckCounts.units;
      state.deckCounts.eliteUnits = 0;
    }
  }

  // Patch dummy player
  if (state.dummyPlayer) {
    if (state.dummyPlayer.hero !== undefined && state.dummyPlayer.heroId === undefined) {
      state.dummyPlayer.heroId = state.dummyPlayer.hero;
    }
  }

  // Patch combat enemies: resistances array → object
  if (state.combat && Array.isArray(state.combat.enemies)) {
    for (const enemy of state.combat.enemies) {
      patchCombatEnemy(enemy);
    }
  }

  return state;
}

function patchPlayer(player: any): void {
  // hero → heroId
  if (player.hero !== undefined && player.heroId === undefined) {
    player.heroId = player.hero;
  }

  // selectedTactic → selectedTacticId
  if (player.selectedTacticId === undefined) {
    player.selectedTacticId = player.selectedTactic ?? null;
  }

  // manaTokens → pureMana
  if (player.manaTokens !== undefined && player.pureMana === undefined) {
    player.pureMana = player.manaTokens;
  }

  // Ensure pureMana is at least an empty array
  if (!player.pureMana) {
    player.pureMana = [];
  }
}

function patchSite(site: any): void {
  // siteType → type
  if (site.siteType !== undefined && site.type === undefined) {
    site.type = site.siteType;
  }
}

function patchCombatEnemy(enemy: any): void {
  // resistances: string[] → { physical: bool, fire: bool, ice: bool, cold: bool }
  if (Array.isArray(enemy.resistances)) {
    const arr = enemy.resistances as string[];
    enemy.resistances = {
      physical: arr.includes("physical"),
      fire: arr.includes("fire"),
      ice: arr.includes("ice"),
      cold: arr.includes("cold"),
      coldFire: arr.includes("cold_fire") || arr.includes("coldFire"),
    };
  }
}
