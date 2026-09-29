# roms.tn

Premium ROM discovery, library and list frontend for [roms.tn](https://roms.tn).

The landing is a single screen: hero, live searchable index, and a persistent shelf holding your saved records and your lists. Nothing navigates away to search or curate.

## 3D hero cartridges

The hero shows floating 3D cartridges instead of flat covers. The GLB shell, PBR plastic/paper materials, wrapping carousel math and studio light rig are ported from the `cartridge-studio` project (`D:\Github\cartridge-studio`); its debug panel, inspect mode and favorites UI were left behind.

- The carousel holds popular records (N64, GBA, PSX, SNES), each bound to the live shared index by search, like the canon shelves.
- Click a side cartridge to centre it; click the centred one to open its record page.
- The 3D code lazy-loads in its own chunk, so first paint stays fast. A static 2D stack shows while it loads.
- Labels are generated on a canvas by default: zero cover requests, ever.

### Real box art (optional, hero only)

By default no cover API is ever called. If you add your own ScreenScraper dev credentials to a gitignored `.env.local` (see `.env.example`, never commit keys), the app resolves real box art once per hero title, one request at a time, cached in the browser. The full index search never touches that API.

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
