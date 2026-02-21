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
  | { type: "rethink"; hand_indices: number[] }
  | { type: "mana_steal"; die_index: number }
  | { type: "preparation"; deck_card_index: number }
  | { type: "midnight_meditation"; hand_indices: number[] }
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
  | { SelectTactic: { tactic_id: string } }
  | { PlayCardBasic: { hand_index: number; card_id: string } }
  | { PlayCardPowered: { hand_index: number; card_id: string; mana_color: string } }
  | { PlayCardSideways: { hand_index: number; card_id: string; sideways_as: string } }
  | { Move: { target: { q: number; r: number }; cost: number } }
  | { Explore: { direction: string } }
  | { ResolveChoice: { choice_index: number } }
  | { ResolveDiscardForBonus: { choice_index: number; discard_count: number } }
  | { ResolveDecompose: { hand_index: number } }
  | { ChallengeRampaging: { hex: { q: number; r: number } } }
  | { DeclareBlock: { enemy_instance_id: string; attack_index: number } }
  | { DeclareAttack: { target_instance_ids: string[]; attack_type: string } }
  | { SpendMoveOnCumbersome: { enemy_instance_id: string } }
  | { ResolveTacticDecision: { data: TacticDecisionData } }
  | { RerollSourceDice: { die_indices: number[] } }
  | { EnterSite: Record<string, never> }
  | { InteractSite: { healing: number } }
  | { PlunderSite: Record<string, never> }
  | { DeclinePlunder: Record<string, never> }
  | { ResolveGladeWound: { choice: string } }
  | { RecruitUnit: { unit_id: string; offer_index: number; influence_cost: number } }
  | { ActivateUnit: { unit_instance_id: string; ability_index: number } }
  | { AssignDamageToHero: { enemy_index: number; attack_index: number } }
  | { AssignDamageToUnit: { enemy_index: number; attack_index: number; unit_instance_id: string } }
  | { ChooseLevelUpReward: { skill_index: number; from_common_pool: boolean; advanced_action_id: string } }
  | { CompleteRest: { discard_hand_index: number | null } }
  | "EndTurn"
  | "DeclareRest"
  | "EndCombatPhase"
  | "Undo"
  | "ActivateTactic"
  | "EnterSite"
  | "PlunderSite"
  | "DeclinePlunder";

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
  | { type: "game_update"; state: Record<string, unknown>; legal_actions: LegalAction[]; epoch: number }
  | { type: "error"; message: string };
