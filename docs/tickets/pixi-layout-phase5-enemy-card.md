# @pixi/layout Phase 5: PixiEnemyCard Migration

## Implementation Status: Complete ✅

**Completed (Phase 5a - Outer Container Migration):**
- [x] Added enemy card layout utilities to `pixiLayout.ts`
- [x] Added `@pixi/layout` side-effect import to PixiEnemyCard.tsx
- [x] Refactored `createButton()` and `createPlusMinus()` to use options objects with optional layout support
- [x] Enabled `enemyCardRootLayout()` on root container (vertical flex, centered)
- [x] Migrated name section to layout (fixed height, centered content)
- [x] Migrated badge sections (DEFEATED/BLOCKED) to layout with `enemyCardBadgeLayout()`
- [x] Migrated damage button to layout mode (`useLayout: true`)
- [x] Migrated block section outer container to layout (fixed width/height)
- [x] Migrated attack section outer container to layout (fixed width/height)
- [x] Removed all vestigial `yOffset` tracking code

**Completed (Phase 5b - Internal Layouts):**
- [x] Block section internal elements migrated to layout (removed `blockY` positioning)
- [x] Attack section internal elements migrated to layout (removed `attackY` positioning)
- [x] Controls row (+/- buttons) internal layout migrated (removed `controlX` positioning)
- [x] Added `enemyCardInfoRowLayout()` for left-aligned swift/element info rows
- [x] Added `enemyCardSectionContentLayout()` for inner content containers
- [x] All text elements wrapped in row containers with centered or left-aligned layouts

---

## Overview

Migrate `PixiEnemyCard.tsx` from manual positioning (yOffset tracking) to declarative `@pixi/layout` flexbox. This is the largest combat UI component not yet using the layout system.

**Original State:** 1001 lines with manual `yOffset` tracking, explicit `x`/`y` positioning, and manual background height calculations.

**Final State (Post Phase 5b):** Full declarative layouts for all elements. Root container uses layout for section stacking. Block/attack sections use `enemyCardSectionContentLayout()` for internal positioning. Controls use `enemyCardControlsRowLayout()` and `enemyCardElementGroupLayout()`. All manual `blockY`, `attackY`, and `controlX` tracking removed.

## Background

### @pixi/layout Key Concepts

