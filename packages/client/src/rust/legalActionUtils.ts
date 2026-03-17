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
  targetCenter: { q: number; r: number };
  action: LegalAction;
}

export function extractExploreTargets(actions: LegalAction[]): ExploreOption[] {
  const result: ExploreOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "Explore") continue;
    const data = actionData(action)!;
    result.push({
      targetCenter: data["target_center"] as { q: number; r: number },
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
// Tactic decisions: Mana Steal
// =============================================================================

export interface ManaStealOption {
  dieIndex: number;
  action: LegalAction;
}

export function extractManaStealOptions(actions: LegalAction[]): ManaStealOption[] {
  const result: ManaStealOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ResolveTacticDecision") continue;
    const data = actionData(action)!;
    const td = data["data"] as { type: string; die_index?: number };
    if (td.type === "mana_steal" && td.die_index != null) {
      result.push({
        dieIndex: td.die_index,
        action,
      });
    }
  }
  return result;
}

// =============================================================================
// Site interaction actions
// =============================================================================

export interface SiteActionInfo {
  canBeginInteraction: boolean;
  beginInteractionAction?: LegalAction;
  canEnter: boolean;
  enterAction?: LegalAction;
  healOptions: { healing: number; action: LegalAction }[];
  buySpellActions: { cardId: string; offerIndex: number; manaColor: string; action: LegalAction }[];
  learnAAActions: { cardId: string; offerIndex: number; action: LegalAction }[];
  buyCityAAActions: { cardId: string; offerIndex: number; action: LegalAction }[];
  canBurnMonastery: boolean;
  burnAction?: LegalAction;
  canPlunder: boolean;
  plunderAction?: LegalAction;
  canBuyArtifact: boolean;
  buyArtifactAction?: LegalAction;
  canAddElite: boolean;
  addEliteAction?: LegalAction;
  canBuyCityAAFromDeck: boolean;
  buyCityAAFromDeckAction?: LegalAction;
  recruitActions: { unitId: string; offerIndex: number; influenceCost: number; action: LegalAction }[];
  /** True if any site-related action is available */
  hasSiteActions: boolean;
}

export function extractSiteActions(actions: LegalAction[]): SiteActionInfo {
  const info: SiteActionInfo = {
    canBeginInteraction: false,
    canEnter: false,
    healOptions: [],
    buySpellActions: [],
    learnAAActions: [],
    buyCityAAActions: [],
    canBurnMonastery: false,
    canPlunder: false,
    canBuyArtifact: false,
    canAddElite: false,
    canBuyCityAAFromDeck: false,
    recruitActions: [],
    hasSiteActions: false,
  };

  for (const action of actions) {
    const type = actionType(action);
    const data = actionData(action);

    switch (type) {
      case "BeginInteraction":
        info.canBeginInteraction = true;
        info.beginInteractionAction = action;
        break;
      case "EnterSite":
        info.canEnter = true;
        info.enterAction = action;
        break;
      case "InteractSite":
        info.healOptions.push({ healing: data!["healing"] as number, action });
        break;
      case "BuySpell":
        info.buySpellActions.push({
          cardId: data!["card_id"] as string,
          offerIndex: data!["offer_index"] as number,
          manaColor: data!["mana_color"] as string,
          action,
        });
        break;
      case "LearnAdvancedAction":
        info.learnAAActions.push({
          cardId: data!["card_id"] as string,
          offerIndex: data!["offer_index"] as number,
          action,
        });
        break;
      case "BuyCityAdvancedAction":
        info.buyCityAAActions.push({
          cardId: data!["card_id"] as string,
          offerIndex: data!["offer_index"] as number,
          action,
        });
        break;
      case "BurnMonastery":
        info.canBurnMonastery = true;
        info.burnAction = action;
        break;
      case "PlunderSite":
        info.canPlunder = true;
        info.plunderAction = action;
        break;
      case "BuyArtifact":
        info.canBuyArtifact = true;
        info.buyArtifactAction = action;
        break;
      case "AddEliteToOffer":
        info.canAddElite = true;
        info.addEliteAction = action;
        break;
      case "BuyCityAdvancedActionFromDeck":
        info.canBuyCityAAFromDeck = true;
        info.buyCityAAFromDeckAction = action;
        break;
      case "RecruitUnit":
        info.recruitActions.push({
          unitId: data!["unit_id"] as string,
          offerIndex: data!["offer_index"] as number,
          influenceCost: data!["influence_cost"] as number,
          action,
        });
        break;
    }
  }

  info.hasSiteActions = info.canBeginInteraction || info.canEnter
    || info.healOptions.length > 0 || info.buySpellActions.length > 0
    || info.learnAAActions.length > 0 || info.buyCityAAActions.length > 0
    || info.canBurnMonastery || info.canPlunder || info.canBuyArtifact
    || info.canAddElite || info.canBuyCityAAFromDeck || info.recruitActions.length > 0;

  return info;
}

// =============================================================================
// Level-up reward options
// =============================================================================

export interface LevelUpSkillOption {
  skillIndex: number;
  fromCommonPool: boolean;
  action: LegalAction;
}

export function extractLevelUpSkillOptions(actions: LegalAction[]): LevelUpSkillOption[] {
  const result: LevelUpSkillOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ChooseLevelUpSkill") continue;
    const data = actionData(action)!;
    result.push({
      skillIndex: data["skill_index"] as number,
      fromCommonPool: data["from_common_pool"] as boolean,
      action,
    });
  }
  return result;
}

export interface LevelUpAAOption {
  advancedActionId: string;
  action: LegalAction;
}

export function extractLevelUpAAOptions(actions: LegalAction[]): LevelUpAAOption[] {
  const result: LevelUpAAOption[] = [];
  for (const action of actions) {
    if (actionType(action) !== "ChooseLevelUpAdvancedAction") continue;
    const data = actionData(action)!;
    result.push({
      advancedActionId: data["advanced_action_id"] as string,
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
