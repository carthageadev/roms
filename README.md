# roms.tn

Minimalist ROM index and search frontend for [roms.tn](https://roms.tn).

This app does **not** run a scraper. It consumes the same weekly build produced by the Atlas repository:

- `https://carthageadev.github.io/atlas/data/meta.json`
- `https://carthageadev.github.io/atlas/data/roms.json.gz`

The index is decompressed in the browser, then searched locally. Queries support plain text plus compact filters such as `p:n64`, `c:nintendo`, and `y:199x`.

## Run locally

```bash
bun install
bun run dev
```

To point the app at a different published index, set `VITE_ATLAS_DATA_URL` before starting Vite.

The previous premium frontend is preserved on the `legacy` branch. The terminal frontend is preserved on the `terminal` branch. `main` contains the minimalist frontend.
