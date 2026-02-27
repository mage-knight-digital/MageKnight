/**
 * Extraction utilities for LegalAction arrays.
 *
 * Each utility takes a flat LegalAction[] and returns grouped/filtered
 * data carrying the original action reference, so the UI can present
 * choices and then send the selected action back unchanged.
 */

import { type LegalAction, actionType, actionData } from "./types";

// =============================================================================
// Card actions — grouped by card_id
// =============================================================================

export interface CardActionGroup {
  handIndex: number;
  cardId: string;
  basic?: LegalAction;
  powered: { manaColor: string; action: LegalAction }[];
  sideways: { sidewaysAs: string; action: LegalAction }[];
}

/**
 * Group all PlayCardBasic/PlayCardPowered/PlayCardSideways by card_id.
 * Returns a Map from card_id to a CardActionGroup.
 */
export function groupCardActions(actions: LegalAction[]): Map<string, CardActionGroup> {
  const map = new Map<string, CardActionGroup>();

  for (const action of actions) {
    const type = actionType(action);
    const data = actionData(action);
    if (!data) continue;

    if (type === "PlayCardBasic") {
      const cardId = data["card_id"] as string;
      const group = getOrCreate(map, cardId, data["hand_index"] as number);
      group.basic = action;
    } else if (type === "PlayCardPowered") {
      const cardId = data["card_id"] as string;
      const group = getOrCreate(map, cardId, data["hand_index"] as number);
      group.powered.push({ manaColor: data["mana_color"] as string, action });
    } else if (type === "PlayCardSideways") {
      const cardId = data["card_id"] as string;
      const group = getOrCreate(map, cardId, data["hand_index"] as number);
      group.sideways.push({ sidewaysAs: data["sideways_as"] as string, action });
    }
  }

  return map;
}

function getOrCreate(map: Map<string, CardActionGroup>, cardId: string, handIndex: number): CardActionGroup {
  let group = map.get(cardId);
  if (!group) {
    group = { handIndex, cardId, powered: [], sideways: [] };
    map.set(cardId, group);
  }
  return group;
}

// =============================================================================
// Move targets
// =============================================================================

export interface MoveOption {
  hex: { q: number; r: number };
  cost: number;
  action: LegalAction;
}

export function extractMoveTargets(actions: LegalAction[]): MoveOption[] {
  const result: MoveOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "Move") continue;
    const data = actionData(action)!;
    result.push({
      hex: data["target"] as { q: number; r: number },
      cost: data["cost"] as number,
      action,
    });
  }
  return result;
}

// =============================================================================
// Explore directions
// =============================================================================

export interface ExploreOption {
  direction: string;
  action: LegalAction;
}

