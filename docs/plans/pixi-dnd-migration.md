# Plan: PixiJS Drag-and-Drop for Combat Damage Assignment

## Problem

HTML drag-and-drop pools (using `@dnd-kit`) are invisible during combat due to z-index stacking context issues between HTML elements and the PixiJS canvas. This is a **fundamental browser limitation** — HTML and canvas exist in separate compositing layers, and no CSS can reliably overlay HTML on canvas across all browsers/scenarios.

## Decision: Move to PixiJS

Rather than continue fighting CSS stacking contexts, implement drag-and-drop natively in PixiJS. This aligns with the existing architecture where all combat visuals are already PixiJS-based (background, enemy tokens, phase rail, hand cards).

**Benefits:**
- Single coordinate system and event model
- Unified z-index hierarchy (already defined in `pixiLayers.ts`)
- GPU-accelerated visual effects during drag
- Eliminates HTML/canvas layering complexity

**Tradeoffs:**
- Loss of built-in keyboard accessibility (documented as known limitation)
- Custom implementation instead of battle-tested library
- Requires reimplementing power line visual effect

---

## Architecture Overview

### State Management

Create a new React context to share drag state between PixiJS components:

```typescript
// New file: contexts/CombatDragContext.tsx

interface DragState {
  isDragging: boolean;
  activeChip: ChipData | null;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  hoveredEnemyId: string | null;
}

interface CombatDragContextValue {
  dragState: DragState;
  startDrag: (chip: ChipData, position: { x: number; y: number }) => void;
  updateDrag: (position: { x: number; y: number }) => void;
  setHoveredEnemy: (instanceId: string | null) => void;
  endDrag: () => { chip: ChipData; enemyId: string } | null;
  cancelDrag: () => void;
}
```

This context is consumed by:
- `PixiAttackPool` / `PixiBlockPool` — initiate drags, render chips
- `PixiEnemyTokens` — detect hover, show highlight, report bounds
- `PixiPowerLine` — render connection line during drag

### Enemy Position Registry

Enemy tokens must expose their bounds for hit-testing. Add to context:

```typescript
interface EnemyBounds {
  instanceId: string;
  bounds: { x: number; y: number; radius: number };
}

// In context:
enemyBounds: Map<string, EnemyBounds>;
registerEnemyBounds: (instanceId: string, bounds: EnemyBounds) => void;
unregisterEnemyBounds: (instanceId: string) => void;
```

`PixiEnemyTokens` registers bounds on mount/update. Pool components hit-test against this registry.

---

## Phase 1: Create CombatDragContext

**File:** `packages/client/src/contexts/CombatDragContext.tsx`

```typescript
import { createContext, useContext, useState, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import type { AttackType, AttackElement } from "@mage-knight/shared";

// Types
export interface DamageChipData {
  id: string;
  attackType: AttackType;
  element: AttackElement;
  amount: number;
  poolType: "attack";
}

export interface BlockChipData {
  id: string;
  element: AttackElement;
  amount: number;
  poolType: "block";
}

export type ChipData = DamageChipData | BlockChipData;

interface Position {
  x: number;
  y: number;
}

interface EnemyBounds {
  instanceId: string;
  x: number;
  y: number;
  radius: number;
}

interface DragState {
  isDragging: boolean;
  activeChip: ChipData | null;
  startPosition: Position | null;
  currentPosition: Position | null;
  hoveredEnemyId: string | null;
}

interface CombatDragContextValue {
  dragState: DragState;
  startDrag: (chip: ChipData, position: Position) => void;
  updateDrag: (position: Position) => void;
  endDrag: () => { chip: ChipData; enemyId: string } | null;
  cancelDrag: () => void;
  registerEnemyBounds: (bounds: EnemyBounds) => void;
  unregisterEnemyBounds: (instanceId: string) => void;
  getHoveredEnemy: (position: Position) => string | null;
}

// Implementation in context provider...
```

**Key implementation details:**
- `getHoveredEnemy()` performs hit-test: `distance(pos, enemy) < enemy.radius`
- `updateDrag()` calls `getHoveredEnemy()` and updates `hoveredEnemyId`
- `endDrag()` returns chip + enemyId if valid drop, null if cancelled

---

## Phase 2: Create PixiAttackPool Component

**File:** `packages/client/src/components/Combat/PixiAttackPool.tsx`

### Texture Loading

