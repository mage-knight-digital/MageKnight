# Healing Points Lost on Combat Entry

## Summary

When a player enters combat, any unspent healing points they have accumulated should be discarded. This is an edge case but easy to forget.

## Rule Reference

From rulebook (line 929):
> "Any unspent Healing points disappear when entering combat."

## Current State

Unknown - need to verify if this is currently implemented.

## Implementation

When combat is initiated:
1. Check if player has any accumulated healing points
2. If so, discard them (set to 0)
3. Emit an event so the UI can inform the player (optional but nice UX)

## Undo Considerations

If combat is undone (before any irreversible action like revealing enemy tokens), the healing points should be restored to their pre-combat value. This means:

- Store healing points value before clearing on combat entry
- If combat is undone, restore the stored value
- Once combat becomes irreversible (enemy tokens revealed, dice rolled, etc.), the stored value can be discarded

## Testing

- [ ] Player with 0 healing points enters combat - no change
- [ ] Player with healing points enters combat - points are cleared
- [ ] Player generates healing, enters combat, healing is cleared, then undoes combat entry - healing points are restored
- [ ] Player enters combat (healing cleared), combat becomes irreversible, undo no longer available - healing stays at 0
- [ ] Healing points generated AFTER combat ends are not affected by this rule
