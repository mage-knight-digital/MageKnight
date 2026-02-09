/**
 * Skill effect handlers
 *
 * Each skill that requires an effect implementation has a handler here.
 * Handlers are called by the useSkillCommand when a skill is activated.
 */

export {
  applyWhoNeedsMagicEffect,
  removeWhoNeedsMagicEffect,
} from "./whoNeedsMagicEffect.js";

export {
  applyShieldMasteryEffect,
  removeShieldMasteryEffect,
} from "./shieldMasteryEffect.js";

export {
  applyIFeelNoPainEffect,
  removeIFeelNoPainEffect,
} from "./iFeelNoPainEffect.js";

export {
  applyPolarizationEffect,
  removePolarizationEffect,
  canActivatePolarization,
} from "./polarizationEffect.js";

export {
  applyPowerOfPainEffect,
  removePowerOfPainEffect,
} from "./powerOfPainEffect.js";

export {
  applyInvocationEffect,
  removeInvocationEffect,
  canActivateInvocation,
} from "./invocationEffect.js";

export {
  applyIDontGiveADamnEffect,
  removeIDontGiveADamnEffect,
} from "./iDontGiveADamnEffect.js";

export {
  applyManaOverloadEffect,
  removeManaOverloadEffect,
  placeManaOverloadInCenter,
  returnManaOverloadToOwner,
} from "./manaOverloadEffect.js";

export {
  applyUniversalPowerEffect,
  removeUniversalPowerEffect,
} from "./universalPowerEffect.js";

export {
  applyShapeshiftEffect,
  removeShapeshiftEffect,
  canActivateShapeshift,
} from "./shapeshiftEffect.js";

export {
  applyRegenerateEffect,
  removeRegenerateEffect,
  canActivateRegenerate,
} from "./regenerateEffect.js";

export {
  applyHawkEyesEffect,
  removeHawkEyesEffect,
} from "./hawkEyesEffect.js";

export {
  applyDeadlyAimEffect,
  removeDeadlyAimEffect,
} from "./deadlyAimEffect.js";

export {
  applyKnowYourPreyEffect,
  removeKnowYourPreyEffect,
} from "./knowYourPreyEffect.js";

export {
  applyDuelingEffect,
  removeDuelingEffect,
} from "./duelingEffect.js";

export {
  applyWolfsHowlEffect,
  removeWolfsHowlEffect,
  canActivateWolfsHowl,
} from "./wolfsHowlEffect.js";