Preload element icons on mount (following `PixiEnemyTokens` pattern):

```typescript
const ELEMENT_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/attack.png",
  fire: "/assets/icons/fire_attack.png",
  ice: "/assets/icons/ice_attack.png",
  coldFire: "/assets/icons/cold_fire_attack.png",
};

useEffect(() => {
  const loadTextures = async () => {
    const urls = Object.values(ELEMENT_ICONS);
    await Promise.all(urls.map(url => Assets.load(url).catch(() => {})));
    setTexturesLoaded(true);
  };
  loadTextures();
}, []);
```

### Chip Rendering

Each chip is a Container with:
- Background `Graphics` (rounded rectangle, element-colored)
- `Sprite` for element icon
- `Text` for amount and attack type label

```typescript
const createChip = (chip: DamageChipData): Container => {
  const container = new Container();
  container.eventMode = "static";
  container.cursor = "grab";

  // Background pill
  const bg = new Graphics();
  bg.roundRect(0, 0, CHIP_WIDTH, CHIP_HEIGHT, 8);
  bg.fill({ color: getElementColor(chip.element), alpha: 0.9 });
  bg.stroke({ color: 0x5c4a3a, width: 2 });
  container.addChild(bg);

  // Element icon sprite
  const texture = Assets.get(ELEMENT_ICONS[chip.element]) ?? Texture.EMPTY;
  const icon = new Sprite(texture);
  icon.width = 24;
  icon.height = 24;
  icon.anchor.set(0.5);
  icon.position.set(20, CHIP_HEIGHT / 2);
  container.addChild(icon);

  // Amount text
  const amountText = new Text({
    text: String(chip.amount),
    style: { fontSize: 18, fontWeight: "bold", fill: 0xf0e6d2 }
  });
  amountText.anchor.set(0.5);
  amountText.position.set(CHIP_WIDTH - 30, CHIP_HEIGHT / 2);
  container.addChild(amountText);

  // Type label (R/S/M)
  const typeText = new Text({
    text: TYPE_LABELS[chip.attackType],
    style: { fontSize: 12, fill: 0xb0a090 }
  });
  typeText.anchor.set(0.5);
  typeText.position.set(CHIP_WIDTH - 12, CHIP_HEIGHT / 2);
  container.addChild(typeText);

  return container;
};
```

### Drag Behavior

```typescript
const DRAG_THRESHOLD = 8; // pixels before drag starts

chip.on("pointerdown", (event: FederatedPointerEvent) => {
  // Capture pointer for smooth dragging
  event.target.setPointerCapture?.(event.pointerId);

  dragStartRef.current = {
    pointerId: event.pointerId,
    startX: event.globalX,
    startY: event.globalY,
    chipData: chip.data,
    hasDragStarted: false,
  };
});

// Global pointermove on stage
app.stage.on("pointermove", (event: FederatedPointerEvent) => {
  const dragStart = dragStartRef.current;
  if (!dragStart) return;

  const dx = event.globalX - dragStart.startX;
  const dy = event.globalY - dragStart.startY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // Check threshold
  if (!dragStart.hasDragStarted && distance >= DRAG_THRESHOLD) {
    dragStart.hasDragStarted = true;
    startDrag(dragStart.chipData, { x: dragStart.startX, y: dragStart.startY });
  }

  if (dragStart.hasDragStarted) {
    updateDrag({ x: event.globalX, y: event.globalY });
    updateDragPreview(event.globalX, event.globalY);
  }
});

// Global pointerup
app.stage.on("pointerup", (event: FederatedPointerEvent) => {
  const dragStart = dragStartRef.current;
  if (!dragStart) return;

  event.target.releasePointerCapture?.(event.pointerId);

  if (dragStart.hasDragStarted) {
    const result = endDrag();
    if (result) {
      onAssignDamage(result.chip, result.enemyId);
    }
  }

  dragStartRef.current = null;
  clearDragPreview();
});
```

### Escape Key Cancellation

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape" && dragState.isDragging) {
      e.preventDefault();
      cancelDrag();
      clearDragPreview();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [dragState.isDragging, cancelDrag]);