From the [official docs](https://layout.pixijs.io/):

1. **Opt-in system** - Layout only applies to containers with `layout` property set
2. **Yoga-powered** - Facebook's flexbox engine, CSS-like properties
3. **Automatic sizing** - Can use fixed sizes or intrinsic (content-based) sizing
4. **Key gotcha** - When layout is enabled, `anchor` and `pivot` are ignored; use `transformOrigin` instead

### Existing Patterns

From `PixiBlockPool.tsx` and `PixiAttackPool.tsx`:

```typescript
import "@pixi/layout"; // Side-effect import for types

// Parent container with flex layout
chipsContainer.layout = chipRowLayout(); // { flexDirection: "row", gap, alignItems: "center" }

// Child with fixed size (participates in parent layout)
container.layout = {
  width: CHIP_WIDTH,
  height: CHIP_HEIGHT,
};
```

### Existing Utilities (`pixiLayout.ts`)

Already prepared for this migration:
- `cardLayout()` - column with padding and fixed width (280px)
- `cardControlsLayout()` - row with space-between for buttons
- `rowLayout(gap)` / `columnLayout(gap)` - basic flex helpers
- `centeredLayout` / `spaceBetweenLayout` - alignment presets
- `mergeLayouts()` - compose layout objects

## Current Structure Analysis

`PixiEnemyCard.tsx` builds cards for each enemy with these sections:

```
container (root for single enemy)
├── nameContainer (y = 0, name text centered)
├── [badge] (if defeated/blocked - y = yOffset)
├── [damageBtn] (if damage phase - y = yOffset)
├── [blockContainer] (if block phase)
│   ├── bg (Graphics - manually sized to bgHeight)
│   ├── blockLabel (text centered)
│   ├── progressText (X/Y centered)
│   ├── canBlockText (optional)
│   ├── swiftText (optional)
│   ├── elementText (optional)
│   ├── controlsRow (container with +/- buttons)
│   └── commitBtn (optional)
└── [attackContainer] (if attack phase)
    ├── bg (Graphics - manually sized)
    ├── attackLabel (text centered)
    ├── progressText (X/Y centered)
    ├── canDefeatText (optional)
    ├── resistRow (optional)
    ├── controlsRow (container with +/- buttons)
    └── hints (optional)
```

**Pain Points:**
1. Manual `yOffset` accumulation throughout `buildEnemyCard()`
2. Manual `bgHeight` calculation for block/attack containers
3. Explicit `x`/`y` positioning on every element
4. Text elements use `anchor.set(0.5, 0)` which conflicts with layout (anchor ignored)

## Migration Plan

### Phase 5.1: Setup and Infrastructure

1. **Update `pixiLayout.ts`** with PixiEnemyCard-specific presets:
   ```typescript
   export const ENEMY_CARD_CONSTANTS = {
     CARD_WIDTH: 200,
     CARD_PADDING: 10,
     ROW_GAP: 6,
     SECTION_GAP: 8,
   };

   export function enemyCardLayout(): Partial<LayoutStyles> {
     return {
       flexDirection: "column",
       gap: ENEMY_CARD_CONSTANTS.ROW_GAP,
       alignItems: "center",
       width: ENEMY_CARD_CONSTANTS.CARD_WIDTH,
     };
   }

   export function enemyCardSectionLayout(): Partial<LayoutStyles> {
     return {
       flexDirection: "column",
       gap: ENEMY_CARD_CONSTANTS.ROW_GAP,
       alignItems: "center",
       padding: ENEMY_CARD_CONSTANTS.CARD_PADDING,
       width: ENEMY_CARD_CONSTANTS.CARD_WIDTH,
     };
   }

   export function controlsRowLayout(): Partial<LayoutStyles> {
     return {
       flexDirection: "row",
       gap: 4,
       alignItems: "center",
     };
   }
   ```

2. **Add `@pixi/layout` import** to PixiEnemyCard.tsx:
   ```typescript
   import "@pixi/layout";
   ```

### Phase 5.2: Migrate Name and Badge Section

**Before:**
```typescript
const nameContainer = new Container();
nameContainer.y = yOffset;
// ...
nameText.anchor.set(0.5, 0);
// ...
yOffset += 20;

if (enemy.isDefeated) {
  const badge = new Container();
  badge.y = yOffset;
  // ...
  yOffset += BADGE_HEIGHT + ROW_GAP;
}
```

**After:**
```typescript
// Root uses column layout
container.layout = enemyCardLayout();

// Name section
const nameContainer = new Container();
nameContainer.layout = { height: 20 }; // Fixed height, inherits width
const nameText = new Text({ ... });
// No anchor - layout handles centering
nameContainer.addChild(nameText);
container.addChild(nameContainer);

// Badge (conditionally added)
if (enemy.isDefeated) {
  const badge = new Container();
  badge.layout = mergeLayouts(centeredLayout, { height: BADGE_HEIGHT });
  // ... bg and text
  container.addChild(badge);
}
```

**Key Changes:**
- Remove all `yOffset` tracking
- Remove `anchor.set()` calls - use layout alignment instead
- Use `height` in layout for fixed-height sections

### Phase 5.3: Migrate Block Allocation Section

This is the most complex section with dynamic content.

**Current Structure:**
```typescript
const blockContainer = new Container();
blockContainer.y = yOffset;
blockContainer.x = -CARD_WIDTH / 2;

// Manual bgHeight calculation (54 + conditionals)
let bgHeight = 54;
if (blockState.canBlock) bgHeight += 16;
if (blockState.isSwift) bgHeight += 14;
// ...

const bg = new Graphics();
// Draw bg with calculated height
```

**After Structure:**
```typescript
const blockSection = new Container();
blockSection.layout = enemyCardSectionLayout();

// Background will be handled differently:
// Option A: Use LayoutContainer with backgroundColor
// Option B: Create bg Graphics after layout pass
// Option C: Use fixed bg and let content overflow (not ideal)

// Recommended: Option A with LayoutContainer
import { LayoutContainer } from "@pixi/layout";

const blockSection = new LayoutContainer();
blockSection.layout = {
  ...enemyCardSectionLayout(),
  backgroundColor: COLORS.CARD_BG,
  borderRadius: 6,
  // border support TBD
};
```

**Note:** `@pixi/layout` v3 supports `backgroundColor` and `borderRadius` on LayoutContainer, which eliminates manual bg sizing.

### Phase 5.4: Migrate Controls Row

**Before:**
```typescript
const controlsRow = new Container();
controlsRow.y = blockY;
controlsRow.x = CARD_PADDING;

let controlX = 0;
for (const element of elements) {
  iconText.x = controlX;
  controlX += 18;
  minusBtn.x = controlX;
  controlX += BTN_SIZE + 2;
  // ...
}
```

**After:**
```typescript
const controlsRow = new Container();
controlsRow.layout = controlsRowLayout();

for (const element of elements) {
  const elementGroup = new Container();
  elementGroup.layout = rowLayout(2); // gap between icon/buttons

  const iconText = new Text({ ... });
  iconText.layout = { width: 18 }; // Fixed width

  const minusBtn = createPlusMinus("minus", ...);
  minusBtn.layout = { width: BTN_SIZE, height: BTN_SIZE };

  const plusBtn = createPlusMinus("plus", ...);
  plusBtn.layout = { width: BTN_SIZE, height: BTN_SIZE };

  elementGroup.addChild(iconText, minusBtn, plusBtn);
  controlsRow.addChild(elementGroup);
}
```

### Phase 5.5: Migrate Attack Allocation Section

Same pattern as block section:

1. Use `LayoutContainer` with `backgroundColor` for automatic bg sizing
2. Column layout for vertical stacking
3. `controlsRowLayout()` for +/- button rows
4. Remove all manual `attackY` tracking

### Phase 5.6: Update Button Helpers

`createButton()` and `createPlusMinus()` currently set `x`/`y` directly:

```typescript
function createButton(label, x, y, width, height, ...): Container {
  const container = new Container();
  container.x = x;  // Remove this
  container.y = y;  // Remove this
  // ...
}
```

**After:**
```typescript
function createButton(label, width, height, bgColor, textColor, onClick, disabled, fontSize): Container {
  const container = new Container();
  container.layout = { width, height };
  // ... rest unchanged
  return container;
}
```

Callers no longer pass position - layout handles it.

### Phase 5.7: Handle Text Centering

**Problem:** Layout ignores `anchor`. Current code uses `anchor.set(0.5, 0)` for centering.

**Solution:** Wrap text in containers with centered layout:

```typescript
// Before
const text = new Text({ ... });
text.anchor.set(0.5, 0);
text.x = CARD_WIDTH / 2;
container.addChild(text);

// After
const textWrapper = new Container();
textWrapper.layout = mergeLayouts(centeredLayout, { width: "100%" });
const text = new Text({ ... });
textWrapper.addChild(text);
container.addChild(textWrapper);
```

Or use the layout's built-in centering:
```typescript
container.layout = {
  ...columnLayout(),
  alignItems: "center", // Centers children horizontally
};
const text = new Text({ ... });
text.layout = {}; // Opt-in to layout (intrinsic sizing)
container.addChild(text);
```

## Implementation Order

1. **5.1** - Add layout utilities, import side-effect
2. **5.6** - Update helper functions first (createButton, createPlusMinus)
3. **5.2** - Migrate name + badge (simplest section)
4. **5.4** - Migrate a single controls row (test pattern)
5. **5.3** - Migrate full block section
6. **5.5** - Migrate attack section (same pattern)
7. **5.7** - Fix any text centering issues
8. **Cleanup** - Remove yOffset/bgHeight calculations, simplify code

## Testing Checklist

- [ ] Name text displays centered below token
- [ ] DEFEATED/BLOCKED badges appear correctly
- [ ] Block allocation UI shows with correct sections
- [ ] +/- buttons work and are properly spaced
- [ ] Commit button appears when pending block exists
- [ ] Attack allocation UI shows correctly
- [ ] Can Defeat pulse animation still works
- [ ] Resistance warnings display properly
- [ ] Damage assignment button shows in damage phase
- [ ] Entry animation (fade + scale) still works
- [ ] Multiple enemies render without overlap
- [ ] Window resize doesn't break layout

## Estimated Impact

**Lines reduced:** ~100-150 (removing manual positioning code)

**Benefits:**
- Automatic background sizing (no more manual bgHeight calculation)
- Easier to add/remove conditional sections
- Consistent spacing via gap property
- Self-documenting layout structure
- Foundation for future responsive layouts

## Files to Modify

1. `packages/client/src/utils/pixiLayout.ts` - Add enemy card presets
2. `packages/client/src/components/Combat/PixiEnemyCard.tsx` - Main migration

## References

- [@pixi/layout Documentation](https://layout.pixijs.io/)
- [Flexbox Styles Guide](https://layout.pixijs.io/docs/guides/styles/flexbox-layout/)
- [Quick Start](https://layout.pixijs.io/docs/guides/guide/quick-start/)
- Existing patterns: `PixiBlockPool.tsx`, `PixiAttackPool.tsx`
