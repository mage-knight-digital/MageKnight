# Offer View Design Plan

> **Backend Status**: The `BUY_SPELL` and `LEARN_ADVANCED_ACTION` commands are implemented.
> See `docs/tickets/spell-aa-purchase-commands.md` for details.
> This document covers the remaining **UI work**.

## The Fantasy

In Mage Knight, you're seated at a table with the map spread before you. The offers aren't UI elements - they're physical card rows laid out on the table, just beyond the map. When you "look up" (press W from board view), you lift your gaze from the hex tiles to the merchandise the game is presenting.

An **invisible Dungeon Master** is your host. They slide trays of units, spells, and advanced actions toward you for consideration. When you return to the map, they pull the wares back. The game has presence.

---

## Navigation Model

### Vertical Axis (W/S) - "Eye Level"

```
         ↑ W
    [OFFER]  ← Looking up at the offer row
         ↓ S
    [BOARD]  ← Map focused, hand hidden
         ↓ S
    [READY]  ← Hand peeking
         ↓ S
    [FOCUS]  ← Hand large, studying cards
```

Four stops: `offer` → `board` → `ready` → `focus`

### Horizontal Axis (A/D) - Context-Dependent Carousel

**In Offer View:**
- Units | Spells | Advanced Actions

**In Hand Views (board/ready/focus):**
- Tactics | Cards | Units (existing behavior)

---

## Animation Design

### Entering Offer View (W from board)

**Timing: ~400ms total**

1. **Anticipation (0-80ms)**
   - Brief pause before motion begins
   - Map begins to dim and shift slightly downward
   - TODO Sound: Soft intake breath / subtle tension rise

2. **Tray Entrance (80-350ms)**
   - Offer tray slides in from above
   - Easing: `cubic-bezier(0.34, 1.56, 0.64, 1)` - fast entrance, slight overshoot, gentle settle
   - Nearly opaque dark overlay fades in over the map (90% opacity)
   - TODO Sound: Wood-on-felt slide, like pushing cards across a tavern table

3. **Card Stagger (200-400ms)**
   - Cards appear with 50ms stagger between each
   - Each card has subtle random rotation (-8° to +8°) - Inscryption style
   - Micro-bounce on settle (overshoot 3-5px, then rest)
   - TODO Sound: Soft card placement sounds, slightly varied pitch per card

4. **Settle (350-400ms)**
   - Shadow beneath tray fades in (depth cue)
   - Tray fully at rest
   - TODO Sound: Gentle wooden "thunk" as tray settles

### Exiting Offer View (S from offer)

**Timing: ~300ms total (faster than entrance - snappier return)**

1. **Lift-off (0-50ms)**
   - Cards do tiny lift (2-3px) - anticipation of departure
   - TODO Sound: Quick intake, cards lifting

2. **Tray Exit (50-250ms)**
   - Tray slides UP and away (pulled back by invisible hand)
   - Easing: `cubic-bezier(0.36, 0, 0.66, -0.56)` - accelerates out
   - Overlay fades out
   - TODO Sound: Reverse slide sound, slightly faster

3. **Map Return (200-300ms)**
   - Map brightens, shifts back to center
   - Brief delay before hand interactions re-enable (refocusing)

### Carousel Transitions (A/D in Offer View)

**Timing: ~350ms with overlap**

- Current tray slides off horizontally (opposite direction of input)
- New tray slides in from input direction
- **Overlap**: New tray starts at 100ms, before old tray fully exits
- Creates sense of trays being swapped by the invisible DM

**Per-Category Character:**
- **Units**: Heavier feel, slightly slower settle (150ms ease-out tail) - these are creatures/people
- **Spells**: Lighter, more fluid (shorter ease, subtle shimmer?) - magical
- **AAs**: Solid, precise timing - martial/skilled

TODO Sound: Cards shuffling/fanning when switching, different texture per category

---

## Visual Design

### Offer Tray

```
┌────────────────────────────────────────────────────┐
│                                                    │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐ │
│  │      │  │      │  │      │  │      │  │      │ │
│  │ Card │  │ Card │  │ Card │  │ Card │  │ Card │ │
│  │  -5° │  │  +7° │  │  -3° │  │  +6° │  │  -8° │ │  ← Random rotations
│  │      │  │      │  │      │  │      │  │      │ │
│  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘ │
│                                                    │
│  [Recruit]           [Acquire]      [Learn]       │  ← Buttons only when valid
│                                                    │
└────────────────────────────────────────────────────┘
         ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░             ← Soft shadow beneath
```

### Card Rotations (Inscryption Style)

Each card gets a pseudo-random rotation on render:
- Range: -8° to +8°
- Seeded by card index or ID (consistent per position)
- Creates organic "laid out by hand" feel
- On hover: card straightens to 0° (snaps to attention)

### Card Hover States

When hovering an acquirable card:
- Card lifts toward viewer (translateY -15px, slight scale 1.05)
- Rotation snaps to 0° (straightens up)
- Soft glow appears (color based on card type)
- TODO Sound: Subtle "hmm?" / consideration sound - short breath or soft tap

When hovering non-acquirable card:
- Same lift but muted (translateY -8px, no scale)
- Slight desaturation
- No glow