```

### Visual Feedback During Drag

- **Original chip:** `alpha = 0.4`, `scale = 0.95`
- **Drag preview:** Separate container following cursor, `scale = 1.2`, slight drop shadow
- **Connection line:** Rendered by `PixiPowerLine` component (Phase 4)

---

## Phase 3: Create PixiBlockPool Component

**File:** `packages/client/src/components/Combat/PixiBlockPool.tsx`

Same pattern as `PixiAttackPool` with differences:
- No attack type label (block doesn't have ranged/siege/melee)
- Verdigris/teal color scheme (`0x2e6b5a`)
- Shield icon instead of attack icon
- Only visible during block phase

```typescript
const BLOCK_ICONS: Record<AttackElement, string> = {
  physical: "/assets/icons/block.png",
  fire: "/assets/icons/fire_block.png",
  ice: "/assets/icons/ice_block.png",
  coldFire: "/assets/icons/cold_fire_block.png",
};
```

---

## Phase 4: Create PixiPowerLine Component

**File:** `packages/client/src/components/Combat/PixiPowerLine.tsx`

Reimplements the animated power line from the HTML version using PixiJS Graphics.

```typescript
interface PixiPowerLineProps {
  // Consumes drag state from context
}

export function PixiPowerLine() {
  const { dragState } = useCombatDrag();
  const { app, overlayLayer } = usePixiApp();

  // Only render when dragging
  if (!dragState.isDragging || !dragState.startPosition || !dragState.currentPosition) {
    return null;
  }

  // Render in useEffect
  useEffect(() => {
    const container = new Container();
    container.zIndex = PIXI_Z_INDEX.DRAG_PREVIEW;
    overlayLayer.addChild(container);

    const { startPosition, currentPosition, activeChip } = dragState;
    const color = getElementColor(activeChip?.element ?? "physical");

    // Main line
    const line = new Graphics();
    line.moveTo(startPosition.x, startPosition.y);
    line.lineTo(currentPosition.x, currentPosition.y);
    line.stroke({ color, width: 3, alpha: 0.8 });
    container.addChild(line);

    // Glow line (behind, blurred)
    const glow = new Graphics();
    glow.moveTo(startPosition.x, startPosition.y);
    glow.lineTo(currentPosition.x, currentPosition.y);
    glow.stroke({ color, width: 8, alpha: 0.4 });
    glow.filters = [new BlurFilter({ strength: 8 })];
    container.addChildAt(glow, 0);

    // Animated particles along line (using ticker)
    const particles: Graphics[] = [];
    const particleCount = 3;
    for (let i = 0; i < particleCount; i++) {
      const particle = new Graphics();
      particle.circle(0, 0, 4 - i);
      particle.fill({ color: i === 1 ? 0xffffff : color });
      container.addChild(particle);
      particles.push(particle);
    }

    // Animate particles
    let elapsed = 0;
    const animate = (delta: number) => {
      elapsed += delta * (1 / 60); // Normalize to seconds
      particles.forEach((p, i) => {
        const t = ((elapsed * 2 + i * 0.15) % 1); // 0.5s cycle
        p.x = startPosition.x + (currentPosition.x - startPosition.x) * t;
        p.y = startPosition.y + (currentPosition.y - startPosition.y) * t;
      });
    };
    app.ticker.add(animate);

    // Pulsing origin point
    const origin = new Graphics();
    origin.circle(startPosition.x, startPosition.y, 6);
    origin.fill({ color, alpha: 0.6 });
    container.addChild(origin);

    // Pulse animation on origin
    let pulseElapsed = 0;
    const pulseAnimate = (delta: number) => {
      pulseElapsed += delta * (1 / 60);
      const scale = 1 + 0.3 * Math.sin(pulseElapsed * 8);
      origin.scale.set(scale);
      origin.alpha = 0.6 - 0.3 * Math.sin(pulseElapsed * 8);
    };
    app.ticker.add(pulseAnimate);

    return () => {
      app.ticker.remove(animate);
      app.ticker.remove(pulseAnimate);
      container.destroy({ children: true });
    };
  }, [dragState, app, overlayLayer]);

  return null;
}
```

---

## Phase 5: Update PixiEnemyTokens for Drop Targets

**File:** `packages/client/src/components/Combat/PixiEnemyTokens.tsx`

### Register Bounds

Add to existing component:

```typescript
const { registerEnemyBounds, unregisterEnemyBounds, dragState } = useCombatDrag();

// In the enemy creation loop, after positioning:
registerEnemyBounds({
  instanceId: enemy.instanceId,
  x: pos.x,
  y: pos.y,
  radius: tokenSize / 2,
});

