# Rendering Architecture Analysis for PixiJS Migration

## 1. Rendering Architecture: What's in the DOM

### Hex Grid/Tiles
- **Technology**: SVG (`<svg>` element with `viewBox`)
- **Location**: `packages/client/src/components/GameBoard/HexGrid.tsx`
- **Structure**:
  - Single `<svg>` element with dynamic `viewBox` that adjusts to visible hexes
  - Tile artwork: `<image>` elements positioned at tile center coordinates
  - Hex overlays: `<polygon>` elements for hitboxes and movement highlights
  - Path previews: `<polyline>` elements for movement path visualization
  - Hero token: `<circle>` or `<image>` for player position
  - Enemy tokens: `<image>` elements with circular clipping paths
  - Ghost hexes: `<polygon>` + `<text>` for explore options

**Sample DOM structure** (from HexGrid.tsx:1525-1666):
```html
<svg viewBox="minX minY width height" className="hex-grid">
  <defs>
    <radialGradient id="bloomGradient">...</radialGradient>
  </defs>
  
  <!-- Layer 1: Tile images -->
  <g className="tile-image--intro">
    <image href="/assets/tiles/..." x="..." y="..." width="..." height="..." />
  </g>
  
  <!-- Layer 2: Path lines -->
  <g className="path-line">
    <polyline points="..." stroke="#00FF00" />
  </g>
  
  <!-- Layer 3: Hex overlays -->
  <g transform="translate(x, y)" onClick={...}>
    <polygon points="..." fill="rgba(0,0,0,0)" stroke="..." />
    <circle r="12" fill="#00AA00"><text>3</text></circle>
    <!-- Enemy tokens -->
    <g clipPath="url(#enemy-clip-...)">
      <image href="/assets/enemies/..." />
    </g>
  </g>
  
  <!-- Layer 4: Ghost hexes -->
  <g transform="translate(x, y)" onClick={...}>
    <polygon points="..." strokeDasharray="8,4" />
    <text>?</text>
  </g>
  
  <!-- Layer 5: Hero token -->
  <g className="hero-token">
    <circle cx="..." cy="..." r="..." fill="#FF4444" />
  </g>
</svg>
```

### Unit Tokens/Meeples
- **Technology**: CSS sprites (background-image positioning)
- **Location**: `packages/client/src/components/Hand/FloatingUnitCarousel.tsx`
- **Structure**: `<div>` elements with CSS background-image sprites from atlas
- **Rendering**: Uses `getUnitSpriteStyle()` from `cardAtlas.ts` to compute background-position

### Cards in Hand
- **Technology**: CSS sprites (background-image positioning) + CSS transforms
- **Location**: `packages/client/src/components/Hand/FloatingHand.tsx`
- **Structure**: 
  - Container: `<div className="floating-hand">`
  - Cards: `<div className="floating-card-wrapper">` with absolute positioning
  - Card visuals: `<div className="floating-card">` with sprite background
- **Layout**: Fan layout using CSS transforms (translateX, translateY, rotate)

**Sample DOM structure**:
```html
<div className="floating-hand floating-hand--ready">
  <div className="floating-hand__cards">
    <div className="floating-card-wrapper" style="transform: translateX(...) translateY(...) rotate(...)">
      <div className="floating-card floating-card--playable" 
           style="background-image: url(...); background-position: ...; width: ...; height: ...">
      </div>
    </div>
    <!-- More cards... -->
  </div>
</div>
```

### Unit Offer Cards
- **Technology**: CSS sprites (same as hand cards)
- **Location**: `packages/client/src/components/OfferView/OfferCard.tsx`
- **Structure**: Similar to hand cards but in a grid/carousel layout

### Combat UI Elements
- **Technology**: React components with CSS positioning
- **Location**: `packages/client/src/components/Combat/CombatOverlay.tsx`
- **Structure**:
  - Fixed overlay: `<div className="combat-scene">` (position: fixed, z-index: 200)
  - Enemy cards: `<div className="combat-scene__enemies">` with `<EnemyCard>` components
  - Phase rail: `<VerticalPhaseRail>` component
  - Mana source: `<ManaSourceOverlay>` component
  - Effects: `<div className="combat-scene__effect">` for screen flashes

**Sample DOM structure**:
```html
<div className="combat-scene" data-testid="combat-overlay">
  <div className="combat-scene__effect combat-scene__effect--damage"></div>
  <div className="combat-scene__backdrop">
    <img src="/assets/sites/mage_tower.png" />
  </div>
  <div className="combat-scene__layout">
    <div className="combat-scene__phase-rail">...</div>
    <div className="combat-scene__battlefield">
      <div className="combat-scene__enemies">
        <EnemyCard enemy={...} />
      </div>
    </div>
  </div>
</div>
```

