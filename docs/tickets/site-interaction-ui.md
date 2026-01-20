# Ticket: Site Interaction UI System

**Created:** January 2025
**Updated:** January 2025
**Priority:** Medium
**Complexity:** Medium
**Status:** In Progress
**Affects:** Client UI, valid actions, site system
**Authoritative:** No

---

## Summary

Site interaction UI is partially implemented: server exposes `SiteOptions`, and client has HexContextMenu + SitePanel. Some actions (heal, recruit, buy spell/AA) still need wiring.

## Problem Statement

While site info and context menus exist, several interactions are still placeholders and not fully wired to actions or UI flows.

## Current Behavior

- `getSiteOptions` produces detailed site info in valid actions (`packages/core/src/engine/validActions/sites.ts`).
- `HexContextMenu` renders enter/interact/end turn options but several handlers are TODO (`packages/client/src/components/HexContextMenu/HexContextMenu.tsx`).
- `SitePanel` and `HexTooltip` provide site info UI (`packages/client/src/components/SitePanel/SitePanel.tsx`).

## Expected Behavior

- All site interactions should be discoverable and actionable through the UI.
- “Enter” should start adventure site combat; “Interact” options should open or trigger the relevant flows.

## Scope

### In Scope
- Wire recruit/heal/buy spell/buy AA actions from the context menu to actual flows.
- Ensure site info panels remain accurate and consistent.

### Out of Scope
- Major redesign of site UI.

## Proposed Approach

- Hook context menu actions to existing offer views and interaction actions.
- Add small UI prompts for heal if needed.

## Implementation Notes

- Server: `packages/core/src/engine/validActions/sites.ts`
- Client: `packages/client/src/components/HexContextMenu/HexContextMenu.tsx`
- UI panels: `packages/client/src/components/SitePanel/SitePanel.tsx`

## Acceptance Criteria

- [ ] Interact actions are fully wired (recruit/heal/buy spell/buy AA).
- [ ] Enter action launches the correct site flow.
- [ ] Site panels match the action availability.

## Test Plan

### Manual
1. Move onto a village/monastery and open the context menu.
2. Use each action and verify the correct flow starts.

## Open Questions

- Should the context menu always appear or only when ending movement?