### Map Overlay

- Nearly opaque: `rgba(15, 12, 10, 0.90)` - dark brown-black
- Subtle texture/grain (optional, might be too heavy)
- Map still barely visible - you know it's there, but focus is entirely on offers
- Vignette toward edges to further focus attention

### Pane Indicator

```
   [ Units ]  •  [ Spells ]  •  [ AAs ]
              ← A            D →
```

- Subtle dots as dividers
- Active pane slightly brighter, underlined
- Inactive panes dimmed but visible
- Positioned at bottom of offer area

---

## Component Structure

### New Components

1. **OfferView** - Container for the offer layer
   - Manages overlay opacity
   - Handles enter/exit animations
   - Contains carousel logic for offer panes

2. **OfferTray** - Individual tray component
   - Handles tray slide animations
   - Contains cards in a row
   - Shadow element

3. **OfferCard** - Single card in offer
   - Random rotation logic
   - Hover lift behavior
   - Acquire button integration

### Modified Components

1. **PlayerHand.tsx**
   - Extend `HandView` type: add `"offer"` to the union
   - W from `board` transitions to `offer`
   - S from `offer` transitions to `board`
   - Carousel context switches based on view level

2. **App.tsx**
   - Remove `<OffersBar />` component
   - Add `<OfferView />` component (conditionally rendered or always present but hidden)

### Files to Create

```
packages/client/src/components/OfferView/
├── OfferView.tsx        # Main container
├── OfferView.css        # Styles & animations
├── OfferTray.tsx        # Tray with slide animation
├── OfferCard.tsx        # Individual card with rotation
├── UnitOfferPane.tsx    # Unit-specific layout
├── SpellOfferPane.tsx   # Spell-specific layout
├── AAOfferPane.tsx      # Advanced Action layout
└── index.ts             # Exports
```

### Files to Modify

```
packages/client/src/components/Hand/PlayerHand.tsx  # Navigation logic
packages/client/src/App.tsx                          # Remove OffersBar, add OfferView
```

### Files to Delete

```
packages/client/src/components/OffersBar/           # Entire directory (after migration)
```

---

## Interaction Design

### Acquiring Cards

Action types implemented:
- `RECRUIT_UNIT_ACTION` for units ✅
- `BUY_SPELL_ACTION` for spells at Mage Towers (7 influence) ✅
- `LEARN_ADVANCED_ACTION_ACTION` for AAs (monastery: 6 influence, level-up: free) ✅

The offer view shows acquire buttons only when `validActions` permits:
- During level-up reward selection (spell or AA choice)
- When at a village/monastery with influence to spend
- When recruiting units with sufficient influence

No separate "acquisition mode" - the buttons appear when valid, invisible when not.

### Keyboard Flow

```
Player at map, hand in ready mode:

  W → board view (hand hidden)
  W → OFFER VIEW (tray slides in, units showing)

  D → spells tray slides in
  D → AAs tray slides in
  A → back to spells

  S → EXIT offer view, back to board
  S → ready view (hand peeks)
```

### Mouse/Touch

- Click outside tray = exit offer view (same as S)
- Click card = select for details (if we add detail view later)
- Click acquire button = execute action

---

## Sound Design Roadmap

All sounds should be sourced from Epidemic Sound or similar. Mood: **tavern, wood, cloth, cards, intimate**

| Moment | Sound Type | Mood/Feel |
|--------|-----------|-----------|
| Enter offer view (anticipation) | Soft breath / tension rise | Something's coming |
| Tray slides in | Wood on felt, smooth slide | Merchant presenting wares |
| Cards stagger in | Soft card placements, varied pitch | Being laid out by hand |
| Tray settles | Gentle wooden thunk | Solid, grounded |
| Carousel switch | Cards shuffling/fanning | Swapping inventory |
| Card hover (acquirable) | Soft tap or "hmm" breath | Consideration |
| Card hover (not acquirable) | Nothing or very subtle | Don't draw attention |
| Acquire card | Satisfying snap/deal | Transaction complete |
| Exit offer view | Reverse slide, quicker | Pulled away |

---

## Implementation Order

1. **Create OfferView shell** - Empty component with overlay, mount in App
2. **Wire navigation** - W/S to enter/exit offer view from PlayerHand
3. **Build OfferTray** - Static layout first, no animation
4. **Add UnitOfferPane** - Port unit content from old OffersBar
5. **Add card rotations** - Inscryption-style random tilts
6. **Add enter animation** - Tray slide + card stagger
7. **Add exit animation** - Reverse slide
8. **Add carousel** - A/D navigation between offer panes
9. **Add SpellOfferPane and AAOfferPane** - Port remaining content
10. **Add hover states** - Card lift, glow
11. **Remove old OffersBar** - Delete after everything works
12. **Polish** - Timing tweaks, sound integration points

---

## Open Questions (Deferred)

- **Fame/Reputation track**: Could be 4th pane in offer carousel, or separate UI. Decide later.
- **Event Log**: Find new home or remove entirely. Not part of offer view.
- **Level-up flow**: When level-up triggers, should we auto-navigate to offer view? Or show modal?
- **Detail view**: Should clicking a card show larger detail? Or is hover enough?
