/**
 * Skill Commands Module
 *
 * Commands for activating and using skills.
 *
 * @module commands/skills
 */

export {
  createUseSkillCommand,
  type UseSkillCommandParams,
  USE_SKILL_COMMAND,
} from "./useSkillCommand.js";

export {
  applyPowerOfPain,
  canActivatePowerOfPain,
  isPowerOfPainSkill,
} from "./powerOfPain.js";