export function extractExploreDirections(actions: LegalAction[]): ExploreOption[] {
  const result: ExploreOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "Explore") continue;
    const data = actionData(action)!;
    result.push({
      direction: data["direction"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Tactic options
// =============================================================================

export interface TacticOption {
  tacticId: string;
  action: LegalAction;
}

export function extractTacticOptions(actions: LegalAction[]): TacticOption[] {
  const result: TacticOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "SelectTactic") continue;
    const data = actionData(action)!;
    result.push({
      tacticId: data["tactic_id"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Turn options (boolean flags)
// =============================================================================

export interface TurnOptions {
  canEndTurn: boolean;
  canDeclareRest: boolean;
  canUndo: boolean;
  canActivateTactic: boolean;
  canEndCombatPhase: boolean;
  endTurnAction?: LegalAction;
  declareRestAction?: LegalAction;
  undoAction?: LegalAction;
  activateTacticAction?: LegalAction;
  endCombatPhaseAction?: LegalAction;
}

export function extractTurnOptions(actions: LegalAction[]): TurnOptions {
  const result: TurnOptions = {
    canEndTurn: false,
    canDeclareRest: false,
    canUndo: false,
    canActivateTactic: false,
    canEndCombatPhase: false,
  };

  for (const action of actions) {
    const type = actionType(action);
    if (type === "EndTurn") {
      result.canEndTurn = true;
      result.endTurnAction = action;
    } else if (type === "DeclareRest") {
      result.canDeclareRest = true;
      result.declareRestAction = action;
    } else if (type === "Undo") {
      result.canUndo = true;
      result.undoAction = action;
    } else if (type === "ActivateTactic") {
      result.canActivateTactic = true;
      result.activateTacticAction = action;
    } else if (type === "EndCombatPhase") {
      result.canEndCombatPhase = true;
      result.endCombatPhaseAction = action;
    }
  }

  return result;
}

// =============================================================================
// Choice options
// =============================================================================

export interface ChoiceOption {
  choiceIndex: number;
  action: LegalAction;
}

export function extractChoiceOptions(actions: LegalAction[]): ChoiceOption[] {
  const result: ChoiceOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ResolveChoice") continue;
    const data = actionData(action)!;
    result.push({
      choiceIndex: data["choice_index"] as number,
      action,
    });
  }
  return result;
}

// =============================================================================
// Unit activations
// =============================================================================

export interface UnitActivation {
  abilityIndex: number;
  action: LegalAction;
}

export function extractUnitActions(actions: LegalAction[]): Map<string, UnitActivation[]> {
  const map = new Map<string, UnitActivation[]>();
  for (const action of actions) {
    if (actionType(action) !== "ActivateUnit") continue;
    const data = actionData(action)!;
    const unitId = data["unit_instance_id"] as string;
    let list = map.get(unitId);
    if (!list) {
      list = [];
      map.set(unitId, list);
    }
    list.push({
      abilityIndex: data["ability_index"] as number,
      action,
    });
  }
  return map;
}

// =============================================================================
// Challenge rampaging targets
// =============================================================================

export interface ChallengeOption {
  hex: { q: number; r: number };
  action: LegalAction;
}

export function extractChallengeTargets(actions: LegalAction[]): ChallengeOption[] {
  const result: ChallengeOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ChallengeRampaging") continue;
    const data = actionData(action)!;
    result.push({
      hex: data["hex"] as { q: number; r: number },
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Block actions
// =============================================================================

export interface BlockActionOption {
  enemyInstanceId: string;
  attackIndex: number;
  action: LegalAction;
}

export function extractBlockActions(actions: LegalAction[]): BlockActionOption[] {
  const result: BlockActionOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "DeclareBlock") continue;
    const data = actionData(action)!;
    result.push({
      enemyInstanceId: data["enemy_instance_id"] as string,
      attackIndex: data["attack_index"] as number,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Cumbersome actions
// =============================================================================

export interface CumbersomeActionOption {
  enemyInstanceId: string;
  action: LegalAction;
}

export function extractCumbersomeActions(actions: LegalAction[]): CumbersomeActionOption[] {
  const result: CumbersomeActionOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "SpendMoveOnCumbersome") continue;
    const data = actionData(action)!;
    result.push({
      enemyInstanceId: data["enemy_instance_id"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Banner Fear actions
// =============================================================================

export interface BannerFearActionOption {
  unitInstanceId: string;
  enemyInstanceId: string;
  attackIndex: number;
  action: LegalAction;
}

export function extractBannerFearActions(actions: LegalAction[]): BannerFearActionOption[] {
  const result: BannerFearActionOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "UseBannerFear") continue;
    const data = actionData(action)!;
    result.push({
      unitInstanceId: data["unit_instance_id"] as string,
      enemyInstanceId: data["enemy_instance_id"] as string,
      attackIndex: data["attack_index"] as number,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Initiate Attack options
// =============================================================================

export interface InitiateAttackOption {
  attackType: string;
  action: LegalAction;
}

export function extractInitiateAttackOptions(actions: LegalAction[]): InitiateAttackOption[] {
  const result: InitiateAttackOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "InitiateAttack") continue;
    const data = actionData(action)!;
    result.push({
      attackType: data["attack_type"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Subset selection (attack target toggling)
// =============================================================================

export interface SubsetSelectOption {
  index: number;
  action: LegalAction;
}

export function extractSubsetSelectOptions(actions: LegalAction[]): SubsetSelectOption[] {
  const result: SubsetSelectOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "SubsetSelect") continue;
    const data = actionData(action)!;
    result.push({
      index: data["index"] as number,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Damage assignment options
// =============================================================================

export interface DamageToHeroOption {
  enemyIndex: number;
  attackIndex: number;
  action: LegalAction;
}

export function extractDamageToHeroOptions(actions: LegalAction[]): DamageToHeroOption[] {
  const result: DamageToHeroOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "AssignDamageToHero") continue;
    const data = actionData(action)!;
    result.push({
      enemyIndex: data["enemy_index"] as number,
      attackIndex: data["attack_index"] as number,
      action,
    });
  }
  return result;
}

export interface DamageToUnitOption {
  enemyIndex: number;
  attackIndex: number;
  unitInstanceId: string;
  action: LegalAction;
}

export function extractDamageToUnitOptions(actions: LegalAction[]): DamageToUnitOption[] {
  const result: DamageToUnitOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "AssignDamageToUnit") continue;
    const data = actionData(action)!;
    result.push({
      enemyIndex: data["enemy_index"] as number,
      attackIndex: data["attack_index"] as number,
      unitInstanceId: data["unit_instance_id"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Convert actions
// =============================================================================

export interface ConvertMoveToAttackOption {
  movePoints: number;
  attackType: string;
  action: LegalAction;
}

export function extractConvertMoveToAttack(actions: LegalAction[]): ConvertMoveToAttackOption[] {
  const result: ConvertMoveToAttackOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ConvertMoveToAttack") continue;
    const data = actionData(action)!;
    result.push({
      movePoints: data["move_points"] as number,
      attackType: data["attack_type"] as string,
      action,
    });
  }
  return result;
}

export interface ConvertInfluenceToBlockOption {
  influencePoints: number;
  element: string | null;
  action: LegalAction;
}

export function extractConvertInfluenceToBlock(actions: LegalAction[]): ConvertInfluenceToBlockOption[] {
  const result: ConvertInfluenceToBlockOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ConvertInfluenceToBlock") continue;
    const data = actionData(action)!;
    result.push({
      influencePoints: data["influence_points"] as number,
      element: data["element"] as string | null,
      action,
    });
  }
  return result;
}

// =============================================================================
// Combat: Thugs damage payment
// =============================================================================

export interface ThugsDamagePaymentOption {
  unitInstanceId: string;
  action: LegalAction;
}

export function extractThugsDamagePayment(actions: LegalAction[]): ThugsDamagePaymentOption[] {
  const result: ThugsDamagePaymentOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "PayThugsDamageInfluence") continue;
    const data = actionData(action)!;
    result.push({
      unitInstanceId: data["unit_instance_id"] as string,
      action,
    });
  }
  return result;
}

// =============================================================================
// Generic action presence check
// =============================================================================

/** Check if any action of the given type exists in the list. */
export function hasAction(actions: LegalAction[], type: string): boolean {
  return actions.some(a => actionType(a) === type);
}

/** Find the first action of the given type. */
export function findAction(actions: LegalAction[], type: string): LegalAction | undefined {
  return actions.find(a => actionType(a) === type);
}
