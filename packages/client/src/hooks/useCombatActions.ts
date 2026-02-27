/**
 * useCombatActions — derives all combat UI state from legalActions[].
 *
 * Follows the same pattern as extractTurnOptions() in TurnActions.tsx,
 * but covers every combat phase: block, attack (initiate → subset select
 * → confirm), and damage assignment.
 */

import { useMemo } from "react";
import { useGame } from "./useGame";
import {
  extractBlockActions,
  extractCumbersomeActions,
  extractBannerFearActions,
  extractInitiateAttackOptions,
  extractSubsetSelectOptions,
  extractDamageToHeroOptions,
  extractDamageToUnitOptions,
  extractConvertMoveToAttack,
  extractConvertInfluenceToBlock,
  extractThugsDamagePayment,
  extractTurnOptions,
  findAction,
  hasAction,
  type BlockActionOption,
  type CumbersomeActionOption,
  type BannerFearActionOption,
  type InitiateAttackOption,
  type SubsetSelectOption,
  type DamageToHeroOption,
  type DamageToUnitOption,
  type ConvertMoveToAttackOption,
  type ConvertInfluenceToBlockOption,
  type ThugsDamagePaymentOption,
} from "../rust/legalActionUtils";
import type { LegalAction } from "../rust/types";

export interface CombatActions {
  canEndPhase: boolean;
  endPhaseAction: LegalAction | undefined;
  canUndo: boolean;
  undoAction: LegalAction | undefined;

  // Block phase
  blockActions: BlockActionOption[];
  cumbersomeActions: CumbersomeActionOption[];
  bannerFearActions: BannerFearActionOption[];
  convertInfluenceToBlock: ConvertInfluenceToBlockOption[];
  payHeroesAssaultAction: LegalAction | undefined;

  // Attack phase — pre-initiate
  initiateAttackOptions: InitiateAttackOption[];
  convertMoveToAttack: ConvertMoveToAttackOption[];

  // Attack phase — target selection (SubsetSelect/SubsetConfirm)
  isSelectingTargets: boolean;
  subsetSelectOptions: SubsetSelectOption[];
  subsetConfirmAction: LegalAction | undefined;

  // Damage phase
  damageToHeroOptions: DamageToHeroOption[];
  damageToUnitOptions: DamageToUnitOption[];
  thugsDamagePayment: ThugsDamagePaymentOption[];
}

export function useCombatActions(): CombatActions {
  const { legalActions } = useGame();

  return useMemo(() => {
    const turnOpts = extractTurnOptions(legalActions);

    const subsetSelectOptions = extractSubsetSelectOptions(legalActions);
    const subsetConfirmAction = findAction(legalActions, "SubsetConfirm");

    return {
      canEndPhase: turnOpts.canEndCombatPhase,
      endPhaseAction: turnOpts.endCombatPhaseAction,
      canUndo: turnOpts.canUndo,
      undoAction: turnOpts.undoAction,

      blockActions: extractBlockActions(legalActions),
      cumbersomeActions: extractCumbersomeActions(legalActions),
      bannerFearActions: extractBannerFearActions(legalActions),
      convertInfluenceToBlock: extractConvertInfluenceToBlock(legalActions),
      payHeroesAssaultAction: findAction(legalActions, "PayHeroesAssaultInfluence"),

      initiateAttackOptions: extractInitiateAttackOptions(legalActions),
      convertMoveToAttack: extractConvertMoveToAttack(legalActions),

      isSelectingTargets: subsetSelectOptions.length > 0 || hasAction(legalActions, "SubsetConfirm"),
      subsetSelectOptions,
      subsetConfirmAction,

      damageToHeroOptions: extractDamageToHeroOptions(legalActions),
      damageToUnitOptions: extractDamageToUnitOptions(legalActions),
      thugsDamagePayment: extractThugsDamagePayment(legalActions),
    };
  }, [legalActions]);
}
