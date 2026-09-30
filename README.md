# roms.tn

Premium ROM discovery, library and list frontend for [roms.tn](https://roms.tn).

The landing pairs a quiet editorial layout and restrained metallic R branding with a live searchable index and a persistent personal shelf. Search, saves, and list creation stay on the landing page.

## 3D hero cartridges

The hero uses the original `cartridge-studio` GLB shell in a long, continuous vertical gallery. Its lighting environment is generated locally; there is no remote HDR, debug panel, or inspect mode.

- The carousel holds popular records (N64, GBA, PSX, SNES), each bound to the live shared index by search, like the canon shelves.
- Browse only by vertical drag or scroll wheel. Clicking does nothing; there are no selection buttons or keyboard selection paths. The caption follows the centered cartridge.
- Seven cartridges are visible at rest. All records remain mounted so entering and wrapping slots do not pop through the center.
- The scene renders on demand while moving, then stops when idle. Small shared WebP shell textures and a locally generated environment keep its rendering cost down.
- The 3D code loads in a separate chunk in parallel with the live index. Paper-label silhouettes show until the model is ready.
- The compressed model's Draco decoder is bundled locally, so loading the hero does not fetch decoder files from a third party.
- Paper labels are generated on a canvas by default: zero cover requests. They show the real title and platform, not a fabricated release year.

### Real box art (optional, hero only)

By default no cover API is ever called, even if older local credential settings exist. To opt in, set `VITE_ENABLE_HERO_COVER_ART=true` and your own ScreenScraper dev configuration in a gitignored `.env.local` (see `.env.example`). `VITE_` variables are public client configuration, so never use private account credentials here. Lookups are hero-only, serial, and browser-cached; the full index search never touches that API.

## Real data only

This app does **not** run a scraper and does **not** commit a ROM list. It consumes the shared weekly index at runtime:

- `https://carthageadev.github.io/atlas/data/meta.json`
- `https://carthageadev.github.io/atlas/data/roms.json.gz`

The index is decompressed and cached in the browser, then searched locally. Queries support plain text, wildcard/regex search, and compact filters such as `p:n64`, `c:nintendo`, and `y:199x`.

Every record on screen is a real row from that index, including the generated cover art (a deterministic hue stands in for the missing artwork).

## Curated canon shelves

`src/lib/canon.ts` holds three editorial shelves. A template is not a hardcoded list of records: each entry is a *search intent* that gets bound to the best matching record in the live index at runtime, so a canon stays correct even when the host renames or re-files a dump. Any entry with no match in the index is reported rather than faked.

## Personal library and lists

Saved games and curated lists are stored in the browser with `localStorage` under:

```text
roms.tn/library/v1
```

The store supports:

- Save or remove records from the personal library
- Status: queued, in rotation, completed or mastered
- Pinning and archivist notes
- Creating, renaming and deleting lists
- Adding, removing and reordering list items
- Per-item curator notes
- JSON manifest export
- Cross-tab storage synchronization

No account or server database is used.

## Routes

```text
/                    landing: hero + index + shelf
/browse              full paginated index with publisher and sort filters
/library             personal rack with status, pins and notes
/collections         all lists
/collections/:id     list workbench with an append panel
/rom/:slugOrId       single record page (explicit Download button only)
/platforms           every console the index reports
```

## Run locally

```bash
bun install
bun run dev
```

To point the app at a different published index, set `VITE_ATLAS_DATA_URL` before starting Vite.

## Branches

- `main` - the current landing experience
- `minimalist` - the previous single-column minimalist frontend
- `terminal` - the terminal frontend
- `legacy` - the original premium landing page
