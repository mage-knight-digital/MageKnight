/**
 * Krang's Curse activation checks.
 *
 * Curse is implemented via the generic effect system (EFFECT_KRANG_CURSE),
 * but ValidActions and validators need a shared "can activate" predicate.
 */

import { canActivateKrangCurse } from "../../effects/krangCurseEffects.js";

export { canActivateKrangCurse };

