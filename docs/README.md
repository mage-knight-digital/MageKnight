# Mage Knight Documentation

This folder contains reference materials for the Mage Knight board game implementation.

## Structure

```
docs/
├── rules/                    # Rulebooks and game rules
│   ├── rulebook.md          # Consolidated rules reference (markdown)
│   └── *.pdf                # Official PDF rulebooks
│
├── sprites/                  # All game asset sprites
│   ├── atlas.json           # Unified sprite atlas metadata
│   ├── cards/               # Card sprite sheets
│   │   ├── basic_actions.jpg
│   │   ├── advanced_actions.jpg
│   │   ├── spells.jpg
│   │   ├── artifacts.jpg
│   │   └── heroes.jpg
│   ├── units/               # Unit card sprites
│   │   ├── units_elite.jpg
│   │   └── units_regular.jpg
│   ├── enemies/             # Individual enemy token images
│   │   └── *.jpg
│   └── tiles/               # Map tile images
│       └── *.png
│
├── reference/               # Card text reference documents
│   └── basic-actions.md     # Basic action card effects
│
└── status.md                # Project status tracking
```

## Sprite Sheets

All sprite sheet metadata is in `sprites/atlas.json`. Key info:

| Sheet | File | Grid | Card Size | Notes |
|-------|------|------|-----------|-------|
| Basic Actions | cards/basic_actions.jpg | 7x4 | 1000x1400 | Full card images |
| Advanced Actions | cards/advanced_actions.jpg | 8x12 | 1000x700 | Even rows=artwork, odd=text |
| Spells | cards/spells.jpg | 6x8 | 1000x700 | Full card images |
| Artifacts | cards/artifacts.jpg | 5x10 | 1000x700 | Even rows=artwork, odd=text |
| Heroes | cards/heroes.jpg | 4x2 | 1000x1400 | Hero portrait cards |
| Elite Units | units/units_elite.jpg | 4x8 | 1000x700 | Even rows=artwork, odd=text |
| Regular Units | units/units_regular.jpg | 4x8 | 1000x700 | Even rows=artwork, odd=text |

## Reference Documents

- `reference/basic-actions.md` - Complete text of all 28 basic action cards
- TODO: `reference/spells.md` - Spell card effects
- TODO: `reference/advanced-actions.md` - Advanced action card effects
