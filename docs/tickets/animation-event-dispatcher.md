# Animation Event Dispatcher System

## Summary

The current intro animation system uses pre-calculated setTimeout timings to sequence phases (tiles → enemies → tactics). This approach is brittle and doesn't scale well. An event-based dispatcher system would allow animations to signal completion and trigger downstream animations based on actual state rather than estimated timings.

## Current Problems

### Timing is Guesswork
- JS calculates expected durations (`TILE_STAGGER_MS * count + TILE_ANIMATION_MS`)
- CSS animations run independently with their own timing
- Any mismatch causes phases to overlap or gap awkwardly
- Currently: tactic cards appear during tile animation despite check for `introPhase === "tactics"`

### No Actual Coordination
- Components don't know when others are *actually* done
- We schedule phases based on when we *think* they should complete
- No feedback loop if an animation takes longer/shorter than expected

### Hard to Extend
- Adding a new phase requires recalculating all downstream timings
- Each component needs to know about the full timing chain
- Tightly coupled timing logic spread across context and components

## Proposed Solution: Event Dispatcher

### Core Concept
```typescript
// Components dispatch when they complete
animationDispatcher.emit("tiles-complete");

// Other components listen and react
animationDispatcher.on("tiles-complete", () => {
  // Start enemy animations
});
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 AnimationDispatcher                      │
│  - Manages event subscriptions                          │
│  - Coordinates animation phases                         │
│  - Provides hooks: useAnimationPhase, useOnAnimationEnd │
└─────────────────────────────────────────────────────────┘
         │
         ├── "intro-start" ──────────► TileImages subscribe
         │                                   │
         │                                   ▼
         ├── "tiles-complete" ◄───── Last tile calls onComplete
         │         │
         │         └──────────────► EnemyTokens subscribe
         │                                   │
         │                                   ▼
         ├── "enemies-complete" ◄─── Last enemy calls onComplete
         │         │
         │         └──────────────► TacticHand subscribes
         │                                   │
         │                                   ▼
         └── "intro-complete" ◄───── TacticHand signals done
```

### Key Components

#### AnimationDispatcher Context
```typescript
interface AnimationDispatcher {
  emit: (event: AnimationEvent) => void;
  on: (event: AnimationEvent, callback: () => void) => () => void;
  phase: AnimationPhase;
}
```

#### Tracking Animation Completion
For staggered animations (multiple tiles/enemies), track completion count:
```typescript
const completedCount = useRef(0);
const onAnimationEnd = () => {
  completedCount.current++;
  if (completedCount.current === totalCount) {
    dispatcher.emit("tiles-complete");
  }
};
```

#### CSS Animation Events
Use `onAnimationEnd` callback on animated elements:
```tsx
<g
  className="tile-image--intro"
  onAnimationEnd={handleTileAnimationEnd}
>
```

### Events to Support

| Event | Triggered By | Listened By |
|-------|--------------|-------------|
| `intro-start` | HexGrid on first load | TileImage |
| `tiles-complete` | Last TileImage animationEnd | EnemyToken, dispatcher |
| `enemies-complete` | Last EnemyToken animationEnd | TacticHand, dispatcher |
| `tactics-complete` | TacticHand deal animation end | App (for dimming) |
| `intro-complete` | Dispatcher after all phases | Any component needing to know |

### Benefits

1. **Actual Sequencing** - Phases transition when animations *actually* complete
2. **Resilient to Timing Changes** - CSS duration changes don't break JS coordination
3. **Easy to Extend** - Add new phases by emitting/listening to new events
4. **Debugging** - Can log all events to trace animation flow
5. **Reusable** - Same system works for other animation sequences (combat, rewards, etc.)

## Migration Path

1. Create `AnimationDispatcher` context alongside existing `GameIntroContext`
2. Add `onAnimationEnd` handlers to TileImage, EnemyToken
3. Have TacticHand listen for `enemies-complete` instead of checking phase
4. Deprecate setTimeout-based phase transitions
5. Remove timing constants from GameIntroContext

## Future Uses

This dispatcher pattern could coordinate other multi-step animations:
- Combat entry sequence (board dims → overlay slides in → enemies arrange)
- Reward selection (cards fan out → selection → card flies to deck)
- Round transition (board state changes → day/night shift → new tactic deal)
- Tile exploration (ghost hex pulses → tile reveals → enemies flip)

## Acceptance Criteria

- [ ] Tactic cards wait for enemies to *actually* finish animating
- [ ] No setTimeout-based phase transitions for intro sequence
- [ ] Animation timing changes in CSS don't require JS updates
- [ ] Console shows event flow: `intro-start → tiles-complete → enemies-complete → tactics-complete`