// In cleanup:
return () => {
  enemies.forEach(e => unregisterEnemyBounds(e.enemy.instanceId));
  // ... existing cleanup
};
```

### Highlight on Hover

```typescript
// Add hover highlight effect
useEffect(() => {
  if (!dragState.isDragging) return;

  enemies.forEach(({ enemy }) => {
    const container = tokenContainersRef.current.get(enemy.instanceId);
    if (!container) return;

    const isHovered = dragState.hoveredEnemyId === enemy.instanceId;
    const highlight = container.getChildByLabel("drop-highlight");

    if (isHovered && !highlight) {
      // Add highlight ring
      const ring = new Graphics();
      ring.label = "drop-highlight";
      ring.circle(0, 0, tokenSize / 2 + 12);
      ring.stroke({ color: 0xffd700, width: 4, alpha: 0.8 });
      ring.zIndex = -2;
      container.addChildAt(ring, 0);

      // Scale up slightly
      animManager.animate(`drop-hover-${enemy.instanceId}`, container, {
        endScale: 1.1,
        duration: 100,
        easing: Easing.easeOutQuad,
      });
    } else if (!isHovered && highlight) {
      // Remove highlight
      container.removeChild(highlight);
      highlight.destroy();

      animManager.animate(`drop-hover-${enemy.instanceId}`, container, {
        endScale: 1,
        duration: 100,
        easing: Easing.easeOutQuad,
      });
    }
  });
}, [dragState.hoveredEnemyId, dragState.isDragging, enemies]);
```

### Damage Preview on Hover

Show calculated damage when hovering (reuse existing calculation logic):

```typescript
if (isHovered && !enemy.isDefeated) {
  // Calculate effective damage
  const effectiveDamage = calculateEffectiveDamage(
    dragState.activeChip,
    enemy
  );

  // Show damage preview text
  const preview = new Text({
    text: `-${effectiveDamage}`,
    style: { fontSize: 24, fontWeight: "bold", fill: 0xff4444 }
  });
  preview.label = "damage-preview";
  preview.anchor.set(0.5);
  preview.position.set(0, -tokenSize / 2 - 20);
  container.addChild(preview);
}
```

---

## Phase 6: Update pixiLayers.ts

**File:** `packages/client/src/utils/pixiLayers.ts`

Add new z-index constants:

```typescript
export const PIXI_Z_INDEX = {
  // Background layers
  COMBAT_BACKGROUND: -100,

  // Combat UI (10-99)
  ENEMY_TOKENS: 5,
  PHASE_RAIL: 10,
  SCREEN_EFFECTS: 50,
  TACTIC_CAROUSEL: 60,

  // Interactive layers (100-499)
  HAND: 100,
  ATTACK_POOL: 120,    // NEW - Above hand
  BLOCK_POOL: 120,     // NEW - Above hand

  // Menus and overlays (500-999)
  CONTEXT_MENU: 500,

  // Modal overlays (1000+)
  PIE_MENU: 1000,
  HAND_ACTIVE: 1100,
  DRAG_PREVIEW: 1200,  // NEW - Above everything during drag
  POWER_LINE: 1150,    // NEW - Below drag preview, above active card
} as const;
```

---

## Phase 7: Integration

**File:** `packages/client/src/components/Combat/CombatOverlay.tsx`

### Remove HTML Components

```diff
- import { CombatDnDProvider } from "./DnDContext";
- import { AttackPool } from "./AttackPool/AttackPool";
- import { BlockPool } from "./BlockPool/BlockPool";
+ import { CombatDragProvider } from "../../contexts/CombatDragContext";
+ import { PixiAttackPool } from "./PixiAttackPool";
+ import { PixiBlockPool } from "./PixiBlockPool";
+ import { PixiPowerLine } from "./PixiPowerLine";
```

### Update JSX Structure

```tsx
export function CombatOverlay({ ... }) {
  return (
    <CombatDragProvider onAssignDamage={handleAssignDamage}>
      {/* PixiJS components render to overlay layer, no DOM elements */}
      <PixiAttackPool
        attacks={attackPool}
        visible={phase === "attack"}
      />
      <PixiBlockPool
        blocks={blockPool}
        visible={phase === "block"}
      />
      <PixiPowerLine />

      {/* Enemy tokens already PixiJS */}
      <PixiEnemyTokens enemies={enemyData} onEnemyClick={handleEnemyClick} />

      {/* Keep HTML for detail panels, modals */}
      {selectedEnemy && <EnemyDetailPanel enemy={selectedEnemy} />}
    </CombatDragProvider>
  );
}
```

---

## Phase 8: Cleanup

### Files to Delete

```
packages/client/src/components/Combat/DnDContext.tsx
packages/client/src/components/Combat/AttackPool/AttackPool.tsx
packages/client/src/components/Combat/AttackPool/AttackPool.css
packages/client/src/components/Combat/AttackPool/DamageChip.tsx
packages/client/src/components/Combat/BlockPool/BlockPool.tsx
packages/client/src/components/Combat/BlockPool/BlockPool.css
packages/client/src/components/Combat/BlockPool/BlockChip.tsx
```

### Other Cleanup

- Remove `@dnd-kit/core` from `package.json` if no longer used elsewhere
- Remove debug overlay from `App.tsx` (added during investigation)
- Update any imports that referenced the old components

---

## File Summary

| File | Change |
|------|--------|
| `contexts/CombatDragContext.tsx` | **NEW** - Shared drag state and enemy bounds registry |
| `components/Combat/PixiAttackPool.tsx` | **NEW** - Draggable attack chips |
| `components/Combat/PixiBlockPool.tsx` | **NEW** - Draggable block chips |
| `components/Combat/PixiPowerLine.tsx` | **NEW** - Animated connection line during drag |
| `components/Combat/PixiEnemyTokens.tsx` | Add bounds registration, drop highlighting, damage preview |
| `components/Combat/CombatOverlay.tsx` | Remove HTML pools, integrate PixiJS pools |
| `utils/pixiLayers.ts` | Add ATTACK_POOL, BLOCK_POOL, DRAG_PREVIEW, POWER_LINE z-indexes |
| `App.tsx` | Remove debug overlay |
| `components/Combat/DnDContext.tsx` | **DELETE** |
| `components/Combat/AttackPool/*` | **DELETE** |
| `components/Combat/BlockPool/*` | **DELETE** |

---

## Known Limitations

### Accessibility

This implementation does **not** include keyboard-based damage assignment. The previous `@dnd-kit` implementation had `KeyboardSensor` for Tab/Enter navigation.

**Potential future enhancement:** Add keyboard mode where:
- Tab cycles through enemies
- Enter assigns all matching damage to selected enemy
- Number keys select specific chip types

This is tracked as a separate enhancement, not blocking for initial migration.

### Touch Devices

Pointer events handle touch, but no specific mobile optimizations:
- No hover preview on touch (no hover state)
- May need larger hit targets for fingers
- Test on real devices before shipping

---

## Verification Checklist

1. **Basic drag flow:**
   - [ ] Enter combat at a site with enemies
   - [ ] Play cards to accumulate attack
   - [ ] Verify attack pool chips appear above hand cards
   - [ ] Drag a chip — verify it follows cursor
   - [ ] Verify power line draws from origin to cursor
   - [ ] Drop on enemy — verify action executes
   - [ ] Drag and release NOT on enemy — verify cancels cleanly

2. **Visual feedback:**
   - [ ] Enemy highlights (gold ring) when dragging over it
   - [ ] Enemy scales up slightly on hover
   - [ ] Damage preview shows on hovered enemy
   - [ ] Original chip dims during drag
   - [ ] Drag preview follows cursor at larger scale

3. **Edge cases:**
   - [ ] Press Escape during drag — cancels
   - [ ] Drag outside window and release — cancels cleanly
   - [ ] Multiple chips in pool — all draggable
   - [ ] Defeated enemies don't highlight as drop targets

4. **Block phase:**
   - [ ] Block chips appear during block phase
   - [ ] Block chips have teal color scheme
   - [ ] Block assignment works correctly

5. **Build verification:**
   ```bash
   pnpm build && pnpm lint && pnpm test
   ```

---

## References

- [PixiJS Dragging Example](https://pixijs.com/7.x/examples/events/dragging)
- [PixiJS Pointer Events](https://pixijs.com/guides/components/interaction)
- Existing patterns: `PixiPieMenu.tsx`, `PixiEnemyTokens.tsx`, `PixiPhaseRail.tsx`
- Previous implementation: `DnDContext.tsx`, `DamageChip.tsx`
