# PixiJS Combat Overlay Migration

## Problem Statement

The current combat overlay is HTML/CSS-based, while the hand/cards are PixiJS-based. This creates constant click handling conflicts because:
- The PixiJS canvas uses document-level event listeners
- HTML elements sit in a separate z-order hierarchy
- We have fragile workarounds toggling `pointer-events` based on overlay state

**Goal:** Migrate the combat overlay to PixiJS so everything uses one unified event system.

## Current Architecture

### Layer Structure (PixiAppContext)
```
Stage
├── worldLayer (hex grid, tiles, enemies on map)
├── overlayLayer (floating hand, pie menu - screen-space, not affected by camera)
```

### During Combat Currently
1. CSS class `app--combat` is added to root
2. HTML `CombatOverlay` component renders with:
   - Gradient background (CSS `radial-gradient`)
   - Site sprite backdrop (CSS `background-image` with sprite sheet positioning)
   - Phase rail (HTML buttons)
   - Enemy tokens (HTML with images)
   - Various allocation UI
3. PixiJS canvas has `pointer-events` toggled based on `isOverlayActive`
4. Hand renders in PixiJS overlay layer on top

### Reference Implementations
- `PixiCardActionMenu.tsx` - PixiJS buttons, text, circular layout
- `PixiFloatingHand.tsx` - Sprites, animations, document-level event handling
- `AnimationManager` in `pixi/animations.ts` - Tweening system

## Migration Plan - Stupidly Incremental

### Phase 0: Red Rectangle (MUST COMPLETE FIRST)
**Goal:** Prove we can render anything in PixiJS during combat in the right place.

1. Create `packages/client/src/components/Combat/PixiCombatOverlay.tsx`
2. Use `usePixiApp()` to get the app and overlay layer
3. When `state.combat` exists:
   - Create a `Graphics` object
   - Draw a red rectangle filling the screen
   - Add it to a new combat layer (or overlay layer with low zIndex)
4. When combat ends, remove it

**Success criteria:** Red rectangle visible during combat, disappears when combat ends, doesn't break existing functionality.

**If this fails:** Debug layer ordering. The rectangle might be behind the world layer or not added to the stage at all.

### Phase 1: Gradient Background
Replace the red rectangle with the actual gradient.

```typescript
// Create gradient texture
const canvas = document.createElement('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const ctx = canvas.getContext('2d')!;

// Radial gradient matching CSS
const gradient = ctx.createRadialGradient(
  canvas.width / 2, canvas.height / 2, 0,
  canvas.width / 2, canvas.height / 2, canvas.width * 0.7
);
gradient.addColorStop(0, 'rgba(26, 29, 46, 0.98)');
gradient.addColorStop(0.5, 'rgba(15, 15, 25, 0.98)');
gradient.addColorStop(1, 'rgba(10, 10, 18, 0.99)');

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, canvas.width, canvas.height);

const texture = Texture.from(canvas);
const background = new Sprite(texture);
```

### Phase 2: Site Backdrop Sprite
Add the site/enemy backdrop image on top of gradient.

1. Load the sprite sheet texture
2. Create a sprite with the appropriate frame (use `SITE_SPRITE_MAP` from current `CombatOverlay.tsx`)
3. Position centered, apply opacity/blur filters
4. Layer on top of gradient

### Phase 3: Verify Clicks Still Work
At this point we have a PixiJS backdrop but still HTML UI on top.

Test:
- [ ] Combat buttons (Continue, etc.) still clickable
- [ ] Enemy tokens still clickable
- [ ] Hand cards still playable
- [ ] Pie menu still works

If clicks break, the issue is likely z-index or pointer-events on the canvas.

### Phase 4: Phase Rail
Move the phase rail to PixiJS.

Reference: `PixiCardActionMenu.tsx` for button patterns
- `Graphics.roundRect()` for button backgrounds
- `Text` for labels
- `eventMode: 'static'` for click handling

### Phase 5: Enemy Tokens
Move enemy token rendering to PixiJS.

- Circular mask on enemy sprite: use `Graphics` as mask
- Health bars: `Graphics` rectangles
- Defeated state: tint/alpha changes
- Click handling: PixiJS `pointertap` event

### Phase 6: Allocation UI (+/- buttons, damage assignment)
The most complex part. Consider keeping as HTML initially if too complex.

### Phase 7: Cleanup
- Remove HTML `CombatOverlay.tsx`
- Remove CSS combat pointer-events hacks
- Remove `isOverlayActive` workarounds in `EnemyCard.tsx`

## Key Technical Notes

### Adding a Combat Layer
You may want a dedicated combat layer between world and overlay:

```typescript
// In PixiAppContext or similar
const combatLayer = new Container();
combatLayer.label = 'combat-layer';
combatLayer.sortableChildren = true;
stage.addChild(combatLayer);
// Ensure it's between world and overlay
combatLayer.zIndex = 50; // world is lower, overlay is higher
```

### Screen-Space Rendering
Combat overlay should NOT be affected by camera pan/zoom. Either:
- Add to `overlayLayer` (already screen-space)
- Or create a new screen-space layer

### Previous Failure Mode
Last attempt showed "everything dimmed, nothing interactable" because:
- Combat layer was likely behind world layer (wrong z-index)
- Or world layer wasn't being hidden during combat
- Or combat container wasn't actually added to stage

**Debug tip:** Add `console.log(app.stage.children.map(c => c.label))` to verify layer order.

## Files to Reference

| Purpose | File |
|---------|------|
| Current HTML combat overlay | `packages/client/src/components/Combat/CombatOverlay.tsx` |
| Current combat CSS/colors | `packages/client/src/components/Combat/CombatOverlay.css` |
| PixiJS button/text patterns | `packages/client/src/components/CardActionMenu/PixiCardActionMenu.tsx` |
| PixiJS sprite/animation patterns | `packages/client/src/components/Hand/PixiFloatingHand.tsx` |
| Layer management | `packages/client/src/contexts/PixiAppContext.tsx` |
| Animation system | `packages/client/src/components/GameBoard/pixi/animations.ts` |

## Definition of Done

- [ ] Combat overlay renders entirely in PixiJS
- [ ] All combat interactions work (phase advance, enemy targeting, damage assignment)
- [ ] Hand cards still playable during combat
- [ ] No `pointer-events` CSS hacks needed
- [ ] Can delete `isOverlayActive` checks from non-overlay components