### Other Game Pieces
- **Mana Source**: React component with `<img>` tags for dice (`ManaSourceOverlay.tsx`)
- **Top Bar**: React component with standard HTML (`TopBar.tsx`)
- **Turn Actions**: React component (`TurnActions.tsx`)
- **Tooltips**: React components positioned absolutely (`HexTooltip.tsx`)
- **Context Menus**: React components positioned absolutely (`HexContextMenu.tsx`)

## 2. Interactivity: Clickable Elements

### Tiles (Hexes)
- **Purpose**: Movement, exploration, site interaction
- **Event Handling**: React `onClick` handlers on SVG `<g>` elements
- **Location**: `HexGrid.tsx:1387-1431` (`handleHexClick`)
- **Features**:
  - Movement pathfinding (A* algorithm)
  - Movement cost display
  - Path preview on hover
  - Site context menu on click

### Cards
- **Purpose**: Play cards, select for actions
- **Event Handling**: React `onClick` on card wrapper divs
- **Location**: `FloatingHand.tsx:122-127`, `PlayerHand.tsx:298-317`
- **Features**:
  - Click to open action menu (`CardActionMenu`)
  - Hover effects (lift, glow)
  - Playable state indication (color-coded glow)
  - Drag not currently implemented (click-only)

### Units
- **Purpose**: Display units in carousel, selection (future)
- **Event Handling**: Currently display-only, no click handlers
- **Location**: `FloatingUnitCarousel.tsx`

### Other Interactive Elements
- **Ghost Hexes**: Click to explore (`HexGrid.tsx:1433-1449`)
- **Combat Enemy Cards**: Click to assign block/damage/attack (`CombatOverlay.tsx:237-252`)
- **Mana Dice**: Click to use (via `ManaSourceOverlay`)
- **Context Menus**: Click to select site actions

## 3. Event Handling

### Current Approach
- **React Event Handlers**: All interactivity uses React's synthetic event system
  - `onClick` for clicks
  - `onMouseEnter`/`onMouseLeave` for hover
  - `onMouseMove` for tooltip positioning
- **No Drag & Drop**: Cards are click-only, no drag implementation
- **SVG Events**: SVG elements use React event handlers (e.g., `onClick` on `<g>`)

### Examples
```typescript
// Hex click (HexGrid.tsx:1387)
const handleHexClick = (coord: HexCoord) => {
  // Pathfinding and movement logic
  startPathAnimation(path);
};

// Card click (FloatingHand.tsx:122)
const handleClick = useCallback(() => {
  if (cardRef.current) {
    const rect = cardRef.current.getBoundingClientRect();
    onCardClick({ index: originalIndex, rect });
  }
}, [onCardClick, originalIndex]);
```

## 4. Animation Current State

### Animated Elements

#### Tile Exploration
- **Tech**: CSS animations (`@keyframes tile-reveal`)
- **Location**: `index.css:2098-2128`
- **Duration**: 600ms
- **Features**: Scale, opacity, blur, brightness transitions
- **Trigger**: State change (`isRevealing` prop)

#### Card Draws
- **Tech**: CSS animations (`@keyframes tactic-deal`, card fan animations)
- **Location**: `FloatingHand.tsx`, `TacticCarouselPane.tsx`
- **Duration**: Staggered (0.08s + 0.18s * position)
- **Features**: Opacity, translateY, scale, rotateX

#### Combat
- **Tech**: CSS animations + React state changes
- **Location**: `CombatOverlay.tsx:117-153`
- **Features**:
  - Enemy strike animation (wind-up + slam)
  - Screen flash effects (damage/block/attack)
  - Timing: setTimeout-based coordination

#### Hero Movement
- **Tech**: React state + CSS transitions
- **Location**: `HexGrid.tsx:919-995` (`AnimatedHeroToken`)
- **Features**: Smooth path animation through multiple hexes
- **Implementation**: State-driven position updates with `requestAnimationFrame`-like behavior

#### Tile Intro Cascade
- **Tech**: CSS animations with staggered delays
- **Location**: `index.css:2227-2253`
- **Duration**: 600ms per tile, staggered
- **Features**: Scale, translateY, blur, brightness

#### Enemy Token Reveal
- **Tech**: CSS animations (3D flip effect)
- **Location**: `index.css:2194-2219`
- **Duration**: 500ms with staggered delays
- **Features**: Perspective rotation, scale, translateY

