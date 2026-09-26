# roms.tn

Premium ROM discovery, library and list frontend for [roms.tn](https://roms.tn).

This app does **not** run a scraper and does **not** commit a ROM list. It consumes the shared weekly index at runtime:

- `https://carthageadev.github.io/atlas/data/meta.json`
- `https://carthageadev.github.io/atlas/data/roms.json.gz`

The index is decompressed and cached in the browser, then searched locally. Queries support plain text, wildcard/regex search, and compact filters such as `p:n64`, `c:nintendo`, and `y:199x`.

## Personal library and lists

Saved games and curated lists are stored in the browser with `localStorage` under:

```text
roms.tn/library/v1
```

The store supports:

- Save or remove games from the personal library
- Status: queued, in rotation, completed or mastered
- Pinning and archivist notes
- Creating, renaming and deleting lists
- Adding, removing and reordering list items
- Per-item curator notes
- JSON manifest export
- Cross-tab storage synchronization

No account or server database is used yet.

## Run locally

```bash
bun install
bun run dev
```

To point the app at a different published index, set `VITE_ATLAS_DATA_URL` before starting Vite.

The earlier minimalist frontend is preserved on the `terminal` branch. The original premium landing page is preserved on the `legacy` branch. `main` contains the current premium discovery experience.
