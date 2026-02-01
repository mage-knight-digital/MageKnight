/**
 * Helper function to create branded CardId constants
 */

import type { CardId } from "../ids.js";

/**
 * Creates a branded CardId constant.
 * This ensures type safety while allowing the value to be used as a CardId.
 */
export function cardId<T extends string>(id: T): T & CardId {
  return id as T & CardId;
}
