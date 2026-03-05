/**
 * useCombatActions — derives all combat UI state from legalActions[].
 *
 * Follows the same pattern as extractTurnOptions() in TurnActions.tsx,
 * but covers every combat phase: block, attack (subset select → confirm),
 * and damage assignment.
 */

import { useMemo } from "react";
import { useGame } from "./useGame";
import {
  extractBlockActions,
  extractCumbersomeActions,
  extractBannerFearActions,
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

  // Attack phase
  convertMoveToAttack: ConvertMoveToAttackOption[];

  // Attack phase — target selection (SubsetSelect/SubsetConfirm)
  isSelectingTargets: boolean;
  subsetSelectOptions: SubsetSelectOption[];
  subsetConfirmAction: LegalAction | undefined;

  // Attack phase — resolve declared attack
  resolveAttackAction: LegalAction | undefined;

  // Attack phase — declared attack info
  hasDeclaredAttack: boolean;
  declaredAttackTargets: readonly string[];
  declaredAttackType: string | null;
  declaredAttackArmorNeeded: number;

  // Damage phase
  damageToHeroOptions: DamageToHeroOption[];
  damageToUnitOptions: DamageToUnitOption[];
  thugsDamagePayment: ThugsDamagePaymentOption[];
}

export function useCombatActions(): CombatActions {
  const { legalActions, state } = useGame();

  return useMemo(() => {
    const turnOpts = extractTurnOptions(legalActions);

    const subsetSelectOptions = extractSubsetSelectOptions(legalActions);
    const subsetConfirmAction = findAction(legalActions, "SubsetConfirm");

    const combat = state?.combat;
    const declaredTargets = combat?.declaredAttackTargets ?? null;
    const hasDeclaredAttack = declaredTargets != null && declaredTargets.length > 0;

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

      convertMoveToAttack: extractConvertMoveToAttack(legalActions),

      isSelectingTargets: subsetSelectOptions.length > 0 || hasAction(legalActions, "SubsetConfirm"),
      subsetSelectOptions,
      subsetConfirmAction,

      resolveAttackAction: findAction(legalActions, "ResolveAttack"),

      hasDeclaredAttack,
      declaredAttackTargets: declaredTargets ?? [],
      declaredAttackType: combat?.declaredAttackType ?? null,
      declaredAttackArmorNeeded: combat?.declaredAttackArmorNeeded ?? 0,

      damageToHeroOptions: extractDamageToHeroOptions(legalActions),
      damageToUnitOptions: extractDamageToUnitOptions(legalActions),
      thugsDamagePayment: extractThugsDamagePayment(legalActions),
    };
  }, [legalActions, state?.combat]);
}
