/**
 * Wire protocol types for the Rust mk-server WebSocket API.
 *
 * LegalAction uses serde's default externally-tagged enum encoding:
 *   - Struct variants: { "VariantName": { field1: ..., field2: ... } }
 *   - Unit variants: "VariantName"
 */

// =============================================================================
// LegalAction — externally-tagged serde enum
// =============================================================================

export type TacticDecisionData =
  | { type: "mana_steal"; die_index: number }
  | { type: "preparation"; deck_card_index: number }
  | { type: "sparing_power_stash" }
  | { type: "sparing_power_take" };

/**
 * A fully parameterized, executable action from the Rust engine.
 *
 * Struct variants are objects like `{ PlayCardBasic: { hand_index: 0, card_id: "march" } }`.
 * Unit variants are plain strings like `"EndTurn"`.
 *
 * These are opaque tokens: the client receives them, presents choices via
 * extraction utilities, and sends the selected one back unchanged.
 */
export type LegalAction =
  // Card play
  | { SelectTactic: { tactic_id: string } }
  | { PlayCardBasic: { hand_index: number; card_id: string } }
  | { PlayCardPowered: { hand_index: number; card_id: string; mana_color: string } }
  | { PlayCardSideways: { hand_index: number; card_id: string; sideways_as: string } }
  // Movement & exploration
  | { Move: { target: { q: number; r: number }; cost: number } }
  | { Explore: { direction: string } }
  // Choice resolution
  | { ResolveChoice: { choice_index: number } }
  | { ResolveDiscardForBonus: { choice_index: number; discard_count: number } }
  | { ResolveDecompose: { hand_index: number } }
  | { ResolveDiscardForCrystal: { card_id: string | null } }
  // Combat
  | { ChallengeRampaging: { hex: { q: number; r: number } } }
  | { DeclareBlock: { enemy_instance_id: string; attack_index: number } }
  | { SpendMoveOnCumbersome: { enemy_instance_id: string } }
  | { AssignDamageToHero: { enemy_index: number; attack_index: number } }
  | { AssignDamageToUnit: { enemy_index: number; attack_index: number; unit_instance_id: string } }
  | { ConvertMoveToAttack: { move_points: number; attack_type: string } }
  | { ConvertInfluenceToBlock: { influence_points: number; element: string | null } }
  | { PayThugsDamageInfluence: { unit_instance_id: string } }
  // Tactics
  | { ResolveTacticDecision: { data: TacticDecisionData } }
  // Sites & commerce
  | { InteractSite: { healing: number } }
  | { ResolveGladeWound: { choice: string } }
  | { RecruitUnit: { unit_id: string; offer_index: number; influence_cost: number } }
  | { BuySpell: { card_id: string; offer_index: number; mana_color: string } }
  | { LearnAdvancedAction: { card_id: string; offer_index: number } }
  | { BuyCityAdvancedAction: { card_id: string; offer_index: number } }
  | { AltarTribute: { mana_sources: unknown[] } }
  // Units
  | { ActivateUnit: { unit_instance_id: string; ability_index: number } }
  | { AssignBanner: { hand_index: number; card_id: string; unit_instance_id: string } }
  | { UseBannerCourage: { unit_instance_id: string } }
  | { UseBannerFear: { unit_instance_id: string; enemy_instance_id: string; attack_index: number } }
  | { PayHeroesAssaultInfluence: Record<string, never> }
  | { DisbandUnitForReward: { unit_instance_id: string; reward_unit_id: string } }
  | { ResolveUnitMaintenance: { unit_instance_id: string; keep_unit: boolean; crystal_color: string | null; new_mana_token_color: string | null } }
  // Rewards & level up
  | { SelectReward: { card_id: string; reward_index: number; unit_id: string | null } }
  | { SelectArtifact: { card_id: string } }
  | { ChooseLevelUpReward: { skill_index: number; from_common_pool: boolean; advanced_action_id: string } }
  // Skills
  | { UseSkill: { skill_id: string } }
  | { ReturnInteractiveSkill: { skill_id: string } }
  // Subset selection (multi-select UI)
  | { SubsetSelect: { index: number } }
  // Rest
  | { CompleteRest: { discard_hand_index: number | null } }
  // Mana & source operations
  | { InitiateManaSearch: Record<string, never> }
  | { ResolveSourceOpeningReroll: { reroll: boolean } }
  | { ResolveCrystalRollColor: { color: string } }
  | { ResolveCrystalJoyReclaim: { discard_index: number | null } }
  // Artifact resolution
  | { ResolveTraining: { selection_index: number } }
  | { ResolveBookOfWisdom: { selection_index: number } }
  | { ResolveTomeOfAllSpells: { selection_index: number } }
  | { ResolveCircletOfProficiency: { selection_index: number } }
  | { ResolveMaximalEffect: { hand_index: number } }
  | { ResolveMeditation: { selection_index: number; place_on_top: boolean | null } }
  | { ResolveSteadyTempoDeckPlacement: { place: boolean } }
  | { ResolveBannerProtection: { remove_all: boolean } }
  // Hex/terrain cost reduction
  | { ResolveHexCostReduction: { coordinate: { q: number; r: number } } }
  | { ResolveTerrainCostReduction: { terrain: string } }
  // Cooperative assault
  | { ProposeCooperativeAssault: { hex_coord: { q: number; r: number }; invited_player_idxs: number[]; distribution: [number, number][] } }
  | { RespondToCooperativeProposal: { accept: boolean } }
  // Unit variants (no data)
  | "ActivateTactic"
  | "EndTurn"
  | "DeclareRest"
  | "EnterSite"
  | "PlunderSite"
  | "DeclinePlunder"
  | "ResolveAttack"
  | "EndCombatPhase"
  | "Undo"
  | "AnnounceEndOfRound"
  | "MeditationDoneSelecting"
  | "CancelCooperativeProposal"
  | "BurnMonastery"
  | "BuyArtifact"
  | "AddEliteToOffer"
  | "ForfeitUnitReward"
  | "ForfeitTurn"
  | "SubsetConfirm"
  | "BuyCityAdvancedActionFromDeck";

// =============================================================================
// Helper functions
// =============================================================================

/** Get the variant name from a LegalAction. */
export function actionType(action: LegalAction): string {
  if (typeof action === "string") return action;
  return Object.keys(action)[0]!;
}

/** Get the data payload from a struct-variant LegalAction. */
export function actionData(action: LegalAction): Record<string, unknown> | undefined {
  if (typeof action === "string") return undefined;
  return Object.values(action)[0] as Record<string, unknown>;
}

/** Check if a LegalAction matches a given variant name. */
export function isAction(action: LegalAction, type: string): boolean {
  return actionType(action) === type;
}

// =============================================================================
// Wire protocol messages
// =============================================================================

/** Messages the client sends to the server. */
export type ClientMessage =
  | { type: "new_game"; hero: string; seed?: number }
  | { type: "action"; action: LegalAction; epoch: number }
  | { type: "undo" };

/** Messages the server sends to the client. */
export type ServerMessage =
  | { type: "state_update"; state: Record<string, unknown>; events: unknown[]; legal_actions: LegalAction[]; epoch: number }
  | { type: "error"; message: string };
