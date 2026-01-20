# Ticket: Site Panel UI

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** In Progress
**Affects:** Client UI, site info presentation
**Authoritative:** No

---

## Summary

A detailed SitePanel exists and is wired to the hex tooltip “More Info” flow; remaining work is polish and arrival-mode automation.

## Problem Statement

The panel was originally specified as a large new UI surface. Most structure is in place, but some integration behaviors (auto-open on arrival, split layout) and asset polish remain.

## Current Behavior

- `SitePanel` renders with scouting mode (computed info) or arrival mode (SiteOptions) (`packages/client/src/components/SitePanel/SitePanel.tsx`).
- `PixiHexGrid` opens the panel from the tooltip “More Info” flow.
- Panel has animations, close handling, and multiple sections.

## Expected Behavior

- Auto-open the panel on arrival at actionable sites when appropriate.
- Provide a polished presentation with consistent artwork and icons.

## Scope

### In Scope
- Arrival-mode auto-open integration.
- Minor polish for layout and assets.

### Out of Scope
- Large redesign of the panel system.

## Proposed Approach

- Connect arrival-based triggers to `SitePanel` (likely in `PixiHexGrid` or interaction flow).
- Use available sprites/icons for consistent artwork.

## Implementation Notes

- `packages/client/src/components/SitePanel/SitePanel.tsx`
- `packages/client/src/components/GameBoard/PixiHexGrid.tsx`

## Acceptance Criteria

- [ ] SitePanel auto-opens on arrival when appropriate.
- [ ] Visual presentation matches site type and shows correct details.

## Test Plan

### Manual
1. Hover a site, open panel via tooltip.
2. Move onto an interactive site and confirm auto-open.

## Open Questions

- Should auto-open be disabled for experienced players?
