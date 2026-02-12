/**
 * Server-side simulation module
 *
 * Exports types and classes for running simulations entirely on the server,
 * eliminating per-step WebSocket overhead.
 */

export { ServerSideSimulation } from "./ServerSideSimulation.js";
export { createPolicy, RandomServerPolicy } from "./policies.js";
export { enumerateActions } from "./actionEnumerator.js";
export type {
  RunSimulationRequest,
  RunSimulationResponse,
  ServerPolicy,
  PolicyType,
  SimOutcome,
} from "./types.js";
export {
  POLICY_TYPE_RANDOM,
  SIM_OUTCOME_ENDED,
  SIM_OUTCOME_MAX_STEPS,
  SIM_OUTCOME_STALLED,
} from "./types.js";
