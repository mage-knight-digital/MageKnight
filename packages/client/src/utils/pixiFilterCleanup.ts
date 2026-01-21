/**
 * PixiJS Filter Cleanup Utilities
 *
 * Filters (BlurFilter, ColorMatrixFilter, etc.) have GPU resources that need
 * explicit cleanup before calling app.destroy(). This utility ensures filters
 * are properly destroyed to prevent "Cannot read properties of null" errors
 * in DefaultBatcher.
 */

import type { Container, Filter } from "pixi.js";

/**
 * Recursively destroy all filters attached to a container and its children.
 * Call this BEFORE app.destroy() to prevent filter-related crashes.
 *
 * @param container - The root container to clean up (typically app.stage)
 */
export function cleanupFilters(container: Container | null | undefined): void {
  if (!container) return;

  // Clean filters on this container
  if (container.filters && container.filters.length > 0) {
    for (const filter of container.filters) {
      if (filter && typeof (filter as Filter).destroy === "function") {
        (filter as Filter).destroy();
      }
    }
    container.filters = [];
  }

  // Recursively clean children
  if (container.children) {
    for (const child of container.children) {
      // Check if child is a Container (has children property)
      if (child && "children" in child) {
        cleanupFilters(child as Container);
      }
    }
  }
}

/**
 * Collect all filters from a container hierarchy without destroying them.
 * Useful for debugging or tracking filter count.
 *
 * @param container - The root container to scan
 * @returns Array of all filters found
 */
export function collectFilters(container: Container | null | undefined): Filter[] {
  const filters: Filter[] = [];

  if (!container) return filters;

  if (container.filters) {
    filters.push(...(container.filters as Filter[]));
  }

  if (container.children) {
    for (const child of container.children) {
      if (child && "children" in child) {
        filters.push(...collectFilters(child as Container));
      }
    }
  }

  return filters;
}
