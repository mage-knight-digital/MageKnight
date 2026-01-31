/**
 * Types for validator routing
 */

import type { Validator } from "../types.js";

/**
 * A validator registry maps action types to arrays of validators
 */
export type ValidatorRegistry = Record<string, Validator[]>;
