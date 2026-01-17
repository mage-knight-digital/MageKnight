/**
 * Reward helpers - site reward granting and queueing
 *
 * Split into focused modules:
 * - types: RewardResult type and constants
 * - queueing: Queue rewards for later selection
 * - handlers: Individual reward type handlers
 */

export type { RewardResult } from "./types.js";
export { DIE_FACES } from "./types.js";

export { queueSiteReward } from "./queueing.js";

export {
  grantSiteReward,
  grantSpellReward,
  grantArtifactReward,
  grantCrystalRollReward,
  grantAdvancedActionReward,
  grantFameReward,
  grantCompoundReward,
} from "./handlers.js";