### Animation Coordinator
- **Location**: `contexts/AnimationDispatcherContext.tsx`
- **Approach**: Event-based dispatcher (not React component level)
- **Events**: `intro-start`, `tiles-complete`, `enemies-complete`, `tactics-complete`, `intro-complete`
- **Usage**: Components emit events when animations complete, other components listen
- **Example**: `HexGrid.tsx:1001` uses `useAnimationDispatcher()` to emit events

### Animation Tech Summary
- **CSS Animations**: Primary method (keyframes, transitions)
- **CSS Transitions**: For hover effects, state changes
- **React State**: Drives animation triggers and timing
- **setTimeout**: Used for coordination (combat effects, delays)
- **No GSAP/Anime.js**: Pure CSS + React

## 5. Layout & Positioning

### Fixed on Screen
- **Hand of Cards**: Always visible at bottom (`position: fixed, bottom: 0`)
  - View modes: `board` (hidden), `ready` (partial), `focus` (centered)
- **Top Bar**: Fixed at top (`TopBar.tsx`)
- **Turn Actions**: Fixed UI panel
- **Mana Source Overlay**: Fixed in top-right (`position: absolute` within board container)
- **Combat Overlay**: Fixed full-screen overlay (`position: fixed, z-index: 200`)

### Scrolls/Pans
- **Hex Grid**: Currently uses SVG `viewBox` for "panning" (recalculates viewBox based on visible hexes)
  - No user-controlled pan/zoom currently
  - ViewBox auto-adjusts to include all visible hexes + ghost hexes
  - Location: `HexGrid.tsx:1377-1385` (viewBox calculation)

### Camera Pan/Zoom
- **Current State**: No camera controls
- **ViewBox Calculation**: `HexGrid.tsx:1377-1385`
  ```typescript
  const minX = Math.min(...allPositions.map((p) => p.x)) - HEX_SIZE * 2;
  const maxX = Math.max(...allPositions.map((p) => p.x)) + HEX_SIZE * 2;
  // Similar for Y, then: viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
  ```

### Game Board Size
- **Hex Size**: `HEX_SIZE = 50` pixels (center to corner)
- **Tile Size**: ~260x250 SVG units (covers 7-hex flower pattern)
- **Typical Visible Area**: Depends on explored tiles (dynamic)
- **Max Explored Area**: Unbounded (grows as player explores)
- **ViewBox**: Dynamically calculated to fit all visible hexes + padding

## 6. Code Structure: State Management

### Game State Location
- **Server State**: `packages/server/src/index.ts` (`GameServer` class)
- **Client State**: `packages/client/src/context/GameContext.tsx` (`GameProvider`)
- **State Flow**:
  1. Server maintains authoritative `GameState` (`packages/core/src/state/GameState.ts`)
  2. Server converts to `ClientGameState` via `toClientState()` (filters sensitive data)
  3. Server broadcasts to all connected clients via callback
  4. Client updates React state via `setState(newState)`
  5. Components access via `useGame()` hook

### State Sync
- **Method**: In-memory server (no network, same process)
- **Location**: `GameContext.tsx:34-64`
- **Flow**:
  ```typescript
  server.connect(PLAYER_ID, (newEvents, newState) => {
    setEvents((prev) => [...prev, ...newEvents]);
    setState(newState);
  });
  ```
- **Actions**: Client sends via `sendAction()`, server processes, broadcasts result

### Component Coupling
- **Separation**: Good separation between game logic and rendering
- **Game Logic**: Lives in `packages/core/` (engine, state, commands)
- **Rendering**: Lives in `packages/client/src/components/`
- **State Access**: Components use hooks (`useGame()`, `useMyPlayer()`) to access state
- **Actions**: Components call `sendAction()` to dispatch actions
- **Coupling Level**: Loose - components don't know about game logic internals

### State Structure
```typescript
// ClientGameState (filtered from GameState)
{
  phase: GamePhase;
  roundPhase: RoundPhase;
  players: ClientPlayer[];
  map: {
    hexes: Record<string, ClientHexState>;
    tiles: TileState[];
  };
  combat: ClientCombatState | null;
  validActions: ValidActions;
  // ... more
}
```

## 7. Migration Strategy: What Needs PixiJS vs React

### Migrate to PixiJS (Game World - Needs Camera Control)
1. **Hex Grid** (`HexGrid.tsx`)
   - Entire SVG → PixiJS Container
   - Tiles, hexes, paths, tokens
   - Camera pan/zoom controls
   - Hero movement animation
   - Tile reveal animations
   - Enemy token animations

