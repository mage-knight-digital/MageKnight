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