2. **Hero Token** (currently in HexGrid)
   - Animated movement through hexes
   - Position updates

3. **Enemy Tokens on Board** (currently in HexGrid)
   - Token images with clipping
   - Reveal animations
   - Position updates

4. **Path Preview Lines** (currently in HexGrid)
   - Animated path lines
   - Arrow indicators

5. **Ghost Hexes** (currently in HexGrid)
   - Explore option indicators
   - Pulse animations

### Keep as React Components (UI Overlays - Fixed Position)
1. **Hand of Cards** (`FloatingHand.tsx`)
   - Fixed at bottom
   - CSS sprite-based (works fine)
   - Fan layout (CSS transforms work well)

2. **Combat Overlay** (`CombatOverlay.tsx`)
   - Full-screen overlay
   - Enemy cards (React components)
   - Phase rail
   - Screen effects

3. **Top Bar** (`TopBar.tsx`)
   - Fixed UI panel

4. **Turn Actions** (`TurnActions.tsx`)
   - Fixed UI panel

5. **Tooltips** (`HexTooltip.tsx`)
   - Positioned absolutely
   - React components

6. **Context Menus** (`HexContextMenu.tsx`)
   - Positioned absolutely
   - React components

7. **Mana Source Overlay** (`ManaSourceOverlay.tsx`)
   - Fixed position
   - Dice images (could stay React or move to PixiJS)

8. **OfferView** (`OfferView.tsx`)
   - Modal-style overlay
   - Card grid

### Hybrid Approach (Consider)
- **Mana Dice**: Could move to PixiJS for better roll animations
- **Card Sprites**: Could use PixiJS sprites instead of CSS, but CSS works fine
- **Combat Enemy Cards**: Could use PixiJS for better animations, but React is simpler

## 8. Key Files to Modify for Migration

### Primary Migration Target
- `packages/client/src/components/GameBoard/HexGrid.tsx` (1688 lines)
  - Replace entire SVG with PixiJS Application
  - Migrate all layers to PixiJS containers
  - Implement camera controls
  - Port animations to PixiJS tweens

### Supporting Files
- `packages/client/src/assets/assetPaths.ts` - Asset loading
- `packages/client/src/utils/cardAtlas.ts` - Sprite atlas (may need PixiJS version)
- `packages/client/src/components/GameBoard/ManaSourceOverlay.tsx` - Consider migration

### Animation System
- `packages/client/src/contexts/AnimationDispatcherContext.tsx` - Keep (works with any renderer)
- `packages/client/src/styles/index.css` - Remove hex grid animations, keep UI animations

## 9. Technical Details

### Current SVG Implementation
- **ViewBox**: Dynamic calculation based on hex positions
- **Coordinate System**: Axial hex coordinates → pixel coordinates via `hexToPixel()`
- **Layering**: 5 layers (tiles, effects, paths, overlays, hero)
- **Event Handling**: React synthetic events on SVG elements

### Sprite System
- **Atlas**: JSON file (`/assets/atlas.json`) with sprite sheet metadata
- **Loading**: `loadAtlas()` in `cardAtlas.ts` precomputes CSS styles
- **Usage**: `getCardSpriteStyle()`, `getUnitSpriteStyle()`, `getTacticSpriteStyle()`
- **Format**: CSS `background-image` + `background-position` + `background-size`

### Animation Timing
- **Tile Reveal**: 600ms
- **Enemy Reveal**: 500ms (staggered)
- **Hero Movement**: Per-hex timing (smooth interpolation)
- **Card Deal**: 500ms (staggered 0.08s intervals)
- **Combat Effects**: 400-450ms

## 10. Migration Complexity Estimate

### High Complexity
- HexGrid.tsx (1688 lines) - Complete rewrite
- Coordinate system conversion (SVG → PixiJS)
- Animation porting (CSS → PixiJS tweens)
- Event handling (React events → PixiJS interaction)

### Medium Complexity
- Camera controls (new feature)
- Asset loading (PixiJS Loader)
- Sprite atlas conversion (CSS → PixiJS Texture)

### Low Complexity
- Keep React components for UI overlays
- Animation dispatcher (works as-is)
- State management (no changes needed)

---

**Analysis Model**: This analysis was performed using semantic codebase search, file reading, and pattern matching across the TypeScript/React codebase. The analysis focused on:
- Component structure and rendering methods
- Event handling patterns
- Animation implementations
- State management architecture
- Layout and positioning strategies
